const reportsService = require('../services/reports.service')
const { parseStartDate, parseEndDate } = require('../utils/date-utils')

async function getReportMetrics(req, res) {
  try {
    const { start, end, groupBy, type } = req.query
    if (!start || !end) {
      return res.status(400).json({ error: 'Start and end dates are required' })
    }

    // Usar timezone del usuario para interpretar las fechas correctamente
    const timezone = req.userTimezone || 'America/Mexico_City'
    const startDate = parseStartDate(start, timezone)
    const endDate = parseEndDate(end, timezone)

    // Si type === 'attributed', usar el método de métricas atribuidas
    const data = type === 'attributed'
      ? await reportsService.getAttributedMetrics(startDate, endDate, groupBy || 'month')
      : await reportsService.getMetrics(startDate, endDate, groupBy || 'month')
      
    res.json({ success: true, data })
  } catch (error) {
    console.error('Reports metrics error:', error)
    res.status(500).json({ error: 'Failed to fetch report metrics', message: error.message })
  }
}

// Obtener ventas detalladas (Todos)
async function getReportSales(req, res) {
  try {
    const { start, end } = req.query
    if (!start || !end) {
      return res.status(400).json({ error: 'Start and end dates are required' })
    }

    // Usar utilidades de fecha consistentes
    // Usar timezone del usuario para interpretar las fechas correctamente
    const timezone = req.userTimezone || 'America/Mexico_City'
    const startDate = parseStartDate(start, timezone)
    const endDate = parseEndDate(end, timezone)
    const data = await reportsService.getSalesDetails(startDate, endDate)
    res.json({ success: true, data })
  } catch (error) {
    console.error('Report sales error:', error)
    res.status(500).json({ error: 'Failed to fetch sales details', message: error.message })
  }
}

// Obtener ventas atribuidas
async function getReportSalesAttributed(req, res) {
  try {
    const { start, end } = req.query
    if (!start || !end) {
      return res.status(400).json({ error: 'Start and end dates are required' })
    }

    // Usar utilidades de fecha consistentes
    // Usar timezone del usuario para interpretar las fechas correctamente
    const timezone = req.userTimezone || 'America/Mexico_City'
    const startDate = parseStartDate(start, timezone)
    const endDate = parseEndDate(end, timezone)
    const data = await reportsService.getSalesDetailsAttributed(startDate, endDate)
    res.json({ success: true, data })
  } catch (error) {
    console.error('Report sales attributed error:', error)
    res.status(500).json({ error: 'Failed to fetch attributed sales', message: error.message })
  }
}

// Obtener leads detallados (Todos)
async function getReportLeads(req, res) {
  try {
    const { start, end } = req.query
    if (!start || !end) {
      return res.status(400).json({ error: 'Start and end dates are required' })
    }

    // Usar utilidades de fecha consistentes
    // Usar timezone del usuario para interpretar las fechas correctamente
    const timezone = req.userTimezone || 'America/Mexico_City'
    const startDate = parseStartDate(start, timezone)
    const endDate = parseEndDate(end, timezone)
    const data = await reportsService.getLeadsDetails(startDate, endDate)
    res.json({ success: true, data })
  } catch (error) {
    console.error('Report leads error:', error)
    res.status(500).json({ error: 'Failed to fetch leads details', message: error.message })
  }
}

// Obtener leads atribuidos
async function getReportLeadsAttributed(req, res) {
  try {
    const { start, end } = req.query
    if (!start || !end) {
      return res.status(400).json({ error: 'Start and end dates are required' })
    }

    // Usar utilidades de fecha consistentes
    // Usar timezone del usuario para interpretar las fechas correctamente
    const timezone = req.userTimezone || 'America/Mexico_City'
    const startDate = parseStartDate(start, timezone)
    const endDate = parseEndDate(end, timezone)
    const data = await reportsService.getLeadsDetailsAttributed(startDate, endDate)
    res.json({ success: true, data })
  } catch (error) {
    console.error('Report leads attributed error:', error)
    res.status(500).json({ error: 'Failed to fetch attributed leads', message: error.message })
  }
}

// Obtener citas detalladas (Todos)
async function getReportAppointments(req, res) {
  try {
    const { start, end } = req.query
    if (!start || !end) {
      return res.status(400).json({ error: 'Start and end dates are required' })
    }

    // Usar utilidades de fecha consistentes
    // Usar timezone del usuario para interpretar las fechas correctamente
    const timezone = req.userTimezone || 'America/Mexico_City'
    const startDate = parseStartDate(start, timezone)
    const endDate = parseEndDate(end, timezone)
    const data = await reportsService.getAppointmentsDetails(startDate, endDate)
    res.json({ success: true, data })
  } catch (error) {
    console.error('Report appointments error:', error)
    res.status(500).json({ error: 'Failed to fetch appointments details', message: error.message })
  }
}

// Obtener citas atribuidas
async function getReportAppointmentsAttributed(req, res) {
  try {
    const { start, end } = req.query
    if (!start || !end) {
      return res.status(400).json({ error: 'Start and end dates are required' })
    }

    // Usar utilidades de fecha consistentes
    // Usar timezone del usuario para interpretar las fechas correctamente
    const timezone = req.userTimezone || 'America/Mexico_City'
    const startDate = parseStartDate(start, timezone)
    const endDate = parseEndDate(end, timezone)
    const data = await reportsService.getAppointmentsDetailsAttributed(startDate, endDate)
    res.json({ success: true, data })
  } catch (error) {
    console.error('Report appointments attributed error:', error)
    res.status(500).json({ error: 'Failed to fetch attributed appointments', message: error.message })
  }
}

// Obtener clientes nuevos (con primer pago en el período)
async function getReportNewCustomers(req, res) {
  try {
    const { start, end } = req.query
    if (!start || !end) {
      return res.status(400).json({ error: 'Start and end dates are required' })
    }

    // Usar utilidades de fecha consistentes
    // Usar timezone del usuario para interpretar las fechas correctamente
    const timezone = req.userTimezone || 'America/Mexico_City'
    const startDate = parseStartDate(start, timezone)
    const endDate = parseEndDate(end, timezone)
    const data = await reportsService.getNewCustomersDetails(startDate, endDate)
    res.json({ success: true, data })
  } catch (error) {
    console.error('Report new customers error:', error)
    res.status(500).json({ error: 'Failed to fetch new customers details', message: error.message })
  }
}

// Obtener clientes nuevos atribuidos (contactos con rstk_adid creados en el período que tienen pagos)
async function getReportNewCustomersAttributed(req, res) {
  try {
    const { start, end } = req.query
    if (!start || !end) {
      return res.status(400).json({ error: 'Start and end dates are required' })
    }

    // Usar utilidades de fecha consistentes
    // Usar timezone del usuario para interpretar las fechas correctamente
    const timezone = req.userTimezone || 'America/Mexico_City'
    const startDate = parseStartDate(start, timezone)
    const endDate = parseEndDate(end, timezone)
    const data = await reportsService.getNewCustomersDetailsAttributed(startDate, endDate)
    res.json({ success: true, data })
  } catch (error) {
    console.error('Report new customers attributed error:', error)
    res.status(500).json({ error: 'Failed to fetch attributed new customers', message: error.message })
  }
}

module.exports = { 
  getReportMetrics,
  getReportSales,
  getReportSalesAttributed,
  getReportLeads,
  getReportLeadsAttributed,
  getReportAppointments,
  getReportAppointmentsAttributed,
  getReportNewCustomers,
  getReportNewCustomersAttributed
}

// Nueva función para obtener métricas con tendencias
async function getReportSummaryMetrics(req, res) {
  try {
    const { start, end } = req.query
    if (!start || !end) {
      return res.status(400).json({ error: 'Start and end dates are required' })
    }

    // Usar timezone del usuario para interpretar las fechas correctamente
    const timezone = req.userTimezone || 'America/Mexico_City'
    const startDate = parseStartDate(start, timezone)
    const endDate = parseEndDate(end, timezone)
    const data = await reportsService.getReportsMetrics(startDate, endDate)
    res.json(data)
  } catch (error) {
    console.error('Report summary metrics error:', error)
    res.status(500).json({ error: 'Failed to fetch report summary metrics', message: error.message })
  }
}

module.exports.getReportSummaryMetrics = getReportSummaryMetrics

