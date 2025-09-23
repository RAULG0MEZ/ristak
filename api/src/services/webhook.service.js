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
          data.status || 'lead'
        ]);

        console.log(`✅ [Webhook] Contacto actualizado: ${finalContactId}`);

        // NUEVO: Vincular sesiones de tracking si tenemos visitor_id
        const visitorId = data.rstk_vid || customData.rstk_vid;
        if (visitorId) {
          await this.linkTrackingSessions(finalContactId, visitorId);
        }

        return updateResult.rows[0];

      } else {
        // CREAR nuevo contacto
        finalContactId = await this.generateContactId();

        const insertQuery = `
          INSERT INTO contacts (
            contact_id, first_name, last_name, email, phone, company,
            ext_crm_id, status, source, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
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
          'webhook'
        ]);

        console.log(`✅ [Webhook] Contacto creado: ${finalContactId}`);

        // NUEVO: Vincular sesiones de tracking si tenemos visitor_id
        const visitorId = data.rstk_vid || customData.rstk_vid;
        if (visitorId) {
          await this.linkTrackingSessions(finalContactId, visitorId);
        }

        return insertResult.rows[0];
      }
    } catch (error) {
      console.error('[Webhook] Error en processContact:', error);
      throw error;
    }
  }

  // NUEVO: Función para vincular sesiones de tracking con locks para evitar race conditions
  async linkTrackingSessions(contactId, visitorId) {
    console.log(`🔗 [Webhook] Intentando vincular sesiones del visitor ${visitorId} al contacto ${contactId}`);

    try {
      // Primero verificar si hay sesiones de este visitor
      const countQuery = `
        SELECT COUNT(*) as total
        FROM tracking.sessions
        WHERE visitor_id = $1
      `;
      const countResult = await databasePool.query(countQuery, [visitorId]);
      console.log(`📊 [Webhook] Sesiones encontradas para visitor ${visitorId}: ${countResult.rows[0].total}`);

      // Generar hash único para el lock basado en visitor_id + contact_id
      const lockKey = `${visitorId}_${contactId}`;
      const hash = require('crypto').createHash('md5').update(lockKey).digest('hex');
      const lockId = parseInt(hash.substring(0, 8), 16);

      // Intentar obtener lock advisory de PostgreSQL
      const lockResult = await databasePool.query('SELECT pg_try_advisory_lock($1)', [lockId]);

      if (!lockResult.rows[0].pg_try_advisory_lock) {
        console.log('⏳ [Webhook] Lock en uso, otro proceso está vinculando. Saltando...');
        return 0;
      }

      try {
        // Verificar si ya existe vinculación
        const checkQuery = `
          SELECT COUNT(*) as linked
          FROM tracking.sessions
          WHERE visitor_id = $1 AND contact_id = $2
          LIMIT 1
        `;
        const checkResult = await databasePool.query(checkQuery, [visitorId, contactId]);

        if (checkResult.rows[0].linked > 0) {
          console.log('✓ [Webhook] Sesiones ya vinculadas previamente');
          return 0;
        }

        // Vincular todas las sesiones del visitor_id al contact_id
        const updateQuery = `
          UPDATE tracking.sessions
          SET
            contact_id = $1,
            updated_at = NOW()
          WHERE
            visitor_id = $2
            AND contact_id IS NULL
        `;
        const updateResult = await databasePool.query(updateQuery, [contactId, visitorId]);

        if (updateResult.rowCount > 0) {
          console.log(`✅ [Webhook] ${updateResult.rowCount} sesiones vinculadas INMEDIATAMENTE por webhook`);

          // También actualizar el visitor_id en el contacto si no lo tiene
          await databasePool.query(
            `UPDATE contacts
             SET visitor_id = COALESCE(visitor_id, $2), updated_at = NOW()
             WHERE contact_id = $1`,
            [contactId, visitorId]
          );
        } else {
          console.log('ℹ️ [Webhook] No hay sesiones pendientes de vincular');
        }

        return updateResult.rowCount;

      } finally {
        // Siempre liberar el lock
        await databasePool.query('SELECT pg_advisory_unlock($1)', [lockId]);
      }

    } catch (error) {
      console.error('❌ [Webhook] Error vinculando sesiones:', error);
      // No lanzar error para no romper el flujo principal
      return 0;
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

      const paymentData = {
        transaction_id: data.transaction_id,
        amount: parseFloat(data.amount || data.monto) || 0,
        description: data.description || data.nota || null,
        contact_id: finalContactId, // Usar nuestro contact_id interno
        currency: data.currency || 'MXN',
        status: 'completed',
        payment_method: data.payment_method || 'unknown'
      };

      const query = `
        INSERT INTO payments (
          id, transaction_id, amount, description, contact_id,
          currency, status, payment_method, created_at, updated_at
        ) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        ON CONFLICT (transaction_id)
        DO UPDATE SET
          amount = EXCLUDED.amount,
          description = EXCLUDED.description,
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
        paymentData.payment_method
      ]);

      console.log(`✅ [Webhook] Pago procesado con customData: ${data.transaction_id}`);
      return result.rows[0];
    } catch (error) {
      console.error('[Webhook] Error en processPayment:', error);
      throw error;
    }
  }

  // Mapeo completo para citas - GUARDA TODOS LOS CAMPOS RELEVANTES
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

    console.log('[Webhook] Procesando appointment completo para contact_id:', data.contact_id);

    try {
      // Buscar el contacto por ext_crm_id, si no existe lo creamos
      let finalContactId;
      const contactQuery = `
        SELECT contact_id FROM contacts
        WHERE ext_crm_id = $1
        LIMIT 1
      `;
      const contactResult = await databasePool.query(contactQuery, [data.contact_id]);

      if (contactResult.rows.length === 0) {
        // Crear contacto si no existe
        console.log(`[Webhook] Contacto no existe, creando nuevo para ext_crm_id: ${data.contact_id}`);
        finalContactId = await this.generateContactId();

        const insertContactQuery = `
          INSERT INTO contacts (
            contact_id, ext_crm_id, status, source, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, NOW(), NOW())
          RETURNING contact_id
        `;

        const newContactResult = await databasePool.query(insertContactQuery, [
          finalContactId,
          data.contact_id, // ext_crm_id = GHL contact_id
          'lead',
          'webhook'
        ]);

        console.log(`✅ [Webhook] Contacto creado: ${finalContactId}`);
      } else {
        finalContactId = contactResult.rows[0].contact_id;
        console.log(`[Webhook] Usando contacto existente: ${finalContactId}`);
      }

      // Extraer datos del appointment object si viene anidado
      const appointmentData = data.appointment || data;

      // Crear appointment completo con TODOS los campos relevantes
      const query = `
        INSERT INTO appointments (
          appointment_id, contact_id, title, description, location,
          start_time, end_time, appointment_date, status,
          ext_crm_appointment_id, calendar_name, notes,
          created_at, updated_at
        ) VALUES (
          gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()
        )
        RETURNING *
      `;

      // Procesar fechas del appointment object
      let startTime = null;
      let endTime = null;
      let appointmentDate = null;

      // Priorizar campos del appointment object
      if (appointmentData.startTime) {
        startTime = new Date(appointmentData.startTime).toISOString();
        appointmentDate = startTime; // usar start_time como appointment_date también
      } else if (data.start_time || data.scheduled_at) {
        startTime = new Date(data.start_time || data.scheduled_at).toISOString();
        appointmentDate = startTime;
      }

      if (appointmentData.endTime) {
        endTime = new Date(appointmentData.endTime).toISOString();
      } else if (data.end_time) {
        endTime = new Date(data.end_time).toISOString();
      } else if (startTime && data.duration) {
        const start = new Date(startTime);
        const end = new Date(start.getTime() + (parseInt(data.duration) * 60 * 1000));
        endTime = end.toISOString();
      }

      const result = await databasePool.query(query, [
        finalContactId,                                    // $1: contact_id (nuestro ID interno)
        appointmentData.title || data.title || 'Cita agendada',  // $2: title
        appointmentData.notes || data.description || data.notes || null,  // $3: description
        appointmentData.address || data.location || null, // $4: location
        startTime,                                         // $5: start_time
        endTime,                                          // $6: end_time
        appointmentDate,                                  // $7: appointment_date
        appointmentData.status || data.status || 'scheduled',  // $8: status
        appointmentData.appointmentId || appointmentData.id || null,  // $9: ext_crm_appointment_id (ID de GHL)
        appointmentData.calendarName || null,             // $10: calendar_name
        appointmentData.notes || null                     // $11: notes
      ]);

      console.log(`✅ [Webhook] Appointment completo creado para contacto: ${finalContactId}`);
      console.log(`📅 [Webhook] Appointment ID externo: ${appointmentData.appointmentId || appointmentData.id}`);
      console.log(`📋 [Webhook] Calendario: ${appointmentData.calendarName || 'N/A'}`);

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

      // Marcar como reembolsado
      const updateQuery = `
        UPDATE payments
        SET
          status = 'refunded',
          updated_at = NOW(),
          description = COALESCE(description, '') || ' | Refunded: ' || $2
        WHERE transaction_id = $1
        RETURNING *
      `;

      const reason = data.reason || 'Reembolso procesado vía webhook';
      const result = await databasePool.query(updateQuery, [
        data.transaction_id,
        reason
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