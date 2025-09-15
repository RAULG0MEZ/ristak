import React, { createContext, useContext, useState, ReactNode } from 'react'

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

// Funciones helper para fechas comunes
export const startOfMonth = (date: Date): Date => {
  const result = new Date(date)
  result.setDate(1)
  result.setHours(0, 0, 0, 0)
  return result
}

export const endOfMonth = (date: Date): Date => {
  const result = new Date(date)
  result.setMonth(result.getMonth() + 1, 0)
  result.setHours(23, 59, 59, 999)
  return result
}

export function DateProvider({ children }: DateProviderProps) {
  // Inicializar con "Este mes" por defecto
  const [dateRange, setDateRange] = useState<DateRange>({
    start: startOfMonth(new Date()),
    end: endOfMonth(new Date())
  })

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