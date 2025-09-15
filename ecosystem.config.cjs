module.exports = {
  apps: [
    {
      name: 'ristak-backend',
      script: './api/src/server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://neondb_owner:npg_liGBDM5cUd2X@ep-curly-bird-adn7jer3-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require',
        DEFAULT_SUBACCOUNT_ID: 'suba_QdlZXvGOBk7DVhy',
        ACCOUNT_ID: 'acc_CuyyY8Nnhiua8V',
        API_PORT: 3002,
        WEBHOOK_SECRET: 'webhook_secret_key_production'
      },
      error_file: '/opt/ristak-pro/logs/backend-error.log',
      out_file: '/opt/ristak-pro/logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      max_memory_restart: '500M',
      autorestart: true,
      watch: false
    },
    {
      name: 'ristak-frontend',
      script: 'serve',
      args: '-s dist -l 3001',
      interpreter: 'none',
      env: {
        NODE_ENV: 'production'
      },
      error_file: '/opt/ristak-pro/logs/frontend-error.log',
      out_file: '/opt/ristak-pro/logs/frontend-out.log',
      max_memory_restart: '300M',
      autorestart: true
    }
  ]
};