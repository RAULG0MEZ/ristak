-- Migración para renombrar attribution_ad_id a rstk_adid y agregar rstk_source
-- Fecha: 2025-01-20

-- 1. Renombrar columna attribution_ad_id a rstk_adid
ALTER TABLE contacts
RENAME COLUMN attribution_ad_id TO rstk_adid;

-- 2. Agregar nueva columna rstk_source para el medio donde convirtió
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS rstk_source VARCHAR(255);

-- 3. Actualizar el índice (primero eliminar el viejo si existe)
DROP INDEX IF EXISTS contacts_attribution_ad_id_idx;

-- 4. Crear nuevo índice para rstk_adid
CREATE INDEX IF NOT EXISTS contacts_rstk_adid_idx ON contacts(rstk_adid);

-- 5. Crear índice para rstk_source (útil para reportes por fuente)
CREATE INDEX IF NOT EXISTS contacts_rstk_source_idx ON contacts(rstk_source);

-- Comentario: rstk_adid mantiene el ID del anuncio de atribución
-- rstk_source guarda el medio/fuente donde el contacto convirtió (facebook, google, instagram, etc.)