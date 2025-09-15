import React from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts'
import { SmartRechartsTooltip } from '../../components/SmartRechartsTooltip'
import { Card, ChartContainer } from '../../ui'
import { Badge } from '../../ui'
import { Icons } from '../../icons'

const data = [
  { month: 'Ene', income: 45, outcome: 28 },
  { month: 'Feb', income: 52, outcome: 35 },
  { month: 'Mar', income: 48, outcome: 42 },
  { month: 'Abr', income: 35, outcome: 30 },
  { month: 'May', income: 42, outcome: 25 },
  { month: 'Jun', income: 38, outcome: 33 },
  { month: 'Jul', income: 50, outcome: 28 },
  { month: 'Ago', income: 45, outcome: 35 },
  { month: 'Sep', income: 55, outcome: 30 },
  { month: 'Oct', income: 42, outcome: 38 },
  { month: 'Nov', income: 48, outcome: 32 },
  { month: 'Dic', income: 52, outcome: 40 },
]

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
            <span className="text-secondary capitalize">{entry.dataKey}:</span>
            <span className="text-primary font-medium">{entry.value}k</span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

export function MoneyFlowChart() {
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
          Egresos
        </Badge>
      </div>

      <ChartContainer height={250}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-background-glassBorder)" opacity={0.5} />
            <XAxis
              dataKey="month"
              tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }}
              axisLine={{ stroke: 'var(--color-background-glassBorder)' }}
            />
            <YAxis
              tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }}
              axisLine={{ stroke: 'var(--color-background-glassBorder)' }}
              tickFormatter={(value) => `${value}k`}
              domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.4)]}
            />
            <SmartRechartsTooltip
              content={<CustomTooltip />}
              cursor={false}
              prefer="tr"
              offset={{ x: 0, y: 60 }}
              portalToBody
              allowEscapeViewBox={{ x: true, y: true }}
            />
            <Bar dataKey="income" fill="var(--color-accent-blue)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="outcome" fill="var(--color-accent-orange)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartContainer>
    </Card>
  )
}
