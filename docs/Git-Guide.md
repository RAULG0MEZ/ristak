# 📚 Guía de Git - Ristak PRO

## 🚀 Comandos Rápidos

### Para Subir Cambios (PUSH)
```bash
# Opción 1: Con mensaje personalizado
./github/git-push.sh "Descripción de los cambios"

# Opción 2: Usando npm (recomendado)
npm run push "Descripción de los cambios"

# Opción 3: Push rápido (mensaje genérico)
npm run quick-push
```

### Para Descargar Cambios (PULL)
```bash
# Opción 1: Script inteligente
./github/git-pull.sh

# Opción 2: Usando npm (recomendado)
npm run pull

# Opción 3: Sincronización completa (pull + push)
npm run sync
```

---

## 📝 Instrucciones Detalladas

### 🔼 PUSH - Subir tus cambios a GitHub

El script `git-push.sh` hace lo siguiente automáticamente:
1. ✅ Agrega todos los archivos modificados
2. ✅ Crea un commit con tu mensaje
3. ✅ Sube los cambios a GitHub
4. ✅ Muestra confirmación con colores

**Uso básico:**
```bash
npm run push "Agregué nueva funcionalidad de pagos"
# O directamente con el script:
./github/git-push.sh "Agregué nueva funcionalidad de pagos"
```

**¿Cuándo usar cada comando?**
- `npm run push "mensaje"` → Cuando quieres un mensaje descriptivo
- `npm run quick-push` → Para cambios rápidos sin importancia
- `npm run sync` → Cuando necesitas actualizar y luego subir

### 🔽 PULL - Descargar cambios de GitHub

El script `git-pull.sh` es inteligente y:
1. 🔍 Verifica si hay cambios locales sin guardar
2. 💾 Te pregunta si quieres guardarlos antes
3. 📥 Descarga los cambios más recientes
4. 🔄 Resuelve automáticamente cuando es posible
5. ⚠️ Te avisa si hay conflictos

**Uso básico:**
```bash
npm run pull
# O directamente con el script:
./github/git-pull.sh
```

**Escenarios que maneja:**
- ✅ **Sin cambios locales** → Descarga directamente
- ✅ **Con cambios locales** → Te pregunta si guardar primero
- ✅ **Conflictos simples** → Intenta resolver automáticamente
- ⚠️ **Conflictos complejos** → Te guía para resolverlos

---

## 🛠️ Solución de Problemas

### Problema: "Permission denied" al ejecutar scripts
```bash
# Solución: Dar permisos de ejecución
chmod +x github/git-push.sh
chmod +x github/git-pull.sh
```

### Problema: "Fatal: not a git repository"
```bash
# Solución: Inicializar git
git init
git remote add origin https://github.com/RAULG0MEZ/ristak.git
```

### Problema: Conflictos al hacer pull
```bash
# El script te indicará, pero manualmente sería:
1. Abre los archivos con conflictos
2. Busca las marcas <<<<<<< HEAD
3. Elige qué código conservar
4. Elimina las marcas de conflicto
5. git add .
6. git commit -m "Resolver conflictos"
7. git push
```

### Problema: "Your branch is ahead/behind"
```bash
# Si estás adelante (tienes cambios locales):
npm run push "Tus cambios"

# Si estás atrás (GitHub tiene cambios nuevos):
npm run pull
```

---

## 🔒 Seguridad

### ⚠️ IMPORTANTE - Archivos que NUNCA se suben:
El archivo `.gitignore` ya está configurado para excluir:
- 🔐 `.env` y archivos de configuración con credenciales
- 🔑 Archivos `.key`, `.pem`, certificados
- 📁 `node_modules/` y archivos de build
- 💾 Backups y archivos temporales
- 🔒 Cualquier archivo con contraseñas o tokens

### Si accidentalmente commiteaste un archivo sensible:
```bash
# 1. Eliminar del historial (URGENTE)
git rm --cached archivo_sensible.env
git commit -m "Eliminar archivo sensible"
git push

# 2. Cambiar TODAS las contraseñas/tokens que estaban en ese archivo
# 3. Agregar el archivo a .gitignore para prevenir futuros accidentes
```

---

## 📊 Estado del Repositorio

### Ver estado actual:
```bash
git status
```

### Ver últimos commits:
```bash
git log --oneline -5
```

### Ver diferencias locales:
```bash
git diff
```

### Ver rama actual:
```bash
git branch
```

---

## 🎯 Flujo de Trabajo Recomendado

### Inicio del día:
```bash
# 1. Actualizar con los últimos cambios
npm run pull

# 2. Trabajar en tu código...

# 3. Al terminar, subir cambios
npm run push "Implementé nueva funcionalidad X"
```

### Trabajo en equipo:
```bash
# Antes de empezar cambios grandes
npm run pull

# Hacer commits frecuentes
npm run push "Parte 1: Estructura base"
npm run push "Parte 2: Lógica de negocio"
npm run push "Parte 3: UI y estilos"

# En lugar de un commit gigante
```

### Antes de irte:
```bash
# Siempre sube tus cambios antes de cerrar
npm run push "WIP: Trabajo en progreso - continuaré mañana"
```

---

## 🔗 Información del Repositorio

- **URL:** https://github.com/RAULG0MEZ/ristak
- **Rama principal:** main
- **Tipo:** Privado/Público (según tu configuración)

---

## 💡 Tips Pro

1. **Commits descriptivos**: Usa mensajes que expliquen el "por qué", no solo el "qué"
   - ❌ Mal: "Cambios en archivo"
   - ✅ Bien: "Corregir cálculo de IVA en pagos internacionales"

2. **Commits frecuentes**: Mejor muchos commits pequeños que uno gigante
   - Es más fácil encontrar problemas
   - Es más fácil revertir cambios específicos

3. **Pull antes de Push**: Siempre actualiza antes de subir
   ```bash
   npm run sync  # Hace pull y luego push automáticamente
   ```

4. **Revisa antes de pushear**:
   ```bash
   git status        # Ver qué archivos cambiarán
   git diff          # Ver exactamente qué cambiaste
   ```

5. **Usa ramas para features grandes** (avanzado):
   ```bash
   git checkout -b nueva-funcionalidad
   # ... trabajar ...
   git push origin nueva-funcionalidad
   ```

---

## 📞 ¿Necesitas Ayuda?

Si tienes problemas con Git:
1. Revisa esta guía
2. Los scripts tienen mensajes de ayuda coloridos
3. Google el mensaje de error específico
4. Pregunta antes de hacer `--force` en cualquier comando

---

**Última actualización:** $(date '+%Y-%m-%d')
**Repositorio:** https://github.com/RAULG0MEZ/ristak