const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const dns = require('dns').promises;

// Normalizar dominios quitando trailing dots y espacios
function normalizeDomain(domain) {
  if (!domain) return null;
  // Quitar espacios, trailing dots, y convertir a minúsculas
  return domain.trim().replace(/\.$/, '').toLowerCase();
}

async function verifyCnameWithDig(hostname) {
  const dnsServers = ['8.8.8.8', '1.1.1.1', '']; // Google, Cloudflare, default

  for (const server of dnsServers) {
    try {
      const serverFlag = server ? `@${server}` : '';
      const { stdout } = await execAsync(`dig +short CNAME ${hostname} ${serverFlag}`);
      const cname = stdout.trim();

      if (cname) {
        console.log(`✅ DIG found CNAME for ${hostname} using ${server || 'default DNS'}: ${cname}`);
        return normalizeDomain(cname);
      }
    } catch (error) {
      // Continuar con siguiente servidor
      console.log(`DIG error with ${server || 'default'}: ${error.message}`);
    }
  }

  console.log(`❌ DIG found no CNAME for ${hostname} on any DNS server`);
  return null;
}

async function verifyCnameWithNslookup(hostname) {
  const dnsServers = ['8.8.8.8', '1.1.1.1'];

  for (const server of dnsServers) {
    try {
      const { stdout } = await execAsync(`nslookup -type=CNAME ${hostname} ${server}`);

      // Parse nslookup output
      const lines = stdout.split('\n');
      for (const line of lines) {
        if (line.includes('canonical name =')) {
          const cname = line.split('canonical name =')[1].trim();
          console.log(`✅ NSLOOKUP found CNAME for ${hostname} using ${server}: ${cname}`);
          return normalizeDomain(cname);
        }
      }
    } catch (error) {
      console.log(`NSLOOKUP error with ${server}: ${error.message}`);
    }
  }

  console.log(`❌ NSLOOKUP found no CNAME for ${hostname}`);
  return null;
}

async function verifyCname(hostname, expectedTarget = null, retries = 3) {
  hostname = normalizeDomain(hostname);
  expectedTarget = expectedTarget ? normalizeDomain(expectedTarget) : null;

  console.log(`🔍 Verificando CNAME para: ${hostname}`);
  if (expectedTarget) {
    console.log(`🎯 Esperando que apunte a: "${expectedTarget}"`);
    console.log(`   Longitud esperada: ${expectedTarget.length} caracteres`);
    console.log(`   Caracteres: [${expectedTarget.split('').map(c => c.charCodeAt(0)).join(', ')}]`);
  }

  // Almacenar todos los CNAMEs encontrados para debugging
  const cnamesFound = [];

  for (let attempt = 1; attempt <= retries; attempt++) {
    console.log(`📡 Intento ${attempt} de ${retries}...`);

    // Método 1: Node.js DNS
    try {
      const cnameRecords = await dns.resolveCname(hostname);
      if (cnameRecords && cnameRecords.length > 0) {
        const found = normalizeDomain(cnameRecords[0]);
        console.log(`✅ Node DNS found CNAME: "${found}"`);
        console.log(`   Longitud encontrada: ${found.length} caracteres`);
        console.log(`   Caracteres: [${found.split('').map(c => c.charCodeAt(0)).join(', ')}]`);
        cnamesFound.push(`Node DNS: ${found}`);

        if (!expectedTarget) return found;

        console.log(`   Comparando: "${found}" === "${expectedTarget}" → ${found === expectedTarget}`);
        if (found === expectedTarget) {
          console.log(`✅ CNAME coincide con el target esperado!`);
          return found;
        }
        console.log(`⚠️ CNAME apunta a ${found} pero se esperaba ${expectedTarget}`);
        // NO retornar null, continuar con otros métodos
      }
    } catch (error) {
      console.log(`❌ Node DNS error: ${error.code}`);
    }

    // Método 2: DIG command
    const digResult = await verifyCnameWithDig(hostname);
    if (digResult) {
      console.log(`   DIG encontró: "${digResult}" (${digResult.length} chars)`);
      cnamesFound.push(`DIG: ${digResult}`);
      if (!expectedTarget) return digResult;

      console.log(`   Comparando DIG: "${digResult}" === "${expectedTarget}" → ${digResult === expectedTarget}`);
      if (digResult === expectedTarget) {
        console.log(`✅ DIG: CNAME coincide con el target esperado!`);
        return digResult;
      }
      console.log(`⚠️ DIG: CNAME apunta a ${digResult} pero se esperaba ${expectedTarget}`);
      // NO retornar null, continuar con otros métodos
    }

    // Método 3: NSLOOKUP command
    const nslookupResult = await verifyCnameWithNslookup(hostname);
    if (nslookupResult) {
      cnamesFound.push(`NSLOOKUP: ${nslookupResult}`);
      if (!expectedTarget) return nslookupResult;
      if (nslookupResult === expectedTarget) {
        console.log(`✅ NSLOOKUP: CNAME coincide con el target esperado!`);
        return nslookupResult;
      }
      console.log(`⚠️ NSLOOKUP: CNAME apunta a ${nslookupResult} pero se esperaba ${expectedTarget}`);
      // NO retornar null, continuar con otros métodos
    }

    // Método 4: ResolveAny
    try {
      const records = await dns.resolveAny(hostname);
      const cnameRecord = records.find(r => r.type === 'CNAME');
      if (cnameRecord) {
        const found = normalizeDomain(cnameRecord.value);
        console.log(`✅ ResolveAny found CNAME: ${found}`);
        cnamesFound.push(`ResolveAny: ${found}`);

        if (!expectedTarget) return found;
        if (found === expectedTarget) {
          console.log(`✅ ResolveAny: CNAME coincide con el target esperado!`);
          return found;
        }
        console.log(`⚠️ ResolveAny: CNAME apunta a ${found} pero se esperaba ${expectedTarget}`);
        // NO retornar null, continuar con otros métodos
      }
    } catch (error) {
      console.log(`❌ ResolveAny error: ${error.code}`);
    }

    // Si no es el último intento, esperar un poco
    if (attempt < retries) {
      console.log(`⏳ Esperando 2 segundos antes de reintentar...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Si encontramos CNAMEs pero ninguno coincidió, mostrar todos los encontrados
  if (cnamesFound.length > 0) {
    console.log(`❌ Se encontraron CNAMEs pero ninguno coincide con ${expectedTarget}:`);
    cnamesFound.forEach(cname => console.log(`   - ${cname}`));
  } else {
    console.log(`❌ No se pudo verificar CNAME después de ${retries} intentos`);
  }

  return null;
}

module.exports = {
  verifyCname,
  normalizeDomain
};