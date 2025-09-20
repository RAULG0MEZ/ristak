# 🏗️ Arquitectura de Ristak PRO

## 📊 Visión General

Ristak PRO es una plataforma de analytics y tracking para e-commerce construida con una arquitectura moderna y escalable.

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                         │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────────────────┐ │
│  │  Dashboard  │ │   Reportes   │ │  Gestión (Pagos, etc)    │ │
│  └─────────────┘ └──────────────┘ └──────────────────────────┘ │
└─────────────────────────────┬───────────────────────────────────┘
                              │ HTTP/HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API GATEWAY (Express)                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │
│  │   Auth   │ │   CORS   │ │ Rate Lim │ │   Validation    │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘  │
└─────────────────────────────┬───────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐   ┌──────────────────┐  ┌──────────────────┐
│   Services    │   │   Controllers    │  │    Webhooks      │
│  - Dashboard  │   │  - Payments      │  │  - Meta/FB       │
│  - Reports    │   │  - Contacts      │  │  - Tracking      │
│  - Campaigns  │   │  - Campaigns     │  │  - External      │
└───────┬───────┘   └────────┬─────────┘  └────────┬─────────┘
        │                    │                      │
        └────────────────────┼──────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     PostgreSQL Database                          │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐  │
│  │  Payments  │ │  Contacts  │ │  Sessions  │ │   Events   │  │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## 🔧 Stack Tecnológico

### Frontend
- **Framework**: React 19 con TypeScript
- **Bundler**: Vite 7
- **Estilado**: Tailwind CSS 3
- **Gráficos**: Recharts
- **Routing**: React Router DOM v7
- **State Management**: Context API + Custom Hooks
- **Iconos**: Lucide React + Lobehub Icons

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express 5
- **Base de Datos**: PostgreSQL 14+
- **ORM**: Knex.js + Prisma
- **Autenticación**: JWT (jsonwebtoken)
- **Validación**: Middleware personalizado

### DevOps
- **Deploy**: Scripts bash automatizados
- **Servidor Web**: Nginx
- **Monitoreo**: Health checks integrados
- **CI/CD**: GitHub Actions (opcional)

## 📁 Estructura de Carpetas

### Frontend (`/src`)
```
src/
├── pages/              # Páginas principales (Login, Dashboard, etc.)
├── modules/            # Módulos de negocio
│   ├── dashboard/     # Componentes del dashboard
│   ├── reports/       # Módulos de reportes
│   └── tracking/      # Sistema de tracking
├── hooks/             # Custom React hooks
│   ├── useDashboardMetrics.ts
│   ├── usePayments.ts
│   └── useContacts.ts
├── contexts/          # React Context providers
│   ├── AuthContext.tsx
│   ├── ThemeContext.tsx
│   └── DateContext.tsx
├── ui/                # Componentes reutilizables
│   ├── Alert.tsx
│   ├── Button.tsx
│   └── Modal.tsx
├── lib/              # Utilidades y helpers
└── config/           # Configuración y constantes
```

### Backend (`/api`)
```
api/
├── src/
│   ├── controllers/   # Controladores de endpoints
│   │   ├── dashboard.controller.js
│   │   ├── payments.controller.js
│   │   └── contacts.controller.js
│   ├── services/      # Lógica de negocio
│   │   ├── dashboard.service.js
│   │   ├── payments.service.js
│   │   └── tracking.service.js
│   ├── routes/        # Definición de rutas
│   │   ├── dashboard.routes.js
│   │   ├── payments.routes.js
│   │   └── tracking.routes.js
│   ├── middleware/    # Middlewares
│   │   └── auth.middleware.js
│   └── server.js      # Entry point del servidor
├── migrations/        # Migraciones de DB
└── scripts/          # Scripts de utilidad
```

## 🔐 Seguridad

### Autenticación y Autorización
- **JWT Tokens**: Con expiración y refresh
- **Sesiones**: Almacenadas en DB con TTL
- **Rate Limiting**: Por IP y usuario
- **CORS**: Configuración estricta por dominio

### Protección de Datos
- **Encriptación**: Tokens y datos sensibles encriptados
- **Validación**: Entrada sanitizada en todos los endpoints
- **SQL Injection**: Prevención con prepared statements
- **XSS**: Headers de seguridad y sanitización

### Mejores Prácticas
- Variables de entorno para secretos
- HTTPS obligatorio en producción
- Logs de auditoría para acciones críticas
- Backups automáticos de DB

## 🚀 Flujos Principales

### 1. Flujo de Tracking
```
Usuario visita sitio → snip.js cargado →
Evento capturado → POST /collect →
Validación → Guardado en DB →
Analytics procesados
```

### 2. Flujo de Dashboard
```
Login → JWT generado →
Request metrics → Agregación de datos →
Response con métricas →
Renderizado en gráficos
```

### 3. Flujo de Pagos
```
Webhook recibido → Validación firma →
Procesamiento → Actualización DB →
Notificación → Dashboard actualizado
```

## 🔄 Patrones de Diseño

### Repository Pattern
Separación entre lógica de negocio y acceso a datos:
```javascript
Controller → Service → Repository → Database
```

### Middleware Pipeline
Procesamiento secuencial de requests:
```javascript
Request → Auth → Validation → Controller → Response
```

### Context Pattern (Frontend)
Estado global compartido:
```javascript
AuthContext → ThemeContext → DateContext → Component
```

## 📈 Escalabilidad

### Estrategias Actuales
- **Lazy Loading**: Carga diferida de componentes
- **Paginación**: En todas las listas grandes
- **Índices DB**: Optimización de queries
- **Caché**: Headers de caché para assets

### Preparación para Escalar
- **Microservicios Ready**: Servicios desacoplados
- **Queue Ready**: Estructura para agregar queues
- **CDN Ready**: Assets estáticos separados
- **DB Sharding Ready**: IDs únicos globales

## 🔍 Monitoreo

### Health Checks
- `/health` - Estado del servidor
- `/api/status` - Estado de servicios

### Métricas
- Latencia de endpoints
- Tasa de error
- Uso de recursos
- Queries lentas

### Logs
- Structured logging con niveles
- Request IDs para trazabilidad
- Rotación automática

## 🛠️ Mantenimiento

### Tareas Regulares
- Actualización de dependencias
- Limpieza de logs antiguos
- Optimización de queries
- Revisión de seguridad

### Backups
- DB: Diario automático
- Código: Git + GitHub
- Configuración: Versionada

---
*Última actualización: 2025-09-18*