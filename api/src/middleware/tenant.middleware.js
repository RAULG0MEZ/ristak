/**
 * Middleware de autenticación y autorización multitenant
 *
 * Este middleware asegura que todas las requests incluyan tenant IDs válidos
 * y los inyecta en el objeto req para uso posterior en servicios
 */

// Usar los valores por defecto del ambiente - NUNCA HARDCODEAR
const DEFAULT_ACCOUNT_ID = process.env.DEFAULT_ACCOUNT_ID;
const DEFAULT_SUBACCOUNT_ID = process.env.DEFAULT_SUBACCOUNT_ID;

/**
 * Middleware que inyecta tenant IDs en cada request
 *
 * En producción, estos valores deberían venir de:
 * - JWT token decodificado
 * - Session del usuario
 * - API Key headers
 *
 * Para desarrollo, usa valores por defecto
 */
function tenantMiddleware(req, res, next) {
  // En desarrollo, usar valores por defecto
  // TODO: En producción, obtener de JWT/Session/Headers

  // Intentar obtener de headers primero (para APIs externas)
  let accountId = req.headers['x-account-id'] || req.headers['account-id'];
  let subaccountId = req.headers['x-subaccount-id'] || req.headers['subaccount-id'];

  // Si no hay headers, intentar obtener de query params (temporal)
  if (!accountId) {
    accountId = req.query.account_id;
  }
  if (!subaccountId) {
    subaccountId = req.query.subaccount_id;
  }

  // Si aún no hay valores, usar los por defecto
  if (!accountId) {
    accountId = DEFAULT_ACCOUNT_ID;
  }
  if (!subaccountId) {
    subaccountId = DEFAULT_SUBACCOUNT_ID;
  }

  // Validar que tenemos valores
  if (!accountId || !subaccountId) {
    return res.status(401).json({
      error: 'Tenant authentication required',
      message: 'Missing account_id or subaccount_id',
      code: 'TENANT_AUTH_REQUIRED'
    });
  }

  // Inyectar en el request para uso en servicios
  req.accountId = accountId;
  req.subaccountId = subaccountId;

  // Log para debugging (remover en producción)
  console.log(`[Tenant Middleware] Request authenticated - Account: ${accountId}, Subaccount: ${subaccountId}`);

  next();
}

/**
 * Middleware opcional que solo agrega tenant IDs si están disponibles
 * Útil para endpoints públicos que pueden o no tener contexto de tenant
 */
function optionalTenantMiddleware(req, res, next) {
  // Intentar obtener de headers
  let accountId = req.headers['x-account-id'] || req.headers['account-id'];
  let subaccountId = req.headers['x-subaccount-id'] || req.headers['subaccount-id'];

  // Si hay valores, inyectarlos
  if (accountId && subaccountId) {
    req.accountId = accountId;
    req.subaccountId = subaccountId;
  } else {
    // Usar valores por defecto para desarrollo
    req.accountId = DEFAULT_ACCOUNT_ID;
    req.subaccountId = DEFAULT_SUBACCOUNT_ID;
  }

  next();
}

module.exports = {
  tenantMiddleware,
  optionalTenantMiddleware,
  DEFAULT_ACCOUNT_ID,
  DEFAULT_SUBACCOUNT_ID
};