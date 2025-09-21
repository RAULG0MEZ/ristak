import React, { useState, useEffect, useMemo } from 'react'
import { PageContainer, TableWithControls, Badge, Button, KPICard, TabList, Modal } from '../ui'
import { SkeletonLoader } from '../ui/SkeletonLoader'
import { useColumnsConfig } from '../hooks/useColumnsConfig'
import { Icons } from '../icons'
import { formatCurrency, formatNumber, formatDate, cn } from '../lib/utils'
import { dateToApiString, formatDateLong, formatDateShort, subtractDays, subtractMonths, getCurrentYear, startOfYear, getLastDayOfMonth, formatYear, formatMonthYear, createDateInTimezone } from '../lib/dateUtils'
import { MetricsTables } from '../modules/reports/MetricsTables'
import { DateRangeSelector } from '../modules/reports/DateRangeSelector'
import { ReportsModals } from '../modules/reports/ReportsModals'
import { getApiUrl, fetchWithAuth } from '../config/api'


interface MetricsData {
  date: string
  spend: number
  reach: number
  clicks: number
  cpc: number | null
  visitors: number
  cpv: number | null
  visitorToLeadRate: number | null
  leads: number
  cpl: number | null
  appointmentsPerLead: number | null
  appointments: number
  costPerAppointment: number | null
  salesPerAppointment: number | null
  sales: number
  cac: number | null
  revenue: number
  new_customers?: number // Campo opcional para nuevos clientes
}

type ViewType = 'day' | 'month' | 'year'
type ReportType = 'cashflow' | 'campaigns'
type DisplayMode = 'table' | 'cards'

// Map ViewType to backend groupBy
const groupByForView = (viewType: ViewType) => (
  viewType === 'day' ? 'day' : viewType === 'month' ? 'month' : 'year'
)

export function Reports() {
  const [metrics, setMetrics] = useState<MetricsData[]>([])
  const [loading, setLoading] = useState(false)
  const [syncRunning, setSyncRunning] = useState(false)
  const [viewType, setViewType] = useState<ViewType>('month')
  const [reportType, setReportType] = useState<ReportType>('cashflow')
  const [displayMode, setDisplayMode] = useState<DisplayMode>('table')
  const [selectedPeriod, setSelectedPeriod] = useState<{ start: string, end: string } | null>(null)
  const [modalType, setModalType] = useState<'sales' | 'leads' | 'appointments' | 'new_customers' | null>(null)
  const [dateRange, setDateRange] = useState({
    start: subtractDays(createDateInTimezone(), 30),
    end: createDateInTimezone()
  })
  const [monthRange, setMonthRange] = useState<'last12' | 'thisYear' | 'custom'>('last12')
  const [customMonthYear, setCustomMonthYear] = useState(getCurrentYear())
  const [customMonthStart, setCustomMonthStart] = useState(0)
  const [customMonthEnd, setCustomMonthEnd] = useState(11)
  const [yearRange, setYearRange] = useState({
    start: getCurrentYear() - 2,
    end: getCurrentYear()
  })
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [summaryMetrics, setSummaryMetrics] = useState<any>(null)
  const [metricsLoading, setMetricsLoading] = useState(false)

  useEffect(() => {
    fetchMetrics()
  }, [viewType, reportType, monthRange, yearRange, dateRange, customMonthYear, customMonthStart, customMonthEnd])

  // Helper para obtener el rango de fechas según la vista
  const getDateRangeForAPI = () => {
    let startDate: Date
    let endDate: Date

    if (viewType === 'day') {
      startDate = dateRange.start
      endDate = dateRange.end
    } else if (viewType === 'month') {
      endDate = createDateInTimezone()

      if (monthRange === 'last12') {
        startDate = subtractMonths(createDateInTimezone(), 12)
        startDate.setDate(1)
      } else if (monthRange === 'thisYear') {
        startDate = startOfYear()
      } else {
        startDate = createDateInTimezone(customMonthYear, customMonthStart, 1, 0, 0)
        endDate = createDateInTimezone(customMonthYear, customMonthEnd + 1, 0, 23, 59)
      }
    } else {
      startDate = createDateInTimezone(yearRange.start, 0, 1, 0, 0)
      endDate = createDateInTimezone(yearRange.end, 11, 31, 23, 59)
    }

    return {
      start: dateToApiString(startDate),
      end: dateToApiString(endDate)
    }
  }

  // Fetch summary metrics with trends
  useEffect(() => {
    async function fetchSummaryMetrics() {
      try {
        setMetricsLoading(true)
        const { start, end } = getDateRangeForAPI()
        const response = await fetchWithAuth(
          getApiUrl(`/reports/summary-metrics?start=${start}&end=${end}`)
        )
        if (response.ok) {
          const data = await response.json()
          setSummaryMetrics(data)
        }
      } catch (error) {
        console.error('Error fetching summary metrics:', error)
      } finally {
        setMetricsLoading(false)
      }
    }
    fetchSummaryMetrics()
  }, [viewType, monthRange, yearRange, dateRange, customMonthYear, customMonthStart, customMonthEnd])

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

  const fetchMetrics = async () => {
    setLoading(true)
    try {
      // Calcular fechas según el tipo de vista y selección
      let startDate: Date
      let endDate: Date
      
      if (viewType === 'day') {
        // Para vista de día, usar el rango de fecha seleccionado
        startDate = dateRange.start
        endDate = dateRange.end
      } else if (viewType === 'month') {
        endDate = createDateInTimezone() // Hoy
        
        if (monthRange === 'last12') {
          // Últimos 12 meses completos
          startDate = subtractMonths(createDateInTimezone(), 12)
          startDate.setDate(1) // Primer día del mes
        } else if (monthRange === 'thisYear') {
          // Todo el año actual
          startDate = startOfYear() // 1 de enero
        } else {
          // Rango personalizado de meses
          startDate = createDateInTimezone(customMonthYear, customMonthStart, 1, 0, 0)
          endDate = createDateInTimezone(customMonthYear, customMonthEnd + 1, 0, 23, 59) // Último día del mes final
        }
      } else {
        // Vista de año
        startDate = createDateInTimezone(yearRange.start, 0, 1, 0, 0) // 1 de enero del año inicial
        endDate = createDateInTimezone(yearRange.end, 11, 31, 23, 59) // 31 de diciembre del año final
      }
      
      const params = new URLSearchParams({
        start: dateToApiString(startDate),
        end: dateToApiString(endDate),
        groupBy: groupByForView(viewType)
      })
      
      // Agregar type=attributed cuando se selecciona la pestaña Atribuidos (campaigns)
      if (reportType === 'campaigns') {
        params.append('type', 'attributed')
      }
      
      
      const res = await fetchWithAuth(getApiUrl(`/reports/metrics?${params.toString()}`))
      if (!res.ok) throw new Error('Failed to load report metrics')
      const json = await res.json()
      
      
      setMetrics(json.data as MetricsData[])
    } catch (e) {
      setMetrics([])
    } finally {
      setLoading(false)
    }
  }

  // Aplicar búsqueda y ordenamiento a métricas
  const filteredAndSortedMetrics = useMemo(() => {
    let filtered = metrics
    
    // Aplicar búsqueda
    if (searchQuery) {
      filtered = metrics.filter(m => {
        const dateStr = formatDateByView(m.date).toLowerCase()
        return dateStr.includes(searchQuery.toLowerCase())
      })
    }
    
    // Si no hay ordenamiento específico, ordenar por fecha descendente (más reciente primero)
    if (!sortColumn || !sortDirection) {
      return [...filtered].sort((a, b) => {
        // Comparar fechas directamente
        const dateA = new Date(a.date)
        const dateB = new Date(b.date)
        return dateB.getTime() - dateA.getTime() // Descendente (más reciente primero)
      })
    }

    return [...filtered].sort((a, b) => {
      let aVal: any, bVal: any

      if (sortColumn === 'profit') {
        aVal = a.revenue - a.spend
        bVal = b.revenue - b.spend
      } else if (sortColumn === 'roas') {
        aVal = a.spend > 0 ? a.revenue / a.spend : 0
        bVal = b.spend > 0 ? b.revenue / b.spend : 0
      } else {
        aVal = a[sortColumn as keyof MetricsData]
        bVal = b[sortColumn as keyof MetricsData]
      }

      if (aVal === null || aVal === undefined) return 1
      if (bVal === null || bVal === undefined) return -1

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const comparison = aVal.toLowerCase().localeCompare(bVal.toLowerCase())
        return sortDirection === 'asc' ? comparison : -comparison
      }

      return 0
    })
  }, [metrics, sortColumn, sortDirection, searchQuery])

  // Calcular totales
  const totals = useMemo(() => {
    const result = metrics.reduce((acc, m) => ({
      spend: acc.spend + m.spend,
      revenue: acc.revenue + m.revenue,
      leads: acc.leads + m.leads,
      sales: acc.sales + m.sales,
      clicks: acc.clicks + m.clicks,
      visitors: acc.visitors + m.visitors,
      appointments: acc.appointments + m.appointments,
      new_customers: acc.new_customers + (m.new_customers || 0)
    }), { spend: 0, revenue: 0, leads: 0, sales: 0, clicks: 0, visitors: 0, appointments: 0, new_customers: 0 })
    return result
  }, [metrics])

  const handleSort = (columnId: string, direction: 'asc' | 'desc' | null) => {
    setSortColumn(direction ? columnId : null)
    setSortDirection(direction)
  }

  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ]

  // Obtener fechas de inicio y fin del período
  const getPeriodDates = (date: string) => {
    // date viene en formato YYYY-MM-DD o YYYY-MM o YYYY
    let start: string, end: string

    if (viewType === 'year') {
      // Para año: YYYY
      const year = date.substring(0, 4)
      start = `${year}-01-01`
      end = `${year}-12-31`
    } else if (viewType === 'month') {
      // Para mes: YYYY-MM
      const [year, month] = date.split('-')
      start = `${year}-${month}-01`
      // Obtener el último día del mes
      const lastDay = getLastDayOfMonth(parseInt(year), parseInt(month) - 1)
      end = `${year}-${month}-${String(lastDay).padStart(2, '0')}`
    } else {
      // Para día: YYYY-MM-DD
      start = date
      end = date
    }

    return {
      start: start,
      end: end
    }
  }

  // Formatear fecha según el tipo de vista
  const formatDateByView = (date: string) => {
    // Para vista por día, mostrar el día específico
    if (viewType === 'day') {
      // La fecha viene en formato YYYY-MM-DD
      if (!date || !date.includes('-')) {
        console.warn('Formato de fecha inválido:', date)
        return date
      }

      const parts = date.split('-')
      if (parts.length !== 3) {
        console.warn('Fecha no tiene el formato esperado:', date)
        return date
      }

      const [yearStr, monthStr, dayStr] = parts
      const year = parseInt(yearStr, 10)
      const month = parseInt(monthStr, 10)
      const day = parseInt(dayStr, 10)

      // Validar que los valores sean números válidos
      if (isNaN(year) || isNaN(month) || isNaN(day)) {
        console.warn('Valores de fecha inválidos:', { year, month, day })
        return date
      }

      const monthName = months[month - 1]
      if (!monthName) {
        console.warn('Mes inválido:', month)
        return date
      }

      // Retornar formato: "21 sep 2025"
      return `${day} ${monthName.toLowerCase().substring(0, 3)} ${year}`
    }

    if (viewType === 'month' && date.match(/^\d{4}-\d{2}$/)) {
      const [year, month] = date.split('-').map(Number)
      const monthName = months[month - 1]
      return `${monthName} ${year}`
    }

    const d = new Date(date)

    if (viewType === 'year') {
      return formatYear(d)
    } else if (viewType === 'month') {
      return formatMonthYear(d)
    } else {
      return formatDateShort(d)  // Por defecto usar formato corto
    }
  }

  // Configuración de columnas con persistencia
  // Usar diferentes claves de almacenamiento para cada tipo de reporte
  const storageKey = `reports_columns_config_${reportType}`
  // Definir todas las columnas primero - IMPORTANTE: usar useMemo para que se recalcule con viewType
  const allColumns = useMemo(() => [
    {
      id: 'date',
      label: viewType === 'year' ? 'Año' : viewType === 'month' ? 'Mes' : 'Fecha',
      visible: true,
      fixed: true,
      align: 'left' as const,
      render: (value: any) => {
        // Obtener viewType actual del estado del componente
        const currentViewType = viewType
        console.log('Renderizando fecha - currentViewType:', currentViewType, 'value:', value)

        // Formatear fecha según el tipo de vista ACTUAL
        let formatted: string
        if (currentViewType === 'day') {
          // Para vista por día, mostrar el día específico
          if (!value || !value.includes('-')) {
            formatted = value
          } else {
            const parts = value.split('-')
            if (parts.length === 3) {
              const [yearStr, monthStr, dayStr] = parts
              const month = parseInt(monthStr, 10)
              const monthName = months[month - 1]
              formatted = monthName
                ? `${parseInt(dayStr, 10)} ${monthName.toLowerCase().substring(0, 3)} ${yearStr}`
                : value
            } else {
              formatted = value
            }
          }
        } else {
          // Para otras vistas, usar la función existente
          formatted = formatDateByView(value)
        }

        console.log('Fecha formateada:', formatted)
        return <span className="font-medium text-primary">{formatted}</span>
      }
    },
    {
      id: 'roas',
      label: 'ROAS',
      align: 'center' as const,
      visible: true,
      render: (_: any, row: any) => {
        const roas = row.spend > 0 ? row.revenue / row.spend : 0
        return (
          <div className="text-secondary text-center">
            {roas.toFixed(2)}x
          </div>
        )
      }
    },
    {
      id: 'profit',
      label: 'Ganancias',
      align: 'right' as const,
      visible: true,
      render: (_: any, row: any) => {
        const profit = row.revenue - row.spend
        return (
          <span className="text-primary">
            {formatCurrency(profit)}
          </span>
        )
      }
    },
    {
      id: 'revenue',
      label: 'Recolectado',
      align: 'right' as const,
      visible: true,
      render: (value: any) => (
        <span className="text-primary">{formatCurrency(value)}</span>
      )
    },
    {
      id: 'spend',
      label: 'Invertido',
      align: 'right' as const,
      visible: true,
      render: (value: any) => (
        <span className="text-secondary">{formatCurrency(value)}</span>
      )
    },
    {
      id: 'sales',
      label: 'Transacciones',
      align: 'right' as const,
      visible: true, // Siempre definir como true aquí
      render: (value: any, row: any) => (
        <button
          onClick={() => {
            const period = getPeriodDates(row.date)
            console.log('Vista actual:', viewType)
            console.log('Fecha de la fila:', row.date)
            console.log('Período calculado:', period)
            setSelectedPeriod(period)
            setModalType('sales')
          }}
          className="text-primary hover:text-primary/80 hover:underline transition-colors"
        >
          {formatNumber(value || 0)}
        </button>
      )
    },
    {
      id: 'new_customers',
      label: 'Clientes Nuevos',
      align: 'right' as const,
      visible: true,
      render: (value: any, row: any) => (
        <button
          onClick={() => {
            const period = getPeriodDates(row.date)
            setSelectedPeriod(period)
            setModalType('new_customers')
          }}
          className="text-primary hover:text-primary/80 hover:underline transition-colors"
        >
          {formatNumber(value || 0)}
        </button>
      )
    },
    {
      id: 'leads',
      label: 'Leads',
      align: 'right' as const,
      visible: false,
      render: (value: any, row: any) => (
        <button
          onClick={() => {
            const period = getPeriodDates(row.date)
            setSelectedPeriod(period)
            setModalType('leads')
          }}
          className="text-primary hover:text-primary/80 hover:underline transition-colors"
        >
          {formatNumber(value)}
        </button>
      )
    },
    {
      id: 'appointments',
      label: 'Citas',
      align: 'right' as const,
      visible: false,
      render: (value: any, row: any) => (
        <button
          onClick={() => {
            const period = getPeriodDates(row.date)
            setSelectedPeriod(period)
            setModalType('appointments')
          }}
          className="text-primary hover:text-primary/80 hover:underline transition-colors"
        >
          {formatNumber(value)}
        </button>
      )
    },
    {
      id: 'clicks',
      label: 'Clicks',
      align: 'right' as const,
      visible: false,
      render: (value: any) => (
        <span className="text-secondary">{formatNumber(value)}</span>
      )
    },
    {
      id: 'cpc',
      label: 'CPC',
      align: 'right' as const,
      visible: false,
      render: (value: any) => (
        <span className="text-secondary">{value ? formatCurrency(value) : '—'}</span>
      )
    },
    {
      id: 'cpl',
      label: 'CPL',
      align: 'right' as const,
      visible: false,
      render: (value: any) => (
        <span className="text-secondary">{value ? formatCurrency(value) : '—'}</span>
      )
    },
    {
      id: 'cac',
      label: 'CAC',
      align: 'right' as const,
      visible: false,
      render: (value: any) => (
        <span className="text-secondary">{value ? formatCurrency(value) : '—'}</span>
      )
    }
  ], [viewType, reportType]) // Solo viewType y reportType como dependencias

  const { columns: rawColumns, handleColumnReorder, handleColumnVisibilityChange } = useColumnsConfig(
    storageKey,
    allColumns
  )

  // Filtrar columna de Transacciones cuando estamos en vista Atribuidos
  const columns = reportType === 'campaigns'
    ? rawColumns.filter(col => col.id !== 'sales')
    : rawColumns

  const profit = totals.revenue - totals.spend
  const profitMargin = totals.revenue > 0 ? (profit / totals.revenue) * 100 : 0
  const avgTicket = totals.sales > 0 ? totals.revenue / totals.sales : 0
  const expensePercentage = totals.revenue > 0 ? (totals.spend / totals.revenue) * 100 : 0

  const currentYear = getCurrentYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  const exportToCSV = () => {
    const salesHeader = reportType === 'cashflow' ? 'Transacciones' : 'Ventas'
    const headers = ['Fecha', 'ROAS', 'Ganancias', 'Recolectado', 'Gastado', salesHeader, 'Citas', 'Leads']
    
    const rows = metrics.map(m => {
      const profit = m.revenue - m.spend
      const roas = m.spend > 0 ? m.revenue / m.spend : 0
      
      return [
        formatDateByView(m.date),
        roas.toFixed(2) + 'x',
        profit,
        m.revenue,
        m.spend,
        m.sales,
        m.appointments,
        m.leads
      ]
    })
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reporte-${reportType}-${viewType}-${dateToApiString(createDateInTimezone())}.csv`
    a.click()
  }

  return (
    <PageContainer>
      <div className="space-y-6">
        {/* Título y controles */}
        <div className="space-y-4">
          <h1 className="text-2xl font-bold text-primary">Reportes</h1>
          
          {/* Controles en fila */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Selector de fechas específico de Reports */}
            <DateRangeSelector
              viewType={viewType}
              monthRange={monthRange}
              dateRange={dateRange}
              yearRange={yearRange}
              customMonthYear={customMonthYear}
              customMonthStart={customMonthStart}
              customMonthEnd={customMonthEnd}
              onDateRangeChange={setDateRange}
              onMonthRangeChange={setMonthRange}
              onYearRangeChange={setYearRange}
              onCustomMonthChange={(year, start, end) => {
                setCustomMonthYear(year)
                setCustomMonthStart(start)
                setCustomMonthEnd(end)
              }}
            />
            {/* 1. Selector de vista (Día/Mes/Año) */}
            <TabList
              tabs={[
                { value: 'day', label: 'Día' },
                { value: 'month', label: 'Mes' },
                { value: 'year', label: 'Año' }
              ]}
              value={viewType}
              onChange={(value) => setViewType(value as ViewType)}
            />

            {/* 2. Tipo de reporte */}
            <TabList
              tabs={[
                { value: 'cashflow', label: 'Todos' },
                { value: 'campaigns', label: 'Última atribución' }
              ]}
              value={reportType}
              onChange={(value) => setReportType(value as ReportType)}
            />

            {/* 3. Modo de visualización */}
            <div className="flex glass rounded-lg p-1 ml-auto">
              <button
                onClick={() => setDisplayMode('table')}
                className={cn(
                  "px-2 py-1.5 rounded transition-colors flex items-center gap-2",
                  displayMode === 'table' 
                    ? 'bg-secondary text-primary' 
                    : 'text-secondary hover:text-primary'
                )}
              >
                <Icons.activity className="w-4 h-4" />
                <span className="text-sm font-medium">Histórico</span>
              </button>
              <button
                onClick={() => setDisplayMode('cards')}
                className={cn(
                  "px-2 py-1.5 rounded transition-colors flex items-center gap-2",
                  displayMode === 'cards' 
                    ? 'bg-secondary text-primary' 
                    : 'text-secondary hover:text-primary'
                )}
              >
                <Icons.barChart className="w-4 h-4" />
                <span className="text-sm font-medium">Métricas</span>
              </button>
            </div>

            {/* 5. Botón de exportar */}
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={exportToCSV}
            >
              <Icons.download className="w-4 h-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        {loading || syncRunning ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <SkeletonLoader variant="card" />
            <SkeletonLoader variant="card" />
            <SkeletonLoader variant="card" />
            <SkeletonLoader variant="card" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              title="Ingresos"
              value={formatCurrency(summaryMetrics?.revenue || totals.revenue)}
              icon={Icons.dollarSign}
              iconColor="text-primary"
              change={summaryMetrics?.trends?.revenue || 0}
              trend={
                summaryMetrics?.trends?.revenue > 0 ? 'up' :
                summaryMetrics?.trends?.revenue < 0 ? 'down' : 'up'
              }
              className={metricsLoading ? 'animate-pulse' : ''}
            />
            <KPICard
              title="Ganancia"
              value={formatCurrency(summaryMetrics?.profit || profit)}
              icon={Icons.trendingUp}
              iconColor="text-primary"
              change={summaryMetrics?.trends?.profit || profitMargin}
              trend={
                summaryMetrics?.trends?.profit > 0 ? 'up' :
                summaryMetrics?.trends?.profit < 0 ? 'down' :
                profit > 0 ? 'up' : 'down'
              }
              className={metricsLoading ? 'animate-pulse' : ''}
            />
            <KPICard
              title="Clientes Nuevos"
              value={formatNumber(summaryMetrics?.newCustomers || totals.new_customers || 0)}
              icon={Icons.users}
              iconColor="text-primary"
              change={summaryMetrics?.trends?.newCustomers || 0}
              trend={
                summaryMetrics?.trends?.newCustomers > 0 ? 'up' :
                summaryMetrics?.trends?.newCustomers < 0 ? 'down' : 'up'
              }
              className={metricsLoading ? 'animate-pulse' : ''}
            />
            <KPICard
              title="Gastos"
              value={formatCurrency(summaryMetrics?.spend || totals.spend)}
              icon={Icons.target}
              iconColor="text-primary"
              change={summaryMetrics?.trends?.spend || expensePercentage}
              trend={
                summaryMetrics?.trends?.spend < 0 ? 'up' :
                summaryMetrics?.trends?.spend > 0 ? 'down' : 'down'
              }
              className={metricsLoading ? 'animate-pulse' : ''}
            />
          </div>
        )}

        {/* Tabla o Tarjetas de métricas */}
        {displayMode === 'table' ? (
          <TableWithControls
            key={`table-${viewType}-${reportType}`} // Forzar re-render cuando cambie la vista
            hasSearch={true}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            columns={columns}
            data={filteredAndSortedMetrics}
            loading={loading || syncRunning}
            emptyMessage="No hay datos para el período seleccionado"
            onSort={handleSort}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onColumnReorder={handleColumnReorder}
            onColumnVisibilityChange={handleColumnVisibilityChange}
          />
        ) : (
          <MetricsTables 
            metrics={metrics}
            reportType={reportType}
            loading={loading || syncRunning}
          />
        )}

        {/* Modales de detalles */}
        {selectedPeriod && (
          <ReportsModals
            periodStart={selectedPeriod.start}
            periodEnd={selectedPeriod.end}
            reportType={reportType}
            modalType={modalType}
            onClose={() => {
              setSelectedPeriod(null)
              setModalType(null)
            }}
          />
        )}
      </div>
    </PageContainer>
  )
}
