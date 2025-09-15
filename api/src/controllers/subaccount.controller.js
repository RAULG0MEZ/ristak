const subaccountService = require('../services/subaccount.service');

async function getSubaccount(req, res) {
  try {
    // For now, we use the default subaccount ID
    const subaccountId = req.params.id || process.env.DEFAULT_SUBACCOUNT_ID;
    
    const subaccount = await subaccountService.getSubaccount(subaccountId);
    
    res.json({
      success: true,
      data: subaccount
    });
  } catch (error) {
    console.error('Error getting subaccount:', error);
    res.status(500).json({
      error: 'Failed to fetch subaccount',
      message: error.message
    });
  }
}

async function updateSubaccount(req, res) {
  try {
    // For now, we use the default subaccount ID
    const subaccountId = req.params.id || process.env.DEFAULT_SUBACCOUNT_ID;
    const updates = req.body;
    
    const updatedSubaccount = await subaccountService.updateSubaccount(subaccountId, updates);
    
    res.json({
      success: true,
      data: updatedSubaccount,
      message: 'Configuración actualizada correctamente'
    });
  } catch (error) {
    console.error('Error updating subaccount:', error);
    res.status(500).json({
      error: 'Failed to update subaccount',
      message: error.message
    });
  }
}

async function getLocaleSettings(req, res) {
  try {
    const subaccountId = req.params.id || process.env.DEFAULT_SUBACCOUNT_ID;
    
    const settings = await subaccountService.getLocaleSettings(subaccountId);
    
    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Error getting locale settings:', error);
    res.status(500).json({
      error: 'Failed to fetch locale settings',
      message: error.message
    });
  }
}

async function updateTablePreferences(req, res) {
  try {
    const subaccountId = process.env.DEFAULT_SUBACCOUNT_ID;
    const { tableName } = req.params;
    const preferences = req.body;
    
    const updatedPreferences = await subaccountService.updateUIPreferences(subaccountId, tableName, preferences);
    
    res.json({
      success: true,
      data: updatedPreferences,
      message: 'Preferencias de tabla actualizadas'
    });
  } catch (error) {
    console.error('Error updating table preferences:', error);
    res.status(500).json({
      error: 'Failed to update table preferences',
      message: error.message
    });
  }
}

async function getTablePreferences(req, res) {
  try {
    const subaccountId = process.env.DEFAULT_SUBACCOUNT_ID;
    const { tableName } = req.params;
    
    const preferences = await subaccountService.getTablePreferences(subaccountId, tableName);
    
    res.json({
      success: true,
      data: preferences
    });
  } catch (error) {
    console.error('Error getting table preferences:', error);
    res.status(500).json({
      error: 'Failed to fetch table preferences',
      message: error.message
    });
  }
}

module.exports = {
  getSubaccount,
  updateSubaccount,
  getLocaleSettings,
  updateTablePreferences,
  getTablePreferences
};