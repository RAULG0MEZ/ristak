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
const API_BASE = import.meta.env.VITE_API_URL || '/api'

// Si estamos en producción y no hay VITE_API_URL, usar ruta relativa
export const API_URL = isProduction && !import.meta.env.VITE_API_URL 
  ? '/api' 
  : API_BASE

// Función helper para construir URLs de API
export function getApiUrl(endpoint: string): string {
  // Asegurar que el endpoint empiece con /
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  
  // Si API_URL ya incluye /api, no duplicarlo
  if (API_URL.endsWith('/api') && cleanEndpoint.startsWith('/api')) {
    return `${API_URL}${cleanEndpoint.slice(4)}`
  }
  
  return `${API_URL}${cleanEndpoint}`
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