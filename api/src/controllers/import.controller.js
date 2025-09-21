const { databasePool } = require('../config/database.config');
const crypto = require('crypto');

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

// Importar contactos
async function importContacts(req, res) {
  try {
    const { data, timezone } = req.body; // Recibir timezone usado en importación (solo para referencia)
    
    
    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ 
        error: 'Datos inválidos',
        message: 'Se esperaba un array de contactos' 
      });
    }

    let processed = 0;
    let errors = [];
    
    for (const contact of data) {
      try {
        // Validar campo obligatorio
        if (!contact.contactId) {
          errors.push({ 
            contact, 
            error: 'ID de contacto (CRM externo) es obligatorio' 
          });
          continue;
        }
        
        // Verificar si ya existe un contacto con este ext_crm_id
        const existingContact = await databasePool.query(
          'SELECT contact_id FROM contacts WHERE ext_crm_id = $1',
          [contact.contactId]
        );
        
        let contactInternalId;
        
        if (existingContact.rows.length > 0) {
          // Si existe, usar su ID interno y actualizar
          contactInternalId = existingContact.rows[0].contact_id;
          const updateQuery = `
            UPDATE contacts SET
              email = $1,
              first_name = $2,
              last_name = $3,
              phone = $4,
              company = $5,
              rstk_adid = $6,
              source = $7,
              rstk_source = $8,
              updated_at = NOW()
            WHERE contact_id = $9
          `;
          
          try {
            const result = await databasePool.query(updateQuery, [
              contact.email || null,
              contact.firstName && contact.firstName.trim() !== '' ? contact.firstName : 'Unknown',
              contact.lastName && contact.lastName.trim() !== '' ? contact.lastName : '',
              contact.phone || '',
              contact.company || '',
              contact.attributionId || null,
              'csv_import',
              contact.rstkSource || null,
              contactInternalId
            ]);
          } catch (dbError) {
            throw dbError;
          }
        } else {
          // Si no existe, generar nuevo ID interno y crear
          contactInternalId = await generateContactId();
          const insertQuery = `
            INSERT INTO contacts (
              contact_id, ext_crm_id, email, first_name, last_name, phone, company,
              status, rstk_adid, source, rstk_source, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
          `;
          
          // Para contactos, la fecha de creación es obligatoria
          if (!contact.createdAt || contact.createdAt === null || contact.createdAt === '') {
            errors.push({ 
              contact, 
              error: 'Fecha de creación es obligatoria para importar contactos' 
            });
            continue;
          }
          
          // Validar y procesar la fecha
          let createdDate;
          const dateValue = contact.createdAt;
          if (typeof dateValue === 'string' && dateValue.includes('T')) {
            createdDate = dateValue;
          } else {
            const parsedDate = new Date(dateValue);
            if (!isNaN(parsedDate.getTime())) {
              createdDate = parsedDate.toISOString();
            } else {
              errors.push({ 
                contact, 
                error: `Fecha de creación inválida: ${dateValue}` 
              });
              continue;
            }
          }
          
          
          try {
            const result = await databasePool.query(insertQuery, [
              contactInternalId,
              contact.contactId, // Este es el ID del CRM externo
              contact.email || null,
              contact.firstName && contact.firstName.trim() !== '' ? contact.firstName : 'Unknown',
              contact.lastName && contact.lastName.trim() !== '' ? contact.lastName : '',
              contact.phone || '',
              contact.company || '',
              'lead',
              contact.attributionId || null,
              'csv_import',
              contact.rstkSource || null,
              createdDate
            ]);
          } catch (dbError) {
            throw dbError;
          }
        }
        
        processed++;
      } catch (error) {
        errors.push({ 
          contact, 
          error: error.message 
        });
      }
    }

    
    res.json({
      success: true,
      message: `Importación completada: ${processed} contactos procesados`,
      processed,
      total: data.length,
      errors: errors.slice(0, 10) // Solo primeros 10 errores
    });

  } catch (error) {
    res.status(500).json({ 
      error: 'Error en importación',
      message: error.message 
    });
  }
}

// Importar pagos
async function importPayments(req, res) {
  try {
    const { data } = req.body;
    
    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ 
        error: 'Datos inválidos',
        message: 'Se esperaba un array de pagos' 
      });
    }

    let processed = 0;
    let errors = [];
    let newContacts = 0;
    
    for (const payment of data) {
      try {
        // Validar campo obligatorio
        if (!payment.contactId) {
          errors.push({ 
            payment, 
            error: 'ID de contacto (CRM externo) es obligatorio' 
          });
          continue;
        }

        // Verificar si existe el contacto por ext_crm_id
        const checkContact = await databasePool.query(
          'SELECT contact_id FROM contacts WHERE ext_crm_id = $1',
          [payment.contactId]
        );
        
        let contactInternalId;

        if (checkContact.rows.length === 0) {
          // Si no existe, crear nuevo contacto con ID interno
          contactInternalId = await generateContactId();
          
          // Validar y procesar fecha del pago
          let paymentDate;
          if (payment.paymentDate) {
            const dateValue = payment.paymentDate;
            if (typeof dateValue === 'string' && dateValue.includes('T')) {
              paymentDate = dateValue;
            } else {
              const parsedDate = new Date(dateValue);
              if (!isNaN(parsedDate.getTime())) {
                paymentDate = parsedDate.toISOString();
              } else {
                paymentDate = new Date().toISOString();
              }
            }
          } else {
            paymentDate = new Date().toISOString();
          }
          
          await databasePool.query(
            `INSERT INTO contacts (
              contact_id, ext_crm_id, email, first_name, last_name, phone, 
              status, source, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
            [
              contactInternalId,
              payment.contactId, // ID del CRM externo
              payment.email || null,
              payment.firstName && payment.firstName.trim() !== '' ? payment.firstName : 'Unknown',
              payment.lastName && payment.lastName.trim() !== '' ? payment.lastName : '',
              payment.phone || '',
              'customer',
              'payment_import',
              paymentDate
            ]
          );
          newContacts++;
        } else {
          // Si existe, usar su ID interno
          contactInternalId = checkContact.rows[0].contact_id;
        }

        // Generar ID de transacción único
        const transactionId = payment.transactionId || generateTransactionId(
          contactInternalId, // Usar ID interno, no ID del CRM externo
          payment.amount || 0,
          payment.paymentDate || new Date().toISOString(),
          payment.invoiceNumber
        );

        // Validar y procesar fecha del pago para la inserción
        let paymentDateForInsert;
        if (payment.paymentDate) {
          const dateValue = payment.paymentDate;
          if (typeof dateValue === 'string' && dateValue.includes('T')) {
            paymentDateForInsert = dateValue;
          } else {
            const parsedDate = new Date(dateValue);
            if (!isNaN(parsedDate.getTime())) {
              paymentDateForInsert = parsedDate.toISOString();
            } else {
              paymentDateForInsert = new Date().toISOString();
            }
          }
        } else {
          paymentDateForInsert = new Date().toISOString();
        }
        
        // Upsert del pago con ext_crm_id
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
            contactInternalId,  // $3 - contact_id (ID interno para la relación)
            payment.contactId,  // $4 - ext_crm_id (ID del CRM externo)
            payment.amount || 0,  // $5 - amount
            payment.currency || 'MXN',  // $6 - currency
            payment.paymentMethod || 'unknown',  // $7 - payment_method
            payment.description || '',  // $8 - description
            payment.invoiceNumber || null,  // $9 - invoice_number
            paymentDateForInsert  // $10 - created_at
          ]
        );
        
        processed++;
      } catch (error) {
        errors.push({ 
          payment, 
          error: error.message 
        });
      }
    }

    res.json({
      success: true,
      message: `Importación completada: ${processed} pagos procesados, ${newContacts} nuevos contactos creados`,
      processed,
      newContacts,
      total: data.length,
      errors: errors.slice(0, 10)
    });

  } catch (error) {
    res.status(500).json({ 
      error: 'Error en importación',
      message: error.message 
    });
  }
}

// Importar citas
async function importAppointments(req, res) {
  try {
    const { data } = req.body;

    // DEBUG: Ver exactamente qué datos llegan
    console.log('[Import Appointments] Datos recibidos:', JSON.stringify(req.body, null, 2));
    console.log('[Import Appointments] Total registros:', data ? data.length : 0);

    if (!data || !Array.isArray(data)) {
      return res.status(400).json({
        error: 'Datos inválidos',
        message: 'Se esperaba un array de citas'
      });
    }

    let processed = 0;
    let errors = [];
    let newContacts = 0;
    let newAppointments = 0;
    
    for (const appointment of data) {
      try {
        // Validar campo obligatorio
        if (!appointment.contactId) {
          errors.push({ 
            appointment, 
            error: 'ID de contacto (CRM externo) es obligatorio' 
          });
          continue;
        }

        // Verificar si existe el contacto por ext_crm_id
        const checkContact = await databasePool.query(
          'SELECT contact_id FROM contacts WHERE ext_crm_id = $1',
          [appointment.contactId]
        );
        
        let contactInternalId;

        if (checkContact.rows.length === 0) {
          // Si el contacto no existe, crear con ID interno nuevo
          contactInternalId = await generateContactId();
          
          // Debugging: verificar los datos que llegan
          console.log('Creando contacto desde cita:', {
            contactId: appointment.contactId,
            firstName: appointment.firstName,
            lastName: appointment.lastName,
            email: appointment.email,
            phone: appointment.phone
          });
          
          await databasePool.query(
            `INSERT INTO contacts (
              contact_id, ext_crm_id, email, first_name, last_name, phone, 
              status, source, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
            [
              contactInternalId,
              appointment.contactId, // ID del CRM externo
              appointment.email || null,
              appointment.firstName && appointment.firstName.trim() !== '' ? appointment.firstName : 'Unknown',
              appointment.lastName && appointment.lastName.trim() !== '' ? appointment.lastName : '',
              appointment.phone || '',
              'appointment_scheduled',
              'appointment_import'
            ]
          );
          newContacts++;
        } else {
          // Si el contacto existe, usar su ID interno y actualizar datos
          contactInternalId = checkContact.rows[0].contact_id;
          
          // Actualizar el contacto con los datos del CSV (si vienen)
          // Solo actualiza campos que vienen con datos, no sobrescribe con vacíos
          const updateFields = [];
          const updateValues = [];
          let paramCount = 1;
          
          // Siempre actualizar status
          updateFields.push(`status = $${paramCount}`);
          updateValues.push('appointment_scheduled');
          paramCount++;
          
          // Actualizar email si viene y no está vacío
          if (appointment.email && appointment.email.trim() !== '') {
            updateFields.push(`email = $${paramCount}`);
            updateValues.push(appointment.email);
            paramCount++;
          }
          
          // Actualizar nombre si viene y no está vacío
          if (appointment.firstName && appointment.firstName.trim() !== '') {
            updateFields.push(`first_name = $${paramCount}`);
            updateValues.push(appointment.firstName);
            paramCount++;
          }
          
          // Actualizar apellido si viene y no está vacío
          if (appointment.lastName && appointment.lastName.trim() !== '') {
            updateFields.push(`last_name = $${paramCount}`);
            updateValues.push(appointment.lastName);
            paramCount++;
          }
          
          // Actualizar teléfono si viene y no está vacío
          if (appointment.phone && appointment.phone.trim() !== '') {
            updateFields.push(`phone = $${paramCount}`);
            updateValues.push(appointment.phone);
            paramCount++;
          }
          
          // Siempre actualizar updated_at
          updateFields.push('updated_at = NOW()');
          
          // Agregar el contact_id al final para el WHERE
          updateValues.push(contactInternalId);
          
          const updateQuery = `
            UPDATE contacts SET 
              ${updateFields.join(', ')}
            WHERE contact_id = $${paramCount}
          `;
          
          await databasePool.query(updateQuery, updateValues);
          
          console.log('Contacto existente actualizado:', {
            contactId: appointment.contactId,
            internalId: contactInternalId,
            fieldsUpdated: updateFields.length - 1 // -1 por updated_at
          });
        }
        
        // Siempre crear registro de appointment con la estructura correcta
        try {
          // Procesar fecha y hora de la cita
          let appointmentDate = null;
          let scheduledAt = null;

          if (appointment.appointmentDate) {
            const dateValue = appointment.appointmentDate;
            if (typeof dateValue === 'string' && dateValue.includes('T')) {
              appointmentDate = new Date(dateValue);
            } else {
              appointmentDate = new Date(dateValue);
            }

            // Si hay hora separada, combinarla con la fecha
            if (appointment.appointmentTime) {
              const timeParts = appointment.appointmentTime.split(':');
              if (timeParts.length >= 2) {
                appointmentDate.setHours(parseInt(timeParts[0]), parseInt(timeParts[1]));
              }
            }
            // Convertir a UTC después de procesar todo
            appointmentDate = appointmentDate.toISOString();
            scheduledAt = appointmentDate;
          } else {
            // Si no hay fecha, usar la fecha actual en UTC
            const now = new Date().toISOString();
            appointmentDate = now;
            scheduledAt = now;
          }

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
            ON CONFLICT (appointment_id) DO NOTHING
            RETURNING appointment_id`;

          const appointmentResult = await databasePool.query(appointmentQuery, [
            contactInternalId, // $1 - contact_id interno
            'Cita importada desde CSV', // $2 - title
            null, // $3 - description
            appointment.location || null, // $4 - location
            appointmentDate, // $5 - appointment_date
            scheduledAt, // $6 - scheduled_at
            parseInt(appointment.duration) || 30, // $7 - duration
            appointment.status || 'scheduled', // $8 - status
            appointment.notes || null, // $9 - notes
            JSON.stringify({ // $10 - webhook_data
              ext_crm_id: appointment.contactId,
              original_data: appointment,
              imported_at: new Date().toISOString(),
              source: 'csv_import'
            })
          ]);

          if (appointmentResult.rows.length > 0) {
            newAppointments++;
            console.log('Appointment creado con ID:', appointmentResult.rows[0].appointment_id);
          }
        } catch (appError) {
          console.error('Error creando appointment:', appError.message);
          // No lanzar error, solo registrar y continuar
        }
        
        processed++;
      } catch (error) {
        errors.push({ 
          appointment, 
          error: error.message 
        });
      }
    }

    res.json({
      success: true,
      message: `Importación completada: ${processed} citas procesadas${newContacts > 0 ? `, ${newContacts} nuevos contactos` : ''}${newAppointments > 0 ? `, ${newAppointments} appointments creados` : ''}`,
      processed,
      newContacts,
      newAppointments,
      total: data.length,
      errors: errors.slice(0, 10)
    });

  } catch (error) {
    res.status(500).json({ 
      error: 'Error en importación',
      message: error.message 
    });
  }
}

module.exports = {
  importContacts,
  importPayments,
  importAppointments
};
