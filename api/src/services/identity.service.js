// =============================================================================
// IDENTITY RESOLUTION SERVICE
// =============================================================================
// Sistema robusto para unificar identidades de usuarios a través de múltiples
// visitor_ids, emails, phones, fingerprints, etc.
//
// FILOSOFÍA:
// - NUNCA modificar visitor_ids originales
// - Mantener TODAS las relaciones con metadata
// - Una sola fuente de verdad: primary_identity_id
// - Customer journey completo sin pérdida de información
// =============================================================================

const databasePool = require('../config/database');

class IdentityService {

  // =============================================================================
  // OBTENER PRIMARY IDENTITY ID
  // Encuentra el ID maestro de cualquier identifier (visitor_id, email, etc)
  // =============================================================================
  async getPrimaryIdentity(identifierType, identifierValue) {
    if (!identifierValue) return null;

    const query = `
      SELECT primary_identity_id
      FROM tracking.identity_graph
      WHERE identifier_type = $1 AND identifier_value = $2
      LIMIT 1
    `;

    try {
      const result = await databasePool.query(query, [identifierType, identifierValue]);
      return result.rows[0]?.primary_identity_id || null;
    } catch (error) {
      console.error(`❌ [Identity] Error obteniendo primary_identity para ${identifierType}:${identifierValue}:`, error);
      return null;
    }
  }

  // =============================================================================
  // OBTENER TODOS LOS VISITOR_IDS RELACIONADOS
  // Devuelve TODOS los visitor_ids que pertenecen al mismo usuario
  // =============================================================================
  async getAllVisitorIds(primaryIdentityId) {
    if (!primaryIdentityId) return [];

    const query = `
      SELECT identifier_value, confidence_score, linked_at, linked_by
      FROM tracking.identity_graph
      WHERE primary_identity_id = $1
      AND identifier_type = 'visitor_id'
      ORDER BY linked_at ASC
    `;

    try {
      const result = await databasePool.query(query, [primaryIdentityId]);
      return result.rows.map(r => r.identifier_value);
    } catch (error) {
      console.error(`❌ [Identity] Error obteniendo visitor_ids para ${primaryIdentityId}:`, error);
      return [];
    }
  }

  // =============================================================================
  // OBTENER VISITOR_ID MÁS ANTIGUO
  // El visitor_id "canónico" para mostrar al usuario
  // =============================================================================
  async getOldestVisitorId(primaryIdentityId) {
    if (!primaryIdentityId) return null;

    const query = `
      SELECT identifier_value
      FROM tracking.identity_graph
      WHERE primary_identity_id = $1
      AND identifier_type = 'visitor_id'
      ORDER BY linked_at ASC
      LIMIT 1
    `;

    try {
      const result = await databasePool.query(query, [primaryIdentityId]);
      return result.rows[0]?.identifier_value || null;
    } catch (error) {
      console.error(`❌ [Identity] Error obteniendo visitor_id más antiguo:`, error);
      return null;
    }
  }

  // =============================================================================
  // OBTENER TODOS LOS IDENTIFIERS DE UN USUARIO
  // Útil para debugging y analytics
  // =============================================================================
  async getAllIdentifiers(primaryIdentityId) {
    if (!primaryIdentityId) return [];

    const query = `
      SELECT
        identifier_type,
        identifier_value,
        confidence_score,
        linked_at,
        linked_by,
        metadata
      FROM tracking.identity_graph
      WHERE primary_identity_id = $1
      ORDER BY linked_at ASC
    `;

    try {
      const result = await databasePool.query(query, [primaryIdentityId]);
      return result.rows;
    } catch (error) {
      console.error(`❌ [Identity] Error obteniendo identifiers:`, error);
      return [];
    }
  }

  // =============================================================================
  // LINK NUEVO IDENTIFIER A PRIMARY IDENTITY
  // Agrega un nuevo visitor_id, email, phone, etc. a un usuario
  // =============================================================================
  async linkIdentifier(primaryIdentityId, identifierType, identifierValue, linkedBy, confidence = 1.0, metadata = {}) {
    if (!primaryIdentityId || !identifierType || !identifierValue) {
      console.error('❌ [Identity] linkIdentifier requiere primaryIdentityId, identifierType e identifierValue');
      return null;
    }

    const query = `
      INSERT INTO tracking.identity_graph
        (primary_identity_id, identifier_type, identifier_value, confidence_score, linked_by, metadata)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (identifier_type, identifier_value) DO UPDATE SET
        primary_identity_id = EXCLUDED.primary_identity_id,
        confidence_score = GREATEST(tracking.identity_graph.confidence_score, EXCLUDED.confidence_score),
        linked_by = EXCLUDED.linked_by,
        metadata = tracking.identity_graph.metadata || EXCLUDED.metadata,
        linked_at = NOW()
      RETURNING *
    `;

    try {
      const result = await databasePool.query(query, [
        primaryIdentityId,
        identifierType,
        identifierValue,
        confidence,
        linkedBy,
        JSON.stringify(metadata)
      ]);

      console.log(`✅ [Identity] Linked ${identifierType}:${identifierValue} → ${primaryIdentityId} (by: ${linkedBy}, confidence: ${confidence})`);
      return result.rows[0];
    } catch (error) {
      console.error(`❌ [Identity] Error linking identifier:`, error);
      throw error;
    }
  }

  // =============================================================================
  // UNIFICAR DOS PRIMARY IDENTITIES
  // Cuando descubres que dos identities son la misma persona
  // =============================================================================
  async mergePrimaryIdentities(keepId, mergeId) {
    if (!keepId || !mergeId || keepId === mergeId) {
      console.error('❌ [Identity] mergePrimaryIdentities requiere dos IDs diferentes');
      return 0;
    }

    const query = `
      UPDATE tracking.identity_graph
      SET primary_identity_id = $1,
          metadata = jsonb_set(
            COALESCE(metadata, '{}'),
            '{merged_from}',
            to_jsonb($2::text)
          ),
          linked_at = NOW()
      WHERE primary_identity_id = $2
    `;

    try {
      const result = await databasePool.query(query, [keepId, mergeId]);
      console.log(`✅ [Identity] Merged ${result.rowCount} identifiers: ${mergeId} → ${keepId}`);
      return result.rowCount;
    } catch (error) {
      console.error(`❌ [Identity] Error merging identities:`, error);
      throw error;
    }
  }

  // =============================================================================
  // GENERAR NUEVO PRIMARY IDENTITY ID
  // Formato: identity_{timestamp}_{random}
  // =============================================================================
  generatePrimaryIdentityId() {
    return `identity_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  // =============================================================================
  // BUSCAR O CREAR PRIMARY IDENTITY POR VISITOR_ID
  // Si no existe, crea uno nuevo. Si existe, devuelve el existente.
  // =============================================================================
  async getOrCreatePrimaryIdentity(visitorId, deviceFingerprint = null) {
    if (!visitorId) {
      console.error('❌ [Identity] getOrCreatePrimaryIdentity requiere visitorId');
      return null;
    }

    // 1. Buscar si ya existe
    let primaryIdentityId = await this.getPrimaryIdentity('visitor_id', visitorId);

    if (primaryIdentityId) {
      console.log(`🔍 [Identity] Primary identity existente para visitor ${visitorId}: ${primaryIdentityId}`);
      return primaryIdentityId;
    }

    // 2. No existe → crear nuevo
    primaryIdentityId = this.generatePrimaryIdentityId();

    const metadata = {};
    if (deviceFingerprint) {
      metadata.device_fingerprint = deviceFingerprint;
    }

    await this.linkIdentifier(
      primaryIdentityId,
      'visitor_id',
      visitorId,
      'first_visit',
      1.0,
      metadata
    );

    console.log(`🆕 [Identity] Nuevo primary identity creado: ${primaryIdentityId} para visitor ${visitorId}`);
    return primaryIdentityId;
  }

  // =============================================================================
  // BUSCAR IDENTITIES CON MISMO FINGERPRINT
  // Detecta usuarios con mismo dispositivo pero diferentes visitor_ids
  // =============================================================================
  async findIdentitiesByFingerprint(deviceFingerprint, excludePrimaryId = null) {
    if (!deviceFingerprint) return [];

    const query = `
      SELECT DISTINCT
        primary_identity_id,
        identifier_value as visitor_id,
        linked_at,
        confidence_score
      FROM tracking.identity_graph
      WHERE identifier_type = 'visitor_id'
      AND metadata->>'device_fingerprint' = $1
      ${excludePrimaryId ? 'AND primary_identity_id != $2' : ''}
      ORDER BY linked_at ASC
      LIMIT 5
    `;

    try {
      const params = excludePrimaryId ? [deviceFingerprint, excludePrimaryId] : [deviceFingerprint];
      const result = await databasePool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error(`❌ [Identity] Error buscando por fingerprint:`, error);
      return [];
    }
  }

  // =============================================================================
  // OBTENER ESTADÍSTICAS DE UN PRIMARY IDENTITY
  // Útil para analytics y debugging
  // =============================================================================
  async getIdentityStats(primaryIdentityId) {
    if (!primaryIdentityId) return null;

    const query = `
      SELECT
        COUNT(*) as total_identifiers,
        COUNT(CASE WHEN identifier_type = 'visitor_id' THEN 1 END) as visitor_ids_count,
        COUNT(CASE WHEN identifier_type = 'email' THEN 1 END) as emails_count,
        COUNT(CASE WHEN identifier_type = 'phone' THEN 1 END) as phones_count,
        COUNT(CASE WHEN identifier_type = 'contact_id' THEN 1 END) as contacts_count,
        MIN(linked_at) as first_seen,
        MAX(linked_at) as last_seen
      FROM tracking.identity_graph
      WHERE primary_identity_id = $1
    `;

    try {
      const result = await databasePool.query(query, [primaryIdentityId]);
      return result.rows[0];
    } catch (error) {
      console.error(`❌ [Identity] Error obteniendo stats:`, error);
      return null;
    }
  }
}

module.exports = new IdentityService();
