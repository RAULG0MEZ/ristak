/**
 * Configuración centralizada de API
 * Detecta automáticamente el entorno y usa URLs relativas cuando es posible
 */

// En producción o cuando se usa proxy, usar rutas relativas
// En desarrollo con servidor separado, usar la variable de entorno
const isDevelopment = import.meta.env.DEV
const isProduction = import.meta.env.PROD

// Por defecto usar rutas relativas (funcionará con el proxy de Vite)
// Si se especifica VITE_API_URL, usarla (para desarrollo con servidores separados)
const API_BASE = import.meta.env.VITE_API_URL || ''

// Si estamos en producción y no hay VITE_API_URL, usar ruta relativa
export const API_URL = isProduction && !import.meta.env.VITE_API_URL
  ? '/api'
  : API_BASE

// Función helper para construir URLs de API
export function getApiUrl(endpoint: string): string {
  // Asegurar que el endpoint empiece con /
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`

  // Si tenemos VITE_API_URL configurado, usarlo directamente
  if (import.meta.env.VITE_API_URL) {
    // VITE_API_URL ya incluye /api al final (ej: http://localhost:3002/api)
    return `${import.meta.env.VITE_API_URL}${cleanEndpoint}`
  }

  // Si no hay VITE_API_URL, usar proxy local
  return `/api${cleanEndpoint}`
}

// Configuración específica para Meta OAuth
export function getMetaRedirectUri(): string {
  // En producción, usar la URL del dominio actual
  if (isProduction && typeof window !== 'undefined') {
    return `${window.location.origin}/api/meta/oauth/callback`
  }
  
  // En desarrollo, usar la configuración de entorno o el proxy
  return import.meta.env.VITE_META_REDIRECT_URI || 
         `${window.location.origin}/api/meta/oauth/callback`
}

export default {
  API_URL,
  getApiUrl,
  getMetaRedirectUri
}