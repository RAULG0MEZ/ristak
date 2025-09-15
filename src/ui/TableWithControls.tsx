import React, { useState, useMemo, useEffect } from 'react'
import { cn } from '../lib/utils'
import { Icons } from '../icons'
import { Button } from './Button'
import { Card } from './Card'
import { TabList } from './TabList'

interface Column {
  id: string
  label: string
  visible?: boolean
  width?: string
  align?: 'left' | 'center' | 'right'
  sortable?: boolean
  fixed?: boolean // Column cannot be reordered or hidden
  render?: (value: any, row: any) => React.ReactNode
}

interface FilterControl {
  type: 'search' | 'select' | 'custom'
  placeholder?: string
  options?: { value: string; label: string }[]
  value?: any
  onChange?: (value: any) => void
  component?: React.ReactNode
}

interface TableWithControlsProps {
  columns: Column[]
  data: any[]
  className?: string
  loading?: boolean
  emptyMessage?: string
  searchMessage?: string
  hasSearch?: boolean
  searchQuery?: string
  onSearchChange?: (query: string) => void
  filters?: FilterControl[]
  additionalControls?: React.ReactNode
  onColumnReorder?: (columns: Column[]) => void
  onColumnVisibilityChange?: (columns: Column[]) => void
  onSort?: (columnId: string, direction: 'asc' | 'desc' | null) => void
  sortColumn?: string | null
  sortDirection?: 'asc' | 'desc' | null
  title?: string
  actions?: React.ReactNode
}

export function TableWithControls({
  columns: initialColumns,
  data,
  className,
  loading = false,
  emptyMessage = 'No hay datos disponibles',
  searchMessage = 'No se encontraron resultados',
  hasSearch = true,
  searchQuery = '',
  onSearchChange,
  filters = [],
  additionalControls,
  onColumnReorder,
  onColumnVisibilityChange,
  onSort,
  sortColumn,
  sortDirection,
  title,
  actions
}: TableWithControlsProps) {
  const [columns, setColumns] = useState(() => initialColumns)
  const [editMode, setEditMode] = useState(false)
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)

  // Actualizar columnas cuando cambien significativamente (ej: se elimina o agrega una columna)
  useEffect(() => {
    setColumns(prev => {
      const prevIds = new Set(prev.map(c => c.id))
      const newIds = new Set(initialColumns.map(c => c.id))

      // Verificar si hay cambios en los IDs
      const hasRemovedColumns = [...prevIds].some(id => !newIds.has(id))
      const hasAddedColumns = [...newIds].some(id => !prevIds.has(id))

      if (hasRemovedColumns || hasAddedColumns) {

        // Crear un mapa de visibilidad actual
        const visibilityMap = new Map(prev.map(c => [c.id, c.visible]))

        // Usar las nuevas columnas pero preservar la visibilidad donde sea posible
        return initialColumns.map(col => ({
          ...col,
          visible: visibilityMap.has(col.id) ? visibilityMap.get(col.id) : col.visible
        }))
      }

      return prev
    })
  }, [initialColumns])

  // NO ACTUALIZAR automáticamente - dejar que el componente maneje su propio estado
  // Los cambios se notifican al padre via callbacks

  const handleDragStart = (e: React.DragEvent, columnId: string) => {
    if (!editMode) return
    setDraggedColumn(columnId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', columnId)
  }

  const handleDragOver = (e: React.DragEvent) => {
    if (!editMode || !draggedColumn) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDragEnd = () => {
    setDraggedColumn(null)
    setDragOverColumn(null)
  }

  const handleDragEnter = (e: React.DragEvent, columnId: string | 'hidden') => {
    if (!editMode || !draggedColumn) return
    e.preventDefault()
    setDragOverColumn(columnId)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    if (!editMode) return
    // Only clear if we're leaving the drop zone entirely
    const relatedTarget = e.relatedTarget as HTMLElement
    if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
      setDragOverColumn(null)
    }
  }

  // Sincronizar metadatos no persistentes cuando cambian en props,
  // preservando el estado local de visibilidad/orden. Ignoramos cambios de `render`
  // para evitar bucles de re-render por funciones recreadas en el padre.
  useEffect(() => {
    setColumns(prev => {
      const nextById = new Map(initialColumns.map(c => [c.id, c]))
      let changed = false
      const next = prev.map(col => {
        const incoming = nextById.get(col.id)
        if (!incoming) return col
        const updated = {
          ...col,
          label: incoming.label,
          align: incoming.align,
          width: incoming.width,
          sortable: incoming.sortable,
          fixed: incoming.fixed ?? col.fixed,
          // Actualizar visible desde props cuando cambie
          visible: incoming.visible !== undefined ? incoming.visible : col.visible
        }
        if (
          updated.label !== col.label ||
          updated.align !== col.align ||
          updated.width !== col.width ||
          updated.sortable !== col.sortable ||
          updated.fixed !== col.fixed ||
          updated.visible !== col.visible
        ) {
          changed = true
        }
        return updated
      })
      return changed ? next : prev
    })
  }, [initialColumns])

  const handleDrop = (e: React.DragEvent, targetColumnId: string | 'hidden') => {
    if (!editMode || !draggedColumn) return
    e.preventDefault()
    e.stopPropagation()

    const newColumns = [...columns]
    const draggedIndex = newColumns.findIndex(col => col.id === draggedColumn)
    const draggedCol = newColumns[draggedIndex]
    
    if (draggedIndex === -1 || draggedCol?.fixed) return

    if (targetColumnId === 'hidden') {
      // Hide the column (only if not fixed)
      if (!draggedCol.fixed) {
        newColumns[draggedIndex] = { ...draggedCol, visible: false }
      }
    } else if (targetColumnId === 'table') {
      // Show a hidden column
      newColumns[draggedIndex] = { ...draggedCol, visible: true }
    } else {
      const targetIndex = newColumns.findIndex(col => col.id === targetColumnId)
      const targetCol = newColumns[targetIndex]
      
      if (targetIndex === -1) {
        // Just make it visible
        newColumns[draggedIndex] = { ...draggedCol, visible: true }
      } else if (draggedIndex !== targetIndex && !targetCol?.fixed) {
        // Reorder columns only if target is not fixed
        const [removed] = newColumns.splice(draggedIndex, 1)
        
        // Find the correct insert position accounting for fixed columns
        let insertIndex = targetIndex
        if (draggedIndex < targetIndex) {
          insertIndex = targetIndex - 1
        }
        
        newColumns.splice(insertIndex, 0, removed)
        // Ensure the moved column is visible
        newColumns[insertIndex] = { ...newColumns[insertIndex], visible: true }
      }
    }
    
    setColumns(newColumns)
    onColumnReorder?.(newColumns)
    onColumnVisibilityChange?.(newColumns)
    
    setDraggedColumn(null)
    setDragOverColumn(null)
  }

  const handleDropOnHeader = (e: React.DragEvent, targetColumnId: string) => {
    handleDrop(e, targetColumnId)
  }

  const toggleColumnVisibility = (columnId: string) => {
    const newColumns = columns.map(col => 
      col.id === columnId ? { ...col, visible: !col.visible } : col
    )
    setColumns(newColumns)
    onColumnVisibilityChange?.(newColumns)
  }

  const handleSort = (columnId: string) => {
    let newDirection: 'asc' | 'desc' | null = 'asc'
    
    if (sortColumn === columnId) {
      if (sortDirection === 'asc') {
        newDirection = 'desc'
      } else if (sortDirection === 'desc') {
        newDirection = null
      } else {
        newDirection = 'asc'
      }
    }
    
    onSort?.(columnId, newDirection)
  }

  // Separate fixed and draggable columns
  const fixedColumns = columns.filter(col => col.fixed && col.visible !== false)
  const draggableColumns = columns.filter(col => !col.fixed)
  const visibleColumns = columns.filter(col => col.visible !== false)
  const hiddenColumns = draggableColumns.filter(col => col.visible === false)
  const visibleDraggableColumns = draggableColumns.filter(col => col.visible !== false)


  return (
    <div className="space-y-4">
      {/* Barra de controles */}
      <Card variant="glass" className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            {/* Acciones personalizadas */}
            {actions}
            
            {/* Búsqueda */}
            {hasSearch && (
              <div className="relative flex-1 max-w-md">
                <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={searchQuery}
                  onChange={(e) => onSearchChange?.(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 glass border border-primary rounded-xl text-primary placeholder:text-tertiary focus-ring-accent transition-colors"
                />
              </div>
            )}
            
            {/* Filtros */}
            {filters.map((filter, index) => (
              <div key={index}>
                {filter.type === 'custom' ? (
                  filter.component
                ) : filter.type === 'select' && filter.options ? (
                  <TabList
                    tabs={filter.options}
                    value={filter.value || ''}
                    onChange={(value) => filter.onChange?.(value)}
                  />
                ) : null}
              </div>
            ))}

            {/* Controles adicionales */}
            {additionalControls}
          </div>
          
          {/* Edit Mode Toggle */}
          <Button
            variant={editMode ? "primary" : "ghost"}
            size="sm"
            onClick={() => setEditMode(!editMode)}
            className="flex items-center gap-2"
          >
            {editMode ? (
              <>
                <Icons.check className="w-4 h-4" />
                Listo
              </>
            ) : (
              <>
                <Icons.settings className="w-4 h-4" />
                Editar columnas
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Tabla con modo edición */}
      <Card variant="glass" noPadding>
        <div className="relative w-full overflow-auto">
          <table className={cn("w-full caption-bottom text-sm", className)}>
            <thead>
              {/* Fila de columnas ocultas - visible en modo edición (aunque esté vacía) */}
              {editMode && (
                <tr className="border-b border-primary bg-[var(--color-background-glass)]">
                  <td 
                    colSpan={visibleColumns.length || 1}
                    className="p-4"
                    onDragOver={handleDragOver}
                    onDragEnter={(e) => handleDragEnter(e, 'hidden')}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, 'hidden')}
                  >
                    <div className={cn(
                      "flex items-center gap-3 min-h-[40px] rounded-lg p-2 transition-all",
                      dragOverColumn === 'hidden' && draggedColumn && "bg-error-10 border-2 border-dashed border-error-20"
                    )}>
                      <span className="text-xs text-secondary font-medium">
                        Columnas ocultas:
                      </span>
                      <div className="flex flex-wrap gap-2 flex-1">
                        {hiddenColumns.length === 0 ? (
                          <span className="text-xs text-tertiary">(ninguna) Arrastra aquí para ocultar</span>
                        ) : (
                          hiddenColumns.map(column => (
                            <div
                              key={column.id}
                              draggable={!column.fixed && editMode}
                              onDragStart={(e) => !column.fixed && handleDragStart(e, column.id)}
                              onDragEnd={handleDragEnd}
                              className={cn(
                                "px-3 py-1.5 glass rounded-lg",
                                "text-xs text-secondary glass-hover transition-all",
                                "flex items-center gap-2",
                                !column.fixed && "cursor-move",
                                column.fixed && "opacity-50 cursor-not-allowed",
                                draggedColumn === column.id && "opacity-50 scale-105 shadow-lg"
                              )}
                              onClick={() => !draggedColumn && !column.fixed && toggleColumnVisibility(column.id)}
                            >
                              {!column.fixed && <Icons.grip className="w-3 h-3" />}
                              {column.label}
                              {column.fixed && <span className="text-xs ml-1">(fijo)</span>}
                            </div>
                          ))
                        )}
                      </div>
                      {dragOverColumn === 'hidden' && draggedColumn && (
                        <div className="text-xs text-error animate-pulse">
                          ← Suelta aquí para ocultar
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )}

              {/* Si no hay columnas visibles pero hay modo edición, mostrar mensaje */}
              {editMode && visibleColumns.length === 0 && (
                <tr className="border-b border-primary">
                  <td 
                    className={cn(
                      "p-8 text-center text-secondary text-sm transition-all",
                      dragOverColumn === 'table' && "bg-info-10 border-2 border-dashed border-info-20"
                    )}
                    onDragOver={handleDragOver}
                    onDragEnter={(e) => handleDragEnter(e, 'table')}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => {
                      if (!draggedColumn) return
                      e.preventDefault()
                      const newColumns = columns.map(col => 
                        col.id === draggedColumn ? { ...col, visible: true } : col
                      )
                      setColumns(newColumns)
                      onColumnVisibilityChange?.(newColumns)
                      setDraggedColumn(null)
                      setDragOverColumn(null)
                    }}
                  >
                    {dragOverColumn === 'table' && draggedColumn ? (
                      <div className="text-info animate-pulse">
                        Suelta aquí para mostrar la columna
                      </div>
                    ) : (
                      "Todas las columnas están ocultas. Arrastra columnas desde arriba para mostrarlas."
                    )}
                  </td>
                </tr>
              )}
              
              {/* Headers normales */}
              {visibleColumns.length > 0 && (
                <tr className="border-b border-primary">
                  {visibleColumns.map(column => (
                    <th
                      key={column.id}
                      draggable={!column.fixed && editMode}
                      onDragStart={(e) => !column.fixed && handleDragStart(e, column.id)}
                      onDragEnd={handleDragEnd}
                      onDragOver={!column.fixed ? handleDragOver : undefined}
                      onDragEnter={(e) => !column.fixed && handleDragEnter(e, column.id)}
                      onDragLeave={!column.fixed ? handleDragLeave : undefined}
                      onDrop={(e) => !column.fixed && handleDropOnHeader(e, column.id)}
                      className={cn(
                        "h-12 px-4 text-left align-middle font-medium text-tertiary relative",
                        column.align === 'center' && 'text-center',
                        column.align === 'right' && 'text-right',
                        editMode && !column.fixed && "cursor-move glass-hover transition-all",
                        editMode && column.fixed && "opacity-75",
                        draggedColumn === column.id && "opacity-50",
                        dragOverColumn === column.id && draggedColumn && draggedColumn !== column.id && !column.fixed && "bg-info-10"
                      )}
                      style={{ width: column.width }}
                    >
                      {dragOverColumn === column.id && draggedColumn && draggedColumn !== column.id && !column.fixed && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--color-status-info)] animate-pulse" />
                      )}
                      <div className={cn(
                        "flex items-center gap-2",
                        column.align === 'center' && 'justify-center',
                        column.align === 'right' && 'justify-end'
                      )}>
                        {editMode && !column.fixed && (
                          <Icons.grip className={cn(
                            "w-3 h-3 text-secondary",
                            draggedColumn === column.id && "text-info"
                          )} />
                        )}
                        <span className={draggedColumn === column.id ? "text-info" : ""}>{column.label}</span>
                        {editMode && !column.fixed && (
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleColumnVisibility(column.id) }}
                            className="p-1 glass-hover rounded"
                            title="Ocultar columna"
                            aria-label={`Ocultar columna ${column.label}`}
                          >
                            <Icons.x className="w-3 h-3 text-secondary" />
                          </button>
                        )}
                        {!editMode && column.sortable !== false && (
                          <button
                            onClick={() => handleSort(column.id)}
                            className="p-1 glass-hover rounded transition-colors"
                          >
                            {sortColumn === column.id ? (
                              sortDirection === 'asc' ? (
                                <Icons.chevronUp className="w-3 h-3 text-info" />
                              ) : sortDirection === 'desc' ? (
                                <Icons.chevronDown className="w-3 h-3 text-info" />
                              ) : (
                                <Icons.arrowUpDown className="w-3 h-3 opacity-50" />
                              )
                            ) : (
                              <Icons.arrowUpDown className="w-3 h-3 opacity-50" />
                            )}
                          </button>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              )}
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    {(visibleColumns.length > 0 ? visibleColumns : [{ id: 'dummy' }]).map((col, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 rounded animate-pulse bg-[var(--color-background-glass)]" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length || 1} className="text-center py-8 text-secondary">
                    {hasSearch && searchQuery ? searchMessage : emptyMessage}
                  </td>
                </tr>
              ) : visibleColumns.length === 0 ? (
                <tr>
                  <td className="text-center py-8 text-secondary">
                    Activa el modo edición y muestra algunas columnas para ver los datos
                  </td>
                </tr>
              ) : (
                data.map((row, i) => (
                  <tr key={i} className="border-b border-primary glass-hover">
                    {visibleColumns.map(column => (
                      <td
                        key={column.id}
                        className={cn(
                          "px-4 py-3 text-secondary",
                          column.align === 'center' && 'text-center',
                          column.align === 'right' && 'text-right'
                        )}
                      >
                        {column.render ? column.render(row[column.id], row) : row[column.id]}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
