const express = require('express');
const router = express.Router();
const importController = require('../controllers/import.controller');
const importAsyncController = require('../controllers/import-async.controller');

// Rutas de importación síncronas (legacy)
router.post('/contacts', importController.importContacts);
router.post('/payments', importController.importPayments);
router.post('/appointments', importController.importAppointments);

// Rutas de importación asíncronas con progreso
router.post('/async/start', importAsyncController.startImport);
router.get('/async/status/:jobId', importAsyncController.getJobStatus);
router.get('/async/jobs', importAsyncController.getActiveJobs);

module.exports = router;