import React from 'react'
import { X, Rocket, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '../lib/utils'

export interface DeployToastProps {
  isOpen: boolean
  status: 'idle' | 'deploying' | 'success' | 'error'
  message: string
  logs?: string[]
  onClose: () => void
}

export function DeployToast({ isOpen, status, message, logs = [], onClose }: DeployToastProps) {
  if (!isOpen) return null

  const getStatusIcon = () => {
    switch (status) {
      case 'deploying':
        return <Loader2 className="h-5 w-5 text-primary animate-spin" />
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-success" />
      case 'error':
        return <AlertCircle className="h-5 w-5 text-error" />
      default:
        return <Rocket className="h-5 w-5 text-primary" />
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case 'deploying':
        return 'text-primary'
      case 'success':
        return 'text-success'
      case 'error':
        return 'text-error'
      default:
        return 'text-secondary'
    }
  }

  const getProgressWidth = () => {
    if (status === 'deploying') {
      // Animación de progreso indeterminado
      return 'w-2/3'
    }
    if (status === 'success') {
      return 'w-full'
    }
    return 'w-0'
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-2 fade-in duration-300">
      <div className="w-[420px] bg-secondary dark:glass rounded-xl overflow-hidden border border-primary dark:border-glassBorder shadow-2xl">
        {/* Header */}
        <div className="px-4 py-3 bg-tertiary dark:glass-subtle border-b border-primary dark:border-glassBorder">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getStatusIcon()}
              <div>
                <h3 className={cn("font-semibold text-sm", getStatusColor())}>
                  {status === 'deploying' && '🚀 Deployment en progreso'}
                  {status === 'success' && '✨ Deployment exitoso'}
                  {status === 'error' && '❌ Error en deployment'}
                  {status === 'idle' && 'Deployment'}
                </h3>
                <p className="text-xs text-tertiary mt-0.5">
                  {message}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-primary rounded-lg transition-all hover:scale-105"
            >
              <X className="h-4 w-4 text-tertiary hover:text-primary" />
            </button>
          </div>
        </div>

        {/* Logs section */}
        {logs.length > 0 && (
          <div className="px-4 py-3">
            <div className="bg-primary dark:glass-subtle rounded-lg p-3 max-h-32 overflow-y-auto custom-scrollbar border border-primary dark:border-transparent">
              <div className="space-y-1">
                {logs.slice(-8).map((log, i) => (
                  <div key={i} className="text-xs font-mono text-secondary leading-relaxed">
                    <span className="text-tertiary mr-2">›</span>
                    {log}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Progress bar */}
        {(status === 'deploying' || status === 'success') && (
          <div className="px-4 pb-3">
            <div className="h-1.5 bg-primary dark:glass-subtle rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full rounded-full transition-all duration-1000",
                  status === 'deploying' ? 'bg-gradient-to-r from-accent-blue via-accent-purple to-accent-blue animate-pulse' : 'bg-success',
                  getProgressWidth()
                )}
              />
            </div>
          </div>
        )}

        {/* Action buttons for error state */}
        {status === 'error' && (
          <div className="px-4 pb-3">
            <button 
              onClick={onClose}
              className="w-full py-2 bg-primary hover:bg-tertiary dark:glass-hover rounded-lg text-sm font-medium text-error dark:hover:glass-primary transition-all"
            >
              Cerrar y revisar logs
            </button>
          </div>
        )}
      </div>
    </div>
  )
}