const express = require('express')
const router = express.Router()
const { getCampaigns, getCampaignsChart, getCampaignsMetrics, getAdVisitors, getCampaignContactDetails, getCampaignVisitors } = require('../controllers/campaigns.controller')

// GET /api/campaigns
router.get('/', getCampaigns)

// GET /api/campaigns/chart
router.get('/chart', getCampaignsChart)

// GET /api/campaigns/metrics
router.get('/metrics', getCampaignsMetrics)

// GET /api/campaigns/contact-details - Nuevo endpoint para detalles de contactos
router.get('/contact-details', getCampaignContactDetails)

// GET /api/campaigns/visitors - Para jerarquía (campaign/adset/ad)
router.get('/visitors', getCampaignVisitors)

// GET /api/campaigns/visitors/:adId - Individual por ad_id
router.get('/visitors/:adId', getAdVisitors)

module.exports = router
