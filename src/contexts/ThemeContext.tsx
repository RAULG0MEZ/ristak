import React, { createContext, useContext, useState, useEffect } from 'react'
import { themes, sharedTokens } from '../theme/tokens'

type ThemeMode = 'light' | 'dark'
type ThemeSource = 'system' | 'manual' // De dónde viene la preferencia

interface ThemeContextType {
  theme: ThemeMode
  themeData: typeof themes.dark & typeof sharedTokens
  toggleTheme: () => void
  setTheme: (theme: ThemeMode) => void
  themeSource: ThemeSource // Para saber si es manual o automático
  resetToSystem: () => void // Para volver al modo automático
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Detectar preferencia del sistema operativo
  const getSystemPreference = (): ThemeMode => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark'
    }
    return 'light'
  }

  // Estado inicial con detección inteligente
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    // Primero revisar si hay una preferencia manual guardada
    const savedTheme = sessionStorage.getItem('manualTheme') as ThemeMode
    if (savedTheme) return savedTheme

    // Si no hay preferencia manual, usar la del sistema
    return getSystemPreference()
  })

  // Rastrear si el tema fue seteado manualmente
  const [themeSource, setThemeSource] = useState<ThemeSource>(() => {
    return sessionStorage.getItem('manualTheme') ? 'manual' : 'system'
  })

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme)
    setThemeSource('manual')
    // Guardar en sessionStorage para que persista durante la sesión
    sessionStorage.setItem('manualTheme', newTheme)
  }

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
  }

  // Función para volver al modo automático del sistema
  const resetToSystem = () => {
    sessionStorage.removeItem('manualTheme')
    setThemeSource('system')
    setThemeState(getSystemPreference())
  }

  // Escuchar cambios en la preferencia del sistema
  useEffect(() => {
    // Solo aplicar cambios automáticos si no hay override manual
    if (themeSource === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

      const handleChange = (e: MediaQueryListEvent) => {
        if (themeSource === 'system') {
          setThemeState(e.matches ? 'dark' : 'light')
        }
      }

      // Agregar listener para cambios en el sistema
      mediaQuery.addEventListener('change', handleChange)

      return () => {
        mediaQuery.removeEventListener('change', handleChange)
      }
    }
  }, [themeSource])

  useEffect(() => {
    // Apply theme to document root
    const root = document.documentElement
    const themeColors = themes[theme]

    const setVars = (prefix: string, obj: any) => {
      Object.entries(obj).forEach(([key, value]) => {
        const next = `${prefix}-${key}`
        if (typeof value === 'string') {
          root.style.setProperty(`--${next}`, value)
        } else if (value && typeof value === 'object') {
          setVars(next, value)
        }
      })
    }

    // Apply CSS variables for colors and effects (recursively)
    setVars('color', themeColors.colors)
    setVars('effect', themeColors.effects)

    // Add theme class to body
    document.body.classList.remove('light', 'dark')
    document.body.classList.add(theme)
  }, [theme])

  const themeData = { ...themes[theme], ...sharedTokens }

  return (
    <ThemeContext.Provider value={{ theme, themeData, toggleTheme, setTheme, themeSource, resetToSystem }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
