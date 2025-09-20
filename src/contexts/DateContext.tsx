import React, { createContext, useContext, useState, ReactNode } from 'react'
import { startOfMonthUTC, endOfMonthUTC } from '../lib/dateUtils'

interface DateRange {
  start: Date
  end: Date
}

interface DateContextType {
  dateRange: DateRange
  setDateRange: (range: DateRange) => void
}

const DateContext = createContext<DateContextType | undefined>(undefined)

interface DateProviderProps {
  children: ReactNode
}

// Re-exportamos las funciones para compatibilidad
export const startOfMonth = startOfMonthUTC
export const endOfMonth = endOfMonthUTC

export function DateProvider({ children }: DateProviderProps) {
  // Inicializar con "Este mes" como rango predeterminado
  // pero primero intentar cargar desde sessionStorage
  const now = new Date()

  const getInitialRange = (): DateRange => {
    // Intentar cargar de sessionStorage (solo persiste durante la sesión)
    const stored = sessionStorage.getItem('dateRange')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        return {
          start: new Date(parsed.start),
          end: new Date(parsed.end)
        }
      } catch (e) {
        // Si hay error, usar valores por defecto
      }
    }
    // Valores por defecto: Este mes
    return {
      start: startOfMonth(now),
      end: endOfMonth(now)
    }
  }

  const [dateRange, setDateRangeState] = useState<DateRange>(getInitialRange())

  const setDateRange = (newRange: DateRange) => {
    setDateRangeState(newRange)
    // Guardar en sessionStorage para persistir durante la sesión
    sessionStorage.setItem('dateRange', JSON.stringify({
      start: newRange.start.toISOString(),
      end: newRange.end.toISOString()
    }))
  }

  return (
    <DateContext.Provider value={{ dateRange, setDateRange }}>
      {children}
    </DateContext.Provider>
  )
}

export function useDateRange() {
  const context = useContext(DateContext)
  if (context === undefined) {
    throw new Error('useDateRange must be used within a DateProvider')
  }
  return context
}