const { databasePool } = require('../config/database.config');

// Get default subaccount ID from environment variable
const DEFAULT_SUBACCOUNT_ID = process.env.DEFAULT_SUBACCOUNT_ID;

class SubaccountService {
  async getSubaccount(subaccountId = DEFAULT_SUBACCOUNT_ID) {
    try {
      const query = `
        SELECT 
          subaccount_id,
          subaccount_name,
          user_name,
          user_email,
          user_phone,
          user_city,
          user_business_name,
          timezone,
          currency,
          user_zip_code,
          user_tax,
          user_tax_percentage,
          subaccount_logo,
          subaccount_profile_picture,
          user_ui_preferences,
          created_at,
          updated_at
        FROM public.subaccount
        WHERE subaccount_id = $1
      `;
      
      const result = await databasePool.query(query, [subaccountId]);
      
      if (result.rows.length === 0) {
        // If no subaccount exists, return default values
        return {
          subaccount_id: subaccountId,
          subaccount_name: 'Default Account',
          user_name: '',
          user_email: '',
          user_phone: '',
          user_city: '',
          user_business_name: '',
          timezone: 'America/Mexico_City',
          currency: 'MXN',
          user_zip_code: '',
          user_tax: '',
          user_tax_percentage: 16.00,
          subaccount_logo: null,
          subaccount_profile_picture: null,
          user_ui_preferences: {}
        };
      }
      
      return result.rows[0];
    } catch (error) {
      console.error('Error fetching subaccount:', error);
      throw error;
    }
  }

  async updateSubaccount(subaccountId = DEFAULT_SUBACCOUNT_ID, updates) {
    try {
      // Build dynamic update query
      const fields = [];
      const values = [];
      let fieldIndex = 1;
      
      const allowedFields = [
        'subaccount_name',
        'user_name',
        'user_email',
        'user_phone',
        'user_city',
        'user_business_name',
        'timezone',
        'currency',
        'user_zip_code',
        'user_tax',
        'user_tax_percentage',
        'subaccount_logo',
        'subaccount_profile_picture',
        'user_ui_preferences'
      ];
      
      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          fields.push(`${field} = $${fieldIndex++}`);
          values.push(updates[field]);
        }
      }
      
      if (fields.length === 0) {
        return await this.getSubaccount(subaccountId);
      }
      
      values.push(subaccountId);
      
      const query = `
        UPDATE public.subaccount
        SET ${fields.join(', ')}
        WHERE subaccount_id = $${fieldIndex}
        RETURNING *
      `;
      
      const result = await databasePool.query(query, values);
      
      if (result.rows.length === 0) {
        // If no rows were updated, create new subaccount
        return await this.createSubaccount({ ...updates, subaccount_id: subaccountId });
      }
      
      return result.rows[0];
    } catch (error) {
      console.error('Error updating subaccount:', error);
      throw error;
    }
  }

  async createSubaccount(data) {
    try {
      const {
        subaccount_id = DEFAULT_SUBACCOUNT_ID,
        subaccount_name = 'Default Account',
        user_name = '',
        user_email = '',
        user_phone = '',
        user_city = '',
        user_business_name = '',
        timezone = 'America/Mexico_City',
        currency = 'MXN',
        user_zip_code = '',
        user_tax = '',
        user_tax_percentage = 16.00,
        subaccount_logo = null,
        subaccount_profile_picture = null,
        user_ui_preferences = {}
      } = data;
      
      const query = `
        INSERT INTO public.subaccount (
          subaccount_id,
          subaccount_name,
          user_name,
          user_email,
          user_phone,
          user_city,
          user_business_name,
          timezone,
          currency,
          user_zip_code,
          user_tax,
          user_tax_percentage,
          subaccount_logo,
          subaccount_profile_picture,
          user_ui_preferences
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (subaccount_id) 
        DO UPDATE SET
          subaccount_name = EXCLUDED.subaccount_name,
          user_name = EXCLUDED.user_name,
          user_email = EXCLUDED.user_email,
          user_phone = EXCLUDED.user_phone,
          user_city = EXCLUDED.user_city,
          user_business_name = EXCLUDED.user_business_name,
          timezone = EXCLUDED.timezone,
          currency = EXCLUDED.currency,
          user_zip_code = EXCLUDED.user_zip_code,
          user_tax = EXCLUDED.user_tax,
          user_tax_percentage = EXCLUDED.user_tax_percentage,
          subaccount_logo = EXCLUDED.subaccount_logo,
          subaccount_profile_picture = EXCLUDED.subaccount_profile_picture,
          user_ui_preferences = EXCLUDED.user_ui_preferences
        RETURNING *
      `;
      
      const result = await databasePool.query(query, [
        subaccount_id,
        subaccount_name,
        user_name,
        user_email,
        user_phone,
        user_city,
        user_business_name,
        timezone,
        currency,
        user_zip_code,
        user_tax,
        user_tax_percentage,
        subaccount_logo,
        subaccount_profile_picture,
        user_ui_preferences
      ]);
      
      return result.rows[0];
    } catch (error) {
      console.error('Error creating subaccount:', error);
      throw error;
    }
  }

  // Helper method to get timezone and currency
  async getLocaleSettings(subaccountId = DEFAULT_SUBACCOUNT_ID) {
    try {
      const query = `
        SELECT timezone, currency, user_tax_percentage
        FROM public.subaccount
        WHERE subaccount_id = $1
      `;
      
      const result = await databasePool.query(query, [subaccountId]);
      
      if (result.rows.length === 0) {
        return {
          timezone: 'America/Mexico_City',
          currency: 'MXN',
          user_tax_percentage: 16.00
        };
      }
      
      return result.rows[0];
    } catch (error) {
      console.error('Error fetching locale settings:', error);
      // Return defaults on error
      return {
        timezone: 'America/Mexico_City',
        currency: 'MXN',
        user_tax_percentage: 16.00
      };
    }
  }

  // Update UI preferences only
  async updateUIPreferences(subaccountId = DEFAULT_SUBACCOUNT_ID, tableName, preferences) {
    try {
      // First get current preferences
      const currentQuery = `
        SELECT user_ui_preferences
        FROM public.subaccount
        WHERE subaccount_id = $1
      `;
      
      const currentResult = await databasePool.query(currentQuery, [subaccountId]);
      
      let currentPreferences = {};
      if (currentResult.rows.length > 0 && currentResult.rows[0].user_ui_preferences) {
        currentPreferences = currentResult.rows[0].user_ui_preferences;
      }
      
      // Merge new preferences
      if (!currentPreferences.tables) {
        currentPreferences.tables = {};
      }
      
      currentPreferences.tables[tableName] = {
        ...currentPreferences.tables[tableName],
        ...preferences
      };
      
      // Update in database
      const updateQuery = `
        UPDATE public.subaccount
        SET user_ui_preferences = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE subaccount_id = $2
        RETURNING user_ui_preferences
      `;
      
      const result = await databasePool.query(updateQuery, [currentPreferences, subaccountId]);
      
      if (result.rows.length === 0) {
        // Create subaccount if it doesn't exist
        const createQuery = `
          INSERT INTO public.subaccount (subaccount_id, user_ui_preferences)
          VALUES ($1, $2)
          ON CONFLICT (subaccount_id)
          DO UPDATE SET user_ui_preferences = EXCLUDED.user_ui_preferences
          RETURNING user_ui_preferences
        `;
        
        const createResult = await databasePool.query(createQuery, [subaccountId, currentPreferences]);
        return createResult.rows[0].user_ui_preferences;
      }
      
      return result.rows[0].user_ui_preferences;
    } catch (error) {
      console.error('Error updating UI preferences:', error);
      throw error;
    }
  }

  // Get UI preferences for a specific table
  async getTablePreferences(subaccountId = DEFAULT_SUBACCOUNT_ID, tableName) {
    try {
      const query = `
        SELECT user_ui_preferences
        FROM public.subaccount
        WHERE subaccount_id = $1
      `;
      
      const result = await databasePool.query(query, [subaccountId]);
      
      if (result.rows.length === 0 || !result.rows[0].user_ui_preferences) {
        return null;
      }
      
      const preferences = result.rows[0].user_ui_preferences;
      if (preferences.tables && preferences.tables[tableName]) {
        return preferences.tables[tableName];
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching table preferences:', error);
      return null;
    }
  }
}

module.exports = new SubaccountService();