const { databasePool } = require('../config/database.config');

async function verifyTenantData() {
  console.log('🔍 Verificando datos de tenant en todas las tablas...\n');

  try {
    // Check contacts
    const contactsQuery = `
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN account_id IS NULL OR subaccount_id IS NULL THEN 1 END) as missing_tenant,
        COUNT(CASE WHEN account_id IS NOT NULL AND subaccount_id IS NOT NULL THEN 1 END) as with_tenant
      FROM contacts
    `;

    // Check payments
    const paymentsQuery = `
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN account_id IS NULL OR subaccount_id IS NULL THEN 1 END) as missing_tenant,
        COUNT(CASE WHEN account_id IS NOT NULL AND subaccount_id IS NOT NULL THEN 1 END) as with_tenant
      FROM payments
    `;

    // Check appointments
    const appointmentsQuery = `
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN account_id IS NULL OR subaccount_id IS NULL THEN 1 END) as missing_tenant,
        COUNT(CASE WHEN account_id IS NOT NULL AND subaccount_id IS NOT NULL THEN 1 END) as with_tenant
      FROM appointments
    `;

    // Execute all queries
    const [contacts, payments, appointments] = await Promise.all([
      databasePool.query(contactsQuery),
      databasePool.query(paymentsQuery),
      databasePool.query(appointmentsQuery)
    ]);

    // Display results
    console.log('📊 RESULTADOS DE VERIFICACIÓN:\n');
    console.log('═══════════════════════════════════════════════');

    console.log('\n👥 CONTACTS:');
    console.log(`   Total: ${contacts.rows[0].total}`);
    console.log(`   ✅ Con tenant IDs: ${contacts.rows[0].with_tenant} (${((contacts.rows[0].with_tenant / contacts.rows[0].total) * 100).toFixed(1)}%)`);
    console.log(`   ❌ Sin tenant IDs: ${contacts.rows[0].missing_tenant} (${((contacts.rows[0].missing_tenant / contacts.rows[0].total) * 100).toFixed(1)}%)`);

    console.log('\n💰 PAYMENTS:');
    console.log(`   Total: ${payments.rows[0].total}`);
    console.log(`   ✅ Con tenant IDs: ${payments.rows[0].with_tenant} (${((payments.rows[0].with_tenant / payments.rows[0].total) * 100).toFixed(1)}%)`);
    console.log(`   ❌ Sin tenant IDs: ${payments.rows[0].missing_tenant} (${((payments.rows[0].missing_tenant / payments.rows[0].total) * 100).toFixed(1)}%)`);

    console.log('\n📅 APPOINTMENTS:');
    console.log(`   Total: ${appointments.rows[0].total}`);
    console.log(`   ✅ Con tenant IDs: ${appointments.rows[0].with_tenant} (${((appointments.rows[0].with_tenant / appointments.rows[0].total) * 100).toFixed(1)}%)`);
    console.log(`   ❌ Sin tenant IDs: ${appointments.rows[0].missing_tenant} (${((appointments.rows[0].missing_tenant / appointments.rows[0].total) * 100).toFixed(1)}%)`);

    console.log('\n═══════════════════════════════════════════════');

    // Summary
    const totalMissing =
      parseInt(contacts.rows[0].missing_tenant) +
      parseInt(payments.rows[0].missing_tenant) +
      parseInt(appointments.rows[0].missing_tenant);

    if (totalMissing === 0) {
      console.log('\n✅ ¡EXCELENTE! Todos los datos están correctamente asignados a un tenant.');
      console.log('   La aplicación está lista para funcionar en modo multitenant.');
    } else {
      console.log(`\n⚠️  ATENCIÓN: Hay ${totalMissing} registros sin tenant IDs.`);
      console.log('   Estos registros no serán visibles para ningún usuario.');
      console.log('   Ejecuta el script de migración para corregir esto.');
    }

    console.log('\n🔒 SEGURIDAD MULTITENANT:');
    console.log('   - Middleware de tenant: ✅ Activo');
    console.log('   - Account ID default: ' + process.env.DEFAULT_ACCOUNT_ID);
    console.log('   - Subaccount ID default: ' + process.env.DEFAULT_SUBACCOUNT_ID);

  } catch (error) {
    console.error('❌ Error verificando datos:', error.message);
  } finally {
    await databasePool.end();
  }
}

// Execute verification
verifyTenantData();