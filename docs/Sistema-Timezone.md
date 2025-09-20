# 🌍 SISTEMA DE TIMEZONE - ARQUITECTURA CORRECTA

## 🎯 PRINCIPIO FUNDAMENTAL
**TODO se guarda en UTC en la DB, TODO se muestra en el timezone configurado**

## 🔄 FLUJO DE DATOS

### 1. ENTRADA DE DATOS (Usuario → DB)
```
Usuario (México -6) → Input fecha → Convertir a UTC → Guardar en DB (UTC)
```

### 2. SALIDA DE DATOS (DB → Usuario)
```
DB (UTC) → Leer fecha → Convertir a timezone local → Mostrar al usuario
```

## 📊 CONFIGURACIÓN

La app tiene configuración de timezone en:
- **DB**: Campo `timezone` en tabla `users` (default: `America/Mexico_City`)
- **Frontend**: `SettingsContext` maneja el timezone
- **Storage**: LocalStorage guarda la configuración

## 🛠️ FUNCIONES PRINCIPALES

### Para Enviar a la API (Local → UTC)

```typescript
import { dateToUTCString, createDateInTimezone } from '../lib/dateUtils'

// Convertir una fecha local a UTC string
const utcString = dateToUTCString(new Date())

// Crear una fecha en timezone configurado y obtener UTC
const utcDate = createDateInTimezone(2024, 8, 13, 0, 0) // 13 sept 2024 00:00 en timezone config
```

### Para Mostrar en UI (UTC → Local)

```typescript
import { formatDateShort, formatDateLong, formatDateTime } from '../lib/dateUtils'

// Todas estas funciones YA aplican el timezone automáticamente
formatDateShort(payment.created_at)   // "13 sep 2024"
formatDateLong(contact.created_at)    // "13 de septiembre de 2024"
formatDateTime(log.timestamp)         // "13 sep 2024 14:30"
```

## 🎯 CASO DE USO: IMPORTACIÓN CSV

### PROBLEMA ANTERIOR
- CSV tiene: "13/09/2024"
- Frontend usaba timezone del navegador
- Si navegador en México: guardaba como `2024-09-13T06:00:00Z`
- Si navegador en Londres: guardaba como `2024-09-13T00:00:00Z`
- **INCONSISTENTE!**

### SOLUCIÓN IMPLEMENTADA
```typescript
// En csvUtils.ts - normalizeDate()
const dt = createDateInTimezone(year, month - 1, day, 0, 0)
return dt.toISOString()
```

Ahora SIEMPRE interpreta las fechas del CSV como si vinieran en el timezone configurado, sin importar dónde esté el navegador.

## 📝 EJEMPLOS PRÁCTICOS

### 1. Crear un nuevo contacto
```typescript
// MALO ❌ - Usa timezone del navegador
const contact = {
  created_at: new Date().toISOString()
}

// BUENO ✅ - Usa timezone configurado
const contact = {
  created_at: dateToUTCString(new Date())
}
```

### 2. Mostrar fecha de pago
```typescript
// MALO ❌ - No considera timezone
<td>{new Date(payment.paid_at).toLocaleDateString()}</td>

// BUENO ✅ - Usa timezone configurado
<td>{formatDateShort(payment.paid_at)}</td>
```

### 3. Filtrar por rango de fechas
```typescript
// MALO ❌ - Fechas locales del navegador
const params = {
  start: dateRange.start.toISOString().split('T')[0],
  end: dateRange.end.toISOString().split('T')[0]
}

// BUENO ✅ - Considera timezone para los límites del día
const params = {
  start: dateToApiString(dateRange.start),
  end: dateToApiString(dateRange.end)
}
```

## 🚨 PUNTOS CRÍTICOS

### 1. Importaciones CSV
- Las fechas se interpretan en el timezone configurado
- No importa el timezone del navegador
- Se guardan correctamente offseteadas en UTC

### 2. DatePickers
- Deben mostrar fechas en timezone configurado
- Al seleccionar, convertir a UTC antes de guardar

### 3. Reportes y métricas
- Las agrupaciones por día deben considerar el timezone
- Los cortes de día (00:00) deben ser del timezone configurado

## 🔧 ZONAS HORARIAS SOPORTADAS

```javascript
const timezoneOffsets = {
  'America/Mexico_City': -6,
  'America/Tijuana': -7,
  'America/Cancun': -5,
  'America/New_York': -5,
  'America/Los_Angeles': -8,
  'America/Chicago': -6,
  'America/Bogota': -5,
  'America/Buenos_Aires': -3,
  'America/Sao_Paulo': -3,
  'Europe/Madrid': 1,
  'Europe/London': 0,
  'Europe/Paris': 1,
  'Asia/Tokyo': 9,
  'Australia/Sydney': 10
}
```

## ✅ CHECKLIST DE IMPLEMENTACIÓN

- [x] Funciones de conversión UTC ↔ Local
- [x] Actualizar normalizeDate() para CSV
- [x] Funciones de formato respetan timezone
- [x] Validar todos los DatePickers
- [x] Revisar queries de reportes
- [x] Corregir servicios backend para usar UTC
- [x] Middleware de timezone en todas las rutas
- [ ] Probar con diferentes timezones

## 🔒 GARANTÍAS DE UTC EN BACKEND

Todos los servicios ahora usan `new Date().toISOString()` para garantizar UTC:
- webhook.service.js - Appointments y pagos
- contacts.service.js - Crear y actualizar contactos
- payments.service.js - Crear y actualizar pagos
- tracking.service.js - Usa CURRENT_TIMESTAMP (UTC en PostgreSQL)

## 🐛 TROUBLESHOOTING

### Problema: La fecha se muestra un día antes/después
**Causa**: No se está usando el timezone configurado
**Solución**: Usar las funciones de `dateUtils.ts`

### Problema: Las importaciones tienen fechas incorrectas
**Causa**: Se está usando timezone del navegador
**Solución**: Verificar que `normalizeDate()` use `createDateInTimezone()`

### Problema: Los reportes muestran datos del día incorrecto
**Causa**: El corte de día no considera timezone
**Solución**: Usar `startOfMonthUTC()` y `endOfMonthUTC()` con timezone

## 📅 MIGRACIÓN

Para migrar código existente:

1. **Identificar** todos los lugares donde se manipulan fechas
2. **Reemplazar** `.toISOString()` por `dateToUTCString()`
3. **Reemplazar** `.toLocaleDateString()` por `formatDateShort()`
4. **Probar** con diferentes configuraciones de timezone
5. **Validar** que las fechas se vean correctas

---

*Última actualización: 2025-09-20*
*Sistema implementado para resolver el bug de timezone en importaciones*