/**
 * Configuración centralizada de API
 * Detecta automáticamente el entorno y usa URLs relativas cuando es posible
 */

// Normalizar la URL base para entornos donde existe una API externa
const rawApiUrl = import.meta.env.VITE_API_URL?.trim() ?? ''
const API_BASE = rawApiUrl.endsWith('/') ? rawApiUrl.slice(0, -1) : rawApiUrl

// Prefijo usado cuando trabajamos detrás del proxy de Vite
const PROXY_PREFIX = import.meta.env.VITE_API_PROXY_PREFIX || '/api'

export const API_URL = API_BASE || PROXY_PREFIX

// Función helper para construir URLs de API
export function getApiUrl(endpoint: string): string {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`

  // Si tenemos una API base explícita, usarla directamente
  if (API_BASE) {
    return `${API_BASE}${cleanEndpoint}`
  }

  // De lo contrario, usar el proxy configurado en Vite
  return `${PROXY_PREFIX}${cleanEndpoint}`
}

// Configuración específica para Meta OAuth
export function getMetaRedirectUri(): string {
  const explicitRedirect = import.meta.env.VITE_META_REDIRECT_URI
  if (explicitRedirect) return explicitRedirect

  if (API_BASE) {
    return `${API_BASE}/meta/oauth/callback`
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin || ''}${PROXY_PREFIX}/meta/oauth/callback`
}

// Headers de autenticación
export function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('auth_token');

  // Si no hay autenticación, devolver headers vacíos
  const headers: HeadersInit = {
    'Content-Type': 'application/json'
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

// Función helper para hacer fetch con headers de autenticación
export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  // Obtener timezone configurado del localStorage o usar default
  const userTimezone = localStorage.getItem('user_timezone') || 'America/Mexico_City';

  const headers = {
    ...getAuthHeaders(),
    'x-user-timezone': userTimezone,
    ...(options.headers || {})
  }

  const response = await fetch(url, {
    ...options,
    headers
  })

  if (response.status === 401 && typeof window !== 'undefined') {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('account_name')
    window.dispatchEvent(new Event('auth:unauthorized'))
  }

  return response
}

export default {
  API_URL,
  getApiUrl,
  getMetaRedirectUri,
  getAuthHeaders,
  fetchWithAuth
}
