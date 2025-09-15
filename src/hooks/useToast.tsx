import { useState, useCallback, createContext, useContext, ReactNode } from 'react'
import type { ToastProps } from '../ui/Toast'
import { ToastManager } from '../ui/Toast'

interface ToastContextValue {
  toast: (type: ToastProps['type'], title: string, message?: string, duration?: number) => void
  toasts: ToastProps[]
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastProps[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  const toast = useCallback((
    type: ToastProps['type'],
    title: string,
    message?: string,
    duration: number = 5000
  ) => {
    const id = Math.random().toString(36).substring(2, 9)
    const newToast: ToastProps = {
      id,
      type,
      title,
      message,
      duration
    }
    
    setToasts(prev => [...prev, newToast])
  }, [])

  return (
    <ToastContext.Provider value={{ toast, toasts }}>
      {children}
      <ToastManager toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

// Convenience methods
export function useToastActions() {
  const { toast } = useToast()
  
  return {
    success: (title: string, message?: string, duration?: number) => 
      toast('success', title, message, duration),
    error: (title: string, message?: string, duration?: number) => 
      toast('error', title, message, duration),
    warning: (title: string, message?: string, duration?: number) => 
      toast('warning', title, message, duration),
    info: (title: string, message?: string, duration?: number) => 
      toast('info', title, message, duration),
  }
}