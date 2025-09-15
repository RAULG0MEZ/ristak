import React from 'react'
import { Icons } from '../icons'
import { Card } from './Card'
import type { ImportJob } from '../types'

interface ImportProgressProps {
  jobs: ImportJob[]
}

export function ImportProgress({ jobs }: ImportProgressProps) {
  if (jobs.length === 0) return null

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'contacts': return 'Contactos'
      case 'payments': return 'Pagos'
      case 'appointments': return 'Citas'
      default: return type
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processing':
        return <Icons.refresh className="w-4 h-4 text-accent-blue animate-spin" />
      case 'completed':
        return <Icons.check className="w-4 h-4 text-success" />
      case 'failed':
        return <Icons.x className="w-4 h-4 text-error" />
      default:
        return null
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processing': return 'text-accent-blue'
      case 'completed': return 'text-success'
      case 'failed': return 'text-error'
      default: return 'text-secondary'
    }
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-primary flex items-center gap-2">
        <Icons.download className="w-4 h-4" />
        Importaciones en Progreso
      </h4>
      
      {jobs.map(job => (
        <Card key={job.id} variant="default" className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {getStatusIcon(job.status)}
              <span className="text-sm font-medium text-primary">
                {getTypeLabel(job.type)}
              </span>
            </div>
            <span className={`text-xs ${getStatusColor(job.status)}`}>
              {job.processed} / {job.total}
            </span>
          </div>
          
          {/* Barra de progreso */}
          <div className="relative w-full h-2 bg-secondary rounded-full overflow-hidden">
            <div 
              className={`absolute left-0 top-0 h-full transition-all duration-300 ${
                job.status === 'completed' ? 'bg-success' :
                job.status === 'failed' ? 'bg-error' :
                'bg-accent-blue'
              }`}
              style={{ width: `${job.progress}%` }}
            />
          </div>
          
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-secondary">
              {job.progress}% completado
            </span>
            {job.status === 'processing' && (
              <span className="text-xs text-secondary">
                {job.successful > 0 && `✓ ${job.successful}`}
                {job.failed > 0 && ` ✗ ${job.failed}`}
              </span>
            )}
            {job.status === 'completed' && (
              <span className="text-xs text-success">
                ✓ {job.successful} importados
                {job.failed > 0 && `, ${job.failed} errores`}
              </span>
            )}
          </div>
        </Card>
      ))}
    </div>
  )
}
