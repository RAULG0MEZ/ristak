# CONFIGURACIÓN DEFINITIVA DE PUERTOS - RISTAK PRO

## 🚨 CONFIGURACIÓN OBLIGATORIA - NO CAMBIAR

### Puertos Definitivos:
- **Frontend (Vite)**: http://localhost:5173
- **Backend API**: http://localhost:5001

## 📋 Configuración Actual

### 1. Variables de Entorno (.env)
```env
# PUERTOS DEFINITIVOS - NO CAMBIAR
PORT=5173           # Puerto del frontend
VITE_PORT=5173      # Puerto de Vite (default)
API_PORT=5001       # Puerto de la API
VITE_API_URL=http://localhost:5001
```

### 2. Configuración de Vite (vite.config.ts)
```javascript
server: {
  port: 5173,        // PUERTO DEFINITIVO (default de Vite)
  strictPort: false, // Permite flexibilidad si está ocupado
  proxy: {
    '/api': {
      target: 'http://localhost:5001'  // API SIEMPRE EN 5001
    }
  }
}
```

### 3. Configuración del Backend (api/src/server.js)
```javascript
const PORT = process.env.API_PORT || 5001; // PUERTO DEFINITIVO API: 5001
```

## 🚀 Cómo Iniciar la Aplicación

### Opción 1: Iniciar Frontend y Backend Juntos (RECOMENDADO)
```bash
npm run dev
```
Esto ejecutará ambos servicios automáticamente:
- Frontend en http://localhost:5173
- Backend API en http://localhost:5001

### Opción 2: Iniciar Por Separado
```bash
# Terminal 1: Frontend
npm run dev:frontend

# Terminal 2: Backend API
npm run dev:api
```

## 🔧 Solución de Problemas

### Error: "Puerto ya está en uso"

**Paso 1: Ver qué proceso está usando el puerto**
```bash
# Para ver qué está usando el puerto 5173
lsof -i :5173

# Para ver qué está usando el puerto 5001
lsof -i :5001
```

**Paso 2: Matar el proceso**
```bash
# Opción A: Matar por PID (reemplaza 12345 con el PID real)
kill -9 12345

# Opción B: Matar todos los procesos en los puertos
lsof -ti:5173 | xargs kill -9
lsof -ti:5001 | xargs kill -9
```

**Paso 3: Reiniciar la aplicación**
```bash
npm run dev
```

### Script de Limpieza Rápida
Si tienes problemas frecuentes, puedes usar este comando para limpiar y reiniciar:
```bash
# Mata todos los procesos y reinicia
lsof -ti:5173,5001 | xargs kill -9 2>/dev/null; npm run dev
```

## ⚠️ IMPORTANTE PARA CLAUDE AI

Esta configuración está DEFINITIVA y debe usarse SIEMPRE:
- **NUNCA** cambies los puertos 5173 y 5001
- **SIEMPRE** usa las variables de entorno configuradas
- El puerto 5173 es el puerto default de Vite (evita conflictos con macOS)
- Si algo no funciona, primero verifica que los puertos estén libres

## 📝 Notas Adicionales

1. **Para Desarrollo Local**: Siempre usa `npm run dev` para iniciar ambos servicios
2. **Para Producción**: Los puertos pueden ser diferentes según el servidor
3. **Variables de Entorno**: Están en `.env` en la raíz del proyecto
4. **CORS**: Ya está configurado para permitir conexiones entre 5173 y 5001

## 🔄 Actualizaciones Realizadas

- ✅ Archivo `.env` actualizado con puertos definitivos
- ✅ `vite.config.ts` configurado con puerto 5173 (default de Vite)
- ✅ `api/src/server.js` actualizado para usar puerto 5001
- ✅ `package.json` actualizado con script `npm run dev` para correr ambos
- ✅ Instalado `concurrently` para ejecutar frontend y backend juntos
- ✅ CORS configurado para permitir comunicación entre puertos

---

**Última actualización**: Enero 2025
**Configuración validada y funcionando correctamente**