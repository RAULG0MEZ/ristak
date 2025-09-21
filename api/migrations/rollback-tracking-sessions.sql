-- ===========================================================================
-- ROLLBACK TEMPORAL DE CAMBIOS EN tracking.sessions
-- Fecha: 2025-01-20
-- Descripción: Revertir cambios mientras investigamos el error
-- ===========================================================================

BEGIN;

-- Quitar la llave primaria actual
ALTER TABLE tracking.sessions
DROP CONSTRAINT IF EXISTS sessions_pkey;

-- Agregar columna id de vuelta
ALTER TABLE tracking.sessions
ADD COLUMN IF NOT EXISTS id VARCHAR;

-- Actualizar id con el valor de session_id (que es único)
UPDATE tracking.sessions
SET id = session_id
WHERE id IS NULL;

-- Hacer id NOT NULL
ALTER TABLE tracking.sessions
ALTER COLUMN id SET NOT NULL;

-- Agregar columna session_number
ALTER TABLE tracking.sessions
ADD COLUMN IF NOT EXISTS session_number INTEGER;

-- Agregar columna ga_session_number
ALTER TABLE tracking.sessions
ADD COLUMN IF NOT EXISTS ga_session_number INTEGER;

-- Crear llave primaria en id
ALTER TABLE tracking.sessions
ADD PRIMARY KEY (id);

-- Verificar estructura
SELECT
    'ESTRUCTURA DESPUÉS DEL ROLLBACK:' as info,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'tracking'
AND table_name = 'sessions'
AND column_name IN ('id', 'session_id', 'session_number', 'ga_session_number')
ORDER BY ordinal_position;

COMMIT;

-- ===========================================================================
-- NOTA: Este es un rollback temporal para investigar el error
-- Una vez resuelto, ejecutar refactor-tracking-sessions.sql de nuevo
-- ===========================================================================