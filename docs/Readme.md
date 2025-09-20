# 📚 Documentación de Ristak PRO

## 📖 Índice de Documentación

### 🏗️ Arquitectura y Desarrollo
- [**Ai-Context.md**](Ai-Context.md) - Contexto para IA y prompts de desarrollo
- [**Decisiones.md**](Decisiones.md) - Registro de decisiones de arquitectura
- [**Reglas.md**](Reglas.md) - Reglas y estándares de código
- [**Arquitectura.md**](Arquitectura.md) - Arquitectura del sistema

### 🚀 Deployment y DevOps
- [**Deployment-Guide.md**](Deployment-Guide.md) - Guía completa de deployment
- [**Smart-Deploy.md**](Smart-Deploy.md) - Sistema de deploy inteligente
- [**Variables-Entorno.md**](Variables-Entorno.md) - Configuración de variables de entorno
- [**Port-Configuration.md**](Port-Configuration.md) - Configuración de puertos

### 📊 Sistema de Tracking
- [**Tracking-Flujo-Completo.md**](Tracking-Flujo-Completo.md) - Flujo completo del sistema de tracking
- [**Tracking-Multitenant-Verificacion.md**](Tracking-Multitenant-Verificacion.md) - Verificación del sistema multitenant

### 🔐 Seguridad
- [**Security-Audit.md**](Security-Audit.md) - Auditoría de seguridad
- [**Reporte-Seguridad-Multitenant.md**](Reporte-Seguridad-Multitenant.md) - Reporte de seguridad multitenant

### 🔧 Integraciones
- [**Meta-Oauth-Setup.md**](Meta-Oauth-Setup.md) - Configuración de OAuth con Meta/Facebook

### 🛠️ Herramientas
- [**Git-Guide.md**](Git-Guide.md) - Guía de uso de Git y workflow

### 📦 API
- [**api/**](api/) - Documentación de API y OpenAPI specs

---

## 🎯 Guías Rápidas

### Iniciar en Desarrollo
```bash
npm run dev
```

### Deploy a Producción
```bash
npm run deploy
```

### Ejecutar Tests
```bash
npm test
```

## 📝 Notas Importantes

1. **Variables de Entorno**: Siempre usar `.env.local` para desarrollo, nunca commitear credenciales
2. **Deployment**: Usar el script `deploy-secure.sh` que valida antes de deployar
3. **Base de Datos**: PostgreSQL 14+ requerido
4. **Node Version**: 18+ requerido

## 🆘 Soporte

Si necesitas ayuda:
1. Revisa la documentación específica del área
2. Busca en los issues de GitHub
3. Contacta al equipo de desarrollo

---
*Última actualización: 2025-09-18*