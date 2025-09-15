const express = require('express');
const router = express.Router();
const { getContacts, getContactMetrics, createContact, updateContact, deleteContact, bulkDeleteContacts } = require('../controllers/contacts.controller');

// GET /api/contacts
router.get('/', getContacts);

// GET /api/contacts/metrics
router.get('/metrics', getContactMetrics);

// POST /api/contacts
router.post('/', createContact);

// PATCH /api/contacts/:id
router.patch('/:id', updateContact);

// DELETE /api/contacts/:id
router.delete('/:id', deleteContact);

// POST /api/contacts/bulk-delete
router.post('/bulk-delete', bulkDeleteContacts);

module.exports = router;