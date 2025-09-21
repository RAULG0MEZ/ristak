-- ===========================================================================
-- FIX DUPLICADOS ANTES DE REFACTOR
-- Fecha: 2025-01-20
-- Descripción: Actualizar session_ids duplicados para hacerlos únicos
-- ===========================================================================

-- Ver cuántos duplicados tenemos
SELECT
    'Total de session_ids duplicados:' as info,
    COUNT(DISTINCT session_id) as duplicados
FROM (
    SELECT session_id
    FROM tracking.sessions
    GROUP BY session_id
    HAVING COUNT(*) > 1
) as dups;

BEGIN;

-- Actualizar session_ids para hacerlos únicos
-- Usamos el ID existente como nuevo session_id (ya es único)
UPDATE tracking.sessions
SET session_id = id
WHERE id IS NOT NULL;

-- Verificar que ya no hay duplicados
SELECT
    'Session_ids después del fix:' as info,
    COUNT(*) as total_registros,
    COUNT(DISTINCT session_id) as sessions_unicos
FROM tracking.sessions;

COMMIT;

-- ===========================================================================
-- NOTA: Después de ejecutar este script, ejecutar refactor-tracking-sessions.sql
-- ===========================================================================