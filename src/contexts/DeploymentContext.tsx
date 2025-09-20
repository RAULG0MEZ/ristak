import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { getApiUrl } from '../config/api'

interface DeploymentContextType {
  isDeploying: boolean
  deployStatus: 'idle' | 'deploying' | 'success' | 'error'
  deployMessage: string
  deployLogs: string[]
  showToast: boolean
  startDeployment: () => void
  hideToast: () => void
}

const DeploymentContext = createContext<DeploymentContextType | undefined>(undefined)

export function DeploymentProvider({ children }: { children: React.ReactNode }) {
  const [isDeploying, setIsDeploying] = useState(false)
  const [deployStatus, setDeployStatus] = useState<'idle' | 'deploying' | 'success' | 'error'>('idle')
  const [deployMessage, setDeployMessage] = useState('')
  const [deployLogs, setDeployLogs] = useState<string[]>([])
  const [showToast, setShowToast] = useState(false)

  const hideToast = useCallback(() => {
    setShowToast(false)
  }, [])

  const startDeployment = useCallback(async () => {
    if (isDeploying) return

    setIsDeploying(true)
    setDeployStatus('deploying')
    setDeployMessage('Iniciando deployment...')
    setDeployLogs([])
    setShowToast(true)

    try {
      const es = new EventSource(getApiUrl('/deploy/stream'))

      es.onmessage = (ev) => {
        const text = ev.data
        setDeployLogs((prev) => [...prev.slice(-50), text])
        // Update message based on key lines
        if (text.includes('DEPLOYMENT SUCCESSFUL')) {
          setDeployMessage('Deployment completado. Reiniciando servicios...')
        } else if (text.toLowerCase().includes('error')) {
          setDeployMessage('Procesando… (revisa los logs)')
        }
      }

      es.addEventListener('done', (ev: MessageEvent) => {
        try {
          const payload = JSON.parse(ev.data || '{}') as { success?: boolean; code?: number }
          if (payload.success) {
            setDeployStatus('success')
            setDeployMessage('Tu aplicación se ha desplegado correctamente')
          } else {
            setDeployStatus('error')
            setDeployMessage('El deployment finalizó con errores')
          }
        } catch {
          setDeployStatus('error')
          setDeployMessage('El deployment finalizó (no se pudo leer el resultado)')
        } finally {
          es.close()
          setIsDeploying(false)
        }
      })

      es.onerror = () => {
        setDeployStatus('error')
        setDeployMessage('Error de conexión con el stream de deployment')
        setDeployLogs((prev) => [...prev, '[error] Conexión interrumpida'])
        es.close()
        setIsDeploying(false)
      }
    } catch (error) {
      setDeployStatus('error')
      setDeployMessage('Error al iniciar el deployment')
      setDeployLogs((prev) => [...prev, String(error)])
      setIsDeploying(false)
    }
  }, [isDeploying])

  useEffect(() => {
    if (deployStatus !== 'success') return

    const timer = setTimeout(() => {
      setShowToast(false)
    }, 5000)

    return () => clearTimeout(timer)
  }, [deployStatus])

  return (
    <DeploymentContext.Provider value={{
      isDeploying,
      deployStatus,
      deployMessage,
      deployLogs,
      showToast,
      startDeployment,
      hideToast
    }}>
      {children}
    </DeploymentContext.Provider>
  )
}

export function useDeployment() {
  const context = useContext(DeploymentContext)
  if (!context) {
    throw new Error('useDeployment must be used within DeploymentProvider')
  }
  return context
}
