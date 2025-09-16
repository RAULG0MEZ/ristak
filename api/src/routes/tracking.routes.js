const express = require('express');
const router = express.Router();
const trackingService = require('../services/tracking.service');
const cloudflareService = require('../services/cloudflare.service');
const dns = require('dns').promises;
const { verifyCname } = require('../utils/dns-helper');

// Obtener configuración de tracking para la subcuenta
router.get('/config', async (req, res) => {
  try {
    const subaccountId = req.query.subaccountId || process.env.DEFAULT_SUBACCOUNT_ID;

    // En el futuro, esto debería venir de la base de datos por subcuenta
    // Por ahora, usar el valor del .env como default
    const trackingHost = process.env.TRACKING_HOST;

    res.json({
      success: true,
      subaccountId,
      trackingHost,
      // Aquí podrías agregar más configuraciones específicas de la subcuenta
    });
  } catch (error) {
    console.error('Error getting tracking config:', error);
    res.status(500).json({
      error: {
        code: 'CONFIG_ERROR',
        message: 'Failed to get tracking configuration'
      }
    });
  }
});

// Verificar CNAME de un dominio
router.post('/verify-cname', async (req, res) => {
  try {
    const { hostname } = req.body;

    if (!hostname) {
      return res.status(400).json({
        error: {
          code: 'MISSING_HOSTNAME',
          message: 'Hostname is required'
        }
      });
    }

    const trackingHost = process.env.TRACKING_HOST;

    // Usar el helper robusto para verificar CNAME
    const cnameValue = await verifyCname(hostname);

    if (cnameValue) {
      // Normalizar los valores para comparación (quitar punto final si existe)
      const normalizeHost = (host) => host.toLowerCase().replace(/\.$/, '');
      const isValid = normalizeHost(cnameValue) === normalizeHost(trackingHost);

      console.log(`🎯 Comparación final: "${normalizeHost(cnameValue)}" === "${normalizeHost(trackingHost)}" => ${isValid}`);

      res.json({
        success: true,
        isValid,
        hostname,
        cnameRecords: [cnameValue],
        expectedCname: trackingHost,
        message: isValid
          ? 'CNAME configurado correctamente'
          : `El dominio debe apuntar a ${trackingHost}, pero apunta a ${cnameValue}`
      });
    } else {
      // No se encontró CNAME
      res.json({
        success: true,
        isValid: false,
        hostname,
        expectedCname: trackingHost,
        error: 'No se encontró registro CNAME',
        message: `Configura un registro CNAME apuntando a ${trackingHost}`
      });
    }
  } catch (error) {
    console.error('Error verifying CNAME:', error);
    res.status(500).json({
      error: {
        code: 'VERIFY_CNAME_ERROR',
        message: error.message || 'Failed to verify CNAME'
      }
    });
  }
});

// Crear nuevo dominio de tracking
router.post('/domains', async (req, res) => {
  try {
    const { hostname, skipCnameCheck } = req.body;
    const subaccountId = req.body.subaccountId || process.env.DEFAULT_SUBACCOUNT_ID;

    if (!hostname) {
      return res.status(400).json({
        error: {
          code: 'MISSING_HOSTNAME',
          message: 'Hostname is required'
        }
      });
    }

    // Verificar CNAME antes de proceder (a menos que se salte explícitamente)
    if (!skipCnameCheck) {
      const trackingHost = process.env.TRACKING_HOST;

      try {
        const cnameRecords = await dns.resolveCname(hostname);

        // Normalizar los valores para comparación (quitar punto final si existe)
        const normalizeHost = (host) => host.toLowerCase().replace(/\.$/, '');

        const isValid = cnameRecords.some(cname => {
          const normalized = normalizeHost(cname);
          const expected = normalizeHost(trackingHost);
          return normalized === expected;
        });

        if (!isValid) {
          return res.status(400).json({
            error: {
              code: 'INVALID_CNAME',
              message: `El dominio debe tener un registro CNAME apuntando a ${trackingHost}`,
              details: {
                hostname,
                expectedCname: trackingHost,
                currentCname: cnameRecords
              }
            }
          });
        }
      } catch (dnsError) {
        return res.status(400).json({
          error: {
            code: 'CNAME_NOT_FOUND',
            message: `No se encontró registro CNAME. Configura un CNAME apuntando a ${trackingHost}`,
            details: {
              hostname,
              expectedCname: trackingHost,
              dnsError: dnsError.message
            }
          }
        });
      }
    }

    const result = await trackingService.createTrackingDomain(subaccountId, hostname);
    res.json(result);
  } catch (error) {
    console.error('Error creating tracking domain:', error);
    res.status(500).json({
      error: {
        code: 'CREATE_DOMAIN_ERROR',
        message: error.message || 'Failed to create tracking domain'
      }
    });
  }
});

// Obtener dominios de tracking
router.get('/domains', async (req, res) => {
  try {
    const subaccountId = req.query.subaccountId || process.env.DEFAULT_SUBACCOUNT_ID;
    const domains = await trackingService.getTrackingDomains(subaccountId);
    res.json({ success: true, domains });
  } catch (error) {
    console.error('Error getting tracking domains:', error);
    res.status(500).json({
      error: {
        code: 'GET_DOMAINS_ERROR',
        message: 'Failed to get tracking domains'
      }
    });
  }
});

// Eliminar dominio de tracking
router.delete('/domains/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const subaccountId = req.query.subaccountId || process.env.DEFAULT_SUBACCOUNT_ID;

    const result = await trackingService.deleteTrackingDomain(id, subaccountId);
    res.json(result);
  } catch (error) {
    console.error('Error deleting tracking domain:', error);
    res.status(500).json({
      error: {
        code: 'DELETE_DOMAIN_ERROR',
        message: error.message || 'Failed to delete tracking domain'
      }
    });
  }
});

// Obtener registros DNS (respuesta inmediata)
router.get('/domains/:id/dns-records', async (req, res) => {
  try {
    const { id } = req.params;

    // Obtener registros actuales (sin bloquear)
    const dnsData = await trackingService.getDomainDNSRecords(id);

    res.json(dnsData);
  } catch (error) {
    console.error('Error getting DNS records:', error);
    res.status(500).json({
      error: {
        code: 'GET_DNS_ERROR',
        message: error.message || 'Failed to get DNS records'
      }
    });
  }
});

// Endpoint para polling de registros SSL pendientes
router.get('/domains/:id/poll-ssl', async (req, res) => {
  try {
    const { id } = req.params;
    const { timeout = 30000 } = req.query; // Timeout máximo 30 segundos por defecto

    // Obtener dominio
    const domains = await trackingService.getTrackingDomains(req.query.subaccountId);
    const domain = domains.find(d => d.id === id);

    if (!domain) {
      return res.status(404).json({
        error: { code: 'DOMAIN_NOT_FOUND', message: 'Domain not found' }
      });
    }

    // Si ya tiene registros SSL, devolverlos inmediatamente
    if (domain.dcv_record_value && !domain.dcv_record_value.includes('pending')) {
      return res.json({
        success: true,
        ready: true,
        records: JSON.parse(domain.dns_instructions || '[]')
      });
    }

    // Hacer polling con timeout
    const startTime = Date.now();
    const maxTime = Math.min(parseInt(timeout), 60000); // Máximo 60 segundos

    const poll = async () => {
      try {
        const dnsData = await trackingService.getDomainDNSRecords(id);
        const sslRecord = dnsData.records.find(r => r.purpose === 'ssl_validation' && r.status === 'ready');

        if (sslRecord) {
          return res.json({
            success: true,
            ready: true,
            records: dnsData.records
          });
        }

        // Verificar timeout
        if (Date.now() - startTime > maxTime) {
          return res.json({
            success: true,
            ready: false,
            message: 'SSL records still pending, try again later',
            records: dnsData.records
          });
        }

        // Continuar polling después de 2 segundos
        setTimeout(poll, 2000);
      } catch (error) {
        console.error('Polling error:', error);
        res.status(500).json({
          error: {
            code: 'POLL_ERROR',
            message: error.message
          }
        });
      }
    };

    // Iniciar polling
    poll();
  } catch (error) {
    console.error('Error in poll-ssl:', error);
    res.status(500).json({
      error: {
        code: 'POLL_SSL_ERROR',
        message: error.message
      }
    });
  }
});

// Verificar estado del dominio
router.post('/domains/:id/verify', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await trackingService.verifyDomainStatus(id);
    res.json(result);
  } catch (error) {
    console.error('Error verifying domain:', error);
    res.status(500).json({
      error: {
        code: 'VERIFY_DOMAIN_ERROR',
        message: error.message || 'Failed to verify domain status'
      }
    });
  }
});

// Endpoint collector para recibir pageviews
router.post('/collect', async (req, res) => {
  try {
    // Obtener IP real del cliente
    const ip = req.headers['x-forwarded-for']?.split(',')[0] ||
               req.headers['x-real-ip'] ||
               req.connection.remoteAddress;

    const data = {
      url: req.body.url || req.headers.referer,
      referrer: req.body.referrer || req.headers.referer,
      userAgent: req.headers['user-agent'],
      ip: ip,
      accountId: req.body.accountId,
      subaccountId: req.body.subaccountId
    };

    const result = await trackingService.recordPageView(data);

    // Responder con pixel transparente
    res.status(200).json({ success: true, sessionId: result.sessionId });
  } catch (error) {
    console.error('Error collecting pageview:', error);
    // No revelar errores al cliente
    res.status(200).json({ success: true });
  }
});

// Servir el script snip.js
router.get('/snip.js', (req, res) => {
  const accountId = req.query.a || process.env.ACCOUNT_ID;
  const subaccountId = req.query.s || process.env.DEFAULT_SUBACCOUNT_ID;

  const script = `
(function() {
  // Configuración
  var config = {
    accountId: '${accountId}',
    subaccountId: '${subaccountId}',
    collectorUrl: '${req.protocol}://${req.get('host')}/api/tracking/collect'
  };

  // Función para enviar pageview
  function sendPageView() {
    try {
      var data = {
        url: window.location.href,
        referrer: document.referrer || '',
        accountId: config.accountId,
        subaccountId: config.subaccountId,
        timestamp: new Date().toISOString()
      };

      // Usar sendBeacon si está disponible
      if (navigator.sendBeacon) {
        navigator.sendBeacon(config.collectorUrl, JSON.stringify(data));
      } else {
        // Fallback a fetch
        fetch(config.collectorUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
          keepalive: true
        }).catch(function() {
          // Silenciar errores
        });
      }
    } catch (e) {
      // Silenciar errores
    }
  }

  // Enviar pageview inicial
  sendPageView();

  // Detectar cambios en SPA
  var lastUrl = window.location.href;

  // Interceptar pushState
  var originalPushState = history.pushState;
  if (originalPushState) {
    history.pushState = function() {
      originalPushState.apply(history, arguments);
      setTimeout(function() {
        if (window.location.href !== lastUrl) {
          lastUrl = window.location.href;
          sendPageView();
        }
      }, 0);
    };
  }

  // Interceptar replaceState
  var originalReplaceState = history.replaceState;
  if (originalReplaceState) {
    history.replaceState = function() {
      originalReplaceState.apply(history, arguments);
      setTimeout(function() {
        if (window.location.href !== lastUrl) {
          lastUrl = window.location.href;
          sendPageView();
        }
      }, 0);
    };
  }

  // Escuchar popstate (navegación con botones atrás/adelante)
  window.addEventListener('popstate', function() {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      sendPageView();
    }
  });

})();
  `.trim();

  res.set('Content-Type', 'application/javascript');
  res.set('Cache-Control', 'public, max-age=3600');
  res.send(script);
});

// Obtener snippet para el usuario
router.get('/snippet', async (req, res) => {
  try {
    const subaccountId = req.query.subaccountId || process.env.DEFAULT_SUBACCOUNT_ID;

    // Buscar dominio activo
    const activeDomain = await trackingService.getActiveDomain(subaccountId);

    // Usar dominio activo o fallback
    const trackingHost = activeDomain?.hostname || process.env.TRACKING_HOST;

    const snippet = `<script async src="https://${trackingHost}/snip.js?s=${subaccountId}"></script>`;

    res.json({
      success: true,
      snippet: snippet,
      host: trackingHost,
      isActive: !!activeDomain
    });
  } catch (error) {
    console.error('Error getting snippet:', error);
    res.status(500).json({
      error: {
        code: 'GET_SNIPPET_ERROR',
        message: 'Failed to generate snippet'
      }
    });
  }
});

// SSE endpoint mejorado para verificación y registros DNS en tiempo real
router.get('/domains/:id/status-stream', async (req, res) => {
  const { id } = req.params;

  // Configurar SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  // Enviar evento inicial con estado actual
  try {
    const dnsData = await trackingService.getDomainDNSRecords(id);
    res.write(`data: ${JSON.stringify({
      status: 'connected',
      records: dnsData.records,
      sslPending: dnsData.sslPending,
      hostname: dnsData.hostname
    })}\n\n`);
  } catch (error) {
    res.write(`data: {"status": "connected", "error": "${error.message}"}\n\n`);
  }

  let checkCount = 0;
  const maxChecks = 120; // Máximo 10 minutos (120 * 5 segundos)

  // Verificar estado cada 5 segundos
  const interval = setInterval(async () => {
    checkCount++;

    try {
      // Obtener registros DNS actualizados
      const dnsData = await trackingService.getDomainDNSRecords(id);

      // Verificar estado del dominio
      const result = await trackingService.verifyDomainStatus(id);

      // Determinar si tenemos todos los registros listos
      const sslRecord = dnsData.records.find(r => r.purpose === 'ssl_validation' && r.status === 'ready');
      const ownershipRecord = dnsData.records.find(r => r.purpose === 'ownership_verification' && r.status === 'ready');
      const allRecordsReady = sslRecord && ownershipRecord;

      // Enviar actualización
      res.write(`data: ${JSON.stringify({
        status: result.domain.status,
        sslStatus: result.domain.ssl_status,
        isActive: result.isActive,
        records: dnsData.records,
        allRecordsReady,
        checkCount,
        timestamp: new Date().toISOString()
      })}\n\n`);

      // Cerrar si está completamente verificado o alcanzamos el límite
      if ((result.isActive && allRecordsReady) || checkCount >= maxChecks) {
        const finalMessage = result.isActive ?
          'Domain verified successfully with all DNS records' :
          'Max check time reached, please continue manually';

        res.write(`data: ${JSON.stringify({
          status: 'completed',
          message: finalMessage,
          isActive: result.isActive,
          allRecordsReady
        })}\n\n`);

        clearInterval(interval);
        res.end();
      }
    } catch (error) {
      console.error('SSE error:', error);
      res.write(`data: {"error": "${error.message}"}\n\n`);

      // Si hay muchos errores consecutivos, cerrar la conexión
      if (checkCount > 5) {
        clearInterval(interval);
        res.end();
      }
    }
  }, 5000);

  // Limpiar al cerrar conexión
  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });
});

module.exports = router;