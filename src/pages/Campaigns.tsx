import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { PageContainer, Card, TableWithHierarchy, Badge, Button, KPICard, DateRangePicker, TabList, Dropdown, DatePicker, ToastManager, Modal, ChartContainer, ContactDetailsModal } from '../ui'
import { useColumnsConfig } from '../hooks/useColumnsConfig'
import { Icons } from '../icons'
import { formatCurrency, formatNumber, cn } from '../lib/utils'
import { dateToApiString, formatDateShort, formatDateLong, subtractMonths, createDateInTimezone } from '../lib/dateUtils'
import { useDateRange } from '../contexts/DateContext'
import { useCampaigns } from '../hooks/useCampaigns'
import { getApiUrl, fetchWithAuth } from '../config/api'
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
  const { theme, themeData } = useTheme()

  // NUEVO: Usar ref para mantener las campañas
  const campaignsRef = useRef<any[]>([])

  // Actualizar ref cuando cambien las campañas
  useEffect(() => {
    if (campaigns && campaigns.length > 0) {
      campaignsRef.current = campaigns
    }
  }, [campaigns])
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'paused'>('all')
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null)
  const [syncRunning, setSyncRunning] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [campaignMetrics, setCampaignMetrics] = useState<any>(null)
  const [metricsLoading, setMetricsLoading] = useState(false)

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
  

  // Visitors modal state
  const [visitorsModal, setVisitorsModal] = useState<{
    isOpen: boolean
    data: any[]
    loading: boolean
    name: string
    adIds: string[]
    selectedVisitorId: string | null
    searchQuery: string
  }>({
    isOpen: false,
    data: [],
    loading: false,
    name: '',
    adIds: [],
    selectedVisitorId: null,
    searchQuery: ''
  })

  // Contacts details modal state
  const [contactsModal, setContactsModal] = useState<{
    isOpen: boolean
    data: any[]
    loading: boolean
    title: string
    subtitle: string
    type: 'leads' | 'appointments' | 'sales' | null
  }>({
    isOpen: false,
    data: [],
    loading: false,
    title: '',
    subtitle: '',
    type: null
  })


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
        const r = await fetchWithAuth(getApiUrl('/meta/sync/status'))
        const j = await r.json()
        setSyncRunning(Boolean(j?.data?.running))
      } catch {}
      timer = setTimeout(poll, 5000)
    }
    poll()
    return () => clearTimeout(timer)
  }, [])

  // Fetch campaign metrics with trends
  useEffect(() => {
    async function fetchCampaignMetrics() {
      try {
        setMetricsLoading(true)
        const startDate = dateToApiString(dateRange.start)
        const endDate = dateToApiString(dateRange.end)
        const response = await fetchWithAuth(
          getApiUrl(`/campaigns/metrics?start=${startDate}&end=${endDate}`)
        )
        if (response.ok) {
          const data = await response.json()
          setCampaignMetrics(data)
        }
      } catch (error) {
        console.error('Error fetching campaign metrics:', error)
      } finally {
        setMetricsLoading(false)
      }
    }
    fetchCampaignMetrics()
  }, [dateRange.start, dateRange.end])

  const minSinceDate = useMemo(() => {
    return dateToApiString(subtractMonths(createDateInTimezone(), 35))
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
          const res = await fetchWithAuth(getApiUrl('/meta/adaccounts'))
          
          if (!res.ok) {
            throw new Error(`Error al cargar cuentas de anuncios: ${res.status}`)
          }
          
          const json = await res.json()
          setAdAccounts(json?.data || [])
          
          // Reset form state
          setSelectedAdAccount('')
          setSelectedPixel('')
          // Set default date to 34 months ago
          setSinceDate(dateToApiString(subtractMonths(createDateInTimezone(), 34)))
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
      const res = await fetchWithAuth(getApiUrl(`/meta/pixels?ad_account_id=${encodeURIComponent(id)}`))
      
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
      const response = await fetchWithAuth(getApiUrl('/meta/configure'), {
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
        const url = getApiUrl(`/campaigns/chart?start=${dateToApiString(dateRange.start)}&end=${dateToApiString(dateRange.end)}`)
        const response = await fetchWithAuth(url)
        if (!response.ok) {
          throw new Error('Failed to fetch chart data')
        }
        const result = await response.json()
        const formattedData = (result.data || [])
          .filter((item: any) => item.spend > 0 || item.revenue > 0)
          .map((item: any) => {
            const dateObj = new Date(item.date)
            return {
              date: formatDateShort(dateObj),
              gastado: item.spend || 0,
              retorno: item.revenue || 0
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

  // Definir columnas SIN useMemo para que siempre usen el dateRange actual
  // IMPORTANTE: Esto se recrea en cada render para evitar closures viejos
  const columnDefinitions = [
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
      visible: true,
      render: (value: any, row: any) => (
        <span className="inline-flex items-center gap-1">
          {value > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                // Pass the current campaigns data directly
                handleShowVisitorsWithData(row, campaigns)
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
                handleShowContactDetails(row, 'leads', value)
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
                handleShowContactDetails(row, 'appointments', value)
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
                handleShowContactDetails(row, 'sales', value)
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
  ] // Sin useMemo para evitar closures viejos

  // Configuración de columnas con persistencia
  // useColumnsConfig SOLO maneja orden y visibilidad
  // Las columnas con sus funciones render vienen frescas cada render
  const { columns, handleColumnReorder, handleColumnVisibilityChange } = useColumnsConfig(
    'campaigns_columns_config',
    columnDefinitions // Estas columnas se recrean cada render para evitar closures viejos
  )

  const normalizeId = (value: unknown) => {
    if (value === null || value === undefined) return undefined
    const strValue = String(value).trim()
    return strValue.length === 0 ? undefined : strValue
  }

  // Helper functions para búsqueda en la jerarquía
  const findCampaignById = (campaignId: string) => {
    // Comparar tanto con el ID normalizado como sin normalizar
    const searchId = String(campaignId).trim()
    return campaigns.find(c =>
      String(c.campaignId).trim() === searchId ||
      normalizeId(c.campaignId) === normalizeId(campaignId)
    )
  }

  const findAdSetById = (adSetId: string) => {
    const searchId = String(adSetId).trim()
    for (const campaign of campaigns) {
      const adSet = campaign.adSets.find(as =>
        String(as.adSetId).trim() === searchId ||
        normalizeId(as.adSetId) === normalizeId(adSetId)
      )
      if (adSet) return { adSet, campaign }
    }
    return null
  }

  const findAdById = (adId: string) => {
    const searchId = String(adId).trim()
    for (const campaign of campaigns) {
      for (const adSet of campaign.adSets) {
        const ad = adSet.ads.find(a =>
          String(a.adId).trim() === searchId ||
          normalizeId(a.adId) === normalizeId(adId)
        )
        if (ad) return { ad, adSet, campaign }
      }
    }
    return null
  }

  // Función que obtiene ad_ids usando datos pasados como parámetro
  const getAdIdsByHierarchyFromData = (rowId: string, campaignsData: any[]): string[] => {
    const [type, id] = rowId.split(':')
    // Logs removidos para limpiar consola

    if (type === 'ad') {
      return [id]
    }

    if (type === 'adset') {
      // Buscar el adset en los datos
      for (const campaign of campaignsData) {
        if (!campaign.adSets) {
          continue
        }
        const adSet = campaign.adSets.find((as: any) =>
          String(as.adSetId).trim() === id
        )
        if (adSet) {
          const adIds = adSet.ads?.map((ad: any) => String(ad.adId).trim()) || []
          return adIds
        }
      }
    }

    if (type === 'campaign') {
      // Buscar la campaña en los datos
      const campaign = campaignsData.find(c =>
        String(c.campaignId).trim() === id
      )
      if (campaign) {
        const adIds = campaign.adSets?.flatMap((adSet: any) =>
          adSet.ads?.map((ad: any) => String(ad.adId).trim()) || []
        ) || []
        return adIds
      }
    }

    return []
  }

  // Nueva función simplificada para obtener ad_ids según jerarquía
  const getAdIdsByHierarchy = (rowId: string): string[] => {
    const [type, id] = rowId.split(':')
    const normalizedId = normalizeId(id)

    if (!normalizedId) {
      return []
    }

    if (type === 'ad') {
      // Para un anuncio específico, solo devolver su ID
      return [normalizedId]
    }

    if (type === 'adset') {
      // Para un AdSet, obtener todos los ad_ids de sus anuncios
      const result = findAdSetById(id) // Usar id sin normalizar para la búsqueda
      if (result?.adSet) {
        const adIds = result.adSet.ads
          .map(ad => normalizeId(ad.adId))
          .filter((id): id is string => id !== undefined)
        return adIds
      }
    }

    if (type === 'campaign') {
      // Para una campaña, obtener TODOS los ad_ids de TODOS sus adsets
      const campaign = findCampaignById(id) // Usar id sin normalizar para la búsqueda
      if (campaign) {
        const adIds = campaign.adSets.flatMap(adSet =>
          adSet.ads.map(ad => normalizeId(ad.adId))
        ).filter((id): id is string => id !== undefined)
        return adIds
      }
    }
    return []
  }

  // Convertir datos a estructura jerárquica para la tabla
  const hierarchicalData = useMemo(() => {
    return filteredCampaigns.map(campaign => {
      const campaignId = normalizeId(campaign.campaignId) ?? ''

      return {
        data: {
          id: `campaign:${campaignId}`,
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
        children: campaign.adSets.map(adSet => {
          const adSetId = normalizeId(adSet.adSetId) ?? ''

          return {
            data: {
              id: `adset:${adSetId}`,
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
            children: adSet.ads.map(ad => {
              const adId = normalizeId(ad.adId) ?? ''

              return {
                data: {
                  id: `ad:${adId}`,
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
              }
            })
          }
        })
      }
    })
  }, [filteredCampaigns])

  const getRowId = (row: any) => row.id


  // Handler para mostrar visitantes (solo de Meta Ads)
  const handleShowVisitorsWithData = async (row: any, campaignsData: any[]) => {
    // USAR REF para obtener las campañas guardadas
    let campaignsDataToUse = campaignsRef.current

    // Fallback a filteredCampaigns si ref está vacío
    if (!campaignsDataToUse || campaignsDataToUse.length === 0) {
      campaignsDataToUse = filteredCampaigns
    }

    // Si aún no hay datos, intentar con campaigns del state
    if (!campaignsDataToUse || campaignsDataToUse.length === 0) {
      campaignsDataToUse = campaigns
    }

    // Buscar los ad_ids usando los datos
    const adIds = getAdIdsByHierarchyFromData(row.id, campaignsDataToUse)
    const name = row.name

    if (adIds.length === 0) {
      addToast('warning', 'Sin anuncios', 'No se encontraron anuncios en este nivel.')
      return
    }

    // Extraer información del row
    const [levelType, id] = row.id.split(':')

    // Abrir modal y cargar visitantes
    setVisitorsModal({
      isOpen: true,
      data: [],
      loading: true,
      name,
      adIds,
      selectedVisitorId: null,
      searchQuery: ''
    })

    try {
      // Usar el nuevo endpoint de visitantes por jerarquía
      const params = new URLSearchParams({
        start: dateToApiString(dateRange.start),
        end: dateToApiString(dateRange.end)
      })

      // Agregar todos los ad_ids
      adIds.forEach(id => params.append('adIds', id))

      // Agregar información de jerarquía si es necesario
      if (levelType === 'campaign') {
        params.append('campaignId', id)
      } else if (levelType === 'adset') {
        params.append('adSetId', id)
      }

      const url = getApiUrl(`/campaigns/visitors?${params.toString()}`)
      const response = await fetchWithAuth(url)

      if (!response.ok) {
        throw new Error('Failed to fetch visitors')
      }

      const result = await response.json()
      const visitorsData = Array.isArray(result?.data) ? result.data : []

      // Seleccionar automáticamente el primer visitante si hay datos
      const firstVisitorId = visitorsData.length > 0 ? visitorsData[0].visitorId : null

      setVisitorsModal(prev => ({
        ...prev,
        data: visitorsData,
        loading: false,
        selectedVisitorId: firstVisitorId
      }))
    } catch (error) {
      console.error('Error fetching visitors:', error)
      setVisitorsModal(prev => ({
        ...prev,
        loading: false
      }))
      addToast('error', 'Error al cargar visitantes', 'No se pudieron cargar los datos de los visitantes')
    }
  }

  // Handler para mostrar detalles de contactos (leads, appointments, sales)
  const handleShowContactDetails = async (row: any, type: 'leads' | 'appointments' | 'sales', expectedCount: number) => {
    // Usar REF para obtener las campañas
    let campaignsDataToUse = campaignsRef.current

    // Fallback a filteredCampaigns si ref está vacío
    if (!campaignsDataToUse || campaignsDataToUse.length === 0) {
      campaignsDataToUse = filteredCampaigns
    }

    // Si aún no hay datos, intentar con campaigns del state
    if (!campaignsDataToUse || campaignsDataToUse.length === 0) {
      campaignsDataToUse = campaigns
    }

    // Buscar los ad_ids usando los datos
    const adIds = getAdIdsByHierarchyFromData(row.id, campaignsDataToUse)
    const name = row.name

    if (adIds.length === 0) {
      addToast('warning', 'Sin anuncios', 'No se encontraron anuncios en este nivel.')
      return
    }

    // Extraer información del nivel (campaign, adset, ad)
    const [levelType, levelId] = row.id.split(':')

    // Abrir modal con loading state
    setContactsModal({
      isOpen: true,
      data: [],
      loading: true,
      title: `${type === 'leads' ? 'Leads' : type === 'appointments' ? 'Citas' : 'Ventas'}`,
      subtitle: name,
      type
    })

    try {
      // Usar dateToApiString para mantener consistencia con Reports
      const startStr = dateToApiString(dateRange.start);
      const endStr = dateToApiString(dateRange.end);

      const params = new URLSearchParams({
        start: startStr,
        end: endStr,
        type
      })

      // Agregar todos los ad_ids
      adIds.forEach(id => params.append('adIds', id))

      // Agregar información del nivel para filtrado correcto
      if (levelType === 'campaign') {
        params.append('campaignId', levelId)
      } else if (levelType === 'adset') {
        params.append('adSetId', levelId)
      }

      const url = getApiUrl(`/campaigns/contact-details?${params.toString()}`)
      const response = await fetchWithAuth(url)

      if (!response.ok) {
        throw new Error('Failed to fetch contacts')
      }

      const result = await response.json()
      const contactsData = Array.isArray(result?.data) ? result.data : []

      // Mapear los datos al formato del modal
      const formattedContacts = contactsData.map((contact: any) => ({
        id: contact.contact_id || contact.id,
        name: contact.name || contact.contact_name,
        email: contact.email,
        phone: contact.phone,
        createdAt: contact.event_date || contact.created_at || contact.createdAt,
        status: contact.status,
        // Para ventas, usar ltv como valor total del cliente
        value: type === 'sales' ? (contact.ltv || contact.value || 0) : (contact.value || contact.revenue),
        type: type,
        ltv: contact.ltv || 0, // Agregar LTV directamente
        appointments: contact.appointments || 0,
        payments: contact.payments || 0,
        metadata: {
          source: contact.source,
          campaign: contact.campaign_name,
          adSet: contact.adset_name,
          ad: contact.ad_name,
          eventDate: contact.event_date
        }
      }))


      // Actualizar modal con los datos
      setContactsModal({
        isOpen: true,
        data: formattedContacts,
        loading: false,
        title: `${type === 'leads' ? 'Leads' : type === 'appointments' ? 'Citas' : 'Ventas'}`,
        subtitle: `${name} (${formattedContacts.length} contactos)`,
        type
      })
    } catch (error) {
      console.error('Error al cargar contactos:', error)
      setContactsModal(prev => ({
        ...prev,
        loading: false
      }))
      addToast('error', 'Error al cargar contactos', 'No se pudieron cargar los detalles de contactos')
    }
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <KPICard
            title="Ingresos"
            value={formatCurrency(campaignMetrics?.revenue ?? totals.revenue)}
            change={campaignMetrics?.trends?.revenue || 0}
            trend={
              campaignMetrics?.trends?.revenue > 0 ? 'up' :
              campaignMetrics?.trends?.revenue < 0 ? 'down' : 'up'
            }
            icon={Icons.trendingUp}
            iconColor="text-primary"
            className={metricsLoading ? 'animate-pulse' : ''}
          />
          <KPICard
            title="Inversión Total"
            value={formatCurrency(campaignMetrics?.spend ?? totals.spend)}
            change={campaignMetrics?.trends?.spend || 0}
            trend={
              campaignMetrics?.trends?.spend < 0 ? 'up' :
              campaignMetrics?.trends?.spend > 0 ? 'down' : 'up'
            }
            icon={Icons.dollarSign}
            iconColor="text-primary"
            className={metricsLoading ? 'animate-pulse' : ''}
          />
          <KPICard
            title="ROAS Promedio"
            value={`${((campaignMetrics?.roas ?? avgMetrics.roas)).toFixed(2)}x`}
            change={campaignMetrics?.trends?.roas || 0}
            trend={
              campaignMetrics?.trends?.roas > 0 ? 'up' :
              campaignMetrics?.trends?.roas < 0 ? 'down' : 'up'
            }
            icon={Icons.target}
            iconColor="text-primary"
            className={metricsLoading ? 'animate-pulse' : ''}
          />
          <KPICard
            title="Ventas"
            value={formatNumber(campaignMetrics?.sales ?? totals.sales)}
            change={campaignMetrics?.trends?.sales || 0}
            trend={
              campaignMetrics?.trends?.sales > 0 ? 'up' :
              campaignMetrics?.trends?.sales < 0 ? 'down' : 'down'
            }
            icon={Icons.shoppingCart}
            iconColor="text-primary"
            className={metricsLoading ? 'animate-pulse' : ''}
          />
          <KPICard
            title="Leads"
            value={formatNumber(campaignMetrics?.leads ?? totals.leads)}
            change={campaignMetrics?.trends?.leads || 0}
            trend={
              campaignMetrics?.trends?.leads > 0 ? 'up' :
              campaignMetrics?.trends?.leads < 0 ? 'down' : 'up'
            }
            icon={Icons.users}
            iconColor="text-primary"
            className={metricsLoading ? 'animate-pulse' : ''}
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
                  tickFormatter={(value, index) => {
                    // Ocultar el primer valor del eje Y para evitar solapamiento con eje X
                    if (index === 0) return ''
                    if (value >= 1000000) return `$${Math.round(value / 1000000)}M`
                    if (value >= 1000) return `$${Math.round(value / 1000)}k`
                    return `$${Math.round(value)}`
                  }}
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
                      <option key={a.id} value={a.account_id || a.id}>{a.name} ({a.account_id || a.id})</option>
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
                        maxDate={dateToApiString(createDateInTimezone())}
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
      

      {/* Visitors Modal - Rediseñado como ContactDetailsModal */}
      <Modal
        isOpen={visitorsModal.isOpen}
        onClose={() => setVisitorsModal(prev => ({ ...prev, isOpen: false }))}
        title=""
        size="xl"
        showCloseButton={false}
      >
        <div className="-m-6 h-[600px] flex flex-col">
          {/* Header simple sin efectos */}
          <div className="px-6 py-4 border-b border-primary">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-primary">Visitantes Web</h3>
                <p className="text-sm text-secondary mt-1">{visitorsModal.name}</p>
              </div>
              <button
                onClick={() => setVisitorsModal(prev => ({ ...prev, isOpen: false }))}
                className="w-8 h-8 rounded-lg glass flex items-center justify-center"
              >
                <Icons.x className="w-4 h-4 text-tertiary" />
              </button>
            </div>

            {/* Stats simples */}
            <div className="flex items-center gap-4 mt-3">
              <span className="text-sm text-secondary">
                {visitorsModal.data.length} visitantes únicos
              </span>
              <span className="text-sm font-medium text-info">
                {visitorsModal.data.filter(v => v.hasContact).length} identificados
              </span>
              <span className="text-sm font-medium text-success">
                {visitorsModal.data.filter(v => v.contact?.ltv > 0).length} compraron
              </span>
            </div>
          </div>

          {/* Contenido principal con mejor distribución */}
          <div className="flex flex-1 overflow-hidden">
            {/* Panel izquierdo - Lista de visitantes */}
            <div className="flex flex-col w-[380px] border-r border-primary">
              {/* Barra de búsqueda */}
              <div className="p-4 border-b border-primary">
                <div className="relative">
                  <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tertiary" />
                  <input
                    type="text"
                    placeholder="Buscar visitante..."
                    value={visitorsModal.searchQuery}
                    onChange={(e) => setVisitorsModal(prev => ({ ...prev, searchQuery: e.target.value }))}
                    className="w-full pl-10 pr-3 py-2 glass border border-primary rounded-lg text-sm text-primary placeholder-tertiary focus:outline-none focus-ring"
                  />
                  {visitorsModal.searchQuery && (
                    <button
                      onClick={() => setVisitorsModal(prev => ({ ...prev, searchQuery: '' }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                    >
                      <Icons.x className="w-4 h-4 text-tertiary" />
                    </button>
                  )}
                </div>
              </div>

              {/* Lista de visitantes filtrada */}
              <div className="flex-1 overflow-y-auto scrollbar-thin">
                {visitorsModal.loading ? (
                  <div className="flex flex-col items-center justify-center h-full p-8">
                    <div className="w-12 h-12 flex items-center justify-center mb-3">
                      <Icons.refresh className="w-6 h-6 text-primary animate-spin" />
                    </div>
                    <p className="text-sm text-secondary">Cargando visitantes...</p>
                  </div>
                ) : visitorsModal.data.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full p-8">
                    <div className="w-12 h-12 flex items-center justify-center mb-3">
                      <Icons.users className="w-6 h-6 text-tertiary" />
                    </div>
                    <p className="text-sm text-secondary">No hay visitantes registrados</p>
                    <p className="text-xs text-tertiary mt-1">Los visitantes aparecerán cuando lleguen desde los anuncios</p>
                  </div>
                ) : (
                  <div>
                    {(() => {
                      // Filtrar visitantes según búsqueda
                      const query = visitorsModal.searchQuery.toLowerCase()
                      const filteredVisitors = query ?
                        visitorsModal.data.filter(v =>
                          v.visitorId?.toLowerCase().includes(query) ||
                          v.contact?.name?.toLowerCase().includes(query) ||
                          v.contact?.email?.toLowerCase().includes(query) ||
                          v.contact?.phone?.toLowerCase().includes(query)
                        ) : visitorsModal.data

                      if (filteredVisitors.length === 0 && query) {
                        return (
                          <div className="flex flex-col items-center justify-center h-full p-8">
                            <Icons.search className="w-8 h-8 text-tertiary mb-2" />
                            <p className="text-sm text-secondary">No se encontraron visitantes</p>
                            <button
                              onClick={() => setVisitorsModal(prev => ({ ...prev, searchQuery: '' }))}
                              className="mt-3 text-xs text-primary hover:underline"
                            >
                              Limpiar búsqueda
                            </button>
                          </div>
                        )
                      }

                      return filteredVisitors.map((visitor) => (
                        <div
                          key={visitor.visitorId}
                          onClick={() => setVisitorsModal(prev => ({
                            ...prev,
                            selectedVisitorId: visitor.visitorId
                          }))}
                          className={cn(
                            "p-3 cursor-pointer border-b border-primary hover:bg-primary/5",
                            visitorsModal.selectedVisitorId === visitor.visitorId && "bg-primary/10"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            {/* Avatar */}
                            <div className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center",
                              visitor.hasContact ? "glass" : "border border-primary"
                            )}>
                              <Icons.user className={cn(
                                "w-4 h-4",
                                visitor.hasContact ? "text-info" : "text-tertiary"
                              )} />
                            </div>

                            {/* Info del visitante */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-primary truncate">
                                {visitor.contact?.name || `Visitante ${visitor.visitorId.substring(0, 8)}`}
                              </p>
                              <p className="text-xs text-secondary truncate">
                                {visitor.hasContact && visitor.contact?.name ?
                                  `ID: ${visitor.visitorId.substring(0, 8)}...` :
                                  'Visitante anónimo'}
                              </p>
                            </div>

                            {/* Indicadores */}
                            <div className="flex flex-col items-end gap-1">
                              {visitor.contact?.ltv > 0 && (
                                <span className="text-xs font-semibold text-success">
                                  {formatCurrency(visitor.contact.ltv)}
                                </span>
                              )}
                              {visitor.hasContact && (
                                <Badge variant="info" size="sm">
                                  Identificado
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    })()}
                  </div>
                )}
              </div>

              {/* Footer simple */}
              {visitorsModal.data.length > 0 && (
                <div className="p-3 border-t border-primary">
                  <span className="text-xs text-tertiary">
                    {(() => {
                      const query = visitorsModal.searchQuery.toLowerCase()
                      const filtered = query ?
                        visitorsModal.data.filter(v =>
                          v.visitorId?.toLowerCase().includes(query) ||
                          v.contact?.name?.toLowerCase().includes(query) ||
                          v.contact?.email?.toLowerCase().includes(query) ||
                          v.contact?.phone?.toLowerCase().includes(query)
                        ) : visitorsModal.data

                      if (query && filtered.length !== visitorsModal.data.length) {
                        return `Mostrando ${filtered.length} de ${visitorsModal.data.length} visitantes`
                      }
                      return `Total: ${visitorsModal.data.length} visitantes`
                    })()}
                  </span>
                </div>
              )}
            </div>

            {/* Panel derecho - Detalles del visitante seleccionado */}
            <div className="flex flex-col flex-1 bg-secondary">
              {visitorsModal.data.length > 0 && visitorsModal.selectedVisitorId && (
                <>
                  {/* Buscar el visitante seleccionado */}
                  {(() => {
                    const selectedVisitor = visitorsModal.data.find(
                      v => v.visitorId === visitorsModal.selectedVisitorId
                    ) || visitorsModal.data[0]

                    return (
                      <>
                        {/* Header del detalle */}
                        <div className="p-4 border-b border-primary">
                          <div className="flex items-start gap-3">
                            <div className={cn(
                              "w-10 h-10 rounded-full flex items-center justify-center",
                              selectedVisitor.hasContact ? "glass" : "border border-primary"
                            )}>
                              <Icons.user className={cn(
                                "w-5 h-5",
                                selectedVisitor.hasContact ? "text-info" : "text-tertiary"
                              )} />
                            </div>
                            <div className="flex-1">
                              <h4 className="text-lg font-semibold text-primary">
                                {selectedVisitor.contact?.name || 'Visitante anónimo'}
                              </h4>
                              <p className="text-sm text-secondary mt-0.5">
                                ID: {selectedVisitor.visitorId}
                              </p>
                              {selectedVisitor.hasContact && selectedVisitor.contact && (
                                <>
                                  {selectedVisitor.contact.email && (
                                    <p className="text-sm text-secondary">
                                      {selectedVisitor.contact.email}
                                    </p>
                                  )}
                                  {selectedVisitor.contact.phone && (
                                    <p className="text-sm text-secondary">
                                      {selectedVisitor.contact.phone}
                                    </p>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Contenido del detalle */}
                        <div className="flex-1 overflow-y-auto p-4">
                          <div className="space-y-4">
                            {/* Información de la sesión */}
                            <div>
                              <h5 className="text-xs font-medium text-tertiary uppercase tracking-wider mb-3">
                                Información de Sesión
                              </h5>
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <Icons.calendar className="w-4 h-4 text-tertiary" />
                                  <span className="text-sm text-secondary">
                                    Primera visita: {formatDateLong(selectedVisitor.firstVisit)}
                                  </span>
                                </div>
                                {selectedVisitor.lastVisit && (
                                  <div className="flex items-center gap-2">
                                    <Icons.clock className="w-4 h-4 text-tertiary" />
                                    <span className="text-sm text-secondary">
                                      Última visita: {formatDateShort(selectedVisitor.lastVisit)}
                                    </span>
                                  </div>
                                )}
                                {selectedVisitor.sources && (
                                  <div className="flex items-center gap-2">
                                    <Icons.target className="w-4 h-4 text-tertiary" />
                                    <span className="text-sm text-secondary">
                                      Fuente: {selectedVisitor.sources}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Dispositivo y ubicación */}
                            <div>
                              <h5 className="text-xs font-medium text-tertiary uppercase tracking-wider mb-3">
                                Dispositivo y Ubicación
                              </h5>
                              <div className="grid grid-cols-2 gap-3">
                                {selectedVisitor.location && (
                                  <div className="glass rounded-lg p-3">
                                    <p className="text-xs text-tertiary mb-1">Ubicación</p>
                                    <p className="text-sm font-medium text-primary">
                                      {selectedVisitor.location.city && `${selectedVisitor.location.city}, `}
                                      {selectedVisitor.location.country}
                                    </p>
                                  </div>
                                )}
                                {selectedVisitor.device && (
                                  <div className="glass rounded-lg p-3">
                                    <p className="text-xs text-tertiary mb-1">Dispositivo</p>
                                    <p className="text-sm font-medium text-primary capitalize">
                                      {selectedVisitor.device.type}
                                    </p>
                                    {selectedVisitor.device.browser && (
                                      <p className="text-xs text-secondary capitalize">
                                        {selectedVisitor.device.browser}
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Métricas de actividad */}
                            <div>
                              <h5 className="text-xs font-medium text-tertiary uppercase tracking-wider mb-3">
                                Actividad
                              </h5>
                              <div className="grid grid-cols-3 gap-3">
                                <div className="glass rounded-lg p-3">
                                  <p className="text-xs text-tertiary mb-1">Sesiones</p>
                                  <p className="text-lg font-semibold text-primary">
                                    {selectedVisitor.sessionCount || 1}
                                  </p>
                                </div>
                                <div className="glass rounded-lg p-3">
                                  <p className="text-xs text-tertiary mb-1">Páginas vistas</p>
                                  <p className="text-lg font-semibold text-primary">
                                    {selectedVisitor.totalPageviews || 1}
                                  </p>
                                </div>
                                <div className="glass rounded-lg p-3">
                                  <p className="text-xs text-tertiary mb-1">Tiempo total</p>
                                  <p className="text-lg font-semibold text-primary">
                                    {selectedVisitor.totalTime || '0m'}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Información del contacto si está identificado */}
                            {selectedVisitor.hasContact && selectedVisitor.contact && (
                              <div>
                                <h5 className="text-xs font-medium text-tertiary uppercase tracking-wider mb-3">
                                  Información del Contacto
                                </h5>
                                <div className="glass rounded-lg p-4">
                                  <div className="space-y-2">
                                    {selectedVisitor.contact.email && (
                                      <div className="flex items-center gap-2">
                                        <Icons.send className="w-4 h-4 text-tertiary" />
                                        <span className="text-sm text-secondary">{selectedVisitor.contact.email}</span>
                                      </div>
                                    )}
                                    {selectedVisitor.contact.phone && (
                                      <div className="flex items-center gap-2">
                                        <Icons.phone className="w-4 h-4 text-tertiary" />
                                        <span className="text-sm text-secondary">{selectedVisitor.contact.phone}</span>
                                      </div>
                                    )}
                                    {selectedVisitor.contact.ltv > 0 && (
                                      <div className="flex items-center gap-2 pt-2 border-t border-primary">
                                        <Icons.dollarSign className="w-4 h-4 text-success" />
                                        <span className="text-sm text-secondary">Valor de vida:</span>
                                        <span className="text-sm font-medium text-success">
                                          {formatCurrency(selectedVisitor.contact.ltv)}
                                        </span>
                                      </div>
                                    )}
                                    {selectedVisitor.contact.appointments > 0 && (
                                      <div className="flex items-center gap-2">
                                        <Icons.calendar className="w-4 h-4 text-info" />
                                        <span className="text-sm text-secondary">
                                          {selectedVisitor.contact.appointments} citas agendadas
                                        </span>
                                      </div>
                                    )}
                                    {selectedVisitor.contact.payments > 0 && (
                                      <div className="flex items-center gap-2">
                                        <Icons.shoppingCart className="w-4 h-4 text-success" />
                                        <span className="text-sm text-secondary">
                                          {selectedVisitor.contact.payments} compras realizadas
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Páginas visitadas si hay datos */}
                            {selectedVisitor.pageviews && selectedVisitor.pageviews.length > 0 && (
                              <div>
                                <h5 className="text-xs font-medium text-tertiary uppercase tracking-wider mb-3">
                                  Páginas Visitadas
                                </h5>
                                <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
                                  {selectedVisitor.pageviews.map((page: any, idx: number) => (
                                    <div key={idx} className="p-2 rounded-lg glass-hover">
                                      <p className="text-xs text-tertiary">
                                        {formatDateShort(page.timestamp)}
                                      </p>
                                      <p className="text-sm text-primary">{page.url}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )
                  })()}
                </>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* Contacts Details Modal */}
      <ContactDetailsModal
        isOpen={contactsModal.isOpen}
        onClose={() => setContactsModal(prev => ({ ...prev, isOpen: false }))}
        data={contactsModal.data}
        loading={contactsModal.loading}
        title={contactsModal.title}
        subtitle={contactsModal.subtitle}
        type={contactsModal.type}
      />

      {/* Toast notifications */}
      <ToastManager toasts={toasts} onRemove={removeToast} />
    </PageContainer>
  )
}
