const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');

// Dashboard metrics routes
router.get('/metrics', dashboardController.getDashboardMetrics);
router.get('/historical', dashboardController.getHistoricalData);
router.get('/traffic-sources', dashboardController.getTrafficSources);

module.exports = router;