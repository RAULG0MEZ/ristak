const fs = require('fs');
const path = require('path');
const { databasePool } = require('../config/database.config');

async function runMigration() {
  try {
    // Leer el archivo SQL
    const sqlPath = path.join(__dirname, '../../migrations/add_fingerprinting_columns.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('🚀 Ejecutando migración de fingerprinting...');

    // Ejecutar el SQL
    await databasePool.query(sql);

    console.log('✅ Migración completada exitosamente');
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

    const result = await databasePool.query(checkQuery);

    console.log('\n📋 Verificación de columnas:');
    result.rows.forEach(row => {
      console.log(`  ✓ ${row.column_name}: ${row.data_type}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error ejecutando migración:', error);
    process.exit(1);
  }
}

runMigration();