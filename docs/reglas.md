# 📜 Reglas y Estándares de Código - Ristak PRO

## 🎯 Principios Fundamentales

### 1. 🔄 **Reutilización sobre Creación**
   - NO crees archivos nuevos si ya existe uno equivalente
   - Reutiliza y refactoriza el código existente
   - Consolida funcionalidad duplicada

### 2. 🎨 **Centralización de Estilos**
   - CERO estilos locales o inline
   - Todo estilo debe venir de tokens del tema o componentes globales
   - Un cambio en el tema debe reflejarse en toda la app

### 3. 🧬 **Un Preset por Componente**
   - Un solo componente base por tipo (Card, Table, Input, Modal, etc.)
   - Variantes mediante props y slots
   - NUNCA clonar componentes para variaciones

### 4. 🧿 **Cero Código Huérfano**
   - Registra todos los exports
   - Actualiza índices e imports
   - Elimina código obsoleto inmediatamente
   - Documenta todo cambio significativo

### 5. 🔁 **Cambios Idempotentes**
   - Lee → Planea → Aplica → Limpia
   - Cada cambio debe ser repetible sin romper nada
   - Validación antes y después

### 6. 📝 **Documentación Obligatoria**
   - Actualiza `docs/decisiones.md` con cada decisión importante
   - Formato: Fecha + Título + Motivo (1-3 líneas)
   - Mantén README actualizado

### 7. 🎯 **Consistencia Global**
   - Consistencia > Soluciones locales
   - Si algo rompe el patrón establecido, NO se implementa
   - Sigue las convenciones del proyecto

### 8. 🌍 **MANEJO DE FECHAS Y UTC (CRÍTICO)**
   - **TODO se guarda en UTC en la base de datos**
   - **TODO se muestra según el timezone configurado**
   - **NUNCA uses `new Date()` sin `.toISOString()` para guardar en DB**
   - **SIEMPRE considera el timezone del usuario al procesar fechas**
   - Flujo correcto: Usuario (hora local) → Convertir a UTC → Guardar en DB
   - Mostrar: DB (UTC) → Convertir a timezone configurado → Mostrar al usuario

## ✅ QUÉ SÍ HACER

- ✅ Usar componentes de `src/ui/` para toda la UI
- ✅ Aplicar variantes via props, no duplicar componentes
- ✅ Mantener todos los estilos en tokens o Tailwind
- ✅ Documentar decisiones importantes en `docs/decisiones.md`
- ✅ Limpiar código obsoleto inmediatamente
- ✅ Usar el sistema de iconos centralizado
- ✅ Mantener consistencia visual en toda la app
- ✅ Validar entrada en todos los endpoints
- ✅ Usar variables de entorno para configuración
- ✅ Escribir tests para lógica crítica
- ✅ SIEMPRE convertir fechas a UTC antes de guardar en DB
- ✅ Usar `.toISOString()` para garantizar UTC en backend
- ✅ Usar funciones de `dateUtils.ts` para manejo de timezone
- ✅ En PostgreSQL usar `TIMESTAMPTZ` y funciones `NOW()` o `CURRENT_TIMESTAMP`

## ❌ QUÉ NO HACER

- ❌ NO crear estilos inline o CSS locales
- ❌ NO duplicar componentes (usar variantes)
- ❌ NO dejar archivos huérfanos o sin usar
- ❌ NO hardcodear colores, medidas o URLs
- ❌ NO romper el patrón visual establecido
- ❌ NO modificar componentes globales para casos específicos
- ❌ NO crear nuevos iconos sin agregarlos al sistema central
- ❌ NO commitear credenciales o `.env.local`
- ❌ NO dejar `console.log` en código de producción
- ❌ NO romper contratos de API existentes
- ❌ NO guardar fechas en DB sin convertir a UTC
- ❌ NO usar `new Date()` sin `.toISOString()` al guardar
- ❌ NO usar `.toISOString().split('T')[0]` para fechas (causa desfase)
- ❌ NO ignorar el timezone configurado del usuario

## 📋 Checklist de Validación

### Frontend
- [ ] Reutilicé componentes existentes de `/src/ui`
- [ ] Usé variantes via props en lugar de duplicar
- [ ] Todos los estilos están en tokens o Tailwind
- [ ] Eliminé código obsoleto y archivos no usados
- [ ] Actualicé exports e imports correctamente
- [ ] Probé en modo light/dark
- [ ] Los tooltips tienen offset correcto
- [ ] Las tablas usan el componente Table global
- [ ] No hay `console.log` en el código
- [ ] Los DatePickers usan funciones de timezone correctas
- [ ] Las fechas se envían a la API en formato UTC

### Backend
- [ ] Validación de entrada en todos los endpoints
- [ ] Manejo de errores consistente
- [ ] Lógica en servicios, datos en repositories
- [ ] Sin credenciales hardcodeadas
- [ ] Tests pasando
- [ ] Documentación de API actualizada
- [ ] Todas las fechas se guardan con `.toISOString()` o `NOW()`
- [ ] Las fechas recibidas se validan y convierten a UTC

### General
- [ ] Actualicé `docs/decisiones.md` si fue necesario
- [ ] Código formateado y sin warnings del linter
- [ ] Commit con mensaje descriptivo
- [ ] PR incluye descripción de cambios
- [ ] Sin archivos temporales o de prueba

## 🔄 Flujo de Trabajo

### ANTES
1. Lee el código existente relacionado
2. Revisa la documentación relevante
3. Planea la solución considerando reutilización

### DURANTE
1. Reutiliza componentes y servicios existentes
2. Centraliza lógica compartida
3. Valida cada cambio incrementalmente
4. Limpia código muerto al instante

### DESPUÉS
1. Pasa el checklist completo
2. Documenta decisiones importantes
3. Valida manualmente la funcionalidad
4. Asegúrate de no dejar basura

## 🕐 REGLAS ESPECÍFICAS DE TIMEZONE Y UTC

### Principio Fundamental
**TODO en la base de datos debe estar en UTC, sin excepciones.**

### Frontend
1. **Importación de datos**: Usar selector de timezone para interpretar fechas correctamente
2. **DatePickers**: Usar `createDateInTimezone()` para crear fechas en el timezone configurado
3. **Envío a API**: Siempre enviar fechas en formato ISO UTC usando `dateToUTCString()`
4. **Mostrar fechas**: Usar `formatDateShort()`, `formatDateLong()`, etc. que ya aplican timezone

### Backend
1. **Guardar fechas**: SIEMPRE usar `.toISOString()` antes de guardar
2. **PostgreSQL**: Usar `NOW()` o `CURRENT_TIMESTAMP` (ya retornan UTC)
3. **Recibir fechas**: Validar que vengan en formato ISO y convertir si es necesario
4. **Prisma**: Usar campos `@db.Timestamptz` para manejo correcto de timezone

### Ejemplos Correctos
```javascript
// Backend - Guardar fecha
const createdAt = new Date().toISOString(); // ✅ CORRECTO

// Frontend - Enviar fecha
const date = dateToUTCString(selectedDate); // ✅ CORRECTO

// PostgreSQL
INSERT INTO tabla (created_at) VALUES (NOW()); // ✅ CORRECTO
```

### Ejemplos INCORRECTOS
```javascript
// Backend - NO hacer esto
const createdAt = new Date(); // ❌ MAL - no es UTC garantizado

// Frontend - NO hacer esto
value={date.toISOString().split('T')[0]} // ❌ MAL - causa desfase

// Backend - NO hacer esto
const paidAt = new Date(paymentData.date); // ❌ MAL - no convierte a UTC
```

---
*Última actualización: 2025-09-20*
*Agregadas reglas críticas de manejo de UTC y timezone*