/**
 * Middleware para manejar timezone del usuario
 * Obtiene el timezone desde la DB y lo agrega al request
 */

const { databasePool } = require('../config/database.config');

/**
 * Middleware que agrega el timezone del usuario al request
 * @param {Request} req - Request object
 * @param {Response} res - Response object
 * @param {Function} next - Next middleware
 */
async function attachUserTimezone(req, res, next) {
  try {
    // Si no hay usuario autenticado, usar timezone por defecto
    if (!req.user || !req.user.userId) {
      req.userTimezone = 'America/Mexico_City';
      return next();
    }

    // Obtener timezone del usuario desde la DB
    const result = await databasePool.query(
      'SELECT timezone FROM users WHERE id = $1 LIMIT 1',
      [req.user.userId]
    );

    if (result.rows.length > 0 && result.rows[0].timezone) {
      req.userTimezone = result.rows[0].timezone;
    } else {
      req.userTimezone = 'America/Mexico_City'; // Default
    }

    next();
  } catch (error) {
    console.error('[Timezone Middleware] Error getting user timezone:', error);
    req.userTimezone = 'America/Mexico_City'; // Default en caso de error
    next();
  }
}

module.exports = {
  attachUserTimezone
};