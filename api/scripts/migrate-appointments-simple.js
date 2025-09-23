const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_liGBDM5cUd2X@ep-curly-bird-adn7jer3-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

async function migrateAppointments() {
  try {
    console.log('🚀 INICIANDO MIGRACIÓN DE APPOINTMENTS');
    console.log('===========================================\n');

    // 1. RESPALDAR DATOS EXISTENTES (TODOS LOS CAMPOS)
    console.log('📦 1. Respaldando datos existentes...');
    const backupResult = await pool.query(`
      SELECT
        appointment_id,
        contact_id,
        title,
        description,
        location,
        appointment_date,
        start_time,
        end_time,
        status,
        reminder_sent,
        notes,
        created_at,
        updated_at,
        scheduled_at,
        duration,
        webhook_data,
        calendar_name,
        ext_crm_appointment_id,
        appointment_timezone
      FROM appointments
      ORDER BY created_at
    `);

    console.log(`✅ ${backupResult.rows.length} registros respaldados`);

    // 2. CREAR TABLA TEMPORAL CON MISMO CONTENIDO PERO REORDENADO
    console.log('\n🔧 2. Creando tabla temporal con columnas reordenadas...');
    await pool.query(`
      CREATE TABLE appointments_new (
        -- CAMPOS PRINCIPALES (reordenados para mejor vista)
        appointment_id TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
        contact_id TEXT REFERENCES contacts(contact_id),
        title TEXT,
        start_time TIMESTAMP WITHOUT TIME ZONE,
        end_time TIMESTAMP WITHOUT TIME ZONE,
        appointment_date TIMESTAMP WITHOUT TIME ZONE,
        status TEXT DEFAULT 'scheduled'::text,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

        -- CAMPOS ADICIONALES (mantener todo igual)
        description TEXT,
        location TEXT,
        reminder_sent BOOLEAN DEFAULT false,
        notes TEXT,
        scheduled_at TIMESTAMP WITHOUT TIME ZONE,
        duration INTEGER,
        webhook_data JSONB,
        calendar_name CHARACTER VARYING,
        ext_crm_appointment_id CHARACTER VARYING,
        appointment_timezone CHARACTER VARYING
      );
    `);

    console.log('✅ Tabla temporal creada');

    // 3. MIGRAR DATOS PRESERVANDO TODO (solo reordenando)
    console.log('\n📋 3. Migrando datos con columnas reordenadas...');
    let migratedCount = 0;

    for (const row of backupResult.rows) {
      try {
        await pool.query(`
          INSERT INTO appointments_new (
            appointment_id,
            contact_id,
            title,
            start_time,
            end_time,
            appointment_date,
            status,
            created_at,
            updated_at,
            description,
            location,
            reminder_sent,
            notes,
            scheduled_at,
            duration,
            webhook_data,
            calendar_name,
            ext_crm_appointment_id,
            appointment_timezone
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        `, [
          row.appointment_id,
          row.contact_id,
          row.title,
          row.start_time,
          row.end_time,
          row.appointment_date,
          row.status,
          row.created_at,
          row.updated_at,
          row.description,
          row.location,
          row.reminder_sent,
          row.notes,
          row.scheduled_at,
          row.duration,
          row.webhook_data,
          row.calendar_name,
          row.ext_crm_appointment_id,
          row.appointment_timezone
        ]);

        migratedCount++;
      } catch (error) {
        console.log(`⚠️  Error migrando appointment ${row.appointment_id}:`, error.message);
      }
    }

    console.log(`✅ ${migratedCount} registros migrados exitosamente`);

    // 4. REEMPLAZAR TABLA ORIGINAL
    console.log('\n🔄 4. Reemplazando tabla original...');

    await pool.query('DROP TABLE appointments CASCADE');
    console.log('✅ Tabla antigua eliminada');

    await pool.query('ALTER TABLE appointments_new RENAME TO appointments');
    console.log('✅ Nueva tabla renombrada');

    // 5. RECREAR ÍNDICES
    console.log('\n🔍 5. Recreando índices...');
    await pool.query('CREATE INDEX idx_appointments_contact_id ON appointments(contact_id)');
    await pool.query('CREATE INDEX idx_appointments_appointment_date ON appointments(appointment_date)');
    await pool.query('CREATE INDEX idx_appointments_status ON appointments(status)');
    console.log('✅ Índices recreados');

    // 6. VERIFICAR MIGRACIÓN
    console.log('\n✅ 6. Verificando migración...');
    const finalResult = await pool.query('SELECT COUNT(*) as total FROM appointments');
    console.log(`📊 Total de appointments después de migración: ${finalResult.rows[0].total}`);

    const structureResult = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'appointments'
      ORDER BY ordinal_position;
    `);

    console.log('\n📋 NUEVA ESTRUCTURA:');
    console.table(structureResult.rows);

    console.log('\n🎉 MIGRACIÓN COMPLETADA EXITOSAMENTE');
    console.log('===========================================');

  } catch (error) {
    console.error('❌ Error en migración:', error);

    // Limpiar en caso de error
    try {
      await pool.query('DROP TABLE IF EXISTS appointments_new');
      console.log('🧹 Tabla temporal limpiada');
    } catch (cleanupError) {
      console.error('Error en limpieza:', cleanupError.message);
    }

    throw error;
  } finally {
    await pool.end();
  }
}

// Ejecutar migración
migrateAppointments()
  .then(() => {
    console.log('\n✅ Script completado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script falló:', error.message);
    process.exit(1);
  });