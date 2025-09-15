import { useState, useEffect } from 'react'
import type { ImportJob } from '../types'
import { getApiUrl } from '../config/api'

export function useImportJobs() {
  const [jobs, setJobs] = useState<ImportJob[]>([])
  const [isPolling, setIsPolling] = useState(false)

  // Obtener todos los jobs activos
  const fetchJobs = async () => {
    try {
      const response = await fetch(getApiUrl('/import/async/jobs'))
      if (response.ok) {
        const data = await response.json()
        
        // Filtrar solo jobs en progreso o completados recientemente (últimos 5 segundos)
        const now = Date.now()
        const activeJobs = data.filter((job: ImportJob) => {
          if (job.status === 'processing') return true
          if (job.status === 'completed' || job.status === 'failed') {
            // Mantener jobs completados por 5 segundos antes de quitarlos
            const completedAt = job.completedAt ? new Date(job.completedAt).getTime() : now
            return (now - completedAt) < 5000
          }
          return false
        })
        
        setJobs(activeJobs)
        
        // Si hay jobs en progreso, seguir polling
        const hasActiveJobs = activeJobs.some((job: ImportJob) => job.status === 'processing')
        setIsPolling(hasActiveJobs || activeJobs.length > 0)
      }
    } catch (error) {
      console.error('Error fetching import jobs:', error)
    }
  }

  // Obtener estado de un job específico
  const fetchJobStatus = async (jobId: string): Promise<ImportJob | null> => {
    try {
      const response = await fetch(getApiUrl(`/import/async/status/${jobId}`))
      if (response.ok) {
        return await response.json()
      }
    } catch (error) {
      console.error('Error fetching job status:', error)
    }
    return null
  }

  // Iniciar nueva importación
  const startImport = async (data: any[], type: 'contacts' | 'payments' | 'appointments') => {
    try {
      const response = await fetch(getApiUrl('/import/async/start'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, type })
      })
      
      if (response.ok) {
        const result = await response.json()
        
        // Iniciar polling para este job
        setIsPolling(true)
        
        return result
      } else {
        const error = await response.json()
        throw new Error(error.message || 'Error al iniciar importación')
      }
    } catch (error) {
      console.error('Error starting import:', error)
      throw error
    }
  }

  // Polling para actualizar estado de jobs
  useEffect(() => {
    if (!isPolling) return

    const interval = setInterval(() => {
      fetchJobs()
    }, 2000) // Actualizar cada 2 segundos

    return () => clearInterval(interval)
  }, [isPolling])

  // Cargar jobs al montar y limpiar localStorage
  useEffect(() => {
    // Limpiar cualquier estado de importación previo del localStorage
    try {
      localStorage.removeItem('importJobs')
    } catch (e) {
      // Ignorar errores de localStorage
    }
    fetchJobs()
  }, [])

  return {
    jobs,
    startImport,
    fetchJobStatus,
    refreshJobs: fetchJobs
  }
}
