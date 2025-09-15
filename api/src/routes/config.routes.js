const express = require('express');
const router = express.Router();
const { databasePool } = require('../config/database.config');

// Endpoint para obtener la configuración de cuenta/subcuenta
router.get('/account-config', async (req, res) => {
  try {
    // Primero intentar obtener desde la base de datos
    const subaccountId = process.env.DEFAULT_SUBACCOUNT_ID || 'suba_default';
    
    const query = `
      SELECT account_id, subaccount_id 
      FROM public.subaccount 
      WHERE subaccount_id = $1
      LIMIT 1
    `;
    
    const result = await databasePool.query(query, [subaccountId]);
    
    let accountId;
    let finalSubaccountId = subaccountId;
    
    if (result.rows.length > 0) {
      // Si encontramos en la DB, usar esos valores
      accountId = result.rows[0].account_id;
      finalSubaccountId = result.rows[0].subaccount_id;
    } else {
      // Si no hay en DB, usar variables de entorno
      accountId = process.env.ACCOUNT_ID || 'acc_default';
    }
    
    res.json({
      success: true,
      data: {
        account_id: accountId,
        subaccount_id: finalSubaccountId,
        webhook_base_url: 'https://send.hollytrack.com'
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