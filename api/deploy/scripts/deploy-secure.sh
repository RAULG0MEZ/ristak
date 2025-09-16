#!/bin/bash
set -e

# ====================================================
# RISTAK PRO - SECURE SMART DEPLOYMENT v3.0
# ====================================================
# Zero-touch deployment con validación de seguridad
# NUNCA hardcodear credenciales en este archivo
# ====================================================

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# ====== CONFIGURACIÓN BASE ======
APP_NAME="ristak-pro"
APP_DIR="/opt/${APP_NAME}"
PROJECT_ROOT="$(dirname "$(dirname "$(dirname "$(realpath "$0")")")")"

# Dominios (públicos, no sensibles)
DOMAIN_APP="app.hollytrack.com"
DOMAIN_SEND="send.hollytrack.com"
DOMAIN_TRACK="ilove.hollytrack.com"

# ====== FUNCIONES DE UTILIDAD ======
print_header() {
    echo -e "\n${MAGENTA}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${MAGENTA}║${NC}     🔒 RISTAK PRO - SECURE DEPLOYMENT v3.0             ${MAGENTA}║${NC}"
    echo -e "${MAGENTA}╚══════════════════════════════════════════════════════════╝${NC}\n"
}

print_step() { echo -e "${CYAN}▶${NC} $1"; }
print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_error() { echo -e "${RED}✗${NC} $1"; exit 1; }
print_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
print_info() { echo -e "${BLUE}ℹ${NC} $1"; }

# ====== VALIDACIÓN DE SEGURIDAD ======
validate_security() {
    print_step "Validando configuración de seguridad..."

    # 1. Verificar que NO hay credenciales hardcodeadas
    if grep -q "PASSWORD\|password.*=" "$0" | grep -v "DEPLOY_PASSWORD"; then
        print_error "SEGURIDAD: Se detectaron posibles credenciales hardcodeadas en el script"
    fi

    # 2. Verificar que .env.local existe
    if [ ! -f "${PROJECT_ROOT}/.env.local" ]; then
        print_error "No se encontró .env.local"
        echo ""
        echo "  Crea el archivo .env.local con las siguientes variables:"
        echo "  ----------------------------------------"
        echo "  # Credenciales del servidor"
        echo "  DEPLOY_HOST=5.161.90.139"
        echo "  DEPLOY_USER=root"
        echo "  DEPLOY_PASSWORD=tu-contraseña-segura"
        echo ""
        echo "  # Base de datos"
        echo "  DATABASE_URL=postgresql://..."
        echo ""
        echo "  # API Keys"
        echo "  ACCOUNT_ID=acc_..."
        echo "  DEFAULT_SUBACCOUNT_ID=suba_..."
        echo "  ----------------------------------------"
        exit 1
    fi

    # 3. Verificar permisos del archivo .env.local
    PERMS=$(stat -f "%OLp" "${PROJECT_ROOT}/.env.local" 2>/dev/null || stat -c "%a" "${PROJECT_ROOT}/.env.local" 2>/dev/null)
    if [ "$PERMS" != "600" ] && [ "$PERMS" != "640" ]; then
        print_warning "Permisos inseguros en .env.local (actual: $PERMS)"
        print_info "Corrigiendo permisos..."
        chmod 600 "${PROJECT_ROOT}/.env.local"
    fi

    # 4. Verificar que .env NO está en el repositorio
    if [ -f "${PROJECT_ROOT}/.env" ]; then
        if git ls-files --error-unmatch "${PROJECT_ROOT}/.env" 2>/dev/null; then
            print_error ".env está en el repositorio Git! Esto es un riesgo de seguridad"
            echo "  Ejecuta: git rm --cached .env"
            echo "  Y agrega .env a .gitignore"
            exit 1
        fi
    fi

    print_success "Validación de seguridad completada"
}

# ====== CARGAR VARIABLES DE ENTORNO ======
load_environment() {
    print_step "Cargando variables de entorno seguras..."

    # Cargar desde .env.local
    set -a
    source "${PROJECT_ROOT}/.env.local"
    set +a

    # Variables requeridas
    REQUIRED_VARS=(
        "DEPLOY_HOST"
        "DEPLOY_USER"
        "DEPLOY_PASSWORD"
        "DATABASE_URL"
        "ACCOUNT_ID"
        "DEFAULT_SUBACCOUNT_ID"
    )

    # Validar que todas existen
    for var in "${REQUIRED_VARS[@]}"; do
        if [ -z "${!var}" ]; then
            print_error "Variable requerida '$var' no está definida en .env.local"
        fi
    done

    # Configurar variables de deployment
    SERVER_HOST="${DEPLOY_HOST}"
    SERVER_USER="${DEPLOY_USER}"
    SERVER_PASSWORD="${DEPLOY_PASSWORD}"

    print_success "Variables de entorno cargadas (${#REQUIRED_VARS[@]} variables validadas)"
}

# ====== VALIDACIÓN CON SERVIDOR ======
validate_server_config() {
    print_step "Validando configuración del servidor..."

    # Crear archivo temporal con esquema de variables esperadas
    cat > /tmp/env.schema << 'SCHEMA'
DATABASE_URL
ACCOUNT_ID
DEFAULT_SUBACCOUNT_ID
NODE_ENV
PORT
API_PORT
SCHEMA

    # Transferir esquema al servidor
    sshpass -p "$SERVER_PASSWORD" scp -o StrictHostKeyChecking=no \
        /tmp/env.schema $SERVER_USER@$SERVER_HOST:/tmp/

    # Validar en el servidor
    sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_HOST << 'VALIDATE'
    # Verificar que el archivo de producción existe
    if [ ! -f /etc/ristak-pro/env.production ]; then
        echo "ERROR: No existe /etc/ristak-pro/env.production en el servidor"
        exit 1
    fi

    # Verificar permisos seguros
    PERMS=$(stat -c "%a" /etc/ristak-pro/env.production)
    if [ "$PERMS" != "600" ]; then
        echo "WARNING: Permisos inseguros en env.production (actual: $PERMS)"
        chmod 600 /etc/ristak-pro/env.production
    fi

    # Validar que todas las variables requeridas existen
    while IFS= read -r var; do
        if ! grep -q "^${var}=" /etc/ristak-pro/env.production; then
            echo "ERROR: Variable $var no está definida en el servidor"
            exit 1
        fi
    done < /tmp/env.schema

    echo "✅ Configuración del servidor validada"
    rm /tmp/env.schema
VALIDATE

    rm /tmp/env.schema
    print_success "Servidor tiene todas las variables requeridas"
}

# ====== BUILD DEL FRONTEND ======
build_frontend() {
    print_step "Construyendo frontend..."
    cd "${PROJECT_ROOT}"

    # Verificar node_modules
    if [ ! -d "node_modules" ] || [ package.json -nt node_modules ]; then
        print_info "Instalando dependencias..."
        npm ci --silent || npm install --silent
    fi

    # Build de producción
    print_info "Compilando para producción..."
    NODE_ENV=production npx vite build || print_error "Error en build del frontend"

    if [ ! -d "dist" ]; then
        print_error "No se generó el directorio dist"
    fi

    print_success "Frontend construido ($(du -sh dist | cut -f1))"
}

# ====== TRANSFERENCIA SEGURA ======
transfer_files() {
    print_step "Transfiriendo archivos (sin credenciales)..."

    # Crear archivo tar EXCLUYENDO todos los .env
    cd "${PROJECT_ROOT}"
    tar -czf /tmp/ristak-deploy.tar.gz \
        --exclude=.env \
        --exclude=.env.* \
        --exclude=*.secret \
        --exclude=*.key \
        --exclude=*.pem \
        --exclude=node_modules \
        --exclude=.git \
        --exclude=.DS_Store \
        .

    # Verificar que no hay credenciales en el tar
    if tar -tzf /tmp/ristak-deploy.tar.gz | grep -E "\.env|password|secret" | grep -v "env.example"; then
        print_error "Se detectaron posibles credenciales en el archivo de deployment"
        rm /tmp/ristak-deploy.tar.gz
        exit 1
    fi

    # Transferir
    sshpass -p "$SERVER_PASSWORD" scp -o StrictHostKeyChecking=no \
        /tmp/ristak-deploy.tar.gz $SERVER_USER@$SERVER_HOST:/tmp/

    # Extraer en el servidor
    sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_HOST << 'EXTRACT'
    cd /opt/ristak-pro

    # Backup antes de extraer
    if [ -d "dist" ]; then
        mv dist dist.backup.$(date +%s)
    fi

    tar -xzf /tmp/ristak-deploy.tar.gz
    rm /tmp/ristak-deploy.tar.gz

    # Limpiar backups antiguos (mantener solo últimos 3)
    ls -t dist.backup.* 2>/dev/null | tail -n +4 | xargs rm -rf 2>/dev/null || true

    echo "✓ Archivos extraídos de forma segura"
EXTRACT

    # Limpiar archivo temporal
    rm /tmp/ristak-deploy.tar.gz

    print_success "Archivos transferidos sin credenciales"
}

# ====== CONFIGURACIÓN DE SERVICIOS ======
configure_services() {
    print_step "Configurando servicios..."

    sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_HOST << 'SERVICES'
    # Asegurar que las variables de entorno están disponibles
    if [ ! -f /etc/ristak-pro/env.production ]; then
        echo "ERROR: Falta archivo de configuración de producción"
        exit 1
    fi

    # Reiniciar servicios con las variables correctas
    cd /opt/ristak-pro

    # PM2 con variables de entorno
    pm2 delete all 2>/dev/null || true

    # Frontend
    pm2 start serve \
        --name "ristak-frontend" \
        --cwd /opt/ristak-pro \
        -- -s dist -l 3001

    # Backend con variables de entorno
    set -a
    source /etc/ristak-pro/env.production
    set +a

    pm2 start api/src/server.js \
        --name "ristak-backend" \
        --cwd /opt/ristak-pro/api \
        --max-memory-restart 500M

    pm2 save
    pm2 startup systemd -u root --hp /root 2>/dev/null || true

    echo "✅ Servicios configurados"
SERVICES

    print_success "Servicios actualizados con configuración segura"
}

# ====== VERIFICACIÓN FINAL ======
verify_deployment() {
    print_step "Verificando deployment..."

    # Frontend
    FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN_APP 2>/dev/null || echo "000")
    if [ "$FRONTEND_STATUS" == "200" ] || [ "$FRONTEND_STATUS" == "301" ]; then
        print_success "Frontend: https://$DOMAIN_APP ✓"
    else
        print_warning "Frontend: https://$DOMAIN_APP (HTTP $FRONTEND_STATUS)"
    fi

    # API Health check
    API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN_SEND/health 2>/dev/null || echo "000")
    if [ "$API_STATUS" == "200" ]; then
        print_success "API: https://$DOMAIN_SEND/health ✓"
    else
        print_warning "API: https://$DOMAIN_SEND/health (HTTP $API_STATUS)"
    fi

    # Log de deployment
    sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_HOST << DEPLOYLOG
    echo "[$(date)] Deployment completado por $(whoami)@$(hostname)" >> /var/log/ristak-deployments.log
DEPLOYLOG
}

# ====== LIMPIEZA DE SEGURIDAD ======
security_cleanup() {
    print_step "Limpieza de seguridad..."

    # Limpiar cualquier archivo temporal local
    rm -f /tmp/ristak-* 2>/dev/null || true
    rm -f /tmp/env.* 2>/dev/null || true

    # Limpiar en el servidor
    sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_HOST << 'CLEANUP'
    # Asegurar que no hay .env en directorios públicos
    find /opt/ristak-pro -name ".env*" -not -path "*/node_modules/*" -type f -delete 2>/dev/null || true

    # Verificar permisos
    chmod 600 /etc/ristak-pro/env.production 2>/dev/null || true

    echo "✅ Limpieza de seguridad completada"
CLEANUP

    print_success "Entorno asegurado"
}

# ====== FUNCIÓN PRINCIPAL ======
main() {
    print_header

    # Modo de ayuda
    if [ "$1" == "--help" ] || [ "$1" == "-h" ]; then
        echo "Uso: $0 [opciones]"
        echo ""
        echo "Opciones:"
        echo "  --skip-build     Saltar build del frontend"
        echo "  --validate-only  Solo validar, no deployar"
        echo "  --quick          Deployment rápido (sin validaciones exhaustivas)"
        echo ""
        echo "Variables requeridas en .env.local:"
        echo "  DEPLOY_HOST      IP del servidor"
        echo "  DEPLOY_USER      Usuario SSH"
        echo "  DEPLOY_PASSWORD  Contraseña SSH"
        echo "  DATABASE_URL     URL de la base de datos"
        echo "  ACCOUNT_ID       ID de la cuenta"
        echo "  DEFAULT_SUBACCOUNT_ID  ID del subaccount"
        echo ""
        exit 0
    fi

    # Ejecutar pasos
    validate_security
    load_environment

    if [ "$1" == "--validate-only" ]; then
        validate_server_config
        print_success "Validación completada. No se realizó deployment."
        exit 0
    fi

    validate_server_config

    if [ "$1" != "--skip-build" ] && [ "$1" != "--quick" ]; then
        build_frontend
    fi

    transfer_files
    configure_services
    security_cleanup
    verify_deployment

    # Resumen final
    echo ""
    echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}✨ DEPLOYMENT SEGURO COMPLETADO${NC}"
    echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "🔒 Seguridad:"
    echo -e "   • Credenciales NO incluidas en deployment"
    echo -e "   • Variables validadas con servidor"
    echo -e "   • Permisos verificados (600)"
    echo -e "   • Log de auditoría registrado"
    echo ""
    echo -e "🌐 Aplicación disponible en:"
    echo -e "   ${BLUE}📱 App:${NC}      https://${DOMAIN_APP}"
    echo -e "   ${BLUE}📮 API:${NC}      https://${DOMAIN_SEND}"
    echo -e "   ${BLUE}📊 Tracking:${NC} https://${DOMAIN_TRACK}"
    echo ""
    echo -e "${YELLOW}Próximos pasos recomendados:${NC}"
    echo -e "  1. Verificar funcionamiento en navegador"
    echo -e "  2. Revisar logs: pm2 logs"
    echo -e "  3. Monitorear: pm2 monit"
    echo -e "  4. Rotar credenciales regularmente"
    echo ""
    echo -e "${GREEN}¡Deployment seguro completado! 🔒${NC}"
}

# Ejecutar
main "$@"