# Configuración de OAuth con Meta (Facebook)

## Configuración en Meta for Developers

### 1. Accede a tu aplicación de Meta
1. Ve a [Meta for Developers](https://developers.facebook.com/)
2. Selecciona tu aplicación (ID: 1385880239181925)

### 2. Configurar Valid OAuth Redirect URIs

En la sección **Facebook Login > Settings**, agrega TODAS estas URLs en "Valid OAuth Redirect URIs":

```
http://localhost:3000/api/meta/oauth/callback
http://localhost:3001/api/meta/oauth/callback
http://localhost:3002/api/meta/oauth/callback
http://localhost:3003/api/meta/oauth/callback
http://127.0.0.1:3000/api/meta/oauth/callback
http://127.0.0.1:3001/api/meta/oauth/callback
http://127.0.0.1:3002/api/meta/oauth/callback
http://127.0.0.1:3003/api/meta/oauth/callback
```

### 3. Configurar dominios permitidos

En **Settings > Basic**, añade estos dominios en "App Domains":
- localhost
- 127.0.0.1

### 4. Configurar Website URL

En **Settings > Basic**, en la sección "Website", añade:
- Site URL: `http://localhost:3000`

## Configuración Local del Proyecto

### 1. Variables de entorno

Crea un archivo `.env.local` basándote en `.env.example`:

```bash
cp .env.example .env.local
```

### 2. Configura las siguientes variables:

```env
# Meta OAuth
META_APP_ID=1385880239181925
META_APP_SECRET=tu_app_secret_aqui
META_REDIRECT_URI=http://localhost:3002/api/meta/oauth/callback

# API Configuration
API_PORT=3002
API_BASE_URL=http://localhost:3002/api
VITE_API_URL=http://localhost:3002/api
```

### 3. Para diferentes puertos

Si necesitas usar un puerto diferente (ej. 3001), actualiza:

```env
API_PORT=3001
API_BASE_URL=http://localhost:3001/api
META_REDIRECT_URI=http://localhost:3001/api/meta/oauth/callback
VITE_API_URL=http://localhost:3001/api
```

## Solución de problemas

### Error: "URL Blocked"
- Asegúrate de que la URL de callback esté exactamente igual en Meta y en tu `.env.local`
- Verifica que incluiste el puerto correcto
- Espera 5 minutos después de hacer cambios en Meta for Developers

### Error: "Invalid OAuth redirect_uri"
- La URL debe coincidir EXACTAMENTE con una de las URLs configuradas en Meta
- Incluye el protocolo (http://), host, puerto y path completo

### Conectar desde diferentes localhost
El sistema ahora soporta automáticamente:
- `http://localhost:3000` - Frontend default de Vite
- `http://localhost:3002` - Backend API default
- `http://localhost:3001` - Puerto alternativo
- `http://127.0.0.1:*` - Usando IP en lugar de localhost

## Testing

1. Inicia el backend:
```bash
cd api
npm run dev
```

2. Inicia el frontend:
```bash
npm run dev
```

3. Ve a Settings → Integraciones → Meta Ads → Conectar

4. Deberías ser redirigido a Facebook para autorizar

5. Después de autorizar, serás redirigido de vuelta a tu aplicación

## Notas de seguridad

- **NUNCA** commits las credenciales reales de Meta
- Usa variables de entorno diferentes para desarrollo y producción
- En producción, usa HTTPS siempre
- Rota el `META_APP_SECRET` regularmente