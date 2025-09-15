const express = require('express')
const router = express.Router()
const { 
  getReportMetrics, 
  getReportSales, 
  getReportSalesAttributed,
  getReportLeads,
  getReportLeadsAttributed,
  getReportAppointments,
  getReportAppointmentsAttributed,
  getReportNewCustomers,
  getReportNewCustomersAttributed
} = require('../controllers/reports.controller')

// GET /api/reports/metrics
router.get('/metrics', getReportMetrics)

// Detailed reports endpoints
router.get('/sales', getReportSales)
router.get('/sales/attributed', getReportSalesAttributed)
router.get('/leads', getReportLeads)
router.get('/leads/attributed', getReportLeadsAttributed)
router.get('/appointments', getReportAppointments)
router.get('/appointments/attributed', getReportAppointmentsAttributed)
router.get('/new-customers', getReportNewCustomers)
router.get('/new-customers/attributed', getReportNewCustomersAttributed)

module.exports = router

