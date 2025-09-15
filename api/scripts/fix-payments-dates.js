const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_liGBDM5cUd2X@ep-curly-bird-adn7jer3-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

async function fixPaymentDates() {
  try {
    console.log('Actualizando fechas de pagos...');
    
    // Actualizar paid_at con el valor de created_at para pagos completados
    const updateResult = await pool.query(`
      UPDATE payments 
      SET paid_at = created_at 
      WHERE paid_at IS NULL 
      AND status IN ('completed', 'refunded')
    `);
    
    console.log(`Se actualizaron ${updateResult.rowCount} pagos con paid_at = created_at`);
    
    // Verificar el resultado
    const verifyResult = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(paid_at) as con_paid_at,
        MIN(paid_at) as fecha_min,
        MAX(paid_at) as fecha_max
      FROM payments
    `);
    
    const stats = verifyResult.rows[0];
    console.log('\nEstadísticas después de la actualización:');
    console.log(`Total de pagos: ${stats.total}`);
    console.log(`Pagos con paid_at: ${stats.con_paid_at}`);
    console.log(`Fecha mínima: ${stats.fecha_min}`);
    console.log(`Fecha máxima: ${stats.fecha_max}`);
    
    console.log('\n✅ Fechas de pagos actualizadas correctamente');
    
  } catch (error) {
    console.error('Error actualizando fechas:', error);
  } finally {
    await pool.end();
  }
}

fixPaymentDates();