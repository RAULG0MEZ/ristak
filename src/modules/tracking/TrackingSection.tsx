import React, { useState, useEffect } from 'react'
import { Card, Button } from '../../ui'
import { Icons } from '../../icons'
import { cn } from '../../lib/utils'
import { getApiUrl } from '../../config/api'
import { useToastActions } from '../../hooks/useToast'

interface TrackingDomain {
  id: string
  hostname: string
  status: 'pending' | 'verifying' | 'active' | 'failed'
  cf_hostname_id: string | null
  dcv_method: string
  dcv_record_name: string | null
  dcv_record_value: string | null
  dns_instructions: any[]
  ssl_status: string | null
  dcv_verified_at: string | null
  last_checked_at: string | null
  created_at: string
  updated_at: string
  is_active: boolean
}

export function TrackingSection() {
  const [domains, setDomains] = useState<TrackingDomain[]>([])
  const [loading, setLoading] = useState(true)
  const [newHostname, setNewHostname] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null)
  const [snippet, setSnippet] = useState('')
  const [copiedText, setCopiedText] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [eventSourceRefs, setEventSourceRefs] = useState<Map<string, EventSource>>(new Map())
  const [trackingHost, setTrackingHost] = useState<string>('')
  const [loadingConfig, setLoadingConfig] = useState(true)

  const toast = useToastActions()
  const subaccountId = import.meta.env.VITE_DEFAULT_SUBACCOUNT_ID

  // Cargar configuración y dominios al montar
  useEffect(() => {
    loadConfig()
    loadDomains()
    loadSnippet()

    // Cleanup SSE connections
    return () => {
      eventSourceRefs.forEach(es => es.close())
    }
  }, [])

  // Iniciar SSE para dominios en estado verifying
  useEffect(() => {
    domains.forEach(domain => {
      if (domain.status === 'verifying' && !eventSourceRefs.has(domain.id)) {
        startSSE(domain.id)
      } else if (domain.status === 'active' && eventSourceRefs.has(domain.id)) {
        // Cerrar SSE si ya está activo
        const es = eventSourceRefs.get(domain.id)
        if (es) {
          es.close()
          setEventSourceRefs(prev => {
            const newMap = new Map(prev)
            newMap.delete(domain.id)
            return newMap
          })
        }
      }
    })
  }, [domains])

  const loadConfig = async () => {
    setLoadingConfig(true)
    try {
      const res = await fetch(getApiUrl(`/tracking/config?subaccountId=${subaccountId}`))
      const data = await res.json()

      if (data.success && data.trackingHost) {
        setTrackingHost(data.trackingHost)
      } else {
        console.error('❌ No trackingHost in response:', data)
        toast.error('Error', 'No se pudo cargar la configuración de tracking')
      }
    } catch (error) {
      console.error('Error loading tracking config:', error)
      toast.error('Error', 'Error al cargar configuración')
    } finally {
      setLoadingConfig(false)
    }
  }

  const loadDomains = async () => {
    try {
      const res = await fetch(getApiUrl(`/tracking/domains?subaccountId=${subaccountId}`))
      const data = await res.json()
      if (data.success) {
        setDomains(data.domains || [])
        // Auto-expandir el primer dominio si existe
        if (data.domains && data.domains.length > 0 && !expandedDomain) {
          setExpandedDomain(data.domains[0].id)
        }
      }
    } catch (error) {
      console.error('Error loading domains:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadSnippet = async () => {
    try {
      const res = await fetch(getApiUrl(`/tracking/snippet?subaccountId=${subaccountId}`))
      const data = await res.json()
      if (data.success) {
        setSnippet(data.snippet)
      }
    } catch (error) {
      console.error('Error loading snippet:', error)
    }
  }

  const startSSE = (domainId: string) => {
    // Si ya existe una conexión, cerrarla primero
    const existingES = eventSourceRefs.get(domainId)
    if (existingES) {
      existingES.close()
    }

    const eventSource = new EventSource(getApiUrl(`/tracking/domains/${domainId}/status-stream`))

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        if (data.status === 'completed') {
          eventSource.close()
          setEventSourceRefs(prev => {
            const newMap = new Map(prev)
            newMap.delete(domainId)
            return newMap
          })

          if (data.isActive) {
            toast.success('¡Dominio verificado!', 'Tu dominio está activo y listo para usar')
            loadDomains()
            loadSnippet()
          }
        } else if (data.allRecordsReady && data.records) {
          // Actualizar los registros DNS si están listos
          setDomains(prev => prev.map(d => {
            if (d.id === domainId) {
              return { ...d, dns_instructions: data.records, status: data.status }
            }
            return d
          }))
        }
      } catch (error) {
        console.error('Error processing SSE message:', error)
      }
    }

    eventSource.onerror = () => {
      eventSource.close()
      setEventSourceRefs(prev => {
        const newMap = new Map(prev)
        newMap.delete(domainId)
        return newMap
      })
    }

    setEventSourceRefs(prev => {
      const newMap = new Map(prev)
      newMap.set(domainId, eventSource)
      return newMap
    })
  }

  const handleVerifyAndCreate = async () => {
    if (!newHostname.trim()) {
      toast.error('Error', 'Por favor ingresa un hostname válido')
      return
    }

    setIsProcessing(true)

    try {
      // Paso 1: Verificar CNAME
      const verifyRes = await fetch(getApiUrl('/tracking/verify-cname'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostname: newHostname.trim() })
      })

      const verifyData = await verifyRes.json()

      if (!verifyData.success || !verifyData.isValid) {
        toast.error('CNAME inválido', `El dominio debe apuntar a ${trackingHost}`)
        setIsProcessing(false)
        return
      }

      toast.success('CNAME verificado', 'Creando dominio en Cloudflare...')

      // Paso 2: Crear dominio en Cloudflare
      const createRes = await fetch(getApiUrl('/tracking/domains'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostname: newHostname.trim(),
          subaccountId: subaccountId
        })
      })

      const createData = await createRes.json()

      if (createRes.ok && createData.success) {
        if (createData.dnsInstructions && createData.dnsInstructions.length === 2) {
          toast.success('Dominio agregado', 'Los registros DNS están listos para configurar')

          // Limpiar formulario
          setNewHostname('')

          // Recargar dominios
          await loadDomains()

          // Expandir el nuevo dominio para mostrar los DNS
          if (createData.domain && createData.domain.id) {
            setExpandedDomain(createData.domain.id)
            // Iniciar SSE para verificación automática
            startSSE(createData.domain.id)
          }
        } else {
          toast.error('Error', 'No se obtuvieron los registros DNS completos')
        }
      } else {
        toast.error('Error', createData.error?.message || 'No se pudo crear el dominio')
      }
    } catch (error) {
      console.error('Error in verify and create:', error)
      toast.error('Error', 'Error al procesar el dominio')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDeleteDomain = async (domainId: string) => {
    if (!confirm('¿Estás seguro de eliminar este dominio?')) return

    setDeleting(domainId)
    try {
      const res = await fetch(getApiUrl(`/tracking/domains/${domainId}?subaccountId=${subaccountId}`), {
        method: 'DELETE'
      })

      const data = await res.json()

      if (res.ok && data.success) {
        toast.success('Dominio eliminado', data.message || 'El dominio ha sido eliminado correctamente')
        await loadDomains()
        await loadSnippet()
        setExpandedDomain(null)
      } else {
        toast.error('Error', data.error?.message || 'No se pudo eliminar el dominio')
      }
    } catch (error) {
      console.error('Error deleting domain:', error)
      toast.error('Error', 'Error al eliminar el dominio')
    } finally {
      setDeleting(null)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedText(text)
    setTimeout(() => setCopiedText(''), 2000)
    toast.success('Copiado', 'Texto copiado al portapapeles')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-success bg-success/10'
      case 'verifying': return 'text-warning bg-warning/10'
      case 'failed': return 'text-danger bg-danger/10'
      default: return 'text-tertiary bg-secondary/10'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Verificado'
      case 'verifying': return 'Verificando...'
      case 'failed': return 'Error'
      default: return 'Pendiente'
    }
  }

  return (
    <div className="space-y-6">
      {/* Configuración de Dominio */}
      <Card variant="glass">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 glass rounded-lg">
              <Icons.link className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-primary">Dominio de Tracking</h2>
              <p className="text-sm text-secondary">Configura tu dominio personalizado para el seguimiento</p>
            </div>
          </div>

          {/* Estado de carga de configuración */}
          {loadingConfig && (
            <div className="text-center py-4">
              <Icons.refresh className="w-6 h-6 text-primary animate-spin mx-auto mb-2" />
              <p className="text-sm text-secondary">Cargando configuración...</p>
            </div>
          )}

          {/* Error si no hay trackingHost */}
          {!loadingConfig && !trackingHost && (
            <div className="p-4 glass border border-danger/20 rounded-lg">
              <div className="flex items-start gap-3">
                <Icons.alertCircle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-danger font-medium">Error de configuración</p>
                  <p className="text-sm text-secondary mt-1">
                    No se pudo cargar la configuración del servidor de tracking.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Formulario para agregar dominios - siempre visible si hay trackingHost */}
          {!loadingConfig && trackingHost && domains.length === 0 && (
            <div className="mb-6 p-4 glass border border-glassBorder rounded-lg">
              <div className="space-y-4">
                {/* Instrucciones CNAME */}
                <div className="p-3 glass rounded-lg border border-glassBorder">
                  <div className="flex items-start gap-3">
                    <Icons.info className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
                    <div className="space-y-3 flex-1">
                      <div>
                        <p className="text-primary font-medium">Paso 1: Configura el registro CNAME</p>
                        <p className="text-sm text-secondary mt-1">
                          Antes de continuar, debes configurar un registro CNAME en tu proveedor de DNS:
                        </p>
                      </div>
                      <div className="glass p-3 rounded-lg space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-medium text-tertiary">Tipo:</span>
                          <span className="font-mono text-sm text-primary">CNAME</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-medium text-tertiary">Nombre/Host:</span>
                          <span className="font-mono text-sm text-primary">tu-subdominio</span>
                        </div>
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-xs font-medium text-tertiary">Apunta a:</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-primary">{trackingHost}</span>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => copyToClipboard(trackingHost)}
                            >
                              {copiedText === trackingHost ? (
                                <Icons.checkCircle className="w-3 h-3 text-success" />
                              ) : (
                                <Icons.copy className="w-3 h-3" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Input y botón */}
                <div>
                  <label className="text-sm font-medium text-tertiary">
                    Paso 2: Ingresa tu dominio y verifica
                  </label>
                  <div className="mt-1 flex gap-2">
                    <input
                      type="text"
                      value={newHostname}
                      onChange={(e) => setNewHostname(e.target.value)}
                      placeholder="tracking.tudominio.com"
                      className="flex-1 px-4 py-2 glass text-primary placeholder-secondary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                      disabled={isProcessing}
                      onKeyPress={(e) => e.key === 'Enter' && !isProcessing && handleVerifyAndCreate()}
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleVerifyAndCreate}
                      disabled={isProcessing || !newHostname.trim()}
                    >
                      {isProcessing ? (
                        <>
                          <Icons.refresh className="w-4 h-4 mr-2 animate-spin" />
                          Procesando...
                        </>
                      ) : (
                        <>
                          <Icons.check className="w-4 h-4 mr-2" />
                          Verificar y Configurar
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-secondary mt-2">
                    Usa un subdominio de tu dominio principal (ej: track.tudominio.com)
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Lista de dominios */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Icons.refresh className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              {domains.map((domain) => (
                <div key={domain.id} className="glass border border-glassBorder rounded-lg">
                  {/* Header del dominio */}
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          domain.status === 'active' ? "bg-green-400" :
                          domain.status === 'verifying' ? "bg-yellow-400 animate-pulse" :
                          "bg-gray-400"
                        )} />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-primary">{domain.hostname}</span>
                            <span className={cn("text-xs px-2 py-0.5 rounded-full glass", getStatusColor(domain.status))}>
                              {getStatusLabel(domain.status)}
                            </span>
                          </div>
                          <p className="text-xs text-tertiary mt-1">
                            Creado: {new Date(domain.created_at).toLocaleDateString()}
                            {domain.dcv_verified_at && ` • Verificado: ${new Date(domain.dcv_verified_at).toLocaleDateString()}`}
                          </p>
                        </div>
                      </div>

                      {/* Acciones */}
                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setExpandedDomain(expandedDomain === domain.id ? null : domain.id)}
                        >
                          <Icons.info className="w-4 h-4 mr-2" />
                          {expandedDomain === domain.id ? 'Ocultar' :
                           domain.status === 'active' ? 'Ver Estado' : 'Ver DNS'}
                        </Button>

                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleDeleteDomain(domain.id)}
                          disabled={deleting === domain.id}
                        >
                          {deleting === domain.id ? (
                            <Icons.refresh className="w-4 h-4 animate-spin" />
                          ) : (
                            <Icons.trash className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Registros DNS expandidos */}
                  {expandedDomain === domain.id && (
                    <div className="border-t border-glassBorder p-4">
                      {domain.status === 'active' ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-success mb-2">
                            <Icons.checkCircle className="w-5 h-5" />
                            <span className="text-sm font-medium">Dominio activo - Copia tu script de tracking:</span>
                          </div>
                          <div className="relative">
                            <div className="p-4 bg-black/5 dark:bg-white/10 backdrop-blur-sm rounded-lg border border-glassBorder hover:border-primary/30 transition-colors">
                              <code className="text-xs font-mono text-primary/80 break-all select-all">
                                {`<script async src="https://${domain.hostname}/snip.js?s=${subaccountId}"></script>`}
                              </code>
                            </div>
                            <Button
                              variant="secondary"
                              size="sm"
                              className="absolute top-2 right-2"
                              onClick={() => copyToClipboard(`<script async src="https://${domain.hostname}/snip.js?s=${subaccountId}"></script>`)}
                            >
                              {copiedText === `<script async src="https://${domain.hostname}/snip.js?s=${subaccountId}"></script>` ? (
                                <Icons.checkCircle className="w-4 h-4 text-success" />
                              ) : (
                                <Icons.copy className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                          <p className="text-xs text-secondary">
                            Agrega este script antes del cierre de &lt;/body&gt; en tu sitio web
                          </p>
                        </div>
                      ) : domain.dns_instructions && domain.dns_instructions.length > 0 ? (
                        <div className="space-y-4">
                          <div className="flex items-start gap-3 p-3 glass rounded-lg">
                            <Icons.info className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-primary font-medium">Configuración DNS requerida</p>
                              <p className="text-sm text-secondary mt-1">
                                Agrega estos registros TXT en tu proveedor de DNS para validar el dominio
                              </p>
                            </div>
                          </div>

                          {domain.dns_instructions.map((record: any, index: number) => (
                            <div key={index} className="space-y-3 p-4 glass rounded-lg">
                              <h4 className="text-sm font-semibold text-primary">
                                {record.purpose === 'ownership_verification' ? 'Registro TXT #1 - Verificación de Propiedad' :
                                 record.purpose === 'ssl_validation' ? 'Registro TXT #2 - Validación SSL' :
                                 `Registro TXT #${index + 1}`}
                              </h4>

                              <div className="grid gap-3">
                                <div>
                                  <label className="text-xs font-medium text-tertiary">Tipo</label>
                                  <div className="mt-1 px-3 py-2 glass text-primary rounded-lg font-mono text-sm">
                                    TXT
                                  </div>
                                </div>

                                <div>
                                  <label className="text-xs font-medium text-tertiary">Nombre/Host</label>
                                  <div className="mt-1 flex items-center gap-2">
                                    <div className="flex-1 px-3 py-2 glass text-primary rounded-lg font-mono text-xs break-all">
                                      {record.name || 'No disponible'}
                                    </div>
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      onClick={() => copyToClipboard(record.name || '')}
                                      disabled={!record.name}
                                    >
                                      {copiedText === record.name ? (
                                        <Icons.checkCircle className="w-4 h-4 text-success" />
                                      ) : (
                                        <Icons.copy className="w-4 h-4" />
                                      )}
                                    </Button>
                                  </div>
                                </div>

                                <div>
                                  <label className="text-xs font-medium text-tertiary">Valor</label>
                                  <div className="mt-1 flex items-center gap-2">
                                    <div className="flex-1 px-3 py-2 glass text-primary rounded-lg font-mono text-xs break-all">
                                      {record.value || 'No disponible'}
                                    </div>
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      onClick={() => copyToClipboard(record.value || '')}
                                      disabled={!record.value}
                                    >
                                      {copiedText === record.value ? (
                                        <Icons.checkCircle className="w-4 h-4 text-success" />
                                      ) : (
                                        <Icons.copy className="w-4 h-4" />
                                      )}
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}

                          <div className="p-3 glass rounded-lg space-y-2">
                            <p className="text-xs text-secondary">
                              <strong className="text-primary">TTL:</strong> Usa el valor más bajo disponible (300 segundos)
                            </p>
                            <p className="text-xs text-secondary">
                              <strong className="text-primary">Propagación:</strong> {domain.status === 'verifying' ?
                                'El sistema está verificando automáticamente...' :
                                'Puede tardar entre 5 minutos y 48 horas'}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <Icons.info className="w-8 h-8 text-tertiary mx-auto mb-3" />
                          <p className="text-secondary text-sm">
                            Esperando registros DNS...
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

    </div>
  )
}