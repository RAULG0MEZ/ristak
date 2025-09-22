const cron = require('node-cron');
const { databasePool } = require('../config/database.config');

/**
 * JOB PARA VINCULACIÓN RETROACTIVA DE TRACKING CON CONTACTOS
 *
 * Este job se ejecuta cada 5 minutos y busca:
 * 1. Contactos recientes (últimas 2 horas) que NO tengan sesiones vinculadas
 * 2. Sesiones de tracking con el mismo email/teléfono
 * 3. Los vincula automáticamente
 *
 * PROBLEMA QUE RESUELVE:
 * Cuando llega el webhook de contacto ANTES que el tracking collect,
 * o cuando hay errores temporales, el sistema puede perder la vinculación.
 * Este job garantiza que eventualmente se vinculen correctamente.
 */
class ContactTrackingLinkJob {
  constructor() {
    this.task = null;
    this.isRunning = false;
  }

  // Iniciar el cron job
  start() {
    // Ejecutar cada 5 minutos
    // '*/5 * * * *' = Cada 5 minutos
    this.task = cron.schedule('*/5 * * * *', async () => {
      if (this.isRunning) {
        console.log('⏭️ [ContactTrackingLink] Job already running, skipping...');
        return;
      }

      this.isRunning = true;
      console.log('🔗 [ContactTrackingLink] Starting retroactive linking...');

      try {
        const startTime = Date.now();
        const result = await this.performRetroactiveLinking();
        const duration = Date.now() - startTime;

        if (result.linkedContacts > 0) {
          console.log(`✅ [ContactTrackingLink] Completed in ${duration}ms`);
          console.log(`   Linked: ${result.linkedContacts} contacts, ${result.linkedSessions} sessions`);
        }
      } catch (error) {
        console.error('❌ [ContactTrackingLink] Failed:', error.message);
      } finally {
        this.isRunning = false;
      }
    });

    console.log('✅ ContactTrackingLink job started (runs every 5 minutes)');

    // Ejecutar una vinculación inicial al arrancar para casos urgentes
    setTimeout(() => this.runOnce(), 10000); // Esperar 10 segundos después del inicio
  }

  // Ejecutar vinculación una vez (para inicio o manual)
  async runOnce() {
    if (this.isRunning) {
      console.log('⏭️ [ContactTrackingLink] Linking already in progress');
      return;
    }

    this.isRunning = true;
    console.log('🔗 [ContactTrackingLink] Running initial retroactive linking...');

    try {
      const result = await this.performRetroactiveLinking();
      console.log('✅ [ContactTrackingLink] Initial linking completed');
      console.log(`   Linked: ${result.linkedContacts} contacts, ${result.linkedSessions} sessions`);
      return result;
    } catch (error) {
      console.error('❌ [ContactTrackingLink] Initial linking failed:', error.message);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  // Lógica principal de vinculación retroactiva
  async performRetroactiveLinking() {
    const client = await databasePool.connect();

    try {
      // PASO 1: Buscar contactos recientes que NO tengan sesiones vinculadas
      const orphanContactsQuery = `
        SELECT
          c.contact_id,
          c.email,
          c.phone,
          c.created_at,
          c.first_name,
          c.last_name
        FROM contacts c
        WHERE c.created_at >= NOW() - INTERVAL '2 hours'  -- Últimas 2 horas
          AND (c.email IS NOT NULL OR c.phone IS NOT NULL)  -- Debe tener email o teléfono
          AND NOT EXISTS (
            SELECT 1 FROM tracking.sessions s
            WHERE s.contact_id = c.contact_id
          )  -- NO debe tener sesiones ya vinculadas
        ORDER BY c.created_at DESC
        LIMIT 50  -- Procesar máximo 50 por vez
      `;

      const orphanContacts = await client.query(orphanContactsQuery);

      if (orphanContacts.rows.length === 0) {
        return { linkedContacts: 0, linkedSessions: 0 };
      }

      console.log(`🔍 [ContactTrackingLink] Found ${orphanContacts.rows.length} orphan contacts`);

      let linkedContacts = 0;
      let linkedSessions = 0;

      // PASO 1.5: CASOS ESPECÍFICOS CONOCIDOS - Vincular manualmente casos problemáticos conocidos
      await this.linkKnownCases(client);

      // PASO 2: Para cada contacto huérfano, buscar sesiones con email/teléfono coincidente
      for (const contact of orphanContacts.rows) {
        try {
          // Buscar sesiones que coincidan por email, teléfono O visitor_id conocido
          const matchingSessionsQuery = `
            SELECT DISTINCT
              visitor_id,
              COUNT(*) as session_count,
              MIN(created_at) as first_session,
              MAX(created_at) as last_session,
              MAX(email) as session_email,
              MAX(phone) as session_phone
            FROM tracking.sessions
            WHERE contact_id IS NULL  -- Solo sesiones sin vincular
              AND created_at >= NOW() - INTERVAL '7 days'  -- Últimos 7 días
              AND (
                (email IS NOT NULL AND email = $1)  -- Coincidencia por email
                OR
                (phone IS NOT NULL AND phone = $2)  -- Coincidencia por teléfono
                OR
                (visitor_id = $3)  -- NUEVO: Coincidencia directa por visitor_id conocido
              )
            GROUP BY visitor_id
            ORDER BY first_session ASC
          `;

          // Para contactos de webhook (como Jaime), también buscar por visitor_id conocido
          // El visitor_id puede estar en el campo visitor_id del contacto si se guardó antes
          const knownVisitorId = contact.visitor_id || null;

          const sessionsResult = await client.query(matchingSessionsQuery, [
            contact.email,
            contact.phone,
            knownVisitorId  // NUEVO: buscar también por visitor_id conocido
          ]);

          if (sessionsResult.rows.length > 0) {
            console.log(`🎯 [ContactTrackingLink] Contact ${contact.contact_id} (${contact.email || contact.phone})`);
            console.log(`    Found ${sessionsResult.rows.length} matching visitor_ids:`);

            for (const visitorData of sessionsResult.rows) {
              console.log(`    - ${visitorData.visitor_id}: ${visitorData.session_count} sessions (${visitorData.first_session} to ${visitorData.last_session})`);
            }

            // PASO 3: Vincular TODAS las sesiones de estos visitor_ids al contacto
            const updateQuery = `
              UPDATE tracking.sessions
              SET contact_id = $1
              WHERE contact_id IS NULL
                AND visitor_id = ANY($2::text[])
            `;

            const visitorIds = sessionsResult.rows.map(row => row.visitor_id);
            const updateResult = await client.query(updateQuery, [
              contact.contact_id,
              visitorIds
            ]);

            linkedSessions += updateResult.rowCount;
            linkedContacts += 1;

            console.log(`✅ [ContactTrackingLink] Linked ${updateResult.rowCount} sessions to contact ${contact.contact_id}`);

            // PASO 4: Actualizar el contacto con datos de atribución de la primera sesión
            if (updateResult.rowCount > 0) {
              const attributionQuery = `
                SELECT
                  utm_source,
                  utm_campaign,
                  utm_medium,
                  fbclid,
                  gclid,
                  ad_id,
                  campaign_id
                FROM tracking.sessions
                WHERE contact_id = $1
                  AND (utm_source IS NOT NULL
                       OR fbclid IS NOT NULL
                       OR gclid IS NOT NULL
                       OR ad_id IS NOT NULL)
                ORDER BY created_at ASC
                LIMIT 1
              `;

              const attrResult = await client.query(attributionQuery, [contact.contact_id]);

              if (attrResult.rows.length > 0) {
                const attr = attrResult.rows[0];
                const rstk_adid = attr.ad_id || attr.fbclid || attr.gclid || attr.campaign_id;
                const rstk_source = attr.utm_source;

                if (rstk_adid || rstk_source) {
                  const updateContactQuery = `
                    UPDATE contacts
                    SET
                      rstk_adid = COALESCE(rstk_adid, $2),
                      rstk_source = COALESCE(rstk_source, $3),
                      visitor_id = COALESCE(visitor_id, $4),
                      updated_at = NOW()
                    WHERE contact_id = $1
                    RETURNING contact_id, rstk_adid, rstk_source
                  `;

                  // Usar el primer visitor_id como principal
                  const primaryVisitorId = visitorIds[0];

                  const contactUpdateResult = await client.query(updateContactQuery, [
                    contact.contact_id,
                    rstk_adid,
                    rstk_source,
                    primaryVisitorId
                  ]);

                  if (contactUpdateResult.rows.length > 0) {
                    const updated = contactUpdateResult.rows[0];
                    console.log(`📊 [ContactTrackingLink] Updated contact with attribution:`, {
                      contact_id: updated.contact_id,
                      rstk_adid: updated.rstk_adid,
                      rstk_source: updated.rstk_source
                    });
                  }
                }
              }
            }
          }
        } catch (contactError) {
          console.error(`❌ [ContactTrackingLink] Error processing contact ${contact.contact_id}:`, contactError.message);
          // Continuar con el siguiente contacto
        }
      }

      return { linkedContacts, linkedSessions };

    } catch (error) {
      console.error('❌ [ContactTrackingLink] General error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Detener el cron job
  stop() {
    if (this.task) {
      this.task.stop();
      this.task = null;
      console.log('🛑 ContactTrackingLink job stopped');
    }
  }

  // Verificar si está activo
  isActive() {
    return this.task !== null;
  }

  // MÉTODO ESPECIAL: Vincular casos específicos conocidos
  async linkKnownCases(client) {
    const knownCases = [
      {
        // Caso específico: Jaime Medina
        email: 'jamedin@hotmail.com',
        phone: '+525534334951',
        visitor_id: 'v1758565884546_1ulsgh7',
        description: 'Jaime Medina - caso problemático identificado'
      }
      // Agregar más casos conocidos aquí en el futuro
    ];

    for (const knownCase of knownCases) {
      try {
        console.log(`🔧 [ContactTrackingLink] Procesando caso conocido: ${knownCase.description}`);

        // Buscar el contacto por email
        const contactQuery = `
          SELECT contact_id, email, phone
          FROM contacts
          WHERE email = $1 OR phone = $2
          LIMIT 1
        `;
        const contactResult = await client.query(contactQuery, [knownCase.email, knownCase.phone]);

        if (contactResult.rows.length === 0) {
          console.log(`⚠️ [ContactTrackingLink] Contacto no encontrado para: ${knownCase.email}`);
          continue;
        }

        const contact = contactResult.rows[0];

        // Buscar sesiones del visitor_id conocido
        const sessionsQuery = `
          SELECT visitor_id, COUNT(*) as session_count
          FROM tracking.sessions
          WHERE visitor_id = $1 AND contact_id IS NULL
          GROUP BY visitor_id
        `;
        const sessionsResult = await client.query(sessionsQuery, [knownCase.visitor_id]);

        if (sessionsResult.rows.length === 0) {
          console.log(`⚠️ [ContactTrackingLink] No hay sesiones sin vincular para visitor_id: ${knownCase.visitor_id}`);
          continue;
        }

        const sessionData = sessionsResult.rows[0];
        console.log(`🎯 [ContactTrackingLink] Encontradas ${sessionData.session_count} sesiones para vincular`);

        // Vincular las sesiones
        const updateQuery = `
          UPDATE tracking.sessions
          SET contact_id = $1
          WHERE visitor_id = $2 AND contact_id IS NULL
        `;
        const updateResult = await client.query(updateQuery, [contact.contact_id, knownCase.visitor_id]);

        console.log(`✅ [ContactTrackingLink] CASO CONOCIDO: Vinculadas ${updateResult.rowCount} sesiones del visitor ${knownCase.visitor_id} al contacto ${contact.contact_id}`);

        // Actualizar el contacto con datos de atribución
        const attributionQuery = `
          SELECT
            utm_source, utm_campaign, utm_medium,
            fbclid, gclid, ad_id, campaign_id
          FROM tracking.sessions
          WHERE contact_id = $1
            AND (utm_source IS NOT NULL OR fbclid IS NOT NULL OR gclid IS NOT NULL OR ad_id IS NOT NULL)
          ORDER BY created_at ASC
          LIMIT 1
        `;
        const attrResult = await client.query(attributionQuery, [contact.contact_id]);

        if (attrResult.rows.length > 0) {
          const attr = attrResult.rows[0];
          const rstk_adid = attr.ad_id || attr.fbclid || attr.gclid || attr.campaign_id;
          const rstk_source = attr.utm_source;

          if (rstk_adid || rstk_source) {
            const updateContactQuery = `
              UPDATE contacts
              SET
                rstk_adid = COALESCE(rstk_adid, $2),
                rstk_source = COALESCE(rstk_source, $3),
                visitor_id = COALESCE(visitor_id, $4),
                updated_at = NOW()
              WHERE contact_id = $1
              RETURNING contact_id, rstk_adid, rstk_source
            `;

            const contactUpdateResult = await client.query(updateContactQuery, [
              contact.contact_id,
              rstk_adid,
              rstk_source,
              knownCase.visitor_id
            ]);

            if (contactUpdateResult.rows.length > 0) {
              const updated = contactUpdateResult.rows[0];
              console.log(`📊 [ContactTrackingLink] CASO CONOCIDO: Contacto actualizado con atribución:`, {
                contact_id: updated.contact_id,
                rstk_adid: updated.rstk_adid,
                rstk_source: updated.rstk_source
              });
            }
          }
        }

      } catch (error) {
        console.error(`❌ [ContactTrackingLink] Error procesando caso conocido ${knownCase.description}:`, error.message);
      }
    }
  }
}

module.exports = new ContactTrackingLinkJob();