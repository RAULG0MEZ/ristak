import React, { useState, useRef, useEffect } from 'react'
import { cn } from '../lib/utils'
import { Icons } from '../icons'
import { Button } from './Button'
import { useDateRange, startOfMonth, endOfMonth } from '../contexts/DateContext'

interface DateRangePickerProps {
  className?: string
}

interface DatePreset {
  label: string
  getValue: () => { start: Date; end: Date }
}

const formatDate = (date: Date): string => {
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`
}

const startOfWeek = (date: Date): Date => {
  const result = new Date(date)
  const day = result.getDay()
  const diff = result.getDate() - day + (day === 0 ? -6 : 1)
  result.setDate(diff)
  result.setHours(0, 0, 0, 0)
  return result
}

const endOfWeek = (date: Date): Date => {
  const result = new Date(date)
  const day = result.getDay()
  const diff = result.getDate() - day + (day === 0 ? 0 : 7)
  result.setDate(diff)
  result.setHours(23, 59, 59, 999)
  return result
}

const startOfYear = (date: Date): Date => {
  const result = new Date(date)
  result.setMonth(0, 1)
  result.setHours(0, 0, 0, 0)
  return result
}

const endOfYear = (date: Date): Date => {
  const result = new Date(date)
  result.setMonth(11, 31)
  result.setHours(23, 59, 59, 999)
  return result
}

const subDays = (date: Date, days: number): Date => {
  const result = new Date(date)
  result.setDate(result.getDate() - days)
  return result
}

export function DateRangePicker({ className }: DateRangePickerProps) {
  const { dateRange, setDateRange } = useDateRange()
  const [isOpen, setIsOpen] = useState(false)
  const [tempStartDate, setTempStartDate] = useState<Date>(dateRange.start)
  const [tempEndDate, setTempEndDate] = useState<Date>(dateRange.end)
  const [hoverDate, setHoverDate] = useState<Date | null>(null)
  const [selectingEnd, setSelectingEnd] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const presets: DatePreset[] = [
    {
      label: 'Hoy',
      getValue: () => {
        const today = new Date()
        return { start: today, end: today }
      }
    },
    {
      label: 'Ayer',
      getValue: () => {
        const yesterday = subDays(new Date(), 1)
        return { start: yesterday, end: yesterday }
      }
    },
    {
      label: 'Últimos 7 días',
      getValue: () => ({
        start: subDays(new Date(), 6),
        end: new Date()
      })
    },
    {
      label: 'Últimos 30 días',
      getValue: () => ({
        start: subDays(new Date(), 29),
        end: new Date()
      })
    },
    {
      label: 'Esta semana',
      getValue: () => ({
        start: startOfWeek(new Date()),
        end: endOfWeek(new Date())
      })
    },
    {
      label: 'Este mes',
      getValue: () => ({
        start: startOfMonth(new Date()),
        end: endOfMonth(new Date())
      })
    },
    {
      label: 'Mes pasado',
      getValue: () => {
        const lastMonth = new Date()
        lastMonth.setMonth(lastMonth.getMonth() - 1)
        return {
          start: startOfMonth(lastMonth),
          end: endOfMonth(lastMonth)
        }
      }
    },
    {
      label: 'Este año',
      getValue: () => ({
        start: startOfYear(new Date()),
        end: endOfYear(new Date())
      })
    },
    {
      label: 'Todo el tiempo',
      getValue: () => ({
        start: new Date('2020-01-01'),
        end: new Date()
      })
    }
  ]

  // Sincronizar con el contexto global cuando cambie
  useEffect(() => {
    setTempStartDate(dateRange.start)
    setTempEndDate(dateRange.end)
    setLeftMonth(startOfMonth(dateRange.start))
    const nextMonth = new Date(startOfMonth(dateRange.start))
    nextMonth.setMonth(nextMonth.getMonth() + 1)
    setRightMonth(nextMonth)
  }, [dateRange])

  const handlePresetClick = (preset: DatePreset) => {
    const { start, end } = preset.getValue()
    setTempStartDate(start)
    setTempEndDate(end)
    setSelectingEnd(false)
    setHoverDate(null)
    setDateRange({ start, end })
    setIsOpen(false)
  }

  const handleApply = () => {
    setSelectingEnd(false)
    setHoverDate(null)
    setDateRange({ start: tempStartDate, end: tempEndDate })
    setIsOpen(false)
  }

  const handleCancel = () => {
    setTempStartDate(dateRange.start)
    setTempEndDate(dateRange.end)
    setSelectingEnd(false)
    setHoverDate(null)
    setIsOpen(false)
  }

  const renderCalendar = (baseDate: Date) => {
    const monthStart = startOfMonth(baseDate)
    const startDate = startOfWeek(monthStart)
    const days = []

    for (let i = 0; i < 42; i++) {
      const day = new Date(startDate)
      day.setDate(startDate.getDate() + i)
      days.push(day)
    }

    return (
      <div className="p-4">
        <div className="grid grid-cols-7 mb-2">
          {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'].map(day => (
            <div key={day} className="h-8 flex items-center justify-center text-xs font-medium text-tertiary">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day, idx) => {
            const isCurrentMonth = day.getMonth() === baseDate.getMonth()
            const isStartDate = day.toDateString() === tempStartDate.toDateString()
            const isEndDate = day.toDateString() === tempEndDate.toDateString()
            const isInRange = day > tempStartDate && day < tempEndDate
            const isToday = day.toDateString() === new Date().toDateString()

            // Active range (either selected or hover preview)
            const getActiveBounds = () => {
              if (selectingEnd && hoverDate) {
                if (hoverDate >= tempStartDate) return { start: tempStartDate, end: hoverDate }
                return { start: hoverDate, end: tempStartDate }
              }
              return { start: tempStartDate, end: tempEndDate }
            }
            const { start: activeStart, end: activeEnd } = getActiveBounds()
            const inActiveRange = day >= activeStart && day <= activeEnd

            // Hover preview logic (for color only)
            let isInHoverRange = false
            if (selectingEnd && hoverDate) {
              if (hoverDate >= tempStartDate) {
                isInHoverRange = day > tempStartDate && day <= hoverDate
              } else {
                isInHoverRange = day >= hoverDate && day < tempStartDate
              }
            }

            // Neighbor checks for smooth corner rounding
            const dayShift = (base: Date, delta: number) => {
              const d = new Date(base)
              d.setDate(d.getDate() + delta)
              return d
            }
            const leftIn = (dayShift(day, -1) >= activeStart) && (dayShift(day, -1) <= activeEnd)
            const rightIn = (dayShift(day, 1) >= activeStart) && (dayShift(day, 1) <= activeEnd)
            const upIn = (dayShift(day, -7) >= activeStart) && (dayShift(day, -7) <= activeEnd)
            const downIn = (dayShift(day, 7) >= activeStart) && (dayShift(day, 7) <= activeEnd)

            const roundTL = inActiveRange && !upIn && !leftIn
            const roundTR = inActiveRange && !upIn && !rightIn
            const roundBL = inActiveRange && !downIn && !leftIn
            const roundBR = inActiveRange && !downIn && !rightIn

            const dayOfWeek = day.getDay()
            const isRowStart = dayOfWeek === 1 // Monday
            const isRowEnd = dayOfWeek === 0   // Sunday

            return (
              <div
                key={idx}
                className="relative h-10 flex items-center justify-center"
              >
                {/* Background layer for range */}
                {(isInRange || isStartDate || isEndDate || isInHoverRange) && (
                  <div 
                    className={cn(
                      "absolute inset-0",
                      // Fallback Tailwind bg to ensure visibility even if custom utilities fail to load
                      (isInRange || isStartDate || isEndDate) && "bg-black/10 dark:bg-white/20",
                      isInHoverRange && !isInRange && !isStartDate && !isEndDate && "bg-black/25 dark:bg-white/30",
                      // Theme-aware custom utilities (override fallbacks when present)
                      (isInRange || isStartDate || isEndDate) && "dp-range-bg",
                      isInHoverRange && !isInRange && !isStartDate && !isEndDate && "dp-hover-bg",
                      // Corner rounding only where the shape turns
                      roundTL && "rounded-tl-lg",
                      roundTR && "rounded-tr-lg",
                      roundBL && "rounded-bl-lg",
                      roundBR && "rounded-br-lg"
                    )}
                  />
                )}
                
                {/* Date button */}
                <button
                  onClick={() => {
                    if (!isCurrentMonth) return
                    
                    if (!selectingEnd) {
                      setTempStartDate(day)
                      setTempEndDate(day)
                      setSelectingEnd(true)
                      setHoverDate(null)
                    } else {
                      if (day >= tempStartDate) {
                        setTempEndDate(day)
                      } else {
                        setTempStartDate(day)
                        setTempEndDate(tempStartDate)
                      }
                      setSelectingEnd(false)
                      setHoverDate(null)
                    }
                  }}
                  onMouseEnter={() => {
                    if (selectingEnd && isCurrentMonth) {
                      setHoverDate(day)
                    }
                  }}
                  onMouseLeave={() => {
                    setHoverDate(null)
                  }}
                  className={cn(
                    "relative z-10 w-10 h-10 flex items-center justify-center text-sm transition-colors rounded",
                    !isCurrentMonth && "text-tertiary opacity-50 cursor-not-allowed",
                    isCurrentMonth && !isStartDate && !isEndDate && !isInRange && "text-primary cursor-pointer hover:bg-black/5 dark:hover:bg-white/10",
                    // Selected dates styling (theme-aware strong edge markers)
                    (isStartDate || isEndDate) && "bg-gray-900 dark:bg-white text-white dark:text-black dp-edge-bg dp-edge-text font-semibold cursor-pointer",
                    // Today indicator
                    isToday && !isStartDate && !isEndDate && "!font-extrabold"
                  )}
                  disabled={!isCurrentMonth}
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

  const [leftMonth, setLeftMonth] = useState(() => startOfMonth(dateRange.start))
  const [rightMonth, setRightMonth] = useState(() => {
    const next = new Date(startOfMonth(dateRange.start))
    next.setMonth(next.getMonth() + 1)
    return next
  })

  const navigateMonths = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      const newLeft = new Date(leftMonth)
      newLeft.setMonth(newLeft.getMonth() - 1)
      setLeftMonth(newLeft)
      
      const newRight = new Date(rightMonth)
      newRight.setMonth(newRight.getMonth() - 1)
      setRightMonth(newRight)
    } else {
      const newLeft = new Date(leftMonth)
      newLeft.setMonth(newLeft.getMonth() + 1)
      setLeftMonth(newLeft)
      
      const newRight = new Date(rightMonth)
      newRight.setMonth(newRight.getMonth() + 1)
      setRightMonth(newRight)
    }
  }

  const formatMonthYear = (date: Date): string => {
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
    return `${months[date.getMonth()]} ${date.getFullYear()}`
  }

  return (
    <div className={cn("relative inline-block", className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 glass border border-primary rounded-xl glass-hover transition-colors"
      >
        <Icons.calendar className="w-4 h-4 text-tertiary hidden sm:block" />
        <span className="text-xs sm:text-sm font-medium text-primary whitespace-nowrap">
          {formatDate(dateRange.start)} - {formatDate(dateRange.end)}
        </span>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/20 dark:bg-black/30 backdrop-blur-sm z-40" 
            onClick={() => {
              setIsOpen(false)
              setSelectingEnd(false)
              setHoverDate(null)
              setTempStartDate(dateRange.start)
              setTempEndDate(dateRange.end)
            }}
          />
          
          {/* Dropdown con glass morphism */}
          <div 
            ref={dropdownRef}
            className="absolute top-full mt-2 left-0 glass border border-primary/30 dark:border-white/10 rounded-xl z-50 shadow-2xl w-[calc(100vw-2rem)] sm:w-auto sm:min-w-[600px] sm:max-w-[800px] max-w-[calc(100vw-2rem)]"
          >
            <div className="flex">
              {/* Presets */}
              <div className="w-48 p-2 border-r border-primary/20 dark:border-white/10">
                <div className="space-y-1">
                  {presets.map(preset => (
                    <button
                      key={preset.label}
                      onClick={() => handlePresetClick(preset)}
                      className={(() => {
                        const { start, end } = preset.getValue()
                        const isSelected = start.toDateString() === tempStartDate.toDateString() && 
                                         end.toDateString() === tempEndDate.toDateString()
                        if (isSelected) {
                          return "w-full text-left px-3 py-2 text-sm rounded-lg transition-colors bg-tertiary/20 text-primary font-medium"
                        }
                        return "w-full text-left px-3 py-2 text-sm rounded-lg transition-colors text-secondary hover:bg-tertiary/10 hover:text-primary"
                      })()}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Calendars */}
              <div className="flex flex-col">
                <div className="flex items-center justify-between p-3 border-b border-primary/20 dark:border-white/10">
                  <button
                    onClick={() => navigateMonths('prev')}
                    className="p-1 glass-hover rounded text-tertiary hover:text-primary transition-colors"
                  >
                    <Icons.chevronLeft className="w-4 h-4" />
                  </button>
                  
                  <div className="flex gap-8">
                    <span className="font-medium text-primary">
                      {formatMonthYear(leftMonth)}
                    </span>
                    <span className="font-medium text-primary">
                      {formatMonthYear(rightMonth)}
                    </span>
                  </div>
                  
                  <button
                    onClick={() => navigateMonths('next')}
                    className="p-1 glass-hover rounded text-tertiary hover:text-primary transition-colors"
                  >
                    <Icons.chevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex">
                  {renderCalendar(leftMonth)}
                  <div className="w-px bg-primary/20 dark:bg-white/10" />
                  {renderCalendar(rightMonth)}
                </div>

                {/* Selected range display */}
                <div className="p-3 border-t border-primary/20 dark:border-white/10">
                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      <span className="text-tertiary">Desde:</span>{' '}
                      <span className="font-medium text-primary">
                        {formatDate(tempStartDate)}
                      </span>
                      {' - '}
                      <span className="text-tertiary">Hasta:</span>{' '}
                      <span className="font-medium text-primary">
                        {formatDate(tempEndDate)}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={handleCancel}
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={handleApply}
                      >
                        Aplicar
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
