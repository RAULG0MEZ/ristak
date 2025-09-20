const { databasePool } = require('../config/database.config');
const crypto = require('crypto');

// Store para jobs en memoria (en producción usar Redis)
const importJobs = new Map();

// Generar ID único para jobs
function generateJobId() {
  return crypto.randomBytes(16).toString('hex');
}

// Generar ID único para transacciones
function generateTransactionId(contactId, amount, date, invoice) {
  const data = `${contactId}-${amount}-${date}-${invoice || ''}`;
  return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
}

// Generar ID único para contactos con formato cntct_[random]
async function generateContactId() {
  // Generar ID aleatorio seguro
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let randomId = '';
  
  // Generar 16 caracteres aleatorios
  const randomBytes = crypto.randomBytes(16);
  for (let i = 0; i < 16; i++) {
    randomId += characters[randomBytes[i] % characters.length];
  }
  
  const contactId = `cntct_${randomId}`;
  
  // Verificar que no exista (muy improbable con 16 caracteres aleatorios)
  try {
    const existing = await databasePool.query(
      'SELECT contact_id FROM contacts WHERE contact_id = $1',
      [contactId]
    );
    
    if (existing.rows.length > 0) {
      // Si por alguna razón existe, intentar de nuevo recursivamente
      return generateContactId();
    }
  } catch (error) {
    // En caso de error de DB, continuar con el ID generado
  }
  
  return contactId;
}

// Procesar importación en chunks
async function processChunk(chunk, type, jobId) {
  const job = importJobs.get(jobId);
  if (!job) return;

  let processed = 0;
  let successful = 0;
  let failed = 0;

  for (const item of chunk) {
    try {
      if (type === 'contacts') {
        await processContact(item);
      } else if (type === 'payments') {
        await processPayment(item);
      } else if (type === 'appointments') {
        await processAppointment(item);
      }
      successful++;
      job.successful = (job.successful || 0) + 1;
    } catch (error) {
      failed++;
      job.failed = (job.failed || 0) + 1;
      if (!job.errors) job.errors = [];
      job.errors.push({ item, error: error.message });
    }

    processed++;
    job.processed += 1;

    // Actualizar cada 10 registros
    if (processed % 10 === 0) {
      job.updatedAt = new Date().toISOString();
    }
  }
}

async function processContact(contact) {
  if (!contact.contactId) {
    throw new Error('ID de contacto (CRM externo) es obligatorio');
  }
  
  if (!contact.createdAt || contact.createdAt === null || contact.createdAt === '') {
    throw new Error('Fecha de creación es obligatoria para importar contactos');
  }

  // Verificar si ya existe un contacto con este ext_crm_id
  const existingContact = await databasePool.query(
    'SELECT contact_id FROM contacts WHERE ext_crm_id = $1',
    [contact.contactId]
  );
  
  if (existingContact.rows.length > 0) {
    // Si existe, actualizar
    const updateQuery = `
      UPDATE contacts SET
        email = $1,
        first_name = $2,
        last_name = $3,
        phone = $4,
        company = $5,
        attribution_ad_id = $6,
        source = $7,
        updated_at = NOW()
      WHERE ext_crm_id = $8
    `;
    
    await databasePool.query(updateQuery, [
      contact.email || null,
      contact.firstName || 'Unknown',
      contact.lastName || '',
      contact.phone || '',
      contact.company || '',
      contact.attributionId || null,
      'csv_import',
      contact.contactId
    ]);
  } else {
    // Si no existe, generar ID interno y crear
    const contactInternalId = await generateContactId();
    
    const insertQuery = `
      INSERT INTO contacts (
        contact_id, ext_crm_id, email, first_name, last_name, phone, company, 
        status, attribution_ad_id, source, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
    `;
    
    await databasePool.query(insertQuery, [
      contactInternalId,
      contact.contactId, // Este va a ext_crm_id
      contact.email || null,
      contact.firstName || 'Unknown',
      contact.lastName || '',
      contact.phone || '',
      contact.company || '',
      'lead',
      contact.attributionId || null,
      'csv_import',
      new Date(contact.createdAt) // Siempre debe tener fecha porque ya la validamos
    ]);
  }
}

async function processPayment(payment) {
  if (!payment.contactId) {
    throw new Error('ID de contacto es obligatorio');
  }

  // Buscar contacto por ID del CRM externo en columna ext_crm_id
  const checkContact = await databasePool.query(
    'SELECT contact_id FROM contacts WHERE ext_crm_id = $1',
    [payment.contactId]
  );

  let contactInternalId;
  if (checkContact.rows.length === 0) {
    // Crear nuevo contacto con ID interno y almacenar CRM externo en ext_crm_id
    contactInternalId = await generateContactId();
    const createdAt = payment.paymentDate
      ? (typeof payment.paymentDate === 'string' && payment.paymentDate.includes('T')
          ? payment.paymentDate
          : new Date(payment.paymentDate).toISOString())
      : new Date().toISOString();

    await databasePool.query(
      `INSERT INTO contacts (
        contact_id, ext_crm_id, email, first_name, last_name, phone, 
        status, source, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [
        contactInternalId,
        payment.contactId,
        payment.email || null,
        payment.firstName || 'Unknown',
        payment.lastName || '',
        payment.phone || '',
        'customer',
        'payment_import',
        createdAt
      ]
    );
  } else {
    contactInternalId = checkContact.rows[0].contact_id;
  }

  // Generar ID de transacción único
  const transactionId = payment.transactionId || generateTransactionId(
    contactInternalId,
    payment.amount || 0,
    payment.paymentDate || new Date().toISOString(),
    payment.invoiceNumber
  );

  // Insertar pago con ext_crm_id
  await databasePool.query(
    `INSERT INTO payments (
      id, transaction_id, contact_id, ext_crm_id, amount, currency, payment_method, 
      description, invoice_number, status, created_at, paid_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'completed', $10, $10, NOW())
    ON CONFLICT (id) DO UPDATE SET
      contact_id = EXCLUDED.contact_id,
      ext_crm_id = EXCLUDED.ext_crm_id,
      amount = EXCLUDED.amount,
      currency = EXCLUDED.currency,
      payment_method = EXCLUDED.payment_method,
      description = EXCLUDED.description,
      invoice_number = EXCLUDED.invoice_number,
      paid_at = EXCLUDED.paid_at,
      updated_at = NOW()`,
    [
      transactionId,      // $1 - id
      transactionId,      // $2 - transaction_id
      contactInternalId,  // $3 - contact_id
      payment.contactId,  // $4 - ext_crm_id del pago
      payment.amount || 0,  // $5 - amount
      payment.currency || 'MXN',  // $6 - currency
      payment.paymentMethod || 'unknown',  // $7 - payment_method
      payment.description || '',  // $8 - description
      payment.invoiceNumber || null,  // $9 - invoice_number
      payment.paymentDate ? new Date(payment.paymentDate).toISOString() : new Date().toISOString()  // $10 - created_at
    ]
  );
}

async function processAppointment(appointment) {
  if (!appointment.contactId) {
    throw new Error('ID de contacto es obligatorio');
  }

  try {
    // Buscar por ID del CRM externo
    const checkContact = await databasePool.query(
      'SELECT contact_id FROM contacts WHERE ext_crm_id = $1',
      [appointment.contactId]
    );

    let contactInternalId;
    if (checkContact.rows.length === 0) {
      // Crear contacto si no existe
      contactInternalId = await generateContactId();

      await databasePool.query(
        `INSERT INTO contacts (
          contact_id, ext_crm_id, email, first_name, last_name, phone,
          status, source, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
        [
          contactInternalId,
          appointment.contactId,
          appointment.email || null,
          appointment.firstName || 'Unknown',
          appointment.lastName || '',
          appointment.phone || '',
          'appointment_scheduled',
          'appointment_import'
        ]
      );
    } else {
      contactInternalId = checkContact.rows[0].contact_id;
      await databasePool.query(
        `UPDATE contacts SET
          status = $1,
          updated_at = NOW()
        WHERE contact_id = $2`,
        [
          'appointment_scheduled',
          contactInternalId
        ]
      );
    }

    // Crear appointment con estructura correcta
    const appointmentQuery = `
      INSERT INTO appointments (
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
      RETURNING appointment_id
    `;

    // Preparar fechas - si no vienen, usar fecha actual en UTC
    const now = new Date().toISOString();
    const appointmentDate = appointment.appointmentDate ? new Date(appointment.appointmentDate).toISOString() : now;
    const scheduledAt = appointment.scheduledAt ? new Date(appointment.scheduledAt).toISOString() : appointmentDate;

    const result = await databasePool.query(appointmentQuery, [
      contactInternalId, // $1 - contact_id
      appointment.title || 'Cita importada', // $2 - title
      appointment.description || null, // $3 - description
      appointment.location || null, // $4 - location
      appointmentDate, // $5 - appointment_date
      scheduledAt, // $6 - scheduled_at
      parseInt(appointment.duration) || 30, // $7 - duration
      appointment.status || 'scheduled', // $8 - status
      appointment.notes || null, // $9 - notes
      JSON.stringify(appointment) // $10 - webhook_data (todos los datos originales)
    ]);

  } catch (error) {
    throw error;
  }
}

// Iniciar importación asíncrona
async function startImport(req, res) {
  try {
    const { data, type, timezone } = req.body;
    
    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ 
        error: 'Datos inválidos',
        message: 'Se esperaba un array de datos' 
      });
    }

    if (!['contacts', 'payments', 'appointments'].includes(type)) {
      return res.status(400).json({ 
        error: 'Tipo inválido',
        message: 'El tipo debe ser: contacts, payments o appointments' 
      });
    }

    // Crear job
    const jobId = generateJobId();
    const job = {
      id: jobId,
      type,
      timezone, // Guardar timezone usado en la importación (solo para referencia/auditoría)
      status: 'processing',
      total: data.length,
      processed: 0,
      successful: 0,
      failed: 0,
      errors: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    importJobs.set(jobId, job);

    // Procesar en background
    const CHUNK_SIZE = 100;
    
    (async () => {
      try {
        for (let i = 0; i < data.length; i += CHUNK_SIZE) {
          const chunk = data.slice(i, i + CHUNK_SIZE);
          await processChunk(chunk, type, jobId);
          
          // Pequeña pausa entre chunks para no saturar
          if (i + CHUNK_SIZE < data.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
        
        job.status = 'completed';
        job.completedAt = new Date().toISOString();
      } catch (error) {
        job.status = 'failed';
        job.error = error.message;
      }
      
      job.updatedAt = new Date().toISOString();
      
      // Limpiar jobs completados después de 10 segundos
      setTimeout(() => {
        importJobs.delete(jobId);
      }, 10000);
    })();

    // Responder inmediatamente con el job ID
    res.json({
      success: true,
      jobId,
      message: `Importación iniciada. Total de registros: ${data.length}`,
      status: job.status,
      total: job.total
    });

  } catch (error) {
    res.status(500).json({ 
      error: 'Error iniciando importación',
      message: error.message 
    });
  }
}

// Obtener estado del job
async function getJobStatus(req, res) {
  try {
    const { jobId } = req.params;
    
    const job = importJobs.get(jobId);
    
    if (!job) {
      return res.status(404).json({ 
        error: 'Job no encontrado',
        message: 'El job no existe o ya fue completado hace más de 1 hora' 
      });
    }

    res.json({
      id: job.id,
      type: job.type,
      status: job.status,
      total: job.total,
      processed: job.processed,
      successful: job.successful,
      failed: job.failed,
      progress: job.total > 0 ? Math.round((job.processed / job.total) * 100) : 0,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      completedAt: job.completedAt,
      errors: job.errors ? job.errors.slice(0, 10) : [] // Solo primeros 10 errores
    });

  } catch (error) {
    res.status(500).json({ 
      error: 'Error obteniendo estado',
      message: error.message 
    });
  }
}

// Obtener todos los jobs activos
async function getActiveJobs(req, res) {
  try {
    // Filtrar solo jobs en progreso (no completados)
    const jobs = Array.from(importJobs.values())
      .filter(job => job.status === 'processing')
      .map(job => ({
      id: job.id,
      type: job.type,
      status: job.status,
      total: job.total,
      processed: job.processed,
      progress: job.total > 0 ? Math.round((job.processed / job.total) * 100) : 0,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt
    }));

    res.json(jobs);

  } catch (error) {
    res.status(500).json({ 
      error: 'Error obteniendo jobs',
      message: error.message 
    });
  }
}

module.exports = {
  startImport,
  getJobStatus,
  getActiveJobs
};
