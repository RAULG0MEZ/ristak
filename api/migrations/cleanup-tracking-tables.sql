-- ===========================================================================
-- LIMPIEZA DE TABLAS DE TRACKING NO UTILIZADAS
-- Fecha: 2025-01-20
-- Descripción: Eliminar tablas legacy de tracking que ya no se usan
-- ===========================================================================

-- Verificar qué tablas existen en el schema tracking
SELECT
    table_name,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'tracking'
ORDER BY table_name;

-- Si existen, eliminar las tablas que ya no se usan
-- CUIDADO: Esto es IRREVERSIBLE - hacer backup primero si hay datos importantes

-- Eliminar tabla events si existe (ya no se usa)
DROP TABLE IF EXISTS tracking.events CASCADE;

-- Eliminar tabla pageviews si existe (ya no se usa)
DROP TABLE IF EXISTS tracking.pageviews CASCADE;

-- Eliminar cualquier vista relacionada
DROP VIEW IF EXISTS tracking.events_summary CASCADE;
DROP VIEW IF EXISTS tracking.pageviews_summary CASCADE;

-- Limpiar funciones obsoletas si existen
DROP FUNCTION IF EXISTS tracking.record_event CASCADE;
DROP FUNCTION IF EXISTS tracking.record_pageview CASCADE;

-- Confirmación de tablas restantes
SELECT
    'Limpieza completada. Tablas restantes en schema tracking:' as mensaje
UNION ALL
SELECT
    '  - ' || table_name
FROM pg_tables
WHERE schemaname = 'tracking'
ORDER BY 1;

-- ===========================================================================
-- NOTA IMPORTANTE:
-- La única tabla que debe quedar es: tracking.sessions
-- Esta tabla almacena TODOS los eventos de tracking (pageviews, clicks, etc)
-- Cada fila es un evento individual con su session_id para agruparlos
-- ===========================================================================