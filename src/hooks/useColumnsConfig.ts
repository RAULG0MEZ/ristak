import { useState, useCallback, useEffect } from 'react'

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
  // Este hook SOLO guarda configuración de orden y visibilidad
  // Las columnas con sus renders vienen frescas del componente padre

  // Cargar solo orden y visibilidad desde localStorage
  const loadConfig = useCallback((): ColumnConfig[] => {
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as ColumnConfig[]
        return parsed
      } catch (e) {
        console.error('Error loading columns config:', e)
        return []
      }
    }
    return []
  }, [storageKey])

  const [savedConfig, setSavedConfig] = useState<ColumnConfig[]>(() => loadConfig())

  // Guardar solo orden y visibilidad en localStorage
  const saveConfig = useCallback((config: ColumnConfig[]) => {
    localStorage.setItem(storageKey, JSON.stringify(config))
    setSavedConfig(config)
  }, [storageKey])

  // Aplicar configuración guardada a las columnas frescas del padre
  const configuredColumns = useCallback((): Column[] => {
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
  }, [columns, savedConfig])

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
  const resetColumns = useCallback(() => {
    localStorage.removeItem(storageKey)
    setSavedConfig([])
  }, [storageKey])

  return {
    columns: configuredColumns(),
    handleColumnReorder,
    handleColumnVisibilityChange,
    resetColumns
  }
}
