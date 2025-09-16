const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env.local') });

// Database connection pool configuration with better error handling
const databasePool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false,
  max: 5, // Reducir conexiones máximas
  min: 1, // Mantener al menos 1 conexión
  idleTimeoutMillis: 60000, // Mantener conexiones más tiempo
  connectionTimeoutMillis: 5000,
  query_timeout: 15000,
  statement_timeout: 15000,
  idle_in_transaction_session_timeout: 30000,
  // Evitar reconexiones constantes
  allowExitOnIdle: false
});

// Handle pool errors globalmente
databasePool.on('error', (err, client) => {
  console.error('🔴 Unexpected database pool error:', err);
  console.error('Error code:', err.code);
  console.error('Error detail:', err.detail);
  // No crash the app, just log the error
});

// Handle connection events
databasePool.on('connect', (client) => {
  console.log('📗 New database client connected');
});

databasePool.on('acquire', (client) => {
  // Este evento se dispara cuando un cliente es adquirido del pool
});

databasePool.on('remove', (client) => {
  console.log('📙 Database client removed from pool');
});

// Test database connection with better error handling
async function testConnection() {
  let retries = 3;
  let lastError = null;

  while (retries > 0) {
    try {
      const client = await databasePool.connect();
      console.log('✅ Connected to PostgreSQL database');

      // Verificar que las tablas principales existen
      const tablesCheckQuery = `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name IN ('contacts', 'payments', 'appointments', 'campaigns')
        ORDER BY table_name
      `;

      const result = await client.query(tablesCheckQuery);
      const tables = result.rows.map(row => row.table_name);

      console.log('📊 Available tables:', tables.join(', '));

      // Verificar columnas de payments para debug
      const columnsQuery = `
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'payments'
        AND table_schema = 'public'
        ORDER BY ordinal_position
      `;

      const columnsResult = await client.query(columnsQuery);
      const paymentColumns = columnsResult.rows.map(row => row.column_name);
      console.log('💳 Payment table columns:', paymentColumns.join(', '));

      client.release();
      return true;
    } catch (err) {
      lastError = err;
      retries--;

      if (retries > 0) {
        console.log(`⚠️ Database connection failed, retrying... (${retries} attempts left)`);
        console.log(`   Error: ${err.message}`);
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  console.error('❌ Failed to connect to database after 3 attempts');
  console.error('Last error:', lastError?.message);
  console.error('Database URL configured:', process.env.DATABASE_URL ? 'Yes' : 'No');

  // Don't crash, but log the issue
  if (!process.env.DATABASE_URL) {
    console.error('⚠️ DATABASE_URL not configured in environment variables');
  }
}

// Initialize connection test
testConnection().catch(err => {
  console.error('Failed to test database connection:', err);
});

// Wrapper function for safer queries
async function safeQuery(text, params = []) {
  let client = null;
  try {
    client = await databasePool.connect();
    const result = await client.query(text, params);
    return result;
  } catch (error) {
    console.error('Query error:', {
      message: error.message,
      query: text.substring(0, 100), // First 100 chars of query
      code: error.code,
      detail: error.detail
    });
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('📴 SIGTERM received, closing database pool...');
  await databasePool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('📴 SIGINT received, closing database pool...');
  await databasePool.end();
  process.exit(0);
});

module.exports = {
  databasePool,
  safeQuery
};