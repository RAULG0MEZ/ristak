import React, { useState } from 'react'
import { PageContainer, Card, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge, Button } from '../ui'
import { Icons } from '../icons'
import { formatDate, formatTime } from '../lib/utils'

interface WebhookLog {
  id: string
  endpoint: string
  method: string
  status: number
  event: string
  source: string
  data: any
  timestamp: string
  duration: number
  error?: string
  retries?: number
}

// Datos de ejemplo más extensos
const generateWebhookLogs = (): WebhookLog[] => {
  const endpoints = [
    '/webhooks/contacts',
    '/webhooks/appointments', 
    '/webhooks/payments',
    '/webhooks/refunds'
  ]
  
  const events = [
    'contact.created',
    'contact.updated',
    'appointment.scheduled',
    'appointment.cancelled',
    'payment.completed',
    'payment.failed',
    'refund.processed'
  ]
  
  const logs: WebhookLog[] = []
  const now = new Date()
  
  for (let i = 0; i < 100; i++) {
    const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000) // Cada hora hacia atrás
    const isSuccess = Math.random() > 0.1 // 90% de éxito
    
    logs.push({
      id: `webhook-${i}`,
      endpoint: endpoints[Math.floor(Math.random() * endpoints.length)],
      method: 'POST',
      status: isSuccess ? 200 : [400, 404, 500, 503][Math.floor(Math.random() * 4)],
      event: events[Math.floor(Math.random() * events.length)],
      source: 'GoHighLevel',
      data: {
        contact_id: `contact_${Math.floor(Math.random() * 1000)}`,
        timestamp: timestamp.toISOString(),
        ...(Math.random() > 0.5 ? { email: `user${i}@example.com` } : {}),
        ...(Math.random() > 0.5 ? { amount: Math.floor(Math.random() * 10000) } : {})
      },
      timestamp: timestamp.toISOString(),
      duration: Math.floor(Math.random() * 500) + 50,
      ...(isSuccess ? {} : { 
        error: ['Database connection failed', 'Invalid payload', 'Service unavailable', 'Contact not found'][Math.floor(Math.random() * 4)],
        retries: Math.floor(Math.random() * 3)
      })
    })
  }
  
  return logs
}

export function Webhooks() {
  const [webhookLogs] = useState<WebhookLog[]>(generateWebhookLogs())
  const [selectedLog, setSelectedLog] = useState<WebhookLog | null>(null)
  const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'error'>('all')
  const [filterEndpoint, setFilterEndpoint] = useState<string>('all')
  
  // Estadísticas
  const stats = {
    total: webhookLogs.length,
    success: webhookLogs.filter(w => w.status === 200).length,
    errors: webhookLogs.filter(w => w.status !== 200).length,
    avgDuration: Math.round(webhookLogs.reduce((acc, w) => acc + w.duration, 0) / webhookLogs.length)
  }
  
  const successRate = ((stats.success / stats.total) * 100).toFixed(1)
  
  // Filtrar logs
  const filteredLogs = webhookLogs.filter(log => {
    if (filterStatus === 'success' && log.status !== 200) return false
    if (filterStatus === 'error' && log.status === 200) return false
    if (filterEndpoint !== 'all' && !log.endpoint.includes(filterEndpoint)) return false
    return true
  }).slice(0, 50) // Mostrar solo los últimos 50

  return (
    <PageContainer>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">Webhooks</h1>
          <div className="flex items-center gap-2">
            <Badge variant="info">
              Últimos 50 eventos
            </Badge>
            <Button variant="secondary" size="sm">
              <Icons.refresh className="w-4 h-4 mr-2" />
              Actualizar
            </Button>
          </div>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card variant="glass" className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-secondary">Total Eventos</p>
                <p className="text-2xl font-bold text-primary">{stats.total}</p>
              </div>
              <Icons.activity className="w-8 h-8 text-info" />
            </div>
          </Card>
          
          <Card variant="glass" className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-secondary">Tasa de Éxito</p>
                <p className="text-2xl font-bold text-success">{successRate}%</p>
              </div>
              <Icons.checkCircle className="w-8 h-8 text-success" />
            </div>
          </Card>
          
          <Card variant="glass" className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-secondary">Errores</p>
                <p className="text-2xl font-bold text-error">{stats.errors}</p>
              </div>
              <Icons.alertCircle className="w-8 h-8 text-error" />
            </div>
          </Card>
          
          <Card variant="glass" className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-secondary">Tiempo Promedio</p>
                <p className="text-2xl font-bold text-primary">{stats.avgDuration}ms</p>
              </div>
              <Icons.clock className="w-8 h-8 text-accent-purple" />
            </div>
          </Card>
        </div>

        {/* Filtros */}
        <Card variant="glass" className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-secondary">Estado:</span>
              <div className="flex gap-1">
                <Button
                  variant={filterStatus === 'all' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setFilterStatus('all')}
                >
                  Todos
                </Button>
                <Button
                  variant={filterStatus === 'success' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setFilterStatus('success')}
                >
                  <Icons.checkCircle className="w-3 h-3 mr-1" />
                  Exitosos
                </Button>
                <Button
                  variant={filterStatus === 'error' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setFilterStatus('error')}
                >
                  <Icons.xCircle className="w-3 h-3 mr-1" />
                  Errores
                </Button>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-secondary">Endpoint:</span>
              <select
                value={filterEndpoint}
                onChange={(e) => setFilterEndpoint(e.target.value)}
                className="px-3 py-1.5 glass rounded-lg text-primary text-sm font-medium transition-colors border border-primary focus-ring-accent"
              >
                <option value="all">Todos</option>
                <option value="contacts">Contactos</option>
                <option value="appointments">Citas</option>
                <option value="payments">Pagos</option>
                <option value="refunds">Reembolsos</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Tabla de logs */}
        <Card variant="glass" noPadding>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Endpoint</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Duración</TableHead>
                <TableHead>Datos</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((log) => (
                <TableRow key={log.id} className="glass-hover">
                  <TableCell className="text-secondary text-sm">
                    <div>
                      <div>{formatDate(log.timestamp)}</div>
                      <div className="text-xs text-tertiary">{formatTime(log.timestamp)}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-black/30 text-info px-2 py-1 rounded">
                      {log.endpoint}
                    </code>
                  </TableCell>
                  <TableCell className="font-medium text-primary">{log.event}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant={log.status === 200 ? 'success' : 'error'}>
                        {log.status}
                      </Badge>
                      {log.retries && log.retries > 0 && (
                        <Badge variant="warning" className="text-xs">
                          {log.retries} reintentos
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={log.duration > 300 ? 'text-warning' : 'text-secondary'}>
                      {log.duration}ms
                    </span>
                  </TableCell>
                  <TableCell className="text-secondary text-sm font-mono">
                    <code className="text-xs">
                      {JSON.stringify(log.data).substring(0, 30)}...
                    </code>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setSelectedLog(log)}
                    >
                      <Icons.eye className="w-3 h-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {/* Modal de detalles */}
        {selectedLog && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setSelectedLog(null)}>
            <Card variant="glass" className="max-w-2xl w-full mx-4 max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-primary">Detalles del Webhook</h3>
                  <button
                    onClick={() => setSelectedLog(null)}
                    className="text-secondary hover:text-primary transition-colors"
                  >
                    <Icons.x className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-secondary">Evento</label>
                      <p className="text-primary font-medium">{selectedLog.event}</p>
                    </div>
                    <div>
                      <label className="text-sm text-secondary">Estado</label>
                      <Badge variant={selectedLog.status === 200 ? 'success' : 'error'}>
                        HTTP {selectedLog.status}
                      </Badge>
                    </div>
                    <div>
                      <label className="text-sm text-secondary">Endpoint</label>
                      <code className="text-sm text-info">{selectedLog.endpoint}</code>
                    </div>
                    <div>
                      <label className="text-sm text-secondary">Duración</label>
                      <p className="text-primary">{selectedLog.duration}ms</p>
                    </div>
                    <div>
                      <label className="text-sm text-secondary">Timestamp</label>
                      <p className="text-primary">{new Date(selectedLog.timestamp).toLocaleString()}</p>
                    </div>
                    <div>
                      <label className="text-sm text-secondary">Fuente</label>
                      <p className="text-primary">{selectedLog.source}</p>
                    </div>
                  </div>
                  
                  {selectedLog.error && (
                    <div>
                      <label className="text-sm text-secondary">Error</label>
                      <div className="mt-1 p-3 glass rounded-lg">
                        <p className="text-error text-sm">{selectedLog.error}</p>
                      </div>
                    </div>
                  )}
                  
                  <div>
                    <label className="text-sm text-secondary">Payload</label>
                    <pre className="mt-1 p-3 bg-black/30 rounded-lg overflow-x-auto">
                      <code className="text-sm text-success">
                        {JSON.stringify(selectedLog.data, null, 2)}
                      </code>
                    </pre>
                  </div>
                  
                  <div className="flex justify-end gap-2 pt-4 border-t border-primary">
                    <Button variant="secondary" size="sm" onClick={() => setSelectedLog(null)}>
                      Cerrar
                    </Button>
                    {selectedLog.status !== 200 && (
                      <Button variant="primary" size="sm">
                        <Icons.refresh className="w-4 h-4 mr-2" />
                        Reintentar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </PageContainer>
  )
}
