# 📋 Registro de Decisiones de Arquitectura (ADR)

> Este documento registra las decisiones importantes de arquitectura tomadas en el proyecto Ristak PRO.
> Formato: **[Fecha] - Título** seguido de contexto, decisión y consecuencias.

## 🚀 Decisiones de Funcionalidad y UX

### 2025-09-22 - Eliminar detección por event_name='lead'
- **Decisión**: Remover toda la lógica de detección por marcado de leads
- **Motivo**: Simplificar el sistema usando solo el método de proximidad temporal
- **Archivos modificados**: `/src/pages/Analytics.tsx`
- **Beneficio**: Código más simple y consistente sin múltiples métodos de detección

### 2025-09-20 - Sistema Global de Timezone para toda la aplicación
- **Decisión**: Implementar sistema completo de timezone donde TODO se guarda en UTC en DB
- **Problema resuelto**: Las importaciones CSV usaban timezone del navegador, causando inconsistencias
- **Implementación**:
  - Frontend convierte fechas locales a UTC antes de enviar a API
  - DB guarda todo en UTC (Timestamptz)
  - Frontend convierte UTC a timezone configurado al mostrar
  - CSV asume que fechas vienen en timezone configurado, no del navegador
- **Archivos clave**:
  - `/src/lib/dateUtils.ts` - Funciones de conversión UTC ↔ Local
  - `/src/lib/csvUtils.ts` - normalizeDate() usa timezone configurado
  - `/api/src/utils/date-utils.js` - parseStartDate/parseEndDate con timezone
  - `/api/src/middleware/timezone.middleware.js` - Agrega timezone a requests

### 2025-09-20 - Normalización de fechas de Meta a UTC durante sincronización
- **Problema**: Las fechas de Meta vienen en el timezone de la cuenta de anuncios, no en UTC
- **Decisión**: Normalizar fechas de Meta al sincronizar, no al consultar
- **Implementación**:
  - Al sincronizar datos de Meta, convertimos del timezone de la cuenta (guardado en `ad_account_timezone`) a UTC real
  - Las consultas usan directamente las fechas UTC sin ajustes adicionales
  - Frontend sigue manejando conversión para display según timezone del usuario
- **Archivos modificados**:
  - `/api/src/services/meta.service.js` - Normalización durante sync con getTimezoneOffset()
  - `/api/src/services/campaigns.service.js` - Eliminado parche temporal de +6 horas
  - `/api/migrations/add-meta-timezone.sql` - Columna para guardar timezone de cuenta Meta
- **Beneficio**: Consistencia total en manejo de fechas, sin importar desde dónde se acceda

### 2025-09-20 - Documentación completa de Timezone en Integraciones
- **Decisión**: Crear documentación específica para manejo de timezone en integraciones externas
- **Problema detectado**: Meta usa timezone de cuenta, tracking captura timezone del visitante, todo debe normalizarse
- **Motivo**: Evitar discrepancias entre datos de diferentes fuentes con diferentes timezones
- **Archivos clave documentados**:
  - `/api/src/utils/timezone-normalizer.js` - Normaliza fechas entre timezones
  - `/api/src/services/meta.service.js` - Guarda timezone de cuenta Meta
  - Campo `ad_account_timezone` en tabla `meta_configs`
- **Beneficio**: Claridad total sobre cómo se manejan los timezones en cada capa del sistema
- **Documentación**: Creada guía completa en `/docs/Timezone-Integraciones.md`

### 2025-09-20 - Centralización del manejo de fechas con dateUtils
- **Decisión**: Migrar TODO el manejo de fechas a usar funciones centralizadas en dateUtils
- **Problema detectado**: Cada archivo manejaba fechas de forma independiente con `.toISOString().split('T')[0]` y `.toLocaleDateString()`
- **Motivo**: Inconsistencias en formato, problemas de timezone mostrando fechas un día antes, código duplicado
- **Cambios realizados**:
  - Frontend: Todo usa `/src/lib/dateUtils.ts` (dateToApiString, formatDateShort, formatDateLong, etc.)
  - Backend: Mantiene consistencia con `/api/src/utils/date-utils.js`
  - Migrados: Campaigns, Payments, Reports, Settings, TrackingSection, Analytics y todos los hooks principales
- **Beneficio**: Consistencia total en fechas, menos bugs de timezone, una sola fuente de verdad
- **Documentación**: Creada guía completa en `/docs/Manejo-Fechas.md`

### 2025-01-21 - Unificación de formato de fechas en Analytics
- **Decisión**: Reemplazar `toLocaleDateString` por `formatDate` en la página de Analytics
- **Problema detectado**: Analytics era la única página que no usaba las funciones de formateo del sistema
- **Motivo**: Inconsistencias visuales y de timezone entre Analytics y el resto de la aplicación
- **Cambios realizados**:
  - Importado `formatDate` desde `../lib/utils` en Analytics.tsx
  - Reemplazadas todas las instancias de `toLocaleDateString('es-ES', dateFormat)` por `formatDate(date, dateFormat)`
  - Reemplazadas todas las instancias de `toLocaleDateString('es-ES', { month: 'short' })` por `formatDate(date, { month: 'short' })`
- **Beneficio**: Consistencia total en formato de fechas y respeto al timezone configurado por el usuario

### 2025-01-21 - Simplificación de lógica de registros en Analytics
- **Decisión**: Eliminar toda la lógica compleja de atribución y sesiones para registros
- **Problema detectado**: La lógica de atribución last-touch era demasiado compleja y no funcionaba correctamente
- **Motivo**: Los registros no aparecían porque la validación de sesiones era muy estricta
- **Cambios realizados**:
  - Eliminadas funciones: `computeContactAttribution`, `buildContactMetadata`, `normalizeContactId`, `extractVisitorId`
  - Simplificado cálculo de registros: solo cuenta contactos creados en el período (`contactsResponse.length`)
  - Eliminada validación de sesiones previas y tolerancia temporal
  - Limpiado código no utilizado y funciones obsoletas
- **Beneficio**: Los registros ahora aparecen correctamente y el código es más simple y mantenible

### 2025-01-21 - Corrección de lógica de opt-ins en Analytics
- **Decisión**: Contar solo contactos que aparecen en AMBOS (creados Y en tracking sessions)
- **Problema detectado**: La lógica anterior contaba todos los contactos creados, no solo los opt-ins reales
- **Motivo**: Necesitamos ver cuántos opt-ins se hicieron realmente, no solo contactos creados
- **Cambios realizados**:
  - Lógica de intersección: solo contactos que aparecen en `contacts` Y `tracking_sessions`
  - Evitar duplicados: usar `Set` para garantizar conteo único por contacto
  - Aplicado en: tarjeta de registros, gráfico de registros, y cálculos de tendencias
  - Debug mejorado: muestra total de contactos, contactos en sessions, y opt-ins reales
- **Beneficio**: Los registros ahora muestran opt-ins reales, no solo contactos creados

### 2025-09-21 - Columnas de tasas de conversión en tabla de campañas
- **Decisión**: Agregar columnas ocultas de tasas de conversión en la tabla de campañas
- **Motivo**: Permitir análisis detallado del embudo de conversión sin saturar la vista por defecto
- **Implementación**:
  - Web→Leads %: Visitantes que se convierten en leads (visitors → leads)
  - Leads→Citas %: Leads que agendan citas (leads → appointments)
  - Citas→Ventas %: Citas que se convierten en ventas (appointments → sales)
  - Columnas ocultas por defecto, accesibles desde configuración de columnas
  - Cálculos tanto en frontend como backend para consistencia
- **Archivos modificados**: `src/pages/Campaigns.tsx`, `api/src/services/campaigns.service.js`
- **Beneficio**: Visibilidad profunda del embudo sin sobrecargar la interfaz principal

### 2025-09-19 - Modal de contactos únicos en tabla de campañas
- **Decisión**: Implementar modal reutilizable para ver contactos únicos de cada métrica
- **Motivo**: Usuario necesita ver el detalle de quiénes conforman cada número agregado
- **Implementación**:
  - ContactDetailsModal genérico con panel dividido (lista/detalles)
  - Integrado en columnas leads, appointments y sales con ícono de búsqueda
  - Usa endpoint existente /api/campaigns/contacts
- **Beneficio**: Transparencia total en métricas, drill-down desde agregado hasta detalle individual

## 🔧 Decisiones de Configuración y Deployment

### 2025-09-18 - Corrección de URL de API en build de producción
- **Decisión**: Configurar deployment para usar URL correcta de API en producción
- **Problema detectado**: Frontend buildeado usaba paths relativos `/api` pero en producción se sirve desde dominio separado
- **Motivo**: En producción: app.hollytrack.com (frontend) ≠ send.hollytrack.com (API)
- **Solución**: Modificar deploy-secure.sh para usar `VITE_API_URL="https://${DOMAIN_SEND}/api"` durante build
- **Beneficio**: Frontend en producción ahora hace llamadas correctas a send.hollytrack.com/api

### 2025-09-18 - Limpieza de dominios: Solo funciones específicas
- **Decisión**: Configurar dominios para funciones específicas únicamente
- **Motivo**: Separación clara de responsabilidades y seguridad
- **Cambios**:
  - **ilove.hollytrack.com**: SOLO tracking (`/snip.js`, `/collect`), resto redirige a app.hollytrack.com
  - **send.hollytrack.com**: SOLO API/webhooks (puerto 3002), sin frontend
  - **app.hollytrack.com**: SOLO frontend principal (puerto 3001)
- **Beneficio**: Arquitectura más limpia, sin confusión de funciones por dominio

## 🧹 Decisiones de Limpieza y Mantenimiento

### 2025-09-18 - AUDITORÍA Y LIMPIEZA PROFUNDA DEL REPOSITORIO
- **Decisión**: Eliminar archivos basura, código muerto y consolidar funcionalidad duplicada
- **Motivo**: Repo tenía archivos peligrosos con credenciales, código duplicado y basura acumulada
- **Cambios principales**:
  - **ELIMINADOS ARCHIVOS PELIGROSOS**:
    - ecosystem.config.cjs (contenía credenciales hardcodeadas)
    - .claude-server-access (archivo temporal)
    - dist/ (build no debe estar en repo)
    - scripts/dev.sh y prod.sh (redundantes con package.json)
    - postcss.config.js (no usado)
    - src/hooks/useHistoricalData.ts (duplicado)
  - **CONSOLIDADOS SERVICIOS**: 5 archivos .metrics.service.js fusionados en servicios principales
  - **LIMPIADAS REFERENCIAS**: Removidas todas las referencias a subaccounts obsoletos
- **Beneficios**: Código más seguro, sin duplicación, más fácil de mantener

### 2025-09-18 - Consolidación de servicios de métricas
- **Decisión**: Eliminar archivos separados de métricas y consolidar todo en servicios principales
- **Motivo**: Simplificar arquitectura, eliminar duplicación de código, mantener funcionalidad centralizada
- **Cambios**:
  - Movidas métricas de contacts.metrics.service.js → contacts.service.js (método getContactMetrics)
  - Movidas métricas de payments.metrics.service.js → payments.service.js (método getPaymentMetrics)
  - Movidas métricas de reports.metrics.service.js → reports.service.js (método getReportsMetrics)
  - Creado dashboard.service.js consolidando dashboard.metrics.service.js
  - Actualizados controladores para usar servicios consolidados
  - Eliminados archivos obsoletos: *.metrics.service.js
- **Beneficios**: Menos archivos, lógica centralizada, mantenimiento más simple

## 🏗️ Decisiones de Arquitectura Mayor

### 2025-09-17 - Eliminación completa de multitenant
- **Decisión**: Remover completamente el soporte multitenant de la aplicación
- **Motivo**: Simplificar arquitectura, eliminar complejidad innecesaria
- **Cambios**:
  - Eliminadas tablas account y subaccounts de PostgreSQL
  - Creada tabla simple users para autenticación básica
  - Removido middleware tenant.middleware.js
  - Limpiados account_id, subaccount_id y tenant_id de todas las tablas
  - Renombrado SubaccountContext a SettingsContext
  - Actualizada autenticación para usar JWT simple sin tenant IDs

## 📝 Decisiones de Documentación

### 2025-09-18 - Estandarización de nombres de archivos de documentación
- **Decisión**: Cambiar formato de mayúsculas (ARCHIVO_NOMBRE.md) a capitalización correcta (Archivo-Nombre.md)
- **Motivo**: Mejorar legibilidad y seguir estándares modernos de nombrado
- **Cambios**:
  - AI_CONTEXT.md → Ai-Context.md
  - DEPLOYMENT_GUIDE.md → Deployment-Guide.md
  - VARIABLES_ENTORNO.md → Variables-Entorno.md
  - TRACKING_FLUJO_COMPLETO.md → Tracking-Flujo-Completo.md
  - Todos los archivos de docs/ actualizados al nuevo formato
  - Referencias en README y CLAUDE.md actualizadas
- **Beneficio**: Documentación más limpia y profesional, mejor organización visual

## 🔐 Decisiones de Seguridad

### 2025-09-18 - Configuración de secrets en servidor de producción
- **Decisión**: Centralizar todas las variables sensibles en archivo protegido del servidor
- **Ubicación de secrets**:
  - **SERVIDOR**: `/etc/ristak-pro/env.production` (permisos 600, solo root)
  - **LOCAL**: `/Users/raulgomez/Desktop/ristak-main/.env.local` (nunca se sube al repo)
- **Variables configuradas**:
  - META_APP_ID, META_APP_SECRET (credenciales de Facebook)
  - CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID (API de Cloudflare)
  - DATABASE_URL (conexión a PostgreSQL)
  - AUTH_SECRET (clave de sesiones)
- **Implementación**: Symlink desde `/opt/ristak-pro/api/.env` → `/etc/ristak-pro/env.production`
- **Beneficios**: Secrets fuera del código, fácil rotación, acceso restringido

### 2025-09-18 - Deploy script totalmente portable y automatizado
- **Decisión**: El script de deploy debe ser capaz de configurar un servidor pelón desde cero
- **Motivo**: Facilitar migración entre servidores sin configuración manual
- **Funcionalidades agregadas**:
  - **Auto-instalación**: Detecta e instala Node, Nginx, PM2, Certbot automáticamente
  - **Secrets automáticos**: Crea `/etc/ristak-pro/env.production` desde `.env.local`
  - **Variables dinámicas**: NADA hardcodeado, todo viene de `.env.local`
  - **PM2 con variables**: Carga las variables antes de iniciar servicios
  - **SSL automático**: Genera certificados con Let's Encrypt
- **Proceso**:
  1. Lee todas las variables desde `.env.local` local
  2. Valida que no hay credenciales hardcodeadas
  3. Detecta qué falta en el servidor e instala
  4. Crea archivo de secrets en `/etc/ristak-pro/env.production`
  5. Configura PM2 con symlink y variables cargadas
- **Beneficios**: Un comando para deployar en cualquier servidor Ubuntu nuevo

### 2025-09-19 - Configuración de dominios personalizados para tracking
- **Decisión**: Los dominios personalizados deben apuntar DIRECTAMENTE a la IP del servidor (A record)
- **Problema detectado**: CNAME a ilove.hollytrack.com falla porque Cloudflare proxy necesita custom_origin (plan Enterprise)
- **Solución correcta**:
  - Custom Hostname en Cloudflare SIN custom_origin_server (no disponible en plan actual)
  - DNS del dominio personalizado: Registro A → 5.161.90.139 (IP del servidor)
  - Nginx ya configurado para aceptar cualquier hostname con wildcard (_)
- **Configuración DNS requerida**:
  - ❌ INCORRECTO: hola.raulgomez.com.mx → CNAME → ilove.hollytrack.com (falla con proxy Cloudflare)
  - ✅ CORRECTO: hola.raulgomez.com.mx → A → 5.161.90.139 (directo al servidor)
- **Beneficio**: Tracking funciona con dominios personalizados sin necesidad de plan Enterprise

### 2025-01-19 - Unificación de tracking en una sola tabla
- **Decisión**: Eliminar tabla tracking.pageviews y usar solo tracking.sessions
- **Problema detectado**: Había dos flujos de tracking - uno guardaba pageviews individuales, otro no
- **Solución**:
  - Cada pageview ahora es una nueva fila en tracking.sessions (no UPDATE)
  - Se mantiene session_id compartido para agrupar páginas de la misma sesión
  - Se agrega id único para cada pageview individual
- **Beneficios**:
  - Customer journey completo visible
  - Código más simple sin duplicación
  - Todas las páginas visitadas se registran correctamente
- **Cambios técnicos**:
  - tracking.routes.js: INSERT siempre, nunca UPDATE
  - Eliminado método recordPageView() obsoleto
  - Migración SQL para ajustar estructura de tabla

### 2025-01-20 - Limpieza definitiva de tablas de tracking obsoletas
- **Decisión**: Confirmar eliminación de tablas tracking.events y tracking.pageviews
- **Estado actual**: Solo existe y se usa tracking.sessions
- **Script de limpieza**: api/migrations/cleanup-tracking-tables.sql
- **Nota importante**:
  - La tabla tracking.sessions almacena TODOS los eventos (no solo sesiones)
  - Cada fila = un evento/pageview con su session_id para agrupar
  - El nombre "sessions" es confuso pero funciona correctamente

### 2025-01-21 - Mejora agresiva de inyección de rstk_vid en formularios GHL
- **Problema detectado**: El rstk_vid no llegaba a los formularios de GHL, causando que contactos no se vincularan con visitor_id
- **Causa raíz**: GHL usa campos custom dinámicos que no se llaman exactamente "rstk_vid"
- **Solución implementada**:
  - Inyección automática de input hidden `rstk_vid` en TODOS los formularios de la página
  - Búsqueda inteligente de inputs GHL con patterns como "custom_fields", "customField", etc.
  - Re-intentos cada segundo por 10 segundos para capturar formularios cargados con AJAX
  - Actualización de action URL de formularios para incluir rstk_vid como parámetro
  - Detección mejorada de `_ud` con reintentos en páginas de confirmación
- **Archivos modificados**:
  - `/api/src/routes/tracking.routes.js` - función `injectRstkVidToForms()` más agresiva
- **Beneficio**: Mayor probabilidad de captura del visitor_id en formularios dinámicos

### 2025-01-21 - Sistema de fallback temporal para matching visitor-contact
- **Problema identificado**: Cuando `_ud` no se detecta a tiempo, contactos quedan sin visitor_id
- **Diseño (NO implementado)**: Sistema de matching probabilístico por proximidad temporal
- **Concepto**: Vincular visitors con contacts basado en:
  - Ventanas de tiempo (5 seg a 15 min)
  - Señales contextuales (UTMs, IPs, device fingerprint)
  - Niveles de confianza (PERFECT, HIGH, MEDIUM, LOW)
- **Documentación**: `/docs/TEMPORAL_MATCHING_SYSTEM.md`
- **Estado**: DISEÑADO pero NO IMPLEMENTADO - requiere testing extensivo

### 2025-10-03 - Identity Resolution System tipo Hyros (IMPLEMENTADO)
- **Problema detectado**: Último lead (Libni Daniel) tenía visitor_id `v1759537806230_p2ivgz7` que no existía en DB. Las sesiones estaban bajo visitor_id diferente `v1758930977842_768u66p`
- **Causa raíz**: Sistema anterior hacía UPDATE destructivos de visitor_ids, perdiendo customer journey completo. Frontend (localStorage) y Backend desincronizados.
- **Decisión**: Implementar Identity Resolution System tipo Hyros - NUNCA modificar visitor_ids originales, solo crear relaciones
- **Implementación**:
  - **Tabla**: `tracking.identity_graph` - une todos los visitor_ids, emails, phones al mismo `primary_identity_id`
  - **Servicio**: `identity.service.js` - maneja todas las operaciones de identidad (link, merge, find)
  - **Frontend sync**: snip.js actualiza localStorage cuando backend detecta unificación vía fingerprint
  - **Webhook fix**: Ahora encuentra TODAS las sesiones de TODOS los visitor_ids relacionados al contacto
  - **Migration**: 663 visitor_ids, 8 contacts, 8 emails migrados exitosamente
- **Filosofía implementada**:
  - NUNCA modificar visitor_ids originales
  - Mantener TODAS las relaciones con metadata completo (linked_at, linked_by, confidence_score)
  - Una sola fuente de verdad: primary_identity_id
  - Customer journey completo sin pérdida de información
  - Frontend y Backend sincronizados en tiempo real
- **Archivos nuevos**:
  - `/api/src/services/identity.service.js` - Servicio core de identity resolution
  - `/api/migrations/010_create_identity_graph.sql` - Tabla y función get_customer_journey()
- **Archivos modificados**:
  - `/api/src/routes/tracking.routes.js` - Usa identity system en lugar de UPDATEs destructivos
  - `/api/src/services/webhook.service.js` - linkTrackingSessions() ahora busca todos los visitor_ids relacionados
  - snip.js - Sincroniza localStorage cuando backend unifica visitor_ids por fingerprint
- **Beneficios**: Customer journey completo preservado, audit trail de todas las unificaciones, sistema robusto como Hyros

---
*Última actualización: 2025-10-03*
