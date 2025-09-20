/**
 * Middleware de autenticación simple
 * Valida JWT y protege las rutas privadas
 */

const jwt = require('jsonwebtoken');
const AUTH_SECRET =
  process.env.AUTH_SECRET ||
  (process.env.NODE_ENV !== 'production' ? 'dev-secret' : undefined);

function getAuthSecret() {
  if (!AUTH_SECRET) {
    throw new Error('AUTH_SECRET no está configurado. Define AUTH_SECRET en las variables de entorno.');
  }
  return AUTH_SECRET;
}

function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Middleware que REQUIERE autenticación
 * Valida el token de sesión
 */
function requireAuth(req, res, next) {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({
        error: 'No autorizado',
        message: 'Se requiere token de autenticación'
      });
    }

    let payload;
    try {
      payload = jwt.verify(token, getAuthSecret());
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: 'Token expirado',
          message: 'Por favor, inicia sesión nuevamente'
        });
      }
      return res.status(401).json({
        error: 'Token inválido',
        message: 'El token no es válido o ha expirado'
      });
    }

    req.user = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role
    };
    req.sessionToken = token;

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    const message = error instanceof Error && error.message.includes('AUTH_SECRET')
      ? 'Configuración del servidor incompleta: define AUTH_SECRET'
      : 'Error al procesar la autenticación';
    res.status(500).json({
      error: 'Error de autenticación',
      message
    });
  }
}

/**
 * Middleware opcional - intenta autenticar pero no bloquea
 */
function optionalAuth(req, res, next) {
  try {
    const token = extractToken(req);

    if (token) {
      try {
        const payload = jwt.verify(token, getAuthSecret());
        req.user = {
          userId: payload.userId,
          email: payload.email,
          role: payload.role
        };
        req.sessionToken = token;
      } catch (error) {
        // Token inválido o expirado: continuar sin credenciales
      }
    }

    next();
  } catch (error) {
    // En caso de error, continuar sin auth
    next();
  }
}

module.exports = {
  requireAuth,
  optionalAuth
};
