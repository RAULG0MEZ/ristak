import React, { useEffect } from 'react'
import { cn } from '../lib/utils'
import { Icons } from '../icons'

export interface ToastProps {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  title: string
  message?: string
  duration?: number
  onClose?: (id: string) => void
}

export function Toast({ 
  id, 
  type, 
  title, 
  message, 
  duration = 5000, 
  onClose 
}: ToastProps) {
  useEffect(() => {
    if (duration > 0 && onClose) {
      const timer = setTimeout(() => {
        onClose(id)
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [id, duration, onClose])

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <Icons.checkCircle className="w-5 h-5 text-success" />
      case 'error':
        return <Icons.alertCircle className="w-5 h-5 text-error" />
      case 'warning':
        return <Icons.alertCircle className="w-5 h-5 text-warning" />
      default:
        return <Icons.info className="w-5 h-5 text-info" />
    }
  }

  const getColors = () => {
    switch (type) {
      case 'success':
        return 'bg-success/10 border-success/20'
      case 'error':
        return 'bg-error/10 border-error/20'
      case 'warning':
        return 'bg-warning/10 border-warning/20'
      default:
        return 'bg-info/10 border-info/20'
    }
  }

  return (
    <div
      className={cn(
        "glass glass-shadow rounded-lg border p-4 animate-in slide-in-from-right duration-300",
        getColors()
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {getIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-primary">{title}</p>
          {message && (
            <p className="text-sm text-secondary mt-1">{message}</p>
          )}
        </div>
        {onClose && (
          <button
            onClick={() => onClose(id)}
            className="flex-shrink-0 text-tertiary hover:text-primary transition-colors"
          >
            <Icons.x className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}

interface ToastManagerProps {
  toasts: ToastProps[]
  onRemove: (id: string) => void
}

export function ToastManager({ toasts, onRemove }: ToastManagerProps) {
  return (
    <div className="fixed top-0 right-0 z-50 pointer-events-none">
      <div className="flex flex-col gap-2 p-4 pointer-events-auto">
        {toasts.map((toast, index) => (
          <div
            key={toast.id}
            style={{
              transform: `translateY(${index * 8}px)`,
              opacity: index > 2 ? 0.8 : 1,
            }}
          >
            <Toast
              {...toast}
              onClose={onRemove}
            />
          </div>
        ))}
      </div>
    </div>
  )
}