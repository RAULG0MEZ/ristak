#!/bin/bash

# Script para iniciar la aplicación en modo desarrollo
# Carga variables de entorno desde .env

set -e  # Salir si hay algún error

echo "🚀 Iniciando Ristak PRO en modo DESARROLLO"
echo "============================================"

# Cargar variables de entorno
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
    echo "✅ Variables de entorno cargadas desde .env"
else
    echo "⚠️  Archivo .env no encontrado"
    echo "   Copia .env.example a .env y configura las variables"
    exit 1
fi

# Configurar modo desarrollo
export NODE_ENV=development
echo "📝 NODE_ENV=$NODE_ENV"

# Matar procesos previos
echo "🧹 Limpiando procesos anteriores..."
pkill -f node || true
sleep 2

# Verificar puertos
echo "🔍 Verificando puertos disponibles..."
if lsof -i :${API_PORT:-3002} > /dev/null 2>&1; then
    echo "⚠️  Puerto ${API_PORT:-3002} ocupado. Limpiando..."
    lsof -t -i :${API_PORT:-3002} | xargs kill -9 || true
fi

if lsof -i :${VITE_PORT:-5173} > /dev/null 2>&1; then
    echo "⚠️  Puerto ${VITE_PORT:-5173} ocupado. Limpiando..."
    lsof -t -i :${VITE_PORT:-5173} | xargs kill -9 || true
fi

sleep 2

# Iniciar aplicación
echo ""
echo "🎯 Iniciando servicios..."
echo "   API: http://localhost:${API_PORT:-3002}"
echo "   Frontend: http://localhost:${VITE_PORT:-5173}"
echo ""

# Usar concurrently si está disponible, sino usar npm run dev
if [ -f "node_modules/.bin/concurrently" ]; then
    npm run dev
else
    echo "⚠️  concurrently no instalado, instalando..."
    npm install
    npm run dev
fi