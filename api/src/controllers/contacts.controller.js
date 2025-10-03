const contactsService = require('../services/contacts.service');

async function getContacts(req, res) {
  try {
    const { start, end, page = 1, limit = 50, all = 'false' } = req.query;

    // Si all=true, no requiere fechas y trae todos los contactos con paginación
    if (all === 'true') {
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;

      const result = await contactsService.getContactsPaginated(offset, limitNum);

      res.json({
        success: true,
        data: result.contacts,
        total: result.total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(result.total / limitNum)
      });
    } else {
      // Modo con fechas (comportamiento original)
      if (!start || !end) {
        return res.status(400).json({
          error: 'Start and end dates are required when all=false'
        });
      }

      const startDate = new Date(start);
      const endDate = new Date(end);
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;

      const result = await contactsService.getContactsWithPagination(startDate, endDate, offset, limitNum);

      res.json({
        success: true,
        data: result.contacts,
        total: result.total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(result.total / limitNum)
      });
    }
  } catch (error) {
    console.error('Contacts error:', error);
    res.status(500).json({
      error: 'Failed to fetch contacts',
      message: error.message
    });
  }
}

async function getContactMetrics(req, res) {
  try {
    const { start, end, all = 'false' } = req.query;

    if (all === 'true') {
      const combinedMetrics = await contactsService.getContactMetricsForAll();

      return res.json({
        success: true,
        data: combinedMetrics
      });
    }

    if (!start || !end) {
      return res.status(400).json({
        error: 'Start and end dates are required when all=false'
      });
    }

    const startDate = new Date(start);
    const endDate = new Date(end);

    // Get contact metrics (ya consolidado con trends)
    const combinedMetrics = await contactsService.getContactMetrics(startDate, endDate);

    res.json({
      success: true,
      data: combinedMetrics
    });
  } catch (error) {
    console.error('Contact metrics error:', error);
    res.status(500).json({
      error: 'Failed to fetch contact metrics',
      message: error.message
    });
  }
}

async function createContact(req, res) {
  try {
    const contactData = req.body;

    // Validar que tenga al menos email o teléfono
    if (!contactData.email && !contactData.phone) {
      return res.status(400).json({
        error: 'Se requiere al menos email o teléfono',
        message: 'Debes proporcionar email o teléfono para crear un contacto'
      });
    }

    const newContact = await contactsService.createContact(contactData);

    res.status(201).json({
      success: true,
      data: newContact,
      message: 'Contacto creado exitosamente'
    });
  } catch (error) {
    console.error('Create contact error:', error);
    res.status(500).json({
      error: 'Failed to create contact',
      message: error.message
    });
  }
}

async function updateContact(req, res) {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Validar que tenga al menos nombre
    if (updateData.hasOwnProperty('name') && (!updateData.name || updateData.name.trim() === '')) {
      return res.status(400).json({
        error: 'El nombre es obligatorio'
      });
    }

    // Permitir actualizar contactos sin email ni teléfono
    // Solo validamos formato si se proporciona email

    const updatedContact = await contactsService.updateContact(id, updateData);

    if (!updatedContact) {
      return res.status(404).json({
        error: 'Contact not found'
      });
    }

    res.json({
      success: true,
      data: updatedContact
    });
  } catch (error) {
    console.error('Update contact error:', error);
    res.status(500).json({
      error: 'Failed to update contact',
      message: error.message
    });
  }
}

async function deleteContact(req, res) {
  try {
    const { id } = req.params;

    const result = await contactsService.deleteContact(id);

    if (!result) {
      return res.status(404).json({
        error: 'Contact not found'
      });
    }

    res.json({
      success: true,
      message: 'Contact deleted successfully'
    });
  } catch (error) {
    console.error('Delete contact error:', error);
    res.status(500).json({
      error: 'Failed to delete contact',
      message: error.message
    });
  }
}

async function bulkDeleteContacts(req, res) {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        error: 'Contact IDs array is required'
      });
    }

    const result = await contactsService.bulkDeleteContacts(ids);

    res.json({
      success: true,
      message: `${result.count} contacts deleted successfully`,
      deletedCount: result.count
    });
  } catch (error) {
    console.error('Bulk delete contacts error:', error);
    res.status(500).json({
      error: 'Failed to delete contacts',
      message: error.message
    });
  }
}

module.exports = {
  getContacts,
  getContactMetrics,
  createContact,
  updateContact,
  deleteContact,
  bulkDeleteContacts
};
