import { useState, useEffect } from 'react'
import { getApiUrl } from '../config/api'

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
        const params = new URLSearchParams({ start: start.toISOString(), end: end.toISOString() })
        const res = await fetch(getApiUrl(`/campaigns?${params.toString()}`))
        if (!res.ok) throw new Error('Failed to fetch campaigns')
        const json = await res.json()
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

