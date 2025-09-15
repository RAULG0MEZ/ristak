const express = require('express')
const router = express.Router()
const metaController = require('../controllers/meta.controller')

// OAuth flow
router.get('/oauth/start', metaController.startOAuth)
router.get('/oauth/callback', metaController.oauthCallback)

// Configuration
router.get('/config', metaController.getConfig)
router.post('/configure', metaController.configure)

// Ad Accounts & Pixels
router.get('/adaccounts', metaController.listAdAccounts)
router.get('/pixels', metaController.listPixels)

// Sync
router.post('/sync/manual', metaController.manualSync)
router.get('/sync/status', metaController.syncStatus)

// Disconnect
router.post('/disconnect', metaController.disconnect)

// Initialize schema
router.post('/init-schema', metaController.initSchema)

module.exports = router

