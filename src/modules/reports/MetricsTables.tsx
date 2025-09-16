import React from 'react'
import { Card, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui'
import { formatCurrency, formatNumber } from '../../lib/utils'
import { SkeletonLoader } from '../../ui/SkeletonLoader'

interface MetricsData {
  spend: number
  revenue: number
  leads: number
  sales: number
  clicks: number
  visitors: number
  appointments: number
}

interface MetricsTablesProps {
  metrics: MetricsData[]
  reportType: 'cashflow' | 'campaigns'
  loading?: boolean
}

export function MetricsTables({ metrics, reportType, loading = false }: MetricsTablesProps) {
  // Calcular totales
  const totals = metrics.reduce((acc, m) => ({
    spend: acc.spend + m.spend,
    revenue: acc.revenue + m.revenue,
    leads: acc.leads + m.leads,
    sales: acc.sales + m.sales,
    clicks: acc.clicks + m.clicks,
    visitors: acc.visitors + m.visitors,
    appointments: acc.appointments + m.appointments
  }), { spend: 0, revenue: 0, leads: 0, sales: 0, clicks: 0, visitors: 0, appointments: 0 })

  // Calcular métricas derivadas
  const profit = totals.revenue - totals.spend
  const roas = totals.spend > 0 ? totals.revenue / totals.spend : 0
  const roi = totals.spend > 0 ? ((totals.revenue - totals.spend) / totals.spend) * 100 : 0
  const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0
  const epc = totals.clicks > 0 ? totals.revenue / totals.clicks : 0
  const cpa = totals.leads > 0 ? totals.spend / totals.leads : 0
  const epa = totals.leads > 0 ? totals.revenue / totals.leads : 0
  const acr = totals.clicks > 0 ? (totals.leads / totals.clicks) * 100 : 0
  const cpe = totals.visitors > 0 ? totals.spend / totals.visitors : 0
  const epe = totals.visitors > 0 ? totals.revenue / totals.visitors : 0
  const ecr = totals.clicks > 0 ? (totals.visitors / totals.clicks) * 100 : 0
  const scr = totals.leads > 0 ? (totals.sales / totals.leads) * 100 : 0
  const cac = totals.sales > 0 ? totals.spend / totals.sales : 0
  const aov = totals.sales > 0 ? totals.revenue / totals.sales : 0
  const ltv = aov * 1.5 // Estimación simple
  const newCustomers = totals.sales
  const repeatCustomers = 0
  const refunds = 0
  const roas24 = 0

  const formatPercent = (value: number): string => {
    return `${(value * 100).toFixed(1)}%`
  }

  // Reorganizar métricas en columnas compactas
  const metricsColumns = [
    // Columna 1: Tráfico
    {
      title: "Tráfico",
      items: [
        { label: "Clicks", value: formatNumber(totals.clicks), description: "Clics totales" },
        { label: "CPC", value: formatCurrency(cpc), description: "Costo por clic" },
        { label: "EPC", value: formatCurrency(epc), description: "Ganancia por clic" },
        { label: "Engaged", value: formatNumber(totals.visitors), description: "Usuarios activos" },
        { label: "ECR", value: formatPercent(ecr / 100), description: "Tasa de interacción" },
        { label: "CPE", value: formatCurrency(cpe), description: "Costo por interacción" },
        { label: "EPE", value: formatCurrency(epe), description: "Ganancia por interacción" }
      ]
    },
    // Columna 2: Conversión
    {
      title: "Conversión",
      items: [
        { label: "Actions", value: formatNumber(totals.leads), description: "Leads generados" },
        { label: "ACR", value: formatPercent(acr / 100), description: "Tasa de acciones" },
        { label: "CPA", value: formatCurrency(cpa), description: "Costo por acción" },
        { label: "EPA", value: formatCurrency(epa), description: "Ganancia por acción" },
        { label: "Sales", value: formatNumber(totals.sales), description: reportType === 'cashflow' ? "Transacciones" : "Ventas" },
        { label: "SCR", value: formatPercent(scr / 100), description: "Tasa de ventas" },
        { label: "Appointments", value: formatNumber(totals.appointments), description: "Citas agendadas" }
      ]
    },
    // Columna 3: Financiero
    {
      title: "Financiero",
      items: [
        { label: "Revenue", value: formatCurrency(totals.revenue), description: "Ingresos totales", highlight: 'primary' },
        { label: "Cost", value: formatCurrency(totals.spend), description: "Gasto total" },
        { label: "Profit", value: formatCurrency(profit), description: "Utilidad neta", highlight: profit > 0 ? 'positive' : 'negative' },
        { label: "ROAS", value: `${roas.toFixed(2)}x`, description: "Retorno publicitario", highlight: roas > 1 ? 'positive' : 'negative' },
        { label: "ROI", value: formatPercent(roi / 100), description: "Retorno de inversión", highlight: roi > 0 ? 'positive' : 'negative' },
        { label: "AOV", value: formatCurrency(aov), description: "Ticket promedio" },
        { label: "CAC", value: formatCurrency(cac), description: "Costo de adquisición" }
      ]
    },
    // Columna 4: Clientes
    {
      title: "Clientes",
      items: [
        { label: "Customers", value: formatNumber(totals.sales), description: "Clientes totales" },
        { label: "NewCust", value: formatNumber(newCustomers), description: "Clientes nuevos" },
        { label: "RepeatCust", value: formatNumber(repeatCustomers), description: "Clientes recurrentes" },
        { label: "LTV", value: formatCurrency(ltv), description: "Valor de vida" },
        { label: "Refunds", value: formatCurrency(refunds), description: "Reembolsos" },
        { label: "ROAS24", value: `${roas24.toFixed(2)}x`, description: "ROAS a 24h" }
      ]
    }
  ]

  // Componente de tabla individual
  const MetricTable = ({ column }: { column: typeof metricsColumns[0] }) => (
    <Card variant="glass" className="h-full">
      <div className="p-4 border-b border-primary">
        <h3 className="text-sm font-semibold text-primary">{column.title}</h3>
      </div>
      
      {loading ? (
        <div className="p-4">
          <SkeletonLoader variant="table" rows={7} columns={2} />
        </div>
      ) : (
        <Table fluid>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Métrica</TableHead>
              <TableHead className="text-xs text-right">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {column.items.map((item, idx) => (
              <TableRow key={idx} className="glass-hover">
                <TableCell className="py-2">
                  <div>
                    <div className="text-sm font-medium text-primary">
                      {item.label}
                    </div>
                    <div className="text-xs text-tertiary">
                      {item.description}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right text-sm font-medium py-2 text-secondary">
                  {item.value}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  )

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {metricsColumns.map((column, index) => (
        <MetricTable key={index} column={column} />
      ))}
    </div>
  )
}
