import { useState, useEffect } from 'react'
import { getApiUrl, fetchWithAuth } from '../config/api'
import { Icons } from '../icons'
import { dateToApiString } from '../lib/dateUtils'

export interface DateRange {
  start: Date
  end: Date
}

export interface FunnelItem {
  stage: string
  value: number
  icon: any
}

export function useFunnelData(dateRange: DateRange) {
  const [data, setData] = useState<FunnelItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchFunnelData() {
      try {
        setLoading(true)
        setError(null)

        const startDate = dateToApiString(dateRange.start)
        const endDate = dateToApiString(dateRange.end)

        // Ahora usar el endpoint de metrics que tiene la lógica adaptativa
        const response = await fetchWithAuth(
          getApiUrl(`/dashboard/metrics?start=${startDate}&end=${endDate}`)
        )

        if (!response.ok) {
          throw new Error('Failed to fetch funnel data')
        }

        const metricsData = await response.json()

        // Construir el embudo basado en si hay datos de tracking
        let funnelData: FunnelItem[] = []

        if (metricsData.hasTrackingData) {
          // Embudo completo con visitantes
          funnelData = [
            {
              stage: 'Visitantes',
              value: metricsData.visitors || 0,
              icon: Icons.mousePointer
            },
            {
              stage: 'Leads',
              value: metricsData.leads || 0,
              icon: Icons.userPlus
            },
            {
              stage: 'Citas',
              value: metricsData.qualified || 0,
              icon: Icons.calendar
            },
            {
              stage: 'Ventas',
              value: metricsData.customers || 0,
              icon: Icons.shoppingCart
            }
          ]
        } else {
          // Embudo simplificado sin visitantes
          funnelData = [
            {
              stage: 'Leads',
              value: metricsData.leads || 0,
              icon: Icons.userPlus
            },
            {
              stage: 'Citas',
              value: metricsData.qualified || 0,
              icon: Icons.calendar
            },
            {
              stage: 'Ventas',
              value: metricsData.customers || 0,
              icon: Icons.shoppingCart
            }
          ]
        }

        setData(funnelData)
      } catch (err) {
        console.error('Error loading funnel data:', err)
        setError('Error al cargar datos del funnel')
        setData([])
      } finally {
        setLoading(false)
      }
    }

    fetchFunnelData()
  }, [dateRange.start, dateRange.end])

  return { data, loading, error }
}