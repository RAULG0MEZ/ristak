import React from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts'
import { SmartRechartsTooltip } from '../../components/SmartRechartsTooltip'
import { Card, ChartContainer } from '../../ui'
import { Icons } from '../../icons'
import { formatCurrency } from '../../lib/utils'
import { useTheme } from '../../contexts/ThemeContext'
import { useHistoricalDataFixed } from '../../hooks/useHistoricalDataFixed'

interface RevenueChartProps {
  title?: string
  dataKey?: 'income' | 'expenses'
  color?: string
}

const CustomTooltip = ({ active, payload, label, dataKey }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass rounded-lg p-3 shadow-xl">
        <p className="text-xs text-tertiary mb-2">{label}</p>
        <div className="flex items-center gap-2 text-sm">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: payload[0].color }}
          />
          <span className="text-secondary">
            {dataKey === 'income' ? 'Ingresos' : 'Pagos'}:
          </span>
          <span className="text-primary font-medium">
            {formatCurrency(payload[0].value)}
          </span>
        </div>
      </div>
    )
  }
  return null
}

export function RevenueChart({ 
  title = 'Ingresos', 
  dataKey = 'income',
  color
}: RevenueChartProps) {
  // Reaccionar a cambios de tema desde el contexto (evita leer del DOM)
  const { theme, themeData } = useTheme()
  const isDarkMode = theme === 'dark'
  
  // Usar el estándar de métricas lineales desde tokens
  const neutralColor = themeData.colors.chart.metricLine
  const chartColor = color || neutralColor
  
  // Obtener datos de los últimos 12 meses (siempre fijos)
  const { data, loading, error } = useHistoricalDataFixed()
  
  return (
    <Card variant="glass" className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-primary">{title}</h3>
          <p className="text-xs text-secondary mt-0.5">Últimos 12 meses</p>
        </div>
        <button className="p-1.5 glass-hover rounded-lg transition-colors">
          <Icons.more className="w-4 h-4 text-tertiary" />
        </button>
      </div>

      <ChartContainer height={250}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-pulse text-tertiary">Cargando datos...</div>
          </div>
        ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <defs>
              <linearGradient id={`gradient-${dataKey}-${isDarkMode ? 'dark' : 'light'}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartColor} stopOpacity={0.2} />
                <stop offset="50%" stopColor={chartColor} stopOpacity={0.1} />
                <stop offset="100%" stopColor={chartColor} stopOpacity={0.02} />
              </linearGradient>
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
              tickFormatter={(value) => `${value / 1000}k`}
              domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.4)]}
            />
            <SmartRechartsTooltip
              content={(props: any) => <CustomTooltip {...props} dataKey={dataKey} />}
              cursor={false}
              prefer="tr"
              offset={{ x: 0, y: 60 }}
              portalToBody
              allowEscapeViewBox={{ x: true, y: true }}
            />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={chartColor}
              strokeWidth={2.5}
              fill={`url(#gradient-${dataKey}-${isDarkMode ? 'dark' : 'light'})`}
              dot={false}
              activeDot={{ 
                r: 6, 
                fill: chartColor,
                stroke: isDarkMode ? '#0a0b0d' : '#ffffff',
                strokeWidth: 2
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
        )}
      </ChartContainer>
    </Card>
  )
}
