const express = require('express')
const router = express.Router()
const { getCampaigns, getCampaignsChart, getCampaignsMetrics } = require('../controllers/campaigns.controller')

// GET /api/campaigns
router.get('/', getCampaigns)

// GET /api/campaigns/chart
router.get('/chart', getCampaignsChart)

// GET /api/campaigns/metrics
router.get('/metrics', getCampaignsMetrics)

module.exports = router

