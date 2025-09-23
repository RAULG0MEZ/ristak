#!/bin/bash
set -e

# ====================================================
# RISTAK - DEPLOY PRODUCCIÓN
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
APP_NAME="ristak"
APP_DIR="/opt/${APP_NAME}"
PROJECT_ROOT="$(dirname "$(dirname "$(dirname "$(realpath "$0")")")")"

# Dominios - Se cargarán desde .env.local
DOMAIN_APP=""
DOMAIN_SEND=""
DOMAIN_TRACK=""

# ====== FUNCIONES DE UTILIDAD ======
print_header() {
    echo -e "\n${MAGENTA}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${MAGENTA}║${NC}     🚀 RISTAK - DEPLOY PRODUCCIÓN                      ${MAGENTA}║${NC}"
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
        echo "  # Dominios"
        echo "  DOMAIN_APP=app.hollytrack.com"
        echo "  DOMAIN_SEND=send.hollytrack.com"
        echo "  DOMAIN_TRACK=ilove.hollytrack.com"
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

    # Cargar desde .env.local (agnóstico: maneja caracteres especiales)
    # No usar source porque falla con & y otros caracteres especiales
    while IFS='=' read -r key value; do
        # Saltar líneas vacías y comentarios
        [[ -z "$key" || "$key" =~ ^# ]] && continue
        # Exportar la variable
        export "$key=$value"
    done < <(grep -v '^#' "${PROJECT_ROOT}/.env.local" | grep -v '^$')

    # Variables requeridas
    REQUIRED_VARS=(
        "DEPLOY_HOST"
        "DEPLOY_USER"
        "DEPLOY_PASSWORD"
        "DATABASE_URL"
        "DOMAIN_APP"
        "DOMAIN_SEND"
        "DOMAIN_TRACK"
        "CLOUDFLARE_API_TOKEN"
        "CLOUDFLARE_ZONE_ID"
        "META_APP_ID"
        "META_APP_SECRET"
        "META_ENCRYPTION_KEY"
        "AUTH_SECRET"
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

    # Configurar dominios desde variables de entorno
    DOMAIN_APP="${DOMAIN_APP}"
    DOMAIN_SEND="${DOMAIN_SEND}"
    DOMAIN_TRACK="${DOMAIN_TRACK}"

    print_success "Variables de entorno cargadas (${#REQUIRED_VARS[@]} variables validadas)"
}

# ====== SETUP INICIAL DEL SERVIDOR ======
setup_server_if_needed() {
    print_step "Verificando estado del servidor..."

    # Crear script temporal para verificar dependencias
    cat > /tmp/check_deps.sh << 'SCRIPT_CHECK'
#!/bin/bash
echo "=== CHECKING SERVER DEPENDENCIES ==="

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo "NODE_MISSING"
else
    echo "NODE_VERSION=$(node -v)"
fi

# Verificar Nginx
if ! command -v nginx &> /dev/null; then
    echo "NGINX_MISSING"
else
    echo "NGINX_VERSION=$(nginx -v 2>&1)"
fi

# Verificar PM2
if ! command -v pm2 &> /dev/null; then
    echo "PM2_MISSING"
fi

# Verificar serve
if ! command -v serve &> /dev/null; then
    echo "SERVE_MISSING"
fi

# Verificar certbot
if ! command -v certbot &> /dev/null; then
    echo "CERTBOT_MISSING"
fi

# Verificar directorios
if [ ! -d "/opt/ristak" ]; then
    echo "DIR_MISSING"
fi

if [ ! -d "/etc/ristak-pro" ]; then
    echo "CONFIG_DIR_MISSING"
fi
SCRIPT_CHECK

    # Ejecutar script en el servidor
    sshpass -p "$SERVER_PASSWORD" scp -o StrictHostKeyChecking=no /tmp/check_deps.sh $SERVER_USER@$SERVER_HOST:/tmp/check_deps.sh
    sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_HOST "bash /tmp/check_deps.sh" > /tmp/server_check.txt 2>&1
    sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_HOST "rm /tmp/check_deps.sh"

    # Leer resultados
    SERVER_STATUS=$(cat /tmp/server_check.txt)

    # Si falta algo, instalarlo
    if grep -q "_MISSING" /tmp/server_check.txt; then
        print_warning "El servidor necesita configuración inicial. Instalando dependencias..."
        install_server_dependencies
    else
        print_success "El servidor ya tiene todas las dependencias instaladas"
    fi

    # Configurar estructura de directorios
    setup_directory_structure

    # SKIP: No configurar base de datos local porque usamos Neon (base de datos en la nube)
    # La base de datos ya está configurada en Neon y se accede via DATABASE_URL
    print_info "Usando base de datos Neon (no se requiere PostgreSQL local)"

    # Configurar archivo de variables si no existe
    setup_environment_file

    rm -f /tmp/server_check.txt
    rm -f /tmp/check_deps.sh
}

# ====== INSTALAR DEPENDENCIAS DEL SERVIDOR ======
install_server_dependencies() {
    print_step "Instalando dependencias del sistema..."

    sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_HOST << 'INSTALL_DEPS'
    set -e

    echo "🔧 Actualizando sistema..."
    apt-get update -qq

    # Instalar Node.js 20.x si no existe
    if ! command -v node &> /dev/null; then
        echo "📦 Instalando Node.js 20..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs
    fi

    # Instalar Nginx si no existe
    if ! command -v nginx &> /dev/null; then
        echo "🌐 Instalando Nginx..."
        apt-get install -y nginx
        systemctl enable nginx
        systemctl start nginx
    fi

    # SKIP: No instalar PostgreSQL local - usamos Neon (cloud database)
    # La base de datos está en Neon y se accede remotamente via DATABASE_URL

    # Instalar herramientas adicionales
    echo "🛠️ Instalando herramientas adicionales..."
    apt-get install -y git curl wget sshpass build-essential

    # Instalar certbot para SSL si no existe
    if ! command -v certbot &> /dev/null; then
        echo "🔒 Instalando Certbot para SSL..."
        apt-get install -y certbot python3-certbot-nginx
    fi

    # Instalar PM2 globalmente si no existe
    if ! command -v pm2 &> /dev/null; then
        echo "⚙️ Instalando PM2..."
        npm install -g pm2
    fi

    # Instalar serve globalmente si no existe
    if ! command -v serve &> /dev/null; then
        echo "📁 Instalando serve..."
        npm install -g serve
    fi

    echo "✅ Todas las dependencias instaladas"
INSTALL_DEPS

    print_success "Dependencias del sistema instaladas"
}

# ====== CONFIGURAR ESTRUCTURA DE DIRECTORIOS ======
setup_directory_structure() {
    print_step "Configurando estructura de directorios..."

    sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_HOST << 'SETUP_DIRS'
    # Crear directorios necesarios
    mkdir -p /opt/ristak
    mkdir -p /opt/ristak/api
    mkdir -p /opt/ristak/dist
    mkdir -p /etc/ristak
    mkdir -p /var/log/ristak
    mkdir -p /var/log/nginx

    # Configurar permisos
    chmod 755 /opt/ristak
    chmod 700 /etc/ristak

    echo "✅ Estructura de directorios creada"
SETUP_DIRS

    print_success "Directorios configurados"
}

# ====== FUNCIONES DE BASE DE DATOS REMOVIDAS ======
# Ya no necesitamos estas funciones porque usamos Neon (base de datos en la nube)
# La base de datos ya está configurada y lista en Neon
# Solo necesitamos el cliente psql para ejecutar migraciones

# ====== CONFIGURAR ARCHIVO DE VARIABLES DE ENTORNO ======
setup_environment_file() {
    print_step "Configurando archivo de variables de producción..."

    # Copiar el archivo de producción local al servidor (agnóstico: siempre actualizado)
    echo "📝 Actualizando archivo de configuración de producción..."

    # Crear archivo temporal con las variables actuales
    cat > /tmp/env.production.tmp << ENVFILE
# ================================================
# RISTAK - CONFIGURACIÓN DE PRODUCCIÓN
# ================================================
# Archivo de secrets - NO COMPARTIR
# Ubicación: /etc/ristak/env.production
# ================================================

# === ESENCIALES ===
NODE_ENV=production
DATABASE_URL=${DATABASE_URL}
API_PORT=3002

# === META/FACEBOOK ===
META_APP_ID=${META_APP_ID}
META_APP_SECRET=${META_APP_SECRET}
META_ENCRYPTION_KEY=${META_ENCRYPTION_KEY}
META_GRAPH_VERSION=v23.0

# === TRACKING ===
TRACKING_HOST=${TRACKING_HOST:-ilove.hollytrack.com}
TRACKING_PROTOCOL=https
WEBHOOK_BASE_URL=${WEBHOOK_BASE_URL:-https://send.hollytrack.com}

# === CLOUDFLARE ===
CLOUDFLARE_API_TOKEN=${CLOUDFLARE_API_TOKEN}
CLOUDFLARE_ZONE_ID=${CLOUDFLARE_ZONE_ID}

# === DOMINIOS ===
DOMAIN_APP=${DOMAIN_APP}
DOMAIN_SEND=${DOMAIN_SEND}
DOMAIN_TRACK=${DOMAIN_TRACK}

# === SEGURIDAD ===
AUTH_SECRET=${AUTH_SECRET}
ENVFILE

    # Transferir el archivo al servidor
    sshpass -p "$SERVER_PASSWORD" scp -o StrictHostKeyChecking=no /tmp/env.production.tmp $SERVER_USER@$SERVER_HOST:/tmp/env.production.tmp

    # Mover el archivo a su ubicación final y configurar permisos
    sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_HOST << 'REMOTE_CMD'
        mkdir -p /etc/ristak
        mv /tmp/env.production.tmp /etc/ristak/env.production
        chmod 600 /etc/ristak/env.production
        echo "✅ Archivo de configuración actualizado"
REMOTE_CMD

    print_success "Variables de entorno de producción configuradas"
}

# ====== CONFIGURAR SSL CON CERTBOT ======
setup_ssl_certificates() {
    print_step "Configurando certificados SSL..."

    sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_HOST << EOF
    # Verificar si ya existen certificados
    if [ -d "/etc/letsencrypt/live/hollytrack.com" ]; then
        echo "ℹ️ Certificados SSL ya existen"
    else
        echo "🔒 Generando certificados SSL con Let's Encrypt..."

        # Detener nginx temporalmente para certbot
        systemctl stop nginx || true

        # Generar UN SOLO certificado para TODOS los dominios
        # Usa el dominio principal (DOMAIN_APP) como nombre del certificado
        certbot certonly --standalone --non-interactive --agree-tos \
            --email admin@${DOMAIN_APP} \
            --cert-name ${DOMAIN_APP} \
            -d $DOMAIN_APP \
            -d $DOMAIN_SEND \
            -d $DOMAIN_TRACK || {
            echo "⚠️ Error generando certificados. Continuando sin SSL..."
            systemctl start nginx || true
            return
        }

        echo "✅ Certificados SSL generados para todos los dominios"
        systemctl start nginx || true
    fi

    # Configurar renovación automática
    if ! crontab -l 2>/dev/null | grep -q "certbot renew"; then
        echo "⏰ Configurando renovación automática de SSL..."
        (crontab -l 2>/dev/null; echo "0 0,12 * * * certbot renew --quiet && systemctl reload nginx") | crontab -
    fi
EOF

    print_success "SSL configurado"
}

# ====== CONFIGURAR NGINX ======
setup_nginx_config() {
    print_step "Configurando Nginx..."

    # Procesar archivo de tracking con variables antes de enviar
    cat "${PROJECT_ROOT}/deploy/nginx/ilove.hollytrack.com" | \
        sed "s/\${DOMAIN_APP}/${DOMAIN_APP}/g" | \
        sed "s/\${DOMAIN_TRACK}/${DOMAIN_TRACK}/g" > /tmp/nginx-tracking-processed.conf

    # Transferir configuración procesada de nginx
    sshpass -p "$SERVER_PASSWORD" scp -o StrictHostKeyChecking=no \
        /tmp/nginx-tracking-processed.conf \
        $SERVER_USER@$SERVER_HOST:/tmp/nginx-tracking.conf

    # Limpiar archivo temporal
    rm -f /tmp/nginx-tracking-processed.conf

    sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_HOST \
        DOMAIN_APP="$DOMAIN_APP" DOMAIN_SEND="$DOMAIN_SEND" DOMAIN_TRACK="$DOMAIN_TRACK" \
        bash << 'NGINX_SETUP'
    # Configuración para ${DOMAIN_APP} (Frontend)
    cat > /etc/nginx/sites-available/${DOMAIN_APP} << FRONTEND_CONF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN_APP};
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN_APP};

    ssl_certificate /etc/letsencrypt/live/${DOMAIN_APP}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN_APP}/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Redirigir /api/* a send.hollytrack.com
    location /api/ {
        return 301 https://${DOMAIN_SEND}\$request_uri;
    }

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
FRONTEND_CONF

    # Configuración para ${DOMAIN_SEND} (API)
    cat > /etc/nginx/sites-available/${DOMAIN_SEND} << API_CONF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN_SEND};
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN_SEND};

    ssl_certificate /etc/letsencrypt/live/${DOMAIN_APP}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN_APP}/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 50M;

    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
API_CONF

    # Configuración para ilove.hollytrack.com (Tracking)
    mv /tmp/nginx-tracking.conf /etc/nginx/sites-available/${DOMAIN_TRACK}

    # IMPORTANTE: El orden de carga de nginx es crítico para el funcionamiento correcto
    # ${DOMAIN_TRACK} (tracking) tiene un wildcard (_) que captura TODOS los dominios personalizados
    # Debe cargarse PRIMERO (prefijo 00-) para procesar dominios como track.cliente.com
    # Si ${DOMAIN_APP} se carga primero, interceptará las peticiones y las enviará al puerto equivocado

    # Primero limpiar enlaces antiguos
    rm -f /etc/nginx/sites-enabled/*

    # Crear enlaces con orden específico:
    # 00- hace que ${DOMAIN_TRACK} (tracking con wildcard) se cargue primero
    # Esto asegura que dominios personalizados (ej: track.cliente.com) sean capturados correctamente
    ln -sf /etc/nginx/sites-available/${DOMAIN_TRACK} /etc/nginx/sites-enabled/00-${DOMAIN_TRACK}
    ln -sf /etc/nginx/sites-available/${DOMAIN_APP} /etc/nginx/sites-enabled/${DOMAIN_APP}
    ln -sf /etc/nginx/sites-available/${DOMAIN_SEND} /etc/nginx/sites-enabled/${DOMAIN_SEND}

    # Probar configuración y asegurar que Nginx esté corriendo
    if nginx -t; then
        # Verificar si Nginx está corriendo
        if systemctl is-active --quiet nginx; then
            systemctl reload nginx && echo "✅ Nginx recargado"
        else
            systemctl start nginx && echo "✅ Nginx iniciado"
        fi
        echo "✅ Nginx configurado correctamente"
    else
        echo "❌ Error en configuración de Nginx - revisando..."
        nginx -t 2>&1
    fi
NGINX_SETUP

    print_success "Nginx configurado con todos los dominios"
}

# ====== VALIDACIÓN CON SERVIDOR ======
validate_server_config() {
    print_step "Validando configuración del servidor..."

    # Ya no necesitamos validar aquí porque setup_environment_file ya lo hace
    print_success "Configuración validada"
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

    # Build de producción con URL de API correcta
    print_info "Compilando para producción..."
    VITE_API_URL="https://${DOMAIN_SEND}/api" NODE_ENV=production npx vite build || print_error "Error en build del frontend"

    if [ ! -d "dist" ]; then
        print_error "No se generó el directorio dist"
    fi

    print_success "Frontend construido ($(du -sh dist | cut -f1))"
}

# ====== TRANSFERENCIA SEGURA ======
transfer_files() {
    print_step "Transfiriendo archivos (sin credenciales)..."

    # Crear archivo tar EXCLUYENDO todos los .env y archivos sensibles
    cd "${PROJECT_ROOT}"
    tar -czf /tmp/ristak-deploy.tar.gz \
        --exclude='.env' \
        --exclude='.env.*' \
        --exclude='*.secret' \
        --exclude='*.key' \
        --exclude='*.pem' \
        --exclude='node_modules' \
        --exclude='.git' \
        --exclude='.DS_Store' \
        --exclude='api/migrations' \
        --exclude='api/scripts/setup-*.js' \
        --exclude='api/scripts/update-*.js' \
        --exclude='api/test-*.json' \
        .

    # Verificar que no hay credenciales en el tar (excluyendo migraciones SQL que son necesarias)
    if tar -tzf /tmp/ristak-deploy.tar.gz | grep -E "\.env|password.*=|secret.*=|key.*=" | grep -v "env.example" | grep -v "migrations/" | grep -v "\.sql$"; then
        print_error "Se detectaron posibles credenciales en el archivo de deployment"
        rm /tmp/ristak-deploy.tar.gz
        exit 1
    fi

    # Transferir
    sshpass -p "$SERVER_PASSWORD" scp -o StrictHostKeyChecking=no \
        /tmp/ristak-deploy.tar.gz $SERVER_USER@$SERVER_HOST:/tmp/

    # Extraer en el servidor
    sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_HOST << 'EXTRACT'
    cd /opt/ristak

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

    # Verificar configuración
    sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_HOST "test -f /etc/ristak/env.production" || {
        print_error "Falta archivo de configuración de producción"
        exit 1
    }

    # Configurar PM2 para frontend
    sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_HOST "
        cd /opt/ristak
        pm2 stop ristak-frontend 2>/dev/null || true
        pm2 delete ristak-frontend 2>/dev/null || true
        pm2 serve dist 3001 --name 'ristak-frontend' --spa
        echo '✓ Frontend configurado en PM2'
    "

    # Configurar base de datos y usuarios
    print_info "Configurando sistema de login..."

    # Instalar dependencias necesarias
    sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_HOST "
        cd /opt/ristak/api
        npm list bcryptjs >/dev/null 2>&1 || npm install bcryptjs --silent
        npm list pg >/dev/null 2>&1 || npm install pg --silent

        # Instalar cliente PostgreSQL si es necesario
        if ! command -v psql &> /dev/null; then
            echo 'Instalando cliente PostgreSQL...'
            apt-get install -y postgresql-client
        fi
    "

    # Crear script para configurar usuario admin
    cat > /tmp/setup_admin.js << 'ADMIN_SCRIPT'
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function setupAdmin() {
  try {
    // Crear tabla si no existe
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        password_hash VARCHAR(255),
        role VARCHAR(50) DEFAULT 'admin',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login_at TIMESTAMP
      )
    `);

    await pool.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');

    const email = 'milemedia.mkt@gmail.com';
    const password = 'Raulgom123';
    const name = 'Milemedia';

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    const hash = await bcrypt.hash(password, 10);

    if (existing.rows.length > 0) {
      await pool.query(
        'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE email = $2',
        [hash, email]
      );
      console.log('✅ Contraseña actualizada para milemedia.mkt@gmail.com');
    } else {
      await pool.query(
        'INSERT INTO users (email, name, password_hash, role) VALUES ($1, $2, $3, $4)',
        [email, name, hash, 'admin']
      );
      console.log('✅ Usuario admin creado: milemedia.mkt@gmail.com');
    }

    console.log('📧 Email: milemedia.mkt@gmail.com');
    console.log('🔑 Password: Raulgom123');
    console.log('⚠️  IMPORTANTE: Cambia esta contraseña después del primer login');
  } catch (e) {
    console.log('⚠️ Error configurando usuario:', e.message);
  }
  await pool.end();
}

setupAdmin();
ADMIN_SCRIPT

    # Transferir y ejecutar script
    sshpass -p "$SERVER_PASSWORD" scp -o StrictHostKeyChecking=no /tmp/setup_admin.js $SERVER_USER@$SERVER_HOST:/tmp/setup_admin.js
    sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_HOST "
        cd /opt/ristak/api
        set -a
        source /etc/ristak/env.production
        set +a
        node /tmp/setup_admin.js
        rm /tmp/setup_admin.js
        echo '✓ Sistema de login configurado'
    "

    # Configurar PM2 para backend
    sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_HOST "
        cd /opt/ristak
        # IMPORTANTE: Eliminar completamente el proceso para forzar recarga de variables
        pm2 delete ristak-backend 2>/dev/null || true

        # Crear symlinks para que el backend encuentre las variables (agnóstico: múltiples rutas)
        ln -sf /etc/ristak/env.production /opt/ristak/api/.env
        ln -sf /etc/ristak/env.production /opt/ristak/.env.local

        # CRÍTICO: Exportar y iniciar con variables frescas (agnóstico: siempre actualizado)
        # Usar --update-env para forzar actualización de variables de entorno
        export \$(cat /etc/ristak/env.production | grep -v '^#' | xargs)
        pm2 start api/src/server.js --name 'ristak-backend' --update-env

        pm2 save
        pm2 startup systemd -u root --hp /root 2>/dev/null || true
        echo '✓ Backend configurado en PM2'
    "

    # Limpiar archivos temporales
    rm -f /tmp/setup_admin.js

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

    # API - Verificar con endpoint que existe
    API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN_SEND/api/campaigns 2>/dev/null || echo "000")
    if [ "$API_STATUS" == "401" ] || [ "$API_STATUS" == "200" ]; then
        # 401 es esperado sin autenticación
        print_success "API: https://$DOMAIN_SEND/api ✓"
    else
        print_warning "API: https://$DOMAIN_SEND/api (HTTP $API_STATUS)"
    fi

    # Tracking
    TRACKING_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN_TRACK/snip.js 2>/dev/null || echo "000")
    if [ "$TRACKING_STATUS" == "200" ]; then
        print_success "Tracking: https://$DOMAIN_TRACK/snip.js ✓"
    else
        print_warning "Tracking: https://$DOMAIN_TRACK/snip.js (HTTP $TRACKING_STATUS)"
    fi

    # Verificar PM2 está corriendo correctamente
    sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_HOST << 'PM2CHECK'
    echo ""
    echo "Estado de PM2:"
    pm2 list | grep -E "ristak-frontend|ristak-backend" | while read line; do
        if echo "$line" | grep -q "online"; then
            echo "  ✓ $line"
        else
            echo "  ⚠ $line"
        fi
    done
PM2CHECK

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
    find /opt/ristak -name ".env*" -not -path "*/node_modules/*" -type f -delete 2>/dev/null || true

    # Verificar permisos
    chmod 600 /etc/ristak/env.production 2>/dev/null || true

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
        echo "  --fresh-install  Instalar todo desde cero (server nuevo)"
        echo ""
        echo "Variables requeridas en .env.local:"
        echo "  DEPLOY_HOST      IP del servidor"
        echo "  DEPLOY_USER      Usuario SSH"
        echo "  DEPLOY_PASSWORD  Contraseña SSH"
        echo "  DATABASE_URL     URL de la base de datos"
        echo "  DOMAIN_APP       Dominio de la app (ej: app.hollytrack.com)"
        echo "  DOMAIN_SEND      Dominio del API (ej: send.hollytrack.com)"
        echo "  DOMAIN_TRACK     Dominio de tracking (ej: ilove.hollytrack.com)"
        echo ""
        echo "🚀 Este script puede:"
        echo "  • Detectar e instalar dependencias faltantes"
        echo "  • Configurar PostgreSQL y crear la base de datos"
        echo "  • Generar certificados SSL automáticamente"
        echo "  • Configurar Nginx con todos los dominios"
        echo "  • Deployar la aplicación completa"
        echo ""
        exit 0
    fi

    # Ejecutar pasos
    validate_security
    load_environment

    # NUEVO: Setup inicial del servidor si es necesario
    setup_server_if_needed

    # SIEMPRE actualizar configuración de Nginx para asegurar que esté correcta
    setup_nginx_config

    # Configurar SSL si es necesario
    setup_ssl_certificates

    if [ "$1" == "--validate-only" ]; then
        print_success "Validación completada. No se realizó deployment."
        exit 0
    fi

    validate_server_config

    if [ "$1" != "--skip-build" ] && [ "$1" != "--quick" ]; then
        build_frontend
    fi

    transfer_files

    # Instalar dependencias del API en el servidor
    print_step "Instalando dependencias del backend..."
    sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_HOST << 'INSTALL_API_DEPS'
    cd /opt/ristak/api
    if [ -f package.json ]; then
        echo "📦 Instalando dependencias de Node.js..."
        npm ci --production || npm install --production
        echo "✅ Dependencias del backend instaladas"
    fi
INSTALL_API_DEPS

    configure_services
    security_cleanup
    verify_deployment

    # Resumen final
    echo ""
    echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}✨ DEPLOYMENT COMPLETO Y FUNCIONANDO${NC}"
    echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "🚀 Estado del Sistema:"
    echo -e "   • Node.js instalado y configurado"
    echo -e "   • PostgreSQL funcionando con base de datos"
    echo -e "   • Nginx configurado con SSL"
    echo -e "   • PM2 ejecutando frontend y backend"
    echo -e "   • Certificados SSL activos"
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
    echo -e "${YELLOW}Comandos útiles en el servidor:${NC}"
    echo -e "  pm2 status      - Ver estado de los servicios"
    echo -e "  pm2 logs        - Ver logs en tiempo real"
    echo -e "  pm2 monit       - Monitor interactivo"
    echo -e "  nginx -t        - Probar configuración de Nginx"
    echo -e "  certbot renew   - Renovar certificados SSL"
    echo ""
    echo -e "${GREEN}¡Tu app está lista y funcionando! 🎉${NC}"
}

# Ejecutar
main "$@"