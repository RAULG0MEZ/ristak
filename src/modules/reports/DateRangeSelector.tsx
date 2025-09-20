import React, { useState } from 'react'
import { cn } from '../../lib/utils'
import { getCurrentYear, formatDateShort, dateToApiString, createDateInTimezone } from '../../lib/dateUtils'
import { Icons } from '../../icons'

interface DateRangeSelectorProps {
  viewType: 'day' | 'month' | 'year'
  monthRange: 'last12' | 'thisYear' | 'custom'
  dateRange: { start: Date; end: Date }
  yearRange: { start: number; end: number }
  customMonthYear: number
  customMonthStart: number
  customMonthEnd: number
  onDateRangeChange: (range: { start: Date; end: Date }) => void
  onMonthRangeChange: (range: 'last12' | 'thisYear' | 'custom') => void
  onYearRangeChange: (range: { start: number; end: number }) => void
  onCustomMonthChange: (year: number, start: number, end: number) => void
}

export function DateRangeSelector({
  viewType,
  monthRange,
  dateRange,
  yearRange,
  customMonthYear,
  customMonthStart,
  customMonthEnd,
  onDateRangeChange,
  onMonthRangeChange,
  onYearRangeChange,
  onCustomMonthChange,
}: DateRangeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)

  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ]

  const currentYear = getCurrentYear()
  const years = Array.from({ length: 10 }, (_, i) => currentYear - i)

  // Obtener el label actual según el tipo de vista
  const getCurrentLabel = () => {
    if (viewType === 'day') {
      const formatDate = (date: Date) => {
        return formatDateShort(date)
      }
      return `${formatDate(dateRange.start)} - ${formatDate(dateRange.end)}`
    } else if (viewType === 'month') {
      if (monthRange === 'last12') return 'Últimos 12 meses'
      if (monthRange === 'thisYear') return `Año ${currentYear}`
      if (monthRange === 'custom') {
        if (customMonthStart === customMonthEnd) {
          return `${months[customMonthStart]} ${customMonthYear}`
        }
        return `${months[customMonthStart]} - ${months[customMonthEnd]} ${customMonthYear}`
      }
    } else if (viewType === 'year') {
      if (yearRange.start === yearRange.end) {
        return `Año ${yearRange.start}`
      }
      return `${yearRange.start} - ${yearRange.end}`
    }
    return 'Seleccionar período'
  }

  // Renderizar contenido según el tipo de vista
  const renderContent = () => {
    if (viewType === 'day') {
      return (
        <div className="p-4 min-w-[280px]">
          <div className="space-y-2 mb-4">
            <h4 className="text-sm font-medium text-tertiary mb-2">Rangos rápidos</h4>
            {[
              { label: 'Hoy', days: 0 },
              { label: 'Ayer', days: 1 },
              { label: 'Últimos 7 días', days: 7 },
              { label: 'Últimos 30 días', days: 30 },
              { label: 'Últimos 90 días', days: 90 },
            ].map(range => (
              <button
                key={range.label}
                onClick={() => {
                  const end = createDateInTimezone()
                  let start = createDateInTimezone()
                  if (range.days === 0) {
                    onDateRangeChange({ start: end, end })
                  } else if (range.days === 1) {
                    start.setDate(start.getDate() - 1)
                    onDateRangeChange({ start, end: start })
                  } else {
                    start.setDate(start.getDate() - (range.days - 1))
                    onDateRangeChange({ start, end })
                  }
                  setIsOpen(false)
                }}
                className="w-full text-left px-3 py-2 text-sm text-secondary rounded glass-hover transition-colors"
              >
                {range.label}
              </button>
            ))}
          </div>
          
          <div className="border-t border-primary pt-4">
            <h4 className="text-sm font-medium text-tertiary mb-2">Personalizado</h4>
            <div className="space-y-2">
              <input
                type="date"
                className="w-full px-3 py-2 bg-secondary border border-primary rounded text-primary text-sm"
                value={dateToApiString(dateRange.start)}
                onChange={(e) => {
                  const [year, month, day] = e.target.value.split('-').map(Number)
                  onDateRangeChange({
                    ...dateRange,
                    start: createDateInTimezone(year, month - 1, day, 0, 0)
                  })
                }}
              />
              <input
                type="date"
                className="w-full px-3 py-2 bg-secondary border border-primary rounded text-primary text-sm"
                value={dateToApiString(dateRange.end)}
                onChange={(e) => {
                  const [year, month, day] = e.target.value.split('-').map(Number)
                  onDateRangeChange({
                    ...dateRange,
                    end: createDateInTimezone(year, month - 1, day, 23, 59)
                  })
                }}
              />
            </div>
          </div>
        </div>
      )
    } else if (viewType === 'month') {
      return (
        <div className="p-4 min-w-[280px]">
          <div className="space-y-2 mb-4">
            <h4 className="text-sm font-medium text-tertiary mb-2">Períodos predefinidos</h4>
            <button
              onClick={() => {
                onMonthRangeChange('last12')
                setIsOpen(false)
              }}
              className={cn(
                "w-full text-left px-3 py-2 text-sm rounded transition-colors",
                monthRange === 'last12' 
                  ? "bg-white/10 text-primary border border-white/20" 
                  : "text-secondary glass-hover"
              )}
            >
              <Icons.check className={cn(
                "inline w-4 h-4 mr-2",
                monthRange === 'last12' ? "opacity-100" : "opacity-0"
              )} />
              Últimos 12 meses
            </button>
            <button
              onClick={() => {
                onMonthRangeChange('thisYear')
                setIsOpen(false)
              }}
              className={cn(
                "w-full text-left px-3 py-2 text-sm rounded transition-colors",
                monthRange === 'thisYear' 
                  ? "bg-white/10 text-primary border border-white/20" 
                  : "text-secondary glass-hover"
              )}
            >
              <Icons.check className={cn(
                "inline w-4 h-4 mr-2",
                monthRange === 'thisYear' ? "opacity-100" : "opacity-0"
              )} />
              Año actual ({currentYear})
            </button>
          </div>

          <div className="border-t border-primary pt-4">
            <h4 className="text-sm font-medium text-tertiary mb-2">Trimestres {customMonthYear}</h4>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {[
                { label: 'Q1', start: 0, end: 2 },
                { label: 'Q2', start: 3, end: 5 },
                { label: 'Q3', start: 6, end: 8 },
                { label: 'Q4', start: 9, end: 11 },
              ].map(q => (
                <button
                  key={q.label}
                  onClick={() => {
                    onMonthRangeChange('custom')
                    onCustomMonthChange(customMonthYear, q.start, q.end)
                    setIsOpen(false)
                  }}
                  className="px-3 py-2 text-sm text-secondary rounded glass-hover transition-colors"
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-primary pt-4">
            <h4 className="text-sm font-medium text-tertiary mb-2">Rango personalizado</h4>
            <div className="space-y-2">
              <select
                className="w-full px-3 py-2 bg-secondary border border-primary rounded text-primary text-sm"
                value={customMonthYear}
                onChange={(e) => onCustomMonthChange(
                  parseInt(e.target.value),
                  customMonthStart,
                  customMonthEnd
                )}
              >
                {years.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <select
                className="flex-1 px-3 py-2 bg-secondary border border-primary rounded text-primary text-sm"
                value={customMonthStart}
                  onChange={(e) => {
                    onMonthRangeChange('custom')
                    onCustomMonthChange(
                      customMonthYear,
                      parseInt(e.target.value),
                      customMonthEnd
                    )
                  }}
                >
                  {months.map((month, i) => (
                    <option key={i} value={i}>{month}</option>
                  ))}
                </select>
                <select
                className="flex-1 px-3 py-2 bg-secondary border border-primary rounded text-primary text-sm"
                value={customMonthEnd}
                  onChange={(e) => {
                    onMonthRangeChange('custom')
                    onCustomMonthChange(
                      customMonthYear,
                      customMonthStart,
                      parseInt(e.target.value)
                    )
                  }}
                >
                  {months.map((month, i) => (
                    <option key={i} value={i} disabled={i < customMonthStart}>
                      {month}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      )
    } else if (viewType === 'year') {
      return (
        <div className="p-4 min-w-[280px]">
          <div className="space-y-2 mb-4">
            <h4 className="text-sm font-medium text-tertiary mb-2">Períodos comunes</h4>
            {[
              { label: 'Últimos 3 años', years: 3 },
              { label: 'Últimos 5 años', years: 5 },
              { label: `Solo ${currentYear}`, years: 0 },
            ].map(range => (
              <button
                key={range.label}
                onClick={() => {
                  if (range.years === 0) {
                    onYearRangeChange({ start: currentYear, end: currentYear })
                  } else {
                    onYearRangeChange({ start: currentYear - range.years + 1, end: currentYear })
                  }
                  setIsOpen(false)
                }}
                className="w-full text-left px-3 py-2 text-sm text-secondary rounded glass-hover transition-colors"
              >
                {range.label}
              </button>
            ))}
          </div>

          <div className="border-t border-primary pt-4">
            <h4 className="text-sm font-medium text-tertiary mb-2">Rango personalizado</h4>
            <div className="flex gap-2">
              <select
                className="flex-1 px-3 py-2 bg-secondary border border-primary rounded text-primary text-sm"
                value={yearRange.start}
                onChange={(e) => onYearRangeChange({ 
                  ...yearRange, 
                  start: parseInt(e.target.value) 
                })}
              >
                {years.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <span className="text-tertiary self-center">-</span>
              <select
                className="flex-1 px-3 py-2 bg-secondary border border-primary rounded text-primary text-sm"
                value={yearRange.end}
                onChange={(e) => onYearRangeChange({ 
                  ...yearRange, 
                  end: parseInt(e.target.value) 
                })}
              >
                {years.map(year => (
                  <option key={year} value={year} disabled={year < yearRange.start}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 glass border border-primary rounded-lg glass-hover transition-colors"
      >
        <Icons.calendar className="w-4 h-4 text-tertiary" />
        <span className="text-sm font-medium text-primary">{getCurrentLabel()}</span>
        <Icons.chevronDown className="w-4 h-4 text-tertiary" />
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full mt-2 left-0 glass rounded-xl z-50 shadow-2xl">
            {renderContent()}
          </div>
        </>
      )}
    </div>
  )
}
