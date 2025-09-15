import React, { createContext, useContext, useState, useEffect } from 'react'
import { themes, sharedTokens } from '../theme/tokens'

type ThemeMode = 'light' | 'dark'

interface ThemeContextType {
  theme: ThemeMode
  themeData: typeof themes.dark & typeof sharedTokens
  toggleTheme: () => void
  setTheme: (theme: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    // Check local storage for saved theme preference
    const savedTheme = localStorage.getItem('theme') as ThemeMode
    // Check system preference
    const systemPreference = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
    return savedTheme || systemPreference
  })

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme)
    localStorage.setItem('theme', newTheme)
  }

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }

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
    <ThemeContext.Provider value={{ theme, themeData, toggleTheme, setTheme }}>
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
