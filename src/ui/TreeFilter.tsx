import React, { useState, useMemo, useEffect, useRef } from 'react'
import { Icons } from '../icons'
import { useTheme } from '../contexts/ThemeContext'

// Agnóstico: Estructura del árbol de filtros con todas las categorías disponibles
interface FilterNode {
  id: string
  label: string
  icon?: React.ComponentType<any>
  children?: FilterNode[]
  field?: string // Campo real en la DB
  value?: string | number // Valor específico para filtrar
  count?: number // Conteo de items con este filtro
}

interface TreeFilterProps {
  // Datos disponibles para construir el árbol dinámicamente
  availableData?: {
    pages?: Array<{ page: string; count: number }>
    campaigns?: Array<{ name: string; count: number }>
    adsets?: Array<{ name: string; count: number }>
    ads?: Array<{ name: string; count: number }>
    sources?: Array<{ name: string; count: number }>
    devices?: Array<{ name: string; count: number }>
    browsers?: Array<{ name: string; count: number }>
    os?: Array<{ name: string; count: number }>
    countries?: Array<{ name: string; count: number }>
    placements?: Array<{ name: string; count: number }>
  }
  selectedFilters: Record<string, string[]>
  onFilterChange: (filters: Record<string, string[]>) => void
}

export function TreeFilter({
  availableData = {},
  selectedFilters,
  onFilterChange
}: TreeFilterProps) {
  const { themeData } = useTheme()
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['root']))
  const [searchTerm, setSearchTerm] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Cerrar dropdown cuando se hace click afuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Agnóstico: Construir el árbol de filtros basado en los datos disponibles
  const filterTree = useMemo<FilterNode[]>(() => {
    const tree: FilterNode[] = []

    // Categoría: Páginas
    if (availableData.pages?.length) {
      tree.push({
        id: 'pages',
        label: 'Páginas',
        icon: Icons.fileText,
        children: availableData.pages.map(p => ({
          id: `page_${p.page}`,
          label: p.page,
          field: 'landing_url',
          value: p.page,
          count: p.count
        }))
      })
    }

    // Categoría: Campañas (Meta Ads)
    if (availableData.campaigns?.length) {
      tree.push({
        id: 'campaigns',
        label: 'Campañas',
        icon: Icons.target,
        children: availableData.campaigns.map(c => ({
          id: `campaign_${c.name}`,
          label: c.name,
          field: 'utm_campaign',
          value: c.name,
          count: c.count
        }))
      })
    }

    // Categoría: Anuncios
    if (availableData.ads?.length) {
      tree.push({
        id: 'ads',
        label: 'Anuncios',
        icon: Icons.image,
        children: availableData.ads.map(a => ({
          id: `ad_${a.name}`,
          label: a.name,
          field: 'utm_content',
          value: a.name,
          count: a.count
        }))
      })
    }

    // Categoría: Fuentes de tráfico
    if (availableData.sources?.length) {
      tree.push({
        id: 'sources',
        label: 'Fuentes',
        icon: Icons.share2,
        children: availableData.sources.map(s => ({
          id: `source_${s.name}`,
          label: s.name,
          field: 'utm_source',
          value: s.name,
          count: s.count
        }))
      })
    }

    // Categoría: Dispositivos
    if (availableData.devices?.length) {
      tree.push({
        id: 'devices',
        label: 'Dispositivos',
        icon: Icons.smartphone,
        children: availableData.devices.map(d => ({
          id: `device_${d.name}`,
          label: d.name,
          field: 'device_type',
          value: d.name,
          count: d.count
        }))
      })
    }

    // Categoría: Navegadores
    if (availableData.browsers?.length) {
      tree.push({
        id: 'browsers',
        label: 'Navegadores',
        icon: Icons.globe,
        children: availableData.browsers.map(b => ({
          id: `browser_${b.name}`,
          label: b.name,
          field: 'browser',
          value: b.name,
          count: b.count
        }))
      })
    }

    // Categoría: Sistemas Operativos
    if (availableData.os?.length) {
      tree.push({
        id: 'os',
        label: 'Sistemas',
        icon: Icons.monitor,
        children: availableData.os.map(o => ({
          id: `os_${o.name}`,
          label: o.name,
          field: 'os',
          value: o.name,
          count: o.count
        }))
      })
    }

    // Categoría: Ubicaciones/Placements
    if (availableData.placements?.length) {
      tree.push({
        id: 'placements',
        label: 'Ubicaciones',
        icon: Icons.mapPin,
        children: availableData.placements.map(p => ({
          id: `placement_${p.name}`,
          label: p.name,
          field: 'placement',
          value: p.name,
          count: p.count
        }))
      })
    }

    return tree
  }, [availableData])

  // Agnóstico: Manejar expansión/colapso de nodos
  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes)
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId)
    } else {
      newExpanded.add(nodeId)
    }
    setExpandedNodes(newExpanded)
  }

  // Agnóstico: Manejar selección de filtros
  const handleFilterToggle = (field: string, value: string) => {
    const currentValues = selectedFilters[field] || []
    const newValues = currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value]

    const newFilters = {
      ...selectedFilters,
      [field]: newValues
    }

    // Limpiar campos vacíos
    Object.keys(newFilters).forEach(key => {
      if (!newFilters[key]?.length) {
        delete newFilters[key]
      }
    })

    onFilterChange(newFilters)
  }

  // Agnóstico: Verificar si un nodo está seleccionado
  const isNodeSelected = (node: FilterNode): boolean => {
    if (!node.field || !node.value) return false
    return selectedFilters[node.field]?.includes(String(node.value)) || false
  }

  // Agnóstico: Contar filtros activos
  const activeFiltersCount = useMemo(() => {
    return Object.values(selectedFilters).reduce((acc, values) => acc + values.length, 0)
  }, [selectedFilters])

  // Agnóstico: Filtrar nodos por búsqueda
  const filteredTree = useMemo(() => {
    if (!searchTerm) return filterTree

    const searchLower = searchTerm.toLowerCase()

    const filterNode = (node: FilterNode): FilterNode | null => {
      const labelMatches = node.label.toLowerCase().includes(searchLower)

      if (node.children) {
        const filteredChildren = node.children
          .map(child => filterNode(child))
          .filter(Boolean) as FilterNode[]

        if (filteredChildren.length > 0) {
          return { ...node, children: filteredChildren }
        }
      }

      return labelMatches ? node : null
    }

    return filterTree
      .map(node => filterNode(node))
      .filter(Boolean) as FilterNode[]
  }, [filterTree, searchTerm])

  // Agnóstico: Renderizar un nodo del árbol
  const renderNode = (node: FilterNode, depth = 0) => {
    const hasChildren = node.children && node.children.length > 0
    const isExpanded = expandedNodes.has(node.id)
    const isSelected = isNodeSelected(node)
    const Icon = node.icon

    return (
      <div key={node.id} className="select-none">
        <div
          className={`
            flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer
            transition-all duration-150
            ${isSelected
              ? 'bg-info/20 text-info'
              : 'hover:bg-primary/5 text-primary'
            }
          `}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => {
            if (hasChildren) {
              toggleNode(node.id)
            } else if (node.field && node.value) {
              handleFilterToggle(node.field, String(node.value))
            }
          }}
        >
          {/* Flecha expansión */}
          {hasChildren && (
            <Icons.chevronRight
              className={`
                w-3 h-3 transition-transform duration-200
                ${isExpanded ? 'rotate-90' : ''}
              `}
            />
          )}

          {/* Checkbox para items hoja */}
          {!hasChildren && node.field && (
            <div className={`
              w-4 h-4 rounded border-2 transition-all duration-200
              flex items-center justify-center flex-shrink-0
              ${isSelected
                ? 'bg-info border-info'
                : 'bg-transparent border-primary/40 hover:border-primary'
              }
            `}>
              {isSelected && (
                <Icons.check className="w-2.5 h-2.5 text-white stroke-[3]" />
              )}
            </div>
          )}

          {/* Icono de categoría */}
          {Icon && !node.field && (
            <Icon className="w-3.5 h-3.5 text-secondary" />
          )}

          {/* Label */}
          <span className="text-sm flex-1">{node.label}</span>

          {/* Contador */}
          {node.count !== undefined && (
            <span className="text-xs text-secondary">
              {node.count}
            </span>
          )}
        </div>

        {/* Hijos */}
        {hasChildren && isExpanded && (
          <div className="ml-2">
            {node.children!.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div ref={dropdownRef} className="relative">
      {/* Botón principal */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-2 px-3 py-2
          rounded-lg glass transition-all duration-200
          ${isOpen ? 'ring-2 ring-info/50' : 'hover:bg-primary/5'}
        `}
      >
        <Icons.filter className="w-4 h-4 text-primary" />
        <span className="text-sm text-primary">
          {activeFiltersCount > 0 ? `Filtros (${activeFiltersCount})` : 'Todos'}
        </span>
        <Icons.chevronDown
          className={`
            w-3 h-3 text-secondary transition-transform duration-200
            ${isOpen ? 'rotate-180' : ''}
          `}
        />
      </button>

      {/* Dropdown con árbol de filtros */}
      {isOpen && (
        <div className={`
          absolute top-full left-0 mt-2 z-50
          w-80 max-h-96
          glass rounded-lg shadow-xl
          animate-in fade-in slide-in-from-top-2 duration-200
        `}>
          {/* Header con búsqueda */}
          <div className="p-3 border-b border-primary/10">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Icons.search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-tertiary" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar filtros..."
                  className="w-full pl-8 pr-3 py-2 text-sm rounded-md
                           bg-background border border-primary/20
                           text-primary placeholder-tertiary
                           focus:outline-none focus:ring-2 focus:ring-info/50 focus:border-info
                           transition-colors duration-200"
                />
              </div>

              {/* Botón limpiar filtros */}
              {activeFiltersCount > 0 && (
                <button
                  onClick={() => onFilterChange({})}
                  className="px-2 py-1 text-xs text-error hover:bg-error/10
                           rounded-md transition-colors duration-150"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>

          {/* Árbol de filtros */}
          <div className="p-2 overflow-y-auto max-h-72">
            {filteredTree.length > 0 ? (
              filteredTree.map(node => renderNode(node))
            ) : (
              <div className="text-center py-4 text-sm text-tertiary">
                {searchTerm ? 'No se encontraron filtros' : 'No hay datos disponibles'}
              </div>
            )}
          </div>

          {/* Footer con resumen */}
          {activeFiltersCount > 0 && (
            <div className="p-2 border-t border-primary/10">
              <div className="text-xs text-secondary">
                {activeFiltersCount} {activeFiltersCount === 1 ? 'filtro activo' : 'filtros activos'}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}