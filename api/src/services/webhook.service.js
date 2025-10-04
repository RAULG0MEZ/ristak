const { databasePool } = require('../config/database.config');
const crypto = require('crypto');
const identityService = require('./identity.service');

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
    // Puede venir en nivel principal O dentro de customData
    const customData = {};
    if (data.customData) {
      // Si viene dentro del objeto customData, lo sacamos de ahí
      if (data.customData.rstk_adid !== undefined) customData.rstk_adid = data.customData.rstk_adid;
      if (data.customData.rstk_source !== undefined) customData.rstk_source = data.customData.rstk_source;
      if (data.customData.rstk_vid !== undefined) customData.rstk_vid = data.customData.rstk_vid;
    } else {
      // Si viene en nivel principal (retrocompatibilidad)
      if (data.rstk_adid !== undefined) customData.rstk_adid = data.rstk_adid;
      if (data.rstk_source !== undefined) customData.rstk_source = data.rstk_source;
      if (data.rstk_vid !== undefined) customData.rstk_vid = data.rstk_vid;
    }

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
            visitor_id = COALESCE($8, visitor_id),
            rstk_adid = COALESCE($9, rstk_adid),
            rstk_source = COALESCE($10, rstk_source),
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
          customData.rstk_vid || data.rstk_vid || null,  // visitor_id
          customData.rstk_adid || data.rstk_adid || null,  // rstk_adid
          customData.rstk_source || data.rstk_source || null  // rstk_source
        ]);

        console.log(`✅ [Webhook] Contacto actualizado: ${finalContactId}`);

        // NUEVO: Vincular sesiones de tracking si tenemos visitor_id
        const visitorId = customData.rstk_vid || data.rstk_vid;
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
            ext_crm_id, status, source, visitor_id, rstk_adid, rstk_source, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
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
          customData.rstk_vid || data.rstk_vid || null,  // visitor_id
          customData.rstk_adid || data.rstk_adid || null,  // rstk_adid
          customData.rstk_source || data.rstk_source || null  // rstk_source
        ]);

        console.log(`✅ [Webhook] Contacto creado: ${finalContactId}`);

        // NUEVO: Vincular sesiones de tracking si tenemos visitor_id
        const visitorId = customData.rstk_vid || data.rstk_vid;
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

  // =============================================================================
  // VINCULAR SESIONES CON IDENTITY RESOLUTION
  // Sistema robusto que encuentra TODAS las sesiones del usuario
  // =============================================================================
  async linkTrackingSessions(contactId, visitorId) {
    console.log(`🔗 [Webhook] Vinculando visitor ${visitorId} al contacto ${contactId} (con Identity Resolution)`);

    try {
      // 1. Obtener o crear primary_identity_id para este visitor_id
      let primaryIdentityId = await identityService.getPrimaryIdentity('visitor_id', visitorId);

      if (!primaryIdentityId) {
        // Si no existe, crearlo
        primaryIdentityId = identityService.generatePrimaryIdentityId();
        await identityService.linkIdentifier(
          primaryIdentityId,
          'visitor_id',
          visitorId,
          'webhook',
          1.0
        );
        console.log(`🆕 [Webhook] Nuevo primary_identity creado: ${primaryIdentityId}`);
      } else {
        console.log(`🔍 [Webhook] Primary_identity existente: ${primaryIdentityId}`);
      }

      // 2. Link el contact_id al primary_identity
      await identityService.linkIdentifier(
        primaryIdentityId,
        'contact_id',
        contactId,
        'webhook',
        1.0,
        { linked_from_visitor: visitorId }
      );

      // 3. Obtener TODOS los visitor_ids relacionados a este primary_identity
      const allVisitorIds = await identityService.getAllVisitorIds(primaryIdentityId);

      console.log(`🔍 [Webhook] Encontrados ${allVisitorIds.length} visitor_ids relacionados:`, allVisitorIds);

      if (allVisitorIds.length === 0) {
        console.log('⚠️ [Webhook] No hay visitor_ids en identity_graph');
        return 0;
      }

      // 4. Generar hash único para el lock basado en primary_identity_id
      const lockKey = primaryIdentityId;
      const hash = crypto.createHash('md5').update(lockKey).digest('hex');
      const lockId = parseInt(hash.substring(0, 8), 16);

      // Intentar obtener lock advisory de PostgreSQL
      const lockResult = await databasePool.query('SELECT pg_try_advisory_lock($1)', [lockId]);

      if (!lockResult.rows[0].pg_try_advisory_lock) {
        console.log('⏳ [Webhook] Lock en uso, otro proceso está vinculando. Saltando...');
        return 0;
      }

      try {
        // 5. Vincular TODAS las sesiones de TODOS los visitor_ids relacionados
        const updateQuery = `
          UPDATE tracking.sessions
          SET contact_id = $1, updated_at = NOW()
          WHERE visitor_id = ANY($2::text[])
          AND contact_id IS NULL
        `;

        const updateResult = await databasePool.query(updateQuery, [contactId, allVisitorIds]);

        console.log(`✅ [Webhook] ${updateResult.rowCount} sesiones vinculadas (de ${allVisitorIds.length} visitor_ids)`);

        // 6. Actualizar el visitor_id en el contacto si no lo tiene
        await databasePool.query(
          `UPDATE contacts
           SET visitor_id = COALESCE(visitor_id, $2), updated_at = NOW()
           WHERE contact_id = $1`,
          [contactId, visitorId]
        );

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

  // HELPER: Limpiar y validar monto - maneja strings con comas, puntos, y formatos raros
  cleanAmount(rawAmount) {
    if (!rawAmount && rawAmount !== 0) return 0;

    // Si ya es número, validar que sea positivo
    if (typeof rawAmount === 'number') {
      return Math.abs(rawAmount);
    }

    // Si es string, limpiar y convertir
    if (typeof rawAmount === 'string') {
      // Remover todo excepto dígitos y punto decimal
      let cleaned = rawAmount.replace(/[^\d.]/g, '');

      // Si tiene múltiples puntos (ej: "78.500.100"), quedarnos solo con el último
      const parts = cleaned.split('.');
      if (parts.length > 2) {
        // Caso: "78.500.100" -> "78500.100"
        cleaned = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1];
      }

      const parsed = parseFloat(cleaned);

      // Validar que sea un número válido
      if (isNaN(parsed)) {
        console.error('[Webhook] ⚠️ Monto inválido recibido:', rawAmount, '-> parseado como:', parsed);
        return 0;
      }

      console.log('[Webhook] 💰 Monto limpiado:', rawAmount, '→', parsed);
      return Math.abs(parsed);
    }

    console.error('[Webhook] ⚠️ Tipo de monto desconocido:', typeof rawAmount);
    return 0;
  }

  // Mapeo flexible para pagos - CON CUSTOM DATA
  async processPayment(data) {
    // Extraer transaction_id del customData si existe
    const transaction_id = data.customData?.transaction_id || data.transaction_id;
    const contact_id = data.contact_id;

    // Verificar campos requeridos después de intentar extraerlos
    const missingFields = [];

    if (!transaction_id) {
      missingFields.push('transaction_id (buscado en customData y nivel principal)');
    }

    if (!contact_id) {
      missingFields.push('contact_id');
    }

    if (missingFields.length > 0) {
      const error = new Error(`Campos requeridos faltantes: ${missingFields.join(', ')}`);
      error.fields = missingFields;
      throw error;
    }

    console.log('[Webhook] Procesando pago con transaction_id:', transaction_id, 'desde customData:', data.customData);

    // Extraer CustomData específico para pagos: monto, transaction_id, nota
    const customData = data.customData || {};

    // Si los datos vienen en el nivel principal, también los incluimos
    if (data.monto !== undefined) customData.monto = data.monto;
    if (data.nota !== undefined) customData.nota = data.nota;

    console.log('[Webhook] CustomData extraído para pago (RAW):', customData);

    try {
      // Buscar el contacto por ext_crm_id
      const contactQuery = `
        SELECT contact_id FROM contacts
        WHERE ext_crm_id = $1
        LIMIT 1
      `;
      const contactResult = await databasePool.query(contactQuery, [contact_id]);

      let finalContactId;

      if (contactResult.rows.length === 0) {
        // Si el contacto no existe, lo creamos con la información disponible
        console.log(`[Webhook] Contacto no encontrado para ext_crm_id: ${contact_id}, creando nuevo contacto...`);

        finalContactId = await this.generateContactId();

        const insertQuery = `
          INSERT INTO contacts (
            contact_id, first_name, last_name, email, phone,
            ext_crm_id, status, source, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
          RETURNING contact_id
        `;

        const insertResult = await databasePool.query(insertQuery, [
          finalContactId,
          data.first_name || null,
          data.last_name || null,
          data.email || null,
          data.phone || null,
          contact_id, // ext_crm_id = el contact_id del webhook
          'client', // Si está pagando, es cliente
          'webhook-payment'
        ]);

        console.log(`✅ [Webhook] Contacto creado desde pago: ${finalContactId}`);
        finalContactId = insertResult.rows[0].contact_id;
      } else {
        finalContactId = contactResult.rows[0].contact_id;
        console.log(`[Webhook] Contacto encontrado: ${finalContactId}`);
      }

      // Extraer y limpiar el monto (prioridad: data.amount > customData.monto > data.monto)
      const rawAmount = data.amount || customData.monto || data.monto;
      const cleanedAmount = this.cleanAmount(rawAmount);

      console.log('[Webhook] 💵 Procesando monto:', {
        raw: rawAmount,
        cleaned: cleanedAmount,
        source: data.amount ? 'data.amount' : (customData.monto ? 'customData.monto' : 'data.monto')
      });

      const paymentData = {
        transaction_id: transaction_id,
        amount: cleanedAmount,
        description: data.description || customData.nota || data.nota || null,
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

      console.log(`✅ [Webhook] Pago procesado con transaction_id: ${transaction_id}`);
      return result.rows[0];
    } catch (error) {
      console.error('[Webhook] Error en processPayment:', error);
      throw error;
    }
  }

  // Mapeo completo para citas - GUARDA TODOS LOS CAMPOS RELEVANTES
  async processAppointment(data) {
    // Extraer contact_id del customData si existe
    const contact_id = data.customData?.contact_id || data.contact_id;

    if (!contact_id) {
      const error = new Error(`Campo requerido faltante: contact_id (buscado en customData y nivel principal)`);
      error.fields = ['contact_id'];
      throw error;
    }

    // Extraer customData para citas
    const customData = data.customData || {};

    console.log('[Webhook] Procesando appointment para contact_id:', contact_id, 'customData:', customData);

    try {
      // Buscar el contacto por ext_crm_id, si no existe lo creamos
      let finalContactId;
      const contactQuery = `
        SELECT contact_id FROM contacts
        WHERE ext_crm_id = $1
        LIMIT 1
      `;
      const contactResult = await databasePool.query(contactQuery, [contact_id]);

      if (contactResult.rows.length === 0) {
        // Crear contacto si no existe
        console.log(`[Webhook] Contacto no existe, creando nuevo para ext_crm_id: ${contact_id}`);
        finalContactId = await this.generateContactId();

        const insertContactQuery = `
          INSERT INTO contacts (
            contact_id, first_name, last_name, email, phone,
            ext_crm_id, status, source, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
          RETURNING contact_id
        `;

        const newContactResult = await databasePool.query(insertContactQuery, [
          finalContactId,
          data.first_name || null,
          data.last_name || null,
          data.email || null,
          data.phone || null,
          contact_id, // ext_crm_id = el contact_id del webhook
          'lead',
          'webhook-appointment'
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
    // Extraer transaction_id del customData si existe
    const transaction_id = data.customData?.transaction_id || data.transaction_id;

    if (!transaction_id) {
      const error = new Error(`Campo requerido faltante: transaction_id (buscado en customData y nivel principal)`);
      error.fields = ['transaction_id'];
      throw error;
    }

    // Extraer customData para refunds
    const customData = data.customData || {};

    console.log('[Webhook] Procesando refund con transaction_id:', transaction_id, 'customData:', customData);

    try {
      // Buscar el pago original
      const paymentQuery = `
        SELECT * FROM payments
        WHERE transaction_id = $1
      `;
      const paymentResult = await databasePool.query(paymentQuery, [transaction_id]);

      if (paymentResult.rows.length === 0) {
        throw new Error(`Transacción no encontrada: ${transaction_id}`);
      }

      const originalPayment = paymentResult.rows[0];

      if (originalPayment.status === 'refunded') {
        throw new Error(`La transacción ${transaction_id} ya fue reembolsada`);
      }

      // Marcar como reembolsado
      const updateQuery = `
        UPDATE payments
        SET
          status = 'refunded',
          updated_at = NOW()
        WHERE transaction_id = $1
        RETURNING *
      `;

      const result = await databasePool.query(updateQuery, [
        transaction_id
      ]);

      console.log(`✅ [Webhook] Pago reembolsado: ${transaction_id}`);
      return result.rows[0];
    } catch (error) {
      console.error('[Webhook] Error en processRefund:', error);
      throw error;
    }
  }
}

module.exports = new WebhookService();