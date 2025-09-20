import { useState, useEffect } from 'react'
import { getApiUrl, fetchWithAuth } from '../config/api'
import { dateToApiString } from '../lib/dateUtils'

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

        // Format dates as YYYY-MM-DD for the API using timezone-aware conversion
        const startDate = dateToApiString(dateRange.start)
        const endDate = dateToApiString(dateRange.end)

        const response = await fetchWithAuth(
          getApiUrl(`/dashboard/traffic-sources?start=${startDate}&end=${endDate}`)
        )

        if (!response.ok) {
          throw new Error('Failed to fetch traffic data')
        }

        const trafficData = await response.json()

        // If no data, set empty array instead of fallback
        if (!trafficData || trafficData.length === 0) {
          setData([])
        } else {
          // Sort by value descending
          const sortedData = trafficData.sort((a: TrafficSource, b: TrafficSource) => b.value - a.value)
          setData(sortedData)
        }
      } catch (err) {
        console.error('Error fetching traffic data:', err)
        setError('Error al cargar datos de tráfico')
        setData([]) // Empty array instead of fallback data
      } finally {
        setLoading(false)
      }
    }

    fetchTrafficData()
  }, [dateRange.start, dateRange.end])

  return { data, loading, error }
}
