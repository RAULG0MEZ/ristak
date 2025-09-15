import { useState, useEffect } from 'react'
import { getApiUrl } from '../config/api'

export interface DateRange {
  start: Date
  end: Date
}

export interface HistoricalDataPoint {
  month: string
  income: number
  expenses: number
}

export function useHistoricalData(dateRange: DateRange) {
  const [data, setData] = useState<HistoricalDataPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchHistoricalData() {
      try {
        setLoading(true)
        setError(null)

        // Fetch real data from API
        const response = await fetch(
          getApiUrl(`/dashboard/historical?start=${dateRange.start.toISOString()}&end=${dateRange.end.toISOString()}`)
        )
        
        if (!response.ok) {
          throw new Error('Failed to fetch historical data')
        }
        
        const historicalData = await response.json()
        setData(historicalData)
      } catch (err) {
        console.error('Error fetching historical data:', err)
        setError('Error al cargar datos históricos')
        
        // Solo usar fallback si realmente no hay datos
        // No sobreescribir datos reales con fallback
        setData([])
      } finally {
        setLoading(false)
      }
    }

    fetchHistoricalData()
  }, [dateRange.start, dateRange.end])

  return { data, loading, error }
}
