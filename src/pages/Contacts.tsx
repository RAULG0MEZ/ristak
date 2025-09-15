import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { PageContainer, TableWithControls, Badge, Button, DateRangePicker, KPICard, TabList, Checkbox, Modal } from '../ui'
import { useDateRange } from '../contexts/DateContext'
import { useContacts } from '../hooks/useContacts'
import { useColumnsConfig } from '../hooks/useColumnsConfig'
import { useToastActions } from '../hooks/useToast'
import { Icons } from '../icons'
import { formatCurrency, formatDate, formatNumber } from '../lib/utils'


export function Contacts() {
  const { dateRange } = useDateRange()
  const { contacts, metrics, loading, updateContact, deleteContact, bulkDeleteContacts } = useContacts({
    start: dateRange.start,
    end: dateRange.end
  })
  const toast = useToastActions()
  const [activeTab, setActiveTab] = useState('all')
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null)
  
  // Estados para modales
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; contact: any | null }>({ isOpen: false, contact: null })
  const [bulkDeleteModal, setBulkDeleteModal] = useState<{ isOpen: boolean }>({ isOpen: false })
  const [editModal, setEditModal] = useState<{ isOpen: boolean; contact: any | null }>({ isOpen: false, contact: null })
  const [editForm, setEditForm] = useState<any>({})

  // Tabs con conteo dinámico
  const tabs = [
    { id: 'all', label: 'Todos', count: contacts.length },
    { id: 'clients', label: 'Clientes', count: contacts.filter(c => c.status === 'client').length },
    { id: 'appointments', label: 'Citas', count: contacts.filter(c => c.appointments > 0).length },
  ]

  const filteredContacts = useMemo(() => {
    let filtered = contacts.filter(contact => {
      const matchesSearch = searchQuery === '' ||
        contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contact.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (contact.phone?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
        (contact.company?.toLowerCase().includes(searchQuery.toLowerCase()) || false)

      const matchesTab = activeTab === 'all' ||
        (activeTab === 'clients' && contact.status === 'client') ||
        (activeTab === 'appointments' && contact.appointments > 0)

      return matchesSearch && matchesTab
    })

    // Aplicar ordenamiento
    if (sortColumn && sortDirection) {
      filtered = [...filtered].sort((a, b) => {
        const aVal = a[sortColumn as keyof typeof a]
        const bVal = b[sortColumn as keyof typeof b]

        if (aVal === null || aVal === undefined) return 1
        if (bVal === null || bVal === undefined) return -1

        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
        }

        if (typeof aVal === 'string' && typeof bVal === 'string') {
          const comparison = aVal.toLowerCase().localeCompare(bVal.toLowerCase())
          return sortDirection === 'asc' ? comparison : -comparison
        }

        return 0
      })
    }

    return filtered
  }, [contacts, searchQuery, activeTab, sortColumn, sortDirection])

  const toggleContact = useCallback((contactId: string) => {
    setSelectedContacts(prev => {
      const next = new Set(prev)
      if (next.has(contactId)) next.delete(contactId)
      else next.add(contactId)
      return next
    })
  }, [])

  const toggleAllContacts = useCallback(() => {
    const visibleIds = filteredContacts.map(c => c.id)
    setSelectedContacts(prev => {
      if (prev.size === visibleIds.length && visibleIds.every(id => prev.has(id))) {
        // All visible are selected, deselect all
        return new Set()
      } else {
        // Select all visible
        return new Set(visibleIds)
      }
    })
  }, [filteredContacts])

  const handleSort = (columnId: string, direction: 'asc' | 'desc' | null) => {
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
    
    setSortColumn(newDirection ? columnId : null)
    setSortDirection(newDirection)
  }

  // Clear selection when changing tabs or search
  useEffect(() => {
    setSelectedContacts(new Set())
  }, [activeTab, searchQuery])

  // Configuración de columnas con persistencia
  // Preparar columnas por defecto (estables) — usan row._selected en lugar de cerrar sobre selectedContacts
  const defaultColumns = useMemo(() => ([
      {
        id: 'checkbox',
        label: (
          <Checkbox
            checked={filteredContacts.length > 0 && filteredContacts.every(c => selectedContacts.has(c.id))}
            indeterminate={selectedContacts.size > 0 && selectedContacts.size < filteredContacts.length}
            onChange={toggleAllContacts}
          />
        ),
        width: '48px',
        sortable: false,
        fixed: true,
        alwaysVisible: true,
        visible: true,
        render: (_: any, contact: any) => (
          <Checkbox
            checked={contact._selected}
            onChange={() => toggleContact(contact.id)}
          />
        )
      },
      {
        id: 'createdAt',
        label: 'Fecha',
        visible: true,
        align: 'left',
        render: (value: any) => formatDate(value)
      },
      {
        id: 'name',
        label: 'Nombre',
        visible: true,
        align: 'left',
        render: (value: any) => <span className="font-medium text-primary">{value}</span>
      },
      {
        id: 'email',
        label: 'Email',
        visible: true,
        align: 'left',
        render: (value: any) => <span className="text-secondary">{value || '—'}</span>
      },
      {
        id: 'phone',
        label: 'Teléfono',
        visible: true,
        align: 'left',
        render: (value: any) => <span className="text-secondary">{value || '—'}</span>
      },
      {
        id: 'company',
        label: 'Empresa',
        visible: true,
        align: 'left',
        render: (value: any) => <span className="text-secondary">{value || '—'}</span>
      },
      {
        id: 'source',
        label: 'Fuente',
        visible: true,
        align: 'center',
        render: (value: any) => <Badge variant="info">{value}</Badge>
      },
      {
        id: 'ltv',
        label: 'LTV',
        align: 'right' as const,
        visible: true,
        render: (value: any) => (
          <span className="font-medium">
            {value > 0 ? formatCurrency(value) : '—'}
          </span>
        )
      },
      {
        id: 'attributionAdId',
        label: 'Atribución',
        visible: false,
        align: 'left',
        render: (value: any) => (
          <span className="text-xs font-mono text-tertiary">
            {value || '—'}
          </span>
        )
      },
      {
        id: 'status',
        label: 'Estado',
        visible: true,
        align: 'center',
        render: (value: any, contact: any) => {
          // Prioridad: Cliente > Agendó cita > Lead
          if (value === 'client') {
            return <Badge variant="primary">Cliente</Badge>
          } else if (contact.appointments > 0) {
            return <Badge variant="success">Agendó cita</Badge>
          } else {
            return <Badge variant="default">Lead</Badge>
          }
        }
      },
      {
        id: 'actions',
        label: 'Acciones',
        width: '100px',
        sortable: false,
        alwaysVisible: true,
        visible: true,
        align: 'center',
        render: (_: any, contact: any) => (
          <div className="flex gap-1">
            <button 
              className="p-1 glass-hover rounded"
              onClick={() => {
                setEditForm({
                  name: contact.name || '',
                  email: contact.email || '',
                  phone: contact.phone || '',
                  company: contact.company || '',
                  source: contact.source || '',
                  status: contact.status || 'lead'
                })
                setEditModal({ isOpen: true, contact })
              }}
            >
              <Icons.edit className="w-4 h-4 text-secondary" />
            </button>
            <button 
              className="p-1 glass-hover rounded"
              onClick={() => setDeleteModal({ isOpen: true, contact })}
            >
              <Icons.trash2 className="w-4 h-4 text-error" />
            </button>
          </div>
        )
      }
    ]), [toggleContact, toggleAllContacts, filteredContacts, selectedContacts])

  const { columns, handleColumnReorder, handleColumnVisibilityChange } = useColumnsConfig(
    'contacts_columns_config',
    defaultColumns
  )

  return (
    <PageContainer>
      <div className="space-y-6">
        {/* Título y selector de fechas */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-primary">Contactos</h1>
            <Button variant="primary" size="sm">
              <Icons.plus className="w-4 h-4 mr-2" />
              Nuevo
            </Button>
          </div>
          <DateRangePicker />
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <KPICard
            title="Total Contactos"
            value={formatNumber(metrics?.total || 0)}
            subtitle={`Periodo actual`}
            icon={Icons.users}
            iconColor="text-primary"
            iconBgColor="glass"
          />

          <KPICard
            title="Con Citas"
            value={formatNumber(metrics?.withAppointments || 0)}
            subtitle={`Del total: ${metrics?.appointmentRate.toFixed(1) || 0}%`}
            icon={Icons.calendar}
            iconColor="text-primary"
            iconBgColor="glass"
          />

          <KPICard
            title="Clientes"
            value={formatNumber(metrics?.customers || 0)}
            subtitle={`Conversión: ${metrics?.conversionRate.toFixed(1) || 0}%`}
            icon={Icons.userPlus}
            iconColor="text-primary"
            iconBgColor="glass"
          />

          <KPICard
            title="LTV Total"
            value={formatCurrency(metrics?.totalLTV || 0)}
            change={15.8}
            trend="up"
            icon={Icons.dollarSign}
            iconColor="text-primary"
            iconBgColor="glass"
          />

          <KPICard
            title="LTV Promedio"
            value={formatCurrency(metrics?.avgLTV || 0)}
            subtitle={`Por cliente`}
            icon={Icons.trendingUp}
            iconColor="text-primary"
            iconBgColor="glass"
          />
        </div>

        {/* Bulk Actions */}
        {selectedContacts.size > 0 && (
          <div className="px-4 py-2 glass rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-info">
                {selectedContacts.size} contacto{selectedContacts.size !== 1 ? 's' : ''} seleccionado{selectedContacts.size !== 1 ? 's' : ''}
              </span>
              <button
                className="text-sm text-error hover:text-error-hover transition-colors"
                onClick={() => setBulkDeleteModal({ isOpen: true })}
              >
                <Icons.trash2 className="w-4 h-4 inline mr-1" />
                Eliminar seleccionados
              </button>
            </div>
          </div>
        )}

        {/* Contacts Table */}
        <TableWithControls
          columns={columns}
          data={filteredContacts.map(c => ({ ...c, _selected: selectedContacts.has(c.id) }))}
          loading={loading}
          emptyMessage="No hay contactos para el período seleccionado"
          searchMessage="No se encontraron contactos"
          hasSearch={true}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filters={[
            {
              type: 'select',
              options: tabs.map(tab => ({ value: tab.id, label: `${tab.label} (${tab.count})` })),
              value: activeTab,
              onChange: setActiveTab
            }
          ]}
          onSort={handleSort}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onColumnReorder={handleColumnReorder}
          onColumnVisibilityChange={handleColumnVisibilityChange}
        />
      </div>

      {/* Modal de confirmación de borrado */}
      <Modal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, contact: null })}
        title="Confirmar eliminación"
        icon={<Icons.alertCircle className="w-5 h-5 text-error" />}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-secondary text-center">
            ¿Estás seguro que deseas eliminar este contacto?
          </p>
          {deleteModal.contact && (
            <div className="p-3 glass rounded-lg space-y-1">
              <p className="text-sm"><span className="text-tertiary">Nombre:</span> {deleteModal.contact.name}</p>
              <p className="text-sm"><span className="text-tertiary">Email:</span> {deleteModal.contact.email || 'Sin email'}</p>
              <p className="text-sm"><span className="text-tertiary">Teléfono:</span> {deleteModal.contact.phone || 'Sin teléfono'}</p>
            </div>
          )}
          <p className="text-error text-sm text-center">
            Esta acción no se puede deshacer.
          </p>
          <div className="flex gap-2 pt-2 justify-center">
            <Button
              variant="danger"
              size="sm"
              onClick={async () => {
                if (deleteModal.contact) {
                  try {
                    await deleteContact(deleteModal.contact.id)
                    setDeleteModal({ isOpen: false, contact: null })
                    toast.success('Contacto eliminado', `${deleteModal.contact.name} ha sido eliminado correctamente`)
                  } catch (error) {
                    console.error('Error al eliminar:', error)
                    toast.error('Error al eliminar', 'No se pudo eliminar el contacto. Por favor, intenta nuevamente.')
                  }
                }
              }}
            >
              <Icons.trash2 className="w-4 h-4 mr-2" />
              Eliminar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de edición */}
      <Modal
        isOpen={editModal.isOpen}
        onClose={() => setEditModal({ isOpen: false, contact: null })}
        title="Editar contacto"
        icon={<Icons.edit className="w-5 h-5 text-primary" />}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">Nombre</label>
            <div className="relative">
              {Icons.user && <Icons.user className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tertiary z-10 pointer-events-none" />}
              <input
                type="text"
                className="w-full pl-10 pr-3 py-2 glass rounded-lg border border-glassBorder focus:border-primary focus:outline-none transition-colors"
                value={editForm.name || ''}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="Nombre del contacto"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">Email</label>
            <div className="relative">
              {Icons.send && <Icons.send className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tertiary z-10 pointer-events-none" />}
              <input
                type="email"
                className="w-full pl-10 pr-3 py-2 glass rounded-lg border border-glassBorder focus:border-primary focus:outline-none transition-colors"
                value={editForm.email || ''}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                placeholder="correo@ejemplo.com"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">Teléfono</label>
            <div className="relative">
              {Icons.phone && <Icons.phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tertiary z-10 pointer-events-none" />}
              <input
                type="tel"
                className="w-full pl-10 pr-3 py-2 glass rounded-lg border border-glassBorder focus:border-primary focus:outline-none transition-colors"
                value={editForm.phone || ''}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                placeholder="+52 123 456 7890"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">Empresa</label>
            <div className="relative">
              {Icons.building && <Icons.building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tertiary z-10 pointer-events-none" />}
              <input
                type="text"
                className="w-full pl-10 pr-3 py-2 glass rounded-lg border border-glassBorder focus:border-primary focus:outline-none transition-colors"
                value={editForm.company || ''}
                onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                placeholder="Nombre de la empresa"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">Fuente</label>
            <div className="relative">
              {Icons.globe && <Icons.globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tertiary z-10 pointer-events-none" />}
              <input
                type="text"
                className="w-full pl-10 pr-3 py-2 glass rounded-lg border border-glassBorder focus:border-primary focus:outline-none transition-colors"
                value={editForm.source || ''}
                onChange={(e) => setEditForm({ ...editForm, source: e.target.value })}
                placeholder="Fuente de contacto"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">Estado</label>
            <div className="w-full pl-3 pr-3 py-2 glass rounded-lg border border-glassBorder text-primary">
              {editForm.status || 'lead'}
            </div>
          </div>
          <div className="flex gap-2 pt-2 justify-center">
            <Button
              variant="primary"
              size="sm"
              onClick={async () => {
                if (editModal.contact) {
                  try {
                    await updateContact(editModal.contact.id, editForm)
                    setEditModal({ isOpen: false, contact: null })
                    toast.success('Contacto actualizado', 'Los cambios se han guardado correctamente')
                  } catch (error) {
                    console.error('Error al actualizar:', error)
                    toast.error('Error al actualizar', 'No se pudo actualizar el contacto. Por favor, intenta nuevamente.')
                  }
                }
              }}
            >
              <Icons.save className="w-4 h-4 mr-2" />
              Guardar cambios
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de confirmación de borrado masivo */}
      <Modal
        isOpen={bulkDeleteModal.isOpen}
        onClose={() => setBulkDeleteModal({ isOpen: false })}
        title="Confirmar eliminación masiva"
        icon={<Icons.alertCircle className="w-5 h-5 text-error" />}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-secondary text-center">
            ¿Estás seguro que deseas eliminar {selectedContacts.size} contacto{selectedContacts.size !== 1 ? 's' : ''}?
          </p>
          <p className="text-error text-sm text-center font-medium">
            Esta acción no se puede deshacer.
          </p>
          <div className="flex gap-2 pt-2 justify-center">
            <Button
              variant="default"
              size="sm"
              onClick={() => setBulkDeleteModal({ isOpen: false })}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={async () => {
                try {
                  const idsToDelete = Array.from(selectedContacts)
                  const deletedCount = await bulkDeleteContacts(idsToDelete)
                  setSelectedContacts(new Set())
                  setBulkDeleteModal({ isOpen: false })
                  toast.success(
                    'Contactos eliminados',
                    `${deletedCount || selectedContacts.size} contacto${(deletedCount || selectedContacts.size) !== 1 ? 's' : ''} eliminado${(deletedCount || selectedContacts.size) !== 1 ? 's' : ''} correctamente`
                  )
                } catch (error) {
                  console.error('Error al eliminar contactos:', error)
                  toast.error('Error al eliminar', 'No se pudieron eliminar los contactos. Por favor, intenta nuevamente.')
                }
              }}
            >
              <Icons.trash2 className="w-4 h-4 mr-2" />
              Eliminar {selectedContacts.size} contacto{selectedContacts.size !== 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      </Modal>
    </PageContainer>
  )
}
