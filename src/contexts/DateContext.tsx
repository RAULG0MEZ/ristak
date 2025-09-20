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
  const now = new Date()
  const [dateRange, setDateRangeState] = useState<DateRange>({
    start: startOfMonth(now),
    end: endOfMonth(now)
  })

  const setDateRange = (newRange: DateRange) => {
    setDateRangeState(newRange)
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