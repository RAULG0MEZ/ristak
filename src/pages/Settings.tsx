import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { PageContainer, Card, Button, DatePicker, Modal } from '../ui'
import { Icons } from '../icons'
import { cn } from '../lib/utils'
import { dateToApiString, subtractMonths } from '../lib/dateUtils'
import { CSVImportModal } from '../modules/import/CSVImportModal'
import type { ImportType } from '../lib/csvUtils'
import { useImportJobs } from '../hooks/useImportJobs'
import { ImportProgress } from '../ui/ImportProgress'
import { useToastActions } from '../hooks/useToast'
import { getApiUrl, fetchWithAuth } from '../config/api'
import { TrackingSection } from '../modules/tracking/TrackingSection'
import { useSettings } from '../contexts/SettingsContext'

interface WebhookEndpoint {
  name: string
  url: string
  method: string
  description: string
  fields: {
    name: string
    required: boolean
    description: string
  }[]
}

export function Settings() {
  const [activeSection, setActiveSection] = useState('account')
  const [copiedText, setCopiedText] = useState('')
  
  // Account IDs state - Se cargarán dinámicamente desde el backend
  const [accountConfig, setAccountConfig] = useState({
    webhook_base_url: '',
    webhook_endpoints: {
      contacts: '',
      appointments: '',
      payments: '',
      refunds: ''
    },
    tracking: {
      host: '',
      snippet_url: '',
      snippet_code: ''
    },
    account: {
      id: ''
    }
  })
  const [isAccountConfigLoading, setIsAccountConfigLoading] = useState(true)

  // Meta integration state
  const [metaConfig, setMetaConfig] = useState<null | {
    ad_account_id?: string
    ad_account_name?: string
    pixel_id?: string
    pixel_name?: string
  }>(null)
  const [metaStatus, setMetaStatus] = useState<{ running: boolean; message?: string } | null>(null)
  const [showMetaModal, setShowMetaModal] = useState(false)
  const [adAccounts, setAdAccounts] = useState<any[]>([])
  const [pixels, setPixels] = useState<any[]>([])
  const [selectedAdAccount, setSelectedAdAccount] = useState<string>('')
  const [selectedPixel, setSelectedPixel] = useState<string>('')
  const [sinceDate, setSinceDate] = useState<string>('')
  const [schedule, setSchedule] = useState<string>('1h')
  const [showDisconnectModal, setShowDisconnectModal] = useState(false)
  const [isConfiguring, setIsConfiguring] = useState(false)
  const [configError, setConfigError] = useState<string | null>(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importType, setImportType] = useState<ImportType>('contacts')
  
  // Hook para jobs de importación
  const { jobs: importJobs, refreshJobs } = useImportJobs()
  const toast = useToastActions()
  const { settings, updateSettings: persistSettings, loading: settingsLoading } = useSettings()

  const buildAccountData = useCallback(() => ({
    account_name: settings.account_name || '',
    user_name: settings.user_name || '',
    user_email: settings.user_email || '',
    user_phone: settings.user_phone || '',
    user_city: settings.user_city || '',
    user_business_name: settings.user_business_name || '',
    timezone: settings.timezone || 'America/Mexico_City',
    currency: settings.currency || 'MXN',
    user_zip_code: settings.user_zip_code || '',
    user_tax: settings.user_tax || 'IVA',
    user_tax_percentage: settings.user_tax_percentage ?? 16,
    account_logo: settings.account_logo || '',
    account_profile_picture: settings.account_profile_picture || ''
  }), [settings])
  
  // Account configuration state
  const [accountData, setAccountData] = useState(buildAccountData)
  const [isEditingAccount, setIsEditingAccount] = useState(false)
  const [isSavingAccount, setIsSavingAccount] = useState(false)

  useEffect(() => {
    let mounted = true; // Flag para evitar actualizaciones después de desmontar

    // Load account IDs configuration - ahora desde settings/domains-config con variables de entorno
    fetchWithAuth(getApiUrl('/settings/domains-config'))
      .then(r => r.json())
      .then(res => {
        if (mounted && res?.data) {
          // Combinar la configuración de dominios con el account existente
          setAccountConfig(prev => ({
            ...res.data,
            account: prev.account || { id: '' }
          }))
        }
      })
      .catch((error) => {
        console.error('Error cargando configuración de dominios:', error)
      })
      .finally(() => {
        if (mounted) {
          setIsAccountConfigLoading(false)
        }
      })

    // Load existing config to render selected values
    fetchWithAuth(getApiUrl('/meta/config')).then(r => r.json()).then(res => {
      if (mounted && res?.data) setMetaConfig(res.data)
    }).catch(() => {})

    // Poll sync status
    const tick = () => {
      if (mounted) {
        fetchWithAuth(getApiUrl('/meta/sync/status'))
          .then(r => r.json())
          .then(res => {
            if (mounted) setMetaStatus(res?.data || null)
          })
          .catch(() => {})
      }
    }
    tick()
    const id = setInterval(tick, 5000)

    // Account configuration removed - endpoint doesn't exist
    // setAccountData with default values if needed

    return () => {
      mounted = false; // Evitar actualizaciones de estado
      clearInterval(id)
    }
  }, [])

  useEffect(() => {
    if (!isEditingAccount) {
      setAccountData(buildAccountData())
    }
  }, [buildAccountData, isEditingAccount])

  // Helper: min date (max 35 months back)
  const minSinceDate = useMemo(() => {
    return dateToApiString(subtractMonths(new Date(), 35))
  }, [])

  const handleMetaConfigureClick = () => {
    const state = Math.random().toString(36).slice(2)
    const w = window.open(getApiUrl(`/meta/oauth/start?state=${state}`), 'MetaLogin', 'width=700,height=800')
    if (!w) return
    const onMsg = async (ev: MessageEvent) => {
      if (!ev?.data || ev.data.source !== 'ristak') return
      if (ev.data.type === 'meta-oauth-success') {
        window.removeEventListener('message', onMsg)
        // Fetch ad accounts and open modal
        try {
          const res = await fetchWithAuth(getApiUrl('/meta/adaccounts'))
          
          if (!res.ok) {
            throw new Error(`Error al cargar cuentas de anuncios: ${res.status}`)
          }
          
          const json = await res.json()
          setAdAccounts(json?.data || [])
          
          // Reset form state
          setSelectedAdAccount('')
          setSelectedPixel('')
          // Set default date to 34 months ago
          setSinceDate(dateToApiString(subtractMonths(new Date(), 34)))
          setSchedule('1h')
          setConfigError(null)
          
          setShowMetaModal(true)
        } catch (e) {
          console.error('Failed to load ad accounts', e)
          toast.error('Error de conexión', 'No se pudieron cargar las cuentas de anuncios. Por favor intenta de nuevo.')
        }
      }
    }
    window.addEventListener('message', onMsg)
  }

  const handleAdAccountChange = async (id: string) => {
    setSelectedAdAccount(id)
    setSelectedPixel('')
    setConfigError(null)
    
    if (!id) {
      setPixels([])
      return
    }
    
    try {
      const res = await fetchWithAuth(getApiUrl(`/meta/pixels?ad_account_id=${encodeURIComponent(id)}`))
      
      if (!res.ok) {
        throw new Error(`Error al cargar pixels: ${res.status}`)
      }
      
      const json = await res.json()
      setPixels(json?.data || [])
      
    } catch (e) {
      console.error('Failed to load pixels', e)
      setConfigError('Error al cargar los pixels. Por favor intenta seleccionar otra cuenta.')
      setPixels([])
    }
  }

  const handleSaveMetaConfig = async () => {
    const acct = adAccounts.find(a => (a.account_id === selectedAdAccount || a.id === selectedAdAccount))
    const pix = pixels.find(p => p.id === selectedPixel)
    
    if (!acct || !pix || !sinceDate || !schedule) {
      setConfigError('Por favor completa todos los campos requeridos')
      return
    }
    
    setIsConfiguring(true)
    setConfigError(null)
    
    try {
      const response = await fetchWithAuth(getApiUrl('/meta/configure'), {
        method: 'POST',
        body: JSON.stringify({
          adAccountId: acct.account_id || acct.id,
          adAccountName: acct.name,
          pixelId: pix.id,
          pixelName: pix.name,
          sinceDate,
          schedule,
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: 'Error desconocido' } }))
        throw new Error(errorData.error?.message || `Error del servidor (${response.status})`)
      }
      setMetaConfig({ 
        ad_account_id: acct.account_id || acct.id, 
        ad_account_name: acct.name, 
        pixel_id: pix.id, 
        pixel_name: pix.name 
      })
      
      setShowMetaModal(false)
      
      // Reset form
      setSelectedAdAccount('')
      setSelectedPixel('')
      setSinceDate('')
      setSchedule('1h')
      
      // Show success notification
      toast.success('Configuración guardada', 'Meta Ads se ha configurado correctamente y la sincronización ha comenzado.')
      
    } catch (error) {
      console.error('Error configuring Meta:', error)
      setConfigError(error instanceof Error ? error.message : 'Error al configurar Meta Ads. Por favor intenta de nuevo.')
    } finally {
      setIsConfiguring(false)
    }
  }

  const handleDisconnect = async () => {
    try {
      const res = await fetchWithAuth(getApiUrl('/meta/disconnect'), { method: 'POST' })
      if (res.ok) {
        setMetaConfig(null)
        setShowDisconnectModal(false)
        // Reload config to update UI
        const configRes = await fetchWithAuth(getApiUrl('/meta/config'))
        const configData = await configRes.json()
        setMetaConfig(configData?.data || null)
        toast.success('Cuenta desconectada', 'Tu cuenta de Meta Ads se ha desconectado correctamente.')
      }
    } catch (error) {
      console.error('Failed to disconnect Meta account', error)
      toast.error('Error al desconectar', 'No se pudo desconectar la cuenta de Meta Ads. Por favor intenta de nuevo.')
    }
  }

  const sidebarItems = [
    { id: 'account', label: 'Cuenta', icon: Icons.settings, description: 'Información general' },
    { id: 'notifications', label: 'Notificaciones', icon: Icons.bell, description: 'Alertas y avisos' },
    { id: 'tracking', label: 'Tracking', icon: Icons.code, description: 'Dominios y Scripts' },
    { id: 'integrations', label: 'Integraciones', icon: Icons.globe, description: 'Conectar servicios' },
    { id: 'webhooks', label: 'Webhooks', icon: Icons.webhook, description: 'Endpoints de API' },
    { id: 'database', label: 'Base de datos', icon: Icons.database, description: 'Respaldos y exportación' }
  ]

  const webhookEndpoints: WebhookEndpoint[] = useMemo(() => {
    const baseUrl = accountConfig.webhook_base_url || 'https://send.hollytrack.com'
    const endpoints = accountConfig.webhook_endpoints || {
      contacts: `${baseUrl}/webhook/contacts`,
      appointments: `${baseUrl}/webhook/appointments`,
      payments: `${baseUrl}/webhook/payments`,
      refunds: `${baseUrl}/webhook/refunds`
    }

    return [
      {
        name: 'Contactos',
        url: endpoints.contacts,
        method: 'POST',
        description: 'Sincronizar contactos desde GoHighLevel',
        fields: [
          { name: 'contact_id', required: true, description: 'ID del contacto en GHL' },
        { name: 'first_name', required: false, description: 'Nombre del contacto' },
        { name: 'last_name', required: false, description: 'Apellido del contacto' },
        { name: 'email', required: false, description: 'Email del contacto' },
        { name: 'phone', required: false, description: 'Teléfono del contacto' },
        { name: 'company', required: false, description: 'Empresa del contacto' },
        { name: 'first_adid', required: false, description: 'ID del anuncio de atribución' },
        { name: 'status', required: false, description: 'Estado del contacto' },
        { name: 'source', required: false, description: 'Fuente del contacto' },
      ]
    },
      {
        name: 'Citas',
        url: endpoints.appointments,
        method: 'POST',
        description: 'Registrar citas agendadas',
        fields: [
        { name: 'contact_id', required: true, description: 'ID del contacto en GHL' },
        { name: 'title', required: false, description: 'Título de la cita' },
        { name: 'scheduled_at', required: false, description: 'Fecha y hora de la cita' },
        { name: 'duration', required: false, description: 'Duración en minutos' },
        { name: 'status', required: false, description: 'Estado de la cita' },
      ]
    },
      {
        name: 'Pagos',
        url: endpoints.payments,
        method: 'POST',
        description: 'Registrar transacciones y pagos',
        fields: [
        { name: 'transaction_id', required: true, description: 'ID de la transacción' },
        { name: 'monto', required: true, description: 'Monto del pago' },
        { name: 'nota', required: false, description: 'Descripción del pago' },
        { name: 'contact_id', required: true, description: 'ID del contacto en GHL' },
        { name: 'currency', required: false, description: 'Moneda (default: MXN)' },
      ]
    },
      {
        name: 'Reembolsos',
        url: endpoints.refunds,
        method: 'POST',
        description: 'Procesar reembolsos',
        fields: [
          { name: 'transaction_id', required: true, description: 'ID de la transacción a reembolsar' },
        ]
      }
    ]
  }, [accountConfig])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedText(text)
    setTimeout(() => setCopiedText(''), 2000)
  }

  return (
    <PageContainer>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-primary">Configuración</h1>
        
        <div className="flex gap-6">
          {/* Sidebar */}
          <div className="w-64 flex-shrink-0">
            <Card variant="glass" className="p-2">
              {sidebarItems.map((item) => {
                const Icon = item.icon
                const isActive = activeSection === item.id
                
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left",
                      isActive 
                        ? "bg-secondary text-primary" 
                        : "text-secondary hover:text-primary glass-hover"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <div className="flex-1">
                      <div className="text-sm font-medium">{item.label}</div>
                      <div className="text-xs opacity-70">{item.description}</div>
                    </div>
                    {isActive && <Icons.chevronRight className="w-4 h-4" />}
                  </button>
                )
              })}
            </Card>
          </div>

          {/* Content */}
          <div className="flex-1">
            {activeSection === 'webhooks' && (
              <div className="space-y-4">
                {isAccountConfigLoading && (
                  <Card variant="glass" className="p-4">
                    <div className="flex items-center gap-3 text-secondary">
                      <Icons.refresh className="w-5 h-5 animate-spin" />
                      <span>Cargando configuración de cuenta...</span>
                    </div>
                  </Card>
                )}
                {webhookEndpoints.map((webhook) => (
                  <Card key={webhook.name} variant="glass">
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-primary">{webhook.name}</h3>
                          <p className="text-sm text-secondary mt-1">{webhook.description}</p>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => copyToClipboard(webhook.url)}
                        >
                          {copiedText === webhook.url ? (
                            <>
                              <Icons.checkCircle className="w-4 h-4 mr-2 text-success" />
                              Copiado
                            </>
                          ) : (
                            <>
                              <Icons.copy className="w-4 h-4 mr-2" />
                              Copiar URL
                            </>
                          )}
                        </Button>
                      </div>
                      
                      <div className="glass rounded-lg p-3 mb-4">
                        <code className="text-xs text-primary font-mono">
                          {webhook.method} {webhook.url}
                        </code>
                      </div>

                      <div className="space-y-3">
                        <h4 className="text-sm font-medium text-secondary">Parámetros:</h4>
                        <div className="glass rounded-lg p-4 space-y-2">
                          {webhook.fields.map((field) => (
                            <div key={field.name} className="flex items-start text-sm">
                              <code className="glass text-primary px-2 py-1 rounded mr-3 font-mono text-xs">
                                {field.name}
                              </code>
                              <div className="flex-1">
                                <span className="text-secondary">{field.description}</span>
                                {field.required && (
                                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium glass text-error">
                                    Requerido
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {activeSection === 'tracking' && (
              <TrackingSection />
            )}

            {activeSection === 'account' && (
              <Card variant="glass">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-primary">Configuración de la Cuenta</h3>
                    {!isEditingAccount ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setIsEditingAccount(true)}
                      >
                        <Icons.edit className="w-4 h-4 mr-2" />
                        Editar
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setIsEditingAccount(false)
                            setAccountData(buildAccountData())
                          }}
                          disabled={isSavingAccount || settingsLoading}
                        >
                          Cancelar
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={async () => {
                            setIsSavingAccount(true)
                            
                            try {
                              await persistSettings(accountData)
                              toast.success('Configuración guardada', 'Los cambios han sido guardados exitosamente')
                              setIsEditingAccount(false)
                            } catch (error: any) {
                              console.error('Error saving account:', error)
                              toast.error('Error al guardar', error?.message || 'No se pudo guardar la configuración')
                            } finally {
                              setIsSavingAccount(false)
                            }
                          }}
                          disabled={isSavingAccount || settingsLoading}
                        >
                          {isSavingAccount ? (
                            <><Icons.refresh className="w-4 h-4 mr-2 animate-spin" /> Guardando...</>
                          ) : (
                            <><Icons.check className="w-4 h-4 mr-2" /> Guardar</>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Account Information */}
                    <div>
                      <label className="text-sm font-medium text-tertiary">Nombre de la Subcuenta</label>
                      {isEditingAccount ? (
                        <input
                          type="text"
                          value={accountData.account_name || ''}
                          onChange={(e) => setAccountData({...accountData, account_name: e.target.value})}
                          className="mt-1 w-full px-3 py-2 glass text-primary rounded-lg border border-primary/20 focus:border-primary/40 focus:outline-none"
                        />
                      ) : (
                        <p className="mt-1 text-primary">{accountData.account_name || 'Sin configurar'}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-tertiary">Nombre del Usuario</label>
                      {isEditingAccount ? (
                        <input
                          type="text"
                          value={accountData.user_name || ''}
                          onChange={(e) => setAccountData({...accountData, user_name: e.target.value})}
                          className="mt-1 w-full px-3 py-2 glass text-primary rounded-lg border border-primary/20 focus:border-primary/40 focus:outline-none"
                        />
                      ) : (
                        <p className="mt-1 text-primary">{accountData.user_name || 'Sin configurar'}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-tertiary">Email</label>
                      {isEditingAccount ? (
                        <input
                          type="email"
                          value={accountData.user_email || ''}
                          onChange={(e) => setAccountData({...accountData, user_email: e.target.value})}
                          className="mt-1 w-full px-3 py-2 glass text-primary rounded-lg border border-primary/20 focus:border-primary/40 focus:outline-none"
                        />
                      ) : (
                        <p className="mt-1 text-primary">{accountData.user_email || 'Sin configurar'}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-tertiary">Teléfono</label>
                      {isEditingAccount ? (
                        <input
                          type="tel"
                          value={accountData.user_phone || ''}
                          onChange={(e) => setAccountData({...accountData, user_phone: e.target.value})}
                          className="mt-1 w-full px-3 py-2 glass text-primary rounded-lg border border-primary/20 focus:border-primary/40 focus:outline-none"
                        />
                      ) : (
                        <p className="mt-1 text-primary">{accountData.user_phone || 'Sin configurar'}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-tertiary">Nombre del Negocio</label>
                      {isEditingAccount ? (
                        <input
                          type="text"
                          value={accountData.user_business_name || ''}
                          onChange={(e) => setAccountData({...accountData, user_business_name: e.target.value})}
                          className="mt-1 w-full px-3 py-2 glass text-primary rounded-lg border border-primary/20 focus:border-primary/40 focus:outline-none"
                        />
                      ) : (
                        <p className="mt-1 text-primary">{accountData.user_business_name || 'Sin configurar'}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-tertiary">Ciudad</label>
                      {isEditingAccount ? (
                        <input
                          type="text"
                          value={accountData.user_city || ''}
                          onChange={(e) => setAccountData({...accountData, user_city: e.target.value})}
                          className="mt-1 w-full px-3 py-2 glass text-primary rounded-lg border border-primary/20 focus:border-primary/40 focus:outline-none"
                        />
                      ) : (
                        <p className="mt-1 text-primary">{accountData.user_city || 'Sin configurar'}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-tertiary">Código Postal</label>
                      {isEditingAccount ? (
                        <input
                          type="text"
                          value={accountData.user_zip_code || ''}
                          onChange={(e) => setAccountData({...accountData, user_zip_code: e.target.value})}
                          className="mt-1 w-full px-3 py-2 glass text-primary rounded-lg border border-primary/20 focus:border-primary/40 focus:outline-none"
                        />
                      ) : (
                        <p className="mt-1 text-primary">{accountData.user_zip_code || 'Sin configurar'}</p>
                      )}
                    </div>
                    
                    {/* Regional Settings */}
                    <div className="md:col-span-2">
                      <h4 className="text-md font-medium text-primary mb-4 mt-2">Configuración Regional</h4>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-tertiary">Zona Horaria</label>
                      {isEditingAccount ? (
                        <select
                          value={accountData.timezone || 'America/Mexico_City'}
                          onChange={(e) => setAccountData({...accountData, timezone: e.target.value})}
                          className="mt-1 w-full px-3 py-2 glass text-primary rounded-lg border border-primary/20 focus:border-primary/40 focus:outline-none"
                        >
                          <option value="America/Mexico_City">Ciudad de México (GMT-6)</option>
                          <option value="America/Tijuana">Tijuana (GMT-8)</option>
                          <option value="America/Cancun">Cancún (GMT-5)</option>
                          <option value="America/New_York">Nueva York (GMT-5)</option>
                          <option value="America/Los_Angeles">Los Ángeles (GMT-8)</option>
                          <option value="America/Chicago">Chicago (GMT-6)</option>
                          <option value="America/Bogota">Bogotá (GMT-5)</option>
                          <option value="America/Buenos_Aires">Buenos Aires (GMT-3)</option>
                          <option value="America/Sao_Paulo">São Paulo (GMT-3)</option>
                          <option value="Europe/Madrid">Madrid (GMT+1)</option>
                          <option value="Europe/London">Londres (GMT+0)</option>
                          <option value="Europe/Paris">París (GMT+1)</option>
                        </select>
                      ) : (
                        <p className="mt-1 text-primary">{accountData.timezone || 'America/Mexico_City'}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-tertiary">Moneda</label>
                      {isEditingAccount ? (
                        <select
                          value={accountData.currency || 'MXN'}
                          onChange={(e) => setAccountData({...accountData, currency: e.target.value})}
                          className="mt-1 w-full px-3 py-2 glass text-primary rounded-lg border border-primary/20 focus:border-primary/40 focus:outline-none"
                        >
                          <option value="MXN">MXN - Peso Mexicano</option>
                          <option value="USD">USD - Dólar Estadounidense</option>
                          <option value="EUR">EUR - Euro</option>
                          <option value="GBP">GBP - Libra Esterlina</option>
                          <option value="CAD">CAD - Dólar Canadiense</option>
                          <option value="ARS">ARS - Peso Argentino</option>
                          <option value="BRL">BRL - Real Brasileño</option>
                          <option value="COP">COP - Peso Colombiano</option>
                          <option value="CLP">CLP - Peso Chileno</option>
                          <option value="PEN">PEN - Sol Peruano</option>
                        </select>
                      ) : (
                        <p className="mt-1 text-primary">{accountData.currency || 'MXN'}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-tertiary">Tipo de Impuesto</label>
                      {isEditingAccount ? (
                        <input
                          type="text"
                          value={accountData.user_tax || ''}
                          onChange={(e) => setAccountData({...accountData, user_tax: e.target.value})}
                          className="mt-1 w-full px-3 py-2 glass text-primary rounded-lg border border-primary/20 focus:border-primary/40 focus:outline-none"
                          placeholder="Ej: IVA, VAT, GST"
                        />
                      ) : (
                        <p className="mt-1 text-primary">{accountData.user_tax || 'IVA'}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-tertiary">Porcentaje de Impuesto (%)</label>
                      {isEditingAccount ? (
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={accountData.user_tax_percentage || 0}
                          onChange={(e) => setAccountData({...accountData, user_tax_percentage: parseFloat(e.target.value) || 0})}
                          className="mt-1 w-full px-3 py-2 glass text-primary rounded-lg border border-primary/20 focus:border-primary/40 focus:outline-none"
                        />
                      ) : (
                        <p className="mt-1 text-primary">{accountData.user_tax_percentage || 0}%</p>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {activeSection === 'integrations' && (
              <Card variant="glass">
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-primary mb-6">Integraciones</h3>
                  
                  <div className="space-y-4">
                    <Card variant="glass" className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 glass rounded-lg flex items-center justify-center">
                            <Icons.meta className="w-6 h-6 text-info" />
                          </div>
                          <div>
                            <h4 className="font-medium text-primary">Meta Ads</h4>
                            <p className="text-sm text-secondary">Sincronización de campañas y métricas</p>
                            {metaConfig?.ad_account_id && (
                              <div className="mt-2 text-xs text-tertiary">
                                <div>Cuenta: <span className="text-primary">{metaConfig.ad_account_name} ({metaConfig.ad_account_id})</span></div>
                                {metaConfig.pixel_id && (
                                  <div>Pixel: <span className="text-primary">{metaConfig.pixel_name} ({metaConfig.pixel_id})</span></div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn("px-2 py-1 text-xs rounded-full glass", metaConfig?.ad_account_id ? "text-success" : "text-warning")}>{metaConfig?.ad_account_id ? 'Conectado' : 'Desconectado'}</span>
                          {metaConfig?.ad_account_id ? (
                            <>
                              <Button variant="secondary" size="sm" onClick={handleMetaConfigureClick}>Reconfigurar</Button>
                              <Button variant="secondary" size="sm" onClick={() => setShowDisconnectModal(true)} className="text-error">
                                <Icons.x className="w-4 h-4 mr-1" />
                                Desconectar
                              </Button>
                            </>
                          ) : (
                            <Button variant="secondary" size="sm" onClick={handleMetaConfigureClick}>Conectar</Button>
                          )}
                        </div>
                      </div>
                      {metaStatus?.running && (
                        <div className="mt-3 p-3 rounded-lg glass border border-glassBorder text-info text-sm">
                          <div className="flex items-center gap-2">
                            <Icons.refresh className="w-4 h-4 animate-spin" />
                            Sincronizando anuncios desde Meta... {metaStatus?.message || ''}
                          </div>
                          <p className="text-xs text-secondary mt-1">Puedes seguir navegando. Esto puede tardar varios minutos.</p>
                        </div>
                      )}
                    </Card>

                    <Card variant="glass" className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 glass rounded-lg flex items-center justify-center">
                            <Icons.zap className="w-6 h-6 text-accent-purple" />
                          </div>
                          <div>
                            <h4 className="font-medium text-primary">GoHighLevel</h4>
                            <p className="text-sm text-secondary">Webhooks para contactos y pagos</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 glass text-success text-xs rounded-full">Conectado</span>
                          <Button variant="secondary" size="sm">Configurar</Button>
                        </div>
                      </div>
                    </Card>

                    <Card variant="glass" className="p-4 bg-tertiary">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-tertiary rounded-lg flex items-center justify-center">
                            <Icons.google className="w-6 h-6 text-secondary" />
                          </div>
                          <div>
                            <h4 className="font-medium text-primary">Google Ads</h4>
                            <p className="text-sm text-secondary">Próximamente disponible</p>
                          </div>
                        </div>
                        <Button variant="secondary" size="sm" disabled>Conectar</Button>
                      </div>
                    </Card>
                  </div>
                </div>
              </Card>
            )}


            {activeSection === 'database' && (
              <div className="space-y-4">
                {/* Mostrar progreso de importaciones activas */}
                {importJobs && importJobs.length > 0 && (
                  <Card variant="glass">
                    <div className="p-6">
                      <ImportProgress jobs={importJobs} />
                    </div>
                  </Card>
                )}
                
                <Card variant="glass">
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-primary mb-2">Importación de Datos</h3>
                    <p className="text-sm text-secondary mb-6">
                      Importa datos masivos desde archivos CSV para actualizar tu base de datos. 
                      Archivos grandes (+100 registros) se procesarán en background.
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card variant="glass" className="p-4 hover:bg-glass-hover transition-colors cursor-pointer"
                        onClick={() => {
                          setImportType('contacts')
                          setShowImportModal(true)
                        }}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 glass rounded-lg flex items-center justify-center">
                            <Icons.users className="w-5 h-5 text-primary" />
                          </div>
                          <h4 className="font-medium text-primary">Contactos</h4>
                        </div>
                        <p className="text-sm text-tertiary mb-3">
                          Importa lista de contactos con información personal y de atribución
                        </p>
                        <Button variant="secondary" size="sm" className="w-full">
                          <Icons.upload className="w-4 h-4 mr-2" />
                          Importar CSV
                        </Button>
                      </Card>

                      <Card variant="glass" className="p-4 hover:bg-glass-hover transition-colors cursor-pointer"
                        onClick={() => {
                          setImportType('payments')
                          setShowImportModal(true)
                        }}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 glass rounded-lg flex items-center justify-center">
                            <Icons.dollar className="w-5 h-5 text-primary" />
                          </div>
                          <h4 className="font-medium text-primary">Pagos</h4>
                        </div>
                        <p className="text-sm text-tertiary mb-3">
                          Importa transacciones y pagos históricos de tus clientes
                        </p>
                        <Button variant="secondary" size="sm" className="w-full">
                          <Icons.upload className="w-4 h-4 mr-2" />
                          Importar CSV
                        </Button>
                      </Card>

                      <Card variant="glass" className="p-4 hover:bg-glass-hover transition-colors cursor-pointer"
                        onClick={() => {
                          setImportType('appointments')
                          setShowImportModal(true)
                        }}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 glass rounded-lg flex items-center justify-center">
                            <Icons.calendar className="w-5 h-5 text-primary" />
                          </div>
                          <h4 className="font-medium text-primary">Citas</h4>
                        </div>
                        <p className="text-sm text-tertiary mb-3">
                          Importa citas agendadas y actualiza el estado de contactos
                        </p>
                        <Button variant="secondary" size="sm" className="w-full">
                          <Icons.upload className="w-4 h-4 mr-2" />
                          Importar CSV
                        </Button>
                      </Card>
                    </div>
                  </div>
                </Card>

                <Card variant="glass">
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-primary mb-2">Exportación y Respaldos</h3>
                    <p className="text-sm text-secondary mb-6">
                      Descarga tus datos y crea respaldos de seguridad
                    </p>
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-4 glass rounded-lg">
                        <div>
                          <h4 className="font-medium text-primary">Exportar Base de Datos Completa</h4>
                          <p className="text-sm text-tertiary mt-1">Descarga todos tus datos en formato CSV</p>
                        </div>
                        <Button variant="secondary" size="sm">
                          <Icons.download className="w-4 h-4 mr-2" />
                          Exportar
                        </Button>
                      </div>
                      
                      <div className="flex items-center justify-between p-4 glass rounded-lg">
                        <div>
                          <h4 className="font-medium text-primary">Respaldo Automático</h4>
                          <p className="text-sm text-tertiary mt-1">Último respaldo: Hace 2 horas</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 glass text-success text-xs rounded-full">Activo</span>
                          <Button variant="secondary" size="sm">Configurar</Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {activeSection === 'notifications' && (
              <Card variant="glass">
                <div className="p-6">
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-[var(--color-background-glass)] rounded-full flex items-center justify-center mx-auto mb-4">
                      <Icons.bell className="w-8 h-8 text-secondary" />
                    </div>
                    <p className="text-secondary">
                      Configuración de notificaciones disponible próximamente
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
      {/* Meta configuration modal */}
      <Modal 
        isOpen={showMetaModal} 
        onClose={() => setShowMetaModal(false)}
        title="Configurar Meta Ads"
        icon={<Icons.meta className="w-6 h-6" />}
        size="lg"
      >
        <div className="space-y-4">
                <div>
                  <label className="text-sm text-secondary">Cuenta de Anuncios</label>
                  <select className="w-full mt-1 glass text-primary rounded-lg p-2 border border-primary" value={selectedAdAccount} onChange={(e) => handleAdAccountChange(e.target.value)}>
                    <option value="">Selecciona una cuenta</option>
                    {adAccounts.map((a) => (
                      <option key={a.id} value={a.account_id || a.id}>{a.name} ({a.account_id || a.id})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-secondary">Pixel</label>
                  <select className="w-full mt-1 glass text-primary rounded-lg p-2 border border-primary" value={selectedPixel} onChange={(e) => setSelectedPixel(e.target.value)} disabled={!selectedAdAccount}>
                    <option value="">Selecciona un pixel</option>
                    {pixels.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-secondary">Desde (máx. 35 meses)</label>
                    <div className="mt-1">
                      <DatePicker
                        value={sinceDate}
                        onChange={setSinceDate}
                        minDate={minSinceDate}
                        maxDate={dateToApiString(new Date())}
                        placeholder="Seleccionar fecha inicial"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-secondary">Frecuencia de sincronización</label>
                    <select className="w-full mt-1 glass text-primary rounded-lg p-2 border border-primary" value={schedule} onChange={(e) => setSchedule(e.target.value)}>
                      {['1h','3h','6h','12h','24h'].map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                {configError && (
                  <div className="p-3 glass border border-glassBorder rounded-lg">
                    <div className="flex items-center gap-2">
                      <Icons.alertCircle className="w-4 h-4 text-error flex-shrink-0" />
                      <p className="text-sm text-error">{configError}</p>
                    </div>
                  </div>
                )}
                
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="secondary" size="sm" onClick={() => setShowMetaModal(false)} disabled={isConfiguring}>Cancelar</Button>
                  <Button 
                    variant="primary" 
                    size="sm" 
                    onClick={handleSaveMetaConfig}
                    disabled={isConfiguring || !selectedAdAccount || !selectedPixel || !sinceDate || !schedule}
                  >
                    {isConfiguring ? (
                      <>
                        <Icons.refresh className="w-4 h-4 mr-2 animate-spin" />
                        Configurando...
                      </>
                    ) : (
                      <>
                        <Icons.check className="w-4 h-4 mr-2" />
                        Guardar y sincronizar
                      </>
                    )}
                  </Button>
                </div>
              </div>
      </Modal>
      
      {/* Disconnect confirmation modal */}
      <Modal
        isOpen={showDisconnectModal}
        onClose={() => setShowDisconnectModal(false)}
        title="Confirmar desconexión"
        size="md"
      >
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 glass border border-glassBorder rounded-lg">
                  <Icons.alertCircle className="w-5 h-5 text-error flex-shrink-0" />
                  <div className="text-sm">
                    <p className="text-primary font-medium">¿Estás seguro que deseas desconectar tu cuenta de Meta?</p>
                    <p className="text-secondary mt-1">Se eliminarán todos los datos de campañas sincronizados y deberás volver a autenticarte para usar esta función.</p>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="secondary" size="sm" onClick={() => setShowDisconnectModal(false)}>
                    Cancelar
                  </Button>
                  <Button 
                    variant="danger" 
                    size="sm" 
                    onClick={handleDisconnect}
                  >
                    <Icons.x className="w-4 h-4 mr-2" />
                    Desconectar cuenta
                  </Button>
                </div>
              </div>
      </Modal>
      
      {/* CSV Import Modal */}
      <CSVImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        importType={importType}
        onImportComplete={() => {
          refreshJobs() // Refrescar lista de jobs
        }}
        onSuccess={(message) => {
          setShowImportModal(false)
          refreshJobs() // Refrescar lista de jobs
          toast.success('Importación completada', message)
        }}
      />
    </PageContainer>
  )
}
