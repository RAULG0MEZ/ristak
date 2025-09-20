/**
 * Utilidades para manejo consistente de fechas en la aplicación
 * Estas funciones usan el timezone configurado en Settings
 *
 * ARQUITECTURA DE FECHAS:
 * 1. TODO se guarda en UTC en la DB
 * 2. Al enviar a la API: convertir de timezone local a UTC
 * 3. Al recibir de la API: convertir de UTC a timezone local
 * 4. Al importar CSV: asumir que las fechas vienen en el timezone configurado
 */

import { getStoredSettings } from './appSettings'

/**
 * Obtiene el timezone configurado por el usuario
 */
function getUserTimezone(): string {
  const settings = getStoredSettings()
  return settings.timezone || 'America/Mexico_City'
}

/**
 * Obtiene el offset en horas de un timezone
 * Mapa simplificado de offsets comunes
 */
function getTimezoneOffset(timezone: string): number {
  const offsets: Record<string, number> = {
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
 * Convierte una fecha del timezone configurado a UTC
 * Para enviar a la API/DB
 */
export function localToUTC(date: Date | string, useConfiguredTimezone: boolean = true): Date {
  const inputDate = typeof date === 'string' ? new Date(date) : date

  if (!useConfiguredTimezone) {
    // Si no usamos timezone configurado, retornar como está (para compatibilidad)
    return inputDate
  }

  const timezone = getUserTimezone()
  const offset = getTimezoneOffset(timezone)

  // Crear nueva fecha ajustada
  const utcDate = new Date(inputDate.getTime())
  utcDate.setHours(utcDate.getHours() - offset)

  return utcDate
}

/**
 * Convierte una fecha UTC al timezone configurado
 * Para mostrar en el UI
 */
export function utcToLocal(date: Date | string, useConfiguredTimezone: boolean = true): Date {
  const inputDate = typeof date === 'string' ? new Date(date) : date

  if (!useConfiguredTimezone) {
    // Si no usamos timezone configurado, retornar como está
    return inputDate
  }

  const timezone = getUserTimezone()
  const offset = getTimezoneOffset(timezone)

  // Crear nueva fecha ajustada
  const localDate = new Date(inputDate.getTime())
  localDate.setHours(localDate.getHours() + offset)

  return localDate
}

/**
 * Convierte una fecha local (del timezone configurado) a ISO string UTC
 * Para enviar a la API
 */
export function dateToUTCString(date: Date | string): string {
  const utcDate = localToUTC(date)
  return utcDate.toISOString()
}

/**
 * Parsea una fecha de la DB (viene en UTC) y la convierte al timezone local
 * Para mostrar en el UI
 */
export function parseUTCDate(dateString: string | Date): Date {
  return utcToLocal(dateString)
}

/**
 * Crea una fecha en el timezone configurado y la convierte a UTC
 * Útil para crear fechas desde componentes de entrada
 * Si no se pasan parámetros, retorna la fecha actual en el timezone configurado
 */
export function createDateInTimezone(year?: number, month?: number, day?: number, hours: number = 0, minutes: number = 0): Date {
  // Si no se pasan parámetros, usar fecha actual
  if (year === undefined || month === undefined || day === undefined) {
    const now = new Date()
    return createDateInTimezone(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      now.getHours(),
      now.getMinutes()
    )
  }

  // Usar el timezone configurado del usuario
  const timezone = getUserTimezone()
  // Usar la función corregida para crear la fecha en el timezone específico
  return createDateInSpecificTimezone(year, month, day, hours, minutes, timezone)
}

/**
 * Crea una fecha en un timezone específico y la convierte a UTC
 * Útil para importaciones con timezone específico
 */
export function createDateInSpecificTimezone(
  year: number,
  month: number,
  day: number,
  hours: number = 0,
  minutes: number = 0,
  timezone: string = 'America/Mexico_City'
): Date {
  // Crear fecha directamente en UTC (sin aplicar timezone del navegador)
  const utcDate = new Date(Date.UTC(year, month, day, hours, minutes, 0, 0))

  // Obtener el offset del timezone específico
  const offset = getTimezoneOffset(timezone)

  // Ajustar por el offset para obtener el momento UTC correcto
  // Si es México (UTC-6) y son las 10:00 AM, en UTC son las 16:00 (10 + 6)
  utcDate.setUTCHours(utcDate.getUTCHours() - offset)

  return utcDate
}

/**
 * Convierte una fecha a string YYYY-MM-DD considerando el timezone configurado
 * Importante: Esto es para rangos de fecha en queries, no para guardar en DB
 */
export function dateToApiString(date: Date): string {
  const timezone = getUserTimezone()

  // Usar toLocaleDateString con el timezone configurado para obtener la fecha correcta
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: timezone
  }

  // Formatear la fecha en el timezone configurado
  const parts = date.toLocaleDateString('en-CA', options) // en-CA da formato YYYY-MM-DD
  return parts
}

/**
 * Crea una fecha al inicio del mes en la zona horaria local
 */
export function startOfMonthUTC(date: Date): Date {
  const year = date.getFullYear();
  const month = date.getMonth();
  // Usar createDateInTimezone para respetar timezone configurado
  return createDateInTimezone(year, month, 1, 0, 0);
}

/**
 * Crea una fecha al final del mes en la zona horaria local
 */
export function endOfMonthUTC(date: Date): Date {
  const year = date.getFullYear();
  const month = date.getMonth();
  // Obtener el último día del mes
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getDate();
  // Usar createDateInTimezone para respetar timezone configurado
  return createDateInTimezone(year, month, lastDay, 23, 59);
}

/**
 * Ajusta una fecha para mostrarla correctamente sin cambio de día
 * Si viene a las 00:00 UTC, le agrega 12 horas
 */
export function adjustDateForDisplay(date: Date | string): Date {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  const hours = dateObj.getUTCHours();
  const minutes = dateObj.getUTCMinutes();
  const seconds = dateObj.getUTCSeconds();

  // Si es medianoche UTC, agregamos 12 horas para evitar cambio de día
  if (hours === 0 && minutes === 0 && seconds === 0) {
    return new Date(dateObj.getTime() + 12 * 60 * 60 * 1000);
  }

  return dateObj;
}

/**
 * Parsea una fecha de la DB (que viene en UTC)
 * NOTA: Las funciones de formato ya aplican el timezone correctamente
 * usando toLocaleDateString/toLocaleString con timeZone option
 */
export function parseDbDate(dateString: string | Date): Date {
  if (dateString instanceof Date) return dateString;

  // Parsear la fecha ISO directamente
  // Las funciones de formato se encargan de mostrarla en el timezone correcto
  return new Date(dateString);
}

/**
 * Formatea una fecha para mostrar (día completo)
 * @param dateString - Fecha como string o Date
 * @returns Fecha formateada como "15 de septiembre de 2024"
 */
export function formatDateLong(dateString: string | Date): string {
  const date = parseDbDate(dateString);
  const timezone = getUserTimezone();

  return date.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: timezone
  });
}

/**
 * Formatea una fecha para mostrar (formato corto)
 * @param dateString - Fecha como string o Date
 * @returns Fecha formateada como "15 sep 2024"
 */
export function formatDateShort(dateString: string | Date): string {
  const date = parseDbDate(dateString);
  const timezone = getUserTimezone();

  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: timezone
  });
}

/**
 * Formatea una fecha con hora
 * @param dateString - Fecha como string o Date
 * @returns Fecha y hora formateada
 */
export function formatDateTime(dateString: string | Date): string {
  const date = parseDbDate(dateString);
  const timezone = getUserTimezone();

  return date.toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone
  });
}

/**
 * Resta meses a una fecha
 * @param date - Fecha base
 * @param months - Número de meses a restar
 * @returns Nueva fecha con los meses restados
 */
export function subtractMonths(date: Date, months: number): Date {
  const year = date.getFullYear();
  const month = date.getMonth() - months;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  return createDateInTimezone(year, month, day, hours, minutes);
}

/**
 * Suma meses a una fecha
 * @param date - Fecha base
 * @param months - Número de meses a sumar
 * @returns Nueva fecha con los meses sumados
 */
export function addMonths(date: Date, months: number): Date {
  const year = date.getFullYear();
  const month = date.getMonth() + months;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  return createDateInTimezone(year, month, day, hours, minutes);
}

/**
 * Resta días a una fecha
 * @param date - Fecha base
 * @param days - Número de días a restar
 * @returns Nueva fecha con los días restados
 */
export function subtractDays(date: Date, days: number): Date {
  const newDate = new Date(date.getTime());
  newDate.setDate(newDate.getDate() - days);
  return newDate;
}

/**
 * Suma días a una fecha
 * @param date - Fecha base
 * @param days - Número de días a sumar
 * @returns Nueva fecha con los días sumados
 */
export function addDays(date: Date, days: number): Date {
  const newDate = new Date(date.getTime());
  newDate.setDate(newDate.getDate() + days);
  return newDate;
}

/**
 * Obtiene el año actual
 * @returns Año actual como número
 */
export function getCurrentYear(): number {
  const now = new Date();
  return now.getFullYear();
}

/**
 * Obtiene el mes actual (0-11)
 * @returns Mes actual como número (0=enero, 11=diciembre)
 */
export function getCurrentMonth(): number {
  const now = new Date();
  return now.getMonth();
}

/**
 * Obtiene el día actual del mes
 * @returns Día actual como número (1-31)
 */
export function getCurrentDay(): number {
  const now = new Date();
  return now.getDate();
}

/**
 * Obtiene el último día de un mes específico
 * @param year - Año
 * @param month - Mes (0-11)
 * @returns Número del último día del mes
 */
export function getLastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getDate();
}

/**
 * Crea una fecha al inicio del año
 * @param year - Año (si no se especifica, usa el actual)
 * @returns Fecha al 1 de enero del año especificado
 */
export function startOfYear(year?: number): Date {
  const y = year || getCurrentYear();
  return createDateInTimezone(y, 0, 1, 0, 0);
}

/**
 * Formatea solo el año de una fecha
 * @param date - Fecha
 * @returns Año como string
 */
export function formatYear(date: Date): string {
  return date.getFullYear().toString();
}

/**
 * Formatea mes y año
 * @param date - Fecha
 * @returns String como "Septiembre 2024"
 */
export function formatMonthYear(date: Date): string {
  const timezone = getUserTimezone();
  return date.toLocaleDateString('es-ES', {
    month: 'long',
    year: 'numeric',
    timeZone: timezone
  });
}