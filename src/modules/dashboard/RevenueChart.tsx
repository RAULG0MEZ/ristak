import React, { useState, useEffect } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts'
import { SmartRechartsTooltip } from '../../components/SmartRechartsTooltip'
import { Card, ChartContainer, Dropdown, Checkbox } from '../../ui'
import { ChevronDown } from 'lucide-react'
import { formatCurrency } from '../../lib/utils'
import { useTheme } from '../../contexts/ThemeContext'
import { useHistoricalData } from '../../hooks/useHistoricalData'
import { cn } from '../../lib/utils'

interface RevenueChartProps {
  title?: string
  dataKey?: 'income' | 'expenses'
  color?: string
}

interface MetricOption {
  key: string
  label: string
  color?: string
}

const METRIC_OPTIONS: MetricOption[] = [
  { key: 'income', label: 'Ingresos' },
  { key: 'netIncome', label: 'Ingresos netos', color: '#3b82f6' },
  { key: 'expenses', label: 'Gastos', color: '#ef4444' }
]

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass rounded-lg p-3 shadow-xl">
        <p className="text-xs text-tertiary mb-2">{label}</p>
        {payload.map((item: any, index: number) => {
          const metricOption = METRIC_OPTIONS.find(opt => opt.key === item.dataKey)
          return (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-secondary">
                {metricOption?.label || item.dataKey}:
              </span>
              <span className="text-primary font-medium">
                {formatCurrency(item.value)}
              </span>
            </div>
          )
        })}
      </div>
    )
  }
  return null
}

export function RevenueChart({
  title = 'Métricas Financieras',
  dataKey = 'income',
  color
}: RevenueChartProps) {
  // Reaccionar a cambios de tema desde el contexto (evita leer del DOM)
  const { theme, themeData } = useTheme()
  const isDarkMode = theme === 'dark'

  // Estado para las métricas seleccionadas
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(() => {
    // Cargar configuración del localStorage
    const saved = localStorage.getItem('revenue-chart-metrics')
    return saved ? JSON.parse(saved) : ['income', 'netIncome', 'expenses'] // Las 3 opciones por defecto
  })

  const [dropdownOpen, setDropdownOpen] = useState(false)

  // Usar el estándar de métricas lineales desde tokens
  const neutralColor = themeData.colors.chart.metricLine

  // Obtener datos de los últimos 12 meses (siempre fijos)
  const { data: rawData, loading, error } = useHistoricalData()

  // Transformar datos para agregar ingresos netos
  const data = rawData.map(point => ({
    ...point,
    netIncome: point.income - point.expenses
  }))

  // Guardar configuración en localStorage cuando cambie
  useEffect(() => {
    localStorage.setItem('revenue-chart-metrics', JSON.stringify(selectedMetrics))
  }, [selectedMetrics])

  const toggleMetric = (metricKey: string) => {
    setSelectedMetrics(prev => {
      if (prev.includes(metricKey)) {
        // Evitar dejar el gráfico vacío
        if (prev.length === 1) return prev
        return prev.filter(key => key !== metricKey)
      }
      return [...prev, metricKey]
    })
  }

  // Calcular el dominio dinámico basado en las métricas seleccionadas
  const getYDomain = () => {
    if (!data.length) return [0, 0]

    let maxValue = 0
    data.forEach(point => {
      selectedMetrics.forEach(metric => {
        const value = Math.abs(point[metric as keyof typeof point] as number)
        if (value > maxValue) maxValue = value
      })
    })

    return [0, Math.ceil(maxValue * 1.4)]
  }
  
  return (
    <Card variant="glass" className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-primary">{title}</h3>
          <p className="text-xs text-secondary mt-0.5">Últimos 12 meses</p>
        </div>
        <Dropdown
          trigger={
            <button className="flex items-center gap-2 px-3 py-1.5 glass-hover rounded-lg transition-colors">
              <span className="text-sm text-secondary">Métricas</span>
              <ChevronDown className={cn(
                "w-4 h-4 text-tertiary transition-transform",
                dropdownOpen && "rotate-180"
              )} />
            </button>
          }
          open={dropdownOpen}
          onOpenChange={setDropdownOpen}
          align="end"
          className="p-2"
        >
          <div className="space-y-1">
            {METRIC_OPTIONS.map(option => (
              <button
                key={option.key}
                onClick={() => toggleMetric(option.key)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-left"
              >
                <span className="text-sm text-primary">{option.label}</span>
                <Checkbox
                  checked={selectedMetrics.includes(option.key)}
                  onChange={() => toggleMetric(option.key)}
                  className="pointer-events-none"
                />
              </button>
            ))}
          </div>
        </Dropdown>
      </div>

      <ChartContainer height={250}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-pulse text-tertiary">Cargando datos...</div>
          </div>
        ) : selectedMetrics.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-tertiary text-sm">Selecciona al menos una métrica</div>
          </div>
        ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <defs>
              {selectedMetrics.map(metricKey => {
                const option = METRIC_OPTIONS.find(opt => opt.key === metricKey)
                const metricColor = option?.color || neutralColor
                return (
                  <linearGradient
                    key={metricKey}
                    id={`gradient-${metricKey}-${isDarkMode ? 'dark' : 'light'}`}
                    x1="0" y1="0" x2="0" y2="1"
                  >
                    <stop offset="0%" stopColor={metricColor} stopOpacity={0.2} />
                    <stop offset="50%" stopColor={metricColor} stopOpacity={0.1} />
                    <stop offset="100%" stopColor={metricColor} stopOpacity={0.02} />
                  </linearGradient>
                )
              })}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={themeData.colors.chart.grid} />
            <XAxis
              dataKey="month"
              tick={{ fill: themeData.colors.text.tertiary, fontSize: 12 }}
              axisLine={{ stroke: themeData.colors.text.tertiary, opacity: 0.2 }}
            />
            <YAxis
              tick={{ fill: themeData.colors.text.tertiary, fontSize: 12 }}
              axisLine={{ stroke: themeData.colors.text.tertiary, opacity: 0.2 }}
              tickFormatter={(value, index) => {
                // Ocultar el primer valor del eje Y para evitar solapamiento con eje X
                if (index === 0) return ''
                if (value >= 1000) {
                  return `$${Math.round(value / 1000)}k`
                }
                return `$${Math.round(value)}`
              }}
              domain={getYDomain()}
            />
            <SmartRechartsTooltip
              content={CustomTooltip}
              cursor={false}
              prefer="tr"
              offset={{ x: 0, y: 60 }}
              portalToBody
              allowEscapeViewBox={{ x: true, y: true }}
            />
            {selectedMetrics.map(metricKey => {
              const option = METRIC_OPTIONS.find(opt => opt.key === metricKey)
              const metricColor = option?.color || neutralColor

              return (
                <Area
                  key={metricKey}
                  type="monotone"
                  dataKey={metricKey}
                  stroke={metricColor}
                  strokeWidth={2.5}
                  fill={`url(#gradient-${metricKey}-${isDarkMode ? 'dark' : 'light'})`}
                  dot={false}
                  activeDot={{
                    r: 6,
                    fill: metricColor,
                    stroke: isDarkMode ? '#0a0b0d' : '#ffffff',
                    strokeWidth: 2
                  }}
                />
              )
            })}
          </AreaChart>
        </ResponsiveContainer>
        )}
      </ChartContainer>
    </Card>
  )
}
