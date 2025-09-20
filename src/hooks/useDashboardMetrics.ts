import { useState, useEffect } from 'react'
import { formatCurrency } from '../lib/utils'
import { getApiUrl, fetchWithAuth } from '../config/api'
import { dateToApiString } from '../lib/dateUtils'

export interface DateRange {
  start: Date
  end: Date
}

interface DashboardMetrics {
  netIncome: number
  adSpend: number
  grossProfit: number
  roas: number
  vatToPay: number
  netProfit: number
  refunds: number
  avgLTV: number
  visitors: number
  leads: number
  qualified: number
  customers: number
  hasTrackingData?: boolean
  funnelType?: 'full' | 'simplified'
  trends: {
    netIncome: number
    adSpend: number
    grossProfit: number
    roas: number
    vatToPay: number
    netProfit: number
    refunds: number
    avgLTV: number
  }
}

export interface FormattedDashboardMetrics {
  financialMetrics: Array<{
    label: string
    value: string | number
    change: number
    trend: 'up' | 'down' | 'neutral'
    suffix?: string
  }>
  obligationsMetrics: Array<{
    label: string
    value: string | number
    change: number
    trend: 'up' | 'down' | 'neutral'
  }>
  funnelData: Array<{
    stage: string
    value: number
    icon: any
    color: string
    bgColor: string
  }>
  loading: boolean
  error: string | null
}

export function useDashboardMetrics(dateRange: DateRange): FormattedDashboardMetrics {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchMetrics() {
      try {
        setLoading(true)
        setError(null)
        
        // Fetch real data from API
        // Formatear fechas usando UTC para evitar problemas de timezone
        const startDate = dateToApiString(dateRange.start);
        const endDate = dateToApiString(dateRange.end);

        const response = await fetchWithAuth(
          getApiUrl(`/dashboard/metrics?start=${startDate}&end=${endDate}`)
        )
        
        if (!response.ok) {
          throw new Error('Failed to fetch metrics')
        }
        
        const data = await response.json()
        setMetrics(data)
      } catch (err) {
        console.error('Error loading dashboard metrics:', err)
        setError('Error al cargar las métricas')

        // Set to null to show default zeros in the UI
        setMetrics(null)
      } finally {
        setLoading(false)
      }
    }

    fetchMetrics()
  }, [dateRange.start, dateRange.end])

  // Format metrics for dashboard display
  const financialMetrics = metrics ? [
    {
      label: 'Ingresos Netos',
      value: formatCurrency(metrics.netIncome),
      change: metrics.trends.netIncome,
      trend: (metrics.trends.netIncome > 0 ? 'up' : metrics.trends.netIncome < 0 ? 'down' : 'neutral') as 'up' | 'down' | 'neutral'
    },
    {
      label: 'Gastos de Publicidad',
      value: formatCurrency(metrics.adSpend),
      change: metrics.trends.adSpend,
      trend: (metrics.trends.adSpend < 0 ? 'up' : metrics.trends.adSpend > 0 ? 'down' : 'neutral') as 'up' | 'down' | 'neutral'
    },
    {
      label: 'Ganancia Bruta',
      value: formatCurrency(metrics.grossProfit),
      change: metrics.trends.grossProfit,
      trend: (metrics.trends.grossProfit > 0 ? 'up' : metrics.trends.grossProfit < 0 ? 'down' : 'neutral') as 'up' | 'down' | 'neutral'
    },
    {
      label: 'ROAS',
      value: metrics.roas.toFixed(2),
      suffix: 'x',
      change: metrics.trends.roas,
      trend: (metrics.trends.roas > 0 ? 'up' : metrics.trends.roas < 0 ? 'down' : 'neutral') as 'up' | 'down' | 'neutral'
    }
  ] : []

  const obligationsMetrics = metrics ? [
    {
      label: 'IVA a Pagar',
      value: formatCurrency(metrics.vatToPay),
      change: metrics.trends.vatToPay,
      trend: (metrics.trends.vatToPay > 0 ? 'up' : metrics.trends.vatToPay < 0 ? 'down' : 'neutral') as 'up' | 'down' | 'neutral'
    },
    {
      label: 'Ganancia Neta',
      value: formatCurrency(metrics.netProfit),
      change: metrics.trends.netProfit,
      trend: (metrics.trends.netProfit > 0 ? 'up' : metrics.trends.netProfit < 0 ? 'down' : 'neutral') as 'up' | 'down' | 'neutral'
    },
    {
      label: 'Reembolsos',
      value: formatCurrency(metrics.refunds),
      change: metrics.trends.refunds,
      trend: (metrics.trends.refunds < 0 ? 'up' : metrics.trends.refunds > 0 ? 'down' : 'neutral') as 'up' | 'down' | 'neutral'
    },
    {
      label: 'LTV Promedio',
      value: formatCurrency(metrics.avgLTV),
      change: metrics.trends.avgLTV,
      trend: (metrics.trends.avgLTV > 0 ? 'up' : metrics.trends.avgLTV < 0 ? 'down' : 'neutral') as 'up' | 'down' | 'neutral'
    }
  ] : []

  // Construir el embudo dinámicamente basado en si hay datos de tracking
  const funnelData = metrics ? (
    // Si hay datos de tracking, mostrar embudo completo con visitantes
    metrics.hasTrackingData ? [
      {
        stage: 'Visitantes',
        value: metrics.visitors,
        icon: 'mousePointer',
        color: 'from-accent-blue to-accent-purple',
        bgColor: 'bg-accent-blue/10'
      },
      {
        stage: 'Leads',
        value: metrics.leads,
        icon: 'userPlus',
        color: 'from-indigo-400 to-indigo-600',
        bgColor: 'bg-indigo-500/10'
      },
      {
        stage: 'Citas',
        value: metrics.qualified,
        icon: 'calendar',
        color: 'from-purple-400 to-purple-600',
        bgColor: 'bg-purple-500/10'
      },
      {
        stage: 'Ventas',
        value: metrics.customers,
        icon: 'shoppingCart',
        color: 'from-green-400 to-green-600',
        bgColor: 'bg-green-500/10'
      }
    ] :
    // Si NO hay datos de tracking, embudo simplificado sin visitantes
    [
      {
        stage: 'Leads',
        value: metrics.leads,
        icon: 'userPlus',
        color: 'from-accent-blue to-accent-purple',
        bgColor: 'bg-accent-blue/10'
      },
      {
        stage: 'Citas',
        value: metrics.qualified,
        icon: 'calendar',
        color: 'from-indigo-400 to-indigo-600',
        bgColor: 'bg-indigo-500/10'
      },
      {
        stage: 'Ventas',
        value: metrics.customers,
        icon: 'shoppingCart',
        color: 'from-green-400 to-green-600',
        bgColor: 'bg-green-500/10'
      }
    ]
  ) : []

  return {
    financialMetrics,
    obligationsMetrics,
    funnelData,
    loading,
    error
  }
}
