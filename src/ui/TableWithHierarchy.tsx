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
  fixed?: boolean
  render?: (value: any, row: any, level?: number) => React.ReactNode
}

interface FilterControl {
  type: 'search' | 'select' | 'custom'
  placeholder?: string
  options?: { value: string; label: string }[]
  value?: any
  onChange?: (value: any) => void
  component?: React.ReactNode
}

interface HierarchyLevel {
  data: any
  children?: HierarchyLevel[]
  expanded?: boolean
}

interface TableWithHierarchyProps {
  columns: Column[]
  data: HierarchyLevel[]
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
  expandedRows?: Set<string>
  onToggleExpand?: (id: string) => void
  getRowId: (row: any) => string
  renderExpandIcon?: (expanded: boolean, level: number) => React.ReactNode
}

export function TableWithHierarchy({
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
  actions,
  expandedRows = new Set(),
  onToggleExpand,
  getRowId,
  renderExpandIcon
}: TableWithHierarchyProps) {
  const [columns, setColumns] = useState(() => initialColumns)
  const [editMode, setEditMode] = useState(false)
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)

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
    const relatedTarget = e.relatedTarget as HTMLElement
    if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
      setDragOverColumn(null)
    }
  }

  useEffect(() => {
    setColumns(prev => {
      const nextById = new Map(initialColumns.map(c => [c.id, c]))
      let changed = false
      const next = prev.map(col => {
        const incoming = nextById.get(col.id)
        if (!incoming) return col
        const updated = {
          ...col,
          render: incoming.render,
          label: incoming.label,
          align: incoming.align,
          width: incoming.width,
          sortable: incoming.sortable,
          fixed: incoming.fixed ?? col.fixed,
        }
        if (
          updated.render !== col.render ||
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
      if (!draggedCol.fixed) {
        newColumns[draggedIndex] = { ...draggedCol, visible: false }
      }
    } else if (targetColumnId === 'table') {
      newColumns[draggedIndex] = { ...draggedCol, visible: true }
    } else {
      const targetIndex = newColumns.findIndex(col => col.id === targetColumnId)
      const targetCol = newColumns[targetIndex]
      
      if (targetIndex === -1) {
        newColumns[draggedIndex] = { ...draggedCol, visible: true }
      } else if (draggedIndex !== targetIndex && !targetCol?.fixed) {
        const [removed] = newColumns.splice(draggedIndex, 1)
        
        let insertIndex = targetIndex
        if (draggedIndex < targetIndex) {
          insertIndex = targetIndex - 1
        }
        
        newColumns.splice(insertIndex, 0, removed)
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

  const visibleColumns = columns.filter(col => col.visible !== false)
  const hiddenColumns = columns.filter(col => !col.fixed && col.visible === false)

  // Función recursiva para renderizar filas con jerarquía
  const renderRows = (items: HierarchyLevel[], level: number = 0, parentContext: { isLastChild: boolean }[] = []): React.ReactNode[] => {
    const rows: React.ReactNode[] = []
    
    items.forEach((item, index) => {
      const rowId = getRowId(item.data)
      const isExpanded = expandedRows.has(rowId)
      const hasChildren = item.children && item.children.length > 0
      const isLastChild = index === items.length - 1
      
      rows.push(
        <tr key={`${level}-${rowId}`} className={cn(
          "border-b border-primary transition-colors",
          level === 0 && "hover:bg-white/[0.02]",
          level === 1 && "hover:bg-white/[0.03] bg-white/[0.005]",
          level === 2 && "hover:bg-white/[0.04] bg-white/[0.01]"
        )}>
          {visibleColumns.map((column, colIndex) => (
            <td
              key={column.id}
              className={cn(
                "px-4 py-3 text-secondary",
                column.align === 'center' && 'text-center',
                column.align === 'right' && 'text-right'
              )}
            >
              {colIndex === 0 && (
                <div className="flex items-center relative">
                  {/* Indentación base por nivel */}
                  <div style={{ paddingLeft: `${level * 24}px` }} className="flex items-center">
                    {/* Conector tipo árbol */}
                    {level > 0 && (
                      <div className="mr-0.5">
                        <div className="relative w-4 h-6">
                          {/* L perfecta */}
                          <div className="absolute left-0 top-0 border-l-2 border-b-2 border-gray-400 rounded-bl w-4 h-3"></div>
                          {/* Flecha para anuncios (nivel 2) */}
                          {level === 2 && (
                            <Icons.chevronRight className="absolute w-4 h-4 text-gray-400" style={{ left: '13px', top: '4.5px' }} />
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Ícono de expansión */}
                    {hasChildren && (
                      <button
                        onClick={() => onToggleExpand?.(rowId)}
                        className="p-1 glass-hover rounded-lg transition-all mr-2"
                      >
                        {renderExpandIcon ? (
                          renderExpandIcon(isExpanded, level)
                        ) : (
                          <Icons.chevronRight 
                            className={cn(
                              "w-4 h-4 text-secondary transition-transform",
                              isExpanded && "rotate-90"
                            )}
                          />
                        )}
                      </button>
                    )}
                    {!hasChildren && level !== 2 && (
                      <div className="w-6 mr-2" />
                    )}
                    {!hasChildren && level === 2 && (
                      <div className="w-3" />
                    )}
                    
                    {/* Contenido de la celda */}
                    <span className={cn(
                      level === 0 && "font-medium text-primary",
                      level === 1 && "text-sm text-secondary", 
                      level === 2 && "text-sm text-secondary"
                    )}>
                      {column.render 
                        ? column.render(item.data[column.id], item.data, level) 
                        : item.data[column.id]}
                    </span>
                  </div>
                </div>
              )}
              {colIndex > 0 && (
                // Si la fila tiene hijos y está expandida, mostrar "–" para métricas numéricas
                hasChildren && isExpanded && (typeof item.data[column.id] === 'number' || column.id === 'status') ? (
                  column.id === 'status' ? (
                    column.render ? column.render(item.data[column.id], item.data, level) : item.data[column.id]
                  ) : (
                    <span className="text-tertiary">–</span>
                  )
                ) : (
                  column.render 
                    ? column.render(item.data[column.id], item.data, level) 
                    : item.data[column.id]
                )
              )}
            </td>
          ))}
        </tr>
      )
      
      // Renderizar hijos si está expandido
      if (isExpanded && item.children) {
        const newContext = [...parentContext, { isLastChild }]
        rows.push(...renderRows(item.children, level + 1, newContext))
      }
    })
    
    return rows
  }

  return (
    <div className="space-y-4">
      {/* Barra de controles */}
      <Card variant="glass" className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
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
          
          {/* Actions */}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
          
          {/* Edit Mode Toggle */}
          <Button
            variant={editMode ? "primary" : "ghost"}
            size="sm"
            onClick={() => setEditMode(!editMode)}
            className="flex items-center gap-2 ml-2"
          >
            {editMode ? (
              <>
                <Icons.check className="w-4 h-4" />
                Listo
              </>
            ) : (
              <>
                <Icons.settings className="w-4 h-4" />
                Columnas
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
              {/* Fila de columnas ocultas - solo visible en modo edición */}
              {editMode && hiddenColumns.length > 0 && (
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
                      <span className="text-xs text-tertiary font-medium">
                        Columnas ocultas:
                      </span>
                      <div className="flex flex-wrap gap-2 flex-1">
                        {hiddenColumns.map(column => (
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
                        ))}
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
                      <div className="flex items-center gap-2">
                        {editMode && !column.fixed && (
                          <Icons.grip className={cn(
                            "w-3 h-3 text-secondary",
                            draggedColumn === column.id && "text-info"
                          )} />
                        )}
                        <span className={draggedColumn === column.id ? "text-info" : ""}>{column.label}</span>
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
                        <div className="h-4 bg-[var(--color-background-glass)] rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length || 1} className="text-center py-8 text-tertiary">
                    {hasSearch && searchQuery ? searchMessage : emptyMessage}
                  </td>
                </tr>
              ) : visibleColumns.length === 0 ? (
                <tr>
                  <td className="text-center py-8 text-tertiary">
                    Activa el modo edición y muestra algunas columnas para ver los datos
                  </td>
                </tr>
              ) : (
                renderRows(data)
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
