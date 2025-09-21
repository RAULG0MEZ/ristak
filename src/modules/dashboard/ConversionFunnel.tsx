import React from 'react'
import { Card } from '../../ui'
import { Icons } from '../../icons'
import { useFunnelData } from '../../hooks/useFunnelData'

export function ConversionFunnel() {
  const { data: funnelStages, loading, error } = useFunnelData()

  // Calcular porcentajes de conversión basados en el primer stage con valor
  const calculateConversionRates = () => {
    if (!funnelStages || funnelStages.length === 0) return []

    // Encontrar el primer stage con valor > 0 para usarlo como base
    const firstStageWithValue = funnelStages.find(s => s.value > 0)
    const baseValue = firstStageWithValue?.value || 1

    return funnelStages.map((stage, index) => ({
      ...stage,
      rate: baseValue > 0 ? Math.round((stage.value / baseValue) * 100) : 0
    }))
  }

  const funnelData = calculateConversionRates()

  if (loading) {
    return (
      <Card variant="glass" className="p-4">
        <div className="flex items-center justify-center h-48">
          <span className="text-gray-400">Cargando embudo...</span>
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card variant="glass" className="p-4">
        <div className="flex items-center justify-center h-48">
          <span className="text-red-400">Error al cargar el embudo</span>
        </div>
      </Card>
    )
  }

  return (
    <Card variant="glass" className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Embudo</h3>
        <Icons.filter className="w-4 h-4 text-gray-400" />
      </div>

      <div className="space-y-3">
        {funnelData.map((stage, index) => (
          <div key={stage.stage}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-400">{stage.stage}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white">{stage.value}</span>
                {index > 0 && stage.value > 0 && (
                  <span className="text-xs text-gray-400">({stage.rate}%)</span>
                )}
              </div>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-[width] duration-500"
                style={{ width: `${stage.rate}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}