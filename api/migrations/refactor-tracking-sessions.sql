-- ===========================================================================
-- REFACTOR DE TABLA tracking.sessions - VERSIÓN SEGURA
-- Fecha: 2025-01-20
-- Descripción: Simplificar estructura eliminando columnas redundantes
-- IMPORTANTE: Hacer backup antes de ejecutar
-- ===========================================================================

-- PASO 1: Verificar estructura actual antes de cambios
SELECT
    'ESTRUCTURA ACTUAL:' as info,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'tracking'
AND table_name = 'sessions'
AND column_name IN ('id', 'session_id', 'session_number')
ORDER BY ordinal_position;

-- PASO 2: Verificar si hay datos que se perderían
SELECT
    'DATOS ACTUALES:' as info,
    COUNT(*) as total_registros,
    COUNT(DISTINCT session_id) as sessions_unicos,
    COUNT(DISTINCT id) as ids_unicos
FROM tracking.sessions;

-- PASO 3: BACKUP DE SEGURIDAD (descomenta si quieres hacer backup)
-- CREATE TABLE tracking.sessions_backup_20250120 AS
-- SELECT * FROM tracking.sessions;

-- ===========================================================================
-- INICIO DE CAMBIOS ESTRUCTURALES
-- ===========================================================================

BEGIN; -- Iniciar transacción para poder hacer rollback si algo sale mal

-- PASO 4: Eliminar constraint de llave primaria actual si existe en 'id'
ALTER TABLE tracking.sessions
DROP CONSTRAINT IF EXISTS sessions_pkey CASCADE;

-- PASO 5: Eliminar la columna 'id' que ya no necesitamos
-- Como session_id ya es único para cada evento, no necesitamos otro ID
ALTER TABLE tracking.sessions
DROP COLUMN IF EXISTS id;

-- PASO 6: Eliminar la columna 'session_number' que no usamos
ALTER TABLE tracking.sessions
DROP COLUMN IF EXISTS session_number;

-- PASO 7: Eliminar la columna 'ga_session_number' si existe (parece que tampoco se usa)
ALTER TABLE tracking.sessions
DROP COLUMN IF EXISTS ga_session_number;

-- PASO 8: Asegurar que session_id sea NOT NULL
ALTER TABLE tracking.sessions
ALTER COLUMN session_id SET NOT NULL;

-- PASO 9: Crear nueva llave primaria en session_id
ALTER TABLE tracking.sessions
ADD PRIMARY KEY (session_id);

-- PASO 10: Recrear índices importantes si se perdieron
CREATE INDEX IF NOT EXISTS idx_tracking_sessions_visitor_id
ON tracking.sessions(visitor_id);

CREATE INDEX IF NOT EXISTS idx_tracking_sessions_contact_id
ON tracking.sessions(contact_id);

CREATE INDEX IF NOT EXISTS idx_tracking_sessions_created_at
ON tracking.sessions(created_at);

CREATE INDEX IF NOT EXISTS idx_tracking_sessions_ad_id
ON tracking.sessions(ad_id);

-- PASO 11: Verificar nueva estructura
SELECT
    'NUEVA ESTRUCTURA:' as info,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'tracking'
AND table_name = 'sessions'
ORDER BY ordinal_position
LIMIT 10;

-- PASO 12: Verificar que los datos siguen ahí
SELECT
    'VERIFICACIÓN FINAL:' as info,
    COUNT(*) as total_registros,
    COUNT(DISTINCT session_id) as sessions_unicos
FROM tracking.sessions;

COMMIT; -- Si todo salió bien, confirmar cambios

-- ===========================================================================
-- ROLLBACK EN CASO DE ERROR
-- ===========================================================================
-- Si algo salió mal y necesitas revertir:
-- ROLLBACK;
--
-- Para restaurar desde backup:
-- DROP TABLE tracking.sessions;
-- ALTER TABLE tracking.sessions_backup_20250120 RENAME TO sessions;

-- ===========================================================================
-- NOTAS IMPORTANTES:
-- 1. session_id ahora es la llave primaria (ID único para cada evento)
-- 2. Eliminamos columnas redundantes: id, session_number, ga_session_number
-- 3. El snip.js seguirá funcionando igual, solo genera session_id único
-- 4. No hay cambios en la lógica de negocio, solo limpieza de estructura
-- ===========================================================================