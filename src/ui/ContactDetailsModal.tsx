import React, { useState, useMemo, useEffect } from 'react'
import { Modal } from './Modal'
import { Icons } from '../icons'
import { formatCurrency, formatNumber, cn } from '../lib/utils'
import { formatDateLong, formatDateShort } from '../lib/dateUtils'
import { Badge } from './Badge'
import { getApiUrl, fetchWithAuth } from '../config/api'
import { useTheme } from '../contexts/ThemeContext'

// Tipo genérico agnóstico para representar un contacto/elemento único
interface ContactDetail {
  id: string
  name?: string
  email?: string
  phone?: string
  createdAt: string | Date
  // Campos adicionales del dominio
  status?: string
  value?: number
  type?: string
  // Metadatos flexibles
  metadata?: Record<string, any>
}

interface ContactDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle?: string
  // Datos
  data: ContactDetail[]
  loading: boolean
  // Tipo de métrica (para saber qué mostrar)
  type?: 'leads' | 'appointments' | 'sales' | null
  // Contador total esperado para validación
  expectedCount?: number
  // Callbacks opcionales
  onContactSelect?: (contact: ContactDetail) => void
  // Personalización de columnas
  columns?: {
    key: string
    label: string
    render?: (value: any, row: ContactDetail) => React.ReactNode
    align?: 'left' | 'right' | 'center'
  }[]
}

// Tipo para transacciones/pagos
interface Transaction {
  id: string
  amount: number
  date: string
  status: string
  description?: string
}

// Tipo para el journey del contacto
interface ContactJourney {
  pageviews: Array<{
    url: string
    timestamp: string
    source?: string
  }>
  ads: Array<{
    campaign: string
    adSet: string
    ad: string
    clickDate?: string
  }>
}

export function ContactDetailsModal({
  isOpen,
  onClose,
  title,
  subtitle,
  data,
  loading,
  type,
  expectedCount,
  onContactSelect,
  columns
}: ContactDetailsModalProps) {
  const { theme } = useTheme()
  const [selectedContact, setSelectedContact] = useState<ContactDetail | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'list' | 'detail'>('list')
  const [showTransactions, setShowTransactions] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [journey, setJourney] = useState<ContactJourney | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)

  // Seleccionar automáticamente el primer contacto cuando se cargan los datos
  useEffect(() => {
    if (data.length > 0 && !selectedContact) {
      const firstContact = data[0]
      setSelectedContact(firstContact)
      handleContactClick(firstContact)
    }
  }, [data])

  // Filtrar contactos según búsqueda
  const filteredData = useMemo(() => {
    if (!searchQuery) return data

    const query = searchQuery.toLowerCase()
    return data.filter(contact =>
      contact.name?.toLowerCase().includes(query) ||
      contact.email?.toLowerCase().includes(query) ||
      contact.phone?.toLowerCase().includes(query) ||
      contact.id?.toLowerCase().includes(query)
    )
  }, [data, searchQuery])

  // Columnas por defecto si no se especifican
  const defaultColumns = [
    {
      key: 'name',
      label: 'Nombre',
      render: (value: any, row: ContactDetail) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full glass flex items-center justify-center">
            <Icons.user className="w-4 h-4 text-tertiary" />
          </div>
          <div>
            <p className="text-sm font-medium text-primary">
              {value || 'Sin nombre'}
            </p>
            {row.email && (
              <p className="text-xs text-tertiary">{row.email}</p>
            )}
          </div>
        </div>
      )
    },
    {
      key: 'phone',
      label: 'Teléfono',
      render: (value: any) => value || '-'
    },
    {
      key: 'status',
      label: 'Estado',
      render: (value: any) => value ? (
        <Badge variant={value === 'active' ? 'success' : 'default'}>
          {value}
        </Badge>
      ) : '-'
    },
    {
      key: 'createdAt',
      label: 'Fecha',
      align: 'right' as const,
      render: (value: any) => {
        if (!value) return '-'
        return formatDateShort(value)
      }
    }
  ]

  const displayColumns = columns || defaultColumns

  const handleContactClick = async (contact: ContactDetail) => {
    setSelectedContact(contact)
    onContactSelect?.(contact)

    // Cargar detalles adicionales del contacto (journey y transacciones)
    if (contact.id) {
      setLoadingDetails(true)
      try {
        // Cargar transacciones si es una venta o cliente
        if (type === 'sales' || contact.status === 'client') {
          const paymentsRes = await fetchWithAuth(
            getApiUrl(`/payments?contact_id=${contact.id}`)
          )
          if (paymentsRes.ok) {
            const paymentsData = await paymentsRes.json()
            // Transformar los pagos al formato de transacciones que espera el modal
            const trans = (paymentsData.data || []).map((payment: any) => ({
              id: payment.id || payment.transactionId,
              amount: payment.amount || 0,
              date: payment.date || payment.createdAt,
              status: payment.status || 'completed',
              description: payment.description || payment.invoiceNumber || 'Pago'
            }))
            setTransactions(trans)
          }
        }

        // TODO: Cargar journey del contacto cuando tengamos el endpoint
        // const journeyRes = await fetchWithAuth(
        //   getApiUrl(`/tracking/journey?contact_id=${contact.id}`)
        // )
        // if (journeyRes.ok) {
        //   const journeyData = await journeyRes.json()
        //   setJourney(journeyData)
        // }
      } catch (error) {
        console.error('Error loading contact details:', error)
      } finally {
        setLoadingDetails(false)
      }
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      size="xl"
      showCloseButton={false}
    >
      <div className="-m-6 h-[600px] flex flex-col">
        {/* Header simple sin efectos */}
        <div className="px-6 py-4 border-b border-primary">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-primary">{title}</h3>
              {subtitle && (
                <p className="text-sm text-secondary mt-1">{subtitle}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg glass flex items-center justify-center"
            >
              <Icons.x className="w-4 h-4 text-tertiary" />
            </button>
          </div>

          {/* Stats simples */}
          <div className="flex items-center gap-4 mt-3">
            <span className="text-sm text-secondary">
              {data.length} {data.length === 1 ? 'elemento' : 'elementos'}
            </span>
            {type === 'sales' && data.some(d => d.value) && (
              <span className="text-sm font-medium text-primary">
                Total: {formatCurrency(data.reduce((sum, d) => sum + (d.value || 0), 0))}
              </span>
            )}
            {expectedCount && expectedCount !== data.length && (
              <Badge variant="warning" size="sm">
                Se esperaban {expectedCount}
              </Badge>
            )}
          </div>
        </div>

        {/* Contenido principal con mejor distribución */}
        <div className="flex flex-1 overflow-hidden">
          {/* Panel izquierdo - Lista mejorada */}
          <div className={cn(
            "flex flex-col",
            selectedContact && activeTab === 'detail' ? "hidden md:flex md:w-[380px]" : "flex flex-1",
            selectedContact ? "border-r border-primary" : ""
          )}>
            {/* Barra de búsqueda simple */}
            <div className="p-4 border-b border-primary">
              <div className="relative">
                <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tertiary" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 glass border border-primary rounded-lg text-sm text-primary placeholder-tertiary focus:outline-none focus-ring"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    <Icons.x className="w-4 h-4 text-tertiary" />
                  </button>
                )}
              </div>
            </div>

            {/* Lista de contactos con diseño mejorado */}
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full p-8">
                  <div className="w-12 h-12 flex items-center justify-center mb-3">
                    <Icons.refresh className="w-6 h-6 text-primary animate-spin" />
                  </div>
                  <p className="text-sm text-secondary">Cargando elementos...</p>
                </div>
              ) : filteredData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-8">
                  <div className="w-12 h-12 flex items-center justify-center mb-3">
                    <Icons.users className="w-6 h-6 text-tertiary" />
                  </div>
                  <p className="text-sm text-secondary">
                    {searchQuery ? 'No se encontraron resultados' : 'No hay elementos para mostrar'}
                  </p>
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="mt-3 text-xs text-primary hover:underline"
                    >
                      Limpiar búsqueda
                    </button>
                  )}
                </div>
              ) : (
                <div>
                  {filteredData.map((contact) => (
                    <div
                      key={contact.id}
                      onClick={() => handleContactClick(contact)}
                      className={cn(
                        "p-3 cursor-pointer border-b border-primary hover:bg-primary/5",
                        selectedContact?.id === contact.id && "bg-primary/10"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {/* Avatar simple */}
                        <div className="w-8 h-8 rounded-full glass flex items-center justify-center">
                          <Icons.user className="w-4 h-4 text-tertiary" />
                        </div>

                        {/* Info del contacto */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-primary truncate">
                            {contact.name || 'Sin nombre'}
                          </p>
                          <p className="text-xs text-secondary truncate">
                            {contact.email || contact.phone || 'Sin datos de contacto'}
                          </p>
                        </div>

                        {/* Indicadores según el tipo */}
                        <div className="flex flex-col items-end gap-1">
                          {type === 'sales' && contact.value && (
                            <span className="text-sm font-semibold text-success">
                              {formatCurrency(contact.value)}
                            </span>
                          )}
                          {contact.status && (
                            <Badge
                              variant={
                                contact.status === 'completed' || contact.status === 'active' ? 'success' :
                                contact.status === 'pending' ? 'warning' : 'default'
                              }
                              size="sm"
                            >
                              {contact.status}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer simple */}
            {data.length > 0 && (
              <div className="p-3 border-t border-primary">
                <span className="text-xs text-tertiary">
                  Mostrando {filteredData.length} de {data.length}
                </span>
              </div>
            )}
          </div>

          {/* Panel derecho - Detalles mejorados */}
          {selectedContact && (
            <div className={cn(
              "flex flex-col bg-secondary",
              activeTab === 'list' ? "hidden md:flex md:flex-1" : "flex flex-1"
            )}>
              {/* Header del detalle simple */}
              <div className="p-4 border-b border-primary">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full glass flex items-center justify-center">
                    <Icons.user className="w-5 h-5 text-tertiary" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold text-primary">
                      {selectedContact.name || 'Sin nombre'}
                    </h4>
                    <p className="text-sm text-secondary mt-0.5">
                      {selectedContact.email || 'Sin email'}
                    </p>
                    {selectedContact.phone && (
                      <p className="text-sm text-secondary">
                        {selectedContact.phone}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Contenido del detalle */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-4">
                  {/* Información básica */}
                  <div>
                    <h5 className="text-xs font-medium text-tertiary uppercase tracking-wider mb-3">
                      Información de Contacto
                    </h5>
                    <div className="space-y-2">
                      {selectedContact.email && (
                        <div className="flex items-center gap-2">
                          <Icons.send className="w-4 h-4 text-tertiary" />
                          <span className="text-sm text-secondary">{selectedContact.email}</span>
                        </div>
                      )}
                      {selectedContact.phone && (
                        <div className="flex items-center gap-2">
                          <Icons.phone className="w-4 h-4 text-tertiary" />
                          <span className="text-sm text-secondary">{selectedContact.phone}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Icons.calendar className="w-4 h-4 text-tertiary" />
                        <span className="text-sm text-secondary">
                          {formatDateLong(selectedContact.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Estado y métricas */}
                  {(selectedContact.status || selectedContact.value) && (
                    <div>
                      <h5 className="text-xs font-medium text-tertiary uppercase tracking-wider mb-3">
                        Métricas
                      </h5>
                      <div className="grid grid-cols-2 gap-3">
                        {selectedContact.status && (
                          <div className="glass rounded-lg p-3">
                            <p className="text-xs text-tertiary mb-1">Estado</p>
                            <Badge
                              variant={
                                selectedContact.status === 'active' || selectedContact.status === 'client' ? 'success' :
                                selectedContact.status === 'completed' ? 'info' :
                                selectedContact.status === 'appointment' ? 'warning' :
                                'default'
                              }
                              size="sm"
                            >
                              {selectedContact.status}
                            </Badge>
                          </div>
                        )}
                        {selectedContact.value !== undefined && (
                          <div className="glass rounded-lg p-3">
                            <p className="text-xs text-tertiary mb-1">Valor</p>
                            <p className="text-sm font-medium text-primary">
                              {formatCurrency(selectedContact.value)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Customer Journey */}
                  {selectedContact.metadata?.campaign && (
                    <div>
                      <h5 className="text-xs font-medium text-tertiary uppercase tracking-wider mb-3">
                        Atribución
                      </h5>
                      <div className="space-y-1 text-sm text-secondary">
                        <div>Campaña: {selectedContact.metadata.campaign}</div>
                        {selectedContact.metadata.adSet && <div>Ad Set: {selectedContact.metadata.adSet}</div>}
                        {selectedContact.metadata.ad && <div>Anuncio: {selectedContact.metadata.ad}</div>}
                      </div>
                    </div>
                  )}

                  {/* Páginas visitadas (cuando tengamos el endpoint) */}
                  {journey?.pageviews && journey.pageviews.length > 0 && (
                    <div className="glass-morphism rounded-xl p-4">
                      <h5 className="text-xs font-semibold text-tertiary uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Icons.compass className="w-3 h-3" />
                        Páginas Visitadas
                      </h5>
                      <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
                        {journey.pageviews.map((page, idx) => (
                          <div key={idx} className="p-2 rounded-lg glass-hover">
                            <p className="text-xs text-tertiary">
                              {new Date(page.timestamp).toLocaleTimeString('es-ES', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                            <p className="text-sm text-primary">{page.url}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Transacciones */}
                  {(type === 'sales' || selectedContact.status === 'client') && (
                    <div>
                      <button
                        className="w-full flex items-center justify-between mb-3"
                        onClick={() => setShowTransactions(!showTransactions)}
                      >
                        <h5 className="text-xs font-medium text-tertiary uppercase tracking-wider">
                          Transacciones {transactions.length > 0 && `(${transactions.length})`}
                        </h5>
                        <Icons.chevronDown className={cn(
                          "w-4 h-4 text-tertiary",
                          showTransactions && "rotate-180"
                        )} />
                      </button>

                      {showTransactions && (
                        <div className="space-y-2">
                          {loadingDetails ? (
                            <div className="text-center py-4">
                              <Icons.refresh className="w-5 h-5 text-tertiary mx-auto animate-spin" />
                            </div>
                          ) : transactions.length > 0 ? (
                            <>
                              <div className="glass rounded-lg p-3 mb-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-tertiary">Total</span>
                                  <span className="text-sm font-medium text-primary">
                                    {formatCurrency(transactions.reduce((sum, t) => sum + t.amount, 0))}
                                  </span>
                                </div>
                              </div>
                              <div className="space-y-2 max-h-48 overflow-y-auto">
                                {transactions.map((transaction) => (
                                  <div key={transaction.id} className="glass rounded-lg p-2">
                                    <div className="flex justify-between">
                                      <div>
                                        <p className="text-xs text-secondary">
                                          {formatDateShort(transaction.date)}
                                        </p>
                                        {transaction.description && (
                                          <p className="text-xs text-tertiary">{transaction.description}</p>
                                        )}
                                      </div>
                                      <span className="text-sm font-medium text-primary">
                                        {formatCurrency(transaction.amount)}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </>
                          ) : (
                            <div className="text-center py-4">
                              <p className="text-xs text-tertiary">No hay transacciones registradas</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Metadatos adicionales */}
                  {selectedContact.metadata && Object.keys(selectedContact.metadata).filter(key =>
                    !['campaign', 'adSet', 'ad', 'source'].includes(key)
                  ).length > 0 && (
                    <div>
                      <h5 className="text-xs font-medium text-tertiary uppercase tracking-wider mb-3">
                        Información adicional
                      </h5>
                      <div className="space-y-2">
                        {Object.entries(selectedContact.metadata)
                          .filter(([key]) => !['campaign', 'adSet', 'ad', 'source'].includes(key))
                          .map(([key, value]) => (
                          <div key={key} className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-800">
                            <span className="text-xs text-tertiary capitalize">
                              {key.replace(/_/g, ' ')}
                            </span>
                            <span className="text-sm text-secondary">
                              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}