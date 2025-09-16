const paymentsService = require('../services/payments.service');
const paymentsMetricsService = require('../services/payments.metrics.service');

async function getPayments(req, res) {
  try {
    const { start, end, page = 1, limit = 50, all = 'false' } = req.query;

    // Si all=true, no requiere fechas y trae todos los pagos con paginación
    if (all === 'true') {
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;

      const result = await paymentsService.getPaymentsPaginated(offset, limitNum);

      res.json({
        success: true,
        data: result.payments,
        total: result.total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(result.total / limitNum)
      });
    } else {
      // Modo con fechas (comportamiento original)
      if (!start || !end) {
        return res.status(400).json({
          error: 'Start and end dates are required when all=false'
        });
      }

      const startDate = new Date(start);
      const endDate = new Date(end);
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;

      const result = await paymentsService.getPaymentsWithPagination(startDate, endDate, offset, limitNum);

      res.json({
        success: true,
        data: result.payments,
        total: result.total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(result.total / limitNum)
      });
    }
  } catch (error) {
    console.error('Payments error:', error);
    res.status(500).json({
      error: 'Failed to fetch payments',
      message: error.message
    });
  }
}

async function getPaymentMetrics(req, res) {
  try {
    const { start, end } = req.query;

    if (!start || !end) {
      return res.status(400).json({
        error: 'Start and end dates are required'
      });
    }

    const startDate = new Date(start);
    const endDate = new Date(end);

    // Get both old metrics and new metrics with trends
    const [oldMetrics, metricsWithTrends] = await Promise.all([
      paymentsService.getPaymentMetrics(startDate, endDate),
      paymentsMetricsService.getPaymentsMetrics(startDate, endDate)
    ]);

    // Combine both responses
    const combinedMetrics = {
      ...oldMetrics,
      trends: metricsWithTrends.trends
    };

    res.json({
      success: true,
      data: combinedMetrics
    });
  } catch (error) {
    console.error('Payment metrics error:', error);
    res.status(500).json({
      error: 'Failed to fetch payment metrics',
      message: error.message
    });
  }
}

async function updatePayment(req, res) {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const updatedPayment = await paymentsService.updatePayment(id, updateData);

    if (!updatedPayment) {
      return res.status(404).json({
        error: 'Payment not found'
      });
    }

    res.json({
      success: true,
      data: updatedPayment,
      message: 'Pago actualizado exitosamente'
    });
  } catch (error) {
    console.error('Update payment error:', error);

    if (error.message === 'Payment not found') {
      return res.status(404).json({
        error: 'Payment not found',
        message: 'El pago especificado no existe'
      });
    }

    res.status(500).json({
      error: 'Failed to update payment',
      message: error.message
    });
  }
}

async function createPayment(req, res) {
  try {
    const paymentData = req.body;

    // Validar campos requeridos
    if (!paymentData.contactId || !paymentData.amount || !paymentData.date) {
      return res.status(400).json({
        error: 'Campos requeridos faltantes',
        message: 'Se requiere contactId, amount y date'
      });
    }

    const newPayment = await paymentsService.createPayment(paymentData);

    res.status(201).json({
      success: true,
      data: newPayment,
      message: 'Pago creado exitosamente'
    });
  } catch (error) {
    console.error('Create payment error:', error);
    res.status(500).json({
      error: 'Failed to create payment',
      message: error.message
    });
  }
}


async function deletePayment(req, res) {
  try {
    const { id } = req.params;
    
    const result = await paymentsService.deletePayment(id);
    
    if (!result) {
      return res.status(404).json({
        error: 'Payment not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Payment deleted successfully'
    });
  } catch (error) {
    console.error('Delete payment error:', error);
    res.status(500).json({
      error: 'Failed to delete payment',
      message: error.message
    });
  }
}

module.exports = {
  getPayments,
  getPaymentMetrics,
  createPayment,
  updatePayment,
  deletePayment
};