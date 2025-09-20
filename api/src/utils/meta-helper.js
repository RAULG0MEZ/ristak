const { databasePool } = require('../config/database.config');

/**
 * Helper para verificar si la tabla meta.meta_ads existe
 * @returns {Promise<boolean>} true si la tabla existe, false si no
 */
async function checkMetaAdsTableExists() {
  try {
    const result = await databasePool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'meta'
        AND table_name = 'meta_ads'
      )
    `);
    return result.rows[0].exists;
  } catch (error) {
    console.error('Error checking meta_ads table:', error);
    return false;
  }
}

/**
 * Helper para obtener datos de Meta Ads si la tabla existe
 * @param {string} query - Query SQL a ejecutar
 * @param {Array} params - Parámetros para la query
 * @returns {Promise<Object>} Resultado de la query o objeto vacío
 */
async function queryMetaAdsIfExists(query, params = []) {
  try {
    const tableExists = await checkMetaAdsTableExists();

    if (!tableExists) {
      console.log('Meta ads table does not exist, returning empty result');
      return { rows: [] };
    }

    return await databasePool.query(query, params);
  } catch (error) {
    console.error('Error querying meta_ads:', error);
    return { rows: [] };
  }
}

module.exports = {
  checkMetaAdsTableExists,
  queryMetaAdsIfExists
};