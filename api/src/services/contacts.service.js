const { databasePool } = require('../config/database.config');
const crypto = require('crypto');

class ContactsService {

  // Generar ID único para contactos con formato cntct_[random]
  async generateContactId() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let randomId = '';

    // Generar 16 caracteres aleatorios
    const randomBytes = crypto.randomBytes(16);
    for (let i = 0; i < 16; i++) {
      randomId += characters[randomBytes[i] % characters.length];
    }

    const contactId = `cntct_${randomId}`;

    // Verificar que no exista
    try {
      const existing = await databasePool.query(
        'SELECT contact_id FROM contacts WHERE contact_id = $1',
        [contactId]
      );

      if (existing.rows.length > 0) {
        // Si existe, intentar de nuevo
        return this.generateContactId();
      }
    } catch (error) {
      // En caso de error, continuar con el ID generado
    }

    return contactId;
  }
  
  async getContacts(startDate, endDate, filters = {}) {
    try {
      let query = `
        SELECT 
          c.contact_id,
          c.first_name,
          c.last_name,
          c.email,
          c.phone,
          c.company,
          c.attribution_ad_id,
          c.ext_crm_id,
          c.status,
          c.source,
          c.created_at,
          c.updated_at,
          (SELECT COUNT(*) FROM appointments a WHERE a.contact_id = c.contact_id) as appointment_count,
          (SELECT COUNT(*) FROM payments p WHERE p.contact_id = c.contact_id AND p.status = 'completed') as payment_count,
          (SELECT COALESCE(SUM(p2.amount), 0) FROM payments p2 WHERE p2.contact_id = c.contact_id AND p2.status = 'completed') as ltv
        FROM contacts c
        WHERE c.created_at >= $1 AND c.created_at <= $2
        ORDER BY c.created_at DESC
      `;
      
      const result = await databasePool.query(query, [startDate, endDate]);
      
      return result.rows.map(row => ({
        id: row.contact_id,
        // CORREGIDO: Usar lógica inteligente para nombres
        name: row.first_name ?
          (row.last_name ? `${row.first_name} ${row.last_name}`.trim() : row.first_name)
          : 'Sin nombre',
        email: row.email,
        phone: row.phone,
        company: row.company,
        attributionAdId: row.attribution_ad_id,
        ghlId: row.ext_crm_id,
        status: row.payment_count > 0 ? 'client' : row.appointment_count > 0 ? 'appointment' : 'lead',
        source: row.source || 'Direct',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        appointments: parseInt(row.appointment_count) || 0,
        payments: parseInt(row.payment_count) || 0,
        ltv: parseFloat(row.ltv) || 0
      }));
    } catch (error) {
      console.error('Error fetching contacts:', error);
      throw error;
    }
  }
  
  async createContact(contactData) {
    try {
      // Generar ID único
      const contactId = await this.generateContactId();
      const now = new Date();

      // Preparar valores
      const firstName = contactData.name || contactData.firstName || '';
      const lastName = contactData.lastName || '';
      const email = contactData.email || null;
      const phone = contactData.phone || null;
      const company = contactData.company || null;
      const source = contactData.source || 'Manual';
      const status = 'lead'; // Siempre inicia como lead

      const insertQuery = `
        INSERT INTO contacts (
          contact_id,
          first_name,
          last_name,
          email,
          phone,
          company,
          status,
          source,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;

      const result = await databasePool.query(insertQuery, [
        contactId,
        firstName,
        lastName,
        email,
        phone,
        company,
        status,
        source,
        now,
        now
      ]);

      const newContact = result.rows[0];
      return {
        id: newContact.contact_id,
        // CORREGIDO: Usar lógica inteligente para nombres
        name: newContact.first_name ?
          (newContact.last_name ? `${newContact.first_name} ${newContact.last_name}`.trim() : newContact.first_name)
          : 'Sin nombre',
        email: newContact.email,
        phone: newContact.phone,
        company: newContact.company,
        status: newContact.status,
        source: newContact.source,
        createdAt: newContact.created_at,
        updatedAt: newContact.updated_at
      };
    } catch (error) {
      console.error('Error creating contact:', error);
      throw error;
    }
  }

  async updateContact(id, updateData) {
    try {
      const fields = [];
      const values = [];
      let fieldIndex = 1;

      // Build dynamic update query
      if (updateData.name !== undefined) {
        // Manejar campo name unificado - guardar TODO en first_name
        fields.push(`first_name = $${fieldIndex++}`);
        values.push(updateData.name);
        // OBLIGATORIO: Limpiar last_name para evitar duplicación
        fields.push(`last_name = $${fieldIndex++}`);
        values.push('');
      }
      if (updateData.firstName !== undefined) {
        fields.push(`first_name = $${fieldIndex++}`);
        values.push(updateData.firstName);
      }
      if (updateData.lastName !== undefined) {
        fields.push(`last_name = $${fieldIndex++}`);
        values.push(updateData.lastName);
      }
      if (updateData.email !== undefined) {
        fields.push(`email = $${fieldIndex++}`);
        values.push(updateData.email || null);
      }
      if (updateData.phone !== undefined) {
        fields.push(`phone = $${fieldIndex++}`);
        values.push(updateData.phone || null);
      }
      if (updateData.company !== undefined) {
        fields.push(`company = $${fieldIndex++}`);
        values.push(updateData.company || null);
      }
      if (updateData.source !== undefined) {
        fields.push(`source = $${fieldIndex++}`);
        values.push(updateData.source);
      }
      if (updateData.status !== undefined) {
        fields.push(`status = $${fieldIndex++}`);
        values.push(updateData.status);
      }

      if (fields.length === 0) {
        return null;
      }

      fields.push(`updated_at = $${fieldIndex++}`);
      values.push(new Date());
      values.push(id);

      const query = `
        UPDATE contacts
        SET ${fields.join(', ')}
        WHERE contact_id = $${fieldIndex}
        RETURNING *
      `;

      const result = await databasePool.query(query, values);

      if (result.rows.length === 0) {
        return null;
      }

      // Retornar en formato esperado por frontend
      const updatedContact = result.rows[0];
      return {
        id: updatedContact.contact_id,
        // CORREGIDO: Para ediciones con name, usar solo first_name
        name: updatedContact.first_name || 'Sin nombre',
        email: updatedContact.email,
        phone: updatedContact.phone,
        company: updatedContact.company,
        status: updatedContact.status,
        source: updatedContact.source,
        createdAt: updatedContact.created_at,
        updatedAt: updatedContact.updated_at
      };
    } catch (error) {
      console.error('Error updating contact:', error);
      throw error;
    }
  }
  
  async deleteContact(id) {
    try {
      // First delete related records (payments and appointments)
      await databasePool.query('DELETE FROM payments WHERE contact_id = $1', [id]);
      await databasePool.query('DELETE FROM appointments WHERE contact_id = $1', [id]);

      // Then delete the contact
      const query = `
        DELETE FROM contacts
        WHERE contact_id = $1
        RETURNING contact_id
      `;

      const result = await databasePool.query(query, [id]);
      return result.rows.length > 0;
    } catch (error) {
      console.error('Error deleting contact:', error);
      throw error;
    }
  }

  async bulkDeleteContacts(ids) {
    try {
      // Start a transaction
      const client = await databasePool.connect();

      try {
        await client.query('BEGIN');

        // Delete related records for all contacts
        await client.query('DELETE FROM payments WHERE contact_id = ANY($1::text[])', [ids]);
        await client.query('DELETE FROM appointments WHERE contact_id = ANY($1::text[])', [ids]);

        // Delete the contacts
        const query = `
          DELETE FROM contacts
          WHERE contact_id = ANY($1::text[])
          RETURNING contact_id
        `;

        const result = await client.query(query, [ids]);
        await client.query('COMMIT');

        return { count: result.rows.length };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error bulk deleting contacts:', error);
      throw error;
    }
  }

  async getContactMetrics(startDate, endDate) {
    try {
      // Total contacts
      const totalQuery = `
        SELECT COUNT(*) as total
        FROM contacts
        WHERE created_at >= $1 AND created_at <= $2
      `;

      // Contacts with appointments
      const appointmentsQuery = `
        SELECT COUNT(DISTINCT c.contact_id) as with_appointments
        FROM contacts c
        INNER JOIN appointments a ON c.contact_id = a.contact_id
        WHERE c.created_at >= $1 AND c.created_at <= $2
      `;

      // Customers (contacts with completed payments)
      const customersQuery = `
        SELECT
          COUNT(DISTINCT c.contact_id) as customers,
          (SELECT COALESCE(SUM(p2.amount), 0)
           FROM payments p2
           INNER JOIN contacts c2 ON p2.contact_id = c2.contact_id
           WHERE c2.created_at >= $1 AND c2.created_at <= $2
           AND p2.status = 'completed') as total_ltv
        FROM contacts c
        WHERE c.created_at >= $1 AND c.created_at <= $2
        AND EXISTS (
          SELECT 1 FROM payments p
          WHERE p.contact_id = c.contact_id
          AND p.status = 'completed'
        )
      `;

      const [total, appointments, customers] = await Promise.all([
        databasePool.query(totalQuery, [startDate, endDate]),
        databasePool.query(appointmentsQuery, [startDate, endDate]),
        databasePool.query(customersQuery, [startDate, endDate])
      ]);

      const totalContacts = parseInt(total.rows[0].total) || 0;
      const withAppointments = parseInt(appointments.rows[0].with_appointments) || 0;
      const customerCount = parseInt(customers.rows[0].customers) || 0;
      const totalLTV = parseFloat(customers.rows[0].total_ltv) || 0;

      return {
        total: totalContacts,
        withAppointments: withAppointments,
        customers: customerCount,
        totalLTV: totalLTV,
        avgLTV: customerCount > 0 ? totalLTV / customerCount : 0,
        conversionRate: totalContacts > 0 ? (customerCount / totalContacts) * 100 : 0,
        appointmentRate: totalContacts > 0 ? (withAppointments / totalContacts) * 100 : 0
      };
    } catch (error) {
      console.error('Error fetching contact metrics:', error);
      throw error;
    }
  }

  // Nuevo método para obtener contactos con paginación (sin filtro de fecha)
  async getContactsPaginated(offset, limit, accountId, subaccountId) {
    try {
      const countQuery = `SELECT COUNT(*) as total FROM contacts WHERE account_id = $1 AND subaccount_id = $2`;

      const dataQuery = `
        SELECT
          c.contact_id,
          c.first_name,
          c.last_name,
          c.email,
          c.phone,
          c.company,
          c.attribution_ad_id,
          c.ext_crm_id,
          c.status,
          c.source,
          c.created_at,
          c.updated_at,
          (SELECT COUNT(*) FROM appointments a WHERE a.contact_id = c.contact_id) as appointment_count,
          (SELECT COUNT(*) FROM payments p WHERE p.contact_id = c.contact_id AND p.status = 'completed') as payment_count,
          (SELECT COALESCE(SUM(p2.amount), 0) FROM payments p2 WHERE p2.contact_id = c.contact_id AND p2.status = 'completed') as ltv
        FROM contacts c
        ORDER BY c.created_at DESC
        LIMIT $1 OFFSET $2
      `;

      const [countResult, dataResult] = await Promise.all([
        databasePool.query(countQuery),
        databasePool.query(dataQuery, [limit, offset])
      ]);

      const contacts = dataResult.rows.map(row => ({
        id: row.contact_id,
        name: row.first_name ?
          (row.last_name ? `${row.first_name} ${row.last_name}`.trim() : row.first_name)
          : 'Sin nombre',
        email: row.email,
        phone: row.phone,
        company: row.company,
        attributionAdId: row.attribution_ad_id,
        ghlId: row.ext_crm_id,
        status: row.payment_count > 0 ? 'client' : row.appointment_count > 0 ? 'appointment' : 'lead',
        source: row.source || 'Direct',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        appointments: parseInt(row.appointment_count) || 0,
        payments: parseInt(row.payment_count) || 0,
        ltv: parseFloat(row.ltv) || 0
      }));

      return {
        contacts,
        total: parseInt(countResult.rows[0].total) || 0
      };
    } catch (error) {
      console.error('Error fetching paginated contacts:', error);
      throw error;
    }
  }

  // Nuevo método para obtener contactos con paginación Y filtro de fecha
  async getContactsWithPagination(startDate, endDate, offset, limit) {
    try {
      const countQuery = `
        SELECT COUNT(*) as total
        FROM contacts
        WHERE created_at >= $1 AND created_at <= $2
      `;

      const dataQuery = `
        SELECT
          c.contact_id,
          c.first_name,
          c.last_name,
          c.email,
          c.phone,
          c.company,
          c.attribution_ad_id,
          c.ext_crm_id,
          c.status,
          c.source,
          c.created_at,
          c.updated_at,
          (SELECT COUNT(*) FROM appointments a WHERE a.contact_id = c.contact_id) as appointment_count,
          (SELECT COUNT(*) FROM payments p WHERE p.contact_id = c.contact_id AND p.status = 'completed') as payment_count,
          (SELECT COALESCE(SUM(p2.amount), 0) FROM payments p2 WHERE p2.contact_id = c.contact_id AND p2.status = 'completed') as ltv
        FROM contacts c
        WHERE c.created_at >= $1 AND c.created_at <= $2
        ORDER BY c.created_at DESC
        LIMIT $3 OFFSET $4
      `;

      const [countResult, dataResult] = await Promise.all([
        databasePool.query(countQuery, [startDate, endDate]),
        databasePool.query(dataQuery, [startDate, endDate, limit, offset])
      ]);

      const contacts = dataResult.rows.map(row => ({
        id: row.contact_id,
        name: row.first_name ?
          (row.last_name ? `${row.first_name} ${row.last_name}`.trim() : row.first_name)
          : 'Sin nombre',
        email: row.email,
        phone: row.phone,
        company: row.company,
        attributionAdId: row.attribution_ad_id,
        ghlId: row.ext_crm_id,
        status: row.payment_count > 0 ? 'client' : row.appointment_count > 0 ? 'appointment' : 'lead',
        source: row.source || 'Direct',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        appointments: parseInt(row.appointment_count) || 0,
        payments: parseInt(row.payment_count) || 0,
        ltv: parseFloat(row.ltv) || 0
      }));

      return {
        contacts,
        total: parseInt(countResult.rows[0].total) || 0
      };
    } catch (error) {
      console.error('Error fetching contacts with pagination:', error);
      throw error;
    }
  }
}

module.exports = new ContactsService();