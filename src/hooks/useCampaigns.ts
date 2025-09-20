import { useState, useEffect } from 'react'
import { getApiUrl, fetchWithAuth } from '../config/api'
import { dateToApiString } from '../lib/dateUtils'

export interface CampaignsDateRange {
  start: Date
  end: Date
}

export function useCampaigns({ start, end }: CampaignsDateRange) {
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        // Formatear fechas como YYYY-MM-DD para evitar problemas de timezone
        const startStr = dateToApiString(start);
        const endStr = dateToApiString(end);
        // Removido log de debug

        const params = new URLSearchParams({ start: startStr, end: endStr })
        const url = getApiUrl(`/campaigns?${params.toString()}`)
        // URL construida correctamente

        const res = await fetchWithAuth(url)
        if (!res.ok) throw new Error('Failed to fetch campaigns')
        const json = await res.json()
        // Datos recibidos
        setCampaigns(json.data || [])
      } catch (e: any) {
        console.error('Error fetching campaigns', e)
        setError(e?.message || 'Unknown error')
        setCampaigns([])
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [start, end])

  return { campaigns, loading, error }
}

