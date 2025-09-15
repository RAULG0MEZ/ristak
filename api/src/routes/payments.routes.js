const express = require('express');
const router = express.Router();
const { getPayments, getPaymentMetrics, createPayment, updatePayment, deletePayment } = require('../controllers/payments.controller');

// GET /api/payments
router.get('/', getPayments);

// GET /api/payments/metrics
router.get('/metrics', getPaymentMetrics);

// POST /api/payments
router.post('/', createPayment);

// PATCH /api/payments/:id
router.patch('/:id', updatePayment);

// DELETE /api/payments/:id
router.delete('/:id', deletePayment);

module.exports = router;