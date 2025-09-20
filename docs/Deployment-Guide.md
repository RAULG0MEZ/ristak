# 🚀 GUÍA DE DEPLOYMENT - RISTAK PRO

## 📋 Resumen Ejecutivo

Este documento explica el proceso completo de deployment para Ristak Pro, garantizando que **tanto el frontend como el backend (API) se desplieguen y ejecuten correctamente**.

## ⚠️ Problema Anterior y Solución

### Problema Identificado (17 Sep 2025)
El script de deployment anterior **NO configuraba el backend correctamente**:
- No creaba el archivo `.env` para el API
- No verificaba que el backend estuviera corriendo
- Nginx apuntaba al puerto incorrecto (5173 dev en lugar de 3001 prod)
- No había verificación post-deploy

### Solución Implementada
1. **Creación automática de `.env`** en `/opt/ristak-pro/api/`
2. **Inicio del backend ANTES que el frontend**
3. **Verificación de salud** de ambos servicios
4. **Nginx corregido** para apuntar a puertos correctos

## 🔧 Configuración Inicial

### 1. Archivo `.env.local` (Local - NUNCA subir al repo)

```bash
# Crear archivo con credenciales reales
cp .env.example .env.local
chmod 600 .env.local
```

Variables **REQUERIDAS** en `.env.local`:
```bash
# === SERVIDOR ===
DEPLOY_HOST=5.161.90.139
DEPLOY_USER=root
DEPLOY_PASSWORD=tu_password_segura

# === BASE DE DATOS ===
DATABASE_URL=postgresql://user:pass@host/database?sslmode=require

# === CUENTAS ===
ACCOUNT_ID=acc_XXXXXXXXXX
DEFAULT_ACCOUNT_ID=acc_XXXXXXXXXX
DEFAULT_SUBACCOUNT_ID=suba_XXXXXXXXXX

# === TRACKING ===
TRACKING_HOST=ilove.hollytrack.com
TRACKING_DOMAIN=ilove.hollytrack.com
```

## 📦 Proceso de Deployment

### Deployment Completo
```bash
cd /Users/raulgomez/Desktop/ristak-main
bash api/deploy/scripts/deploy-secure.sh
```

### Opciones Disponibles
```bash
# Solo validar sin deployar
bash api/deploy/scripts/deploy-secure.sh --validate-only

# Saltar build del frontend (usa dist existente)
bash api/deploy/scripts/deploy-secure.sh --skip-build

# Deployment rápido sin validaciones exhaustivas
bash api/deploy/scripts/deploy-secure.sh --quick
```

## 🔄 Flujo del Script de Deployment

```mermaid
graph TD
    A[Inicio] --> B[Validar Seguridad]
    B --> C[Cargar .env.local]
    C --> D[Configurar .env en Servidor]
    D --> E[Build Frontend]
    E --> F[Transferir Archivos]
    F --> G[Configurar Nginx]
    G --> H[Iniciar Backend API]
    H --> I{Backend OK?}
    I -->|Sí| J[Iniciar Frontend]
    I -->|No| K[Error y Logs]
    J --> L[Verificar Servicios]
    L --> M[Verificar Endpoints]
    M --> N[Fin Exitoso]
```

## ✅ Verificaciones Post-Deploy

El script verifica automáticamente:

### 1. Servicios PM2
```bash
✅ ristak-api (Backend) - Puerto 3002
✅ ristak-frontend - Puerto 3001
```

### 2. Endpoints Públicos
```bash
✅ https://app.hollytrack.com (Frontend)
✅ http://localhost:3002/health (Backend interno)
✅ https://ilove.hollytrack.com/snip.js (Tracking)
✅ https://ilove.hollytrack.com/collect (Collect)
```

### 3. Base de Datos
```bash
✅ Conexión PostgreSQL activa
```

## 🔍 Verificación Manual

### Verificar Estado en Servidor
```bash
# Conectar al servidor
ssh root@5.161.90.139

# Ver servicios PM2
pm2 list

# Ver logs del backend
pm2 logs ristak-api

# Ver logs del frontend
pm2 logs ristak-frontend

# Verificar puertos
netstat -tuln | grep -E ':3001|:3002'

# Test de salud del API
curl http://localhost:3002/health
```

### Verificar Tracking
```bash
# Obtener script de tracking
curl -I "https://ilove.hollytrack.com/snip.js?s=suba_QdlZXvGOBk7DVhy"

# Enviar evento de prueba
curl -X POST "https://ilove.hollytrack.com/collect" \
  -H "Content-Type: application/json" \
  -d '{"sid":"suba_QdlZXvGOBk7DVhy","vid":"test","sess":"test","url":"test"}'
```

## 🚨 Solución de Problemas

### Backend no arranca
```bash
# En el servidor
cd /opt/ristak-pro/api

# Verificar que .env existe
cat .env

# Verificar dependencias
npm install

# Iniciar manualmente
pm2 start src/server.js --name ristak-api

# Ver logs de error
pm2 logs ristak-api --lines 100
```

### Frontend no carga
```bash
# Verificar que dist existe
ls -la /opt/ristak-pro/dist

# Reiniciar servicio
pm2 restart ristak-frontend

# Verificar nginx
nginx -t
systemctl reload nginx
```

### Tracking no funciona
```bash
# Verificar configuración nginx
cat /etc/nginx/sites-enabled/ilove.hollytrack.com

# Verificar que backend responde
curl http://localhost:3002/api/tracking/snip.js?s=test

# Ver logs de tracking
tail -f /var/log/nginx/tracking-access.log
```

## 📊 Arquitectura de Producción

```
┌─────────────────────────────────────────────────────┐
│                    NGINX (80/443)                   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  app.hollytrack.com → localhost:3001 (Frontend)    │
│  ilove.hollytrack.com/snip.js → localhost:3002/api │
│  ilove.hollytrack.com/collect → localhost:3002/api │
│                                                     │
└─────────────────────────────────────────────────────┘
                           │
        ┌──────────────────┴──────────────────┐
        │                                      │
┌───────▼────────┐                 ┌──────────▼─────────┐
│   Frontend     │                 │   Backend API      │
│   PM2: 3001    │                 │   PM2: 3002        │
│                │                 │                    │
│  React + Vite  │ ◄──────────────►│  Node.js/Express  │
│    (Static)    │      API         │                   │
└────────────────┘                 └──────────┬─────────┘
                                              │
                                   ┌──────────▼─────────┐
                                   │   PostgreSQL       │
                                   │   (Neon Cloud)     │
                                   └────────────────────┘
```

## 🔒 Seguridad

### Credenciales
- **NUNCA** hardcodear passwords en scripts
- Usar `.env.local` con permisos `600`
- Variables sensibles solo en servidor

### Archivos Excluidos del Deploy
```
.env*
*.secret
*.key
*.pem
node_modules/
.git/
```

### Permisos en Servidor
```bash
/opt/ristak-pro/api/.env → 600 (solo lectura para owner)
/var/log/ristak-pro/ → 755
```

## 📝 Checklist Pre-Deploy

- [ ] `.env.local` existe con todas las variables
- [ ] Base de datos accesible desde servidor
- [ ] Puerto 3002 libre para backend
- [ ] Puerto 3001 libre para frontend
- [ ] Certificados SSL activos
- [ ] Nginx configurado correctamente
- [ ] PM2 instalado en servidor

## 🎯 Script de Prueba Completa

```bash
#!/bin/bash
# test-deployment.sh

echo "🔍 Probando deployment..."

# Test Frontend
curl -s -o /dev/null -w "Frontend: %{http_code}\n" https://app.hollytrack.com

# Test Backend (interno)
ssh root@5.161.90.139 "curl -s -o /dev/null -w 'Backend: %{http_code}\n' http://localhost:3002/health"

# Test Tracking
curl -s -o /dev/null -w "Tracking: %{http_code}\n" "https://ilove.hollytrack.com/snip.js?s=test"

# Test Collect
curl -s -X POST "https://ilove.hollytrack.com/collect" \
  -H "Content-Type: application/json" \
  -d '{"sid":"test","vid":"test","sess":"test","url":"test"}' \
  -o /dev/null -w "Collect: %{http_code}\n"

echo "✅ Prueba completada"
```

## 📞 Soporte

Si el deployment falla:
1. Revisar logs: `pm2 logs`
2. Verificar este documento
3. Revisar `/var/log/ristak-pro/deployments.log`
4. Contactar al equipo con logs específicos

---

**Última actualización:** 17 de Septiembre de 2025
**Versión del script:** deploy-secure.sh v3.1