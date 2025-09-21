# 🔍 REPORTE: URLs y Dominios Hardcodeados en Ristak

## 📊 Resumen Ejecutivo

¡Verga, carnal! Encontré un chingo de URLs y dominios hardcodeados por toda la app. La buena noticia es que la mayoría ya están usando variables de entorno, pero hay algunas cosas que debes arreglar para poder cambiar de servidor o dominio sin pedos.

## 🚨 HALLAZGOS CRÍTICOS (ARREGLAR YA!)

### 1. Settings.tsx - Webhooks Hardcodeados
**Archivo:** `/src/pages/Settings.tsx`
**Líneas:** 33-43
```javascript
webhook_base_url: 'https://send.hollytrack.com',
webhook_endpoints: {
  contacts: 'https://send.hollytrack.com/webhook/contacts',
  appointments: 'https://send.hollytrack.com/webhook/appointments',
  payments: 'https://send.hollytrack.com/webhook/payments',
  refunds: 'https://send.hollytrack.com/webhook/refunds'
},
tracking: {
  host: 'ilove.hollytrack.com',
  snippet_url: 'https://ilove.hollytrack.com/snip.js',
  snippet_code: '<script defer src="https://ilove.hollytrack.com/snip.js"></script>'
}
```
**PROBLEMA:** Estos valores están hardcodeados como defaults en el estado del componente.
**SOLUCIÓN:** Deberían venir del backend o de variables de entorno.

### 2. Nginx Config - Redirección Hardcodeada
**Archivo:** `/deploy/nginx/ilove.hollytrack.com`
**Línea:** 62
```nginx
return 301 https://app.hollytrack.com$request_uri;
```
**PROBLEMA:** Si cambias de dominio, las redirecciones de tracking apuntarán al dominio viejo.
**SOLUCIÓN:** Usar variable ${DOMAIN_APP} en lugar de hardcodear.

### 3. Base de Datos - URL en archivos locales
**Archivo:** `/.env.local` y `/.claude/settings.local.json`
```
DATABASE_URL=postgresql://neondb_owner:npg_liGBDM5cUd2X@ep-curly-bird-adn7jer3-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require
```
**PROBLEMA:** La URL de la base de datos está visible en varios archivos.
**SOLUCIÓN:** Ya está bien manejado con variables de entorno, pero asegúrate de NO commitear estos archivos.

## ✅ LO QUE YA ESTÁ BIEN

### Variables de Entorno Funcionando Correctamente:
- ✅ Frontend usa `VITE_API_URL` para conectar al backend
- ✅ Backend usa variables para DATABASE_URL, META_*, CLOUDFLARE_*
- ✅ Deploy script usa variables desde `.env.local`
- ✅ Nginx configs usan variables ${DOMAIN_*} (casi todo)

### Archivos que NO tienen problemas:
- `vite.config.ts` - Usa variables de entorno correctamente
- `api/src/server.js` - No tiene dominios hardcodeados
- `.env.production` - Usa variables correctamente

## 🛠️ PLAN DE ACCIÓN PARA ARREGLAR

### Prioridad Alta (hacer YA):

1. **Settings.tsx** - Cargar configuración desde el backend
   ```javascript
   // En lugar de hardcodear, hacer fetch al backend:
   useEffect(() => {
     fetch('/api/settings/account-config')
       .then(res => res.json())
       .then(config => setAccountConfig(config))
   }, [])
   ```

2. **Nginx tracking config** - Cambiar redirección hardcodeada
   ```nginx
   location / {
       return 301 https://${DOMAIN_APP}$request_uri;
   }
   ```

### Prioridad Media:

3. **Crear endpoint de configuración dinámica**
   - Endpoint `/api/config/domains` que devuelva todos los dominios actuales
   - Cachear esta config en el frontend

4. **Tracking service** - Hacer más flexible la detección de dominios
   ```javascript
   // En lugar de hardcodear facebook.com, instagram.com, etc.
   // Usar una lista configurable desde variables de entorno
   ```

### Prioridad Baja (mejoras):

5. **Centralizar toda la configuración**
   - Crear un archivo `config/domains.js` que exporte todas las URLs
   - Usar este archivo en todos lados en lugar de repetir

## 📋 CHECKLIST PARA MIGRACIÓN FÁCIL

Cuando quieras cambiar de servidor o dominios, solo necesitas:

- [ ] Actualizar `.env.local` con nuevos dominios
- [ ] Actualizar `.env.production` en el servidor
- [ ] Ejecutar el script de deploy
- [ ] Actualizar DNS en Cloudflare
- [ ] Renovar certificados SSL

## 🔐 SEGURIDAD

### ⚠️ IMPORTANTE:
- **NUNCA** commitees `.env.local` al repositorio
- **NUNCA** hardcodees passwords o API keys en el código
- La DATABASE_URL contiene credenciales - manéjala con cuidado

### Ya está protegido:
- ✅ `.env.local` está en `.gitignore`
- ✅ Script de deploy valida que no hay credenciales hardcodeadas
- ✅ Permisos 600 en archivos sensibles del servidor

## 📊 RESUMEN DE ARCHIVOS AFECTADOS

| Archivo | URLs Hardcodeadas | Prioridad | Estado |
|---------|------------------|-----------|--------|
| `/src/pages/Settings.tsx` | hollytrack.com | ALTA | ❌ Por arreglar |
| `/deploy/nginx/ilove.hollytrack.com` | app.hollytrack.com | ALTA | ❌ Por arreglar |
| `/src/services/tracking.service.js` | facebook.com, google.com, etc | MEDIA | ⚠️ Funcional pero mejorable |
| `.env.local` | DATABASE_URL, dominios | - | ✅ OK (no commitear) |
| `.env.production` | Todos los dominios | - | ✅ OK (usa variables) |

## 🚀 CONCLUSIÓN

La app está **80% lista** para cambiar de servidor fácilmente. Los principales problemas están en:
1. Settings.tsx con valores hardcodeados
2. Una línea en la config de Nginx

Si arreglas esos dos pinches archivos, podrás mover tu app a cualquier servidor o cambiar de dominios sin broncas. El resto ya está bien estructurado con variables de entorno.

**Tiempo estimado para arreglar todo:** 2-3 horas máximo

---
*Generado el: 2025-09-20*
*Por: Claude (tu asistente culero pero efectivo)*