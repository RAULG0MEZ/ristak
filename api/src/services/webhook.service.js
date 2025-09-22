const { databasePool } = require('../config/database.config');
const contactUnificationService = require('./contact-unification.service');

class WebhookService {
  // Mapeo flexible para contactos CON UNIFICACIÓN INTELIGENTE
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

    // Preparar datos para unificación inteligente
    // EXTRAER DATOS DEL CUSTOMDATA PRIMERO, LUEGO FALLBACK A NIVEL RAÍZ
    const customData = data.customData || {};

    const contactData = {
      contact_id: data.contact_id,
      first_name: data.first_name || null,
      last_name: data.last_name || null,
      email: data.email || null,
      phone: data.phone || null,
      company: data.company || null,
      // PRIORIZAR customData, luego fallback a campos en raíz
      rstk_adid: customData.rstk_adid || data.rstk_adid || data.first_adid || null,
      rstk_source: customData.rstk_source || data.rstk_source || null,
      visitor_id: customData.rstk_vid || data.rstk_vid || null, // IMPORTANTE: Guardar el visitor_id para tracking
      ext_crm_id: data.contact_id, // Usar contact_id como ext_crm_id
      status: data.status || 'lead',
      source: data.source || 'webhook'
    };

    try {
      console.log('[Webhook] Procesando contacto con unificación inteligente:', contactData.contact_id);

      // DEBUG: Mostrar customData recibido
      if (customData && Object.keys(customData).length > 0) {
        console.log('[Webhook] CustomData recibido:', JSON.stringify(customData));
        console.log('[Webhook] rstk_adid extraído:', contactData.rstk_adid);
        console.log('[Webhook] rstk_source extraído:', contactData.rstk_source);
        console.log('[Webhook] visitor_id extraído:', contactData.visitor_id);
      }

      // NUEVO: Si viene rstk_vid, loguear para tracking
      if (contactData.visitor_id) {
        console.log('[Webhook] Visitor ID recibido (rstk_vid):', contactData.visitor_id);
      }

      // USAR SERVICIO DE UNIFICACIÓN INTELIGENTE
      // Este servicio:
      // 1. Busca duplicados por email, phone, ext_crm_id, contact_id
      // 2. Si encuentra duplicados, los unifica sin perder información
      // 3. Si no encuentra, crea uno nuevo
      const unifiedContact = await contactUnificationService.findOrCreateUnified(contactData);

      // NUEVO: Si hay rstk_vid, vincular con las sesiones de tracking
      if (contactData.visitor_id && unifiedContact.contact_id) {
        try {
          console.log(`[Webhook → Tracking] Vinculando visitor_id ${contactData.visitor_id} con contact_id ${unifiedContact.contact_id}`);

          // Actualizar TODAS las sesiones que tengan este visitor_id
          const updateResult = await databasePool.query(
            `UPDATE tracking.sessions
             SET contact_id = $1
             WHERE visitor_id = $2 AND contact_id IS NULL`,
            [unifiedContact.contact_id, contactData.visitor_id]
          );

          console.log(`[Webhook → Tracking] ${updateResult.rowCount} sesiones vinculadas al contacto`);
        } catch (trackingError) {
          // No fallar el webhook si falla el tracking
          console.error('[Webhook → Tracking] Error vinculando visitor_id:', trackingError);
        }
      }

      // NUEVO: Si hay información de calendario/cita, guardarla en tabla appointments
      if (data.calendar && data.calendar.appointmentId) {
        try {
          console.log('[Webhook → Appointments] Guardando información de cita para contacto:', unifiedContact.contact_id);

          const appointmentData = {
            ext_crm_appointment_id: data.calendar.appointmentId || data.calendar.id,
            contact_id: unifiedContact.contact_id,
            title: data.calendar.title || 'Cita sin título',
            location: data.calendar.address || '',
            start_time: data.calendar.startTime ? new Date(data.calendar.startTime).toISOString() : null,
            end_time: data.calendar.endTime ? new Date(data.calendar.endTime).toISOString() : null,
            status: data.calendar.status || data.calendar.appoinmentStatus || 'scheduled',
            calendar_name: data.calendar.calendarName || '',
            appointment_timezone: data.calendar.selectedTimezone || data.timezone || 'America/Mexico_City',
            created_at: data.calendar.date_created ? new Date(data.calendar.date_created).toISOString() : new Date().toISOString(),
            webhook_data: JSON.stringify(data.calendar) // Guardar todo el objeto calendar como JSONB
          };

          // Calcular duración en minutos si tenemos start y end
          if (appointmentData.start_time && appointmentData.end_time) {
            const start = new Date(appointmentData.start_time);
            const end = new Date(appointmentData.end_time);
            appointmentData.duration = Math.round((end - start) / (1000 * 60)); // Duración en minutos
          }

          // Insertar o actualizar la cita
          const appointmentQuery = `
            INSERT INTO appointments (
              ext_crm_appointment_id, contact_id, title, location,
              start_time, end_time, status, calendar_name,
              appointment_timezone, duration, created_at, updated_at, webhook_data
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), $12::jsonb)
            ON CONFLICT (ext_crm_appointment_id)
            DO UPDATE SET
              title = EXCLUDED.title,
              location = EXCLUDED.location,
              start_time = EXCLUDED.start_time,
              end_time = EXCLUDED.end_time,
              status = EXCLUDED.status,
              calendar_name = EXCLUDED.calendar_name,
              appointment_timezone = EXCLUDED.appointment_timezone,
              duration = EXCLUDED.duration,
              webhook_data = EXCLUDED.webhook_data,
              updated_at = NOW()
            RETURNING appointment_id
          `;

          const appointmentResult = await databasePool.query(appointmentQuery, [
            appointmentData.ext_crm_appointment_id,
            appointmentData.contact_id,
            appointmentData.title,
            appointmentData.location,
            appointmentData.start_time,
            appointmentData.end_time,
            appointmentData.status,
            appointmentData.calendar_name,
            appointmentData.appointment_timezone,
            appointmentData.duration,
            appointmentData.created_at,
            appointmentData.webhook_data
          ]);

          console.log('[Webhook → Appointments] Cita guardada/actualizada:', appointmentResult.rows[0]?.appointment_id);
        } catch (appointmentError) {
          // No fallar el webhook si falla guardar la cita
          console.error('[Webhook → Appointments] Error guardando cita:', appointmentError);
        }
      }

      console.log('[Webhook] Contacto procesado exitosamente:', unifiedContact.contact_id);

      return unifiedContact;
    } catch (error) {
      console.error('[Webhook] Error en processContact:', error);
      throw error;
    }
  }
  
  // Mapeo flexible para pagos
  async processPayment(data) {
    // EXTRAER DATOS DEL CUSTOMDATA PRIMERO para validación
    const customData = data.customData || {};

    // Campos requeridos - verificar tanto en customData como en raíz
    const requiredFields = [
      { name: 'transaction_id', getValue: () => customData.transaction_id || data.transaction_id },
      { name: 'monto', getValue: () => customData.monto || data.monto },
      { name: 'contact_id', getValue: () => customData.contact_id || data.contact_id }
    ];

    const missingFields = [];

    for (const field of requiredFields) {
      if (!field.getValue()) {
        missingFields.push(field.name);
      }
    }

    if (missingFields.length > 0) {
      const error = new Error(`Campos requeridos faltantes: ${missingFields.join(', ')}`);
      error.fields = missingFields;
      throw error;
    }

    // DEBUG: Mostrar customData recibido en pagos
    if (customData && Object.keys(customData).length > 0) {
      console.log('[Webhook Payment] CustomData recibido:', JSON.stringify(customData));
      console.log('[Webhook Payment] transaction_id extraído:', customData.transaction_id || data.transaction_id);
      console.log('[Webhook Payment] monto extraído:', customData.monto || data.monto);
      console.log('[Webhook Payment] contact_id extraído:', customData.contact_id || data.contact_id);
    }

    // NUEVO: Si viene rstk_vid, loguear para tracking
    const visitorId = customData.rstk_vid || data.rstk_vid;
    if (visitorId) {
      console.log('[Webhook Payment] Visitor ID recibido (rstk_vid):', visitorId);
    }

    // Mapear campos del webhook a campos de la BD
    // PRIORIZAR customData, luego fallback a campos en raíz
    const paymentData = {
      transaction_id: customData.transaction_id || data.transaction_id,
      amount: parseFloat(customData.monto || data.monto) || 0, // Mapear "monto" a "amount"
      description: customData.nota || data.nota || null, // Mapear "nota" a "description"
      contact_id: customData.contact_id || data.contact_id,
      currency: customData.currency || data.currency || 'MXN',
      status: 'completed',
      payment_method: customData.payment_method || data.payment_method || 'unknown',
      // Usar ISO string para garantizar UTC
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    try {
      const query = `
        INSERT INTO public.payments (
          id, transaction_id, amount, description, contact_id,
          currency, status, payment_method,
          created_at, updated_at
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

      const payment = result.rows[0];

      // NUEVO: Si hay rstk_vid, vincular con las sesiones de tracking
      if (visitorId && payment.contact_id) {
        try {
          console.log(`[Webhook Payment → Tracking] Vinculando visitor_id ${visitorId} con contact_id ${payment.contact_id}`);

          // Actualizar TODAS las sesiones que tengan este visitor_id
          const updateResult = await databasePool.query(
            `UPDATE tracking.sessions
             SET contact_id = $1,
                 orders_count = orders_count + 1,
                 revenue_value = revenue_value + $2,
                 last_order_id = $3
             WHERE visitor_id = $4`,
            [payment.contact_id, payment.amount, payment.transaction_id, visitorId]
          );

          console.log(`[Webhook Payment → Tracking] ${updateResult.rowCount} sesiones actualizadas con información de pago`);
        } catch (trackingError) {
          // No fallar el webhook si falla el tracking
          console.error('[Webhook Payment → Tracking] Error vinculando visitor_id:', trackingError);
        }
      }

      return payment;
    } catch (error) {
      console.error('[Webhook] Error en processPayment:', error);
      throw error;
    }
  }
  
  // Mapeo flexible para citas
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

    try {
      console.log('[Webhook] Procesando appointment para contact_id:', data.contact_id);

      // Primero verificar si el contacto existe usando unificación inteligente
      const contactData = {
        contact_id: data.contact_id,
        first_name: data.first_name || null,
        last_name: data.last_name || null,
        email: data.email || null,
        phone: data.phone || null,
        ext_crm_id: data.contact_id,
        status: 'appointment_scheduled',
        source: 'webhook_appointment'
      };

      const unifiedContact = await contactUnificationService.findOrCreateUnified(contactData);
      console.log('[Webhook] Contacto unificado para appointment:', unifiedContact.contact_id);

      // Crear metadata con toda la información de la cita
      const metadata = {
        appointment_id: data.appointment_id || null,
        title: data.title || 'Cita agendada',
        scheduled_at: data.scheduled_at || new Date().toISOString(),
        duration: parseInt(data.duration) || 30,
        status: data.status || 'scheduled',
        notes: data.notes || null,
        location: data.location || null,
        type: data.type || 'consultation',
        webhook_data: data // Guardar todos los datos originales del webhook
      };

      // Usar la estructura correcta según la tabla real de appointments
      const query = `
        INSERT INTO public.appointments (
          appointment_id, contact_id, title, description, location,
          appointment_date, scheduled_at, duration, status, notes,
          webhook_data, created_at, updated_at
        ) VALUES (
          gen_random_uuid()::text, $1, $2, $3, $4,
          $5, $6, $7, $8, $9,
          $10, NOW(), NOW()
        )
        ON CONFLICT (appointment_id) DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          location = EXCLUDED.location,
          appointment_date = EXCLUDED.appointment_date,
          scheduled_at = EXCLUDED.scheduled_at,
          duration = EXCLUDED.duration,
          status = EXCLUDED.status,
          notes = EXCLUDED.notes,
          webhook_data = EXCLUDED.webhook_data,
          updated_at = NOW()
        RETURNING *
      `;

      // Procesar fecha si viene en el webhook
      let appointmentDate = null;
      let scheduledAt = null;

      if (data.scheduled_at) {
        scheduledAt = new Date(data.scheduled_at).toISOString();
        appointmentDate = scheduledAt; // Usar la misma fecha para ambos campos
      } else if (data.appointment_date) {
        appointmentDate = new Date(data.appointment_date).toISOString();
        scheduledAt = appointmentDate;
      } else {
        // Si no hay fecha, usar la fecha actual en UTC
        const now = new Date().toISOString();
        appointmentDate = now;
        scheduledAt = now;
      }

      const result = await databasePool.query(query, [
        unifiedContact.contact_id, // $1 - contact_id unificado
        data.title || 'Cita agendada', // $2 - title
        data.description || null, // $3 - description
        data.location || null, // $4 - location
        appointmentDate, // $5 - appointment_date
        scheduledAt, // $6 - scheduled_at
        parseInt(data.duration) || 30, // $7 - duration
        data.status || 'scheduled', // $8 - status
        data.notes || null, // $9 - notes
        JSON.stringify(data) // $10 - webhook_data (todos los datos originales)
      ]);

      console.log('[Webhook] Appointment creado exitosamente');
      return result.rows[0];
    } catch (error) {
      console.error('[Webhook] Error en processAppointment:', error);
      throw error;
    }
  }
  
  // Mapeo flexible para reembolsos
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

    try {
      // Buscar el pago original con validación de tenant
      const paymentQuery = `
        SELECT * FROM public.payments
        WHERE transaction_id = $1
      `;

      const paymentResult = await databasePool.query(paymentQuery, [
        data.transaction_id
      ]);

      if (paymentResult.rows.length === 0) {
        throw new Error(`Transacción no encontrada: ${data.transaction_id}`);
      }

      const originalPayment = paymentResult.rows[0];

      // Verificar que el pago no esté ya reembolsado
      if (originalPayment.status === 'refunded') {
        throw new Error(`La transacción ${data.transaction_id} ya fue reembolsada`);
      }

      // Actualizar el pago para marcarlo como reembolsado con validación de tenant
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

      return result.rows[0];
    } catch (error) {
      console.error('[Webhook] Error en processRefund:', error);
      throw error;
    }
  }
}

module.exports = new WebhookService();
