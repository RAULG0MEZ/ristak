#!/bin/bash

# Script para hacer pull desde GitHub de forma segura
# Uso: ./git-pull.sh

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔄 Iniciando sincronización con GitHub...${NC}"

# Verificar si hay cambios locales sin guardar
if ! git diff-index --quiet HEAD --; then
    echo -e "${YELLOW}⚠️  Hay cambios locales sin guardar${NC}"
    echo -e "${YELLOW}¿Quieres guardarlos antes de hacer pull? (s/n)${NC}"
    read -r respuesta

    if [[ "$respuesta" == "s" || "$respuesta" == "S" ]]; then
        echo -e "${GREEN}💾 Guardando cambios locales...${NC}"
        git add .
        git commit -m "Auto-save: Cambios locales antes de pull $(date '+%Y-%m-%d %H:%M:%S')"
        echo -e "${GREEN}✅ Cambios guardados${NC}"
    else
        echo -e "${YELLOW}⚠️  Haciendo stash de los cambios...${NC}"
        git stash
        echo -e "${GREEN}✅ Cambios guardados en stash${NC}"
    fi
fi

# Hacer fetch para ver qué hay nuevo
echo -e "${BLUE}🔍 Verificando cambios remotos...${NC}"
git fetch origin

# Verificar si hay actualizaciones
LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse @{u})
BASE=$(git merge-base @ @{u})

if [ $LOCAL = $REMOTE ]; then
    echo -e "${GREEN}✅ Ya estás actualizado con GitHub${NC}"
elif [ $LOCAL = $BASE ]; then
    echo -e "${YELLOW}📥 Hay nuevos cambios en GitHub${NC}"
    echo -e "${GREEN}⬇️  Descargando cambios...${NC}"

    if git pull origin main; then
        echo -e "${GREEN}✅ Actualización completada exitosamente!${NC}"

        # Mostrar resumen de cambios
        echo -e "${BLUE}📊 Resumen de cambios:${NC}"
        git log --oneline --graph -5
    else
        echo -e "${RED}❌ Error al hacer pull${NC}"
        echo -e "${YELLOW}Intenta resolver los conflictos manualmente${NC}"
        exit 1
    fi
elif [ $REMOTE = $BASE ]; then
    echo -e "${YELLOW}📤 Tienes cambios locales que no están en GitHub${NC}"
    echo -e "${YELLOW}Usa ./git-push.sh para subir tus cambios${NC}"
else
    echo -e "${YELLOW}⚠️  Las ramas han divergido${NC}"
    echo -e "${YELLOW}Intentando hacer merge...${NC}"

    if git pull origin main; then
        echo -e "${GREEN}✅ Merge completado exitosamente${NC}"
    else
        echo -e "${RED}❌ Hay conflictos que resolver${NC}"
        echo -e "${YELLOW}Resuelve los conflictos y luego ejecuta:${NC}"
        echo -e "${BLUE}git add . && git commit -m 'Resolver conflictos' && git push${NC}"
        exit 1
    fi
fi

# Si había stash, preguntar si restaurar
if git stash list | grep -q "stash@{0}"; then
    echo -e "${YELLOW}📦 Hay cambios en stash. ¿Restaurar? (s/n)${NC}"
    read -r respuesta

    if [[ "$respuesta" == "s" || "$respuesta" == "S" ]]; then
        echo -e "${GREEN}📤 Restaurando cambios del stash...${NC}"
        git stash pop
        echo -e "${GREEN}✅ Cambios restaurados${NC}"
    fi
fi