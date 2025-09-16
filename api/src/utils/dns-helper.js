const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const dns = require('dns').promises;

async function verifyCnameWithDig(hostname) {
  try {
    const { stdout } = await execAsync(`dig +short CNAME ${hostname}`);
    const cname = stdout.trim();

    if (cname) {
      console.log(`✅ DIG found CNAME for ${hostname}: ${cname}`);
      return cname;
    }

    console.log(`❌ DIG found no CNAME for ${hostname}`);
    return null;
  } catch (error) {
    console.error('DIG error:', error.message);
    return null;
  }
}

async function verifyCnameWithNslookup(hostname) {
  try {
    const { stdout } = await execAsync(`nslookup -type=CNAME ${hostname} 8.8.8.8`);

    // Parse nslookup output
    const lines = stdout.split('\n');
    for (const line of lines) {
      if (line.includes('canonical name =')) {
        const cname = line.split('canonical name =')[1].trim();
        console.log(`✅ NSLOOKUP found CNAME for ${hostname}: ${cname}`);
        return cname;
      }
    }

    console.log(`❌ NSLOOKUP found no CNAME for ${hostname}`);
    return null;
  } catch (error) {
    console.error('NSLOOKUP error:', error.message);
    return null;
  }
}

async function verifyCname(hostname) {
  console.log(`🔍 Verificando CNAME para: ${hostname}`);

  // Método 1: Node.js DNS
  try {
    const cnameRecords = await dns.resolveCname(hostname);
    if (cnameRecords && cnameRecords.length > 0) {
      console.log(`✅ Node DNS found CNAME: ${cnameRecords[0]}`);
      return cnameRecords[0];
    }
  } catch (error) {
    console.log(`❌ Node DNS error: ${error.code}`);
  }

  // Método 2: DIG command
  const digResult = await verifyCnameWithDig(hostname);
  if (digResult) {
    return digResult;
  }

  // Método 3: NSLOOKUP command
  const nslookupResult = await verifyCnameWithNslookup(hostname);
  if (nslookupResult) {
    return nslookupResult;
  }

  // Método 4: ResolveAny
  try {
    const records = await dns.resolveAny(hostname);
    const cnameRecord = records.find(r => r.type === 'CNAME');
    if (cnameRecord) {
      console.log(`✅ ResolveAny found CNAME: ${cnameRecord.value}`);
      return cnameRecord.value;
    }
  } catch (error) {
    console.log(`❌ ResolveAny error: ${error.code}`);
  }

  return null;
}

module.exports = {
  verifyCname
};