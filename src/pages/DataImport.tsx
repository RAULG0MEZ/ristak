import React, { useState } from 'react'
import { PageContainer, Card, Button, KPICard } from '../ui'
import { CSVImportModal } from '../modules/import/CSVImportModal'
import { Icons } from '../icons'

export function DataImport() {
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  
  // Estadísticas de ejemplo
  const importStats = {
    totalImports: 12,
    lastImport: '2024-01-15',
    totalRecords: 5432,
    successRate: 98.5,
  }

  const recentImports = [
    {
      id: 1,
      type: 'Contactos',
      fileName: 'leads-enero-2024.csv',
      records: 1250,
      status: 'success',
      date: '2024-01-15 14:30',
      errors: 0,
    },
    {
      id: 2,
      type: 'Pagos',
      fileName: 'transactions-q4-2023.csv',
      records: 450,
      status: 'success',
      date: '2024-01-14 10:15',
      errors: 2,
    },
    {
      id: 3,
      type: 'Citas',
      fileName: 'appointments-dec.csv',
      records: 89,
      status: 'warning',
      date: '2024-01-13 16:45',
      errors: 5,
    },
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-success'
      case 'warning':
        return 'text-warning'
      case 'error':
        return 'text-error'
      default:
        return 'text-secondary'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <Icons.checkCircle className="w-4 h-4" />
      case 'warning':
        return <Icons.alertCircle className="w-4 h-4" />
      case 'error':
        return <Icons.xCircle className="w-4 h-4" />
      default:
        return <Icons.circle className="w-4 h-4" />
    }
  }

  return (
    <PageContainer
      title="Importación de Datos"
      description="Importa datos masivos desde archivos CSV"
      actions={
        <Button 
          onClick={() => setIsImportModalOpen(true)}
          icon={<Icons.upload className="w-4 h-4" />}
        >
          Nueva Importación
        </Button>
      }
    >
      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard
          title="Total Importaciones"
          value={importStats.totalImports.toString()}
          subtitle="+3 este mes"
          icon={<Icons.fileText className="w-5 h-5" />}
        />
        <KPICard
          title="Registros Totales"
          value={importStats.totalRecords.toLocaleString()}
          subtitle="+1,250 últimos"
          icon={<Icons.database className="w-5 h-5" />}
        />
        <KPICard
          title="Tasa de Éxito"
          value={`${importStats.successRate}%`}
          subtitle="Sin errores críticos"
          icon={<Icons.checkCircle className="w-5 h-5" />}
        />
        <KPICard
          title="Última Importación"
          value={importStats.lastImport}
          subtitle="Hace 2 días"
          icon={<Icons.calendar className="w-5 h-5" />}
        />
      </div>

      {/* Guía rápida */}
      <Card variant="info" className="mb-6">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-primary mb-4">
            Guía Rápida de Importación
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-full bg-glass-subtle flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-semibold text-primary">1</span>
              </div>
              <div>
                <p className="font-medium text-primary">Selecciona el tipo</p>
                <p className="text-sm text-secondary">
                  Elige entre Contactos, Pagos o Citas según tu necesidad
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-full bg-glass-subtle flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-semibold text-primary">2</span>
              </div>
              <div>
                <p className="font-medium text-primary">Mapea las columnas</p>
                <p className="text-sm text-secondary">
                  El sistema sugiere mapeos automáticos que puedes ajustar
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-full bg-glass-subtle flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-semibold text-primary">3</span>
              </div>
              <div>
                <p className="font-medium text-primary">Revisa y confirma</p>
                <p className="text-sm text-secondary">
                  Visualiza una vista previa antes de procesar los datos
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Historial de importaciones */}
      <Card variant="default">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-primary">
              Importaciones Recientes
            </h3>
            <Button variant="ghost" size="sm">
              Ver todas
            </Button>
          </div>
          
          <div className="space-y-3">
            {recentImports.map((importItem) => (
              <div
                key={importItem.id}
                className="flex items-center justify-between p-4 glass rounded-xl hover:bg-glass-hover transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <div className={`${getStatusColor(importItem.status)} flex items-center`}>
                    {getStatusIcon(importItem.status)}
                  </div>
                  <div>
                    <p className="font-medium text-primary">
                      {importItem.type}
                    </p>
                    <p className="text-sm text-secondary">
                      {importItem.fileName}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-6">
                  <div className="text-right">
                    <p className="text-sm font-medium text-primary">
                      {importItem.records.toLocaleString()} registros
                    </p>
                    <p className="text-xs text-secondary">
                      {importItem.errors > 0 && `${importItem.errors} errores`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-secondary">
                      {importItem.date}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm">
                    <Icons.moreVertical className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Sección de ayuda */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <Card variant="default">
          <div className="p-6">
            <h4 className="font-semibold text-primary mb-3">
              Formato de archivos CSV
            </h4>
            <ul className="space-y-2 text-sm text-secondary">
              <li className="flex items-start">
                <Icons.check className="w-4 h-4 text-success mr-2 mt-0.5 flex-shrink-0" />
                <span>Usa UTF-8 como codificación de caracteres</span>
              </li>
              <li className="flex items-start">
                <Icons.check className="w-4 h-4 text-success mr-2 mt-0.5 flex-shrink-0" />
                <span>Primera fila debe contener los nombres de columnas</span>
              </li>
              <li className="flex items-start">
                <Icons.check className="w-4 h-4 text-success mr-2 mt-0.5 flex-shrink-0" />
                <span>Separa los campos con comas</span>
              </li>
              <li className="flex items-start">
                <Icons.check className="w-4 h-4 text-success mr-2 mt-0.5 flex-shrink-0" />
                <span>Usa comillas dobles para campos con comas</span>
              </li>
            </ul>
          </div>
        </Card>

        <Card variant="default">
          <div className="p-6">
            <h4 className="font-semibold text-primary mb-3">
              Campos obligatorios por tipo
            </h4>
            <div className="space-y-3 text-sm">
              <div>
                <p className="font-medium text-primary mb-1">Contactos</p>
                <p className="text-secondary">ID de Contacto (único)</p>
              </div>
              <div>
                <p className="font-medium text-primary mb-1">Pagos</p>
                <p className="text-secondary">ID de Contacto (relación)</p>
              </div>
              <div>
                <p className="font-medium text-primary mb-1">Citas</p>
                <p className="text-secondary">ID de Contacto (relación)</p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Modal de importación */}
      <CSVImportModal 
        isOpen={isImportModalOpen} 
        onClose={() => setIsImportModalOpen(false)}
        importType="contacts"
      />
    </PageContainer>
  )
}
