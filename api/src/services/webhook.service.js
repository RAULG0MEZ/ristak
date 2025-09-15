const { databasePool } = require('../config/database.config');

class WebhookService {
  // Mapeo flexible para contactos
  async processContact(data, accountId, subaccountId) {
    // Campos requeridos
    const requiredFields = ['contact_id'];
    const missingFields = [];
    
    // Verificar campos requeridos
    for (const field of requiredFields) {
      if (!data[field]) {
        missingFields.push(field);
      }
    }
    
    if (missingFields.length > 0) {
      const error = new Error(`Campos requeridos faltantes: ${missingFields.join(', ')}`);
      error.fields = missingFields;
      throw error;
    }
    
    // Extraer solo los campos que nos interesan (ignorar el resto)
    const contactData = {
      contact_id: data.contact_id,
      first_name: data.first_name || null,
      last_name: data.last_name || null,
      email: data.email || null,
      phone: data.phone || null,
      company: data.company || null,
      attribution_ad_id: data.first_adid || null, // Mapear first_adid a attribution_ad_id
      ext_crm_id: data.contact_id, // Usar contact_id como ext_crm_id
      status: data.status || 'lead',
      source: data.source || 'webhook',
      created_at: new Date(),
      updated_at: new Date()
    };
    
    try {
      // Insertar o actualizar contacto
      const query = `
        INSERT INTO public.contacts (
          contact_id, first_name, last_name, email, phone, 
          company, attribution_ad_id, ext_crm_id, status, source, 
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (contact_id) 
        DO UPDATE SET
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          email = EXCLUDED.email,
          phone = EXCLUDED.phone,
          company = EXCLUDED.company,
          attribution_ad_id = COALESCE(contacts.attribution_ad_id, EXCLUDED.attribution_ad_id),
          status = EXCLUDED.status,
          source = EXCLUDED.source,
          updated_at = EXCLUDED.updated_at
        RETURNING *
      `;
      
      const result = await databasePool.query(query, [
        contactData.contact_id,
        contactData.first_name,
        contactData.last_name,
        contactData.email,
        contactData.phone,
        contactData.company,
        contactData.attribution_ad_id,
        contactData.ext_crm_id,
        contactData.status,
        contactData.source,
        contactData.created_at,
        contactData.updated_at
      ]);
      
      // Registrar en logs (comentado temporalmente hasta crear tabla)
      // await this.logWebhook('contacts', 'success', data, result.rows[0]);
      
      return result.rows[0];
    } catch (error) {
      // await this.logWebhook('contacts', 'error', data, error.message);
      console.error('[Webhook] Error en processContact:', error);
      throw error;
    }
  }
  
  // Mapeo flexible para pagos
  async processPayment(data, accountId, subaccountId) {
    // Campos requeridos - usar nombres exactos del webhook
    const requiredFields = ['transaction_id', 'monto', 'contact_id'];
    const missingFields = [];
    
    for (const field of requiredFields) {
      if (!data[field]) {
        missingFields.push(field);
      }
    }
    
    if (missingFields.length > 0) {
      const error = new Error(`Campos requeridos faltantes: ${missingFields.join(', ')}`);
      error.fields = missingFields;
      throw error;
    }
    
    // Mapear campos del webhook a campos de la BD
    const paymentData = {
      transaction_id: data.transaction_id,
      amount: parseFloat(data.monto) || 0, // Mapear "monto" a "amount"
      description: data.nota || null, // Mapear "nota" a "description"
      contact_id: data.contact_id,
      currency: data.currency || 'MXN',
      status: 'completed',
      payment_method: data.payment_method || 'unknown',
      created_at: new Date(),
      updated_at: new Date()
    };
    
    try {
      const query = `
        INSERT INTO public.payments (
          id, transaction_id, amount, description, contact_id, 
          currency, status, payment_method, created_at, updated_at
        ) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (transaction_id) 
        DO UPDATE SET
          amount = EXCLUDED.amount,
          description = EXCLUDED.description,
          updated_at = EXCLUDED.updated_at
        RETURNING *
      `;
      
      const result = await databasePool.query(query, [
        paymentData.transaction_id,
        paymentData.amount,
        paymentData.description,
        paymentData.contact_id,
        paymentData.currency,
        paymentData.status,
        paymentData.payment_method,
        paymentData.created_at,
        paymentData.updated_at
      ]);
      
      // await this.logWebhook('payments', 'success', data, result.rows[0]);
      return result.rows[0];
    } catch (error) {
      // await this.logWebhook('payments', 'error', data, error.message);
      console.error('[Webhook] Error en processPayment:', error);
      throw error;
    }
  }
  
  // Mapeo flexible para citas
  async processAppointment(data, accountId, subaccountId) {
    const requiredFields = ['contact_id'];
    const missingFields = [];
    
    for (const field of requiredFields) {
      if (!data[field]) {
        missingFields.push(field);
      }
    }
    
    if (missingFields.length > 0) {
      const error = new Error(`Campos requeridos faltantes: ${missingFields.join(', ')}`);
      error.fields = missingFields;
      throw error;
    }
    
    const appointmentData = {
      appointment_id: data.appointment_id || `apt_${Date.now()}`,
      contact_id: data.contact_id,
      title: data.title || 'Cita sin título',
      scheduled_at: data.scheduled_at || new Date(),
      duration: parseInt(data.duration) || 30,
      status: data.status || 'scheduled',
      notes: data.notes || null,
      account_id: accountId,
      subaccount_id: subaccountId,
      webhook_data: JSON.stringify(data),
      created_at: new Date(),
      updated_at: new Date()
    };
    
    try {
      const query = `
        INSERT INTO public.appointments (
          appointment_id, contact_id, title, scheduled_at, 
          duration, status, notes, account_id, 
          subaccount_id, webhook_data, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (appointment_id) 
        DO UPDATE SET
          title = EXCLUDED.title,
          scheduled_at = EXCLUDED.scheduled_at,
          duration = EXCLUDED.duration,
          status = EXCLUDED.status,
          notes = EXCLUDED.notes,
          webhook_data = EXCLUDED.webhook_data,
          updated_at = EXCLUDED.updated_at
        RETURNING *
      `;
      
      const result = await databasePool.query(query, [
        appointmentData.appointment_id,
        appointmentData.contact_id,
        appointmentData.title,
        appointmentData.scheduled_at,
        appointmentData.duration,
        appointmentData.status,
        appointmentData.notes,
        appointmentData.account_id,
        appointmentData.subaccount_id,
        appointmentData.webhook_data,
        appointmentData.created_at,
        appointmentData.updated_at
      ]);
      
      // await this.logWebhook('appointments', 'success', data, result.rows[0]);
      return result.rows[0];
    } catch (error) {
      // await this.logWebhook('appointments', 'error', data, error.message);
      console.error('[Webhook] Error en processAppointment:', error);
      throw error;
    }
  }
  
  // Mapeo flexible para reembolsos
  async processRefund(data, accountId, subaccountId) {
    const requiredFields = ['transaction_id'];
    const missingFields = [];

    for (const field of requiredFields) {
      if (!data[field]) {
        missingFields.push(field);
      }
    }

    if (missingFields.length > 0) {
      const error = new Error(`Campos requeridos faltantes: ${missingFields.join(', ')}`);
      error.fields = missingFields;
      throw error;
    }

    try {
      // Buscar el pago original
      const paymentQuery = `
        SELECT * FROM public.payments
        WHERE transaction_id = $1
      `;

      const paymentResult = await databasePool.query(paymentQuery, [data.transaction_id]);

      if (paymentResult.rows.length === 0) {
        throw new Error(`Transacción no encontrada: ${data.transaction_id}`);
      }

      const originalPayment = paymentResult.rows[0];

      // Verificar que el pago no esté ya reembolsado
      if (originalPayment.status === 'refunded') {
        throw new Error(`La transacción ${data.transaction_id} ya fue reembolsada`);
      }

      // Actualizar el pago para marcarlo como reembolsado
      const updateQuery = `
        UPDATE public.payments
        SET
          status = 'refunded',
          updated_at = NOW(),
          description = COALESCE(description, '') || ' | Refund: ' || $2
        WHERE transaction_id = $1
        RETURNING *
      `;

      const reason = data.reason || 'Reembolso procesado vía webhook';
      const result = await databasePool.query(updateQuery, [
        data.transaction_id,
        reason
      ]);

      console.log(`[Webhook] Pago ${data.transaction_id} marcado como reembolsado`);

      // await this.logWebhook('refunds', 'success', data, result.rows[0]);
      return result.rows[0];
    } catch (error) {
      // await this.logWebhook('refunds', 'error', data, error.message);
      console.error('[Webhook] Error en processRefund:', error);
      throw error;
    }
  }
  
  // Registrar logs de webhooks
  async logWebhook(type, status, payload, response) {
    try {
      const query = `
        INSERT INTO public.webhook_logs (
          webhook_type, status, payload, response, created_at
        ) VALUES ($1, $2, $3, $4, $5)
      `;
      
      await databasePool.query(query, [
        type,
        status,
        JSON.stringify(payload),
        typeof response === 'string' ? response : JSON.stringify(response),
        new Date()
      ]);
    } catch (error) {
      console.error('Error guardando log de webhook:', error);
    }
  }
  
  // Obtener logs recientes
  async getRecentLogs(limit = 100) {
    try {
      const query = `
        SELECT * FROM public.webhook_logs 
        ORDER BY created_at DESC 
        LIMIT $1
      `;
      
      const result = await databasePool.query(query, [limit]);
      return result.rows;
    } catch (error) {
      console.error('Error obteniendo logs:', error);
      return [];
    }
  }
}

module.exports = new WebhookService();