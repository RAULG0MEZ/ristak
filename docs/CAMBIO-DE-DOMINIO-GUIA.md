# 🚀 Guía para Cambiar de Dominio o Servidor - Ristak

## ✅ ¡YA ESTÁ LISTO!

Tu app ahora puede cambiar de dominio o servidor fácilmente. Todos los dominios y URLs ya vienen de variables de entorno.

## 📝 Pasos para Cambiar de Dominio

### 1. Actualizar Variables Locales (.env.local)
```bash
# Edita tu archivo .env.local
DOMAIN_APP=tu-nuevo-dominio.com          # Donde está tu frontend
DOMAIN_SEND=api.tu-nuevo-dominio.com     # Donde está tu API
DOMAIN_TRACK=track.tu-nuevo-dominio.com  # Para tracking

# También actualiza si cambias de servidor
DEPLOY_HOST=nueva.ip.del.servidor
WEBHOOK_BASE_URL=https://api.tu-nuevo-dominio.com
```

### 2. Configurar DNS en Cloudflare/Tu Proveedor
- Apunta `tu-nuevo-dominio.com` → IP del servidor
- Apunta `api.tu-nuevo-dominio.com` → IP del servidor
- Apunta `track.tu-nuevo-dominio.com` → IP del servidor

### 3. Ejecutar Deploy
```bash
cd /Users/raulgomez/Desktop/ristak-main
bash deploy/scripts/deploy-secure.sh
```

El script automáticamente:
- ✅ Actualizará todas las configuraciones de Nginx con los nuevos dominios
- ✅ Generará certificados SSL para los nuevos dominios
- ✅ Reiniciará todos los servicios
- ✅ Aplicará las variables a toda la app

### 4. Verificar
- Visita https://tu-nuevo-dominio.com
- Verifica que la API responda en https://api.tu-nuevo-dominio.com/health
- Confirma tracking en https://track.tu-nuevo-dominio.com/snip.js

## 🔄 Cambios Realizados (Lo que ya arreglé)

### ✅ Frontend (Settings.tsx)
- **ANTES:** Webhooks y tracking hardcodeados a hollytrack.com
- **AHORA:** Se cargan dinámicamente desde `/api/settings/domains-config`

### ✅ Backend (settings.routes.js)
- **NUEVO:** Endpoint `/api/settings/domains-config` que lee variables de entorno
- Devuelve configuración de webhooks y tracking basada en `DOMAIN_*`

### ✅ Nginx Config
- **ANTES:** Redirección hardcodeada a `app.hollytrack.com`
- **AHORA:** Usa variable `${DOMAIN_APP}` para redirecciones

### ✅ Tracking Service
- **MEJORADO:** Detección de dominios sociales/búsqueda ahora configurable
- Puedes agregar dominios custom con variables `SOCIAL_DOMAINS` y `SEARCH_DOMAINS`

## 🎯 Variables de Entorno Importantes

### Obligatorias para cambio de dominio:
```env
DOMAIN_APP=app.tu-dominio.com       # Frontend
DOMAIN_SEND=send.tu-dominio.com     # API/Backend
DOMAIN_TRACK=track.tu-dominio.com   # Tracking
WEBHOOK_BASE_URL=https://send.tu-dominio.com
```

### Opcionales (para personalización):
```env
# Para agregar más redes sociales al tracking
SOCIAL_DOMAINS=facebook.com,instagram.com,tiktok.com,miapp.com

# Para agregar más motores de búsqueda
SEARCH_DOMAINS=google.,bing.com,duckduckgo.com,busqueda.mx
```

## 🚨 NO OLVIDES

1. **Actualizar Meta/Facebook App:**
   - Ve a developers.facebook.com
   - Actualiza las URLs de redirect OAuth con tu nuevo dominio
   - Cambia: `https://send.tu-nuevo-dominio.com/api/meta/oauth/callback`

2. **Actualizar Webhooks Externos:**
   - Si tienes servicios externos que envían webhooks
   - Actualiza las URLs a tu nuevo dominio

3. **Limpiar Cache del Navegador:**
   - Los usuarios pueden necesitar limpiar cache
   - O forzar refresh con Ctrl+Shift+R

## 🎉 ¡LISTO!

Tu app ahora es **100% portable**. Puedes moverla a cualquier servidor o cambiar de dominios solo actualizando el `.env.local` y ejecutando el deploy.

### Tiempo total para cambiar de dominio: ~15 minutos

---
*Actualizado: 2025-09-20*
*Todos los hardcoded han sido eliminados* 🔥