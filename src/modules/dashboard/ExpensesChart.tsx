import React from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts'
import { SmartRechartsTooltip } from '../../components/SmartRechartsTooltip'
import { Card, ChartContainer } from '../../ui'
import { Icons } from '../../icons'
import { formatCurrency } from '../../lib/utils'

const data = [
  { date: '1', bills: 35, subscriptions: 18, food: 12 },
  { date: '5', bills: 32, subscriptions: 20, food: 15 },
  { date: '10', bills: 38, subscriptions: 16, food: 18 },
  { date: '15', bills: 30, subscriptions: 22, food: 14 },
  { date: '20', bills: 36, subscriptions: 19, food: 16 },
  { date: '25', bills: 33, subscriptions: 21, food: 13 },
  { date: '31', bills: 35, subscriptions: 18, food: 15 },
]

const expenses = [
  { category: 'Facturas', amount: 36000, color: '#f97316' },
  { category: 'Suscripciones', amount: 18300, color: '#3b82f6' },
  { category: 'Alimentos', amount: 12000, color: '#8b5cf6' },
]

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass rounded-lg p-3 shadow-xl">
        <p className="text-xs text-secondary mb-2">Jan {label}, 2025</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-secondary capitalize">{entry.dataKey}:</span>
            <span className="text-primary font-medium">${entry.value}k</span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

export function ExpensesChart() {
  const total = expenses.reduce((sum, exp) => sum + exp.amount, 0)

  return (
    <Card variant="glass" className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-primary">Desglose de Gastos</h3>
          <p className="text-xs text-secondary mt-0.5">Últimos 12 meses</p>
        </div>
        <button className="p-1.5 glass-hover rounded-lg transition-colors">
          <Icons.more className="w-4 h-4 text-secondary" />
        </button>
      </div>

      <div className="mb-4">
        <p className="text-2xl font-bold text-primary">{formatCurrency(total)}</p>
        <p className="text-xs text-secondary">Comparado con ${(total * 0.85 / 1000).toFixed(1)}k el mes anterior</p>
      </div>

      <ChartContainer height={180}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="date"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            />
            <YAxis 
              hide 
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
            <Line
              type="monotone"
              dataKey="bills"
              stroke="var(--color-status-warning)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="subscriptions"
              stroke="var(--color-accent-blue)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="food"
              stroke="var(--color-accent-purple)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartContainer>

      <div className="mt-4 space-y-2">
        {expenses.map((expense) => (
          <div key={expense.category} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: expense.color }}
              />
              <span className="text-sm text-secondary">{expense.category}</span>
            </div>
            <span className="text-sm font-medium text-primary">
              {formatCurrency(expense.amount)}
            </span>
          </div>
        ))}
      </div>
    </Card>
  )
}
