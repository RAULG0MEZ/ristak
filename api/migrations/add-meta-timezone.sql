-- Agregar columna timezone a meta_config para normalizar datos de Meta
ALTER TABLE meta.meta_config
ADD COLUMN IF NOT EXISTS ad_account_timezone VARCHAR(50);

-- Comentario explicativo
COMMENT ON COLUMN meta.meta_config.ad_account_timezone IS 'Timezone configurado en la cuenta de anuncios de Meta (ej: America/Mexico_City, Europe/Madrid)';