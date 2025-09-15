const express = require('express')
const router = express.Router()
const { getCampaigns, getCampaignsChart } = require('../controllers/campaigns.controller')

// GET /api/campaigns
router.get('/', getCampaigns)

// GET /api/campaigns/chart
router.get('/chart', getCampaignsChart)

module.exports = router

