import { useState, useCallback, useMemo, useEffect } from 'react'
import { useSubaccount } from '../contexts/SubaccountContext'

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

export function useColumnsConfig(storageKey: string, defaultColumns: Column[]) {
  // Usar las columnas por defecto provistas por el padre.
  // No fijarlas con deps vacías para que los render se mantengan actualizados.
  const memoizedDefaultColumns = useMemo(() => defaultColumns, [defaultColumns])
  const { getTablePreferences, updateTablePreferences } = useSubaccount()
  
  // Cargar configuración guardada (primero desde backend, fallback a localStorage)
  const loadConfig = useCallback(() => {
    // Primero intentar cargar desde el backend
    const backendPrefs = getTablePreferences(storageKey)
    if (backendPrefs && backendPrefs.columnOrder) {
      try {
        const defaultColumnsMap = new Map(memoizedDefaultColumns.map(col => [col.id, col]))
        
        // Reconstruir columnas desde las preferencias del backend
        const orderedColumns = backendPrefs.columnOrder.map((colId: string) => {
          const defaultCol = defaultColumnsMap.get(colId)
          if (!defaultCol) return null
          
          return {
            ...defaultCol,
            visible: defaultCol.alwaysVisible ? true : (backendPrefs.visibleColumns?.includes(colId) ?? defaultCol.visible)
          }
        }).filter(Boolean)
        
        // Agregar columnas nuevas que no estén en las preferencias
        memoizedDefaultColumns.forEach(col => {
          if (!backendPrefs.columnOrder.includes(col.id)) {
            orderedColumns.push(col)
          }
        })
        
        return orderedColumns
      } catch (e) {
        console.error('Error loading columns from backend:', e)
      }
    }
    
    // Fallback a localStorage
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        // Crear un mapa de columnas por defecto para acceso rápido
        const defaultColumnsMap = new Map(memoizedDefaultColumns.map(col => [col.id, col]))
        
        // Reconstruir columnas preservando render y otras funciones
        const orderedColumns = parsed.map((savedCol: any) => {
          const defaultCol = defaultColumnsMap.get(savedCol.id)
          if (!defaultCol) return null
          
          return {
            ...defaultCol, // Esto preserva render y todas las propiedades originales
            visible: defaultCol.alwaysVisible ? true : (savedCol.visible !== undefined ? savedCol.visible : defaultCol.visible)
          }
        }).filter(Boolean)
        
        // Agregar columnas nuevas que no estén en el localStorage
        memoizedDefaultColumns.forEach(col => {
          if (!parsed.find((c: any) => c.id === col.id)) {
            orderedColumns.push(col)
          }
        })
        
        return orderedColumns
      } catch (e) {
        console.error('Error loading columns config:', e)
        return memoizedDefaultColumns
      }
    }
    return memoizedDefaultColumns
  }, [storageKey, memoizedDefaultColumns, getTablePreferences])

  const [columns, setColumns] = useState<Column[]>(() => loadConfig())

  // Guardar configuración (tanto en backend como localStorage)
  const saveConfig = useCallback(async (newColumns: Column[]) => {
    const columnOrder = newColumns.map(c => c.id)
    const visibleColumns = newColumns.filter(c => c.visible !== false).map(c => c.id)
    
    // Guardar en backend
    try {
      await updateTablePreferences(storageKey, {
        columnOrder,
        visibleColumns
      })
    } catch (error) {
      console.error('Error saving to backend:', error)
    }
    
    // Guardar en localStorage como fallback
    const toSave = newColumns.map((c, index) => ({
      id: c.id,
      visible: c.visible,
      order: index
    }))
    localStorage.setItem(storageKey, JSON.stringify(toSave))
  }, [storageKey, updateTablePreferences])

  // Manejar reordenamiento
  const handleColumnReorder = useCallback((newColumns: Column[]) => {
    // Asegurar que preservamos las funciones render
    const columnsWithRender = newColumns.map(col => {
      const original = memoizedDefaultColumns.find(dc => dc.id === col.id)
      return original ? { ...col, render: original.render } : col
    })
    setColumns(columnsWithRender)
    saveConfig(columnsWithRender)
  }, [saveConfig, memoizedDefaultColumns])

  // Manejar cambio de visibilidad
  const handleColumnVisibilityChange = useCallback((newColumns: Column[]) => {
    // Asegurar que preservamos las funciones render y respetamos alwaysVisible
    const columnsWithRender = newColumns.map(col => {
      const original = memoizedDefaultColumns.find(dc => dc.id === col.id)
      if (original) {
        // Si la columna tiene alwaysVisible, siempre debe estar visible
        if (original.alwaysVisible) {
          return { ...col, render: original.render, visible: true, alwaysVisible: true }
        }
        return { ...col, render: original.render }
      }
      return col
    })
    setColumns(columnsWithRender)
    saveConfig(columnsWithRender)
  }, [saveConfig, memoizedDefaultColumns])

  // Reset a configuración por defecto
  const resetColumns = useCallback(async () => {
    // Limpiar en backend
    try {
      await updateTablePreferences(storageKey, {
        columnOrder: memoizedDefaultColumns.map(c => c.id),
        visibleColumns: memoizedDefaultColumns.filter(c => c.visible !== false).map(c => c.id)
      })
    } catch (error) {
      console.error('Error resetting in backend:', error)
    }
    
    // Limpiar localStorage
    localStorage.removeItem(storageKey)
    setColumns(memoizedDefaultColumns)
  }, [storageKey, memoizedDefaultColumns, updateTablePreferences])

  // Sincronizar metadatos no persistentes (label/align/width/sortable/fixed)
  // cuando cambien en las columnas por defecto. Ignoramos `render` para
  // evitar bucles si el padre recrea funciones en cada render.
  const defaultMetaKey = useMemo(() => {
    try {
      return JSON.stringify(
        memoizedDefaultColumns.map(c => ({
          id: c.id,
          label: c.label,
          align: c.align,
          width: c.width,
          sortable: c.sortable,
          fixed: c.fixed,
        }))
      )
    } catch {
      return String(Date.now())
    }
  }, [memoizedDefaultColumns])

  useEffect(() => {
    setColumns(prev => {
      const byId = new Map(memoizedDefaultColumns.map(c => [c.id, c]))
      let changed = false
      const next = prev.map(col => {
        const incoming = byId.get(col.id)
        if (!incoming) return col
        const updated = {
          ...col,
          label: incoming.label,
          align: incoming.align,
          width: incoming.width,
          sortable: incoming.sortable,
          fixed: incoming.fixed ?? col.fixed,
        }
        if (
          updated.label !== col.label ||
          updated.align !== col.align ||
          updated.width !== col.width ||
          updated.sortable !== col.sortable ||
          updated.fixed !== col.fixed
        ) {
          changed = true
        }
        return updated
      })
      return changed ? next : prev
    })
  }, [defaultMetaKey, memoizedDefaultColumns])

  return {
    columns,
    handleColumnReorder,
    handleColumnVisibilityChange,
    resetColumns
  }
}
