const { databasePool } = require('../config/database.config');

async function checkFingerprints() {
  try {
    console.log('🔍 Verificando fingerprints en la base de datos...\n');

    // 1. Contar sesiones con fingerprints
    const countQuery = `
      SELECT
        COUNT(*) as total_sessions,
        COUNT(canvas_fingerprint) as with_canvas,
        COUNT(webgl_fingerprint) as with_webgl,
        COUNT(screen_fingerprint) as with_screen,
        COUNT(audio_fingerprint) as with_audio,
        COUNT(fonts_fingerprint) as with_fonts,
        COUNT(device_signature) as with_device_sig
      FROM tracking.sessions
      WHERE created_at > NOW() - INTERVAL '1 hour';
    `;

    const countResult = await databasePool.query(countQuery);
    const stats = countResult.rows[0];

    console.log('📊 ESTADÍSTICAS DE FINGERPRINTING (última hora):');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Total sesiones: ${stats.total_sessions}`);
    console.log(`Con Canvas FP: ${stats.with_canvas} (${((stats.with_canvas/stats.total_sessions)*100).toFixed(1)}%)`);
    console.log(`Con WebGL FP: ${stats.with_webgl} (${((stats.with_webgl/stats.total_sessions)*100).toFixed(1)}%)`);
    console.log(`Con Screen FP: ${stats.with_screen} (${((stats.with_screen/stats.total_sessions)*100).toFixed(1)}%)`);
    console.log(`Con Audio FP: ${stats.with_audio} (${((stats.with_audio/stats.total_sessions)*100).toFixed(1)}%)`);
    console.log(`Con Fonts FP: ${stats.with_fonts} (${((stats.with_fonts/stats.total_sessions)*100).toFixed(1)}%)`);
    console.log(`Con Device Signature: ${stats.with_device_sig} (${((stats.with_device_sig/stats.total_sessions)*100).toFixed(1)}%)`);

    // 2. Mostrar las últimas 5 sesiones con fingerprints
    const recentQuery = `
      SELECT
        session_id,
        visitor_id,
        contact_id,
        created_at,
        canvas_fingerprint,
        webgl_fingerprint,
        screen_fingerprint,
        device_signature,
        ip,
        timezone
      FROM tracking.sessions
      WHERE created_at > NOW() - INTERVAL '1 hour'
      ORDER BY created_at DESC
      LIMIT 5;
    `;

    const recentResult = await databasePool.query(recentQuery);

    console.log('\n📝 ÚLTIMAS SESIONES CON FINGERPRINTS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    recentResult.rows.forEach((session, index) => {
      console.log(`${index + 1}. Sesión ${session.session_id}`);
      console.log(`   Visitor ID: ${session.visitor_id}`);
      console.log(`   Contact ID: ${session.contact_id || 'Sin asignar'}`);
      console.log(`   Creada: ${session.created_at}`);
      console.log(`   Canvas FP: ${session.canvas_fingerprint ? session.canvas_fingerprint.substring(0, 30) + '...' : 'NULL'}`);
      console.log(`   WebGL: ${session.webgl_fingerprint || 'NULL'}`);
      console.log(`   Screen: ${session.screen_fingerprint || 'NULL'}`);
      console.log(`   Device Sig: ${session.device_signature || 'NULL'}`);
      console.log(`   IP: ${session.ip} | TZ: ${session.timezone}`);
      console.log('');
    });

    // 3. Buscar dispositivos duplicados (mismo fingerprint)
    const duplicatesQuery = `
      WITH device_groups AS (
        SELECT
          device_signature,
          COUNT(DISTINCT visitor_id) as unique_visitors,
          COUNT(*) as total_sessions,
          array_agg(DISTINCT visitor_id) as visitor_ids
        FROM tracking.sessions
        WHERE
          device_signature IS NOT NULL
          AND created_at > NOW() - INTERVAL '7 days'
        GROUP BY device_signature
        HAVING COUNT(DISTINCT visitor_id) > 1
      )
      SELECT * FROM device_groups
      ORDER BY unique_visitors DESC
      LIMIT 5;
    `;

    const duplicatesResult = await databasePool.query(duplicatesQuery);

    if (duplicatesResult.rows.length > 0) {
      console.log('\n🔄 DISPOSITIVOS CON MÚLTIPLES VISITOR IDs:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('(Candidatos para unificación cross-device)\n');

      duplicatesResult.rows.forEach((device) => {
        console.log(`Device Signature: ${device.device_signature}`);
        console.log(`  - ${device.unique_visitors} visitor IDs diferentes`);
        console.log(`  - ${device.total_sessions} sesiones totales`);
        console.log(`  - Visitor IDs: ${device.visitor_ids.slice(0, 3).join(', ')}${device.visitor_ids.length > 3 ? '...' : ''}`);
        console.log('');
      });
    } else {
      console.log('\n✅ No se encontraron dispositivos con múltiples visitor IDs (normal en ambiente de prueba)');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error verificando fingerprints:', error);
    process.exit(1);
  }
}

checkFingerprints();