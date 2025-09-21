import { createDateInSpecificTimezone } from './dateUtils'

export interface CSVColumn {
  key: string
  name: string
  required?: boolean
  description?: string
}

export interface CSVMapping {
  [fieldKey: string]: string // fieldKey -> csvColumn
}

export interface ParsedCSVData {
  headers: string[]
  rows: string[][]
  preview: Record<string, string>[]
}

export type ImportType = 'contacts' | 'payments' | 'appointments'

// Definición de campos por tipo de importación
export const FIELD_DEFINITIONS: Record<ImportType, CSVColumn[]> = {
  contacts: [
    { key: 'contactId', name: 'ID de Contacto (CRM externo)', required: true, description: 'ID único del contacto en tu CRM actual' },
    { key: 'createdAt', name: 'Fecha de Creación', required: true, description: 'Fecha cuando se creó el contacto (formato: YYYY-MM-DD o MM/DD/YYYY)' },
    { key: 'email', name: 'Email' },
    { key: 'firstName', name: 'Nombre' },
    { key: 'lastName', name: 'Apellido' },
    { key: 'phone', name: 'Teléfono' },
    { key: 'company', name: 'Empresa' },
    { key: 'attributionId', name: 'ID de Atribución (Ad ID)' },
    { key: 'rstkSource', name: 'Fuente de Atribución (rstk_source)', description: 'Fuente del ad_id (fb_ad, instagram_ad, etc.)' },
    { key: 'status', name: 'Estado' },
    { key: 'source', name: 'Fuente/Origen' },
    { key: 'tags', name: 'Etiquetas' },
  ],
  payments: [
    { key: 'contactId', name: 'ID de Contacto', required: true },
    { key: 'transactionId', name: 'ID de Transacción' },
    { key: 'amount', name: 'Monto/Pagos', required: true },
    { key: 'paymentDate', name: 'Fecha de Pago' },
    { key: 'paymentMethod', name: 'Método de Pago' },
    { key: 'invoiceNumber', name: 'Número de Factura' },
    { key: 'currency', name: 'Moneda' },
    { key: 'description', name: 'Descripción/Concepto' },
    { key: 'status', name: 'Estado del Pago' },
    { key: 'firstName', name: 'Nombre' },
    { key: 'lastName', name: 'Apellido' },
    { key: 'fullName', name: 'Nombre Completo' },
    { key: 'email', name: 'Email' },
    { key: 'phone', name: 'Teléfono' },
  ],
  appointments: [
    { key: 'contactId', name: 'ID de Contacto', required: true },
    { key: 'appointmentDate', name: 'Fecha de Cita', required: false },
    { key: 'appointmentTime', name: 'Hora de Cita' },
    { key: 'status', name: 'Estado' },
    { key: 'type', name: 'Tipo de Cita' },
    { key: 'duration', name: 'Duración (minutos)' },
    { key: 'notes', name: 'Notas/Observaciones' },
    { key: 'firstName', name: 'Nombre' },
    { key: 'lastName', name: 'Apellido' },
    { key: 'email', name: 'Email' },
    { key: 'phone', name: 'Teléfono' },
    { key: 'location', name: 'Ubicación/Lugar' },
  ],
}

// Patrones para mapeo automático inteligente
const MAPPING_PATTERNS: Record<string, string[]> = {
  contactId: ['contact id', 'contactid', 'contact_id', 'id', 'contact', 'cliente id', 'client id', 'customer id'],
  email: ['email', 'correo', 'e-mail', 'mail', 'correo electronico', 'correo_electronico'],
  firstName: ['nombre', 'first name', 'first', 'firstname', 'first_name', 'primer nombre', 'nombres'],
  lastName: ['apellido', 'last name', 'last', 'lastname', 'last_name', 'apellidos', 'segundo nombre'],
  fullName: ['nombre completo', 'full name', 'fullname', 'nombre_completo', 'cliente', 'persona'],
  phone: ['phone', 'telefono', 'tel', 'telephone', 'celular', 'movil', 'numero', 'teléfono', 'whatsapp'],
  company: ['company', 'empresa', 'organization', 'organizacion', 'compania', 'compañia', 'negocio'],
  attributionId: ['ad_id', 'adid', 'attribution', 'anuncio', 'attribution_id', 'ad id', 'fb clickld', 'google clickld', 'campaign id'],
  rstkSource: ['rstk_source', 'ad_source', 'ad source', 'fuente del ad', 'plataforma', 'red social', 'campaign source', 'utm_medium'],
  createdAt: ['fecha de contacto creado', 'created', 'fecha', 'date', 'created_at', 'creation_date', 'fecha creacion', 'fecha_creacion'],
  transactionId: ['id transacción', 'id transaccion', 'transaction_id', 'transactionid', 'trans_id', 'transaction', 'id_transaccion'],
  amount: ['pagos', 'pago', 'amount', 'monto', 'total', 'value', 'valor', 'importe', 'precio', 'costo'],
  paymentDate: ['fecha', 'payment_date', 'fecha_pago', 'paid_at', 'fecha de pago', 'fecha pago', 'date'],
  paymentMethod: ['payment_method', 'method', 'metodo', 'metodo de pago', 'forma de pago', 'tipo de pago'],
  invoiceNumber: ['invoice', 'factura', 'invoice_number', 'numero factura', 'folio', 'recibo'],
  currency: ['currency', 'moneda', 'divisa'],
  description: ['descripción', 'descripcion', 'description', 'desc', 'detalle', 'concepto', 'servicio', 'producto'],
  appointmentDate: ['appointment_date', 'fecha_cita', 'scheduled_at', 'fecha de cita', 'fecha cita', 'fecha agendada'],
  appointmentTime: ['hora', 'time', 'hora_cita', 'appointment_time', 'hora de cita'],
  status: ['estado', 'status', 'estatus', 'situacion', 'condicion'],
  notes: ['notes', 'notas', 'comments', 'observaciones', 'comentarios', 'detalles'],
  source: ['source', 'fuente', 'origen', 'utm source', 'utm_source', 'session source'],
  tags: ['tags', 'etiquetas', 'labels', 'categorias'],
  type: ['tipo', 'type', 'categoria', 'clase'],
  duration: ['duracion', 'duration', 'tiempo', 'minutos'],
  location: ['ubicacion', 'location', 'lugar', 'direccion', 'sitio'],
}

export function parseCSVContent(csvContent: string): ParsedCSVData {
  const lines = csvContent.trim().split('\n')
  
  // Parseo inteligente de CSV que maneja campos con comas dentro de comillas
  const parseCSVLine = (line: string): string[] => {
    const result = []
    let current = ''
    let inQuotes = false
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      const nextChar = line[i + 1]
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"'
          i++ // Skip next quote
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    
    result.push(current.trim())
    return result
  }
  
  const headers = parseCSVLine(lines[0])
  
  const rows = lines.slice(1)
    .filter(line => line.trim()) // Filtrar líneas vacías
    .map(line => {
      const row = parseCSVLine(line)
      // Asegurar que cada fila tenga el mismo número de columnas que los headers
      while (row.length < headers.length) {
        row.push('')
      }
      return row
    })

  // Crear vista previa con primeras 3 filas
  const preview = rows.slice(0, 3).map(row => {
    const previewRow: Record<string, string> = {}
    headers.forEach((header, index) => {
      previewRow[header] = row[index] || ''
    })
    return previewRow
  })

  return {
    headers,
    rows,
    preview
  }
}

// FUNCIÓN DESHABILITADA - Ahora el mapeo es 100% manual por decisión de UX
// export function generateAutomaticMapping(headers: string[], importType: ImportType): CSVMapping {
//   const fields = FIELD_DEFINITIONS[importType]
//   const mapping: CSVMapping = {}
//
//   for (const field of fields) {
//     const patterns = MAPPING_PATTERNS[field.key] || []
//     
//     // Buscar coincidencia exacta o parcial (case-insensitive)
//     const matchedHeader = headers.find(header => {
//       const headerLower = header.toLowerCase().replace(/[^a-z0-9]/g, '')
//       return patterns.some(pattern => 
//         headerLower === pattern.toLowerCase().replace(/[^a-z0-9]/g, '') ||
//         headerLower.includes(pattern.toLowerCase().replace(/[^a-z0-9]/g, '')) ||
//         pattern.toLowerCase().replace(/[^a-z0-9]/g, '').includes(headerLower)
//       )
//     })
//
//     if (matchedHeader) {
//       mapping[field.key] = matchedHeader
//     }
//   }
//
//   return mapping
// }

export function validateMapping(mapping: CSVMapping, importType: ImportType): string[] {
  const fields = FIELD_DEFINITIONS[importType]
  const errors: string[] = []

  const requiredFields = fields.filter(field => field.required)
  
  for (const field of requiredFields) {
    if (!mapping[field.key]) {
      errors.push(`Campo obligatorio "${field.name}" no está mapeado`)
    }
  }

  return errors
}

export function cleanAmount(value: string): number {
  if (!value) return 0
  
  // Convertir a string si no lo es
  let strValue = String(value).trim()
  
  // Remover símbolos de moneda primero
  strValue = strValue.replace(/[$€£¥₱₩]/g, '').trim()
  
  // Manejar formatos con paréntesis para negativos
  let isNegative = false
  if (strValue.startsWith('(') && strValue.endsWith(')')) {
    isNegative = true
    strValue = strValue.slice(1, -1)
  }
  
  // Remover espacios
  strValue = strValue.replace(/\s+/g, '')
  
  // Si tiene formato X,XXX (coma como separador de miles sin decimales)
  // o X,XXX.XX (coma como miles y punto como decimal)
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(strValue)) {
    // Formato americano: remover comas (son separadores de miles)
    strValue = strValue.replace(/,/g, '')
  } 
  // Si tiene formato X.XXX,XX (punto como miles y coma como decimal)
  else if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(strValue)) {
    // Formato europeo: remover puntos y cambiar coma por punto
    strValue = strValue.replace(/\./g, '').replace(',', '.')
  }
  // Para otros casos, detectar por posición
  else {
    const lastCommaIndex = strValue.lastIndexOf(',')
    const lastDotIndex = strValue.lastIndexOf('.')
    
    if (lastCommaIndex > lastDotIndex && lastCommaIndex > strValue.length - 4) {
      // Coma es decimal
      strValue = strValue.replace(/\./g, '').replace(',', '.')
    } else {
      // Coma es separador de miles o no hay decimales
      strValue = strValue.replace(/,/g, '')
    }
  }
  
  // Validar que sea un número
  const number = parseFloat(strValue)
  if (isNaN(number)) return 0
  
  return isNegative ? -number : number
}

export function splitName(fullName: string): { firstName: string; lastName: string } {
  if (!fullName) return { firstName: '', lastName: '' }
  
  const parts = fullName.trim().split(' ')
  const firstName = parts[0] || ''
  const lastName = parts.slice(1).join(' ')
  
  return { firstName, lastName }
}

/**
 * Normaliza una fecha con un timezone específico
 * @param dateValue - Valor de fecha del CSV
 * @param timezone - Timezone específico para esta importación
 */
export function normalizeDateWithTimezone(dateValue: string, timezone?: string): string | null {
  if (!dateValue) return null

  // Si no se especifica timezone, usar el configurado por defecto
  const importTimezone = timezone || 'America/Mexico_City'

  return normalizeDate(dateValue, importTimezone)
}

/**
 * Normaliza una fecha del CSV asumiendo que viene en el timezone configurado
 * y la convierte a UTC para guardar en la DB
 *
 * IMPORTANTE: Las fechas del CSV se interpretan como si vinieran en el timezone
 * configurado en la app, NO en el timezone del navegador
 */
export function normalizeDate(dateValue: string, timezone?: string): string | null {
  if (!dateValue) return null

  // Usar el timezone específico si se proporciona
  const timezoneToUse = timezone || 'America/Mexico_City'

  // Utilidad para validar componentes y evitar overflow de Date
  const isValidYMD = (y: number, m1: number, d: number) => {
    if (m1 < 1 || m1 > 12) return false
    if (d < 1 || d > 31) return false
    const dt = new Date(y, m1 - 1, d)
    return (
      dt.getFullYear() === y &&
      dt.getMonth() === m1 - 1 &&
      dt.getDate() === d
    )
  }

  try {
    const cleaned = dateValue.trim()

    // Manejo especial para formatos ambiguos DD/MM/YYYY vs MM/DD/YYYY
    let m = cleaned.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/)
    if (m) {
      const first = parseInt(m[1], 10)
      const second = parseInt(m[2], 10)
      const year = parseInt(m[3], 10)
      
      // Si el primer número es > 12, debe ser día (formato DD/MM/YYYY)
      if (first > 12) {
        if (isValidYMD(year, second, first)) {
          // Crear fecha en timezone específico y convertir a UTC
          const dt = createDateInSpecificTimezone(year, second - 1, first, 0, 0, timezoneToUse)
          return dt.toISOString()
        }
      }
      // Si el segundo número es > 12, debe ser día (formato MM/DD/YYYY)
      else if (second > 12) {
        if (isValidYMD(year, first, second)) {
          // Crear fecha en timezone específico y convertir a UTC
          const dt = createDateInSpecificTimezone(year, first - 1, second, 0, 0, timezoneToUse)
          return dt.toISOString()
        }
      }
      // Si ambos son <= 12, asumimos formato DD/MM/YYYY (preferencia para México)
      else {
        // Primero intentamos DD/MM/YYYY
        if (isValidYMD(year, second, first)) {
          // Crear fecha en timezone específico y convertir a UTC
          const dt = createDateInSpecificTimezone(year, second - 1, first, 0, 0, timezoneToUse)
          return dt.toISOString()
        }
        // Si no es válido, intentamos MM/DD/YYYY
        else if (isValidYMD(year, first, second)) {
          // Crear fecha en timezone específico y convertir a UTC
          const dt = createDateInSpecificTimezone(year, first - 1, second, 0, 0, timezoneToUse)
          return dt.toISOString()
        }
      }
    }

    // YYYY-MM-DD o YYYY/MM/DD (formato ISO)
    m = cleaned.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/)
    if (m) {
      const year = parseInt(m[1], 10)
      const month = parseInt(m[2], 10)
      const day = parseInt(m[3], 10)
      if (isValidYMD(year, month, day)) {
        // Crear fecha en timezone específico y convertir a UTC
        const dt = createDateInSpecificTimezone(year, month - 1, day, 0, 0, timezoneToUse)
        return dt.toISOString()
      }
    }

    // DD/MM/YY - asumimos formato DD/MM para años de dos dígitos
    m = cleaned.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2})$/)
    if (m) {
      const day = parseInt(m[1], 10)
      const month = parseInt(m[2], 10)
      const ys = parseInt(m[3], 10)
      const year = ys > 50 ? 1900 + ys : 2000 + ys
      if (isValidYMD(year, month, day)) {
        // Crear fecha en timezone específico y convertir a UTC
        const dt = createDateInSpecificTimezone(year, month - 1, day, 0, 0, timezoneToUse)
        return dt.toISOString()
      }
    }

    // Último recurso: Date.parse si trae algo tipo '2024-03-05T...' o nombres de mes
    const dt = new Date(cleaned)
    if (!isNaN(dt.getTime())) {
      // Si ya tiene hora, asumir que viene en timezone local y convertir a UTC
      if (cleaned.includes('T') || cleaned.includes(':')) {
        return dt.toISOString()
      } else {
        // Si no tiene hora, crear a medianoche en timezone configurado
        const dtLocal = createDateInSpecificTimezone(
          dt.getFullYear(),
          dt.getMonth(),
          dt.getDate(),
          0, 0,
          timezoneToUse
        )
        return dtLocal.toISOString()
      }
    }

    return null
  } catch {
    return null
  }
}

export function processCSVRow(
  row: string[],
  headers: string[],
  mapping: CSVMapping,
  importType: ImportType,
  timezone?: string
): Record<string, any> {
  const processedRow: Record<string, any> = {}

  // Mapear valores según el mapping
  Object.entries(mapping).forEach(([fieldKey, csvHeader]) => {
    const headerIndex = headers.indexOf(csvHeader)
    if (headerIndex !== -1) {
      let value = row[headerIndex] || ''

      // Aplicar limpieza específica según el campo
      switch (fieldKey) {
        case 'amount':
          processedRow[fieldKey] = cleanAmount(value)
          break
        case 'createdAt':
        case 'paymentDate':
        case 'appointmentDate':
          processedRow[fieldKey] = normalizeDateWithTimezone(value, timezone)
          break
        case 'email':
          // Validar email; si es inválido o vacío, dejar en blanco
          {
            const v = (value || '').trim()
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i
            if (!v || !emailRegex.test(v) || v.endsWith('@imported.local')) {
              processedRow[fieldKey] = ''
            } else {
              processedRow[fieldKey] = v
            }
          }
          break
        case 'firstName':
        case 'lastName':
          // Limpiar espacios y asegurarse de que no sean vacíos
          processedRow[fieldKey] = value.trim()
          break
        default:
          processedRow[fieldKey] = value
      }
    }
  })

  // Procesamiento especial para nombres
  // Si hay fullName mapeado, dividirlo en firstName y lastName
  if (mapping.fullName && processedRow.fullName) {
    const { firstName, lastName } = splitName(processedRow.fullName)
    if (!processedRow.firstName) processedRow.firstName = firstName
    if (!processedRow.lastName) processedRow.lastName = lastName
    delete processedRow.fullName // Remover fullName ya que no es un campo de DB
  }
  
  // Si solo hay firstName y contiene nombre completo, dividirlo
  if (mapping.firstName && !mapping.lastName && processedRow.firstName && processedRow.firstName.includes(' ')) {
    const { firstName, lastName } = splitName(processedRow.firstName)
    processedRow.firstName = firstName
    processedRow.lastName = lastName
  }

  // Log para debugging en desarrollo
  if (import.meta.env.DEV && (importType === 'appointments' || importType === 'payments')) {
    console.log('Procesando fila CSV:', {
      importType,
      contactId: processedRow.contactId,
      firstName: processedRow.firstName,
      lastName: processedRow.lastName,
      email: processedRow.email
    })
  }

  // Valores por defecto específicos
  if (importType === 'contacts') {
    processedRow.status = processedRow.status || 'lead'
    processedRow.source = processedRow.source || 'csv_import'
  }

  if (importType === 'payments') {
    processedRow.currency = processedRow.currency || 'MXN'
    processedRow.source = processedRow.source || 'payment_import'
    processedRow.status = processedRow.status || 'Pagado'
  }
  
  if (importType === 'appointments') {
    processedRow.status = processedRow.status || 'scheduled'
    processedRow.duration = processedRow.duration || 30
    processedRow.type = processedRow.type || 'consultation'
    
    // Si hay fecha y hora por separado, combinarlas
    if (processedRow.appointmentDate && processedRow.appointmentTime) {
      try {
        const date = new Date(processedRow.appointmentDate)
        const [hours, minutes] = processedRow.appointmentTime.split(':').map(Number)
        if (!isNaN(hours) && !isNaN(minutes)) {
          date.setHours(hours, minutes, 0, 0)
          processedRow.appointmentDate = date.toISOString()
        }
      } catch (e) {
        // Si falla, dejar solo la fecha
      }
    }
  }

  return processedRow
}
