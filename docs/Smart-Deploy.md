Smart Deploy — Brief de Documentación

Descripción general

El sistema de Smart Deploy está diseñado para que, con un solo clic o comando desde local, se realice un despliegue completo y automatizado de la aplicación (frontend y backend). El objetivo es lograr un zero-touch deployment, es decir, que no sea necesario entrar manualmente al servidor ni hacer configuraciones a mano.

Este enfoque asegura que cada despliegue sea limpio, reproducible y consistente, evitando acumulación de archivos, errores de configuración o procesos manuales.

⸻

Objetivos clave
	1.	Zero-touch / Push-button: con un solo comando o botón, el sistema conecta con el servidor y ejecuta todo el proceso de deploy.
	2.	Immutable deploys: cada nuevo despliegue reemplaza por completo lo anterior, limpiando basura, cachés y versiones viejas.
	3.	Provisioning automático: el sistema detecta dependencias o paquetes faltantes en el servidor y los instala; si ya existen, los ignora.
	4.	SSL y dominios: configuración automática de certificados SSL (ej. Let’s Encrypt o Caddy), validación de dominios/subdominios y renovación automática programada.
	5.	Plug-and-play en nuevos servidores: cambiar de servidor solo requiere actualizar IP/credenciales; el sistema provisiona y configura todo de manera automática.
	6.	Infraestructura como código (IaC): toda la lógica y configuración se definen en código/scripts, evitando configuraciones manuales.

⸻

Estándares y prácticas recomendadas
	•	Zero-touch deployment: despliegues sin intervención manual.
	•	Immutable deployments: no se conservan versiones previas; cada deploy es limpio.
	•	Server bootstrap scripts: scripts de arranque que preparan un servidor nuevo.
	•	IaC (Infrastructure as Code): uso de herramientas como Ansible, Terraform o Pulumi para describir y automatizar infraestructura.
	•	Automated SSL provisioning: uso de servicios como Let’s Encrypt o Caddy para manejar certificados SSL automáticamente.

⸻

Flujo esperado de Smart Deploy
	1.	Conexión: desde local se conecta al servidor (IP/credenciales definidas).
	2.	Limpieza: elimina archivos basura, cachés y restos de versiones anteriores.
	3.	Provisioning: instala dependencias faltantes (paquetes del sistema, librerías, etc.).
	4.	Build + Deploy: genera el build del frontend, sube el backend y aplica cambios necesarios (ej. migraciones de DB).
	5.	Configuración SSL/dominios: valida dominios y crea/renueva certificados SSL.
	6.	Arranque final: levanta servicios de frontend y backend, quedando listos en producción.

⸻

Palabras clave de referencia
	•	Zero-touch deployment
	•	Push-button deploy
	•	Immutable deploys
	•	Infrastructure as Code (IaC)
	•	Bootstrap / Provisioning scripts
	•	Automated SSL (Let's Encrypt, Caddy)

⸻

🔒 SEGURIDAD Y MANEJO DE CREDENCIALES

Principios fundamentales de seguridad

	1.	NUNCA hardcodear credenciales: contraseñas, tokens, API keys JAMÁS deben estar en el código fuente.
	2.	Separación de configuración: las credenciales viven en archivos .env locales que NUNCA se suben al repositorio.
	3.	Validación bidireccional: el servidor valida que las variables del deployment coincidan con las esperadas.
	4.	Principio de menor privilegio: usar usuarios específicos para deployment, no root.
	5.	Secretos rotables: diseñar el sistema para poder cambiar credenciales sin modificar código.

⸻

Arquitectura de seguridad recomendada

1. ESTRUCTURA DE ARCHIVOS

Local (tu máquina):
```
/proyecto
├── .env.local           # NUNCA se sube al repo (credenciales reales)
├── .env.example         # SÍ se sube al repo (plantilla sin valores)
├── .gitignore           # DEBE incluir .env*
└── deploy/
    ├── deploy.sh        # Script que LEE las credenciales del .env.local
    └── .deploy.secret   # Archivo con contraseña SSH (chmod 600)
```

Servidor (producción):
```
/etc/ristak-pro/
├── env.production       # Variables de entorno (chmod 600, solo root)
├── env.schema          # Lista de variables requeridas
└── deploy.keys         # Llaves SSH autorizadas
```

2. FLUJO DE VALIDACIÓN DE VARIABLES

```bash
# El deployment debe:
1. Leer variables locales desde .env.local
2. Conectar al servidor
3. Verificar que el servidor tiene TODAS las variables requeridas
4. Si falta alguna variable → ERROR y abortar
5. Si coinciden → proceder con deployment
```

3. MANEJO DE CREDENCIALES SSH

MALO (actual):
```bash
SERVER_PASSWORD="Raulgom123"  # ❌ NUNCA hacer esto
sshpass -p "$SERVER_PASSWORD" ssh root@servidor
```

BUENO - Opción 1: Variables de entorno
```bash
# .env.local (NO se sube al repo)
DEPLOY_PASSWORD=contraseña-segura

# deploy.sh
source .env.local
sshpass -p "$DEPLOY_PASSWORD" ssh deploy@servidor
```

MEJOR - Opción 2: SSH Keys
```bash
# Generar llave SSH específica para deployment
ssh-keygen -t ed25519 -f ~/.ssh/ristak-deploy -C "deploy@ristak"

# Copiar al servidor
ssh-copy-id -i ~/.ssh/ristak-deploy.pub deploy@servidor

# Usar en script
ssh -i ~/.ssh/ristak-deploy deploy@servidor
```

ÓPTIMO - Opción 3: Gestor de secretos
```bash
# Usar 1Password CLI, AWS Secrets, Vault, etc.
op read "op://Ristak/Deploy/password" | sshpass ssh deploy@servidor
```

⸻

Checklist de seguridad para deployment

PRE-DEPLOYMENT:
□ Archivo .env.local existe y tiene todas las variables
□ Archivo .env NUNCA está en el repositorio
□ .gitignore incluye .env* (excepto .env.example)
□ Credenciales SSH están en archivo separado o variable de entorno
□ Script valida que todas las variables existen antes de conectar

DURANTE DEPLOYMENT:
□ Conexión usa usuario no-root (ej: deploy, www-data)
□ Se validan las variables del servidor vs locales
□ No se muestran credenciales en logs/output
□ Se usa HTTPS/SSL para todas las transferencias
□ Se registra en log quién y cuándo hizo deployment

POST-DEPLOYMENT:
□ Verificar que no quedaron archivos .env en el servidor web público
□ Confirmar permisos 600 en archivos de configuración
□ Rotar credenciales si se detecta compromiso
□ Auditar logs de acceso regularmente

⸻

Implementación práctica: Script validador

```bash
#!/bin/bash
# deploy-secure.sh - Script de deployment seguro

# 1. CARGAR CREDENCIALES LOCALES
if [ ! -f .env.local ]; then
    echo "❌ ERROR: .env.local no encontrado"
    echo "Crea el archivo basándote en .env.example"
    exit 1
fi
source .env.local

# 2. VALIDAR VARIABLES REQUERIDAS
REQUIRED_VARS=(
    "DATABASE_URL"
    "ACCOUNT_ID"
    "SUBACCOUNT_ID"
    "JWT_SECRET"
    "DEPLOY_PASSWORD"
)

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ ERROR: Variable $var no está definida en .env.local"
        exit 1
    fi
done

# 3. VALIDAR CON SERVIDOR
echo "🔍 Validando variables con servidor..."
REMOTE_VARS=$(sshpass -p "$DEPLOY_PASSWORD" ssh deploy@servidor "cat /etc/app/env.schema")

# 4. COMPARAR VARIABLES
for var in $REMOTE_VARS; do
    if [ -z "${!var}" ]; then
        echo "❌ ERROR: Servidor requiere $var pero no está en local"
        exit 1
    fi
done

# 5. PROCEDER CON DEPLOYMENT
echo "✅ Variables validadas, iniciando deployment..."
```

⸻

Respuesta a incidentes de seguridad

SI LAS CREDENCIALES SE EXPONEN:

1. INMEDIATO (primeros 5 minutos):
   - Cambiar TODAS las contraseñas afectadas
   - Revocar tokens y API keys
   - Bloquear acceso temporal si es necesario

2. CORTO PLAZO (primera hora):
   - Auditar logs de acceso
   - Buscar actividad sospechosa
   - Notificar al equipo/usuarios si aplica

3. LARGO PLAZO (primer día):
   - Rotar todas las credenciales
   - Implementar 2FA donde sea posible
   - Revisar y mejorar procesos

⸻

Herramientas recomendadas

Para gestión de secretos:
	•	1Password CLI - Gestión de equipos
	•	HashiCorp Vault - Empresarial
	•	AWS Secrets Manager - Si usas AWS
	•	GitHub Secrets - Para GitHub Actions
	•	Doppler - Específico para developers

Para auditoría:
	•	git-secrets - Previene commits con secretos
	•	truffleHog - Busca secretos en historial Git
	•	fail2ban - Protege servidor de ataques

Para deployment:
	•	Ansible - Automatización con vault integrado
	•	Terraform - IaC con manejo de secretos
	•	GitHub Actions - CI/CD con secretos seguros
