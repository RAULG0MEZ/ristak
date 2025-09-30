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
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [showSearchResults, setShowSearchResults] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Cerrar dropdown cuando se hace click afuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setHoveredCategory(null)
        setShowSearchResults(false)
        setSearchTerm('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Limpiar timeout de hover cuando se desmonta el componente
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
      }
    }
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

  // Agnóstico: Manejar hover con delay para evitar flicker
  const handleCategoryHover = (categoryId: string) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredCategory(categoryId)
    }, 100) // Pequeño delay para evitar que se abra accidentalmente
  }

  const handleCategoryLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredCategory(null)
    }, 150) // Delay para permitir mover el mouse al submenu
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

  // Agnóstico: Filtrar nodos por búsqueda (solo aplicar a los items del submenu activo)
  const getFilteredChildren = (node: FilterNode) => {
    if (!node.children) return []
    if (!searchTerm) return node.children

    const searchLower = searchTerm.toLowerCase()
    return node.children.filter(child =>
      child.label.toLowerCase().includes(searchLower)
    )
  }

  // Agnóstico: Obtener resultados de búsqueda global
  const getGlobalSearchResults = () => {
    if (!searchTerm) return []

    const searchLower = searchTerm.toLowerCase()
    const results: { category: FilterNode; items: FilterNode[] }[] = []

    filterTree.forEach(category => {
      if (!category.children) return

      const matchingItems = category.children.filter(item =>
        item.label.toLowerCase().includes(searchLower)
      )

      if (matchingItems.length > 0) {
        results.push({
          category,
          items: matchingItems
        })
      }
    })

    return results
  }

  // Agnóstico: Obtener conteo de seleccionados por categoría
  const getSelectedCountForCategory = (node: FilterNode): number => {
    if (!node.children) return 0
    return node.children.filter(child =>
      child.field && child.value && isNodeSelected(child)
    ).length
  }

  // Agnóstico: Manejar cambios en el término de búsqueda
  const handleSearchChange = (value: string) => {
    setSearchTerm(value)
    if (value.trim()) {
      setShowSearchResults(true)
      setHoveredCategory(null)
    } else {
      setShowSearchResults(false)
    }
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

      {/* Dropdown principal con menú tipo navegación */}
      {isOpen && (
        <div
          className={`
            absolute top-full left-0 mt-2 z-50
            glass rounded-lg shadow-xl
            animate-in fade-in slide-in-from-top-2 duration-200
            flex
          `}
          onMouseLeave={handleCategoryLeave}
        >
          {/* Panel izquierdo: Categorías principales */}
          <div className="w-48 border-r border-white/5 dark:border-white/5">
            {/* Header con búsqueda */}
            <div className="p-3 border-b border-white/5 dark:border-white/5">
              <div className="relative">
                <Icons.search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-tertiary" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Buscar..."
                  className="w-full pl-8 pr-3 py-2 text-sm rounded-md
                           bg-white/5 dark:bg-white/5 border border-white/10 dark:border-white/10
                           text-primary placeholder-tertiary
                           focus:outline-none focus:ring-1 focus:ring-info/30 focus:border-info/50
                           transition-colors duration-200"
                />
              </div>
            </div>

            {/* Lista de categorías o resultados de búsqueda */}
            <div className="py-2 max-h-80 overflow-y-auto">
              {showSearchResults ? (
                // Mostrar mensaje cuando está buscando
                <div className="text-center py-4 text-sm text-secondary px-3">
                  {getGlobalSearchResults().length > 0
                    ? `${getGlobalSearchResults().reduce((acc, r) => acc + r.items.length, 0)} resultados`
                    : 'No se encontraron resultados'
                  }
                </div>
              ) : filterTree.length > 0 ? (
                filterTree.map(category => {
                  const Icon = category.icon
                  const selectedCount = getSelectedCountForCategory(category)
                  const isHovered = hoveredCategory === category.id

                  return (
                    <div
                      key={category.id}
                      onMouseEnter={() => handleCategoryHover(category.id)}
                      className={`
                        flex items-center justify-between px-3 py-2 cursor-pointer
                        transition-all duration-150
                        ${isHovered ? 'bg-primary/10' : 'hover:bg-primary/5'}
                        ${selectedCount > 0 ? 'text-info' : 'text-primary'}
                      `}
                    >
                      <div className="flex items-center gap-2">
                        {Icon && <Icon className="w-4 h-4" />}
                        <span className="text-sm font-medium">{category.label}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {selectedCount > 0 && (
                          <span className="text-xs bg-info/20 text-info px-1.5 py-0.5 rounded">
                            {selectedCount}
                          </span>
                        )}
                        <Icons.chevronRight className="w-3 h-3 text-secondary" />
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="text-center py-4 text-sm text-tertiary px-3">
                  No hay datos disponibles
                </div>
              )}

              {/* Botón limpiar filtros */}
              {activeFiltersCount > 0 && (
                <div className="border-t border-white/5 dark:border-white/5 mt-2 pt-2 px-3">
                  <button
                    onClick={() => {
                      onFilterChange({})
                      setHoveredCategory(null)
                    }}
                    className="w-full px-2 py-1.5 text-xs text-error hover:bg-error/10
                             rounded-md transition-colors duration-150 text-center"
                  >
                    Limpiar todos ({activeFiltersCount})
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Panel derecho: Opciones de la categoría con hover o resultados de búsqueda */}
          {(hoveredCategory || showSearchResults) && (
            <div
              className="w-64 overflow-y-auto"
              style={{ maxHeight: 'calc(100vh - 160px)' }}
              onMouseEnter={() => {
                if (hoverTimeoutRef.current) {
                  clearTimeout(hoverTimeoutRef.current)
                }
                setHoveredCategory(hoveredCategory)
              }}
            >
              {showSearchResults ? (
                // Mostrar resultados de búsqueda global
                <div className="py-2">
                  {getGlobalSearchResults().map(({ category, items }) => {
                    const Icon = category.icon
                    return (
                      <div key={category.id} className="mb-3">
                        {/* Título de la categoría */}
                        <div className="px-3 py-1.5 border-b border-white/5 dark:border-white/5 mb-1 flex items-center gap-2">
                          {Icon && <Icon className="w-3.5 h-3.5 text-secondary" />}
                          <h3 className="text-xs font-semibold text-secondary uppercase tracking-wider">
                            {category.label}
                          </h3>
                          <span className="text-xs text-tertiary">({items.length})</span>
                        </div>

                        {/* Lista de opciones con checkboxes */}
                        <div className="">
                          {items.map((item, index) => {
                            const isSelected = isNodeSelected(item)

                            return (
                              <div
                                key={item.id}
                                onClick={() => {
                                  if (item.field && item.value) {
                                    handleFilterToggle(item.field, String(item.value))
                                  }
                                }}
                                className={`
                                  flex items-center gap-2 px-3 py-2 cursor-pointer
                                  transition-all duration-150
                                  ${index % 2 === 1 ? 'bg-white/[0.02] dark:bg-white/[0.02]' : ''}
                                  ${isSelected
                                    ? 'bg-info/20 text-info hover:bg-info/25'
                                    : 'hover:bg-white/[0.05] dark:hover:bg-white/[0.05] text-primary'
                                  }
                                `}
                              >
                                {/* Checkbox */}
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

                                {/* Label */}
                                <span className="text-sm flex-1">{item.label}</span>

                                {/* Contador */}
                                {item.count !== undefined && (
                                  <span className="text-xs text-secondary">
                                    {item.count}
                                  </span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                // Mostrar opciones de categoría con hover
                filterTree.map(category => {
                  if (category.id !== hoveredCategory) return null

                  const filteredChildren = getFilteredChildren(category)

                  if (filteredChildren.length === 0) {
                    return (
                      <div key={category.id} className="p-4 text-center text-sm text-tertiary">
                        {searchTerm ? 'No se encontraron resultados' : 'Sin opciones disponibles'}
                      </div>
                    )
                  }

                  return (
                    <div key={category.id} className="py-2">
                      {/* Título de la categoría */}
                      <div className="px-3 py-2 border-b border-white/5 dark:border-white/5 mb-1">
                        <h3 className="text-sm font-semibold text-primary">
                          {category.label}
                        </h3>
                      </div>

                    {/* Lista de opciones con checkboxes */}
                    <div className="">
                      {filteredChildren.map((item, index) => {
                        const isSelected = isNodeSelected(item)

                        return (
                          <div
                            key={item.id}
                            onClick={() => {
                              if (item.field && item.value) {
                                handleFilterToggle(item.field, String(item.value))
                              }
                            }}
                            className={`
                              flex items-center gap-2 px-3 py-2 cursor-pointer
                              transition-all duration-150
                              ${index % 2 === 1 ? 'bg-white/[0.02] dark:bg-white/[0.02]' : ''}
                              ${isSelected
                                ? 'bg-info/20 text-info hover:bg-info/25'
                                : 'hover:bg-white/[0.05] dark:hover:bg-white/[0.05] text-primary'
                              }
                            `}
                          >
                            {/* Checkbox */}
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

                            {/* Label */}
                            <span className="text-sm flex-1">{item.label}</span>

                            {/* Contador */}
                            {item.count !== undefined && (
                              <span className="text-xs text-secondary">
                                {item.count}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}