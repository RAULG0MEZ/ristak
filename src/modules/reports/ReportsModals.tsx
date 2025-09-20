import React, { useState, useEffect } from 'react'
import { Modal, Badge, TableWithControls } from '../../ui'
import { Icons } from '../../icons'
import { formatCurrency, formatDate, cn } from '../../lib/utils'
import { getApiUrl, fetchWithAuth } from '../../config/api'

interface Contact {
  contact_id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  created_at: string
  status: string
  attribution_ad_id: string | null
}

interface Payment {
  id: string
  contact_id: string
  amount: number
  status: string
  created_at: string
  paid_at: string | null
  contact?: Contact
  payment_count?: number
  payment_details?: Array<{
    amount: number
    date: string
  }>
}

interface Appointment {
  id: string
  contact_id: string
  appointment_date: string
  created_at: string
  status: string
  contact?: Contact
}

interface ReportsModalsProps {
  periodStart: string
  periodEnd: string
  reportType: 'cashflow' | 'campaigns' // 'cashflow' = Todos, 'campaigns' = Atribuidos
  modalType: 'sales' | 'leads' | 'appointments' | 'new_customers' | null
  onClose: () => void
}

export function ReportsModals({ periodStart, periodEnd, reportType, modalType, onClose }: ReportsModalsProps) {
  const [salesModalOpen, setSalesModalOpen] = useState(modalType === 'sales')
  const [leadsModalOpen, setLeadsModalOpen] = useState(modalType === 'leads')
  const [appointmentsModalOpen, setAppointmentsModalOpen] = useState(modalType === 'appointments')
  const [newCustomersModalOpen, setNewCustomersModalOpen] = useState(modalType === 'new_customers')
  
  const [sales, setSales] = useState<Payment[]>([])
  const [leads, setLeads] = useState<Contact[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [newCustomers, setNewCustomers] = useState<Contact[]>([])
  
  const [loading, setLoading] = useState(false)

  // Abrir el modal correcto según el tipo
  useEffect(() => {
    if (modalType === 'sales') {
      setSalesModalOpen(true)
      loadSales()
    } else if (modalType === 'leads') {
      setLeadsModalOpen(true)
      loadLeads()
    } else if (modalType === 'appointments') {
      setAppointmentsModalOpen(true)
      loadAppointments()
    } else if (modalType === 'new_customers') {
      setNewCustomersModalOpen(true)
      loadNewCustomers()
    }
  }, [modalType, periodStart, periodEnd, reportType])

  const loadSales = async () => {
    setLoading(true)
    try {
      // Para "Todos": todas las ventas en el período
      // Para "Atribuidos": solo ventas de contactos con attribution_ad_id creados en el período
      const endpoint = reportType === 'campaigns' 
        ? `/reports/sales/attributed?start=${periodStart}&end=${periodEnd}`
        : `/reports/sales?start=${periodStart}&end=${periodEnd}`
      
      const res = await fetchWithAuth(getApiUrl(endpoint))
      if (!res.ok) throw new Error('Failed to load sales')
      const data = await res.json()
      setSales(data.data || [])
    } catch (error) {
      console.error('Error loading sales:', error)
      setSales([])
    } finally {
      setLoading(false)
    }
  }

  const loadLeads = async () => {
    setLoading(true)
    try {
      // Para "Todos": todos los leads creados en el período
      // Para "Atribuidos": solo leads con attribution_ad_id creados en el período
      const endpoint = reportType === 'campaigns'
        ? `/reports/leads/attributed?start=${periodStart}&end=${periodEnd}`
        : `/reports/leads?start=${periodStart}&end=${periodEnd}`
      
      const res = await fetchWithAuth(getApiUrl(endpoint))
      if (!res.ok) throw new Error('Failed to load leads')
      const data = await res.json()
      setLeads(data.data || [])
    } catch (error) {
      console.error('Error loading leads:', error)
      setLeads([])
    } finally {
      setLoading(false)
    }
  }

  const loadAppointments = async () => {
    setLoading(true)
    try {
      // Para "Todos": todas las citas creadas en el período
      // Para "Atribuidos": solo citas de contactos con attribution_ad_id
      const endpoint = reportType === 'campaigns'
        ? `/reports/appointments/attributed?start=${periodStart}&end=${periodEnd}`
        : `/reports/appointments?start=${periodStart}&end=${periodEnd}`
      
      const res = await fetchWithAuth(getApiUrl(endpoint))
      if (!res.ok) throw new Error('Failed to load appointments')
      const data = await res.json()
      setAppointments(data.data || [])
    } catch (error) {
      console.error('Error loading appointments:', error)
      setAppointments([])
    } finally {
      setLoading(false)
    }
  }

  const loadNewCustomers = async () => {
    setLoading(true)
    try {
      // Para "Todos": clientes con primer pago en el período
      // Para "Atribuidos": contactos atribuidos creados en el período QUE TIENEN PAGOS
      const endpoint = reportType === 'campaigns'
        ? `/reports/new-customers/attributed?start=${periodStart}&end=${periodEnd}`
        : `/reports/new-customers?start=${periodStart}&end=${periodEnd}`
      
      const res = await fetchWithAuth(getApiUrl(endpoint))
      if (!res.ok) throw new Error('Failed to load new customers')
      const data = await res.json()
      setNewCustomers(data.data || [])
    } catch (error) {
      console.error('Error loading new customers:', error)
      setNewCustomers([])
    } finally {
      setLoading(false)
    }
  }

  // Columnas para tabla de TRANSACCIONES (solo pagos del período)
  const salesColumns = [
    {
      id: 'contact',
      label: 'Cliente',
      visible: true,
      render: (_: any, row: Payment) => {
        const name = row.contact 
          ? `${row.contact.first_name || ''} ${row.contact.last_name || ''}`.trim() || 'Sin nombre'
          : 'Sin contacto'
        return (
          <div>
            <div className="font-medium text-primary">{name}</div>
            {row.contact?.email && (
              <div className="text-sm text-secondary">{row.contact.email}</div>
            )}
          </div>
        )
      }
    },
    {
      id: 'payment_date',
      label: 'Fecha de pago',
      visible: true,
      render: (value: string) => (
        <span className="text-primary">{formatDate(value || new Date())}</span>
      )
    },
    {
      id: 'amount',
      label: 'Monto de transacción',
      visible: true,
      align: 'right' as const,
      render: (value: number) => (
        <div className="font-medium text-primary">{formatCurrency(value)}</div>
      )
    },
    {
      id: 'status',
      label: 'Estado',
      visible: true,
      render: (value: string) => (
        <Badge variant={value === 'completed' ? 'success' : 'warning'}>
          {value === 'completed' ? 'Completado' : 'Pendiente'}
        </Badge>
      )
    },
    {
      id: 'paid_at',
      label: 'Fecha(s) de pago',
      visible: true,
      render: (value: string | null, row: Payment) => (
        <div className="text-secondary">
          {row.payment_count && row.payment_count > 1 ? (
            <div>
              <div>Primer pago: {formatDate(row.created_at)}</div>
              <div className="text-xs">Último pago: {formatDate(value || row.created_at)}</div>
            </div>
          ) : (
            <span>{formatDate(value || row.created_at)}</span>
          )}
        </div>
      )
    },
    {
      id: 'attribution',
      label: 'Atribución',
      visible: reportType === 'campaigns',
      render: (_: any, row: Payment) => (
        <Badge variant={row.contact?.attribution_ad_id ? 'default' : 'secondary'}>
          {row.contact?.attribution_ad_id ? 'Atribuido' : 'Sin atribución'}
        </Badge>
      )
    }
  ]

  // Columnas para tabla de leads
  const leadsColumns = [
    {
      id: 'name',
      label: 'Nombre',
      visible: true,
      render: (_: any, row: Contact) => {
        const name = `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Sin nombre'
        return <span className="font-medium text-primary">{name}</span>
      }
    },
    {
      id: 'email',
      label: 'Email',
      visible: true,
      render: (value: string) => (
        <span className="text-secondary">{value || '-'}</span>
      )
    },
    {
      id: 'phone',
      label: 'Teléfono',
      visible: true,
      render: (value: string) => (
        <span className="text-secondary">{value || '-'}</span>
      )
    },
    {
      id: 'created_at',
      label: 'Fecha de creación',
      visible: true,
      render: (value: string) => (
        <span className="text-secondary">{formatDate(value)}</span>
      )
    },
    {
      id: 'status',
      label: 'Estado',
      visible: true,
      render: (value: string) => {
        const statusMap: Record<string, { label: string; variant: 'success' | 'warning' | 'error' | 'default' }> = {
          'new': { label: 'Nuevo', variant: 'default' },
          'contacted': { label: 'Contactado', variant: 'warning' },
          'qualified': { label: 'Calificado', variant: 'success' },
          'client': { label: 'Cliente', variant: 'success' }
        }
        const status = statusMap[value] || { label: value, variant: 'default' }
        return <Badge variant={status.variant}>{status.label}</Badge>
      }
    },
    {
      id: 'attribution',
      label: 'Atribución',
      visible: reportType === 'campaigns',
      render: (_: any, row: Contact) => (
        <Badge variant={row.attribution_ad_id ? 'default' : 'secondary'}>
          {row.attribution_ad_id ? 'Atribuido' : 'Sin atribución'}
        </Badge>
      )
    }
  ]

  // Columnas para tabla de citas
  const appointmentsColumns = [
    {
      id: 'contact',
      label: 'Contacto',
      visible: true,
      render: (_: any, row: Appointment) => {
        const name = row.contact 
          ? `${row.contact.first_name || ''} ${row.contact.last_name || ''}`.trim() || 'Sin nombre'
          : 'Sin contacto'
        return (
          <div>
            <div className="font-medium text-primary">{name}</div>
            {row.contact?.phone && (
              <div className="text-sm text-secondary">{row.contact.phone}</div>
            )}
          </div>
        )
      }
    },
    {
      id: 'appointment_date',
      label: 'Fecha de cita',
      visible: true,
      render: (value: string) => (
        <span className="text-primary">{formatDate(value)}</span>
      )
    },
    {
      id: 'status',
      label: 'Estado',
      visible: true,
      render: (value: string) => {
        const statusMap: Record<string, { label: string; variant: 'success' | 'warning' | 'error' | 'default' }> = {
          'scheduled': { label: 'Agendada', variant: 'warning' },
          'completed': { label: 'Completada', variant: 'success' },
          'cancelled': { label: 'Cancelada', variant: 'error' },
          'no_show': { label: 'No asistió', variant: 'error' }
        }
        const status = statusMap[value] || { label: value, variant: 'default' }
        return <Badge variant={status.variant}>{status.label}</Badge>
      }
    },
    {
      id: 'created_at',
      label: 'Creada el',
      visible: true,
      render: (value: string) => (
        <span className="text-secondary">{formatDate(value)}</span>
      )
    },
    {
      id: 'attribution',
      label: 'Atribución',
      visible: reportType === 'campaigns',
      render: (_: any, row: Appointment) => (
        <Badge variant={row.contact?.attribution_ad_id ? 'default' : 'secondary'}>
          {row.contact?.attribution_ad_id ? 'Atribuido' : 'Sin atribución'}
        </Badge>
      )
    }
  ]

  const handleCloseModal = () => {
    setSalesModalOpen(false)
    setLeadsModalOpen(false)
    setAppointmentsModalOpen(false)
    setNewCustomersModalOpen(false)
    onClose()
  }

  // Columnas para tabla de CLIENTES NUEVOS (con lifetime value)
  const newCustomersColumns = [
    {
      id: 'name',
      label: 'Cliente',
      visible: true,
      render: (_: any, row: Contact) => {
        const name = `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Sin nombre'
        return (
          <div>
            <div className="font-medium text-primary">{name}</div>
            {row.email && (
              <div className="text-sm text-secondary">{row.email}</div>
            )}
            {row.phone && (
              <div className="text-xs text-tertiary">{row.phone}</div>
            )}
          </div>
        )
      }
    },
    {
      id: 'lifetime_value',
      label: 'Total Lifetime Value',
      visible: true,
      align: 'right' as const,
      render: (_: any, row: any) => (
        <div className="text-right">
          <div className="font-medium text-lg text-primary">
            {formatCurrency(row.lifetime_value || row.total_amount || 0)}
          </div>
          {row.payment_count && row.payment_count > 0 && (
            <div className="text-xs text-secondary">
              {row.payment_count} pago{row.payment_count !== 1 ? 's' : ''} totales
            </div>
          )}
        </div>
      )
    },
    {
      id: 'first_payment_date',
      label: 'Primer pago',
      visible: true,
      render: (value: string, row: any) => (
        <div>
          {value && (
            <div className="text-sm">
              <span className="text-tertiary">Primer pago: </span>
              <span className="text-primary">{formatDate(value)}</span>
            </div>
          )}
          {row.last_payment_date && (
            <div className="text-sm">
              <span className="text-tertiary">Último pago: </span>
              <span className="text-primary">{formatDate(row.last_payment_date)}</span>
            </div>
          )}
        </div>
      )
    },
    {
      id: 'created_at',
      label: 'Cliente desde',
      visible: true,
      render: (value: string) => (
        <span className="text-secondary">{formatDate(value)}</span>
      )
    },
    {
      id: 'attribution',
      label: 'Atribución',
      visible: true,
      render: (_: any, row: Contact) => (
        <Badge variant={row.attribution_ad_id ? 'default' : 'secondary'}>
          {row.attribution_ad_id ? 'Atribuido' : 'Sin atribución'}
        </Badge>
      )
    }
  ]

  return (
    <>

      {/* Modal de TRANSACCIONES - Solo pagos del período */}
      <Modal
        isOpen={salesModalOpen}
        onClose={handleCloseModal}
        title="Transacciones del Período"
        size="xl"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-secondary">
              Mostrando únicamente transacciones realizadas en el período seleccionado
            </p>
            <Badge variant="default">
              {sales.length} transacci{sales.length === 1 ? 'ón' : 'ones'}
            </Badge>
          </div>

          <TableWithControls
            columns={salesColumns.filter(c => c.visible)}
            data={sales}
            loading={loading}
            emptyMessage="No hay transacciones en este período"
          />

          {sales.length > 0 && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
              <div className="flex justify-between items-center">
                <span className="text-secondary">Total del período:</span>
                <span className="text-xl font-semibold text-primary">
                  {formatCurrency(sales.reduce((sum, s) => sum + (s.amount || 0), 0))}
                </span>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal de Leads */}
      <Modal
        isOpen={leadsModalOpen}
        onClose={handleCloseModal}
        title={`Leads - ${reportType === 'campaigns' ? 'Atribuidos' : 'Todos'}`}
        size="xl"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-secondary">
              Mostrando leads creados en el período
              {reportType === 'campaigns' && ' (solo con atribución)'}
            </p>
            <Badge variant="default">
              {leads.length} lead{leads.length !== 1 ? 's' : ''}
            </Badge>
          </div>

          <TableWithControls
            columns={leadsColumns.filter(c => c.visible)}
            data={leads}
            loading={loading}
            emptyMessage="No hay leads en este período"
          />
        </div>
      </Modal>

      {/* Modal de Citas */}
      <Modal
        isOpen={appointmentsModalOpen}
        onClose={handleCloseModal}
        title={`Citas - ${reportType === 'campaigns' ? 'Atribuidas' : 'Todas'}`}
        size="xl"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-secondary">
              Mostrando citas del período
              {reportType === 'campaigns' && ' (solo contactos con atribución)'}
            </p>
            <Badge variant="default">
              {appointments.length} cita{appointments.length !== 1 ? 's' : ''}
            </Badge>
          </div>

          <TableWithControls
            columns={appointmentsColumns.filter(c => c.visible)}
            data={appointments}
            loading={loading}
            emptyMessage="No hay citas en este período"
          />
        </div>
      </Modal>

      {/* Modal de Clientes Nuevos */}
      <Modal
        isOpen={newCustomersModalOpen}
        onClose={handleCloseModal}
        title={`Clientes nuevos - ${reportType === 'campaigns' ? 'Atribuidos' : 'Todos'}`}
        size="xl"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-secondary">
              {reportType === 'campaigns' 
                ? 'Contactos creados con atribución en el período'
                : 'Clientes con su primer pago en el período'
              }
            </p>
            <Badge variant="default">
              {newCustomers.length} cliente{newCustomers.length !== 1 ? 's' : ''} nuevo{newCustomers.length !== 1 ? 's' : ''}
            </Badge>
          </div>

          <TableWithControls
            columns={newCustomersColumns.filter(c => c.visible)}
            data={newCustomers}
            loading={loading}
            emptyMessage="No hay clientes nuevos en este período"
          />

          {newCustomers.length > 0 && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
              <div className="flex justify-between items-center">
                <span className="text-secondary">Lifetime value total:</span>
                <span className="text-xl font-semibold text-primary">
                  {formatCurrency(newCustomers.reduce((sum, c: any) => sum + (c.lifetime_value || c.total_amount || 0), 0))}
                </span>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </>
  )
}