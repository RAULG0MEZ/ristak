const campaignsService = require('../services/campaigns.service')
const campaignsMetricsService = require('../services/campaigns.metrics.service')

async function getCampaigns(req, res) {
  try {
    const { start, end } = req.query
    const { accountId, subaccountId } = req
    if (!start || !end) {
      return res.status(400).json({ error: 'Start and end dates are required' })
    }
    const startDate = new Date(start)
    const endDate = new Date(end)
    const data = await campaignsService.getHierarchy(startDate, endDate, accountId, subaccountId)
    res.json({ success: true, data })
  } catch (error) {
    console.error('Campaigns error:', error)
    res.status(500).json({ error: 'Failed to fetch campaigns', message: error.message })
  }
}

async function getCampaignsChart(req, res) {
  try {
    const { start, end } = req.query
    const { accountId, subaccountId } = req
    if (!start || !end) {
      return res.status(400).json({ error: 'Start and end dates are required' })
    }
    const startDate = new Date(start)
    const endDate = new Date(end)
    const data = await campaignsService.getHistoricalData(startDate, endDate, accountId, subaccountId)
    res.json({ success: true, data })
  } catch (error) {
    console.error('Campaigns chart error:', error)
    res.status(500).json({ error: 'Failed to fetch campaigns chart data', message: error.message })
  }
}

async function getCampaignsMetrics(req, res) {
  try {
    const { start, end } = req.query
    const { accountId, subaccountId } = req
    if (!start || !end) {
      return res.status(400).json({ error: 'Start and end dates are required' })
    }
    const startDate = new Date(start)
    const endDate = new Date(end)
    const data = await campaignsMetricsService.getCampaignsMetrics(startDate, endDate, accountId, subaccountId)
    res.json(data)
  } catch (error) {
    console.error('Campaigns metrics error:', error)
    res.status(500).json({ error: 'Failed to fetch campaigns metrics', message: error.message })
  }
}

module.exports = { getCampaigns, getCampaignsChart, getCampaignsMetrics }
