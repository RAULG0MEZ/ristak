const express = require('express');
const router = express.Router();
const { databasePool } = require('../config/database.config');

// Endpoint para obtener la configuración general de la cuenta (modo single tenant)
router.get('/account-config', async (req, res) => {
  try {
    // Configurar valores por defecto para modo single tenant
    let accountId = 'default-account';

    const webhookBaseUrl = process.env.WEBHOOK_BASE_URL || 'https://send.hollytrack.com';
    const trackingHost = process.env.TRACKING_HOST || 'ilove.hollytrack.com';
    const trackingProtocol = process.env.TRACKING_PROTOCOL || 'https';
    const trackingSnippetUrl = `${trackingProtocol}://${trackingHost}/snip.js`;

    res.json({
      success: true,
      data: {
        webhook_base_url: webhookBaseUrl,
        webhook_endpoints: {
          contacts: `${webhookBaseUrl}/webhook/contacts`,
          appointments: `${webhookBaseUrl}/webhook/appointments`,
          payments: `${webhookBaseUrl}/webhook/payments`,
          refunds: `${webhookBaseUrl}/webhook/refunds`
        },
        tracking: {
          host: trackingHost,
          snippet_url: trackingSnippetUrl,
          snippet_code: `<!-- HollyTrack Analytics -->\n<script defer src="${trackingSnippetUrl}"></script>\n<!-- End HollyTrack Analytics -->`
        },
        account: {
          id: accountId
        }
      }
    });
  } catch (error) {
    console.error('[Config] Error obteniendo configuración:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo configuración de cuenta'
    });
  }
});

module.exports = router;
