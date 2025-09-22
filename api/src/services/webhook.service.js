const { databasePool } = require('../config/database.config');
const crypto = require('crypto');

class WebhookService {
  // Generar ID único para contactos con formato cntct_[random]
  async generateContactId() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let randomId = '';
    const randomBytes = crypto.randomBytes(16);

    for (let i = 0; i < 16; i++) {
      randomId += characters[randomBytes[i] % characters.length];
    }

    return `cntct_${randomId}`;
  }

  // Procesamiento SIMPLE de contactos - CON CUSTOM DATA
  async processContact(data) {
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

    console.log('[Webhook] Procesando contacto con customData:', data.contact_id);

    // Extraer CustomData específico para contactos: rstk_adid, rstk_source, rstk_vid
    const customData = {};
    if (data.rstk_adid !== undefined) customData.rstk_adid = data.rstk_adid;
    if (data.rstk_source !== undefined) customData.rstk_source = data.rstk_source;
    if (data.rstk_vid !== undefined) customData.rstk_vid = data.rstk_vid;

    console.log('[Webhook] CustomData extraído para contacto:', customData);

    try {
      // Buscar si ya existe el contacto por ext_crm_id
      const existingContactQuery = `
        SELECT contact_id, email, phone FROM contacts
        WHERE ext_crm_id = $1
        LIMIT 1
      `;
      const existingResult = await databasePool.query(existingContactQuery, [data.contact_id]);

      let finalContactId;

      if (existingResult.rows.length > 0) {
        // ACTUALIZAR contacto existente
        finalContactId = existingResult.rows[0].contact_id;

        const updateQuery = `
          UPDATE contacts
          SET
            first_name = COALESCE($2, first_name),
            last_name = COALESCE($3, last_name),
            email = COALESCE($4, email),
            phone = COALESCE($5, phone),
            company = COALESCE($6, company),
            status = COALESCE($7, status),
            custom_data = COALESCE($8, custom_data),
            updated_at = NOW()
          WHERE contact_id = $1
          RETURNING contact_id, email, phone
        `;

        const updateResult = await databasePool.query(updateQuery, [
          finalContactId,
          data.first_name || null,
          data.last_name || null,
          data.email || null,
          data.phone || null,
          data.company || null,
          data.status || 'lead',
          JSON.stringify(customData)
        ]);

        console.log(`✅ [Webhook] Contacto actualizado: ${finalContactId}`);
        return updateResult.rows[0];

      } else {
        // CREAR nuevo contacto
        finalContactId = await this.generateContactId();

        const insertQuery = `
          INSERT INTO contacts (
            contact_id, first_name, last_name, email, phone, company,
            ext_crm_id, status, source, custom_data, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
          RETURNING contact_id, email, phone
        `;

        const insertResult = await databasePool.query(insertQuery, [
          finalContactId,
          data.first_name || null,
          data.last_name || null,
          data.email || null,
          data.phone || null,
          data.company || null,
          data.contact_id, // ext_crm_id = GHL contact_id
          data.status || 'lead',
          'webhook',
          JSON.stringify(customData)
        ]);

        console.log(`✅ [Webhook] Contacto creado: ${finalContactId}`);
        return insertResult.rows[0];
      }
    } catch (error) {
      console.error('[Webhook] Error en processContact:', error);
      throw error;
    }
  }

  // Mapeo flexible para pagos - CON CUSTOM DATA
  async processPayment(data) {
    // Campos requeridos básicos
    const requiredFields = ['transaction_id', 'contact_id'];
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

    console.log('[Webhook] Procesando pago con customData:', data.transaction_id);

    // Extraer CustomData específico para pagos: monto, transaction_id, nota
    const customData = {};
    if (data.monto !== undefined) customData.monto = data.monto;
    if (data.transaction_id !== undefined) customData.transaction_id = data.transaction_id;
    if (data.nota !== undefined) customData.nota = data.nota;

    console.log('[Webhook] CustomData extraído para pago:', customData);

    try {
      const paymentData = {
        transaction_id: data.transaction_id,
        amount: parseFloat(data.amount || data.monto) || 0,
        description: data.description || data.nota || null,
        contact_id: data.contact_id,
        currency: data.currency || 'MXN',
        status: 'completed',
        payment_method: data.payment_method || 'unknown',
        custom_data: JSON.stringify(customData) // Guardar customData como JSON
      };

      const query = `
        INSERT INTO payments (
          id, transaction_id, amount, description, contact_id,
          currency, status, payment_method, custom_data, created_at, updated_at
        ) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        ON CONFLICT (transaction_id)
        DO UPDATE SET
          amount = EXCLUDED.amount,
          description = EXCLUDED.description,
          custom_data = EXCLUDED.custom_data,
          updated_at = NOW()
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
        paymentData.custom_data
      ]);

      console.log(`✅ [Webhook] Pago procesado con customData: ${data.transaction_id}`);
      return result.rows[0];
    } catch (error) {
      console.error('[Webhook] Error en processPayment:', error);
      throw error;
    }
  }

  // Mapeo flexible para citas - SIMPLIFICADO
  async processAppointment(data) {
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

    console.log('[Webhook] Procesando appointment simple para contact_id:', data.contact_id);

    try {
      // Buscar el contacto por ext_crm_id
      const contactQuery = `
        SELECT contact_id FROM contacts
        WHERE ext_crm_id = $1
        LIMIT 1
      `;
      const contactResult = await databasePool.query(contactQuery, [data.contact_id]);

      if (contactResult.rows.length === 0) {
        throw new Error(`Contacto no encontrado para contact_id: ${data.contact_id}`);
      }

      const finalContactId = contactResult.rows[0].contact_id;

      // Crear appointment básico
      const query = `
        INSERT INTO appointments (
          appointment_id, contact_id, title, description, location,
          start_time, end_time, status, created_at, updated_at
        ) VALUES (
          gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, NOW(), NOW()
        )
        RETURNING *
      `;

      // Procesar fechas
      let startTime = null;
      let endTime = null;

      if (data.start_time || data.scheduled_at) {
        startTime = new Date(data.start_time || data.scheduled_at).toISOString();
      }
      if (data.end_time) {
        endTime = new Date(data.end_time).toISOString();
      } else if (startTime && data.duration) {
        const start = new Date(startTime);
        const end = new Date(start.getTime() + (parseInt(data.duration) * 60 * 1000));
        endTime = end.toISOString();
      }

      const result = await databasePool.query(query, [
        finalContactId,
        data.title || 'Cita agendada',
        data.description || data.notes || null,
        data.location || null,
        startTime,
        endTime,
        data.status || 'scheduled'
      ]);

      console.log(`✅ [Webhook] Appointment creado para contacto: ${finalContactId}`);
      return result.rows[0];
    } catch (error) {
      console.error('[Webhook] Error en processAppointment:', error);
      throw error;
    }
  }

  // Mapeo flexible para reembolsos - CON CUSTOM DATA
  async processRefund(data) {
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

    console.log('[Webhook] Procesando refund con customData:', data.transaction_id);

    // Extraer CustomData específico para refunds: transaction_id
    const customData = {};
    if (data.transaction_id !== undefined) customData.transaction_id = data.transaction_id;

    console.log('[Webhook] CustomData extraído para refund:', customData);

    try {
      // Buscar el pago original
      const paymentQuery = `
        SELECT * FROM payments
        WHERE transaction_id = $1
      `;
      const paymentResult = await databasePool.query(paymentQuery, [data.transaction_id]);

      if (paymentResult.rows.length === 0) {
        throw new Error(`Transacción no encontrada: ${data.transaction_id}`);
      }

      const originalPayment = paymentResult.rows[0];

      if (originalPayment.status === 'refunded') {
        throw new Error(`La transacción ${data.transaction_id} ya fue reembolsada`);
      }

      // Marcar como reembolsado y actualizar customData
      const updateQuery = `
        UPDATE payments
        SET
          status = 'refunded',
          updated_at = NOW(),
          description = COALESCE(description, '') || ' | Refunded: ' || $2,
          custom_data = COALESCE(custom_data, '{}')::jsonb || $3::jsonb
        WHERE transaction_id = $1
        RETURNING *
      `;

      const reason = data.reason || 'Reembolso procesado vía webhook';
      const result = await databasePool.query(updateQuery, [
        data.transaction_id,
        reason,
        JSON.stringify(customData)
      ]);

      console.log(`✅ [Webhook] Pago reembolsado: ${data.transaction_id}`);
      return result.rows[0];
    } catch (error) {
      console.error('[Webhook] Error en processRefund:', error);
      throw error;
    }
  }
}

module.exports = new WebhookService();