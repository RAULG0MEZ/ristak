const cron = require('node-cron');
const trackingService = require('../services/tracking.service');

class TrackingSyncJob {
  constructor() {
    this.task = null;
    this.isRunning = false;
  }

  // Iniciar el cron job
  start() {
    // Ejecutar cada hora en el minuto 0
    // '0 * * * *' = Al minuto 0 de cada hora
    this.task = cron.schedule('0 * * * *', async () => {
      if (this.isRunning) {
        console.log('⏭️ Sync job already running, skipping...');
        return;
      }

      this.isRunning = true;
      console.log('🔄 Starting scheduled Cloudflare sync...');

      try {
        const startTime = Date.now();
        const result = await trackingService.syncWithCloudflare();
        const duration = Date.now() - startTime;

        console.log(`✅ Scheduled sync completed in ${duration}ms`);
        console.log(`   Added: ${result.added}, Updated: ${result.updated}, Removed: ${result.removed}`);
      } catch (error) {
        console.error('❌ Scheduled sync failed:', error.message);
      } finally {
        this.isRunning = false;
      }
    });

    console.log('✅ Tracking sync cron job started (runs every hour)');

    // Ejecutar una sincronización inicial al arrancar
    this.runOnce();
  }

  // Ejecutar sincronización una vez (para inicio o manual)
  async runOnce() {
    if (this.isRunning) {
      console.log('⏭️ Sync already in progress');
      return;
    }

    this.isRunning = true;
    console.log('🔄 Running initial Cloudflare sync...');

    try {
      const result = await trackingService.syncWithCloudflare();
      console.log('✅ Initial sync completed');
      console.log(`   Added: ${result.added}, Updated: ${result.updated}, Removed: ${result.removed}`);
      return result;
    } catch (error) {
      console.error('❌ Initial sync failed:', error.message);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  // Detener el cron job
  stop() {
    if (this.task) {
      this.task.stop();
      this.task = null;
      console.log('🛑 Tracking sync cron job stopped');
    }
  }

  // Verificar si está activo
  isActive() {
    return this.task !== null;
  }
}

module.exports = new TrackingSyncJob();