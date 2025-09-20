import React, { useState, useRef } from 'react'
import { Modal } from '../../ui/Modal'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { Select } from '../../ui/Select'
import { Icons } from '../../icons'
import { 
  parseCSVContent, 
  validateMapping, 
  processCSVRow,
  FIELD_DEFINITIONS,
  type ImportType,
  type CSVMapping,
  type ParsedCSVData 
} from '../../lib/csvUtils'
import { getApiUrl, fetchWithAuth } from '../../config/api'

interface CSVImportModalProps {
  isOpen: boolean
  onClose: () => void
  importType: ImportType
  onSuccess?: (message: string) => void
}

type ImportStep = 'upload' | 'mapping' | 'preview' | 'processing' | 'result'

export function CSVImportModal({ isOpen, onClose, importType, onSuccess }: CSVImportModalProps) {
  const [currentStep, setCurrentStep] = useState<ImportStep>('upload')
  const [csvData, setCSVData] = useState<ParsedCSVData | null>(null)
  const [mapping, setMapping] = useState<CSVMapping>({})
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [selectedTimezone, setSelectedTimezone] = useState<string>('America/Mexico_City')
  const [importResult, setImportResult] = useState<{
    success: boolean
    processed: number
    failed: number
    errors: string[]
    message: string
  } | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  const importTypeOptions = [
    { value: 'contacts', label: 'Contactos - Para importar personas/clientes' },
    { value: 'appointments', label: 'Citas - Para marcar contactos que ya agendaron una cita' },
    { value: 'payments', label: 'Pagos - Para importar transacciones de pago' },
  ]

  // Opciones de timezone comunes
  const timezoneOptions = [
    { value: 'America/Mexico_City', label: '🇲🇽 México (Ciudad de México) UTC-6' },
    { value: 'America/Tijuana', label: '🇲🇽 México (Tijuana) UTC-7' },
    { value: 'America/Cancun', label: '🇲🇽 México (Cancún) UTC-5' },
    { value: 'America/New_York', label: '🇺🇸 Nueva York UTC-5' },
    { value: 'America/Los_Angeles', label: '🇺🇸 Los Ángeles UTC-8' },
    { value: 'America/Chicago', label: '🇺🇸 Chicago UTC-6' },
    { value: 'America/Bogota', label: '🇨🇴 Bogotá UTC-5' },
    { value: 'America/Buenos_Aires', label: '🇦🇷 Buenos Aires UTC-3' },
    { value: 'America/Sao_Paulo', label: '🇧🇷 São Paulo UTC-3' },
    { value: 'Europe/Madrid', label: '🇪🇸 Madrid UTC+1' },
    { value: 'Europe/London', label: '🇬🇧 Londres UTC+0' },
    { value: 'Europe/Paris', label: '🇫🇷 París UTC+1' },
  ]

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      setErrorMessage('Por favor selecciona un archivo CSV válido')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const csvContent = e.target?.result as string
        const parsedData = parseCSVContent(csvContent)
        setCSVData(parsedData)
        
        // NO generamos mapeo automático - el usuario debe mapear todo manualmente
        setMapping({})
        
        setCurrentStep('mapping')
      } catch (error) {
        setErrorMessage('Error al procesar el archivo CSV. Verifica que el formato sea correcto.')
      }
    }
    reader.readAsText(file)
  }

  const handleMappingChange = (fieldKey: string, csvColumn: string) => {
    setMapping(prev => ({
      ...prev,
      [fieldKey]: csvColumn
    }))
    
    // Limpiar errores de validación cuando se actualice el mapeo
    if (validationErrors.length > 0) {
      setValidationErrors([])
    }
  }

  const handleNext = () => {
    if (currentStep === 'mapping') {
      const errors = validateMapping(mapping, importType)
      if (errors.length > 0) {
        setValidationErrors(errors)
        return
      }
      setCurrentStep('preview')
    }
  }

  const handleImport = async () => {
    if (!csvData) return

    setCurrentStep('processing')
    setIsProcessing(true)

    try {
      // Procesar todos los rows con el timezone seleccionado
      const processedData = csvData.rows.map(row =>
        processCSVRow(row, csvData.headers, mapping, importType, selectedTimezone)
      )

      // Para archivos grandes (>100 registros), usar importación asíncrona
      const isLargeFile = processedData.length > 100

      if (isLargeFile) {
        // Importación asíncrona con progreso
        const url = getApiUrl('/import/async/start')
        const response = await fetchWithAuth(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            data: processedData,
            type: importType,
            timezone: selectedTimezone
          })
        })

        if (!response.ok) {
          throw new Error(`Error en importación: ${response.statusText}`)
        }
        
        const result = await response.json()
        
        // Notificar que la importación comenzó
        setImportResult({
          success: true,
          processed: 0,
          failed: 0,
          errors: [],
          message: `Importación de ${result.total} registros iniciada. Puedes cerrar este modal y continuar trabajando.`
        })
        setCurrentStep('result')
        setIsProcessing(false)
        
        // Cerrar modal después de 3 segundos
        setTimeout(() => {
          onSuccess?.(result.message)
          handleClose()
        }, 3000)
        
      } else {
        // Importación síncrona para archivos pequeños
        const url = getApiUrl(`/import/${importType}`)
        const bodyData = {
          data: processedData,
          mapping: mapping,
          importType: importType,
          timezone: selectedTimezone
        }

        const response = await fetchWithAuth(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(bodyData)
        })

        if (!response.ok) {
          throw new Error(`Error en importación: ${response.statusText}`)
        }
        
        const result = await response.json()
        
        // Mostrar resultado
        setImportResult({
          success: true,
          processed: result.processed || processedData.length,
          failed: result.failed || 0,
          errors: result.errors || [],
          message: result.message || `Importación completada: ${result.processed || processedData.length} registros procesados`
        })
        setCurrentStep('result')
        setIsProcessing(false)
      }

    } catch (error) {
      setImportResult({
        success: false,
        processed: 0,
        failed: csvData?.rows.length || 0,
        errors: [error instanceof Error ? error.message : 'Error desconocido durante la importación'],
        message: 'Error durante la importación'
      })
      setCurrentStep('result')
      setIsProcessing(false)
    }
  }

  const resetModal = () => {
    setCurrentStep('upload')
    setCSVData(null)
    setMapping({})
    setValidationErrors([])
    setIsProcessing(false)
    setErrorMessage(null)
    setImportResult(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleClose = () => {
    resetModal()
    onClose()
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 'upload':
        return (
          <div className="space-y-4">
            {/* Selector de Timezone */}
            <Card variant="info" className="glass">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Icons.calendar className="w-5 h-5 text-accent-blue" />
                  <h3 className="text-base font-semibold text-primary">
                    Zona horaria de los datos
                  </h3>
                </div>
                <p className="text-sm text-secondary">
                  Selecciona la zona horaria en la que están las fechas del CSV.
                  Esto es importante para convertir correctamente las fechas a UTC.
                </p>
                <Select
                  value={selectedTimezone}
                  onChange={(e) => setSelectedTimezone(e.target.value)}
                  className="w-full"
                >
                  {timezoneOptions.map(tz => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </Select>
                <div className="text-xs text-tertiary bg-glass-subtle p-2 rounded">
                  💡 Tip: Si importas contactos de España, selecciona Madrid UTC+1.
                  Si son de México, selecciona la ciudad correspondiente.
                </div>
              </div>
            </Card>

            <Card variant="default" className="glass border-2 border-dashed border-tertiary hover:border-accent-blue transition-colors">
              <div className="text-center py-8">
                <Icons.request className="w-12 h-12 text-accent-blue mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-primary mb-2">
                  Cargar archivo CSV
                </h3>
                <p className="text-secondary mb-6">
                  Tipo seleccionado: <span className="font-medium text-primary">
                    {importTypeOptions.find(opt => opt.value === importType)?.label.split(' - ')[0]}
                  </span>
                </p>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="flex justify-center">
                  <Button 
                    variant="secondary" 
                    onClick={() => fileInputRef.current?.click()}
                    icon={<Icons.upload className="w-4 h-4" />}
                  >
                    Seleccionar archivo CSV
                  </Button>
                </div>
                <p className="text-tertiary text-sm mt-3">
                  Solo archivos .csv son permitidos
                </p>
              </div>
            </Card>

            {errorMessage && (
              <Card variant="error" className="text-center">
                <p className="text-sm">{errorMessage}</p>
              </Card>
            )}
          </div>
        )

      case 'mapping': {
        const mappingFields = FIELD_DEFINITIONS[importType]
        const mappedCount = Object.values(mapping).filter(v => v).length
        const requiredCount = mappingFields.filter(f => f.required).length
        const totalFields = mappingFields.length
        
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-primary mb-2">
                Mapeo Manual de Columnas
              </h3>
              <p className="text-secondary mb-2">
                Debes conectar manualmente cada columna de tu CSV con los campos del sistema
              </p>
              
              {/* Indicador de progreso */}
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-secondary">Campos mapeados</span>
                  <span className="font-medium text-primary">{mappedCount} de {totalFields}</span>
                </div>
                <div className="w-full bg-glassBorder rounded-full h-2">
                  <div 
                    className="bg-accent-blue h-2 rounded-full transition-all"
                    style={{ width: `${(mappedCount / totalFields) * 100}%` }}
                  />
                </div>
              </div>
              
              
              {validationErrors.length > 0 && (
                <Card variant="warning" className="mb-4">
                  <div className="space-y-2">
                    {validationErrors.map((error, index) => (
                      <p key={index} className="text-sm text-error">{error}</p>
                    ))}
                  </div>
                </Card>
              )}
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {mappingFields.map((field) => {
                const isMapped = !!mapping[field.key]
                return (
                  <div 
                    key={field.key} 
                    className={`grid grid-cols-2 gap-4 items-center glass rounded-lg p-4 transition-all ${
                      isMapped ? 'border border-success/20 bg-success/5' : 
                      field.required ? 'border border-warning/20' : ''
                    }`}
                  >
                  <div className="flex-1">
                    <label className="text-sm font-medium text-primary">
                      {field.name}
                      {field.required && <span className="text-error ml-1">*</span>}
                    </label>
                    {field.description && (
                      <p className="text-xs text-tertiary mt-1">{field.description}</p>
                    )}
                  </div>
                  <div className="flex-1">
                    <Select
                      value={mapping[field.key] || ''}
                      onChange={(e) => handleMappingChange(field.key, e.target.value)}
                      placeholder="Seleccionar columna del CSV..."
                      className={!mapping[field.key] && field.required ? 'border-warning' : ''}
                    >
                      <option value="">-- Selecciona una columna --</option>
                      {csvData?.headers.map((header) => {
                        // Verificar si esta columna ya está mapeada a otro campo
                        const isAlreadyMapped = Object.entries(mapping).some(
                          ([key, value]) => value === header && key !== field.key
                        )
                        return (
                          <option 
                            key={header} 
                            value={header}
                            disabled={isAlreadyMapped}
                          >
                            {header} {isAlreadyMapped && '(ya mapeado)'}
                          </option>
                        )
                      })}
                    </Select>
                  </div>
                </div>
                )
              })}
            </div>

            <div className="flex justify-between items-center">
              <Button 
                variant="ghost" 
                onClick={() => {
                  setMapping({})
                  setValidationErrors([])
                }}
                size="sm"
              >
                Limpiar todo
              </Button>
              <div className="flex space-x-3">
                <Button variant="secondary" onClick={() => setCurrentStep('upload')}>
                  Atrás
                </Button>
                <Button 
                  onClick={handleNext}
                  disabled={mappedCount === 0}
                >
                  Vista Previa ({mappedCount}/{totalFields})
                </Button>
              </div>
            </div>
          </div>
        )
      }

      case 'preview': {
        if (!csvData) return null
        
        const previewFields = FIELD_DEFINITIONS[importType]
        const previewData = csvData.preview.slice(0, 3)
        const mappedFields = Object.entries(mapping).filter(([_, csvColumn]) => csvColumn)
        
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-primary mb-2">
                Vista Previa de Datos
              </h3>
              <p className="text-secondary">
                Revisa cómo se verán los datos antes de importar (primeras 3 filas)
              </p>
            </div>

            <Card variant="default">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-glassBorder">
                      {mappedFields.map(([fieldKey, csvColumn]) => {
                        const field = previewFields.find(f => f.key === fieldKey)
                        return (
                          <th key={fieldKey} className="text-left py-2 px-3 font-medium text-primary">
                            {field?.name}
                            {field?.required && <span className="text-error ml-1">*</span>}
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((row, index) => (
                      <tr key={index} className="border-b border-glassBorder">
                        {mappedFields.map(([fieldKey, csvColumn]) => (
                          <td key={fieldKey} className="py-2 px-3 text-secondary">
                            {row[csvColumn] || '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card variant="info">
              <div className="flex items-center space-x-2 text-sm">
                <Icons.info className="w-4 h-4 text-accent-blue" />
                <span className="text-primary">
                  Se procesarán {csvData.rows.length} filas en total
                </span>
              </div>
            </Card>

            <div className="flex justify-center space-x-3">
              <Button variant="secondary" onClick={() => setCurrentStep('mapping')}>
                Atrás
              </Button>
              <Button onClick={handleImport} variant="primary">
                Importar Datos
              </Button>
            </div>
          </div>
        )
      }

      case 'processing':
        return (
          <div className="text-center space-y-6">
            <div className="animate-spin w-12 h-12 border-4 border-accent-blue border-t-transparent rounded-full mx-auto" />
            <div>
              <h3 className="text-lg font-semibold text-primary mb-2">
                Procesando Importación
              </h3>
              <p className="text-secondary">
                Los datos se están procesando en segundo plano...
              </p>
            </div>
          </div>
        )

      case 'result':
        if (!importResult) return null
        
        return (
          <div className="space-y-6">
            <Card variant={importResult.success ? "success" : "error"} className="text-center">
              <div className="space-y-4">
                <div className="flex justify-center">
                  {importResult.success ? (
                    <Icons.check className="w-16 h-16 text-success" />
                  ) : (
                    <Icons.x className="w-16 h-16 text-error" />
                  )}
                </div>
                
                <h3 className="text-lg font-semibold text-primary">
                  {importResult.success ? 'Importación Completada' : 'Error en la Importación'}
                </h3>
                
                <div className="space-y-2 text-sm">
                  {importResult.processed > 0 && (
                    <p className="text-success">
                      ✓ {importResult.processed} registros procesados correctamente
                    </p>
                  )}
                  {importResult.failed > 0 && (
                    <p className="text-error">
                      ✗ {importResult.failed} registros con errores
                    </p>
                  )}
                </div>
                
                {importResult.errors.length > 0 && (
                  <Card variant="error" className="mt-4 text-left">
                    <h4 className="font-semibold mb-2">Errores encontrados:</h4>
                    <ul className="space-y-1 text-sm">
                      {importResult.errors.slice(0, 5).map((error, index) => (
                        <li key={index} className="text-error">• {error}</li>
                      ))}
                      {importResult.errors.length > 5 && (
                        <li className="text-tertiary">... y {importResult.errors.length - 5} más</li>
                      )}
                    </ul>
                  </Card>
                )}
                
                <p className="text-secondary text-sm mt-4">
                  {importResult.message}
                </p>
              </div>
            </Card>
            
            <div className="flex justify-center space-x-3">
              {importResult.success ? (
                <>
                  <Button 
                    variant="secondary" 
                    onClick={() => {
                      resetModal()
                      setCurrentStep('upload')
                    }}
                  >
                    Importar Más
                  </Button>
                  <Button 
                    variant="primary" 
                    onClick={() => {
                      onSuccess?.(importResult.message)
                      handleClose()
                    }}
                  >
                    Finalizar
                  </Button>
                </>
              ) : (
                <>
                  <Button 
                    variant="secondary" 
                    onClick={() => setCurrentStep('mapping')}
                  >
                    Revisar Mapeo
                  </Button>
                  <Button 
                    variant="primary" 
                    onClick={() => {
                      resetModal()
                      setCurrentStep('upload')
                    }}
                  >
                    Intentar de Nuevo
                  </Button>
                </>
              )}
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <>
      <Modal 
        isOpen={isOpen} 
        onClose={handleClose} 
        title={`Importar ${importType === 'contacts' ? 'Contactos' : importType === 'payments' ? 'Pagos' : 'Citas'} desde CSV`} 
        size="xl"
        showCloseButton={currentStep !== 'processing' && currentStep !== 'result'}
      >
        {renderStepContent()}
      </Modal>

    </>
  )
}