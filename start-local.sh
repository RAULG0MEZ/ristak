#!/bin/bash

echo ""
echo "🚀 RISTAK LOCAL"
echo "━━━━━━━━━━━━━━━━━━"
echo ""

# Función para matar proceso en puerto específico
kill_port() {
    local PORT=$1
    local NAME=$2

    # Buscar TODOS los PIDs del proceso en el puerto
    local PIDS=$(lsof -ti:$PORT 2>/dev/null)

    if [ ! -z "$PIDS" ]; then
        echo "🔪 Matando $NAME en puerto $PORT..."
        # Matar todos los PIDs encontrados
        for PID in $PIDS; do
            kill -9 $PID 2>/dev/null || true
        done
        sleep 1
    else
        echo "✅ Puerto $PORT libre"
    fi
}

# Obtener el directorio base del script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Matar SOLO procesos en nuestros puertos específicos
echo "🧹 Limpiando puertos específicos..."
kill_port 3002 "API"
kill_port 5173 "Frontend"

# Esperar un momento para asegurar que los puertos se liberaron completamente
sleep 2

# Establecer que estamos en desarrollo
export NODE_ENV=development

# Iniciar API
echo ""
echo "🚀 Iniciando API en puerto 3002..."
cd "$SCRIPT_DIR/api"
NODE_ENV=development npm run dev &
API_PID=$!

# Esperar a que la API esté lista
echo "⏳ Esperando API..."
MAX_RETRIES=30
RETRY_COUNT=0
while ! curl -s http://localhost:3002/health > /dev/null 2>&1; do
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo "❌ Error: La API no pudo iniciar después de 30 segundos"
        kill $API_PID 2>/dev/null || true
        exit 1
    fi
    sleep 1
    RETRY_COUNT=$((RETRY_COUNT + 1))
done
echo "✅ API lista"

# Iniciar Frontend - SIEMPRE desde el directorio raíz del proyecto
cd "$SCRIPT_DIR"
echo ""
echo "🎨 Iniciando Frontend en puerto 5173..."

# Verificar que existe index.html
if [ ! -f "index.html" ]; then
    echo "❌ Error: No se encontró index.html en $SCRIPT_DIR"
    echo "   Asegúrate de estar en el directorio correcto del proyecto"
    kill $API_PID 2>/dev/null || true
    exit 1
fi

# Iniciar Vite con configuración específica
VITE_API_URL=http://localhost:3002/api npx vite --host localhost --port 5173 --strictPort &
FRONTEND_PID=$!

# Esperar a que el frontend esté listo
echo "⏳ Esperando Frontend..."
sleep 3

# Verificar que el frontend responde correctamente
MAX_RETRIES=10
RETRY_COUNT=0
while true; do
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173 2>/dev/null)

    if [ "$RESPONSE" = "200" ]; then
        echo "✅ Frontend listo"
        break
    elif [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo "❌ Error: El frontend no responde correctamente (HTTP $RESPONSE)"
        kill $API_PID 2>/dev/null || true
        kill $FRONTEND_PID 2>/dev/null || true
        exit 1
    fi

    echo "⏳ Esperando respuesta del frontend (intento $((RETRY_COUNT + 1))/$MAX_RETRIES)..."
    sleep 2
    RETRY_COUNT=$((RETRY_COUNT + 1))
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ LISTO - AUTO-LOGIN ACTIVADO!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "API: http://localhost:3002"
echo "App: http://localhost:5173"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🔐 En desarrollo no necesitas login"
echo "   Todo está configurado automáticamente"
echo ""
echo "💡 Para detener: Ctrl+C"
echo ""

# Función para limpiar al salir
cleanup() {
    echo ""
    echo "🛑 Deteniendo servicios..."
    kill $API_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    kill_port 3002 "API"
    kill_port 5173 "Frontend"
    echo "✅ Servicios detenidos"
    exit 0
}

# Capturar Ctrl+C y limpiar
trap cleanup INT TERM EXIT

# Mantener corriendo y mostrar logs
wait $API_PID $FRONTEND_PID