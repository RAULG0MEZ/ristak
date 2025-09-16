import React, { useState, useEffect, useMemo } from 'react'
import { PageContainer, TableWithControls, Badge, Button, DateRangePicker, KPICard, Modal, Pagination, TabList } from '../ui'
import { useDateRange } from '../contexts/DateContext'
import { usePayments } from '../hooks/usePayments'
import { useColumnsConfig } from '../hooks/useColumnsConfig'
import { useToastActions } from '../hooks/useToast'
import { Icons } from '../icons'
import { formatCurrency, formatDate, formatNumber } from '../lib/utils'
import { ContactSearch } from '../components/ContactSearch'

export function Payments() {
  const { dateRange } = useDateRange()
  const [viewMode, setViewMode] = useState<'all' | 'filtered'>('filtered')

  const {
    payments,
    metrics,
    loading,
    totalCount,
    currentPage,
    pageSize,
    totalPages,
    changePage,
    changePageSize,
    createPayment,
    updatePayment,
    deletePayment
  } = usePayments(
    viewMode === 'all'
      ? { all: true, page: 1, limit: 50 }
      : { start: dateRange.start, end: dateRange.end, page: 1, limit: 50 }
  )
  // REMOVIDO: No necesitamos cargar todos los contactos aquí
  // ContactSearch ya maneja sus propios contactos internamente
  const toast = useToastActions()
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<'transactions' | 'subscriptions' | 'installments'>('transactions')
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null)
  
  // Estados para modales
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; payment: any | null }>({ isOpen: false, payment: null })
  const [editModal, setEditModal] = useState<{ isOpen: boolean; payment: any | null }>({ isOpen: false, payment: null })
  const [createModal, setCreateModal] = useState<{ isOpen: boolean }>({ isOpen: false })
  const [editForm, setEditForm] = useState<any>({})
  const [createForm, setCreateForm] = useState<any>({
    contactId: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    paymentMethod: 'card',
    status: 'completed'
  })

  // Filtrar y ordenar pagos
  const filteredPayments = useMemo(() => {
    let filtered = payments.filter(payment => {
      const matchesSearch = searchQuery === '' ||
        payment.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        payment.contactName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        payment.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        payment.transactionId?.toLowerCase().includes(searchQuery.toLowerCase())
      
      // Por ahora mostrar todos los pagos en Transacciones
      // En el futuro filtrar por tipo real de pago
      const matchesType = filterType === 'transactions' || 
        (filterType === 'subscriptions' && payment.type === 'subscription') ||
        (filterType === 'installments' && payment.type === 'installment')
      
      return matchesSearch && matchesType
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
  }, [payments, searchQuery, filterType, sortColumn, sortDirection])

  const handleSort = (columnId: string, direction: 'asc' | 'desc' | null) => {
    setSortColumn(direction ? columnId : null)
    setSortDirection(direction)
  }

  // Configuración de columnas con persistencia
  const { columns, handleColumnReorder, handleColumnVisibilityChange } = useColumnsConfig(
    'payments_columns_config',
    [
      {
        id: 'date',
        label: 'Fecha',
        visible: true,
        align: 'left',
        render: (value: any) => (
          <span className="text-secondary text-sm">
            {value ? formatDate(value) : '—'}
          </span>
        )
      },
      {
        id: 'contactName',
        label: 'Contacto',
        visible: true,
        align: 'left',
        render: (value: any) => (
          <span className="font-medium text-primary">{value || '—'}</span>
        )
      },
      {
        id: 'email',
        label: 'Email',
        visible: true,
        align: 'left',
        render: (value: any) => (
          <span className="text-secondary">{value || '—'}</span>
        )
      },
      {
        id: 'amount',
        label: 'Monto',
        align: 'right' as const,
        visible: true,
        render: (value: any, payment: any) => (
          <span className={payment.status === 'refunded' ? 'text-error font-medium' : 'font-medium text-primary'}>
            {formatCurrency(Math.abs(value))}
          </span>
        )
      },
      {
        id: 'status',
        label: 'Estado',
        visible: true,
        align: 'center',
        render: (value: any) => (
          <Badge 
            variant={
              value === 'completed' ? 'success' : 
              value === 'pending' ? 'warning' : 
              'error'
            }
          >
            {value === 'completed' ? 'Pagado' : 
             value === 'pending' ? 'Pendiente' : 
             'Reembolsado'}
          </Badge>
        )
      },
      {
        id: 'description',
        label: 'Descripción',
        visible: true,
        align: 'left',
        render: (value: any) => (
          <span className="text-secondary text-sm">{value || '—'}</span>
        )
      },
      {
        id: 'transactionId',
        label: 'ID Transacción',
        visible: false,
        align: 'left',
        render: (value: any) => (
          <span className="text-xs font-mono text-tertiary">{value || '—'}</span>
        )
      },
      {
        id: 'actions',
        label: 'Acciones',
        width: '100px',
        sortable: false,
        visible: true,
        align: 'center',
        render: (_: any, payment: any) => (
          <div className="flex gap-1">
            <button
              className="p-1 glass-hover rounded"
              onClick={() => {
                setEditForm({
                  contactName: payment.contactName || '',
                  email: payment.email || '',
                  description: payment.description || '',
                  amount: payment.amount || 0,
                  status: payment.status || 'completed'
                })
                setEditModal({ isOpen: true, payment })
              }}
            >
              <Icons.edit className="w-4 h-4 text-secondary" />
            </button>
            <button
              className="p-1 glass-hover rounded"
              onClick={() => setDeleteModal({ isOpen: true, payment })}
            >
              <Icons.trash2 className="w-4 h-4 text-error" />
            </button>
          </div>
        )
      }
    ]
  )

  return (
    <PageContainer>
      <div className="space-y-6">
        {/* Título y botones */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">Pagos</h1>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setCreateForm({
                contactId: '',
                amount: '',
                date: new Date().toISOString().split('T')[0],
                description: '',
                paymentMethod: 'card',
                status: 'completed'
              })
              setCreateModal({ isOpen: true })
            }}
          >
            <Icons.plus className="w-4 h-4 mr-2" />
            Registrar
          </Button>
        </div>

        {/* TabList y DateRangePicker */}
        <div className="flex items-center gap-4">
          <TabList
            tabs={[
              { value: 'filtered', label: 'Por fecha' },
              { value: 'all', label: 'Todos' }
            ]}
            value={viewMode}
            onChange={(value) => setViewMode(value as 'all' | 'filtered')}
          />
          {viewMode === 'filtered' && <DateRangePicker />}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="Ingresos Netos"
            value={formatCurrency(metrics?.netRevenue || 0)}
            change={metrics?.trends?.netRevenue || 0}
            trend={
              metrics?.trends?.netRevenue > 0 ? 'up' :
              metrics?.trends?.netRevenue < 0 ? 'down' : 'up'
            }
            icon={Icons.dollarSign}
            iconColor="text-primary"
            iconBgColor="glass"
            className={loading ? 'animate-pulse' : ''}
          />

          <KPICard
            title="Pagos Completados"
            value={formatNumber(metrics?.completed.count || 0)}
            subtitle={`Total: ${formatCurrency(metrics?.completed.total || 0)}`}
            icon={Icons.checkCircle}
            iconColor="text-primary"
            iconBgColor="glass"
          />

          <KPICard
            title="Ticket Promedio"
            value={formatCurrency(metrics?.avgPayment || 0)}
            change={metrics?.trends?.avgPayment || 0}
            trend={
              metrics?.trends?.avgPayment > 0 ? 'up' :
              metrics?.trends?.avgPayment < 0 ? 'down' : 'up'
            }
            icon={Icons.trendingUp}
            iconColor="text-primary"
            iconBgColor="glass"
            className={loading ? 'animate-pulse' : ''}
          />

          <KPICard
            title="Reembolsos"
            value={formatCurrency(metrics?.refunded.total || 0)}
            subtitle={`Transacciones: ${formatNumber(metrics?.refunded.count || 0)}`}
            icon={Icons.xCircle}
            iconColor="text-primary"
            iconBgColor="glass"
          />
        </div>

        {/* Payments Table */}
        <div className="space-y-0">
          <TableWithControls
            columns={columns}
            data={filteredPayments}
            loading={loading}
            emptyMessage="No hay pagos registrados para el período seleccionado"
            searchMessage="No se encontraron pagos"
            hasSearch={true}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            filters={[
              {
                type: 'select',
                options: [
                  { value: 'transactions', label: 'Transacciones' },
                  { value: 'subscriptions', label: 'Suscripciones' },
                  { value: 'installments', label: 'Cuotas' }
                ],
                value: filterType,
                onChange: setFilterType
              }
            ]}
            onSort={handleSort}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onColumnReorder={handleColumnReorder}
            onColumnVisibilityChange={handleColumnVisibilityChange}
          />

          {/* Paginación */}
          {!loading && totalCount > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={changePage}
              pageSize={pageSize}
              totalItems={totalCount}
              onPageSizeChange={changePageSize}
            />
          )}
        </div>
      </div>

      {/* Modal de confirmación de borrado */}
      <Modal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, payment: null })}
        title="Confirmar eliminación"
        icon={<Icons.alertCircle className="w-5 h-5 text-error" />}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-secondary text-center">
            ¿Estás seguro que deseas eliminar este pago?
          </p>
          {deleteModal.payment && (
            <div className="p-3 glass rounded-lg space-y-1">
              <p className="text-sm"><span className="text-tertiary">Contacto:</span> {deleteModal.payment.contactName || 'Sin nombre'}</p>
              <p className="text-sm"><span className="text-tertiary">Monto:</span> {formatCurrency(deleteModal.payment.amount)}</p>
              <p className="text-sm"><span className="text-tertiary">Fecha:</span> {formatDate(deleteModal.payment.date)}</p>
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
                if (deleteModal.payment) {
                  try {
                    await deletePayment(deleteModal.payment.id)
                    setDeleteModal({ isOpen: false, payment: null })
                    toast.success('Pago eliminado', 'El pago ha sido eliminado correctamente')
                  } catch (error) {
                    console.error('Error al eliminar:', error)
                    toast.error('Error al eliminar', 'No se pudo eliminar el pago. Por favor, intenta nuevamente.')
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
        onClose={() => setEditModal({ isOpen: false, payment: null })}
        title="Editar pago"
        icon={<Icons.edit className="w-5 h-5 text-primary" />}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">Contacto</label>
            <div className="relative">
              {Icons.user && <Icons.user className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tertiary z-10 pointer-events-none" />}
              <input
                type="text"
                className="w-full pl-10 pr-3 py-2 glass rounded-lg border border-glassBorder focus:border-primary focus:outline-none transition-colors"
                value={editForm.contactName || ''}
                onChange={(e) => setEditForm({ ...editForm, contactName: e.target.value })}
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
            <label className="block text-sm font-medium text-secondary mb-2">Descripción</label>
            <div className="relative">
              {Icons.fileText && <Icons.fileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tertiary z-10 pointer-events-none" />}
              <input
                type="text"
                className="w-full pl-10 pr-3 py-2 glass rounded-lg border border-glassBorder focus:border-primary focus:outline-none transition-colors"
                value={editForm.description || ''}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="Descripción del pago"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">Monto</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary font-medium pointer-events-none z-20">$</span>
              <input
                type="text"
                inputMode="decimal"
                className="w-full pl-10 pr-3 py-2 glass rounded-lg border border-glassBorder focus:border-primary focus:outline-none transition-colors font-medium"
                value={editForm.amount || ''}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9.]/g, '');
                  setEditForm({ ...editForm, amount: value });
                }}
                onBlur={(e) => {
                  const value = parseFloat(e.target.value) || 0;
                  setEditForm({ ...editForm, amount: value.toFixed(2) });
                }}
                placeholder="0.00"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">Estado</label>
            <select
              className="w-full px-3 py-2 glass rounded-lg border border-glassBorder focus:border-primary focus:outline-none transition-colors"
              value={editForm.status || 'completed'}
              onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
            >
              <option value="completed">Completado</option>
              <option value="pending">Pendiente</option>
              <option value="refunded">Reembolsado</option>
            </select>
          </div>
          <div className="flex gap-2 pt-2 justify-center">
            <Button
              variant="primary"
              size="sm"
              onClick={async () => {
                if (editModal.payment) {
                  try {
                    await updatePayment(editModal.payment.id, editForm)
                    setEditModal({ isOpen: false, payment: null })
                    toast.success('Pago actualizado', 'Los cambios se han guardado correctamente')
                  } catch (error) {
                    console.error('Error al actualizar:', error)
                    toast.error('Error al actualizar', 'No se pudo actualizar el pago. Por favor, intenta nuevamente.')
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

      {/* Modal de creación de pago */}
      <Modal
        isOpen={createModal.isOpen}
        onClose={() => setCreateModal({ isOpen: false })}
        title="Registrar nuevo pago"
        icon={<Icons.plus className="w-5 h-5 text-primary" />}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">Contacto *</label>
            <ContactSearch
              value={createForm.contactId}
              onChange={(contactId) => setCreateForm({ ...createForm, contactId })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">Monto *</label>
            <div className="relative">
              {Icons.dollarSign && <Icons.dollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tertiary z-10 pointer-events-none" />}
              <input
                type="number"
                step="0.01"
                className="w-full pl-10 pr-3 py-2 glass rounded-lg border border-glassBorder focus:border-primary focus:outline-none transition-colors"
                value={createForm.amount || ''}
                onChange={(e) => setCreateForm({ ...createForm, amount: e.target.value })}
                placeholder="0.00"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">Fecha del pago *</label>
            <div className="relative">
              {Icons.calendar && <Icons.calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tertiary z-10 pointer-events-none" />}
              <input
                type="date"
                className="w-full pl-10 pr-3 py-2 glass rounded-lg border border-glassBorder focus:border-primary focus:outline-none transition-colors"
                value={createForm.date || ''}
                onChange={(e) => setCreateForm({ ...createForm, date: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">Descripción</label>
            <div className="relative">
              {Icons.fileText && <Icons.fileText className="absolute left-3 top-3 w-4 h-4 text-tertiary z-10 pointer-events-none" />}
              <textarea
                className="w-full pl-10 pr-3 py-2 glass rounded-lg border border-glassBorder focus:border-primary focus:outline-none transition-colors"
                value={createForm.description || ''}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                placeholder="Descripción del pago"
                rows={3}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">Método de pago</label>
              <select
                className="w-full px-3 py-2 glass rounded-lg border border-glassBorder focus:border-primary focus:outline-none transition-colors"
                value={createForm.paymentMethod || 'card'}
                onChange={(e) => setCreateForm({ ...createForm, paymentMethod: e.target.value })}
              >
                <option value="card">Tarjeta</option>
                <option value="bank_transfer">Transferencia</option>
                <option value="cash">Efectivo</option>
                <option value="paypal">PayPal</option>
                <option value="other">Otro</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">Estado</label>
              <select
                className="w-full px-3 py-2 glass rounded-lg border border-glassBorder focus:border-primary focus:outline-none transition-colors"
                value={createForm.status || 'completed'}
                onChange={(e) => setCreateForm({ ...createForm, status: e.target.value })}
              >
                <option value="completed">Completado</option>
                <option value="pending">Pendiente</option>
                <option value="refunded">Reembolsado</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 pt-2 justify-center">
            <Button
              variant="default"
              size="sm"
              onClick={() => setCreateModal({ isOpen: false })}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={async () => {
                try {
                  // Validar campos requeridos
                  if (!createForm.contactId || !createForm.amount || !createForm.date) {
                    toast.error('Campos requeridos', 'Por favor completa todos los campos obligatorios')
                    return
                  }

                  await createPayment({
                    contactId: createForm.contactId,
                    amount: parseFloat(createForm.amount),
                    date: createForm.date,
                    description: createForm.description || 'Pago manual',
                    paymentMethod: createForm.paymentMethod || 'card',
                    status: createForm.status || 'completed'
                  })

                  setCreateModal({ isOpen: false })
                  toast.success('Pago registrado', 'El pago se ha registrado exitosamente')
                } catch (error) {
                  console.error('Error al crear pago:', error)
                  toast.error('Error al registrar', 'No se pudo registrar el pago. Por favor, intenta nuevamente.')
                }
              }}
            >
              <Icons.check className="w-4 h-4 mr-2" />
              Registrar pago
            </Button>
          </div>
        </div>
      </Modal>
    </PageContainer>
  )
}
