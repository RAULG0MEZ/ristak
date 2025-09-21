const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigrationProd() {
  // Usar la conexión directa a Neon (producción)
  const client = new Client({
    connectionString: 'postgresql://neondb_owner:npg_liGBDM5cUd2X@ep-curly-bird-adn7jer3-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require'
  });

  try {
    await client.connect();
    console.log('🚀 Conectado a base de datos de PRODUCCIÓN (Neon)');

    // Leer el archivo SQL
    const sqlPath = path.join(__dirname, '../../migrations/add_fingerprinting_columns.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📝 Ejecutando migración de fingerprinting en PRODUCCIÓN...');

    // Ejecutar el SQL
    await client.query(sql);

    console.log('✅ Migración completada exitosamente en PRODUCCIÓN');
    console.log('📊 Columnas agregadas:');
    console.log('  - canvas_fingerprint');
    console.log('  - webgl_fingerprint');
    console.log('  - screen_fingerprint');
    console.log('  - audio_fingerprint');
    console.log('  - fonts_fingerprint');
    console.log('  - device_signature');
    console.log('  - fingerprint_probability');

    // Verificar que las columnas existan
    const checkQuery = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'tracking'
        AND table_name = 'sessions'
        AND column_name IN (
          'canvas_fingerprint', 'webgl_fingerprint', 'screen_fingerprint',
          'audio_fingerprint', 'fonts_fingerprint', 'device_signature',
          'fingerprint_probability'
        )
      ORDER BY column_name;
    `;

    const result = await client.query(checkQuery);

    console.log('\n📋 Verificación de columnas en PRODUCCIÓN:');
    if (result.rows.length === 0) {
      console.log('❌ No se encontraron las columnas - puede que ya existan o haya un error');
    } else {
      result.rows.forEach(row => {
        console.log(`  ✓ ${row.column_name}: ${row.data_type}`);
      });
    }

  } catch (error) {
    console.error('❌ Error ejecutando migración en PRODUCCIÓN:', error.message);
    console.error('Detalles:', error);
  } finally {
    await client.end();
    console.log('🔒 Conexión cerrada');
  }
}

runMigrationProd();