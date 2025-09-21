import React from 'react'
import { Card } from '../../ui'
import { Icons } from '../../icons'
import { useDateRange } from '../../contexts/DateContext'
import { useFunnelData } from '../../hooks/useFunnelData'

export function FunnelChart() {
  const { dateRange } = useDateRange()
  const { data: funnelData, loading } = useFunnelData(dateRange)

  // Usar los datos del hook directamente (ya vienen adaptados)
  const data = funnelData

  const maxValue = data.length > 0 ? Math.max(...data.map(d => d.value), 1) : 1 // Evitar división por 0
  const totalConversion = data.length > 0 && data[0].value > 0
    ? ((data[data.length - 1].value / data[0].value) * 100).toFixed(1)
    : '0'
  
  return (
    <Card variant="glass" className="p-6 overflow-hidden relative">
      {/* Fondo degradado ultra sutil - solo en dark mode */}
      <div className="absolute inset-0 opacity-[0.03] only-dark">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-accent-blue rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-accent-purple rounded-full blur-3xl" />
      </div>
      
      <div className="relative z-10">
        {/* Header minimalista */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-lg font-semibold text-primary">Funnel</h3>
          </div>
          <button className="p-2 glass-hover rounded-xl transition-colors">
            <Icons.more className="w-4 h-4 text-tertiary" />
          </button>
        </div>

        {/* Funnel visual moderno sin animaciones */}
        <div className="space-y-3">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-4 animate-pulse">
                  <div className="w-12 h-12 rounded-xl bg-[var(--color-background-glass)] flex-shrink-0" />
                  <div className="flex-1">
                    <div className="h-4 bg-[var(--color-background-glass)] rounded w-24 mb-2" />
                    <div className="h-2 bg-[var(--color-background-glass)] rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
          data.map((item, index) => {
            const percentage = (item.value / maxValue) * 100
            const conversionRate = index > 0 
              ? ((item.value / data[index - 1].value) * 100).toFixed(1)
              : '100'
            const Icon = item.icon
            
            return (
              <div key={item.stage} className="group relative">
                <div className="flex items-center gap-4">
                  {/* Icono con fondo - mismo estilo que KPIs */}
                  <div className="w-12 h-12 rounded-xl bg-glass-subtle flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  
                  {/* Contenido principal */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between mb-2 gap-2">
                      <span className="text-sm font-medium text-primary truncate">{item.stage}</span>
                      <div className="flex items-baseline gap-1 sm:gap-3 flex-shrink-0">
                        <span className="text-base sm:text-lg font-bold text-primary">
                          {item.value.toLocaleString()}
                        </span>
                        {index > 0 && (
                          <span className="text-xs text-success font-medium">
                            {conversionRate}%
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Barra de progreso con fondo */}
                    <div className="relative">
                      <div className="h-4 bg-gray-100 dark:bg-gray-800/30 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gray-700 dark:bg-gray-300 rounded-full transition-[width] duration-1000 ease-out"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                
                {index < data.length - 1 && (
                  <div className="absolute left-6 top-12 h-3 w-px bg-gradient-to-b from-black/10 dark:from-white/20 to-transparent" />
                )}
              </div>
            )
          })
          )}
        </div>

        {/* Insights destacados */}
        {!loading && data[0].value > 0 && (
        <div className="mt-8 p-4 rounded-xl bg-glass-subtle border border-primary">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-tertiary mb-1">Mejor conversión</p>
              <p className="text-sm font-semibold text-primary">
                <span className="block sm:inline">Leads → Citas</span>
                <span className="text-success sm:ml-2">
                  {data[1].value > 0 ? ((data[2].value / data[1].value) * 100).toFixed(1) : '0'}%
                </span>
              </p>
            </div>
            <div>
              <p className="text-xs text-tertiary mb-1">Citas a Ventas</p>
              <p className="text-sm font-semibold text-primary">
                <span className="block sm:inline">Citas → Clientes</span>
                <span className="text-success sm:ml-2">
                  {data[2].value > 0 ? ((data[3].value / data[2].value) * 100).toFixed(1) : '0'}%
                </span>
              </p>
            </div>
          </div>
        </div>
        )}
      </div>
    </Card>
  )
}
