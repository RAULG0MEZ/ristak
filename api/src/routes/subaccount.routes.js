const express = require('express');
const router = express.Router();
const { 
  getSubaccount, 
  updateSubaccount, 
  getLocaleSettings,
  updateTablePreferences,
  getTablePreferences 
} = require('../controllers/subaccount.controller');

// GET /api/subaccount
router.get('/', getSubaccount);

// GET /api/subaccount/locale/settings
router.get('/locale/settings', getLocaleSettings);

// GET /api/subaccount/preferences/:tableName
router.get('/preferences/:tableName', getTablePreferences);

// PUT /api/subaccount/preferences/:tableName
router.put('/preferences/:tableName', updateTablePreferences);

// GET /api/subaccount/:id
router.get('/:id', getSubaccount);

// PUT /api/subaccount
router.put('/', updateSubaccount);

// PUT /api/subaccount/:id
router.put('/:id', updateSubaccount);

module.exports = router;