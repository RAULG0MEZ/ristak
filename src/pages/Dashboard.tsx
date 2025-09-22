import React, { useState } from 'react'
import { PageContainer, Card, DateRangePicker } from '../ui'
import { KPICard } from '../ui/KPICard'
import { RevenueChart } from '../modules/dashboard/RevenueChart'
import { FunnelChart } from '../modules/dashboard/FunnelChart'
import { TrafficChart } from '../modules/dashboard/TrafficChart'
import { Icons } from '../icons'
import { formatCurrency } from '../lib/utils'
import { useDateRange } from '../contexts/DateContext'
import { useDashboardMetrics } from '../hooks/useDashboardMetrics'

export function Dashboard() {
  const { dateRange, setDateRange } = useDateRange()
  
  // Obtener métricas reales de la base de datos
  const { 
    financialMetrics, 
    obligationsMetrics, 
    funnelData, 
    loading, 
    error 
  } = useDashboardMetrics({
    start: dateRange.start,
    end: dateRange.end
  })
  
  // Usar datos reales del hook - solo valores por defecto para loading
  const defaultFinancialMetrics = [
    { label: 'Ingresos Netos', value: formatCurrency(0), change: 0, trend: 'neutral' as const },
    { label: 'Gastos de Publicidad', value: formatCurrency(0), change: 0, trend: 'neutral' as const },
    { label: 'Ganancia Bruta', value: formatCurrency(0), change: 0, trend: 'neutral' as const },
    { label: 'ROAS', value: 0, suffix: 'x', change: 0, trend: 'neutral' as const },
  ]

  const defaultObligationsMetrics = [
    { label: 'IVA a Pagar', value: formatCurrency(0), change: 0, trend: 'neutral' as const },
    { label: 'Ganancia Neta', value: formatCurrency(0), change: 0, trend: 'neutral' as const },
    { label: 'Reembolsos', value: formatCurrency(0), change: 0, trend: 'neutral' as const },
    { label: 'LTV Promedio', value: formatCurrency(0), change: 0, trend: 'neutral' as const },
  ]

  // Usar métricas reales del hook cuando estén disponibles, defaults solo para loading
  const displayFinancialMetrics = loading ? defaultFinancialMetrics : financialMetrics
  const displayObligationsMetrics = loading ? defaultObligationsMetrics : obligationsMetrics

  return (
    <PageContainer>
      <div className="space-y-6">
        {/* Header con selector de fechas */}
        <div className="space-y-4">
          <h1 className="text-2xl font-bold text-primary">Dashboard</h1>
          <DateRangePicker />
        </div>

        {/* Mostrar mensaje de error si hay problemas */}
        {error && (
          <div className="glass rounded-lg p-4 border border-glassBorder">
            <p className="text-sm text-error">{error}</p>
          </div>
        )}
        
        {/* Métricas Financieras */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {displayFinancialMetrics.map((metric, index) => {
            const icons = [Icons.dollarSign, Icons.megaphone, Icons.trendingUp, Icons.target];
            const iconColors = ['text-primary', 'text-primary', 'text-primary', 'text-primary'];

            return (
              <KPICard
                key={metric.label}
                title={metric.label}
                value={metric.value}
                change={metric.change}
                trend={metric.trend === 'neutral' ? undefined : metric.trend}
                icon={icons[index]}
                iconColor={iconColors[index]}
                className={loading ? 'animate-pulse' : ''}
              />
            );
          })}
        </div>

        {/* Obligaciones y Otros */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {displayObligationsMetrics.map((metric, index) => {
            const icons = [Icons.receipt, Icons.trendingUp, Icons.xCircle, Icons.users];
            const iconColors = ['text-primary', 'text-primary', 'text-primary', 'text-primary'];

            return (
              <KPICard
                key={metric.label}
                title={metric.label}
                value={metric.value}
                change={metric.change}
                trend={metric.trend === 'neutral' ? undefined : metric.trend}
                icon={icons[index]}
                iconColor={iconColors[index]}
                className={loading ? 'animate-pulse' : ''}
              />
            );
          })}
        </div>

        {/* Gráfico de Métricas Financieras */}
        <div className="grid grid-cols-1 gap-4 sm:gap-6">
          <RevenueChart />
        </div>

        {/* Funnel de Conversión y Fuentes de Tráfico */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <FunnelChart />
          <TrafficChart />
        </div>
      </div>
    </PageContainer>
  )
}
