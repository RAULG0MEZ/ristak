const express = require('express');
const router = express.Router();
const { databasePool } = require('../config/database.config');

function buildSettingsResponse(row) {
  const settings = row.settings || {};
  const uiPreferences = settings.user_ui_preferences || {};

  return {
    account_name: settings.account_name || '',
    user_name: settings.user_name || row.name || '',
    user_email: settings.user_email || row.email || '',
    user_phone: settings.user_phone || '',
    user_city: settings.user_city || '',
    user_business_name: settings.user_business_name || '',
    timezone: row.timezone || 'America/Mexico_City',
    currency: row.currency || 'MXN',
    user_zip_code: settings.user_zip_code || '',
    user_tax: settings.user_tax || 'IVA',
    user_tax_percentage: Number(settings.user_tax_percentage ?? 16),
    account_logo: settings.account_logo || '',
    account_profile_picture: settings.account_profile_picture || '',
    user_ui_preferences: uiPreferences
  };
}

// GET /api/settings/domains-config
// Endpoint para obtener configuración de dominios y webhooks desde variables de entorno
router.get('/domains-config', async (req, res) => {
  try {
    // Obtener dominios desde variables de entorno o usar defaults
    const domainApp = process.env.DOMAIN_APP || 'app.hollytrack.com';
    const domainSend = process.env.DOMAIN_SEND || 'send.hollytrack.com';
    const domainTrack = process.env.DOMAIN_TRACK || 'ilove.hollytrack.com';
    const webhookBase = process.env.WEBHOOK_BASE_URL || `https://${domainSend}`;

    const config = {
      domains: {
        app: domainApp,
        send: domainSend,
        track: domainTrack
      },
      webhook_base_url: webhookBase,
      webhook_endpoints: {
        contacts: `${webhookBase}/webhook/contacts`,
        appointments: `${webhookBase}/webhook/appointments`,
        payments: `${webhookBase}/webhook/payments`,
        refunds: `${webhookBase}/webhook/refunds`
      },
      tracking: {
        host: domainTrack,
        snippet_url: `https://${domainTrack}/snip.js`,
        snippet_code: `<script defer src="https://${domainTrack}/snip.js"></script>`
      }
    };

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('[Settings] Error getting domains config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load domains configuration'
    });
  }
});

// GET /api/settings
router.get('/', async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }


    const result = await databasePool.query(
      'SELECT name, email, timezone, currency, settings FROM users WHERE id = $1 LIMIT 1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const data = buildSettingsResponse(result.rows[0]);
    res.json({ success: true, data });
  } catch (error) {
    console.error('[Settings] Failed to load settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load settings'
    });
  }
});

// PUT /api/settings
router.put('/', async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    const payload = req.body || {};
    const {
      timezone,
      currency,
      user_name,
      user_email,
      account_name,
      user_phone,
      user_city,
      user_business_name,
      user_zip_code,
      user_tax,
      user_tax_percentage,
      account_logo,
      account_profile_picture,
      user_ui_preferences
    } = payload;

    const result = await databasePool.query(
      'SELECT name, email, timezone, currency, settings FROM users WHERE id = $1 LIMIT 1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const current = result.rows[0];
    const mergedSettings = {
      ...(current.settings || {}),
      ...(account_name !== undefined ? { account_name } : {}),
      ...(user_name !== undefined ? { user_name } : {}),
      ...(user_email !== undefined ? { user_email } : {}),
      ...(user_phone !== undefined ? { user_phone } : {}),
      ...(user_city !== undefined ? { user_city } : {}),
      ...(user_business_name !== undefined ? { user_business_name } : {}),
      ...(user_zip_code !== undefined ? { user_zip_code } : {}),
      ...(user_tax !== undefined ? { user_tax } : {}),
      ...(user_tax_percentage !== undefined ? { user_tax_percentage: Number(user_tax_percentage) || 0 } : {}),
      ...(account_logo !== undefined ? { account_logo } : {}),
      ...(account_profile_picture !== undefined ? { account_profile_picture } : {}),
      ...(user_ui_preferences !== undefined ? { user_ui_preferences } : {})
    };

    const fields = [];
    const values = [];
    let index = 1;

    if (timezone) {
      fields.push(`timezone = $${index++}`);
      values.push(timezone);
    }

    if (currency) {
      fields.push(`currency = $${index++}`);
      values.push(currency);
    }

    if (user_name) {
      fields.push(`name = $${index++}`);
      values.push(user_name);
    }

    if (user_email) {
      fields.push(`email = $${index++}`);
      values.push(user_email);
    }

    fields.push(`settings = $${index++}::jsonb`);
    values.push(JSON.stringify(mergedSettings));

    fields.push(`updated_at = NOW()`);

    values.push(userId);

    const updateQuery = `UPDATE users SET ${fields.join(', ')} WHERE id = $${index} RETURNING name, email, timezone, currency, settings`;
    const updateResult = await databasePool.query(updateQuery, values);

    const updatedData = buildSettingsResponse(updateResult.rows[0]);
    res.json({ success: true, data: updatedData });
  } catch (error) {
    console.error('[Settings] Failed to save settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save settings'
    });
  }
});

// GET /api/settings/preferences
router.get('/preferences', async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }


    const result = await databasePool.query(
      'SELECT table_preferences FROM users WHERE id = $1 LIMIT 1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0].table_preferences || {}
    });
  } catch (error) {
    console.error('[Settings] Failed to load table preferences:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load preferences'
    });
  }
});

// PUT /api/settings/preferences/:table
router.put('/preferences/:tableName', async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    const { tableName } = req.params;
    const preferences = req.body || {};


    // Obtener las preferencias actuales de la nueva columna table_preferences
    const result = await databasePool.query(
      'SELECT table_preferences FROM users WHERE id = $1 LIMIT 1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Obtener preferencias actuales o inicializar objeto vacío
    const currentPreferences = result.rows[0].table_preferences || {};

    // Actualizar solo la tabla específica
    currentPreferences[tableName] = preferences;

    // Guardar en la nueva columna table_preferences
    const updateResult = await databasePool.query(
      'UPDATE users SET table_preferences = $1::jsonb, updated_at = NOW() WHERE id = $2 RETURNING table_preferences',
      [JSON.stringify(currentPreferences), userId]
    );

    res.json({
      success: true,
      data: updateResult.rows[0].table_preferences || {}
    });
  } catch (error) {
    console.error('[Settings] Failed to update table preferences:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update preferences'
    });
  }
});

module.exports = router;
