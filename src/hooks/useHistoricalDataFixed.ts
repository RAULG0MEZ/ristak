import { useState, useEffect } from 'react'
import { getApiUrl } from '../config/api'

export interface HistoricalDataPoint {
  month: string
  income: number
  expenses: number
}

/**
 * Hook para obtener siempre los últimos 12 meses de datos históricos
 * independientemente del DateRange seleccionado
 */
export function useHistoricalDataFixed() {
  const [data, setData] = useState<HistoricalDataPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchHistoricalData() {
      try {
        setLoading(true)
        setError(null)

        // Calcular los últimos 12 meses desde hoy
        const end = new Date()
        const start = new Date()
        start.setFullYear(start.getFullYear() - 1) // Un año atrás
        start.setMonth(start.getMonth() + 1) // Ajuste para incluir 12 meses completos
        start.setDate(1) // Primer día del mes
        start.setHours(0, 0, 0, 0)
        

        // Fetch real data from API
        const response = await fetch(
          getApiUrl(`/dashboard/historical?start=${start.toISOString()}&end=${end.toISOString()}`)
        )
        
        if (!response.ok) {
          throw new Error('Failed to fetch historical data')
        }
        
        const historicalData = await response.json()
        setData(historicalData)
      } catch (err) {
        console.error('Error fetching historical data:', err)
        setError('Error al cargar datos históricos')
        setData([])
      } finally {
        setLoading(false)
      }
    }

    fetchHistoricalData()
  }, []) // Sin dependencias - siempre los últimos 12 meses

  return { data, loading, error }
}