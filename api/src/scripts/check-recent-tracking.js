const { Client } = require('pg');

async function checkRecentTracking() {
  const client = new Client({
    connectionString: 'postgresql://neondb_owner:npg_liGBDM5cUd2X@ep-curly-bird-adn7jer3-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require'
  });

  try {
    await client.connect();
    console.log('🔍 Verificando tracking reciente en PRODUCCIÓN...\n');

    // 1. Últimas 10 sesiones
    const recentQuery = `
      SELECT
        session_id,
        visitor_id,
        created_at,
        canvas_fingerprint,
        webgl_fingerprint,
        screen_fingerprint,
        audio_fingerprint,
        fonts_fingerprint,
        device_signature,
        landing_host,
        ip
      FROM tracking.sessions
      ORDER BY created_at DESC
      LIMIT 10;
    `;

    const result = await client.query(recentQuery);

    console.log('📊 ÚLTIMAS 10 SESIONES:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    result.rows.forEach((session, index) => {
      console.log(`${index + 1}. Sesión: ${session.session_id.substring(0, 20)}...`);
      console.log(`   Visitor: ${session.visitor_id}`);
      console.log(`   Creada: ${new Date(session.created_at).toLocaleString()}`);
      console.log(`   Host: ${session.landing_host} | IP: ${session.ip}`);
      console.log(`   Fingerprints:`);
      console.log(`     Canvas: ${session.canvas_fingerprint ? '✅ SÍ' : '❌ NO'}`);
      console.log(`     WebGL: ${session.webgl_fingerprint ? '✅ SÍ' : '❌ NO'}`);
      console.log(`     Screen: ${session.screen_fingerprint ? '✅ SÍ' : '❌ NO'}`);
      console.log(`     Audio: ${session.audio_fingerprint ? '✅ SÍ' : '❌ NO'}`);
      console.log(`     Fonts: ${session.fonts_fingerprint ? '✅ SÍ' : '❌ NO'}`);
      console.log(`     Device Sig: ${session.device_signature ? '✅ SÍ' : '❌ NO'}`);
      console.log('');
    });

    // 2. Estadísticas de fingerprints
    const statsQuery = `
      SELECT
        COUNT(*) as total,
        COUNT(canvas_fingerprint) as with_canvas,
        COUNT(webgl_fingerprint) as with_webgl,
        COUNT(screen_fingerprint) as with_screen,
        COUNT(audio_fingerprint) as with_audio,
        COUNT(fonts_fingerprint) as with_fonts,
        COUNT(device_signature) as with_device_sig
      FROM tracking.sessions
      WHERE created_at > NOW() - INTERVAL '1 hour';
    `;

    const statsResult = await client.query(statsQuery);
    const stats = statsResult.rows[0];

    console.log('📈 ESTADÍSTICAS (última hora):');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Total sesiones: ${stats.total}`);
    if (stats.total > 0) {
      console.log(`Con Canvas: ${stats.with_canvas} (${((stats.with_canvas/stats.total)*100).toFixed(1)}%)`);
      console.log(`Con WebGL: ${stats.with_webgl} (${((stats.with_webgl/stats.total)*100).toFixed(1)}%)`);
      console.log(`Con Screen: ${stats.with_screen} (${((stats.with_screen/stats.total)*100).toFixed(1)}%)`);
      console.log(`Con Audio: ${stats.with_audio} (${((stats.with_audio/stats.total)*100).toFixed(1)}%)`);
      console.log(`Con Fonts: ${stats.with_fonts} (${((stats.with_fonts/stats.total)*100).toFixed(1)}%)`);
      console.log(`Con Device Sig: ${stats.with_device_sig} (${((stats.with_device_sig/stats.total)*100).toFixed(1)}%)`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkRecentTracking();