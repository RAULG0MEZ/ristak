const campaignsService = require('../services/campaigns.service')

async function getCampaigns(req, res) {
  try {
    const { start, end } = req.query
    if (!start || !end) {
      return res.status(400).json({ error: 'Start and end dates are required' })
    }
    const startDate = new Date(start)
    const endDate = new Date(end)
    const data = await campaignsService.getHierarchy(startDate, endDate)
    res.json({ success: true, data })
  } catch (error) {
    console.error('Campaigns error:', error)
    res.status(500).json({ error: 'Failed to fetch campaigns', message: error.message })
  }
}

async function getCampaignsChart(req, res) {
  try {
    const { start, end } = req.query
    if (!start || !end) {
      return res.status(400).json({ error: 'Start and end dates are required' })
    }
    const startDate = new Date(start)
    const endDate = new Date(end)
    const data = await campaignsService.getHistoricalData(startDate, endDate)
    res.json({ success: true, data })
  } catch (error) {
    console.error('Campaigns chart error:', error)
    res.status(500).json({ error: 'Failed to fetch campaigns chart data', message: error.message })
  }
}

module.exports = { getCampaigns, getCampaignsChart }
