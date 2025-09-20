# 🚀 Ristak PRO - Sistema de Analytics y Tracking para E-commerce

## 📋 Descripción General

Ristak PRO es una plataforma completa de analytics y tracking diseñada para negocios de e-commerce y marketing digital. El sistema ofrece:

- **📊 Dashboard de Métricas Financieras**: Visualización en tiempo real de ingresos, gastos publicitarios, ROI y márgenes
- **🎯 Sistema de Tracking**: Monitoreo de visitantes, conversiones y comportamiento del usuario
- **💰 Gestión de Pagos**: Control detallado de transacciones, refunds y reconciliación
- **👥 Gestión de Contactos**: Base de datos de clientes con segmentación y análisis de LTV
- **📈 Reportes Avanzados**: Análisis detallado con gráficos interactivos y exportación de datos
- **🔄 Webhooks**: Integración con plataformas externas (Meta, Google Ads, etc.)

## 🏗️ Arquitectura

```
ristak-main/
├── src/                    # Frontend React + TypeScript
│   ├── pages/             # Páginas principales de la app
│   ├── modules/           # Módulos de negocio (dashboard, reportes, etc.)
│   ├── hooks/             # Custom React hooks
│   ├── contexts/          # Context API (auth, theme, date)
│   ├── ui/                # Componentes globales reutilizables
│   └── config/            # Configuración de API y constantes
├── api/                   # Backend Node.js + Express
│   ├── src/
│   │   ├── controllers/   # Controladores de rutas
│   │   ├── services/      # Lógica de negocio
│   │   ├── routes/        # Definición de endpoints
│   │   └── middleware/    # Auth y validaciones
│   └── migrations/        # Migraciones de base de datos
├── deploy/                # Scripts de deployment
│   ├── scripts/           # Scripts de deploy automático
│   └── nginx/             # Configuración de servidor
├── docs/                  # Documentación técnica
└── prisma/                # Schema de base de datos
```

## 🚀 Inicio Rápido

### Prerrequisitos
- Node.js 18+
- PostgreSQL 14+
- NPM o Yarn

### Instalación

```bash
# Clonar repositorio
git clone https://github.com/tu-usuario/ristak-main.git
cd ristak-main

# Instalar dependencias
npm install
cd api && npm install && cd ..

# Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus credenciales

# Inicializar base de datos
cd api && npx knex migrate:latest && cd ..

# Iniciar en desarrollo
npm run dev
```

### Puertos por defecto
- Frontend: http://localhost:5173
- API: http://localhost:3002
- Health Check: http://localhost:3002/health

## 📝 Scripts Disponibles

```bash
# Desarrollo
npm run dev              # Inicia frontend y backend
npm run dev:frontend     # Solo frontend
npm run dev:api          # Solo API

# Build y Deploy
npm run build            # Build de producción
npm run deploy           # Deploy automático a servidor
npm run deploy:quick     # Deploy rápido sin validaciones

# Git Workflow
npm run push             # Push seguro con validaciones
npm run quick-push       # Push rápido
npm run pull             # Pull con merge automático
npm run sync             # Sincronización completa

# Testing y Calidad
npm run lint             # Linter de código
npm run build:check      # Type checking + build
```

## 🔑 Variables de Entorno

Ver archivo `.env.example` para la lista completa. Las principales son:

```env
# Base de Datos
DB_HOST=localhost
DB_USER=tu_usuario
DB_PASSWORD=tu_password
DB_NAME=ristak_pro

# API
API_PORT=3002
JWT_SECRET=tu_secret_key

# Frontend
VITE_API_URL=http://localhost:3002/api

# Meta/Facebook (Opcional)
META_APP_ID=tu_app_id
META_APP_SECRET=tu_app_secret
```

## 📚 Documentación Adicional

- [📚 Índice de Documentación](docs/Readme.md)
- [🏗️ Arquitectura del Sistema](docs/Arquitectura.md)
- [🚀 Guía de Deployment](docs/Deployment-Guide.md)
- [🔧 Configuración de Variables](docs/Variables-Entorno.md)
- [📊 Sistema de Tracking](docs/Tracking-Flujo-Completo.md)
- [📋 Decisiones de Arquitectura](docs/Decisiones.md)
- [📜 Reglas y Estándares](docs/Reglas.md)
- [🔧 Guía de Git](docs/Git-Guide.md)

## 🔒 Seguridad

- Autenticación JWT con refresh tokens
- Rate limiting en endpoints críticos
- Validación de entrada en todos los endpoints
- Sanitización de datos para prevenir XSS/SQL Injection
- HTTPS obligatorio en producción

## 🤝 Contribuir

1. Fork el proyecto
2. Crea tu feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add: Nueva funcionalidad'`)
4. Push al branch (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Proyecto privado - Todos los derechos reservados

## 💬 Soporte

Para soporte técnico, crear un issue en GitHub o contactar al equipo de desarrollo.
