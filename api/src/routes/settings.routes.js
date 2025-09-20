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

    // En desarrollo, devolver settings por defecto
    if (process.env.NODE_ENV !== 'production' && userId === 'dev-user') {
      const devSettings = buildSettingsResponse({
        name: 'Desarrollo',
        email: 'dev@ristak.local',
        timezone: 'America/Mexico_City',
        currency: 'MXN',
        settings: {
          account_name: 'Desarrollo Local',
          user_name: 'Usuario Dev',
          user_email: 'dev@ristak.local',
          user_business_name: 'Ristak Dev',
          user_ui_preferences: {}
        }
      });

      return res.json({
        success: true,
        data: devSettings
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

    const result = await databasePool.query(
      'SELECT settings FROM users WHERE id = $1 LIMIT 1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const currentSettings = result.rows[0].settings || {};
    const currentTables = {
      ...(currentSettings.user_ui_preferences?.tables || {})
    };
    currentTables[tableName] = preferences;

    const newSettings = {
      ...currentSettings,
      user_ui_preferences: {
        ...(currentSettings.user_ui_preferences || {}),
        tables: currentTables
      }
    };

    const updateResult = await databasePool.query(
      'UPDATE users SET settings = $1::jsonb, updated_at = NOW() WHERE id = $2 RETURNING settings',
      [JSON.stringify(newSettings), userId]
    );

    res.json({
      success: true,
      data: updateResult.rows[0].settings.user_ui_preferences || {}
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
