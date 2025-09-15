const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const dashboardRoutes = require('./routes/dashboard.routes');
const contactsRoutes = require('./routes/contacts.routes');
const paymentsRoutes = require('./routes/payments.routes');
const reportsRoutes = require('./routes/reports.routes');
const campaignsRoutes = require('./routes/campaigns.routes');
const metaRoutes = require('./routes/meta.routes');
const importRoutes = require('./routes/import.routes');
const deployRoutes = require('./routes/deploy');
const subaccountRoutes = require('./routes/subaccount.routes');
const webhookRoutes = require('./routes/webhooks.routes');
const configRoutes = require('./routes/config.routes');

const app = express();
const PORT = process.env.API_PORT || 5001; // PUERTO DEFINITIVO API: 5001

// Middleware configuration
app.use(cors({
  origin: function (origin, callback) {
    // Lista de orígenes permitidos
    const allowedOrigins = [
      'http://localhost:5173', // PUERTO DEFINITIVO FRONTEND (Vite default)
      'http://localhost:5001', // PUERTO DEFINITIVO API
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5001',
      'https://app.hollytrack.com',
      'https://hollytrack.com'
    ];
    
    // Permitir si no hay origen (Postman, curl) o si está en la lista
    // También permitir 'null' para archivos HTML abiertos directamente
    if (!origin || origin === 'null' || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      // Permitir cualquier puerto de localhost
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS: ' + origin));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));
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

// API Routes
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/campaigns', campaignsRoutes);
app.use('/api/meta', metaRoutes);
app.use('/api/import', importRoutes);
app.use('/api/deploy', deployRoutes);
app.use('/api/subaccount', subaccountRoutes);
app.use('/api/config', configRoutes);

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
  console.log('🚀 Ristak PRO API Server');
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
});
