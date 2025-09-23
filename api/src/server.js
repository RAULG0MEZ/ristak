const express = require('express');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env.local') });

const { requireAuth, optionalAuth } = require('./middleware/auth.middleware');
const { attachUserTimezone } = require('./middleware/timezone.middleware');
const authRoutes = require('./routes/auth.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const contactsRoutes = require('./routes/contacts.routes');
const paymentsRoutes = require('./routes/payments.routes');
const reportsRoutes = require('./routes/reports.routes');
const campaignsRoutes = require('./routes/campaigns.routes');
const metaRoutes = require('./routes/meta.routes');
const importRoutes = require('./routes/import.routes');
const deployRoutes = require('./routes/deploy');
const webhookRoutes = require('./routes/webhooks.routes');
const configRoutes = require('./routes/config.routes');
const trackingRoutes = require('./routes/tracking.routes');
const settingsRoutes = require('./routes/settings.routes');

const isDevelopment = process.env.NODE_ENV !== 'production';

// En desarrollo, crear un middleware que auto-loguee
const devAuth = (req, res, next) => {
  // Si ya hay usuario (de un token válido), continuar
  if (req.user) {
    return next();
  }

  // En desarrollo, usar el usuario real de desarrollo (ID 3)
  req.user = {
    userId: 3,
    email: 'dev@ristak.local',
    role: 'admin'
  };

  next();
};

// En desarrollo usar devAuth, en producción requireAuth
const protectedAuth = isDevelopment ? devAuth : requireAuth;

const app = express();
const PORT = process.env.API_PORT || 3002;

// Honrar cabeceras X-Forwarded-* (Cloudflare / Nginx) para hostname y protocolo
app.set('trust proxy', true);

// CORS simple para desarrollo - permite todo
const cors = (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Origin, Accept, x-user-timezone');

  // Manejar preflight
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
};

app.use(cors);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Ristak PRO API'
  });
});

// Rutas de autenticación (sin middleware de tenant)
app.use('/api/auth', authRoutes);

// Middleware especial para Meta: OAuth es público, el resto protegido
app.use('/api/meta', (req, res, next) => {
  // Las rutas de OAuth no requieren autenticación
  const publicPaths = ['/oauth/start', '/oauth/callback'];
  const isPublicPath = publicPaths.some(path => req.path.startsWith(path));

  if (isPublicPath) {
    // OAuth paths: continuar sin autenticación
    next();
  } else {
    // Otras rutas de Meta: requieren autenticación
    protectedAuth(req, res, next);
  }
}, metaRoutes);

// Rutas autenticadas con timezone middleware
app.use('/api/dashboard', protectedAuth, attachUserTimezone, dashboardRoutes);
app.use('/api/contacts', protectedAuth, attachUserTimezone, contactsRoutes);
app.use('/api/payments', protectedAuth, attachUserTimezone, paymentsRoutes);
app.use('/api/reports', protectedAuth, attachUserTimezone, reportsRoutes);
app.use('/api/campaigns', protectedAuth, attachUserTimezone, campaignsRoutes);
app.use('/api/import', protectedAuth, attachUserTimezone, importRoutes);
app.use('/api/config', protectedAuth, configRoutes);
app.use('/api/settings', protectedAuth, attachUserTimezone, settingsRoutes);
app.use('/api/tracking', trackingRoutes); // Tracking no necesita auth

// Rutas directas para dominios de tracking personalizados
// Detecta si viene de un dominio de tracking y sirve las rutas sin /api/tracking
app.get('/snip.js', (req, res, next) => {
  req.url = '/snip.js';
  trackingRoutes(req, res, next);
});
app.post('/collect', (req, res, next) => {
  req.url = '/collect';
  trackingRoutes(req, res, next);
});

// Rutas públicas (sin tenant middleware)
app.use('/api/deploy', deployRoutes);

// Webhook Routes (sin prefijo /api)
app.use('/', webhookRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path
  });
});

// Start server
app.listen(PORT, () => {
  console.log('🚀 Ristak API Server');
  console.log(`📍 Running on: http://localhost:${PORT}`);
  console.log(`✅ Health check: http://localhost:${PORT}/health`);
  console.log(`📊 Dashboard API: http://localhost:${PORT}/api/dashboard`);
  console.log(`👥 Contacts API: http://localhost:${PORT}/api/contacts`);
  console.log(`💰 Payments API: http://localhost:${PORT}/api/payments`);
  console.log(`📈 Reports API: http://localhost:${PORT}/api/reports`);
  console.log(`📣 Campaigns API: http://localhost:${PORT}/api/campaigns`);
  console.log(`🔁 Meta API: http://localhost:${PORT}/api/meta`);
  console.log(`📥 Import API: http://localhost:${PORT}/api/import`);
  console.log(`🚀 Deploy API: http://localhost:${PORT}/api/deploy`);

  // DESHABILITADO: Job de Cloudflare ya no se usa
  // if (process.env.NODE_ENV === 'production') {
  //   try {
  //     const trackingSyncJob = require('./jobs/tracking-sync.job');
  //     trackingSyncJob.start();
  //   } catch (error) {
  //     console.error('⚠️ Could not start tracking sync job:', error.message);
  //   }
  // } else {
  //   console.log('ℹ️ Tracking sync cron job disabled (development mode)');
  // }
  console.log('ℹ️ Cloudflare tracking sync job disabled (no longer needed)');

  // JOB RETROACTIVO ELIMINADO - Ahora solo usamos _ud de GHL
  console.log('ℹ️ Contact tracking link job disabled (now using _ud only)');
});
