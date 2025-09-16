const { databasePool } = require('../config/database.config');
const cloudflareService = require('./cloudflare.service');
const crypto = require('crypto');

class TrackingService {
  // Crear nuevo dominio de tracking - ESPERA HASTA TENER AMBOS REGISTROS
  async createTrackingDomain(subaccountId, hostname) {
    const client = await databasePool.connect();

    try {
      await client.query('BEGIN');

      // Usar el subaccount_id directamente (ya debe venir del request)
      if (!subaccountId) {
        subaccountId = process.env.DEFAULT_SUBACCOUNT_ID;
      }

      // Verificar si ya existe un dominio para esta subcuenta (limite 1 por subcuenta)
      const existingSubaccount = await client.query(
        'SELECT id, hostname FROM public.tracking_domains WHERE subaccount_id = $1',
        [subaccountId]
      );

      if (existingSubaccount.rows.length > 0) {
        throw new Error(`Ya existe un dominio de tracking para esta subcuenta: ${existingSubaccount.rows[0].hostname}. Elimina el dominio existente antes de agregar uno nuevo.`);
      }

      // Verificar si el hostname ya existe (para cualquier owner)
      const existingHostname = await client.query(
        'SELECT id FROM public.tracking_domains WHERE hostname = $1',
        [hostname]
      );

      if (existingHostname.rows.length > 0) {
        throw new Error('Este hostname ya está en uso por otra cuenta');
      }

      // Crear hostname en Cloudflare
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
          subaccount_id, hostname, status, cf_hostname_id,
          dcv_method, dcv_record_name, dcv_record_value,
          dns_instructions, ssl_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [
        subaccountId,
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

  // Obtener dominios de tracking por subcuenta
  async getTrackingDomains(subaccountId) {
    try {
      // Si no hay subaccountId, usar el default
      if (!subaccountId) {
        subaccountId = process.env.DEFAULT_SUBACCOUNT_ID;
      }

      const result = await databasePool.query(
        'SELECT * FROM public.tracking_domains WHERE subaccount_id = $1 ORDER BY created_at DESC',
        [subaccountId]
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

  // Registrar visita (pageview)
  async recordPageView(data) {
    try {
      // Generar IDs únicos
      const sessionId = this.generateSessionId(data);
      const visitorId = this.generateVisitorId(data);

      // Parsear URL
      const url = new URL(data.url);

      // Extraer parámetros UTM y otros
      const params = Object.fromEntries(url.searchParams);

      // Insertar en tracking.sessions
      const result = await databasePool.query(`
        INSERT INTO tracking.sessions (
          session_id,
          account_id,
          subaccount_id,
          visitor_id,
          contact_id,
          event_name,
          landing_url,
          landing_host,
          landing_path,
          landing_query,
          referrer_url,
          referrer_domain,
          utm_source,
          utm_medium,
          utm_campaign,
          utm_term,
          utm_content,
          user_agent,
          ip,
          device_type,
          pageviews_count
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
        ON CONFLICT (session_id) DO UPDATE SET
          last_event_at = CURRENT_TIMESTAMP,
          pageviews_count = tracking.sessions.pageviews_count + 1
        RETURNING *
      `, [
        sessionId,
        data.accountId || process.env.ACCOUNT_ID,
        data.subaccountId || process.env.DEFAULT_SUBACCOUNT_ID,
        visitorId,
        null, // contact_id se puede vincular después
        'page_view',
        data.url,
        url.hostname,
        url.pathname,
        url.search,
        data.referrer || null,
        data.referrer ? new URL(data.referrer).hostname : null,
        params.utm_source || null,
        params.utm_medium || null,
        params.utm_campaign || null,
        params.utm_term || null,
        params.utm_content || null,
        data.userAgent || null,
        data.ip || null,
        this.detectDeviceType(data.userAgent),
        1
      ]);

      return {
        success: true,
        sessionId: sessionId,
        visitorId: visitorId
      };
    } catch (error) {
      console.error('Error recording page view:', error);
      throw error;
    }
  }

  // Generar session ID único
  generateSessionId(data) {
    const hash = crypto.createHash('sha256');
    hash.update(data.ip || '');
    hash.update(data.userAgent || '');
    hash.update(new Date().toISOString().slice(0, 10)); // Fecha actual
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

  // Obtener dominio activo para la subcuenta
  async getActiveDomain(subaccountId) {
    try {
      // Si no hay subaccountId, usar el default
      if (!subaccountId) {
        subaccountId = process.env.DEFAULT_SUBACCOUNT_ID;
      }

      const result = await databasePool.query(
        'SELECT * FROM public.tracking_domains WHERE subaccount_id = $1 AND status = $2 LIMIT 1',
        [subaccountId, 'active']
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
  async deleteTrackingDomain(domainId, subaccountId) {
    const client = await databasePool.connect();

    try {
      await client.query('BEGIN');

      // Obtener información del dominio antes de eliminar
      const domainResult = await client.query(
        'SELECT * FROM public.tracking_domains WHERE id = $1 AND subaccount_id = $2',
        [domainId, subaccountId]
      );

      if (domainResult.rows.length === 0) {
        throw new Error('Dominio no encontrado o no pertenece a esta subcuenta');
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
}

module.exports = new TrackingService();