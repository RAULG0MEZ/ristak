const { databasePool } = require('../config/database.config');
const crypto = require('crypto');

class ContactUnificationService {
  /**
   * SERVICIO INTELIGENTE DE UNIFICACIÓN DE CONTACTOS
   *
   * Este servicio se encarga de:
   * 1. Buscar contactos duplicados por múltiples criterios
   * 2. Unificar información de manera inteligente (sin perder datos)
   * 3. Mantener un solo contacto maestro con toda la info
   * 4. Actualizar referencias en todas las tablas relacionadas
   */

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

  /**
   * FUNCIÓN PRINCIPAL: Buscar o crear contacto de manera inteligente
   * Busca duplicados por múltiples criterios y unifica la información
   */
  async findOrCreateUnified(data) {
    const client = await databasePool.connect();

    try {
      await client.query('BEGIN');

      // 1. BUSCAR TODOS LOS POSIBLES DUPLICADOS
      const duplicates = await this.findPotentialDuplicates(client, data);

      console.log(`[Unificación] Encontrados ${duplicates.length} posibles duplicados para:`, {
        email: data.email,
        phone: data.phone,
        ext_crm_id: data.ext_crm_id || data.ghl_contact_id
      });

      let masterContact = null;

      if (duplicates.length > 0) {
        // 2. SI HAY DUPLICADOS, UNIFICARLOS
        masterContact = await this.unifyContacts(client, duplicates, data);
        console.log(`[Unificación] Contacto maestro unificado: ${masterContact.contact_id}`);
      } else {
        // 3. SI NO HAY DUPLICADOS, CREAR NUEVO
        masterContact = await this.createNewContact(client, data);
        console.log(`[Unificación] Nuevo contacto creado: ${masterContact.contact_id}`);
      }

      await client.query('COMMIT');
      return masterContact;

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[Unificación] Error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Buscar todos los posibles duplicados por múltiples criterios
   */
  async findPotentialDuplicates(client, data) {
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    // Buscar por ext_crm_id (más confiable)
    if (data.ext_crm_id || data.ghl_contact_id) {
      conditions.push(`ext_crm_id = $${paramIndex}`);
      params.push(data.ext_crm_id || data.ghl_contact_id);
      paramIndex++;
    }

    // Buscar por contact_id directo (si viene de webhook)
    if (data.contact_id) {
      conditions.push(`contact_id = $${paramIndex}`);
      params.push(data.contact_id);
      paramIndex++;
    }

    // Buscar por email (normalizado)
    if (data.email) {
      const normalizedEmail = data.email.toLowerCase().trim();
      conditions.push(`LOWER(TRIM(email)) = $${paramIndex}`);
      params.push(normalizedEmail);
      paramIndex++;
    }

    // Buscar por teléfono (normalizado - solo dígitos)
    if (data.phone) {
      const normalizedPhone = data.phone.replace(/\D/g, '');
      if (normalizedPhone.length >= 10) {
        // Buscar por últimos 10 dígitos (sin código de país)
        conditions.push(`REGEXP_REPLACE(phone, '[^0-9]', '', 'g') LIKE $${paramIndex}`);
        params.push(`%${normalizedPhone.slice(-10)}`);
        paramIndex++;
      }
    }

    if (conditions.length === 0) {
      return [];
    }

    const query = `
      SELECT *
      FROM contacts
      WHERE ${conditions.join(' OR ')}
      ORDER BY created_at ASC
    `;

    const result = await client.query(query, params);
    return result.rows;
  }

  /**
   * Unificar múltiples contactos en uno solo
   * REGLA: Nunca perder información, siempre agregar o mejorar
   */
  async unifyContacts(client, duplicates, newData) {
    // 1. ELEGIR EL CONTACTO MAESTRO (el más antiguo o el que tiene más info)
    const master = this.selectMasterContact(duplicates);

    // 2. COMBINAR TODA LA INFORMACIÓN
    const unifiedData = this.mergeContactData(master, duplicates, newData);

    // 3. ACTUALIZAR EL CONTACTO MAESTRO
    const updateQuery = `
      UPDATE contacts SET
        first_name = $2,
        last_name = $3,
        email = $4,
        phone = $5,
        company = $6,
        rstk_adid = $7,
        ext_crm_id = $8,
        source = $9,
        status = $10,
        rstk_source = $11,
        visitor_id = COALESCE($12, visitor_id),
        updated_at = NOW()
      WHERE contact_id = $1
      RETURNING *
    `;

    const result = await client.query(updateQuery, [
      master.contact_id,
      unifiedData.first_name,
      unifiedData.last_name,
      unifiedData.email,
      unifiedData.phone,
      unifiedData.company,
      unifiedData.rstk_adid || unifiedData.rstk_adid, // Compatibilidad temporal
      unifiedData.ext_crm_id,
      unifiedData.source,
      unifiedData.status,
      unifiedData.rstk_source,
      unifiedData.visitor_id || unifiedData.rstk_vid  // IMPORTANTE: Actualizar visitor_id si viene nuevo
    ]);

    const updatedMaster = result.rows[0];

    // 4. MIGRAR REFERENCIAS DE DUPLICADOS AL MAESTRO
    const duplicateIds = duplicates
      .filter(d => d.contact_id !== master.contact_id)
      .map(d => d.contact_id);

    if (duplicateIds.length > 0) {
      await this.migrateReferences(client, duplicateIds, master.contact_id);

      // 5. ELIMINAR DUPLICADOS
      await client.query(
        'DELETE FROM contacts WHERE contact_id = ANY($1::text[])',
        [duplicateIds]
      );

      console.log(`[Unificación] Eliminados ${duplicateIds.length} duplicados:`, duplicateIds);
    }

    return updatedMaster;
  }

  /**
   * Seleccionar el contacto maestro (el mejor candidato)
   * Prioridades:
   * 1. El que tiene más información completa
   * 2. El que tiene pagos asociados
   * 3. El más antiguo
   */
  selectMasterContact(duplicates) {
    return duplicates.sort((a, b) => {
      // Calcular score de completitud
      const scoreA = this.calculateCompleteness(a);
      const scoreB = this.calculateCompleteness(b);

      if (scoreA !== scoreB) {
        return scoreB - scoreA; // Mayor score primero
      }

      // Si tienen el mismo score, el más antiguo
      return new Date(a.created_at) - new Date(b.created_at);
    })[0];
  }

  /**
   * Calcular qué tan completo está un contacto
   */
  calculateCompleteness(contact) {
    let score = 0;

    // Campos básicos
    if (contact.first_name) score += 2;
    if (contact.last_name) score += 2;
    if (contact.email) score += 3;
    if (contact.phone) score += 3;
    if (contact.company) score += 1;

    // Campos de tracking/attribution
    if (contact.rstk_adid) score += 2;
    if (contact.ext_crm_id) score += 5; // Muy importante

    // Estado del cliente
    if (contact.status === 'client') score += 10; // Ya es cliente

    return score;
  }

  /**
   * Combinar datos de múltiples contactos de manera inteligente
   * REGLA: Nunca sobrescribir con vacío, siempre mantener la mejor info
   */
  mergeContactData(master, duplicates, newData) {
    const merged = { ...master };

    // Agregar datos de todos los duplicados
    for (const dup of duplicates) {
      merged.first_name = this.pickBest(merged.first_name, dup.first_name);
      merged.last_name = this.pickBest(merged.last_name, dup.last_name);
      merged.email = this.pickBest(merged.email, dup.email);
      merged.phone = this.pickBest(merged.phone, dup.phone);
      merged.company = this.pickBest(merged.company, dup.company);
      merged.rstk_adid = this.pickBest(merged.rstk_adid, dup.rstk_adid);
      merged.ext_crm_id = this.pickBest(merged.ext_crm_id, dup.ext_crm_id);
      merged.source = this.pickBest(merged.source, dup.source);
      merged.rstk_source = this.pickBest(merged.rstk_source, dup.rstk_source);
      merged.visitor_id = this.pickBest(merged.visitor_id, dup.visitor_id);

      // Status: priorizar 'client' > 'appointment' > 'lead'
      merged.status = this.pickBestStatus(merged.status, dup.status);
    }

    // Agregar datos nuevos (los más recientes)
    if (newData) {
      merged.first_name = this.pickBest(merged.first_name, newData.first_name || newData.firstName);
      merged.last_name = this.pickBest(merged.last_name, newData.last_name || newData.lastName);
      merged.email = this.pickBest(merged.email, newData.email);
      merged.phone = this.pickBest(merged.phone, newData.phone);
      merged.company = this.pickBest(merged.company, newData.company);
      merged.rstk_adid = this.pickBest(merged.rstk_adid,
        newData.rstk_adid || newData.first_adid || newData.ad_id);
      merged.ext_crm_id = this.pickBest(merged.ext_crm_id,
        newData.ext_crm_id || newData.ghl_contact_id);
      merged.source = this.pickBest(merged.source, newData.source);
      merged.rstk_source = this.pickBest(merged.rstk_source, newData.rstk_source);
      merged.visitor_id = this.pickBest(merged.visitor_id, newData.visitor_id || newData.rstk_vid);
      merged.status = this.pickBestStatus(merged.status, newData.status);
    }

    return merged;
  }

  /**
   * Elegir el mejor valor entre dos opciones
   * REGLA: Preferir no-vacío sobre vacío, más largo sobre más corto
   */
  pickBest(current, newValue) {
    // Si el nuevo es null/undefined/vacío, mantener el actual
    if (!newValue || newValue === '') return current;

    // Si el actual es null/undefined/vacío, usar el nuevo
    if (!current || current === '') return newValue;

    // Si ambos tienen valor, preferir el más largo/completo
    if (String(newValue).length > String(current).length) {
      return newValue;
    }

    return current;
  }

  /**
   * Elegir el mejor status (jerarquía)
   */
  pickBestStatus(current, newStatus) {
    const hierarchy = {
      'client': 3,
      'appointment': 2,
      'lead': 1
    };

    const currentScore = hierarchy[current] || 0;
    const newScore = hierarchy[newStatus] || 0;

    return newScore > currentScore ? newStatus : current;
  }

  /**
   * Migrar todas las referencias de los duplicados al contacto maestro
   */
  async migrateReferences(client, duplicateIds, masterContactId) {
    console.log(`[Unificación] Migrando referencias de ${duplicateIds.length} duplicados a ${masterContactId}`);

    // Migrar pagos
    const paymentsResult = await client.query(
      'UPDATE payments SET contact_id = $1 WHERE contact_id = ANY($2::text[])',
      [masterContactId, duplicateIds]
    );
    console.log(`[Unificación] Migrados ${paymentsResult.rowCount} pagos`);

    // Migrar citas
    const appointmentsResult = await client.query(
      'UPDATE appointments SET contact_id = $1 WHERE contact_id = ANY($2::text[])',
      [masterContactId, duplicateIds]
    );
    console.log(`[Unificación] Migradas ${appointmentsResult.rowCount} citas`);

    // Migrar sesiones de tracking
    const sessionsResult = await client.query(
      'UPDATE tracking.sessions SET contact_id = $1 WHERE contact_id = ANY($2::text[])',
      [masterContactId, duplicateIds]
    );
    console.log(`[Unificación] Migradas ${sessionsResult.rowCount} sesiones de tracking`);
  }

  /**
   * Crear un nuevo contacto cuando no hay duplicados
   */
  async createNewContact(client, data) {
    const contactId = data.contact_id || await this.generateContactId();
    const now = new Date().toISOString();

    const insertQuery = `
      INSERT INTO contacts (
        contact_id,
        first_name,
        last_name,
        email,
        phone,
        company,
        rstk_adid,
        rstk_source,
        visitor_id,
        ext_crm_id,
        status,
        source,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;

    const result = await client.query(insertQuery, [
      contactId,
      data.first_name || data.firstName || null,
      data.last_name || data.lastName || null,
      data.email || null,
      data.phone || null,
      data.company || null,
      data.rstk_adid || data.first_adid || data.ad_id || null,
      data.rstk_source || null,
      data.visitor_id || data.rstk_vid || null,  // IMPORTANTE: Guardar visitor_id para tracking
      data.ext_crm_id || data.ghl_contact_id || null,
      data.status || 'lead',
      data.source || 'Direct',
      now,
      now
    ]);

    return result.rows[0];
  }

  /**
   * Buscar y limpiar duplicados existentes en la base de datos
   * (Para ejecutar manualmente o en un job)
   */
  async cleanupExistingDuplicates() {
    const client = await databasePool.connect();

    try {
      await client.query('BEGIN');

      // Buscar grupos de duplicados por email
      const emailDuplicatesQuery = `
        SELECT email, COUNT(*) as count, array_agg(contact_id) as ids
        FROM contacts
        WHERE email IS NOT NULL AND email != ''
        GROUP BY LOWER(TRIM(email))
        HAVING COUNT(*) > 1
      `;

      const emailDuplicates = await client.query(emailDuplicatesQuery);
      console.log(`[Limpieza] Encontrados ${emailDuplicates.rows.length} grupos de duplicados por email`);

      // Buscar grupos de duplicados por teléfono
      const phoneDuplicatesQuery = `
        SELECT
          REGEXP_REPLACE(phone, '[^0-9]', '', 'g') as normalized_phone,
          COUNT(*) as count,
          array_agg(contact_id) as ids
        FROM contacts
        WHERE phone IS NOT NULL AND phone != ''
        GROUP BY REGEXP_REPLACE(phone, '[^0-9]', '', 'g')
        HAVING COUNT(*) > 1
      `;

      const phoneDuplicates = await client.query(phoneDuplicatesQuery);
      console.log(`[Limpieza] Encontrados ${phoneDuplicates.rows.length} grupos de duplicados por teléfono`);

      let totalUnified = 0;

      // Procesar duplicados por email
      for (const group of emailDuplicates.rows) {
        const contacts = await client.query(
          'SELECT * FROM contacts WHERE contact_id = ANY($1::text[])',
          [group.ids]
        );

        if (contacts.rows.length > 1) {
          await this.unifyContacts(client, contacts.rows, null);
          totalUnified++;
        }
      }

      // Procesar duplicados por teléfono
      for (const group of phoneDuplicates.rows) {
        const contacts = await client.query(
          'SELECT * FROM contacts WHERE contact_id = ANY($1::text[])',
          [group.ids]
        );

        if (contacts.rows.length > 1) {
          await this.unifyContacts(client, contacts.rows, null);
          totalUnified++;
        }
      }

      await client.query('COMMIT');

      console.log(`[Limpieza] Unificados ${totalUnified} grupos de contactos duplicados`);

      return {
        success: true,
        emailGroups: emailDuplicates.rows.length,
        phoneGroups: phoneDuplicates.rows.length,
        totalUnified
      };

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[Limpieza] Error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Obtener estadísticas de duplicados
   */
  async getDuplicateStats() {
    try {
      const emailDupsQuery = `
        SELECT COUNT(*) as groups
        FROM (
          SELECT LOWER(TRIM(email)) as normalized_email
          FROM contacts
          WHERE email IS NOT NULL AND email != ''
          GROUP BY LOWER(TRIM(email))
          HAVING COUNT(*) > 1
        ) as dups
      `;

      const phoneDupsQuery = `
        SELECT COUNT(*) as groups
        FROM (
          SELECT REGEXP_REPLACE(phone, '[^0-9]', '', 'g') as normalized_phone
          FROM contacts
          WHERE phone IS NOT NULL AND phone != ''
          GROUP BY REGEXP_REPLACE(phone, '[^0-9]', '', 'g')
          HAVING COUNT(*) > 1
        ) as dups
      `;

      const [emailResult, phoneResult] = await Promise.all([
        databasePool.query(emailDupsQuery),
        databasePool.query(phoneDupsQuery)
      ]);

      return {
        emailDuplicateGroups: parseInt(emailResult.rows[0].groups) || 0,
        phoneDuplicateGroups: parseInt(phoneResult.rows[0].groups) || 0
      };

    } catch (error) {
      console.error('[Stats] Error:', error);
      throw error;
    }
  }
}

module.exports = new ContactUnificationService();