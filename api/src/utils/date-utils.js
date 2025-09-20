/**
 * Utilidades para manejo consistente de fechas en el backend
 * Mantiene la misma lógica que el frontend para evitar inconsistencias
 *
 * IMPORTANTE: Las fechas se manejan en UTC en la DB
 * pero deben considerar el timezone del usuario para queries
 */

/**
 * Convierte una fecha string YYYY-MM-DD a un Date con hora inicio del día
 * @param {string} dateString - Fecha en formato YYYY-MM-DD
 * @param {string} timezone - Timezone del usuario (opcional, default: America/Mexico_City)
 * @returns {Date} Fecha al inicio del día ajustada por timezone
 */
function parseStartDate(dateString, timezone = 'America/Mexico_City') {
  // Obtener el offset del timezone
  const offset = getTimezoneOffset(timezone)
  // Crear fecha asumiendo que viene en el timezone del usuario
  const date = new Date(dateString + 'T00:00:00.000Z')
  // Ajustar por el offset para obtener el UTC correcto
  date.setHours(date.getHours() - offset)
  return date
}

/**
 * Convierte una fecha string YYYY-MM-DD a un Date con hora fin del día
 * @param {string} dateString - Fecha en formato YYYY-MM-DD
 * @param {string} timezone - Timezone del usuario (opcional, default: America/Mexico_City)
 * @returns {Date} Fecha al final del día ajustada por timezone
 */
function parseEndDate(dateString, timezone = 'America/Mexico_City') {
  // Obtener el offset del timezone
  const offset = getTimezoneOffset(timezone)
  // Crear fecha asumiendo que viene en el timezone del usuario
  const date = new Date(dateString + 'T23:59:59.999Z')
  // Ajustar por el offset para obtener el UTC correcto
  date.setHours(date.getHours() - offset)
  return date
}

/**
 * Parsea una fecha que puede venir como string o Date
 * Mantiene consistencia con el frontend
 * @param {string|Date} date - Fecha a parsear
 * @returns {Date} Fecha parseada
 */
function parseDate(date) {
  if (date instanceof Date) return date

  // Si viene como string ISO, parsearlo directo
  if (typeof date === 'string' && date.includes('T')) {
    return new Date(date)
  }

  // Si viene solo fecha YYYY-MM-DD, tratarlo como mediodía UTC para evitar problemas
  return new Date(date + 'T12:00:00.000Z')
}

/**
 * Formatea una fecha para logs y debugging
 * @param {Date} date - Fecha a formatear
 * @returns {string} Fecha formateada
 */
function formatDateForLog(date) {
  return date.toISOString()
}

/**
 * Convierte una fecha a string ISO (para DB)
 * @param {Date} date - Fecha a convertir
 * @returns {string} Fecha en formato ISO
 */
function toISOString(date) {
  return date.toISOString()
}

/**
 * Convierte una fecha a string YYYY-MM-DD
 * @param {Date} date - Fecha a convertir
 * @returns {string} Fecha en formato YYYY-MM-DD
 */
function toDateString(date) {
  return date.toISOString().slice(0, 10)
}

/**
 * Suma días a una fecha
 * @param {Date} date - Fecha base
 * @param {number} days - Días a sumar
 * @returns {Date} Nueva fecha
 */
function addDays(date, days) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

/**
 * Resta días a una fecha
 * @param {Date} date - Fecha base
 * @param {number} days - Días a restar
 * @returns {Date} Nueva fecha
 */
function subtractDays(date, days) {
  const result = new Date(date)
  result.setDate(result.getDate() - days)
  return result
}

/**
 * Suma meses a una fecha
 * @param {Date} date - Fecha base
 * @param {number} months - Meses a sumar
 * @returns {Date} Nueva fecha
 */
function addMonths(date, months) {
  const result = new Date(date)
  result.setMonth(result.getMonth() + months)
  return result
}

/**
 * Suma años a una fecha
 * @param {Date} date - Fecha base
 * @param {number} years - Años a sumar
 * @returns {Date} Nueva fecha
 */
function addYears(date, years) {
  const result = new Date(date)
  result.setFullYear(result.getFullYear() + years)
  return result
}

/**
 * Obtiene el offset en horas de un timezone
 * @param {string} timezone - Nombre del timezone
 * @returns {number} Offset en horas
 */
function getTimezoneOffset(timezone) {
  const offsets = {
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
  return offsets[timezone] || 0
}

/**
 * Crea una fecha con tiempo añadido en segundos
 * @param {number} seconds - Segundos a añadir desde ahora
 * @returns {Date} Nueva fecha
 */
function dateFromNowInSeconds(seconds) {
  return new Date(Date.now() + seconds * 1000)
}

module.exports = {
  parseStartDate,
  parseEndDate,
  parseDate,
  formatDateForLog,
  toISOString,
  toDateString,
  addDays,
  subtractDays,
  addMonths,
  addYears,
  dateFromNowInSeconds,
  getTimezoneOffset
}