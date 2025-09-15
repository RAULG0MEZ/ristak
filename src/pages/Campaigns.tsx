import React, { useState, useMemo, useEffect } from 'react'
import { PageContainer, Card, TableWithHierarchy, Badge, Button, KPICard, DateRangePicker, TabList, Dropdown, DatePicker, ToastManager, Modal, ChartContainer } from '../ui'
import { useColumnsConfig } from '../hooks/useColumnsConfig'
import { Icons } from '../icons'
import { formatCurrency, formatNumber, cn } from '../lib/utils'
import { useDateRange } from '../contexts/DateContext'
import { useCampaigns } from '../hooks/useCampaigns'
import { useContacts } from '../hooks/useContacts'
import { getApiUrl } from '../config/api'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend } from 'recharts'
import { SmartRechartsTooltip } from '../components/SmartRechartsTooltip'
import { useTheme } from '../contexts/ThemeContext'

interface AdMetrics {
  adId: string
  adName: string
  status: 'active' | 'paused' | 'archived'
  spend: number
  reach: number
  clicks: number
  cpc: number
  visitors: number
  cpv: number
  leads: number
  cpl: number
  appointments: number
  sales: number
  cac: number
  revenue: number
  roas: number
}

interface AdSetMetrics {
  adSetId: string
  adSetName: string
  status: 'active' | 'paused' | 'archived'
  ads: AdMetrics[]
  spend: number
  reach: number
  clicks: number
  cpc: number
  visitors: number
  cpv: number
  leads: number
  cpl: number
  appointments: number
  sales: number
  cac: number
  revenue: number
  roas: number
}

interface CampaignMetrics {
  campaignId: string
  campaignName: string
  status: 'active' | 'paused' | 'archived'
  adSets: AdSetMetrics[]
  spend: number
  reach: number
  clicks: number
  cpc: number
  visitors: number
  cpv: number
  leads: number
  cpl: number
  appointments: number
  sales: number
  cac: number
  revenue: number
  roas: number
}

// Datos reales: vendrán del API en lugar de mocks

export function Campaigns() {
  const { dateRange, setDateRange } = useDateRange()
  const { campaigns, loading } = useCampaigns({ start: dateRange.start, end: dateRange.end })
  const { contacts } = useContacts({ start: dateRange.start, end: dateRange.end })
  const { theme, themeData } = useTheme()
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'paused'>('all')
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null)
  const [syncRunning, setSyncRunning] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  // Meta configuration modal state
  const [showMetaModal, setShowMetaModal] = useState(false)
  const [adAccounts, setAdAccounts] = useState<any[]>([])
  const [pixels, setPixels] = useState<any[]>([])
  const [selectedAdAccount, setSelectedAdAccount] = useState<string>('')
  const [selectedPixel, setSelectedPixel] = useState<string>('')
  const [sinceDate, setSinceDate] = useState<string>('')
  const [schedule, setSchedule] = useState<string>('1h')
  const [isConfiguring, setIsConfiguring] = useState(false)
  const [configError, setConfigError] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Array<{id: string; type: 'success'|'error'|'info'|'warning'; title: string; message?: string}>>([])
  
  // Detail modal state
  const [detailModal, setDetailModal] = useState<{
    isOpen: boolean
    type: 'leads' | 'appointments' | 'sales' | null
    data: any
    level: 'campaign' | 'adset' | 'ad'
    name: string
    rowId?: string
  }>({
    isOpen: false,
    type: null,
    data: null,
    level: 'campaign',
    name: ''
  })
  const [selectedContact, setSelectedContact] = useState<any>(null)
  const [showPayments, setShowPayments] = useState(false)

  const addToast = (type: 'success'|'error'|'info'|'warning', title: string, message?: string) => {
    const id = Math.random().toString(36).substring(2, 9)
    setToasts(prev => [...prev, { id, type, title, message }])
  }

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }

  useEffect(() => {
    let timer: any
    const poll = async () => {
      try {
        const r = await fetch(getApiUrl('/meta/sync/status'))
        const j = await r.json()
        setSyncRunning(Boolean(j?.data?.running))
      } catch {}
      timer = setTimeout(poll, 5000)
    }
    poll()
    return () => clearTimeout(timer)
  }, [])

  const minSinceDate = useMemo(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 35); return d.toISOString().slice(0,10)
  }, [])

  const handleMetaSyncClick = () => {
    const state = Math.random().toString(36).slice(2)
    const w = window.open(getApiUrl(`/meta/oauth/start?state=${state}`), 'MetaLogin', 'width=700,height=800')
    if (!w) return
    const onMsg = async (ev: MessageEvent) => {
      if (!ev?.data || ev.data.source !== 'ristak') return
      if (ev.data.type === 'meta-oauth-success') {
        window.removeEventListener('message', onMsg)
        try {
          const res = await fetch(getApiUrl('/meta/adaccounts'))
          
          if (!res.ok) {
            throw new Error(`Error al cargar cuentas de anuncios: ${res.status}`)
          }
          
          const json = await res.json()
          setAdAccounts(json?.data || [])
          
          // Reset form state
          setSelectedAdAccount('')
          setSelectedPixel('')
          // Set default date to 34 months ago
          const defaultDate = new Date()
          defaultDate.setMonth(defaultDate.getMonth() - 34)
          setSinceDate(defaultDate.toISOString().slice(0, 10))
          setSchedule('1h')
          setConfigError(null)
          
          setShowMetaModal(true)
        } catch (e) {
          console.error('Failed to load ad accounts', e)
          addToast('error', 'Error de conexión', 'No se pudieron cargar las cuentas de anuncios. Por favor intenta de nuevo.')
        }
      }
    }
    window.addEventListener('message', onMsg)
  }

  const handleAdAccountChange = async (id: string) => {
    setSelectedAdAccount(id)
    setSelectedPixel('')
    setConfigError(null)
    
    if (!id) {
      setPixels([])
      return
    }
    
    try {
      const res = await fetch(getApiUrl(`/meta/pixels?ad_account_id=${encodeURIComponent(id)}`))
      
      if (!res.ok) {
        throw new Error(`Error al cargar pixels: ${res.status}`)
      }
      
      const json = await res.json()
      setPixels(json?.data || [])
      
    } catch (e) {
      console.error('Failed to load pixels', e)
      setConfigError('Error al cargar los pixels. Por favor intenta seleccionar otra cuenta.')
      setPixels([])
    }
  }

  const handleSaveMetaConfig = async () => {
    const acct = adAccounts.find(a => (a.account_id === selectedAdAccount || a.id === selectedAdAccount))
    const pix = pixels.find(p => p.id === selectedPixel)
    
    if (!acct || !pix || !sinceDate || !schedule) {
      setConfigError('Por favor completa todos los campos requeridos')
      return
    }
    
    setIsConfiguring(true)
    setConfigError(null)
    
    try {
      const response = await fetch(getApiUrl('/meta/configure'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adAccountId: acct.account_id || acct.id,
          adAccountName: acct.name,
          pixelId: pix.id,
          pixelName: pix.name,
          sinceDate,
          schedule,
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: 'Error desconocido' } }))
        throw new Error(errorData.error?.message || `Error del servidor (${response.status})`)
      }
      
      const result = await response.json()
      
      setShowMetaModal(false)
      
      // Reset form
      setSelectedAdAccount('')
      setSelectedPixel('')
      setSinceDate('')
      setSchedule('1h')
      
      // Show success notification
      addToast('success', 'Configuración guardada', 'Meta Ads se ha configurado correctamente y la sincronización ha comenzado.')
      
    } catch (error) {
      console.error('Error configuring Meta:', error)
      setConfigError(error instanceof Error ? error.message : 'Error al configurar Meta Ads. Por favor intenta de nuevo.')
    } finally {
      setIsConfiguring(false)
    }
  }

  // Calcular totales
  const totals = useMemo(() => {
    return campaigns.reduce((acc, campaign) => ({
      spend: acc.spend + campaign.spend,
      clicks: acc.clicks + campaign.clicks,
      leads: acc.leads + campaign.leads,
      sales: acc.sales + campaign.sales,
      revenue: acc.revenue + campaign.revenue,
      appointments: acc.appointments + campaign.appointments
    }), { spend: 0, clicks: 0, leads: 0, sales: 0, revenue: 0, appointments: 0 })
  }, [campaigns])
  
  // Estado para datos del gráfico
  const [chartData, setChartData] = useState<any[]>([])
  const [chartLoading, setChartLoading] = useState(false)
  
  // Obtener datos históricos para el gráfico
  useEffect(() => {
    const fetchChartData = async () => {
      try {
        setChartLoading(true)
        const url = getApiUrl(`/campaigns/chart?start=${dateRange.start.toISOString()}&end=${dateRange.end.toISOString()}`)
        const response = await fetch(url)
        if (!response.ok) {
          throw new Error('Failed to fetch chart data')
        }
        const result = await response.json()
        const formattedData = (result.data || []).map((item: any) => {
          // Parse date correctly for display in chart
          const dateObj = new Date(item.date + 'T12:00:00')
          return {
            date: dateObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
            gastado: Math.round(item.spend || 0),
            retorno: Math.round(item.revenue || 0)
          }
        })
        setChartData(formattedData)
      } catch (error) {
        console.error('Error fetching chart data:', error)
        setChartData([])
      } finally {
        setChartLoading(false)
      }
    }
    fetchChartData()
  }, [dateRange])

  const avgMetrics = useMemo(() => ({
    cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
    cpl: totals.leads > 0 ? totals.spend / totals.leads : 0,
    cac: totals.sales > 0 ? totals.spend / totals.sales : 0,
    roas: totals.spend > 0 ? totals.revenue / totals.spend : 0,
    conversionRate: totals.clicks > 0 ? (totals.leads / totals.clicks) * 100 : 0,
    closeRate: totals.leads > 0 ? (totals.sales / totals.leads) * 100 : 0
  }), [totals])

  // Filtrar y ordenar campañas
  const filteredCampaigns = useMemo(() => {
    let filtered = campaigns.filter(campaign => {
      const matchesSearch = searchQuery === '' || 
        campaign.campaignName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        campaign.adSets.some(adSet => 
          adSet.adSetName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          adSet.ads.some(ad => ad.adName.toLowerCase().includes(searchQuery.toLowerCase()))
        )
      
      const matchesStatus = filterStatus === 'all' || campaign.status === filterStatus
      
      return matchesSearch && matchesStatus
    })

    // Aplicar ordenamiento si hay columna y dirección seleccionadas
    if (sortColumn && sortDirection) {
      filtered = [...filtered].sort((a, b) => {
        let aVal: any, bVal: any

        switch (sortColumn) {
          case 'name':
            aVal = a.campaignName.toLowerCase()
            bVal = b.campaignName.toLowerCase()
            break
          case 'status':
            aVal = a.status
            bVal = b.status
            break
          default:
            aVal = a[sortColumn as keyof CampaignMetrics]
            bVal = b[sortColumn as keyof CampaignMetrics]
        }

        if (aVal === null || aVal === undefined) return 1
        if (bVal === null || bVal === undefined) return -1

        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
        }

        if (typeof aVal === 'string' && typeof bVal === 'string') {
          if (sortDirection === 'asc') {
            return aVal < bVal ? -1 : aVal > bVal ? 1 : 0
          } else {
            return aVal > bVal ? -1 : aVal < bVal ? 1 : 0
          }
        }

        return 0
      })
    }

    return filtered
  }, [campaigns, searchQuery, filterStatus, sortColumn, sortDirection])

  const toggleRow = (rowId: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(rowId)) {
      newExpanded.delete(rowId)
    } else {
      newExpanded.add(rowId)
    }
    setExpandedRows(newExpanded)
  }

  const handleSort = (columnId: string, direction: 'asc' | 'desc' | null) => {
    setSortColumn(direction ? columnId : null)
    setSortDirection(direction)
  }

  // Configuración de columnas con persistencia
  const { columns, handleColumnReorder, handleColumnVisibilityChange } = useColumnsConfig(
    'campaigns_columns_config',
    [
      {
        id: 'name',
        label: 'Nombre',
        visible: true,
        fixed: true,
        align: 'left',
        render: (value: any) => (
          <span className="font-medium text-primary">{value}</span>
        )
      },
      {
        id: 'spend',
        label: 'Inversión',
        align: 'right' as const,
        visible: true,
        render: (value: any) => (
          <span>{formatCurrency(value)}</span>
        )
      },
      {
        id: 'reach',
        label: 'Alcance',
        align: 'right' as const,
        visible: false,
        render: (value: any) => (
          <span>{formatNumber(value)}</span>
        )
      },
      {
        id: 'clicks',
        label: 'Clicks',
        align: 'right' as const,
        visible: true,
        render: (value: any) => (
          <span>{formatNumber(value)}</span>
        )
      },
      {
        id: 'cpc',
        label: 'CPC',
        align: 'right' as const,
        visible: false,
        render: (value: any) => (
          <span>{formatCurrency(value)}</span>
        )
      },
      {
        id: 'visitors',
        label: 'Visitantes',
        align: 'right' as const,
        visible: false,
        render: (value: any) => (
          <span>{formatNumber(value)}</span>
        )
      },
      {
        id: 'cpv',
        label: 'CPV',
        align: 'right' as const,
        visible: false,
        render: (value: any) => (
          <span>{formatCurrency(value)}</span>
        )
      },
      {
        id: 'leads',
        label: 'Leads',
        align: 'right' as const,
        visible: true,
        render: (value: any, row: any) => (
          <span className="inline-flex items-center gap-1">
            {value > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  const level = row.id.startsWith('campaign:') ? 'campaign' : 
                               row.id.startsWith('adset:') ? 'adset' : 'ad'
                  const originalData = findOriginalData(row.id)
                  setDetailModal({
                    isOpen: true,
                    type: 'leads',
                    data: originalData || row,
                    level,
                    name: row.name,
                    rowId: row.id
                  })
                }}
                className="text-tertiary hover:text-primary transition-colors"
              >
                <Icons.search className="w-3 h-3" />
              </button>
            )}
            {formatNumber(value)}
          </span>
        )
      },
      {
        id: 'cpl',
        label: 'CPL',
        align: 'right' as const,
        visible: false,
        render: (value: any) => (
          <span>{formatCurrency(value)}</span>
        )
      },
      {
        id: 'appointments',
        label: 'Citas',
        align: 'right' as const,
        visible: false,
        render: (value: any, row: any) => (
          <span className="inline-flex items-center gap-1">
            {value > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  const level = row.id.startsWith('campaign:') ? 'campaign' : 
                               row.id.startsWith('adset:') ? 'adset' : 'ad'
                  const originalData = findOriginalData(row.id)
                  setDetailModal({
                    isOpen: true,
                    type: 'appointments',
                    data: originalData || row,
                    level,
                    name: row.name,
                    rowId: row.id
                  })
                }}
                className="text-tertiary hover:text-primary transition-colors"
              >
                <Icons.search className="w-3 h-3" />
              </button>
            )}
            {formatNumber(value)}
          </span>
        )
      },
      {
        id: 'sales',
        label: 'Ventas',
        align: 'right' as const,
        visible: true,
        render: (value: any, row: any) => (
          <span className="inline-flex items-center gap-1">
            {value > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  const level = row.id.startsWith('campaign:') ? 'campaign' : 
                               row.id.startsWith('adset:') ? 'adset' : 'ad'
                  const originalData = findOriginalData(row.id)
                  setDetailModal({
                    isOpen: true,
                    type: 'sales',
                    data: originalData || row,
                    level,
                    name: row.name,
                    rowId: row.id
                  })
                }}
                className="text-tertiary hover:text-primary transition-colors"
              >
                <Icons.search className="w-3 h-3" />
              </button>
            )}
            {formatNumber(value)}
          </span>
        )
      },
      {
        id: 'cac',
        label: 'CAC',
        align: 'right' as const,
        visible: false,
        render: (value: any) => (
          <span>{formatCurrency(value)}</span>
        )
      },
      {
        id: 'revenue',
        label: 'Ingresos',
        align: 'right' as const,
        visible: true,
        render: (value: any, row: any) => (
          <span className={cn(
            "font-medium",
            value > row.spend ? "text-success" : "text-error"
          )}>
            {formatCurrency(value)}
          </span>
        )
      },
      {
        id: 'roas',
        label: 'ROAS',
        align: 'right' as const,
        visible: true,
        render: (value: any) => (
          <span>{value.toFixed(2)}x</span>
        )
      }
    ]
  )

  // Convertir datos a estructura jerárquica para la tabla
  const hierarchicalData = useMemo(() => {
    return filteredCampaigns.map(campaign => ({
      data: {
        id: `campaign:${campaign.campaignId}`,
        name: campaign.campaignName,
        status: campaign.status,
        spend: campaign.spend,
        reach: campaign.reach,
        clicks: campaign.clicks,
        cpc: campaign.cpc,
        visitors: campaign.visitors,
        cpv: campaign.cpv,
        leads: campaign.leads,
        cpl: campaign.cpl,
        appointments: campaign.appointments,
        sales: campaign.sales,
        cac: campaign.cac,
        revenue: campaign.revenue,
        roas: campaign.roas
      },
      children: campaign.adSets.map(adSet => ({
        data: {
          id: `adset:${adSet.adSetId}`,
          name: adSet.adSetName,
          status: adSet.status,
          spend: adSet.spend,
          reach: adSet.reach,
          clicks: adSet.clicks,
          cpc: adSet.cpc,
          visitors: adSet.visitors,
          cpv: adSet.cpv,
          leads: adSet.leads,
          cpl: adSet.cpl,
          appointments: adSet.appointments,
          sales: adSet.sales,
          cac: adSet.cac,
          revenue: adSet.revenue,
          roas: adSet.roas
        },
        children: adSet.ads.map(ad => ({
          data: {
            id: `ad:${ad.adId}`,
            name: ad.adName,
            status: ad.status,
            spend: ad.spend,
            reach: ad.reach,
            clicks: ad.clicks,
            cpc: ad.cpc,
            visitors: ad.visitors,
            cpv: ad.cpv,
            leads: ad.leads,
            cpl: ad.cpl,
            appointments: ad.appointments,
            sales: ad.sales,
            cac: ad.cac,
            revenue: ad.revenue,
            roas: ad.roas
          }
        }))
      }))
    }))
  }, [filteredCampaigns])

  const getRowId = (row: any) => row.id
  
  // Helper function to find the original campaign data structure
  const findOriginalData = (rowId: string) => {
    const [type, id] = rowId.split(':')
    
    if (type === 'campaign') {
      return campaigns.find(c => c.campaignId === id)
    } else if (type === 'adset') {
      for (const campaign of campaigns) {
        const adSet = campaign.adSets.find(as => as.adSetId === id)
        if (adSet) return adSet
      }
    } else if (type === 'ad') {
      for (const campaign of campaigns) {
        for (const adSet of campaign.adSets) {
          const ad = adSet.ads.find(a => a.adId === id)
          if (ad) return ad
        }
      }
    }
    return null
  }

  // Helper to compute ad IDs for current modal context robustly
  const getAdIdsForDetailContext = () => {
    const ids = new Set<string>()
    const level = detailModal.level
    const data = detailModal.data

    // Try to use provided data structure first
    if (level === 'ad') {
      const adId = data?.adId
      if (adId) ids.add(adId)
    } else if (level === 'adset') {
      const ads = data?.ads
      if (Array.isArray(ads)) {
        for (const ad of ads) if (ad?.adId) ids.add(ad.adId)
      }
    } else if (level === 'campaign') {
      const adSets = data?.adSets
      if (Array.isArray(adSets)) {
        for (const set of adSets) {
          if (Array.isArray(set?.ads)) {
            for (const ad of set.ads) if (ad?.adId) ids.add(ad.adId)
          }
        }
      }
    }

    // If nothing collected yet, fallback by resolving from campaigns via rowId
    if (ids.size === 0 && detailModal.rowId) {
      const [type, rawId] = detailModal.rowId.split(':')
      if (type === 'ad') {
        ids.add(rawId)
      } else if (type === 'adset') {
        for (const c of campaigns) {
          const set = c.adSets?.find((as: any) => as.adSetId === rawId)
          if (set?.ads) for (const ad of set.ads) if (ad?.adId) ids.add(ad.adId)
        }
      } else if (type === 'campaign') {
        const camp = campaigns.find((c: any) => c.campaignId === rawId)
        if (camp?.adSets) {
          for (const set of camp.adSets) {
            if (Array.isArray(set?.ads)) {
              for (const ad of set.ads) if (ad?.adId) ids.add(ad.adId)
            }
          }
        }
      }
    }

    return ids
  }

  return (
    <PageContainer>
      <div className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-primary">Campañas</h1>
            <Button variant="secondary" size="sm" onClick={handleMetaSyncClick}>
              <Icons.meta className="w-4 h-4 mr-2" />
              Sincronizar Meta
            </Button>
          </div>
          <DateRangePicker />
          {syncRunning && (
            <div className="mt-2 p-3 rounded-lg glass text-secondary text-sm">
              <div className="flex items-center gap-2">
                <Icons.refresh className="w-4 h-4 text-primary animate-spin" />
                <span className="text-primary">Sincronizando anuncios desde Meta...</span>
                <span className="text-tertiary">Puedes seguir navegando.</span>
              </div>
            </div>
          )}
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <KPICard
            title="Ingresos"
            value={formatCurrency(totals.revenue)}
            change={22.4}
            trend="up"
            icon={Icons.trendingUp}
            iconColor="text-primary"
          />
          <KPICard
            title="Inversión Total"
            value={formatCurrency(totals.spend)}
            change={12.5}
            trend="up"
            icon={Icons.dollarSign}
            iconColor="text-primary"
          />
          <KPICard
            title="ROAS Promedio"
            value={`${avgMetrics.roas.toFixed(2)}x`}
            change={5.1}
            trend="up"
            icon={Icons.target}
            iconColor="text-primary"
          />
          <KPICard
            title="Ventas"
            value={formatNumber(totals.sales)}
            change={-3.2}
            trend="down"
            icon={Icons.shoppingCart}
            iconColor="text-primary"
          />
          <KPICard
            title="Leads"
            value={formatNumber(totals.leads)}
            change={15.7}
            trend="up"
            icon={Icons.users}
            iconColor="text-primary"
          />
          <KPICard
            title="Clicks"
            value={formatNumber(totals.clicks)}
            change={8.3}
            trend="up"
            icon={Icons.mousePointer}
            iconColor="text-primary"
          />
        </div>

        {/* Gráfico de Gastos vs Retorno */}
        <Card variant="glass" className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-primary">Gastos vs Retorno</h3>
              <p className="text-xs text-secondary mt-0.5">Evolución en el período seleccionado</p>
            </div>
            <button className="p-1.5 glass-hover rounded-lg transition-colors">
              <Icons.more className="w-4 h-4 text-tertiary" />
            </button>
          </div>

          <ChartContainer height={250}>
            {chartLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-pulse text-tertiary">Cargando datos...</div>
              </div>
            ) : chartData.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-tertiary">No hay datos disponibles para el período seleccionado</div>
              </div>
            ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <defs>
                  <linearGradient id="gradient-spend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={themeData.colors.status.error} stopOpacity={0.2} />
                    <stop offset="50%" stopColor={themeData.colors.status.error} stopOpacity={0.1} />
                    <stop offset="100%" stopColor={themeData.colors.status.error} stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gradient-revenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={themeData.colors.status.success} stopOpacity={0.2} />
                    <stop offset="50%" stopColor={themeData.colors.status.success} stopOpacity={0.1} />
                    <stop offset="100%" stopColor={themeData.colors.status.success} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={themeData.colors.chart.grid} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: themeData.colors.text.tertiary, fontSize: 12 }}
                  axisLine={{ stroke: themeData.colors.text.tertiary, opacity: 0.2 }}
                />
                <YAxis
                  tick={{ fill: themeData.colors.text.tertiary, fontSize: 12 }}
                  axisLine={{ stroke: themeData.colors.text.tertiary, opacity: 0.2 }}
                  tickFormatter={(value) => `${value / 1000}k`}
                  domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.1)]}
                />
                <SmartRechartsTooltip
                  content={({ active, payload, label }: any) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="glass rounded-lg p-3 shadow-xl">
                          <p className="text-xs text-tertiary mb-2">{label}</p>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: themeData.colors.status.error }} />
                              <span className="text-secondary">Gastado:</span>
                              <span className="text-primary font-medium">{formatCurrency(payload[0]?.value || 0)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: themeData.colors.status.success }} />
                              <span className="text-secondary">Retorno:</span>
                              <span className="text-primary font-medium">{formatCurrency(payload[1]?.value || 0)}</span>
                            </div>
                            {payload[1]?.value && payload[0]?.value && (
                              <div className="pt-1 mt-1 border-t border-primary">
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="text-secondary">ROAS:</span>
                                  <span className={cn(
                                    "font-medium",
                                    payload[1].value / payload[0].value >= 1 ? "text-success" : "text-error"
                                  )}>
                                    {(payload[1].value / payload[0].value).toFixed(2)}x
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    }
                    return null
                  }}
                  cursor={false}
                  prefer="tr"
                  offset={{ x: 0, y: 60 }}
                  portalToBody
                  allowEscapeViewBox={{ x: true, y: true }}
                />
                <Legend
                  verticalAlign="top"
                  height={36}
                  iconType="line"
                  formatter={(value: string) => (
                    <span className="text-xs text-secondary">
                      {value === 'gastado' ? 'Gastado' : 'Retorno'}
                    </span>
                  )}
                />
                <Area
                  type="monotone"
                  dataKey="gastado"
                  stroke={themeData.colors.status.error}
                  strokeWidth={2}
                  fill="url(#gradient-spend)"
                  dot={false}
                  activeDot={{ 
                    r: 5, 
                    fill: themeData.colors.status.error,
                    stroke: theme === 'dark' ? '#0a0b0d' : '#ffffff',
                    strokeWidth: 2
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="retorno"
                  stroke={themeData.colors.status.success}
                  strokeWidth={2}
                  fill="url(#gradient-revenue)"
                  dot={false}
                  activeDot={{ 
                    r: 5, 
                    fill: themeData.colors.status.success,
                    stroke: theme === 'dark' ? '#0a0b0d' : '#ffffff',
                    strokeWidth: 2
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
            )}
          </ChartContainer>
        </Card>

        {/* Tabla jerárquica con controles */}
        <TableWithHierarchy
          columns={columns}
          data={hierarchicalData}
          loading={loading || syncRunning}
          emptyMessage="No hay campañas disponibles"
          searchMessage="No se encontraron campañas"
          hasSearch={true}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          additionalControls={
            <div className="flex items-center gap-2">
              <Dropdown
                open={showFilters}
                onOpenChange={setShowFilters}
                align="end"
                trigger={
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "relative",
                      filterStatus !== 'all' && "text-info"
                    )}
                  >
                    <Icons.filter className="w-4 h-4" />
                    {filterStatus !== 'all' && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-accent-blue rounded-full" />
                    )}
                  </Button>
                }
              >
                <div className="p-4 space-y-4 w-64">
                  <div>
                    <label className="text-xs text-tertiary uppercase tracking-wider mb-2 block">Estado</label>
                    <div className="space-y-2">
                      {[
                        { value: 'all', label: 'Todas las campañas' },
                        { value: 'active', label: 'Solo activas' },
                        { value: 'paused', label: 'Solo pausadas' }
                      ].map(option => (
                        <label key={option.value} className="flex items-center gap-2 cursor-pointer glass-hover p-2 rounded-md transition-colors">
                          <input
                            type="radio"
                            name="status"
                            value={option.value}
                            checked={filterStatus === option.value}
                            onChange={(e) => setFilterStatus(e.target.value as any)}
                            className="w-4 h-4 text-primary bg-transparent border-primary focus-ring-accent"
                          />
                          <span className="text-sm text-secondary">{option.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="pt-2 border-t border-primary flex justify-between">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setFilterStatus('all')
                        setShowFilters(false)
                      }}
                    >
                      Limpiar
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setShowFilters(false)}
                    >
                      Aplicar
                    </Button>
                  </div>
                </div>
              </Dropdown>
            </div>
          }
          onSort={handleSort}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onColumnReorder={handleColumnReorder}
          onColumnVisibilityChange={handleColumnVisibilityChange}
          expandedRows={expandedRows}
          onToggleExpand={toggleRow}
          getRowId={getRowId}
          actions={
            <Button variant="ghost" size="sm">
              <Icons.download className="w-4 h-4 mr-2" />
              Exportar
            </Button>
          }
        />
      </div>
      {/* Meta configuration modal */}
      {showMetaModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowMetaModal(false)}>
          <div className="bg-secondary dark:glass rounded-xl border border-primary dark:border-glassBorder shadow-2xl w-full max-w-xl mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Icons.meta className="w-6 h-6" />
                  <h3 className="text-lg font-semibold text-primary">Configurar Meta Ads</h3>
                </div>
                <button onClick={() => setShowMetaModal(false)} className="text-secondary hover:text-primary"><Icons.x className="w-5 h-5" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-secondary">Cuenta de Anuncios</label>
                  <select className="w-full mt-1 glass text-primary rounded-lg p-2 border border-primary" value={selectedAdAccount} onChange={(e) => handleAdAccountChange(e.target.value)}>
                    <option value="">Selecciona una cuenta</option>
                    {adAccounts.map((a) => (
                      <option key={a.id} value={a.account_id || a.id}>{a.name} (act_{a.account_id || a.id})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-secondary">Pixel</label>
                  <select className="w-full mt-1 glass text-primary rounded-lg p-2 border border-primary" value={selectedPixel} onChange={(e) => setSelectedPixel(e.target.value)} disabled={!selectedAdAccount}>
                    <option value="">Selecciona un pixel</option>
                    {pixels.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-secondary">Desde (máx. 35 meses)</label>
                    <div className="mt-1">
                      <DatePicker
                        value={sinceDate}
                        onChange={setSinceDate}
                        minDate={minSinceDate}
                        maxDate={new Date().toISOString().slice(0,10)}
                        placeholder="Seleccionar fecha inicial"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-secondary">Frecuencia de sincronización</label>
                    <select className="w-full mt-1 glass text-primary rounded-lg p-2 border border-primary" value={schedule} onChange={(e) => setSchedule(e.target.value)}>
                      {['1h','3h','6h','12h','24h'].map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                {configError && (
                  <div className="p-3 glass rounded-lg">
                    <div className="flex items-center gap-2">
                      <Icons.alertCircle className="w-4 h-4 text-error flex-shrink-0" />
                      <p className="text-sm text-error">{configError}</p>
                    </div>
                  </div>
                )}
                
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="secondary" size="sm" onClick={() => setShowMetaModal(false)} disabled={isConfiguring}>Cancelar</Button>
                  <Button 
                    variant="primary" 
                    size="sm" 
                    onClick={handleSaveMetaConfig}
                    disabled={isConfiguring || !selectedAdAccount || !selectedPixel || !sinceDate || !schedule}
                  >
                    {isConfiguring ? (
                      <>
                        <Icons.refresh className="w-4 h-4 mr-2 text-onAccent animate-spin" />
                        Configurando...
                      </>
                    ) : (
                      <>
                        <Icons.check className="w-4 h-4 mr-2" />
                        Guardar y sincronizar
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Detail Modal */}
      <Modal
        isOpen={detailModal.isOpen}
        onClose={() => {
          setDetailModal(prev => ({ ...prev, isOpen: false }))
          setSelectedContact(null)
          setShowPayments(false)
        }}
        title={`Contactos - ${detailModal.type === 'leads' ? 'Leads' : detailModal.type === 'appointments' ? 'Citas' : 'Ventas'}`}
        size="xl"
      >
        <div className="-m-6">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-tertiary">
                  {detailModal.level === 'campaign' ? 'Campaña' : 
                   detailModal.level === 'adset' ? 'Conjunto de anuncios' : 'Anuncio'}
                </p>
                <p className="text-base font-medium text-primary">{detailModal.name}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-tertiary">Total</p>
                <p className="text-xl font-bold text-primary">
                  {detailModal.data && formatNumber(detailModal.data[detailModal.type || 'leads'])}
                </p>
              </div>
            </div>
          </div>
          
          {/* Two column layout */}
          <div className="flex h-[500px]">
            {(() => {
              // UN SOLO FILTRO para ambos lugares
              const adIds = getAdIdsForDetailContext()
              const filteredContacts = contacts.filter(contact => {
                // Primero validar que tenga attribution_ad_id
                if (!contact.attributionAdId) return false
                
                // Validar por pertenencia del ad_id al contexto seleccionado
                if (adIds.size === 0) return false
                if (!adIds.has(contact.attributionAdId)) return false
                
                // IMPORTANTE: Aplicar los mismos filtros que el backend para consistencia
                // El backend filtra por fecha de creación del contacto dentro del rango
                const contactCreatedDate = new Date(contact.createdAt)
                const isInDateRange = contactCreatedDate >= dateRange.start && contactCreatedDate <= dateRange.end
                
                // Solo mostrar contactos creados en el rango de fechas seleccionado
                if (!isInDateRange) return false
                
                // Validar según el tipo de modal - eventos independientes
                if (detailModal.type === 'leads') {
                  // Un contacto es lead si existe (todo contacto inicia como lead)
                  return true
                }
                if (detailModal.type === 'appointments') {
                  // Un contacto tiene cita si appointments > 0
                  return contact.appointments > 0
                }
                if (detailModal.type === 'sales') {
                  // Un contacto tiene venta si payments > 0 (solo cuenta completados)
                  return contact.payments > 0
                }
                
                return false
              })
              
              return (
                <>
                  {/* Left side - Contact list */}
                  <div className="w-2/5 border-r border-gray-200 dark:border-gray-800 overflow-y-auto">
                    <div className="p-3 border-b border-gray-200 dark:border-gray-800">
                      <p className="text-xs text-tertiary">
                        {filteredContacts.length} contactos
                      </p>
                    </div>
                    
                    <div className="divide-y divide-gray-200 dark:divide-gray-800">
                      {filteredContacts.length === 0 ? (
                        <div className="p-8 text-center">
                          <Icons.users className="w-10 h-10 text-tertiary mx-auto mb-2" />
                          <p className="text-xs text-tertiary">Sin contactos</p>
                        </div>
                      ) : (
                        filteredContacts.map((contact) => (
                    <div 
                      key={contact.id}
                      onClick={() => setSelectedContact(contact)}
                      className={cn(
                        "p-3 cursor-pointer hover:bg-primary/5 transition-colors",
                        selectedContact?.id === contact.id && "bg-primary/10"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gray-800 dark:bg-white flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-medium text-white dark:text-gray-900">
                            {contact.name?.charAt(0).toUpperCase() || 'C'}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-primary truncate">
                            {contact.name || 'Sin nombre'}
                          </p>
                          <p className="text-xs text-tertiary truncate">{contact.email}</p>
                        </div>
                        {detailModal.type === 'sales' && contact.ltv > 0 && (
                          <span className="text-xs font-medium text-success">
                            {formatCurrency(contact.ltv)}
                          </span>
                        )}
                      </div>
                    </div>
                        ))
                      )}
                    </div>
                  </div>
            
            {/* Right side - Contact details */}
            <div className="flex-1 overflow-y-auto">
              {selectedContact ? (
                <div className="p-6 space-y-4">
                  {/* Contact header */}
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-gray-800 dark:bg-white flex items-center justify-center">
                      <span className="text-lg font-medium text-white dark:text-gray-900">
                        {selectedContact.name?.charAt(0).toUpperCase() || 'C'}
                      </span>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-medium text-primary">
                        {selectedContact.name || 'Sin nombre'}
                      </h3>
                      <p className="text-sm text-secondary">{selectedContact.email}</p>
                    </div>
                  </div>
                  
                  {/* Contact info */}
                  <div className="space-y-3">
                    <div className="glass rounded-lg p-4 space-y-3">
                      <h4 className="text-xs text-tertiary uppercase tracking-wider">Información de contacto</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-tertiary">Teléfono</p>
                          <p className="text-sm text-primary">{selectedContact.phone || 'No registrado'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-tertiary">Empresa</p>
                          <p className="text-sm text-primary">{selectedContact.company || 'No especificada'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-tertiary">Fecha de registro</p>
                          <p className="text-sm text-primary">
                            {new Date(selectedContact.createdAt).toLocaleDateString('es-ES', { 
                              day: '2-digit', 
                              month: 'long',
                              year: 'numeric'
                            })}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-tertiary">Estado</p>
                          <Badge variant={
                            selectedContact.status === 'client' ? 'success' : 
                            selectedContact.status === 'appointment' ? 'info' : 'default'
                          }>
                            {selectedContact.status === 'client' ? 'Cliente' : 
                             selectedContact.status === 'appointment' ? 'Cita agendada' : 'Lead'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    
                    {/* Journey info */}
                    <div className="glass rounded-lg p-4 space-y-3">
                      <h4 className="text-xs text-tertiary uppercase tracking-wider">Viaje del cliente</h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-secondary">Fuente</span>
                          <span className="text-sm text-primary">{selectedContact.source || 'Meta Ads'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-secondary">Campaña atribuida</span>
                          <span className="text-sm text-primary">{detailModal.name}</span>
                        </div>
                        {selectedContact.attributionAdId && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-secondary">ID del anuncio</span>
                            <span className="text-sm text-primary font-mono text-xs">
                              {selectedContact.attributionAdId}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Metrics */}
                    {(selectedContact.appointments > 0 || selectedContact.payments > 0) && (
                      <div className="glass rounded-lg p-4 space-y-3">
                        <h4 className="text-xs text-tertiary uppercase tracking-wider">Métricas</h4>
                        <div className="grid grid-cols-2 gap-3">
                          {selectedContact.appointments > 0 && (
                            <div>
                              <p className="text-xs text-tertiary">Citas agendadas</p>
                              <p className="text-lg font-medium text-info">{selectedContact.appointments}</p>
                            </div>
                          )}
                          {selectedContact.payments > 0 && (
                            <>
                              <div>
                                <p className="text-xs text-tertiary">Total de compras</p>
                                <p className="text-lg font-medium text-success">{selectedContact.payments}</p>
                              </div>
                              <div>
                                <p className="text-xs text-tertiary">Valor de por vida (LTV)</p>
                                <p className="text-lg font-medium text-success">{formatCurrency(selectedContact.ltv)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-tertiary">Ticket promedio</p>
                                <p className="text-lg font-medium text-primary">
                                  {formatCurrency(selectedContact.ltv / selectedContact.payments)}
                                </p>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Payments history (collapsible) */}
                    {selectedContact.payments > 0 && (
                      <div className="glass rounded-lg overflow-hidden">
                        <button
                          onClick={() => setShowPayments(!showPayments)}
                          className="w-full p-4 flex items-center justify-between hover:bg-primary/5 transition-colors"
                        >
                          <h4 className="text-xs text-tertiary uppercase tracking-wider">
                            Historial de pagos ({selectedContact.payments})
                          </h4>
                          <Icons.chevronDown className={cn(
                            "w-4 h-4 text-tertiary transition-transform",
                            showPayments && "rotate-180"
                          )} />
                        </button>
                        {showPayments && (
                          <div className="border-t border-gray-200 dark:border-gray-800 p-4 space-y-2 max-h-48 overflow-y-auto">
                            {/* Simulación de pagos */}
                            {Array.from({ length: Math.min(selectedContact.payments, 5) }).map((_, idx) => (
                              <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-800 last:border-0">
                                <div>
                                  <p className="text-sm text-primary">Pago #{idx + 1}</p>
                                  <p className="text-xs text-tertiary">
                                    {new Date(Date.now() - idx * 7 * 24 * 60 * 60 * 1000).toLocaleDateString('es-ES')}
                                  </p>
                                </div>
                                <span className="text-sm font-medium text-success">
                                  {formatCurrency(selectedContact.ltv / selectedContact.payments)}
                                </span>
                              </div>
                            ))}
                            {selectedContact.payments > 5 && (
                              <p className="text-xs text-tertiary text-center pt-2">
                                +{selectedContact.payments - 5} pagos más
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <Icons.user className="w-12 h-12 text-tertiary mx-auto mb-3" />
                    <p className="text-sm text-tertiary">
                      Selecciona un contacto para ver sus detalles
                    </p>
                  </div>
                </div>
              )}
            </div>
                </>
              )
            })()}
          </div>
        </div>
      </Modal>
      
      {/* Toast notifications */}
      <ToastManager toasts={toasts} onRemove={removeToast} />
    </PageContainer>
  )
}
