import { useState, useEffect } from 'react'
import { getApiUrl } from '../config/api'

export interface DateRange {
  start: Date
  end: Date
}

export interface TrafficSource {
  name: string
  value: number
  percentage: number
  color: string
  change: number
}

export function useTrafficData(dateRange: DateRange) {
  const [data, setData] = useState<TrafficSource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchTrafficData() {
      try {
        setLoading(true)
        setError(null)

        // Fetch real data from API
        const response = await fetch(
          getApiUrl(`/dashboard/traffic-sources?start=${dateRange.start.toISOString()}&end=${dateRange.end.toISOString()}`)
        )
        
        if (!response.ok) {
          throw new Error('Failed to fetch traffic data')
        }
        
        const trafficData = await response.json()
        setData(trafficData)
      } catch (err) {
        console.error('Error fetching traffic data:', err)
        setError('Error al cargar datos de tráfico')
        
        // Fallback data
        const fallbackData = [
          { name: 'Facebook', value: 4523, percentage: 42, color: '#1877f2', change: 12.5 },
          { name: 'Instagram', value: 3218, percentage: 30, color: '#e4405f', change: 8.3 },
          { name: 'Google', value: 1892, percentage: 18, color: '#4285f4', change: -5.2 },
          { name: 'Directo', value: 1074, percentage: 10, color: '#6b7280', change: 15.7 },
        ]
        setData(fallbackData)
      } finally {
        setLoading(false)
      }
    }

    fetchTrafficData()
  }, [dateRange.start, dateRange.end])

  return { data, loading, error }
}
