# 🔧 Documentación de Variables de Entorno - Ristak PRO

## 📋 Índice
1. [Configuración Base](#configuración-base)
2. [Base de Datos](#base-de-datos)
3. [API de Meta (Facebook)](#api-de-meta-facebook)
4. [Cloudflare](#cloudflare)
5. [Servidor de Producción](#servidor-de-producción)
6. [Scripts de Inicio](#scripts-de-inicio)

---

## 🔥 Configuración Base

| Variable | Descripción | Desarrollo | Producción |
|----------|-------------|------------|------------|
| `NODE_ENV` | Entorno de ejecución | `development` | `production` |
| `PORT` | Puerto del frontend | `5173` | `5173` |
| `VITE_PORT` | Puerto de Vite | `5173` | `5173` |
| `API_PORT` | Puerto del API | `3002` | `3002` |
| `VITE_API_URL` | URL base del API para frontend | `http://localhost:3002` | `https://tu-dominio.com` |
| `API_BASE_URL` | URL base del API | `http://localhost:3002/api` | `https://tu-dominio.com/api` |
| `TRACK_HOST` | Host principal de tracking | `https://localhost:3002` | `https://tu-dominio.com` |
| `TRACKING_HOST` | Subdominio de tracking | `localhost` | `track.tu-dominio.com` |
| `ALLOWED_HOSTS` | Hosts permitidos por CORS | `localhost` | `tu-dominio.com,track.tu-dominio.com` |

---

## 💾 Base de Datos

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `DATABASE_URL` | URL completa de conexión PostgreSQL | `postgresql://user:pass@host/db?sslmode=require` |

### Formato de DATABASE_URL:
```
postgresql://[usuario]:[contraseña]@[host]:[puerto]/[base_de_datos]?sslmode=require
```

---

## 🔗 API de Meta (Facebook)

| Variable | Descripción | Dónde obtener |
|----------|-------------|---------------|
| `META_APP_ID` | ID de tu aplicación en Meta | [Meta Developers](https://developers.facebook.com/apps) |
| `META_APP_SECRET` | Secreto de la aplicación | Panel de configuración de tu app |
| `META_ENCRYPTION_KEY` | Clave para encriptar tokens | Generar con: `openssl rand -hex 32` |
| `META_GRAPH_VERSION` | Versión del Graph API | `v23.0` (actualizar según Meta) |
| `META_REDIRECT_URI` | URL de callback OAuth | `http://localhost:3002/api/meta/oauth/callback` |
| `ACCOUNT_ID` | ID de cuenta principal | Tu dashboard |
| `VITE_ACCOUNT_ID` | ID de cuenta para frontend | Mismo que `ACCOUNT_ID` |
| `DEFAULT_SUBACCOUNT_ID` | ID de subcuenta por defecto | Tu dashboard |
| `VITE_DEFAULT_SUBACCOUNT_ID` | ID de subcuenta para frontend | Mismo que `DEFAULT_SUBACCOUNT_ID` |

---

## ☁️ Cloudflare

| Variable | Descripción | Dónde obtener |
|----------|-------------|---------------|
| `CLOUDFLARE_API_TOKEN` | Token de API de Cloudflare | [Dashboard Cloudflare](https://dash.cloudflare.com/profile/api-tokens) |
| `CLOUDFLARE_ZONE_ID` | ID de tu zona/dominio | Dashboard de tu dominio en Cloudflare |

### Permisos necesarios del token:
- Zone:DNS:Edit
- Zone:Zone:Read

---

## 🖥️ Servidor de Producción

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `HETZNER_HOST` | IP o dominio del servidor | `5.161.90.139` |
| `HETZNER_USER` | Usuario SSH | `root` o `deploy` |
| `HETZNER_SSH_KEY_PATH` | Ruta a la llave SSH | `~/.ssh/hetzner_deploy` |
| `HETZNER_PORT` | Puerto SSH | `22` |

---

## 🚀 Scripts de Inicio

### Desarrollo
```bash
# Usar el script de desarrollo
./scripts/dev.sh

# O directamente con npm
npm run dev
```

### Producción
```bash
# Usar el script de producción
./scripts/prod.sh

# O con variables específicas
NODE_ENV=production npm run api
```

---

## 📝 Archivos de Configuración

### `.env` (Desarrollo)
Archivo principal con todas las variables para desarrollo local.

### `.env.production` (Producción)
Archivo con variables específicas de producción (NO commitear).

### `.env.example` (Plantilla)
Plantilla con todas las variables necesarias sin valores sensibles.

---

## 🔒 Seguridad

### ⚠️ IMPORTANTE:
1. **NUNCA** commitear archivos `.env` con credenciales reales
2. Agregar `.env*` a `.gitignore` (excepto `.env.example`)
3. Usar diferentes credenciales para desarrollo y producción
4. Rotar las credenciales regularmente
5. Usar variables de entorno del sistema en producción cuando sea posible

### Generar claves seguras:
```bash
# Para META_ENCRYPTION_KEY o cualquier secreto
openssl rand -hex 32

# Para contraseñas
openssl rand -base64 32
```

---

## 🐛 Troubleshooting

### La app no conecta con el API
- Verificar que `VITE_API_URL` apunte al puerto correcto
- Comprobar que `API_PORT` coincida con el puerto real del API
- Revisar CORS en `ALLOWED_HOSTS`

### Error de Meta OAuth
- Verificar `META_REDIRECT_URI` coincida con la configuración en Meta
- Asegurar que `META_APP_ID` y `META_APP_SECRET` sean correctos
- Comprobar que la app esté en modo "Live" en Meta

### Cloudflare no funciona
- Verificar permisos del token
- Comprobar que `CLOUDFLARE_ZONE_ID` sea correcto
- Revisar que el token no haya expirado

---

## 📚 Referencias

- [Vite - Variables de Entorno](https://vitejs.dev/guide/env-and-mode.html)
- [Meta Graph API](https://developers.facebook.com/docs/graph-api)
- [Cloudflare API](https://developers.cloudflare.com/api)
- [PostgreSQL Connection Strings](https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING)