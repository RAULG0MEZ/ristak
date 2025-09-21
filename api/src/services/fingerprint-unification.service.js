const { databasePool } = require('../config/database.config');

/**
 * Servicio de Unificación Probabilística por Fingerprinting
 *
 * Este servicio identifica y vincula sesiones de tracking que probablemente
 * pertenecen al mismo usuario, basándose en fingerprints del dispositivo
 * y otros indicadores probabilísticos.
 *
 * Técnicas utilizadas:
 * 1. Device Fingerprinting (Canvas, WebGL, Audio, Fonts)
 * 2. Coincidencia de IP + Timezone en ventana de tiempo
 * 3. Patrones de navegación similares
 * 4. Device signature matching
 */

class FingerprintUnificationService {

  /**
   * Busca sesiones similares basándose en fingerprints
   * y calcula la probabilidad de que sean del mismo usuario
   */
  async findSimilarSessions(sessionData) {
    const {
      visitor_id,
      canvas_fingerprint,
      webgl_fingerprint,
      screen_fingerprint,
      audio_fingerprint,
      fonts_fingerprint,
      device_signature,
      ip,
      timezone,
      user_agent
    } = sessionData;

    try {
      // Query para buscar sesiones con fingerprints similares
      const query = `
        WITH similarity_scores AS (
          SELECT
            session_id,
            visitor_id,
            contact_id,
            created_at,

            -- Calcular puntos de coincidencia
            CASE WHEN canvas_fingerprint = $1 AND $1 IS NOT NULL THEN 30 ELSE 0 END +
            CASE WHEN webgl_fingerprint = $2 AND $2 IS NOT NULL THEN 25 ELSE 0 END +
            CASE WHEN screen_fingerprint = $3 AND $3 IS NOT NULL THEN 10 ELSE 0 END +
            CASE WHEN audio_fingerprint = $4 AND $4 IS NOT NULL THEN 20 ELSE 0 END +
            CASE WHEN fonts_fingerprint = $5 AND $5 IS NOT NULL THEN 15 ELSE 0 END +
            CASE WHEN device_signature = $6 AND $6 IS NOT NULL THEN 35 ELSE 0 END +
            CASE
              WHEN ip = $7 AND timezone = $8
                AND created_at > NOW() - INTERVAL '2 hours'
              THEN 20
              ELSE 0
            END AS similarity_score,

            -- Detalles de coincidencias
            canvas_fingerprint = $1 AND $1 IS NOT NULL AS canvas_match,
            webgl_fingerprint = $2 AND $2 IS NOT NULL AS webgl_match,
            screen_fingerprint = $3 AND $3 IS NOT NULL AS screen_match,
            audio_fingerprint = $4 AND $4 IS NOT NULL AS audio_match,
            fonts_fingerprint = $5 AND $5 IS NOT NULL AS fonts_match,
            device_signature = $6 AND $6 IS NOT NULL AS device_sig_match,
            ip = $7 AND timezone = $8 AS ip_timezone_match,

            canvas_fingerprint,
            webgl_fingerprint,
            device_signature,
            ip,
            timezone

          FROM tracking.sessions
          WHERE
            visitor_id != $9  -- Excluir la sesión actual
            AND created_at > NOW() - INTERVAL '30 days'  -- Solo últimos 30 días
            AND (
              -- Al menos una coincidencia fuerte
              canvas_fingerprint = $1 OR
              webgl_fingerprint = $2 OR
              device_signature = $6 OR
              (audio_fingerprint = $4 AND $4 IS NOT NULL) OR
              (ip = $7 AND timezone = $8 AND created_at > NOW() - INTERVAL '2 hours')
            )
        )
        SELECT
          *,
          -- Calcular probabilidad basada en score
          CASE
            WHEN similarity_score >= 80 THEN 95.0  -- Muy alta probabilidad
            WHEN similarity_score >= 60 THEN 85.0  -- Alta probabilidad
            WHEN similarity_score >= 40 THEN 70.0  -- Media probabilidad
            WHEN similarity_score >= 25 THEN 50.0  -- Baja probabilidad
            ELSE 30.0  -- Muy baja probabilidad
          END AS match_probability
        FROM similarity_scores
        WHERE similarity_score >= 25  -- Umbral mínimo
        ORDER BY similarity_score DESC
        LIMIT 20;
      `;

      const result = await databasePool.query(query, [
        canvas_fingerprint,
        webgl_fingerprint,
        screen_fingerprint,
        audio_fingerprint,
        fonts_fingerprint,
        device_signature,
        ip,
        timezone,
        visitor_id
      ]);

      return result.rows.map(row => ({
        sessionId: row.session_id,
        visitorId: row.visitor_id,
        contactId: row.contact_id,
        similarityScore: row.similarity_score,
        matchProbability: row.match_probability,
        matches: {
          canvas: row.canvas_match,
          webgl: row.webgl_match,
          screen: row.screen_match,
          audio: row.audio_match,
          fonts: row.fonts_match,
          deviceSignature: row.device_sig_match,
          ipTimezone: row.ip_timezone_match
        },
        createdAt: row.created_at
      }));

    } catch (error) {
      console.error('[FingerprintUnification] Error finding similar sessions:', error);
      throw error;
    }
  }

  /**
   * Unifica sesiones cuando se identifica un usuario (por email/phone)
   * Busca y vincula todas las sesiones probables del mismo usuario
   */
  async unifySessionsOnConversion(contactId, currentSession) {
    try {
      console.log(`[FingerprintUnification] Iniciando unificación para contacto ${contactId}`);

      // 1. Buscar sesiones similares
      const similarSessions = await this.findSimilarSessions(currentSession);

      if (similarSessions.length === 0) {
        console.log('[FingerprintUnification] No se encontraron sesiones similares');
        return { unified: 0, sessions: [] };
      }

      // 2. Filtrar sesiones con alta probabilidad (>= 70%)
      const highProbabilitySessions = similarSessions.filter(s => s.matchProbability >= 70);

      console.log(`[FingerprintUnification] Encontradas ${highProbabilitySessions.length} sesiones con alta probabilidad`);

      // 3. Obtener visitor_ids únicos para actualizar
      const visitorIds = [...new Set(highProbabilitySessions.map(s => s.visitorId))];

      if (visitorIds.length > 0) {
        // 4. Actualizar todas las sesiones de esos visitor_ids
        const updateQuery = `
          UPDATE tracking.sessions
          SET
            contact_id = $1,
            fingerprint_probability = $2,
            updated_at = NOW()
          WHERE
            visitor_id = ANY($3::text[])
            AND contact_id IS NULL
          RETURNING visitor_id, session_id;
        `;

        const updateResult = await databasePool.query(updateQuery, [
          contactId,
          highProbabilitySessions[0].matchProbability, // Usar la probabilidad más alta
          visitorIds
        ]);

        console.log(`[FingerprintUnification] Unificadas ${updateResult.rowCount} sesiones`);

        // 5. Log de unificación para auditoría
        await this.logUnification(contactId, visitorIds, highProbabilitySessions);

        return {
          unified: updateResult.rowCount,
          sessions: updateResult.rows,
          visitorIds: visitorIds,
          probability: highProbabilitySessions[0].matchProbability
        };
      }

      return { unified: 0, sessions: [] };

    } catch (error) {
      console.error('[FingerprintUnification] Error unifying sessions:', error);
      throw error;
    }
  }

  /**
   * Registra la unificación para auditoría y análisis
   */
  async logUnification(contactId, visitorIds, sessions) {
    try {
      const logData = {
        contact_id: contactId,
        visitor_ids: visitorIds,
        sessions_count: sessions.length,
        max_probability: Math.max(...sessions.map(s => s.matchProbability)),
        unification_method: 'fingerprint_probabilistic',
        timestamp: new Date().toISOString(),
        match_details: sessions.map(s => ({
          visitor_id: s.visitorId,
          probability: s.matchProbability,
          matches: s.matches
        }))
      };

      console.log('[FingerprintUnification] Unificación registrada:', logData);

      // Aquí podrías guardar en una tabla de auditoría si lo necesitas

    } catch (error) {
      console.error('[FingerprintUnification] Error logging unification:', error);
      // No fallar si el log falla
    }
  }

  /**
   * Analiza la calidad de fingerprints de una sesión
   */
  analyzeFingerprrintQuality(sessionData) {
    const fingerprints = {
      canvas: sessionData.canvas_fingerprint,
      webgl: sessionData.webgl_fingerprint,
      screen: sessionData.screen_fingerprint,
      audio: sessionData.audio_fingerprint,
      fonts: sessionData.fonts_fingerprint,
      device_signature: sessionData.device_signature
    };

    let quality = 0;
    let available = [];
    let missing = [];

    // Evaluar cada fingerprint
    if (fingerprints.canvas) { quality += 25; available.push('canvas'); } else { missing.push('canvas'); }
    if (fingerprints.webgl) { quality += 20; available.push('webgl'); } else { missing.push('webgl'); }
    if (fingerprints.audio) { quality += 20; available.push('audio'); } else { missing.push('audio'); }
    if (fingerprints.fonts) { quality += 15; available.push('fonts'); } else { missing.push('fonts'); }
    if (fingerprints.screen) { quality += 10; available.push('screen'); } else { missing.push('screen'); }
    if (fingerprints.device_signature) { quality += 10; available.push('device_signature'); } else { missing.push('device_signature'); }

    return {
      quality: Math.min(quality, 100),
      available,
      missing,
      recommendation: quality >= 60 ? 'good' : quality >= 40 ? 'moderate' : 'poor'
    };
  }

  /**
   * Busca sesiones huérfanas (sin contact_id) que podrían unificarse
   */
  async findOrphanSessions(limit = 100) {
    try {
      const query = `
        SELECT
          visitor_id,
          COUNT(*) as session_count,
          MIN(created_at) as first_seen,
          MAX(created_at) as last_seen,
          array_agg(DISTINCT canvas_fingerprint) FILTER (WHERE canvas_fingerprint IS NOT NULL) as canvas_fps,
          array_agg(DISTINCT webgl_fingerprint) FILTER (WHERE webgl_fingerprint IS NOT NULL) as webgl_fps,
          array_agg(DISTINCT device_signature) FILTER (WHERE device_signature IS NOT NULL) as device_sigs
        FROM tracking.sessions
        WHERE
          contact_id IS NULL
          AND created_at > NOW() - INTERVAL '30 days'
          AND (
            canvas_fingerprint IS NOT NULL OR
            webgl_fingerprint IS NOT NULL OR
            device_signature IS NOT NULL
          )
        GROUP BY visitor_id
        HAVING COUNT(*) > 1
        ORDER BY COUNT(*) DESC
        LIMIT $1;
      `;

      const result = await databasePool.query(query, [limit]);

      return result.rows.map(row => ({
        visitorId: row.visitor_id,
        sessionCount: parseInt(row.session_count),
        firstSeen: row.first_seen,
        lastSeen: row.last_seen,
        fingerprints: {
          canvas: row.canvas_fps || [],
          webgl: row.webgl_fps || [],
          deviceSignature: row.device_sigs || []
        }
      }));

    } catch (error) {
      console.error('[FingerprintUnification] Error finding orphan sessions:', error);
      throw error;
    }
  }
}

module.exports = new FingerprintUnificationService();