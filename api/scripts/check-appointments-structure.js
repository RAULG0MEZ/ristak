const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_liGBDM5cUd2X@ep-curly-bird-adn7jer3-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

async function checkAppointmentsStructure() {
  try {
    console.log('🔍 Revisando estructura actual de appointments...');

    // Ver estructura actual
    const structureResult = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'appointments'
      ORDER BY ordinal_position;
    `);

    console.log('\n📋 ESTRUCTURA ACTUAL:');
    console.table(structureResult.rows);

    // Ver datos existentes
    const dataResult = await pool.query('SELECT COUNT(*) as total FROM appointments');
    console.log(`\n📊 DATOS EXISTENTES: ${dataResult.rows[0].total} registros`);

    if (dataResult.rows[0].total > 0) {
      const sampleResult = await pool.query('SELECT * FROM appointments LIMIT 3');
      console.log('\n📝 MUESTRA DE DATOS:');
      console.table(sampleResult.rows);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkAppointmentsStructure();