const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function removeRefundsTable() {
  console.log('🚀 Iniciando eliminación de tabla refunds...\n');

  try {
    // 1. Eliminar índices de la tabla refunds
    console.log('📋 Eliminando índices de refunds...');
    const indexesToDrop = [
      'idx_refunds_account',
      'idx_refunds_payment',
      'idx_refunds_transaction',
      'idx_refunds_status'
    ];

    for (const indexName of indexesToDrop) {
      try {
        await pool.query(`DROP INDEX IF EXISTS ${indexName};`);
        console.log(`  ✅ Índice ${indexName} eliminado`);
      } catch (e) {
        console.log(`  ⚠️ Error eliminando índice ${indexName}:`, e.message);
      }
    }

    // 2. Eliminar la tabla refunds
    console.log('\n💰 Eliminando tabla refunds...');
    await pool.query('DROP TABLE IF EXISTS refunds CASCADE;');
    console.log('  ✅ Tabla refunds eliminada');

    // 3. Verificar que la columna status en payments incluye 'refunded'
    console.log('\n🔍 Verificando columna status en payments...');
    const checkConstraint = await pool.query(`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'payments'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%status%';
    `);

    if (checkConstraint.rows.length > 0) {
      console.log('  ℹ️ Constraint actual:', checkConstraint.rows[0].definition);
    }

    // 4. Actualizar constraint de status si es necesario
    console.log('\n📝 Actualizando constraint de status en payments...');

    // Primero, eliminar constraint existente si existe
    await pool.query(`
      ALTER TABLE payments
      DROP CONSTRAINT IF EXISTS payments_status_check;
    `).catch(err => {
      console.log('  ℹ️ No había constraint previo de status');
    });

    // Agregar nuevo constraint que incluya 'refunded'
    await pool.query(`
      ALTER TABLE payments
      ADD CONSTRAINT payments_status_check
      CHECK (status IN ('pending', 'completed', 'failed', 'refunded', 'cancelled'));
    `);
    console.log('  ✅ Constraint de status actualizado');

    console.log('\n========================================');
    console.log('✅ MIGRACIÓN COMPLETADA EXITOSAMENTE');
    console.log('========================================\n');

    // Verificar resultado
    console.log('📊 Verificando resultado:\n');

    // Verificar que la tabla refunds no existe
    const refundsExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'refunds'
      );
    `);

    if (!refundsExists.rows[0].exists) {
      console.log('✅ Tabla refunds eliminada correctamente');
    } else {
      console.log('❌ La tabla refunds aún existe');
    }

    // Verificar columnas de payments
    const paymentsColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'payments'
      AND column_name = 'status'
      ORDER BY ordinal_position;
    `);

    if (paymentsColumns.rows.length > 0) {
      console.log('✅ Columna status en payments:', paymentsColumns.rows[0]);
    }

  } catch (error) {
    console.error('❌ Error en la migración:', error.message);
    console.error('Detalles:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

removeRefundsTable();