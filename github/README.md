# 📁 Carpeta GitHub - Scripts de Git

Esta carpeta contiene todos los scripts y herramientas para gestionar Git y GitHub en el proyecto Ristak PRO.

## 📂 Contenido

- `git-push.sh` - Script para subir cambios a GitHub
- `git-pull.sh` - Script para descargar cambios desde GitHub
- `README.md` - Esta documentación

## 🚀 Uso Rápido

### Desde la raíz del proyecto:

```bash
# Subir cambios
npm run push "Tu mensaje de commit"

# Descargar cambios
npm run pull

# Sincronizar (pull + push)
npm run sync
```

### Directamente con los scripts:

```bash
# Subir cambios
./github/git-push.sh "Tu mensaje de commit"

# Descargar cambios
./github/git-pull.sh
```

## 📚 Documentación Completa

Ver `/docs/GIT_GUIDE.md` para instrucciones detalladas, solución de problemas y mejores prácticas.

## 🔒 Seguridad

Los scripts están configurados para:
- ✅ No subir archivos sensibles (.env, credenciales, etc.)
- ✅ Verificar cambios antes de hacer push
- ✅ Manejar conflictos de forma segura
- ✅ Guardar trabajo local antes de hacer pull

## ⚙️ Permisos

Si obtienes error de permisos:
```bash
chmod +x github/git-push.sh
chmod +x github/git-pull.sh
```