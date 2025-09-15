#!/bin/bash

# Script para hacer push rápido a GitHub
# Uso: ./git-push.sh "mensaje del commit"

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Verificar si se proporcionó un mensaje
if [ -z "$1" ]; then
    echo -e "${RED}❌ Error: Debes proporcionar un mensaje para el commit${NC}"
    echo -e "${YELLOW}Uso: ./git-push.sh \"mensaje del commit\"${NC}"
    exit 1
fi

# Mensaje del commit
MENSAJE="$1"

echo -e "${YELLOW}🚀 Iniciando proceso de push a GitHub...${NC}"

# Agregar todos los cambios
echo -e "${GREEN}📁 Agregando archivos...${NC}"
git add .

# Hacer commit
echo -e "${GREEN}💾 Creando commit: \"$MENSAJE\"${NC}"
git commit -m "$MENSAJE"

# Push a main
echo -e "${GREEN}📤 Subiendo cambios a GitHub...${NC}"
git push origin main

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Push completado exitosamente!${NC}"
else
    echo -e "${RED}❌ Error al hacer push. Verifica tu conexión y credenciales.${NC}"
    exit 1
fi