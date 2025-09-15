# Decisiones de Arquitectura

## 2025-09-12 - Corrección de timezone en formatKey para Reports
- **Problema**: Las fechas de PostgreSQL con timezone causaban que septiembre se mostrara como agosto
- **Solución**: Usar métodos UTC (getUTCMonth/getUTCFullYear) en lugar de métodos locales
- **Impacto**: Reports ahora muestra correctamente los datos de cada mes independiente del timezone

## 2025-09-12 - Implementación de ventana de atribución de 3 días
- **Problema**: Contactos creados después del último día activo del anuncio no se contaban
- **Solución**: Ventana de atribución temporal de 3 días hasta implementar tracking de clicks real
- **Nota**: SOLUCIÓN TEMPORAL - Documentado extensivamente en el código

## 2025-09-12 - Separación de lógica "Todos" vs "Atribuidos" en Reports
- **Decisión**: Pestaña "Todos" muestra actividad real, "Atribuidos" solo con attribution_ad_id
- **Razón**: Dar visibilidad completa de la actividad vs métricas de atribución específicas