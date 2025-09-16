#!/bin/bash

# Script para iniciar la aplicación en modo producción
# Carga variables de entorno desde .env.production

set -e  # Salir si hay algún error

echo "🚀 Iniciando Ristak PRO en modo PRODUCCIÓN"
echo "============================================"

# Cargar variables de entorno de producción
if [ -f .env.production ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
    echo "✅ Variables de producción cargadas desde .env.production"
elif [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
    echo "⚠️  Usando .env (no se encontró .env.production)"
else
    echo "❌ No se encontró archivo de configuración"
    echo "   Crea .env.production con las variables de producción"
    exit 1
fi

# Configurar modo producción
export NODE_ENV=production
echo "📝 NODE_ENV=$NODE_ENV"

# Verificar variables críticas
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL no configurada"
    exit 1
fi

if [ -z "$VITE_API_URL" ]; then
    echo "❌ VITE_API_URL no configurada"
    exit 1
fi

# Compilar frontend
echo "🏗️  Compilando frontend..."
npm run build

# Verificar puerto
echo "🔍 Verificando puerto ${API_PORT:-3002}..."
if lsof -i :${API_PORT:-3002} > /dev/null 2>&1; then
    echo "⚠️  Puerto ${API_PORT:-3002} ocupado. Limpiando..."
    lsof -t -i :${API_PORT:-3002} | xargs kill -9 || true
    sleep 2
fi

# Iniciar servidor con PM2 si está disponible
if command -v pm2 &> /dev/null; then
    echo "🎯 Iniciando con PM2..."
    pm2 stop ristak-api || true
    pm2 delete ristak-api || true
    pm2 start api/src/server.js --name ristak-api --env production
    pm2 logs ristak-api
else
    echo "🎯 Iniciando servidor Node.js..."
    echo "   (Considera instalar PM2 para mejor gestión de procesos)"
    node api/src/server.js
fi