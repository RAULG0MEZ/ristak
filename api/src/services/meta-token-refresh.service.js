/**
 * ============================================================================
 * META (FACEBOOK/INSTAGRAM) TOKEN REFRESH SERVICE
 * ============================================================================
 *
 * SERVICIO ESPECÍFICO PARA RENOVACIÓN AUTOMÁTICA DE TOKENS DE META/FACEBOOK
 *
 * ¿QUÉ HACE ESTE SERVICIO?
 * - Renueva automáticamente los tokens de Meta/Facebook antes de que expiren
 * - Maneja el error 190 cuando Facebook invalida la sesión
 * - Checa cada 6 horas si el token está por expirar
 * - Si expira en menos de 5 días, lo renueva automáticamente
 *
 * ERRORES DE META QUE MANEJA:
 * - Error 190: Token expirado o sesión invalidada
 * - Error 102: Token no válido
 * - Error 463: Token revocado
 * - Subcode 460: Cambio de contraseña (requiere re-login completo)
 *
 * IMPORTANTE PARA FUTUROS DEVS:
 * - Este servicio es ESPECÍFICO para Meta/Facebook/Instagram
 * - Los tokens de Meta duran 60 días por defecto
 * - Se pueden renovar con fb_exchange_token
 * - Si el usuario cambia su contraseña de Facebook, hay que re-autenticar
 *
 * ============================================================================
 */

const { databasePool } = require('../config/database.config');
const { encrypt, decrypt } = require('../utils/crypto.util');

class MetaTokenRefreshService {
  constructor() {
    // Intervalo de chequeo del token de META (cada 6 horas)
    this.checkInterval = null;

    // Días antes de expiración para renovar el token de META
    this.DAYS_BEFORE_EXPIRY = 5;

    // Configuración de la API de META/FACEBOOK
    this.GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v23.0';
    this.GRAPH_BASE = `https://graph.facebook.com/${this.GRAPH_VERSION}`;

    // Iniciar monitoreo del token de META
    console.log('🔐 [META Token Refresh] Servicio inicializado');
    this.startMetaTokenMonitoring();
  }

  /**
   * Inicia el monitoreo automático del token de META
   */
  startMetaTokenMonitoring() {
    // Limpiar intervalo anterior si existe
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    // Verificar token de META inmediatamente al iniciar
    this.checkMetaToken();

    // Luego verificar cada 6 horas
    this.checkInterval = setInterval(() => {
      this.checkMetaToken();
    }, 6 * 60 * 60 * 1000); // 6 horas

    console.log('🔐 [META Token Refresh] Monitoreo iniciado - verificación cada 6 horas');
  }

  /**
   * Verifica y renueva si es necesario el token de META
   */
  async checkMetaToken() {
    console.log('🔍 [META Token Refresh] Verificando token de Meta/Facebook...');

    try {
      // Obtener configuración actual de META
      const { rows } = await databasePool.query(
        'SELECT * FROM meta.meta_config WHERE id = 1 LIMIT 1'
      );

      if (!rows.length) {
        console.log('ℹ️ [META Token Refresh] No hay configuración de Meta');
        return;
      }

      const config = rows[0];
      const token = config.access_token ? decrypt(config.access_token) : null;
      const expiresAt = config.token_expires_at;

      if (!token) {
        console.log('ℹ️ [META Token Refresh] No hay token de Meta configurado');
        return;
      }

      if (!expiresAt) {
        console.log('⚠️ [META Token Refresh] Token sin fecha de expiración, obteniendo...');
        await this.updateMetaTokenExpiry(token);
        return;
      }

      // Verificar si el token está próximo a expirar
      const now = new Date();
      const expiryDate = new Date(expiresAt);
      const daysUntilExpiry = (expiryDate - now) / (1000 * 60 * 60 * 24);

      console.log(`📅 [META Token Refresh] Token de Meta expira en ${daysUntilExpiry.toFixed(1)} días`);

      // Si expira en menos de 5 días, renovar
      if (daysUntilExpiry <= this.DAYS_BEFORE_EXPIRY) {
        console.log(`🔄 [META Token Refresh] Token próximo a expirar, renovando...`);
        await this.refreshMetaToken(config);
      }
    } catch (error) {
      console.error('❌ [META Token Refresh] Error verificando token:', error);
    }
  }

  /**
   * Renueva el token de META usando fb_exchange_token
   */
  async refreshMetaToken(config) {
    const fetch = (await import('node-fetch')).default;
    const clientId = process.env.META_APP_ID;
    const clientSecret = process.env.META_APP_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('META_APP_ID y META_APP_SECRET son requeridos para renovar el token');
    }

    const currentToken = decrypt(config.access_token);

    // META usa grant_type=fb_exchange_token para renovar
    const url = new URL(`${this.GRAPH_BASE}/oauth/access_token`);
    url.searchParams.append('grant_type', 'fb_exchange_token');
    url.searchParams.append('client_id', clientId);
    url.searchParams.append('client_secret', clientSecret);
    url.searchParams.append('fb_exchange_token', currentToken);

    console.log('🔄 [META Token Refresh] Intercambiando token con Facebook...');

    try {
      const response = await fetch(url.toString());
      const data = await response.json();

      if (!response.ok || data.error) {
        // Manejar errores específicos de META
        const error = data.error || {};
        console.error('❌ [META Token Refresh] Error de Facebook:', error);

        // Si es error 190 con subcodes específicos, marcar como necesita re-auth
        if (error.code === 190 && [460, 463, 467].includes(error.error_subcode)) {
          await this.markTokenAsInvalid(error.message);
          throw new Error(`Token de Meta requiere re-autenticación: ${error.message}`);
        }

        throw new Error(error.message || 'Error renovando token de Meta');
      }

      // Calcular nueva fecha de expiración
      const expiresInSeconds = data.expires_in || (60 * 24 * 60 * 60); // Default 60 días
      const newExpiresAt = new Date(Date.now() + expiresInSeconds * 1000);

      // Actualizar token y fecha de expiración en la DB
      await databasePool.query(
        `UPDATE meta.meta_config
         SET access_token = $1,
             token_expires_at = $2,
             last_sync_error = NULL,
             sync_status = 'idle',
             updated_at = NOW()
         WHERE id = 1`,
        [encrypt(data.access_token), newExpiresAt]
      );

      console.log(`✅ [META Token Refresh] Token renovado exitosamente, expira en ${expiresInSeconds / 86400} días`);

      return true;
    } catch (error) {
      console.error('❌ [META Token Refresh] Error renovando token:', error);
      throw error;
    }
  }

  /**
   * Obtiene la fecha de expiración de un token de META existente
   */
  async updateMetaTokenExpiry(token) {
    try {
      const fetch = (await import('node-fetch')).default;

      // Usar debug_token de Facebook para obtener info del token
      const debugUrl = `${this.GRAPH_BASE}/debug_token?` +
                      `input_token=${encodeURIComponent(token)}&` +
                      `access_token=${encodeURIComponent(token)}`;

      const response = await fetch(debugUrl);
      const data = await response.json();

      if (data.data?.expires_at) {
        const expiresAt = new Date(data.data.expires_at * 1000); // Unix timestamp a Date

        await databasePool.query(
          `UPDATE meta.meta_config
           SET token_expires_at = $1,
               updated_at = NOW()
           WHERE id = 1`,
          [expiresAt]
        );

        console.log(`📅 [META Token Refresh] Fecha de expiración actualizada: ${expiresAt}`);
      }
    } catch (error) {
      console.error('❌ [META Token Refresh] Error obteniendo fecha de expiración:', error);
    }
  }

  /**
   * Marca el token de META como inválido cuando requiere re-autenticación
   */
  async markTokenAsInvalid(errorMessage) {
    console.error(`🚨 [META Token Refresh] Token de Meta marcado como inválido - requiere re-login en Facebook`);

    await databasePool.query(
      `UPDATE meta.meta_config
       SET last_sync_error = $1,
           sync_status = 'auth_required',
           updated_at = NOW()
       WHERE id = 1`,
      [`Token inválido: ${errorMessage}. El usuario debe volver a conectar su cuenta de Facebook.`]
    );

    // TODO: Aquí se podría enviar una notificación al usuario
    // por email o mostrar alerta en el dashboard
  }

  /**
   * Maneja errores de la API de META y determina si es un error de token
   */
  async handleMetaApiError(error) {
    const errorCode = error.code || error.error?.code;
    const errorSubcode = error.error_subcode || error.error?.error_subcode;

    // Lista de códigos de error de META que indican problema con el token
    const tokenErrorCodes = [102, 190, 463];
    const isTokenError = tokenErrorCodes.includes(errorCode);

    if (isTokenError) {
      console.log(`⚠️ [META Token Refresh] Error de token detectado (código ${errorCode})`);

      // Intentar refresh automático
      try {
        const { rows } = await databasePool.query(
          'SELECT * FROM meta.meta_config WHERE id = 1 LIMIT 1'
        );

        if (rows.length) {
          await this.refreshMetaToken(rows[0]);
          return true; // Token renovado, la operación puede reintentarse
        }
      } catch (refreshError) {
        console.error(`❌ [META Token Refresh] No se pudo renovar el token:`, refreshError);

        // Si es error que requiere re-auth completo, marcarlo
        if (errorCode === 190 && [460, 463, 467].includes(errorSubcode)) {
          await this.markTokenAsInvalid(error.message || 'Sesión de Facebook invalidada');
        }
      }
    }

    return false;
  }

  /**
   * Obtiene el estado actual del token de META
   */
  async getMetaTokenStatus() {
    try {
      const { rows } = await databasePool.query(
        `SELECT token_expires_at, last_sync_error, sync_status
         FROM meta.meta_config
         WHERE id = 1 LIMIT 1`
      );

      if (!rows.length) {
        return {
          configured: false,
          message: 'Meta no está configurado'
        };
      }

      const config = rows[0];
      const expiresAt = config.token_expires_at;
      const now = new Date();
      const expiryDate = expiresAt ? new Date(expiresAt) : null;
      const daysUntilExpiry = expiryDate ? (expiryDate - now) / (1000 * 60 * 60 * 24) : null;

      return {
        configured: true,
        expiresAt: expiresAt,
        daysUntilExpiry: daysUntilExpiry ? Math.floor(daysUntilExpiry) : null,
        isExpired: daysUntilExpiry ? daysUntilExpiry <= 0 : false,
        requiresRefresh: daysUntilExpiry ? daysUntilExpiry <= this.DAYS_BEFORE_EXPIRY : false,
        requiresReauth: config.sync_status === 'auth_required',
        hasError: !!config.last_sync_error,
        errorMessage: config.last_sync_error,
        status: config.sync_status
      };
    } catch (error) {
      return {
        configured: false,
        error: error.message
      };
    }
  }

  /**
   * Fuerza un refresh manual del token de META
   */
  async forceMetaTokenRefresh() {
    console.log('🔄 [META Token Refresh] Forzando renovación manual del token...');

    const { rows } = await databasePool.query(
      'SELECT * FROM meta.meta_config WHERE id = 1 LIMIT 1'
    );

    if (!rows.length) {
      throw new Error('No hay configuración de Meta');
    }

    return await this.refreshMetaToken(rows[0]);
  }

  /**
   * Detiene el monitoreo del token
   */
  stopMetaTokenMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('🛑 [META Token Refresh] Monitoreo de token detenido');
    }
  }
}

// Singleton para META Token Refresh
let metaTokenRefreshService = null;

module.exports = {
  getMetaTokenRefreshService: () => {
    if (!metaTokenRefreshService) {
      metaTokenRefreshService = new MetaTokenRefreshService();
    }
    return metaTokenRefreshService;
  },
  MetaTokenRefreshService
};