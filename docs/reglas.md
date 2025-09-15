# Reglas del Proyecto

## ✅ SÍ HACER

- Usar componentes de `src/ui/` para toda la UI
- Aplicar variantes via props, no duplicar componentes
- Mantener todos los estilos en tokens o Tailwind
- Documentar decisiones importantes
- Limpiar código obsoleto inmediatamente
- Usar el sistema de iconos centralizado
- Mantener consistencia visual en toda la app

## ❌ NO HACER

- NO crear estilos inline o CSS locales
- NO duplicar componentes (usar variantes)
- NO dejar archivos huérfanos o sin usar
- NO hardcodear colores o medidas
- NO romper el patrón de glass morphism
- NO modificar componentes globales para casos específicos
- NO crear nuevos iconos sin agregarlos al sistema central

## 📋 Checklist para PRs

- [ ] Reutilicé componentes existentes
- [ ] Usé variantes via props
- [ ] Todos los estilos están en tokens o Tailwind
- [ ] Eliminé código obsoleto
- [ ] Documenté decisiones importantes
- [ ] Probé en light/dark mode (cuando esté implementado)
- [ ] Los tooltips tienen offset correcto
- [ ] Las tablas usan el componente Table global