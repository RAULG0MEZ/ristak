# Fundly - Contexto de Arquitectura

## Visión General
Aplicación de finanzas personales con diseño moderno glass morphism, arquitectura limpia y componentes reutilizables.

## Stack Tecnológico
- React 18 + TypeScript
- Vite (build tool)
- React Router (navegación)
- Tailwind CSS (estilos)
- Recharts (visualizaciones)
- Lucide React (iconos)

## Estructura del Proyecto
```
src/
├── ui/           # Componentes globales reutilizables
├── theme/        # Tokens de diseño y configuración de tema
├── icons/        # Biblioteca centralizada de iconos
├── modules/      # Módulos de negocio (sidebar, dashboard, etc)
├── pages/        # Páginas de la aplicación
├── lib/          # Utilidades y helpers
└── types/        # Definiciones de TypeScript
```

## Principios de Diseño
1. **Glass Morphism**: Efectos de transparencia y blur en componentes
2. **Dark Theme**: Interfaz oscura con acentos de color
3. **Componentes Reutilizables**: Un componente, múltiples variantes vía props
4. **Tokens de Diseño**: Colores, espaciados y estilos centralizados

## Reglas de Desarrollo
- NO estilos inline o locales - todo via Tailwind o tokens
- NO duplicación de componentes - usar variantes
- NO archivos huérfanos - limpiar lo obsoleto
- SI documentación de decisiones importantes
- SI consistencia sobre creatividad local