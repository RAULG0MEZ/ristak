import React from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Dot } from 'recharts'
import { SmartRechartsTooltip } from '../../components/SmartRechartsTooltip'
import { Card, ChartContainer } from '../../ui'
import { Badge } from '../../ui'
import { Icons } from '../../icons'
import { useHistoricalData } from '../../hooks/useHistoricalData'
import { formatCurrency } from '../../lib/utils'

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass rounded-lg p-3 shadow-xl">
        <p className="text-xs text-secondary mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-secondary capitalize">
              {entry.dataKey === 'income' ? 'Ingresos' :
               entry.dataKey === 'expenses' ? 'Gastos' : 'Transacciones'}:
            </span>
            <span className="text-primary font-medium">
              {entry.dataKey === 'transactions' ? entry.value : formatCurrency(entry.value)}
            </span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

export function MoneyFlowChart() {
  const { data: historicalData, loading } = useHistoricalData()

  // Usar los datos directamente sin transformación innecesaria
  const data = historicalData
  return (
    <Card variant="glass" className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-primary">Flujo de Dinero</h3>
          <p className="text-xs text-secondary mt-0.5">Últimos 12 meses</p>
        </div>
        <button className="p-1.5 glass-hover rounded-lg transition-colors">
          <Icons.more className="w-4 h-4 text-secondary" />
        </button>
      </div>

      <div className="flex gap-4 mb-4">
        <Badge variant="default">
          <span className="w-2 h-2 bg-accent-blue rounded-full mr-1.5" />
          Ingresos
        </Badge>
        <Badge variant="default">
          <span className="w-2 h-2 bg-accent-orange rounded-full mr-1.5" />
          Gastos
        </Badge>
        <Badge variant="default">
          <span className="w-2 h-2 bg-accent-purple rounded-full mr-1.5" />
          Transacciones
        </Badge>
      </div>

      <ChartContainer height={250}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-background-glassBorder)" opacity={0.3} />
            <XAxis
              dataKey="month"
              tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }}
              axisLine={{ stroke: 'var(--color-background-glassBorder)' }}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis
              tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }}
              axisLine={{ stroke: 'var(--color-background-glassBorder)' }}
              tickFormatter={(value) => value >= 1000 ? `${(value/1000).toFixed(0)}k` : value.toString()}
            />
            <SmartRechartsTooltip
              content={<CustomTooltip />}
              cursor={{ stroke: 'var(--color-text-secondary)', strokeWidth: 1 }}
              prefer="tr"
              offset={{ x: 0, y: 60 }}
              portalToBody
              allowEscapeViewBox={{ x: true, y: true }}
            />
            <Line
              type="monotone"
              dataKey="income"
              stroke="var(--color-accent-blue)"
              strokeWidth={2.5}
              dot={{ fill: 'var(--color-accent-blue)', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6 }}
              connectNulls={true}
            />
            <Line
              type="monotone"
              dataKey="expenses"
              stroke="var(--color-accent-orange)"
              strokeWidth={2.5}
              dot={{ fill: 'var(--color-accent-orange)', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6 }}
              connectNulls={true}
            />
            <Line
              type="monotone"
              dataKey="transactions"
              stroke="var(--color-accent-purple)"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ fill: 'var(--color-accent-purple)', strokeWidth: 1, r: 3 }}
              activeDot={{ r: 5 }}
              connectNulls={true}
              yAxisId="right"
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }}
              axisLine={{ stroke: 'var(--color-background-glassBorder)' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartContainer>
    </Card>
  )
}
