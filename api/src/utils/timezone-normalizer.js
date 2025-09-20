/**
 * Utilidad para normalizar fechas entre el timezone de Meta y el de la aplicación
 *
 * Meta guarda las fechas en el timezone de la cuenta de anuncios
 * La app guarda todo en UTC pero muestra en el timezone configurado por el usuario
 * Esta utilidad convierte entre ambos para asegurar consistencia
 */

/**
 * Convierte una fecha del timezone de Meta al timezone de la aplicación
 * @param {Date|string} metaDate - Fecha que viene de Meta
 * @param {string} metaTimezone - Timezone de la cuenta Meta (ej: 'America/Mexico_City')
 * @param {string} appTimezone - Timezone configurado en la app (ej: 'America/Mexico_City')
 * @returns {Date} Fecha normalizada en UTC
 */
function normalizeMetaDate(metaDate, metaTimezone, appTimezone) {
  // Si ambos timezones son iguales, no hay que hacer nada
  if (metaTimezone === appTimezone) {
    return new Date(metaDate)
  }

  // Para simplificar, por ahora asumimos que ambos son Mexico City
  // En el futuro podemos usar una librería como date-fns-tz o moment-timezone
  // para conversiones más complejas

  const date = new Date(metaDate)

  // Map de offsets comunes (en horas desde UTC)
  const timezoneOffsets = {
    'America/Mexico_City': -6,
    'America/New_York': -5,
    'America/Los_Angeles': -8,
    'Europe/Madrid': 1,
    'Europe/London': 0,
    'Asia/Tokyo': 9,
    'Australia/Sydney': 10
  }

  const metaOffset = timezoneOffsets[metaTimezone] || 0
  const appOffset = timezoneOffsets[appTimezone] || 0

  // Calcular la diferencia de horas
  const hoursDiff = appOffset - metaOffset

  // Ajustar la fecha
  date.setHours(date.getHours() + hoursDiff)

  return date
}

/**
 * Convierte un rango de fechas para queries ajustando por timezone
 * @param {string} startDate - Fecha inicio YYYY-MM-DD
 * @param {string} endDate - Fecha fin YYYY-MM-DD
 * @param {string} appTimezone - Timezone de la aplicación
 * @returns {{start: Date, end: Date}} Fechas ajustadas para queries
 */
function getQueryDateRange(startDate, endDate, appTimezone = 'America/Mexico_City') {
  // Por ahora simplemente parseamos las fechas
  // El frontend envía fechas en el timezone local del usuario
  // Las guardamos como están para mantener consistencia

  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T23:59:59.999')

  return { start, end }
}

/**
 * Verifica si una fecha está dentro de un rango considerando timezone
 * @param {Date} date - Fecha a verificar
 * @param {Date} rangeStart - Inicio del rango
 * @param {Date} rangeEnd - Fin del rango
 * @returns {boolean} true si está dentro del rango
 */
function isDateInRange(date, rangeStart, rangeEnd) {
  return date >= rangeStart && date <= rangeEnd
}

module.exports = {
  normalizeMetaDate,
  getQueryDateRange,
  isDateInRange
}