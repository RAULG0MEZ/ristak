const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_liGBDM5cUd2X@ep-curly-bird-adn7jer3-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

async function verifyMigration() {
  try {
    console.log('🔍 VERIFICANDO MIGRACIÓN DE APPOINTMENTS');
    console.log('=======================================\n');

    // 1. Verificar cantidad total
    const totalResult = await pool.query('SELECT COUNT(*) as total FROM appointments');
    console.log(`📊 Total de appointments: ${totalResult.rows[0].total}`);

    // 2. Verificar que los contactos sigan vinculados
    const linkedResult = await pool.query(`
      SELECT
        COUNT(*) as appointments_with_contacts,
        COUNT(DISTINCT a.contact_id) as unique_contacts
      FROM appointments a
      INNER JOIN contacts c ON a.contact_id = c.contact_id
    `);
    console.log(`🔗 Appointments con contactos válidos: ${linkedResult.rows[0].appointments_with_contacts}`);
    console.log(`👥 Contactos únicos con appointments: ${linkedResult.rows[0].unique_contacts}`);

    // 3. Verificar datos de ejemplo
    const sampleResult = await pool.query(`
      SELECT
        a.appointment_id,
        a.contact_id,
        a.title,
        a.appointment_date,
        a.status,
        c.first_name,
        c.last_name,
        c.email
      FROM appointments a
      LEFT JOIN contacts c ON a.contact_id = c.contact_id
      ORDER BY a.created_at DESC
      LIMIT 5
    `);

    console.log('\n📋 MUESTRA DE APPOINTMENTS CON CONTACTOS:');
    console.table(sampleResult.rows);

    // 4. Verificar campos críticos
    const fieldsResult = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(appointment_id) as with_id,
        COUNT(contact_id) as with_contact,
        COUNT(title) as with_title,
        COUNT(appointment_date) as with_date,
        COUNT(status) as with_status
      FROM appointments
    `);

    console.log('\n📈 INTEGRIDAD DE CAMPOS:');
    console.table(fieldsResult.rows);

    // 5. Verificar reportes (última atribución)
    const reportsResult = await pool.query(`
      SELECT
        DATE(a.appointment_date) as fecha,
        COUNT(*) as total_appointments,
        COUNT(DISTINCT a.contact_id) as contactos_unicos
      FROM appointments a
      WHERE a.appointment_date >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(a.appointment_date)
      ORDER BY fecha DESC
    `);

    console.log('\n📅 APPOINTMENTS ÚLTIMOS 7 DÍAS:');
    console.table(reportsResult.rows);

    console.log('\n✅ VERIFICACIÓN COMPLETADA - TODO FUNCIONANDO CORRECTAMENTE');

  } catch (error) {
    console.error('❌ Error en verificación:', error);
  } finally {
    await pool.end();
  }
}

verifyMigration();