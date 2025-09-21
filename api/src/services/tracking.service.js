const { databasePool } = require('../config/database.config');
const cloudflareService = require('./cloudflare.service');
const crypto = require('crypto');
const { verifyCname } = require('../utils/dns-helper');

class TrackingService {
  // Crear nuevo dominio de tracking - ESPERA HASTA TENER AMBOS REGISTROS
  async createTrackingDomain(hostname) {
    const client = await databasePool.connect();

    try {
      await client.query('BEGIN');

      // Verificar si el hostname ya existe
      const existingHostname = await client.query(
        'SELECT id FROM public.tracking_domains WHERE hostname = $1',
        [hostname]
      );

      if (existingHostname.rows.length > 0) {
        throw new Error('Este hostname ya está registrado');
      }

      // VERIFICAR CNAME ANTES DE CREAR EN CLOUDFLARE
      const expectedTarget = process.env.TRACKING_HOST;

      if (!expectedTarget) {
        throw new Error('TRACKING_HOST no está configurado en las variables de entorno. Define TRACKING_HOST en .env.local');
      }

      console.log(`🔍 Verificando CNAME de ${hostname} -> ${expectedTarget}`);

      const cnameVerification = await verifyCname(hostname, expectedTarget, 3);

      if (!cnameVerification) {
        throw new Error(
          `El dominio ${hostname} NO está apuntando correctamente a ${expectedTarget}. ` +
          `Por favor configura el registro CNAME en tu proveedor DNS:\n` +
          `Tipo: CNAME\n` +
          `Nombre: ${hostname}\n` +
          `Valor: ${expectedTarget}\n` +
          `Espera 5-10 minutos para propagación DNS y vuelve a intentar.`
        );
      }

      console.log(`✅ CNAME verificado correctamente: ${hostname} -> ${cnameVerification}`);

      // Crear hostname en Cloudflare SOLO si el CNAME está correcto
      const cfResult = await cloudflareService.createCustomHostname(hostname);
      console.log('Cloudflare initial response:', JSON.stringify(cfResult, null, 2));

      let finalRecords = cfResult.validationRecords || [];

      // Si no tenemos el registro SSL, esperamos hasta obtenerlo
      const sslRecord = finalRecords.find(r => r.purpose === 'ssl_validation' && r.status === 'ready');
      const ownershipRecord = finalRecords.find(r => r.purpose === 'ownership_verification');

      if (!sslRecord || !ownershipRecord) {
        console.log('⏳ SSL record not ready, waiting for both records...');

        // Esperar hasta 45 segundos para obtener ambos registros
        try {
          finalRecords = await cloudflareService.pollForSSLRecords(cfResult.hostnameId, 15, 3000);
          console.log('✅ Got both records after polling');
        } catch (pollError) {
          console.error('⚠️ Polling timeout, but continuing with available records');
          // Si falla el polling, usar lo que tengamos
        }
      }

      // Buscar los registros finales
      const finalSslRecord = finalRecords.find(r => r.purpose === 'ssl_validation' && r.status === 'ready');
      const finalOwnershipRecord = finalRecords.find(r => r.purpose === 'ownership_verification');

      // Solo guardar si tenemos AMBOS registros
      if (!finalSslRecord || !finalOwnershipRecord) {
        await client.query('ROLLBACK');
        throw new Error('No se pudieron obtener ambos registros DNS de Cloudflare. Por favor intenta de nuevo en unos momentos.');
      }

      // Guardar en base de datos con AMBOS registros completos
      const insertResult = await client.query(`
        INSERT INTO public.tracking_domains (
          hostname, status, cf_hostname_id,
          dcv_method, dcv_record_name, dcv_record_value,
          dns_instructions, ssl_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [
        hostname,
        'verifying',
        cfResult.hostnameId,
        'txt',
        finalSslRecord.name,
        finalSslRecord.value,
        JSON.stringify([finalOwnershipRecord, finalSslRecord]), // Ambos registros
        'pending_validation'
      ]);

      await client.query('COMMIT');

      return {
        success: true,
        domain: insertResult.rows[0],
        dnsInstructions: [finalOwnershipRecord, finalSslRecord], // Siempre devolver ambos
        allRecordsReady: true
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating tracking domain:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Obtener todos los dominios de tracking
  async getTrackingDomains() {
    try {
      const result = await databasePool.query(
        'SELECT * FROM public.tracking_domains ORDER BY created_at DESC'
      );

      return result.rows;
    } catch (error) {
      console.error('Error getting tracking domains:', error);
      throw error;
    }
  }

  // Verificar y actualizar estado del dominio
  async verifyDomainStatus(domainId) {
    const client = await databasePool.connect();

    try {
      await client.query('BEGIN');

      // Obtener dominio de la DB
      const domainResult = await client.query(
        'SELECT * FROM public.tracking_domains WHERE id = $1',
        [domainId]
      );

      if (domainResult.rows.length === 0) {
        throw new Error('Domain not found');
      }

      const domain = domainResult.rows[0];

      // Verificar estado en Cloudflare
      const cfStatus = await cloudflareService.getHostnameStatus(domain.cf_hostname_id);

      // Actualizar estado en DB
      const newStatus = cfStatus.isActive ? 'active' : 'verifying';
      const updateResult = await client.query(`
        UPDATE public.tracking_domains
        SET status = $1,
            ssl_status = $2,
            last_checked_at = CURRENT_TIMESTAMP,
            dcv_verified_at = CASE WHEN $1 = 'active' AND dcv_verified_at IS NULL
                             THEN CURRENT_TIMESTAMP
                             ELSE dcv_verified_at END
        WHERE id = $3
        RETURNING *
      `, [newStatus, cfStatus.sslStatus, domainId]);

      await client.query('COMMIT');

      return {
        success: true,
        domain: updateResult.rows[0],
        isActive: cfStatus.isActive
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error verifying domain status:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Generar session ID único con timeout de 30 minutos
  generateSessionId(data) {
    const hash = crypto.createHash('sha256');
    hash.update(data.ip || '');
    hash.update(data.userAgent || '');
    // Agregar ventana de 30 minutos para nueva sesión
    const now = new Date();
    const sessionWindow = Math.floor(now.getTime() / (30 * 60 * 1000)); // 30 min windows
    hash.update(sessionWindow.toString());
    return 'sess_' + hash.digest('hex').slice(0, 16);
  }

  // Generar visitor ID único
  generateVisitorId(data) {
    const hash = crypto.createHash('sha256');
    hash.update(data.ip || '');
    hash.update(data.userAgent || '');
    return 'vis_' + hash.digest('hex').slice(0, 16);
  }

  // Detectar tipo de dispositivo
  detectDeviceType(userAgent) {
    if (!userAgent) return 'unknown';

    const ua = userAgent.toLowerCase();
    if (/mobile|android|iphone/i.test(ua)) return 'mobile';
    if (/tablet|ipad/i.test(ua)) return 'tablet';
    return 'desktop';
  }

  // Parsear información del navegador
  parseBrowserInfo(userAgent) {
    if (!userAgent) {
      return { browser: 'unknown', version: null, os: 'unknown' };
    }

    const ua = userAgent.toLowerCase();
    let browser = 'unknown';
    let version = null;
    let os = 'unknown';

    // Detectar navegador
    if (ua.includes('chrome') && !ua.includes('edg')) {
      browser = 'chrome';
      const match = ua.match(/chrome\/(\d+)/);
      version = match ? match[1] : null;
    } else if (ua.includes('safari') && !ua.includes('chrome')) {
      browser = 'safari';
      const match = ua.match(/version\/(\d+)/);
      version = match ? match[1] : null;
    } else if (ua.includes('firefox')) {
      browser = 'firefox';
      const match = ua.match(/firefox\/(\d+)/);
      version = match ? match[1] : null;
    } else if (ua.includes('edg')) {
      browser = 'edge';
      const match = ua.match(/edg\/(\d+)/);
      version = match ? match[1] : null;
    }

    // Detectar OS
    if (ua.includes('windows')) os = 'windows';
    else if (ua.includes('mac')) os = 'macos';
    else if (ua.includes('linux')) os = 'linux';
    else if (ua.includes('android')) os = 'android';
    else if (ua.includes('iphone') || ua.includes('ipad')) os = 'ios';

    return { browser, version, os };
  }

  // Detectar canal de tráfico
  detectChannel(params, referrerDomain) {
    // Prioridad 1: Paid ads
    if (params.gclid || params.fbclid || params.msclkid || params.ttclid) {
      return 'paid';
    }

    // Prioridad 2: UTM medium
    if (params.utm_medium) {
      const medium = params.utm_medium.toLowerCase();
      if (medium.includes('cpc') || medium.includes('ppc') || medium.includes('paid')) {
        return 'paid';
      }
      if (medium.includes('email')) {
        return 'email';
      }
      if (medium.includes('social')) {
        return 'social';
      }
      if (medium === 'organic') {
        return 'organic';
      }
    }

    // Prioridad 3: UTM source
    if (params.utm_source) {
      const source = params.utm_source.toLowerCase();
      if (source.includes('facebook') || source.includes('instagram') || source.includes('twitter')) {
        return 'social';
      }
      if (source.includes('google') || source.includes('bing')) {
        return params.utm_medium ? 'paid' : 'organic';
      }
    }

    // Prioridad 4: Referrer
    if (referrerDomain) {
      const domain = referrerDomain.toLowerCase();

      // Social networks - Ahora configurable desde variables de entorno si es necesario
      const socialDomains = process.env.SOCIAL_DOMAINS ?
        process.env.SOCIAL_DOMAINS.split(',') :
        ['facebook.com', 'instagram.com', 'twitter.com', 'linkedin.com', 'tiktok.com', 'youtube.com'];

      if (socialDomains.some(social => domain.includes(social))) {
        return 'social';
      }

      // Search engines - También configurable
      const searchDomains = process.env.SEARCH_DOMAINS ?
        process.env.SEARCH_DOMAINS.split(',') :
        ['google.', 'bing.com', 'yahoo.com', 'duckduckgo.com'];

      if (searchDomains.some(search => domain.includes(search))) {
        return 'organic';
      }
      // Otro referrer
      return 'referral';
    }

    // Sin referrer = Direct
    return 'direct';
  }

  // Obtener dominio activo
  async getActiveDomain() {
    try {
      const result = await databasePool.query(
        'SELECT * FROM public.tracking_domains WHERE status = $1 AND is_active = true LIMIT 1',
        ['active']
      );

      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting active domain:', error);
      return null;
    }
  }

  // Polling asíncrono mejorado en background
  async startAsyncSSLPolling(cfHostnameId, domainId) {
    console.log(`Starting async SSL polling for CF hostname: ${cfHostnameId}, domain: ${domainId}`);

    // No bloquear - ejecutar en background
    setImmediate(async () => {
      try {
        // Esperar máximo 3 minutos con intervalos de 3 segundos
        const records = await cloudflareService.pollForSSLRecords(cfHostnameId, 60, 3000);

        // Si obtuvimos los registros SSL, actualizar BD
        const sslRecord = records.find(r => r.purpose === 'ssl_validation' && r.status === 'ready');
        if (sslRecord) {
          await this.updateSSLRecordsById(domainId, records);
          console.log('✅ SSL records updated in database');
        } else {
          console.log('⚠️ SSL records not ready after polling');
        }
      } catch (error) {
        console.error('Error in async SSL polling:', error);
      }
    });
  }

  // Actualizar registros SSL por ID de dominio
  async updateSSLRecordsById(domainId, validationRecords) {
    try {
      const sslRecord = validationRecords.find(r => r.purpose === 'ssl_validation' && r.status === 'ready');

      if (sslRecord) {
        await databasePool.query(`
          UPDATE public.tracking_domains
          SET dcv_record_name = $1,
              dcv_record_value = $2,
              dns_instructions = $3,
              ssl_status = 'pending_validation',
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $4
        `, [
          sslRecord.name,
          sslRecord.value,
          JSON.stringify(validationRecords),
          domainId
        ]);
        console.log(`Updated domain ${domainId} with SSL records`);
      }
    } catch (error) {
      console.error('Error updating SSL records by ID:', error);
    }
  }

  // Mantener compatibilidad - actualizar por hostname de CF
  async updateSSLRecords(hostnameId, validationRecords) {
    try {
      const sslRecord = validationRecords.find(r => r.purpose === 'ssl_validation' && r.status === 'ready');

      if (sslRecord) {
        await databasePool.query(`
          UPDATE public.tracking_domains
          SET dcv_record_name = $1,
              dcv_record_value = $2,
              dns_instructions = $3,
              ssl_status = 'pending_validation',
              updated_at = CURRENT_TIMESTAMP
          WHERE cf_hostname_id = $4
        `, [
          sslRecord.name,
          sslRecord.value,
          JSON.stringify(validationRecords),
          hostnameId
        ]);
      }
    } catch (error) {
      console.error('Error updating SSL records:', error);
    }
  }

  // Obtener registros DNS - SIEMPRE devuelve ambos o error
  async getDomainDNSRecords(domainId) {
    try {
      const result = await databasePool.query(
        'SELECT * FROM public.tracking_domains WHERE id = $1',
        [domainId]
      );

      if (result.rows.length === 0) {
        throw new Error('Domain not found');
      }

      const domain = result.rows[0];

      // Si ya tenemos ambos registros en BD, devolverlos
      if (domain.dns_instructions) {
        // Verificar si ya es un array o necesita ser parseado
        const savedRecords = typeof domain.dns_instructions === 'string'
          ? JSON.parse(domain.dns_instructions)
          : domain.dns_instructions;
        const sslRecord = savedRecords.find(r => r.purpose === 'ssl_validation');
        const ownershipRecord = savedRecords.find(r => r.purpose === 'ownership_verification');

        if (sslRecord && ownershipRecord) {
          return {
            success: true,
            hostname: domain.hostname,
            records: savedRecords,
            allRecordsReady: true
          };
        }
      }

      // Si no tenemos ambos, intentar obtenerlos de Cloudflare
      console.log('🔄 Fetching updated records from Cloudflare...');

      try {
        // Hacer polling para obtener ambos registros
        const records = await cloudflareService.pollForSSLRecords(domain.cf_hostname_id, 10, 3000);

        const sslRecord = records.find(r => r.purpose === 'ssl_validation' && r.status === 'ready');
        const ownershipRecord = records.find(r => r.purpose === 'ownership_verification' && r.status === 'ready');

        if (sslRecord && ownershipRecord) {
          // Actualizar BD con ambos registros
          await this.updateSSLRecordsById(domainId, records);

          return {
            success: true,
            hostname: domain.hostname,
            records: [ownershipRecord, sslRecord],
            allRecordsReady: true
          };
        }
      } catch (pollError) {
        console.error('Error polling for records:', pollError);
      }

      // Si no pudimos obtener ambos, devolver error
      throw new Error('Los registros DNS aún no están listos. Por favor intenta de nuevo en unos segundos.');
    } catch (error) {
      console.error('Error getting domain DNS records:', error);
      throw error;
    }
  }

  // Eliminar dominio de tracking
  async deleteTrackingDomain(domainId) {
    const client = await databasePool.connect();

    try {
      await client.query('BEGIN');

      // Obtener información del dominio antes de eliminar
      const domainResult = await client.query(
        'SELECT * FROM public.tracking_domains WHERE id = $1',
        [domainId]
      );

      if (domainResult.rows.length === 0) {
        throw new Error('Dominio no encontrado');
      }

      const domain = domainResult.rows[0];

      // Eliminar de Cloudflare si existe
      if (domain.cf_hostname_id) {
        try {
          await cloudflareService.deleteCustomHostname(domain.cf_hostname_id);
        } catch (error) {
          console.error('Error eliminando de Cloudflare:', error);
          // Continuar aunque falle Cloudflare
        }
      }

      // Eliminar de la base de datos
      await client.query(
        'DELETE FROM public.tracking_domains WHERE id = $1',
        [domainId]
      );

      await client.query('COMMIT');

      return {
        success: true,
        message: `Dominio ${domain.hostname} eliminado correctamente`
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error eliminando dominio:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Sincronizar dominios con Cloudflare
  async syncWithCloudflare() {
    const client = await databasePool.connect();

    try {
      console.log('🔄 Starting sync with Cloudflare...');

      // Obtener todos los hostnames de Cloudflare
      const cloudflareHostnames = await cloudflareService.getAllCustomHostnames();
      console.log(`Found ${cloudflareHostnames.length} hostnames in Cloudflare`);

      // Obtener todos los dominios de la base de datos
      const dbResult = await client.query('SELECT * FROM public.tracking_domains');
      const dbDomains = dbResult.rows;
      console.log(`Found ${dbDomains.length} domains in database`);

      // Crear un mapa de dominios existentes en DB
      const dbDomainMap = new Map(dbDomains.map(d => [d.hostname, d]));

      let added = 0;
      let updated = 0;

      // Sincronizar cada hostname de Cloudflare
      for (const cfHostname of cloudflareHostnames) {
        const existingDomain = dbDomainMap.get(cfHostname.hostname);

        if (!existingDomain) {
          // Dominio nuevo encontrado en Cloudflare, agregarlo a la DB
          console.log(`📥 Adding new domain from Cloudflare: ${cfHostname.hostname}`);

          // Obtener detalles completos del hostname
          const details = await cloudflareService.getHostnameStatus(cfHostname.id);

          // Extraer registros DNS
          const sslRecord = details.validationRecords.find(r => r.purpose === 'ssl_validation');
          const ownershipRecord = details.validationRecords.find(r => r.purpose === 'ownership_verification');

          await client.query(`
            INSERT INTO public.tracking_domains (
              hostname, status, cf_hostname_id,
              dcv_method, dcv_record_name, dcv_record_value,
              dns_instructions, ssl_status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (hostname) DO NOTHING
          `, [
            cfHostname.hostname,
            cfHostname.isActive ? 'active' : 'verifying',
            cfHostname.id,
            'txt',
            sslRecord?.name || null,
            sslRecord?.value || null,
            JSON.stringify(details.validationRecords),
            cfHostname.sslStatus || 'pending_validation'
          ]);

          added++;
        } else if (existingDomain.cf_hostname_id !== cfHostname.id ||
                   existingDomain.status !== (cfHostname.isActive ? 'active' : 'verifying')) {
          // Actualizar estado si cambió
          console.log(`🔄 Updating domain status: ${cfHostname.hostname}`);

          await client.query(`
            UPDATE public.tracking_domains
            SET status = $1,
                ssl_status = $2,
                cf_hostname_id = $3,
                last_checked_at = CURRENT_TIMESTAMP,
                dcv_verified_at = CASE
                  WHEN $1 = 'active' AND dcv_verified_at IS NULL
                  THEN CURRENT_TIMESTAMP
                  ELSE dcv_verified_at
                END
            WHERE hostname = $4
          `, [
            cfHostname.isActive ? 'active' : 'verifying',
            cfHostname.sslStatus || 'pending_validation',
            cfHostname.id,
            cfHostname.hostname
          ]);

          updated++;
        }
      }

      // Opcionalmente: marcar como eliminados los que ya no están en Cloudflare
      const cfHostnameSet = new Set(cloudflareHostnames.map(h => h.hostname));
      let removed = 0;

      for (const dbDomain of dbDomains) {
        if (!cfHostnameSet.has(dbDomain.hostname) && dbDomain.cf_hostname_id) {
          console.log(`🗑️ Domain no longer in Cloudflare: ${dbDomain.hostname}`);
          // Puedes elegir eliminar o marcar como inactivo
          await client.query(
            'UPDATE public.tracking_domains SET status = $1 WHERE id = $2',
            ['failed', dbDomain.id]
          );
          removed++;
        }
      }

      console.log(`✅ Sync completed: ${added} added, ${updated} updated, ${removed} marked as failed`);

      return {
        success: true,
        added,
        updated,
        removed,
        total: cloudflareHostnames.length
      };
    } catch (error) {
      console.error('Error syncing with Cloudflare:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = new TrackingService();
