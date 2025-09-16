const express = require('express');
const router = express.Router();

// =============================================================================
// TRACKING SIMPLE Y MULTITENANT
// =============================================================================
// - Un cliente pega: <script src="https://su-dominio.com/snip.js?s=SUBACCOUNT_ID"></script>
// - El script envía pageviews a /collect
// - Todo se guarda en tracking.sessions
// =============================================================================

// Middleware CORS - ABIERTO A TODOS LOS DOMINIOS
const corsOpen = (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
};

// Aplicar CORS a todas las rutas de tracking
router.use(corsOpen);

// =============================================================================
// GET /snip.js - Servir el script de tracking
// =============================================================================
router.get('/snip.js', (req, res) => {
  const subaccountId = req.query.s || 'default';

  // Detectar el protocolo y host correctos
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-original-host'] || req.get('host');

  const script = `
(function() {
  // Tracking Script v1.0
  var sid = '${subaccountId}';
  var host = '${protocol}://${host}';

  // Generar ID único de sesión
  var sessionId = 'sess_' + Math.random().toString(36).substr(2, 9);

  // Función para enviar pageview
  function track() {
    var data = {
      sid: sid,
      url: window.location.href,
      ref: document.referrer || '',
      ts: new Date().toISOString(),
      sess: sessionId
    };

    // Usar sendBeacon si está disponible
    if (navigator.sendBeacon) {
      navigator.sendBeacon(host + '/collect', JSON.stringify(data));
    } else {
      // Fallback a fetch
      fetch(host + '/collect', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data),
        keepalive: true
      }).catch(function() {});
    }
  }

  // Tracking inicial
  track();

  // Tracking en cambios de URL (para SPAs)
  var oldPushState = history.pushState;
  history.pushState = function() {
    oldPushState.apply(history, arguments);
    setTimeout(track, 100);
  };

  var oldReplaceState = history.replaceState;
  history.replaceState = function() {
    oldReplaceState.apply(history, arguments);
    setTimeout(track, 100);
  };

  window.addEventListener('popstate', track);
})();
`;

  res.set('Content-Type', 'application/javascript');
  res.set('Cache-Control', 'no-cache, must-revalidate');
  res.send(script);
});

// =============================================================================
// POST /collect - Recibir datos de tracking
// =============================================================================
router.post('/collect', async (req, res) => {
  try {
    // Obtener datos del request
    const { sid: subaccountId, url, ref: referrer, ts: timestamp, sess: sessionId } = req.body || {};

    // Obtener IP real
    const ip = req.headers['x-forwarded-for']?.split(',')[0] ||
               req.headers['x-real-ip'] ||
               req.connection.remoteAddress;

    // Obtener user agent
    const userAgent = req.headers['user-agent'] || '';

    // Validación básica
    if (!subaccountId) {
      return res.status(400).json({ error: 'Missing subaccount ID' });
    }

    // Parsear URL
    let urlData = {};
    try {
      const parsedUrl = new URL(url);
      urlData = {
        host: parsedUrl.hostname,
        path: parsedUrl.pathname,
        query: parsedUrl.search,
        hash: parsedUrl.hash
      };
    } catch (e) {
      urlData = { host: 'unknown', path: '/' };
    }

    // Guardar en base de datos
    const { databasePool } = require('../config/database.config');

    const query = `
      INSERT INTO tracking.sessions (
        session_id,
        subaccount_id,
        account_id,
        visitor_id,
        landing_url,
        landing_host,
        landing_path,
        landing_query,
        referrer_url,
        ip,
        user_agent,
        created_at,
        pageviews_count
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), 1
      )
      ON CONFLICT (session_id) DO UPDATE SET
        pageviews_count = tracking.sessions.pageviews_count + 1,
        last_event_at = NOW()
    `;

    await databasePool.query(query, [
      sessionId || `sess_${Math.random().toString(36).substr(2, 9)}`,
      subaccountId,
      'default', // account_id - se puede obtener de subaccounts table
      `vis_${Math.random().toString(36).substr(2, 9)}`, // visitor_id único
      url,
      urlData.host,
      urlData.path,
      urlData.query,
      referrer,
      ip,
      userAgent
    ]);

    // Responder éxito
    res.json({ success: true });

  } catch (error) {
    console.error('Error in /collect:', error);
    res.status(500).json({ error: 'Failed to track' });
  }
});

module.exports = router;