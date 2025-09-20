const campaignsService = require('../services/campaigns.service')
const { parseStartDate, parseEndDate } = require('../utils/date-utils')

async function getCampaigns(req, res) {
  try {
    const { start, end } = req.query
    if (!start || !end) {
      return res.status(400).json({ error: 'Start and end dates are required' })
    }
    // Usar timezone del usuario para interpretar las fechas correctamente
    const timezone = req.userTimezone || 'America/Mexico_City'
    const startDate = parseStartDate(start, timezone)
    const endDate = parseEndDate(end, timezone)
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
    // Usar timezone del usuario para interpretar las fechas correctamente
    const timezone = req.userTimezone || 'America/Mexico_City'
    const startDate = parseStartDate(start, timezone)
    const endDate = parseEndDate(end, timezone)
    const data = await campaignsService.getHistoricalData(startDate, endDate)
    res.json({ success: true, data })
  } catch (error) {
    console.error('Campaigns chart error:', error)
    res.status(500).json({ error: 'Failed to fetch campaigns chart data', message: error.message })
  }
}

async function getCampaignsMetrics(req, res) {
  try {
    const { start, end } = req.query
    if (!start || !end) {
      return res.status(400).json({ error: 'Start and end dates are required' })
    }
    // Usar timezone del usuario para interpretar las fechas correctamente
    const timezone = req.userTimezone || 'America/Mexico_City'
    const startDate = parseStartDate(start, timezone)
    const endDate = parseEndDate(end, timezone)
    const data = await campaignsService.getCampaignsMetrics(startDate, endDate)
    res.json(data)
  } catch (error) {
    console.error('Campaigns metrics error:', error)
    res.status(500).json({ error: 'Failed to fetch campaigns metrics', message: error.message })
  }
}

async function getAdVisitors(req, res) {
  try {
    const { adId } = req.params
    const { start, end } = req.query
    if (!start || !end) {
      return res.status(400).json({ error: 'Start and end dates are required' })
    }

    const startDate = parseStartDate(start)
    const endDate = parseEndDate(end)
    const visitors = await campaignsService.getVisitorsByAdId(adId, startDate, endDate)

    res.json({ success: true, data: visitors })
  } catch (error) {
    console.error('Ad visitors error:', error)
    res.status(500).json({ error: 'Failed to fetch ad visitors', message: error.message })
  }
}

// Nuevo endpoint desde cero para obtener contactos únicos de campañas
async function getCampaignContactDetails(req, res) {
  try {
    const { start, end, type, adIds } = req.query

    // Validaciones básicas
    if (!start || !end) {
      return res.status(400).json({
        error: 'Start and end dates are required',
        code: 'MISSING_DATES'
      })
    }

    // Validar tipo de métrica
    const validTypes = ['leads', 'appointments', 'sales']
    if (!type || !validTypes.includes(type)) {
      return res.status(400).json({
        error: `Type must be one of: ${validTypes.join(', ')}`,
        code: 'INVALID_TYPE'
      })
    }

    // Manejar array de ad IDs
    if (!adIds || adIds.length === 0) {
      return res.json({
        success: true,
        data: [],
        total: 0,
        type
      })
    }

    // Normalizar ad IDs (puede venir como string o array)
    const adIdArray = Array.isArray(adIds) ? adIds : [adIds]
    const normalizedAdIds = adIdArray
      .map(id => String(id).trim())
      .filter(Boolean)

    if (normalizedAdIds.length === 0) {
      return res.json({
        success: true,
        data: [],
        total: 0,
        type
      })
    }

    // Usar las utilidades de fecha para mantener consistencia
    const startDate = parseStartDate(start)
    const endDate = parseEndDate(end)

    // Extraer parámetros de jerarquía si existen
    const adSetId = req.query.adSetId ? String(req.query.adSetId).trim() : null
    const campaignId = req.query.campaignId ? String(req.query.campaignId).trim() : null

    // Llamar al servicio para obtener los contactos con atribución válida de Meta
    // Usando getContactsByHierarchy que valida attribution_ad_id y fechas de campaña
    const contacts = await campaignsService.getContactsByHierarchy({
      adIds: normalizedAdIds,
      adSetIds: adSetId ? [adSetId] : [],
      campaignIds: campaignId ? [campaignId] : [],
      startDate,
      endDate,
      type
    })

    // Responder con los datos formateados
    res.json({
      success: true,
      data: contacts,
      total: contacts.length,
      type,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      }
    })

  } catch (error) {
    console.error('Error fetching campaign contact details:', error)
    res.status(500).json({
      error: 'Failed to fetch contact details',
      message: error.message,
      code: 'INTERNAL_ERROR'
    })
  }
}

async function getCampaignVisitors(req, res) {
  try {
    const { start, end, level } = req.query
    let { adIds } = req.query

    if (!start || !end) {
      return res.status(400).json({ error: 'Start and end dates are required' })
    }

    if (!adIds) {
      return res.json({ success: true, data: [] })
    }

    if (!Array.isArray(adIds)) {
      adIds = String(adIds).split(',')
    }

    const normalizedAdIds = adIds
      .map(id => String(id).trim())
      .filter(Boolean)

    if (normalizedAdIds.length === 0) {
      return res.json({ success: true, data: [] })
    }

    const startDate = parseStartDate(start)
    const endDate = parseEndDate(end)

    const hierarchyLevel = typeof level === 'string' ? level : undefined
    const adSetIds = req.query.adSetId ? [String(req.query.adSetId).trim()] : []
    const campaignIds = req.query.campaignId ? [String(req.query.campaignId).trim()] : []

    const data = await campaignsService.getVisitorsByHierarchy({
      adIds: normalizedAdIds,
      adSetIds,
      campaignIds,
      startDate,
      endDate
    })

    res.json({ success: true, data })
  } catch (error) {
    console.error('Campaign visitors error:', error)
    res.status(500).json({ error: 'Failed to fetch campaign visitors', message: error.message })
  }
}

module.exports = {
  getCampaigns,
  getCampaignsChart,
  getCampaignsMetrics,
  getAdVisitors,
  getCampaignContactDetails,
  getCampaignVisitors
}
