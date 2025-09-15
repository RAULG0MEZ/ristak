const express = require('express');
const router = express.Router();
const webhookService = require('../services/webhook.service');

// Middleware para parsear el body y extraer account/subaccount IDs
const extractIds = (req, res, next) => {
  const { account_id, subaccount_id } = req.params;
  req.accountId = account_id || process.env.ACCOUNT_ID;
  req.subaccountId = subaccount_id || process.env.DEFAULT_SUBACCOUNT_ID;
  next();
};

// Webhook para contactos
router.post('/webhook/contacts/:account_id/:subaccount_id', extractIds, async (req, res) => {
  try {
    console.log(`[Webhook] Recibiendo contacto para cuenta ${req.accountId}, subcuenta ${req.subaccountId}`);
    console.log('[Webhook] Datos recibidos:', JSON.stringify(req.body, null, 2));
    
    const result = await webhookService.processContact(req.body, req.accountId, req.subaccountId);
    
    res.status(200).json({
      success: true,
      message: 'Contacto procesado correctamente',
      data: result
    });
  } catch (error) {
    console.error('[Webhook] Error procesando contacto:', error);
    
    // Si es error de validación, devolver 400
    if (error.message.includes('requerido')) {
      return res.status(400).json({
        success: false,
        error: error.message,
        fields_missing: error.fields || []
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Error procesando contacto'
    });
  }
});

// Webhook para pagos
router.post('/webhook/payments/:account_id/:subaccount_id', extractIds, async (req, res) => {
  try {
    console.log(`[Webhook] Recibiendo pago para cuenta ${req.accountId}, subcuenta ${req.subaccountId}`);
    console.log('[Webhook] Datos recibidos:', JSON.stringify(req.body, null, 2));
    
    const result = await webhookService.processPayment(req.body, req.accountId, req.subaccountId);
    
    res.status(200).json({
      success: true,
      message: 'Pago procesado correctamente',
      data: result
    });
  } catch (error) {
    console.error('[Webhook] Error procesando pago:', error);
    
    if (error.message.includes('requerido')) {
      return res.status(400).json({
        success: false,
        error: error.message,
        fields_missing: error.fields || []
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Error procesando pago'
    });
  }
});

// Webhook para citas
router.post('/webhook/appointments/:account_id/:subaccount_id', extractIds, async (req, res) => {
  try {
    console.log(`[Webhook] Recibiendo cita para cuenta ${req.accountId}, subcuenta ${req.subaccountId}`);
    console.log('[Webhook] Datos recibidos:', JSON.stringify(req.body, null, 2));
    
    const result = await webhookService.processAppointment(req.body, req.accountId, req.subaccountId);
    
    res.status(200).json({
      success: true,
      message: 'Cita procesada correctamente',
      data: result
    });
  } catch (error) {
    console.error('[Webhook] Error procesando cita:', error);
    
    if (error.message.includes('requerido')) {
      return res.status(400).json({
        success: false,
        error: error.message,
        fields_missing: error.fields || []
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Error procesando cita'
    });
  }
});

// Webhook para reembolsos
router.post('/webhook/refunds/:account_id/:subaccount_id', extractIds, async (req, res) => {
  try {
    console.log(`[Webhook] Recibiendo reembolso para cuenta ${req.accountId}, subcuenta ${req.subaccountId}`);
    console.log('[Webhook] Datos recibidos:', JSON.stringify(req.body, null, 2));
    
    const result = await webhookService.processRefund(req.body, req.accountId, req.subaccountId);
    
    res.status(200).json({
      success: true,
      message: 'Reembolso procesado correctamente',
      data: result
    });
  } catch (error) {
    console.error('[Webhook] Error procesando reembolso:', error);
    
    if (error.message.includes('requerido')) {
      return res.status(400).json({
        success: false,
        error: error.message,
        fields_missing: error.fields || []
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Error procesando reembolso'
    });
  }
});

// Log de webhooks para debugging
router.get('/webhook/logs', async (req, res) => {
  try {
    const logs = await webhookService.getRecentLogs();
    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error obteniendo logs'
    });
  }
});

module.exports = router;