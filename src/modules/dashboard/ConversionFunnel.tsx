import React from 'react'
import { Card } from '../../ui'
import { Icons } from '../../icons'

const funnelData = [
  { stage: 'Clicks', value: 1234, rate: 100 },
  { stage: 'Leads', value: 456, rate: 37 },
  { stage: 'Citas', value: 123, rate: 27 },
  { stage: 'Ventas', value: 45, rate: 37 },
]

export function ConversionFunnel() {
  return (
    <Card variant="glass" className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Embudo de Conversión</h3>
        <Icons.filter className="w-4 h-4 text-gray-400" />
      </div>

      <div className="space-y-3">
        {funnelData.map((stage, index) => (
          <div key={stage.stage}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-400">{stage.stage}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white">{stage.value}</span>
                {index > 0 && (
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

      <div className="mt-4 pt-4 border-t border-white/10">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Tasa de conversión total</span>
          <span className="font-medium text-white">3.65%</span>
        </div>
      </div>
    </Card>
  )
}