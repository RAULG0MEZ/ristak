# 🔒 AUDITORÍA DE SEGURIDAD - RISTAK PRO
**Fecha:** 13 de Septiembre 2025
**Estado:** ⚠️ REQUIERE MEJORAS URGENTES

## 🚨 PROBLEMAS CRÍTICOS IDENTIFICADOS

### 1. **CONTRASEÑA DEL SERVIDOR EN TEXTO PLANO** 🔴
- **Ubicación:** `/deploy/scripts/smart-deploy.sh` línea 23
- **Problema:** `SERVER_PASSWORD="Raulgom123"` está hardcodeada
- **Riesgo:** Cualquiera con acceso al repo puede acceder al servidor

### 2. **CREDENCIALES DE BASE DE DATOS EXPUESTAS** 🔴
- **Ubicación:** Múltiples archivos `.env` en el proyecto
- **Problema:** La DATABASE_URL contiene usuario y contraseña en texto plano
- **Valor actual:** `postgresql://neondb_owner:npg_liGBDM5cUd2X@...`

### 3. **ARCHIVOS .ENV EN EL REPOSITORIO** 🟡
- `.env`, `.env.local`, `.env.production` contienen datos sensibles
- Estos archivos NO deberían estar en el código fuente

### 4. **PERMISOS DE ROOT EN SERVIDOR** 🟡
- El script se conecta como `root` al servidor
- Esto da acceso total al sistema

## ✅ ASPECTOS POSITIVOS

1. **Variables en el servidor están protegidas:**
   - `/etc/ristak-pro/env.production` tiene permisos 600 (solo root)
   - Las variables están fuera del directorio web

2. **SSL/HTTPS configurado:**
   - Certificados Let's Encrypt activos
   - Comunicación cifrada

3. **Secrets generados aleatoriamente:**
   - JWT_SECRET y SESSION_SECRET se generan con `openssl rand`

## 🛡️ MEJORAS URGENTES RECOMENDADAS

### PRIORIDAD 1 - INMEDIATO

#### 1. Eliminar contraseña del servidor del script
```bash
# MALO - Actual
SERVER_PASSWORD="Raulgom123"

# BUENO - Usar variable de entorno
SERVER_PASSWORD="${DEPLOY_PASSWORD}"  # Definir antes de ejecutar
```

**Cómo hacerlo:**
```bash
# Ejecutar el deployment así:
export DEPLOY_PASSWORD="tu-contraseña-segura"
./deploy/scripts/smart-deploy.sh
```

#### 2. Agregar .env al .gitignore
```bash
# Agregar a .gitignore
.env
.env.*
!.env.example
```

#### 3. Cambiar TODAS las contraseñas expuestas
- Contraseña del servidor SSH
- Contraseña de la base de datos
- Regenerar todos los tokens y secrets

### PRIORIDAD 2 - ESTA SEMANA

#### 4. Usar SSH Keys en lugar de contraseña
```bash
# Generar par de llaves SSH
ssh-keygen -t ed25519 -f ~/.ssh/ristak-deploy

# Copiar la llave pública al servidor
ssh-copy-id -i ~/.ssh/ristak-deploy.pub root@5.161.90.139

# Modificar el script para usar la llave
ssh -i ~/.ssh/ristak-deploy root@5.161.90.139
```

#### 5. Crear usuario específico para deployment
```bash
# En el servidor, crear usuario deploy
useradd -m -s /bin/bash deploy
usermod -aG sudo deploy

# Dar permisos específicos solo donde necesita
chown -R deploy:deploy /opt/ristak-pro
```

#### 6. Usar un gestor de secretos
- **GitHub Actions Secrets** (si usas GitHub)
- **Vault** de HashiCorp
- **AWS Secrets Manager**
- **1Password CLI** para equipos

### PRIORIDAD 3 - MEJORAS ADICIONALES

#### 7. Implementar rotación de secretos
- Rotar contraseñas cada 90 días
- Usar diferentes contraseñas para cada entorno
- Mantener un registro de auditoría

#### 8. Configurar fail2ban en el servidor
```bash
apt-get install fail2ban
# Protege contra ataques de fuerza bruta
```

#### 9. Restringir acceso SSH por IP
```bash
# En /etc/ssh/sshd_config
AllowUsers root@tu-ip-fija
```

## 📋 CHECKLIST DE SEGURIDAD INMEDIATA

- [ ] **CAMBIAR contraseña del servidor SSH**
- [ ] **CAMBIAR contraseña de la base de datos**
- [ ] **ELIMINAR archivos .env del repositorio**
- [ ] **AGREGAR .env a .gitignore**
- [ ] **MOVER credenciales a variables de entorno**
- [ ] **CONFIGURAR SSH keys en lugar de contraseña**
- [ ] **CREAR usuario no-root para deployments**
- [ ] **REGENERAR todos los tokens y secrets**

## 🔐 EJEMPLO DE CONFIGURACIÓN SEGURA

### 1. Archivo `.env.example` (este SÍ va al repo)
```env
# Database
DATABASE_URL=postgresql://user:pass@host/db

# API Keys (obtener de tu dashboard)
DEFAULT_SUBACCOUNT_ID=your-subaccount-id
ACCOUNT_ID=your-account-id

# Server (NO incluir contraseñas reales)
SERVER_HOST=your-server-ip
SERVER_USER=deploy
```

### 2. Script de deployment seguro
```bash
#!/bin/bash
# Verificar que las variables necesarias estén definidas
if [ -z "$DEPLOY_PASSWORD" ]; then
    echo "Error: DEPLOY_PASSWORD no está definida"
    echo "Uso: DEPLOY_PASSWORD='tu-pass' ./deploy.sh"
    exit 1
fi

# Usar la variable en lugar de hardcodear
sshpass -p "$DEPLOY_PASSWORD" ssh user@server
```

### 3. Usar archivo de configuración local (NO en repo)
```bash
# ~/.ristak/deploy.conf
export DEPLOY_PASSWORD="contraseña-segura"
export DB_PASSWORD="otra-contraseña"
export JWT_SECRET="token-super-secreto"

# Cargar antes de deployment
source ~/.ristak/deploy.conf
./deploy/scripts/smart-deploy.sh
```

## ⚠️ ADVERTENCIA IMPORTANTE

**Las credenciales actuales están comprometidas** porque:
1. Están en el código fuente
2. Pueden estar en el historial de Git
3. Cualquiera con acceso al repo las puede ver

**DEBES:**
1. Cambiar TODAS las contraseñas inmediatamente
2. Revisar logs del servidor para accesos no autorizados
3. Considerar el servidor como potencialmente comprometido

## 📞 SOPORTE

Si necesitas ayuda para implementar estas mejoras:
1. Puedo crear scripts seguros para ti
2. Puedo ayudarte a configurar SSH keys
3. Puedo guiarte paso a paso en cada cambio

**Recuerda:** La seguridad es un proceso continuo, no un destino final.