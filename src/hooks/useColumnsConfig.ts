import { useState, useCallback, useEffect } from 'react'
import { getApiUrl, fetchWithAuth } from '../config/api'

// Este hook SOLO maneja orden y visibilidad de columnas
// NO debe cachear funciones render ni otros datos que cambien
interface ColumnConfig {
  id: string
  visible: boolean
  order: number
}

interface Column {
  id: string
  label: string | React.ReactNode
  visible?: boolean
  width?: string
  align?: 'left' | 'center' | 'right'
  sortable?: boolean
  fixed?: boolean
  alwaysVisible?: boolean
  render?: (value: any, row: any) => React.ReactNode
}

export function useColumnsConfig(storageKey: string, columns: Column[]) {
  // Este hook usa la nueva columna table_preferences de la DB
  // Usa localStorage como caché temporal para respuesta rápida
  const [savedConfig, setSavedConfig] = useState<ColumnConfig[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Cargar configuración desde la API al inicio
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        // Primero cargar desde localStorage como caché rápido
        const cached = localStorage.getItem(storageKey)
        if (cached) {
          try {
            const parsed = JSON.parse(cached) as ColumnConfig[]
            setSavedConfig(parsed)
          } catch {}
        }

        // Luego sincronizar con la DB
        const response = await fetchWithAuth(getApiUrl('/settings/preferences'))
        if (response.ok) {
          const data = await response.json()
          const tablePrefs = data?.data?.[storageKey]
          if (tablePrefs && Array.isArray(tablePrefs)) {
            setSavedConfig(tablePrefs)
            // Actualizar caché local
            localStorage.setItem(storageKey, JSON.stringify(tablePrefs))
          }
        }
      } catch (error) {
        console.error('Error loading table preferences:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadPreferences()
  }, [storageKey])

  // Guardar en DB y localStorage
  const saveConfig = useCallback(async (config: ColumnConfig[]) => {
    // Guardar inmediatamente en localStorage para respuesta instantánea
    localStorage.setItem(storageKey, JSON.stringify(config))
    setSavedConfig(config)

    // Luego sincronizar con la DB (nueva columna table_preferences)
    try {
      await fetchWithAuth(getApiUrl(`/settings/preferences/${storageKey}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      })
    } catch (error) {
      console.error('Error saving table preferences to DB:', error)
      // El localStorage ya tiene los cambios, así que el usuario no pierde nada
    }
  }, [storageKey])

  // Aplicar configuración guardada a las columnas frescas del padre
  // IMPORTANTE: Siempre usar las columnas frescas con sus funciones render actualizadas
  const configuredColumns = (): Column[] => {
    if (savedConfig.length === 0) {
      return columns
    }

    // Crear mapa para acceso rápido
    const columnsMap = new Map(columns.map(col => [col.id, col]))
    const result: Column[] = []

    // Primero agregar en el orden guardado
    savedConfig.forEach(config => {
      const col = columnsMap.get(config.id)
      if (col) {
        result.push({
          ...col,
          visible: col.alwaysVisible ? true : config.visible
        })
      }
    })

    // Agregar columnas nuevas que no están en la config guardada
    columns.forEach(col => {
      if (!savedConfig.find(c => c.id === col.id)) {
        result.push(col)
      }
    })

    return result
  }

  // Manejar reordenamiento
  const handleColumnReorder = useCallback((newColumns: Column[]) => {
    const newConfig = newColumns.map((col, index) => ({
      id: col.id,
      visible: col.visible !== false,
      order: index
    }))
    saveConfig(newConfig)
  }, [saveConfig])

  // Manejar cambio de visibilidad
  const handleColumnVisibilityChange = useCallback((newColumns: Column[]) => {
    const newConfig = newColumns.map((col, index) => ({
      id: col.id,
      visible: col.alwaysVisible ? true : (col.visible !== false),
      order: index
    }))
    saveConfig(newConfig)
  }, [saveConfig])

  // Reset a configuración por defecto
  const resetColumns = useCallback(async () => {
    localStorage.removeItem(storageKey)
    setSavedConfig([])

    // También limpiar en la DB
    try {
      await fetchWithAuth(getApiUrl(`/settings/preferences/${storageKey}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([])
      })
    } catch (error) {
      console.error('Error resetting table preferences:', error)
    }
  }, [storageKey])

  return {
    columns: configuredColumns(),
    handleColumnReorder,
    handleColumnVisibilityChange,
    resetColumns,
    isLoading
  }
}
