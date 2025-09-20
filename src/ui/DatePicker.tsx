import React, { useState, useRef, useEffect } from 'react'
import ReactDOM from 'react-dom'
import { cn } from '../lib/utils'
import { getCurrentYear, dateToApiString, parseUTCDate, createDateInTimezone } from '../lib/dateUtils'
import { Icons } from '../icons'

interface DatePickerProps {
  value?: string
  onChange: (date: string) => void
  minDate?: string
  maxDate?: string
  placeholder?: string
  className?: string
  disabled?: boolean
}

const formatDate = (date: Date): string => {
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`
}

const startOfMonth = (date: Date): Date => {
  const result = new Date(date)
  result.setDate(1)
  result.setHours(0, 0, 0, 0)
  return result
}

const startOfWeek = (date: Date): Date => {
  const result = new Date(date)
  const day = result.getDay()
  const diff = result.getDate() - day + (day === 0 ? -6 : 1)
  result.setDate(diff)
  result.setHours(0, 0, 0, 0)
  return result
}

export function DatePicker({ 
  value, 
  onChange, 
  minDate, 
  maxDate, 
  placeholder = 'Seleccionar fecha',
  className,
  disabled = false
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(
    value ? new Date(value) : null
  )
  const [currentMonth, setCurrentMonth] = useState(() =>
    selectedDate ? startOfMonth(selectedDate) : startOfMonth(createDateInTimezone())
  )
  const [showYearMonth, setShowYearMonth] = useState(true)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [buttonRect, setButtonRect] = useState<DOMRect | null>(null)
  const [dropdownPosition, setDropdownPosition] = useState<'bottom' | 'top'>('bottom')

  // Sincronizar con el prop value cuando cambie
  useEffect(() => {
    if (value) {
      const date = new Date(value)
      setSelectedDate(date)
      setCurrentMonth(startOfMonth(date))
    } else {
      setSelectedDate(null)
    }
  }, [value])

  // Actualizar posición cuando se abre
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setButtonRect(rect)
      
      // Determinar si hay espacio suficiente abajo
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      const dropdownHeight = 500 // Altura aproximada del dropdown
      
      if (spaceBelow < dropdownHeight && spaceAbove > dropdownHeight) {
        setDropdownPosition('top')
      } else {
        setDropdownPosition('bottom')
      }
    }
  }, [isOpen])

  const minDateObj = minDate ? new Date(minDate) : null
  const maxDateObj = maxDate ? new Date(maxDate) : null

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date)
    // Usar dateToApiString para mantener la fecha correcta sin cambio de día
    onChange(dateToApiString(date))
    setIsOpen(false)
  }

  const handleCancel = () => {
    setIsOpen(false)
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth)
    newMonth.setMonth(newMonth.getMonth() + (direction === 'prev' ? -1 : 1))
    setCurrentMonth(newMonth)
  }

  const renderCalendar = () => {
    const monthStart = startOfMonth(currentMonth)
    const startDate = startOfWeek(monthStart)
    const days = []

    for (let i = 0; i < 42; i++) {
      const day = new Date(startDate)
      day.setDate(startDate.getDate() + i)
      days.push(day)
    }

    return (
      <div className="p-3">
        <div className="grid grid-cols-7 mb-2">
          {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'].map(day => (
            <div key={day} className="h-8 flex items-center justify-center text-xs font-medium text-tertiary">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day, idx) => {
            const isCurrentMonth = day.getMonth() === currentMonth.getMonth()
            const isSelected = selectedDate && day.toDateString() === selectedDate.toDateString()
            const isToday = day.toDateString() === createDateInTimezone().toDateString()
            const isDisabled = !isCurrentMonth || 
              (minDateObj && day < minDateObj) || 
              (maxDateObj && day > maxDateObj)

            return (
              <div
                key={idx}
                className="relative h-10 flex items-center justify-center"
              >
                <button
                  onClick={() => {
                    if (!isDisabled) {
                      handleDateSelect(day)
                    }
                  }}
                  className={cn(
                    "relative z-10 w-10 h-10 flex items-center justify-center text-sm transition-colors rounded",
                    isDisabled && "text-tertiary opacity-50 cursor-not-allowed",
                    !isDisabled && "text-primary cursor-pointer glass-hover",
                    // Selected date styling
                    isSelected && "bg-[var(--color-status-info)] dark:!text-onAccent !text-white font-semibold",
                    // Today indicator
                    isToday && !isSelected && "font-bold text-info"
                  )}
                  disabled={isDisabled}
                >
                  {day.getDate()}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const formatMonthYear = (date: Date): string => {
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
    return `${months[date.getMonth()]} ${date.getFullYear()}`
  }

  // Renderizar el dropdown usando un portal
  const renderDropdown = () => {
    if (!isOpen || !buttonRect) return null

    const dropdownStyle = {
      position: 'fixed' as const,
      ...(dropdownPosition === 'bottom' 
        ? { top: `${buttonRect.bottom + 8}px` }
        : { bottom: `${window.innerHeight - buttonRect.top + 8}px` }
      ),
      left: `${Math.min(buttonRect.left, window.innerWidth - 340)}px`, // Evitar que se salga por la derecha
      zIndex: 99999,
      width: '320px',
      maxHeight: 'auto'
    }

    return ReactDOM.createPortal(
      <div>
        {/* Backdrop */}
        <div 
          className="fixed inset-0" 
          style={{ zIndex: 99998 }}
          onClick={() => {
            setIsOpen(false)
          }}
        />
        
        {/* Dropdown con glass morphism */}
        <div 
          style={dropdownStyle}
          className="bg-secondary dark:glass border border-primary dark:border-glassBorder rounded-xl shadow-2xl overflow-hidden"
        >
          {/* Header con navegación de meses */}
          <div className="flex items-center justify-between p-3 border-b border-primary">
            <button
              onClick={() => navigateMonth('prev')}
              className="p-1.5 glass-hover rounded-lg text-tertiary hover:text-primary transition-colors"
              title="Mes anterior"
            >
              <Icons.chevronLeft className="w-4 h-4" />
            </button>
            
            <div className="px-4 py-2 font-medium text-primary flex items-center gap-1">
              <Icons.calendar className="w-3.5 h-3.5" />
              {formatMonthYear(currentMonth)}
            </div>
            
            <button
              onClick={() => navigateMonth('next')}
              className="p-1.5 glass-hover rounded-lg text-tertiary hover:text-primary transition-colors"
              title="Mes siguiente"
            >
              <Icons.chevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Year and Month Selectors */}
          {showYearMonth && (
            <div className="p-3 border-b border-primary bg-glass-subtle">
              <div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-primary font-semibold mb-1 block">MES</label>
                    <select
                      value={currentMonth.getMonth()}
                      onChange={(e) => {
                        const newMonth = new Date(currentMonth)
                        newMonth.setMonth(parseInt(e.target.value))
                        setCurrentMonth(newMonth)
                      }}
                      className="w-full px-2 py-2 bg-secondary dark:bg-primary/10 text-primary rounded-lg border border-primary dark:border-glassBorder text-sm font-medium focus:outline-none focus:border-accent-blue cursor-pointer hover:bg-glass-subtle transition-colors"
                    >
                    {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].map((month, idx) => (
                      <option key={idx} value={idx}>{month}</option>
                    ))}
                  </select>
                </div>
                  <div>
                    <label className="text-xs text-primary font-semibold mb-1 block">AÑO</label>
                    <select
                      value={currentMonth.getFullYear()}
                      onChange={(e) => {
                        const newMonth = new Date(currentMonth)
                        newMonth.setFullYear(parseInt(e.target.value))
                        setCurrentMonth(newMonth)
                      }}
                      className="w-full px-2 py-2 bg-secondary dark:bg-primary/10 text-primary rounded-lg border border-primary dark:border-glassBorder text-sm font-medium focus:outline-none focus:border-accent-blue cursor-pointer hover:bg-glass-subtle transition-colors"
                    >
                  {(() => {
                    const currentYear = getCurrentYear()
                    const minYear = minDateObj ? minDateObj.getFullYear() : currentYear - 5
                    const maxYear = maxDateObj ? maxDateObj.getFullYear() : currentYear
                    const years = []
                    for (let year = maxYear; year >= minYear; year--) {
                      years.push(year)
                    }
                    return years.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))
                  })()}
                  </select>
                </div>
              </div>
            </div>
            </div>
          )}

          {/* Calendar */}
          <div>
            {renderCalendar()}
          </div>

          {/* Footer con información y botones */}
          <div className="p-3 bg-tertiary dark:bg-primary/5 border-t border-primary flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                {selectedDate ? (
                  <div className="flex items-center gap-2">
                    <Icons.checkCircle className="w-4 h-4 text-success" />
                    <span className="text-primary font-medium">
                      {formatDate(selectedDate)}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Icons.calendar className="w-4 h-4 text-tertiary" />
                    <span className="text-tertiary">Selecciona una fecha</span>
                  </div>
                )}
              </div>
              <button
                onClick={handleCancel}
                className="p-1.5 glass-hover rounded-lg text-tertiary hover:text-primary transition-colors"
                title="Cerrar calendario"
              >
                <Icons.x className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>,
      document.body
    )
  }

  return (
    <div className={cn("relative", className)}>
      <button
        ref={buttonRef}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2 glass border border-primary rounded-lg transition-colors text-left",
          disabled ? "opacity-50 cursor-not-allowed" : "glass-hover"
        )}
      >
        <span className={cn(
          "text-sm",
          selectedDate ? "text-primary" : "text-secondary"
        )}>
          {selectedDate ? formatDate(selectedDate) : placeholder}
        </span>
        <Icons.calendar className="w-4 h-4 text-tertiary flex-shrink-0 ml-2" />
      </button>

      {renderDropdown()}
    </div>
  )
}