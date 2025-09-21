-- Agregar columnas de fingerprinting a tracking.sessions
-- Estas columnas permitirán tracking cross-device sin email/phone

ALTER TABLE tracking.sessions
ADD COLUMN IF NOT EXISTS canvas_fingerprint TEXT,
ADD COLUMN IF NOT EXISTS webgl_fingerprint TEXT,
ADD COLUMN IF NOT EXISTS screen_fingerprint TEXT,
ADD COLUMN IF NOT EXISTS audio_fingerprint TEXT,
ADD COLUMN IF NOT EXISTS fonts_fingerprint TEXT,
ADD COLUMN IF NOT EXISTS device_signature TEXT,
ADD COLUMN IF NOT EXISTS fingerprint_probability DECIMAL(5,2);

-- Índices para búsqueda rápida de fingerprints similares
CREATE INDEX IF NOT EXISTS idx_sessions_canvas_fp ON tracking.sessions(canvas_fingerprint) WHERE canvas_fingerprint IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_webgl_fp ON tracking.sessions(webgl_fingerprint) WHERE webgl_fingerprint IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_device_sig ON tracking.sessions(device_signature) WHERE device_signature IS NOT NULL;

-- Índice compuesto para búsquedas probabilísticas
CREATE INDEX IF NOT EXISTS idx_sessions_fingerprint_combo ON tracking.sessions(ip, timezone, created_at DESC)
WHERE contact_id IS NULL;

COMMENT ON COLUMN tracking.sessions.canvas_fingerprint IS 'Hash único generado por Canvas API del navegador';
COMMENT ON COLUMN tracking.sessions.webgl_fingerprint IS 'Identificador de GPU/renderer obtenido vía WebGL';
COMMENT ON COLUMN tracking.sessions.screen_fingerprint IS 'Resolución + profundidad de color de la pantalla';
COMMENT ON COLUMN tracking.sessions.audio_fingerprint IS 'Hash de procesamiento de audio del dispositivo';
COMMENT ON COLUMN tracking.sessions.fonts_fingerprint IS 'Lista de fuentes instaladas en el sistema';
COMMENT ON COLUMN tracking.sessions.device_signature IS 'Hash combinado de todos los fingerprints';
COMMENT ON COLUMN tracking.sessions.fingerprint_probability IS 'Probabilidad (0-100) de match con otro dispositivo';