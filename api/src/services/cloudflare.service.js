const https = require('https');

class CloudflareService {
  constructor() {
    this.apiToken = process.env.CLOUDFLARE_API_TOKEN;
    this.zoneId = process.env.CLOUDFLARE_ZONE_ID;
    this.baseUrl = 'https://api.cloudflare.com/client/v4';

    if (!this.apiToken || !this.zoneId) {
      throw new Error('❌ CLOUDFLARE_API_TOKEN y CLOUDFLARE_ZONE_ID son requeridos. Configúralos en .env.local');
    }

    console.log('✅ Cloudflare Service configurado con API real');
  }

  // Helper para hacer requests HTTPS
  makeRequest(method, path, body = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(`${this.baseUrl}${path}`);
      const requestPath = `${url.pathname}${url.search || ''}`;

      const options = {
        hostname: url.hostname,
        path: requestPath,
        method: method,
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode && res.statusCode >= 400) {
              const error = new Error(parsed.errors?.[0]?.message || `Cloudflare API error (${res.statusCode})`);
              error.statusCode = res.statusCode;
              error.response = parsed;
              return reject(error);
            }
            resolve(parsed);
          } catch (e) {
            reject(new Error('Invalid JSON response from Cloudflare'));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      if (body) {
        req.write(JSON.stringify(body));
      }

      req.end();
    });
  }

  // Polling asíncrono mejorado para obtener registros SSL
  async pollForSSLRecords(hostnameId, maxAttempts = 60, intervalMs = 3000) {
    console.log(`Starting async poll for SSL records - hostname: ${hostnameId}`);

    return new Promise((resolve, reject) => {
      let attempts = 0;

      const checkRecords = async () => {
        attempts++;

        try {
          const status = await this.getHostnameStatus(hostnameId);

          // Buscar registros específicos
          const sslRecord = status.validationRecords.find(r => r.purpose === 'ssl_validation');
          const ownershipRecord = status.validationRecords.find(r => r.purpose === 'ownership_verification');

          // Verificar que el SSL tenga valor real (no pending)
          const sslReady = sslRecord?.status === 'ready' &&
                          sslRecord?.value &&
                          !sslRecord.value.includes('pending');

          const ownershipReady = ownershipRecord?.status === 'ready' &&
                                ownershipRecord?.value &&
                                ownershipRecord?.value !== 'false';

          console.log(`Poll attempt ${attempts}/${maxAttempts} - SSL ready: ${sslReady}, Ownership ready: ${ownershipReady}`);
          if (!sslReady && sslRecord) {
            console.log('SSL record details:', { name: sslRecord.name, value: sslRecord.value?.substring(0, 20), status: sslRecord.status });
          }
          if (!ownershipReady && ownershipRecord) {
            console.log('Ownership record details:', {
              name: ownershipRecord.name,
              value: ownershipRecord.value?.substring(0, 20),
              status: ownershipRecord.status,
              fullValue: ownershipRecord.value // Ver el valor completo
            });
          }

          if (sslReady && ownershipReady) {
            console.log('✅ Both DNS records ready!');
            resolve(status.validationRecords);
            return;
          }

          if (attempts >= maxAttempts) {
            console.log('⏱️ Max attempts reached, returning current state');
            resolve(status.validationRecords); // Devolver lo que tengamos
            return;
          }

          // Continuar polling
          setTimeout(checkRecords, intervalMs);
        } catch (error) {
          console.error(`Poll error on attempt ${attempts}:`, error.message);

          if (attempts >= maxAttempts) {
            reject(error);
          } else {
            setTimeout(checkRecords, intervalMs);
          }
        }
      };

      // Iniciar primera verificación
      checkRecords();
    });
  }

  // Obtener registros DNS de forma rápida (sin esperar SSL si no está listo)
  async getDNSRecords(hostnameId) {
    try {
      const status = await this.getHostnameStatus(hostnameId);

      // Siempre devolver los registros disponibles de inmediato
      const records = [];

      // Ownership record siempre está disponible
      const ownershipRecord = status.validationRecords.find(r => r.purpose === 'ownership_verification');
      if (ownershipRecord) {
        records.push(ownershipRecord);
      }

      // SSL record puede no estar listo
      const sslRecord = status.validationRecords.find(r => r.purpose === 'ssl_validation');
      if (sslRecord && sslRecord.status === 'ready') {
        records.push(sslRecord);
      } else {
        // Indicar que el SSL está pendiente pero no bloquear
        records.push({
          type: 'TXT',
          name: `_acme-challenge.${status.hostname}`,
          value: 'pending', // Valor especial que el frontend puede detectar
          purpose: 'ssl_validation',
          status: 'pending',
          message: 'El registro SSL se está generando, por favor espera unos segundos...'
        });
      }

      return {
        records,
        hostname: status.hostname,
        sslPending: !sslRecord || sslRecord.status !== 'ready'
      };
    } catch (error) {
      console.error('Error getting DNS records:', error);
      throw error;
    }
  }

  // Mantener compatibilidad hacia atrás
  async waitForSSLRecords(hostnameId, maxAttempts = 30) {
    // Usar el nuevo método de polling
    return this.pollForSSLRecords(hostnameId, maxAttempts, 2000);
  }

  // Crear custom hostname en Cloudflare con validación TXT
  async createCustomHostname(hostname) {
    try {
      const data = await this.makeRequest('POST', `/zones/${this.zoneId}/custom_hostnames`, {
        hostname: hostname,
        ssl: {
          method: 'txt',
          type: 'dv',
          settings: {
            http2: 'on',
            min_tls_version: '1.2',
            tls_1_3: 'on'
          }
        }
        // NOTA: custom_origin_server y custom_origin_sni requieren plan Enterprise
        // Para planes normales, Cloudflare usa el dominio de la zona por defecto
      });

      if (!data.success) {
        console.error('Cloudflare API error:', data.errors);
        throw new Error(data.errors?.[0]?.message || 'Failed to create custom hostname');
      }

      console.log('Full Cloudflare API Response:', JSON.stringify(data.result, null, 2));

      // Extraer los registros de validación
      const validationRecords = [];

      // 1. Registro de ownership verification (_cf-custom-hostname) - SIEMPRE disponible
      if (data.result.ownership_verification &&
          data.result.ownership_verification.type === 'txt' &&
          data.result.ownership_verification.name &&
          data.result.ownership_verification.value) {
        validationRecords.push({
          type: 'TXT',
          name: data.result.ownership_verification.name,
          value: data.result.ownership_verification.value,
          purpose: 'ownership_verification',
          status: 'ready'
        });
        console.log('Ownership Verification Record:', data.result.ownership_verification.name, data.result.ownership_verification.value);
      }

      // 2. Registro de validación SSL (_acme-challenge) - Puede NO estar disponible si SSL está "initializing"
      if (data.result.ssl) {
        if (data.result.ssl.txt_name && data.result.ssl.txt_value) {
          // SSL records están disponibles
          validationRecords.push({
            type: 'TXT',
            name: data.result.ssl.txt_name,
            value: data.result.ssl.txt_value,
            purpose: 'ssl_validation',
            status: 'ready'
          });
          console.log('SSL Validation Record:', data.result.ssl.txt_name, data.result.ssl.txt_value);
        } else if (data.result.ssl.status === 'initializing' || data.result.ssl.status === 'pending_validation') {
          // SSL está inicializando, NO agregar valor falso
          console.log('SSL Status: initializing - Will be available via polling');
          // No agregar registro placeholder con valor falso
        }
      }

      console.log('Total validation records extracted:', validationRecords.length);
      console.log('Validation records:', JSON.stringify(validationRecords, null, 2));

      return {
        success: true,
        hostnameId: data.result.id,
        hostname: data.result.hostname,
        status: data.result.status,
        sslStatus: data.result.ssl?.status,
        validationRecords: validationRecords,
        validationMethod: data.result.ssl?.method,
        verificationErrors: data.result.verification_errors || [],
        needsPolling: data.result.ssl?.status === 'initializing'
      };
    } catch (error) {
      console.error('Error creating custom hostname:', error);
      throw error;
    }
  }

  // Verificar estado del hostname
  async getHostnameStatus(hostnameId) {
    try {
      const data = await this.makeRequest('GET', `/zones/${this.zoneId}/custom_hostnames/${hostnameId}`);

      if (!data.success) {
        throw new Error('Failed to get hostname status');
      }

      const result = data.result;

      // Extraer los registros TXT actuales
      const validationRecords = [];

      // 1. Registro de ownership verification (_cf-custom-hostname) - SIEMPRE disponible
      if (result.ownership_verification &&
          result.ownership_verification.type === 'txt' &&
          result.ownership_verification.name &&
          result.ownership_verification.value) {
        validationRecords.push({
          type: 'TXT',
          name: result.ownership_verification.name,
          value: result.ownership_verification.value,
          purpose: 'ownership_verification',
          status: 'ready'
        });
      }

      // 2. Registro de validación SSL (_acme-challenge)
      if (result.ssl) {
        if (result.ssl.txt_name && result.ssl.txt_value) {
          validationRecords.push({
            type: 'TXT',
            name: result.ssl.txt_name,
            value: result.ssl.txt_value,
            purpose: 'ssl_validation',
            status: 'ready'
          });
        } else if (result.ssl.status === 'initializing' || result.ssl.status === 'pending_validation') {
          // SSL todavía está inicializando - no agregar placeholder
          console.log('SSL still initializing, skipping placeholder');
        }
      }

      console.log('Status check - validation records found:', validationRecords.length);

      return {
        success: true,
        hostname: result.hostname,
        status: result.status,
        sslStatus: result.ssl?.status,
        validationMethod: result.ssl?.method,
        validationRecords: validationRecords,
        isActive: result.status === 'active' && result.ssl?.status === 'active',
        verificationErrors: result.verification_errors || [],
        needsPolling: result.ssl?.status === 'initializing'
      };
    } catch (error) {
      console.error('Error getting hostname status:', error);
      throw error;
    }
  }

  // Eliminar custom hostname
  async deleteCustomHostname(hostnameId) {
    try {
      const data = await this.makeRequest('DELETE', `/zones/${this.zoneId}/custom_hostnames/${hostnameId}`);
      return data.success;
    } catch (error) {
      console.error('Error deleting custom hostname:', error);
      throw error;
    }
  }

  // Listar todos los custom hostnames de la zona
  async listCustomHostnames(page = 1, perPage = 100) {
    try {
      const url = `/zones/${this.zoneId}/custom_hostnames?page=${page}&per_page=${perPage}`;
      const data = await this.makeRequest('GET', url);

      if (!data.success) {
        throw new Error('Failed to list custom hostnames');
      }

      // Mapear los resultados a un formato simple
      const hostnames = data.result.map(hostname => ({
        id: hostname.id,
        hostname: hostname.hostname,
        status: hostname.status,
        sslStatus: hostname.ssl?.status,
        createdAt: hostname.created_at,
        verificationErrors: hostname.verification_errors || [],
        isActive: hostname.status === 'active' && hostname.ssl?.status === 'active'
      }));

      return {
        hostnames,
        totalCount: data.result_info?.total_count || hostnames.length,
        page: data.result_info?.page || 1,
        perPage: data.result_info?.per_page || perPage,
        totalPages: data.result_info?.total_pages || 1
      };
    } catch (error) {
      console.error('Error listing custom hostnames:', error);
      throw error;
    }
  }

  // Obtener TODOS los custom hostnames (maneja paginación automáticamente)
  async getAllCustomHostnames() {
    try {
      const allHostnames = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const result = await this.listCustomHostnames(page, 100);
        allHostnames.push(...result.hostnames);

        hasMore = page < result.totalPages;
        page++;
      }

      console.log(`✅ Found ${allHostnames.length} custom hostnames in Cloudflare`);
      return allHostnames;
    } catch (error) {
      console.error('Error getting all custom hostnames:', error);
      throw error;
    }
  }
}

module.exports = new CloudflareService();
