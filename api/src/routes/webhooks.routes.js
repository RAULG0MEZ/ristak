const express = require('express');
const router = express.Router();
const webhookService = require('../services/webhook.service');

async function handleWebhook(processFn, entityLabel, req, res) {
  try {
    console.log(`[Webhook] Recibiendo ${entityLabel}`);
    console.log('[Webhook] Datos recibidos:', JSON.stringify(req.body, null, 2));

    const result = await processFn(req.body);

    res.status(200).json({
      success: true,
      message: `${entityLabel.charAt(0).toUpperCase() + entityLabel.slice(1)} procesado correctamente`,
      data: result
    });
  } catch (error) {
    console.error(`[Webhook] Error procesando ${entityLabel}:`, error);

    if (error.message.includes('requerido')) {
      return res.status(400).json({
        success: false,
        error: error.message,
        fields_missing: error.fields || []
      });
    }

    res.status(500).json({
      success: false,
      error: `Error procesando ${entityLabel}`
    });
  }
}

const contactHandler = (req, res) => handleWebhook(webhookService.processContact.bind(webhookService), 'contacto', req, res);
const paymentHandler = (req, res) => handleWebhook(webhookService.processPayment.bind(webhookService), 'pago', req, res);
const appointmentHandler = (req, res) => handleWebhook(webhookService.processAppointment.bind(webhookService), 'cita', req, res);
const refundHandler = (req, res) => handleWebhook(webhookService.processRefund.bind(webhookService), 'reembolso', req, res);

// Rutas nuevas sin parámetros obligatorios
router.post('/webhook/contacts', contactHandler);
router.post('/webhook/payments', paymentHandler);
router.post('/webhook/appointments', appointmentHandler);
router.post('/webhook/refunds', refundHandler);

// Rutas legacy con parámetros (se mantienen por compatibilidad)
router.post('/webhook/contacts/:account_id/:subaccount_id', contactHandler);
router.post('/webhook/payments/:account_id/:subaccount_id', paymentHandler);
router.post('/webhook/appointments/:account_id/:subaccount_id', appointmentHandler);
router.post('/webhook/refunds/:account_id/:subaccount_id', refundHandler);


module.exports = router;
