-- =============================================================================
-- MIGRACIÓN 010: IDENTITY GRAPH - Sistema de Resolución de Identidades
-- =============================================================================
-- Crear tabla para unificar identidades de usuarios a través de múltiples
-- visitor_ids, emails, phones, fingerprints, etc.
--
-- OBJETIVO: Customer Journey completo sin perder información
-- =============================================================================

-- 1. Crear tabla identity_graph en schema tracking
CREATE TABLE IF NOT EXISTS tracking.identity_graph (
  id SERIAL PRIMARY KEY,

  -- ID maestro que une todas las identidades
  primary_identity_id TEXT NOT NULL,

  -- Tipo de identificador: visitor_id, email, phone, contact_id, fingerprint
  identifier_type VARCHAR(50) NOT NULL,

  -- Valor del identificador
  identifier_value TEXT NOT NULL,

  -- Confianza de esta relación (0.0 - 1.0)
  -- 1.0 = 100% seguro (ej: form submission)
  -- 0.7-0.9 = Alta probabilidad (ej: fingerprint match)
  -- 0.5-0.7 = Media probabilidad (ej: email similarity)
  confidence_score FLOAT DEFAULT 1.0,

  -- Cuándo se creó esta relación
  linked_at TIMESTAMP DEFAULT NOW(),

  -- Método que creó la relación: fingerprint, form_submit, webhook, manual
  linked_by VARCHAR(50),

  -- Metadata adicional (device info, fingerprint, etc)
  metadata JSONB DEFAULT '{}',

  -- Prevenir duplicados: solo un identifier_value por tipo
  CONSTRAINT unique_identifier UNIQUE (identifier_type, identifier_value)
);

-- 2. Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_identity_primary
  ON tracking.identity_graph(primary_identity_id);

CREATE INDEX IF NOT EXISTS idx_identity_value
  ON tracking.identity_graph(identifier_type, identifier_value);

CREATE INDEX IF NOT EXISTS idx_identity_linked_at
  ON tracking.identity_graph(linked_at DESC);

CREATE INDEX IF NOT EXISTS idx_identity_fingerprint
  ON tracking.identity_graph USING gin(metadata)
  WHERE metadata ? 'device_fingerprint';

-- 3. Agregar columna primary_identity_id a tracking.sessions para queries rápidos
ALTER TABLE tracking.sessions
  ADD COLUMN IF NOT EXISTS primary_identity_id TEXT;

CREATE INDEX IF NOT EXISTS idx_sessions_primary_identity
  ON tracking.sessions(primary_identity_id)
  WHERE primary_identity_id IS NOT NULL;

-- 4. Comentarios para documentación
COMMENT ON TABLE tracking.identity_graph IS
  'Sistema de resolución de identidades - Une múltiples visitor_ids, emails, phones al mismo usuario';

COMMENT ON COLUMN tracking.identity_graph.primary_identity_id IS
  'ID maestro que une todas las identidades de un usuario';

COMMENT ON COLUMN tracking.identity_graph.identifier_type IS
  'Tipo: visitor_id, email, phone, contact_id, fingerprint';

COMMENT ON COLUMN tracking.identity_graph.confidence_score IS
  'Confianza de la relación: 1.0=100% seguro, 0.7-0.9=alta probabilidad';

COMMENT ON COLUMN tracking.identity_graph.linked_by IS
  'Método que creó la relación: fingerprint, form_submit, webhook, manual';

-- 5. Función para obtener customer journey completo
CREATE OR REPLACE FUNCTION tracking.get_customer_journey(visitor_id_input TEXT)
RETURNS TABLE (
  session_id TEXT,
  visitor_id TEXT,
  contact_id TEXT,
  event_name VARCHAR,
  created_at TIMESTAMP,
  landing_url TEXT,
  utm_source VARCHAR,
  utm_campaign VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  WITH user_identities AS (
    -- Obtener el primary_identity_id del visitor_id dado
    SELECT primary_identity_id
    FROM tracking.identity_graph
    WHERE identifier_type = 'visitor_id'
    AND identifier_value = visitor_id_input
    LIMIT 1
  ),
  all_visitor_ids AS (
    -- Obtener TODOS los visitor_ids relacionados
    SELECT identifier_value as vid
    FROM tracking.identity_graph
    WHERE primary_identity_id = (SELECT primary_identity_id FROM user_identities)
    AND identifier_type = 'visitor_id'
  )
  -- Obtener TODAS las sesiones de TODOS los visitor_ids relacionados
  SELECT
    s.session_id,
    s.visitor_id,
    s.contact_id,
    s.event_name,
    s.created_at,
    s.landing_url,
    s.utm_source,
    s.utm_campaign
  FROM tracking.sessions s
  WHERE s.visitor_id IN (SELECT vid FROM all_visitor_ids)
  ORDER BY s.created_at ASC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION tracking.get_customer_journey IS
  'Obtiene el customer journey completo de un usuario a través de todos sus visitor_ids';

-- =============================================================================
-- MIGRACIÓN DE DATOS EXISTENTES
-- Poblar identity_graph con visitor_ids actuales de tracking.sessions
-- =============================================================================

-- Insertar visitor_ids únicos de tracking.sessions
INSERT INTO tracking.identity_graph
  (primary_identity_id, identifier_type, identifier_value, confidence_score, linked_by, metadata)
SELECT DISTINCT
  'identity_' || EXTRACT(EPOCH FROM MIN(created_at))::bigint || '_' || substr(md5(visitor_id), 1, 7) as primary_identity_id,
  'visitor_id' as identifier_type,
  visitor_id as identifier_value,
  1.0 as confidence_score,
  'migration' as linked_by,
  jsonb_build_object(
    'device_fingerprint', device_fingerprint,
    'migrated_from', 'tracking.sessions',
    'migrated_at', NOW()
  ) as metadata
FROM tracking.sessions
WHERE visitor_id IS NOT NULL
GROUP BY visitor_id, device_fingerprint
ON CONFLICT (identifier_type, identifier_value) DO NOTHING;

-- Insertar contact_ids de contacts que tienen visitor_id
INSERT INTO tracking.identity_graph
  (primary_identity_id, identifier_type, identifier_value, confidence_score, linked_by, metadata)
SELECT DISTINCT
  ig.primary_identity_id,
  'contact_id' as identifier_type,
  c.contact_id as identifier_value,
  1.0 as confidence_score,
  'migration' as linked_by,
  jsonb_build_object(
    'email', c.email,
    'phone', c.phone,
    'migrated_from', 'contacts',
    'migrated_at', NOW()
  ) as metadata
FROM contacts c
JOIN tracking.identity_graph ig
  ON ig.identifier_value = c.visitor_id
  AND ig.identifier_type = 'visitor_id'
WHERE c.visitor_id IS NOT NULL
  AND c.contact_id IS NOT NULL
ON CONFLICT (identifier_type, identifier_value) DO NOTHING;

-- Insertar emails de contacts
INSERT INTO tracking.identity_graph
  (primary_identity_id, identifier_type, identifier_value, confidence_score, linked_by, metadata)
SELECT DISTINCT
  ig.primary_identity_id,
  'email' as identifier_type,
  c.email as identifier_value,
  1.0 as confidence_score,
  'migration' as linked_by,
  jsonb_build_object(
    'contact_id', c.contact_id,
    'migrated_from', 'contacts',
    'migrated_at', NOW()
  ) as metadata
FROM contacts c
JOIN tracking.identity_graph ig
  ON ig.identifier_value = c.visitor_id
  AND ig.identifier_type = 'visitor_id'
WHERE c.email IS NOT NULL
  AND c.email != ''
ON CONFLICT (identifier_type, identifier_value) DO NOTHING;

-- Actualizar primary_identity_id en tracking.sessions para queries rápidos
UPDATE tracking.sessions s
SET primary_identity_id = ig.primary_identity_id
FROM tracking.identity_graph ig
WHERE ig.identifier_value = s.visitor_id
  AND ig.identifier_type = 'visitor_id'
  AND s.primary_identity_id IS NULL;

-- Log de migración
DO $$
DECLARE
  total_identities INTEGER;
  total_visitor_ids INTEGER;
  total_contacts INTEGER;
  total_emails INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_identities FROM tracking.identity_graph;
  SELECT COUNT(*) INTO total_visitor_ids FROM tracking.identity_graph WHERE identifier_type = 'visitor_id';
  SELECT COUNT(*) INTO total_contacts FROM tracking.identity_graph WHERE identifier_type = 'contact_id';
  SELECT COUNT(*) INTO total_emails FROM tracking.identity_graph WHERE identifier_type = 'email';

  RAISE NOTICE '✅ Migración completada:';
  RAISE NOTICE '   Total identifiers: %', total_identities;
  RAISE NOTICE '   Visitor IDs: %', total_visitor_ids;
  RAISE NOTICE '   Contact IDs: %', total_contacts;
  RAISE NOTICE '   Emails: %', total_emails;
END $$;

-- =============================================================================
-- FIN DE MIGRACIÓN
-- =============================================================================
