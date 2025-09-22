import React, { useState, useRef, useEffect } from 'react'
import { cn } from '../lib/utils'
import { ChevronDown } from 'lucide-react'
import { createPortal } from 'react-dom'

// Para compatibilidad con el componente anterior
interface LegacySelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  placeholder?: string
}

// Componente legacy para no romper otros lugares donde se use
export function LegacySelect({ className, placeholder, children, ...props }: LegacySelectProps) {
  return (
    <select
      className={cn(
        'px-4 py-2 glass border border-primary rounded-xl',
        'text-primary focus-ring-accent transition-all',
        'appearance-none cursor-pointer',
        className
      )}
      {...props}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {children}
    </select>
  )
}

// Nuevo componente Select custom
interface SelectOption {
  value: string
  label: string
  count?: number
}

interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  className?: string
  label?: string
}

export function Select({
  value,
  onChange,
  options,
  placeholder = 'Seleccionar...',
  className,
  label
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Obtener el label de la opción seleccionada
  const selectedOption = options.find(opt => opt.value === value)
  const displayLabel = selectedOption?.label || placeholder

  // Actualizar posición del dropdown
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const scrollY = window.scrollY || document.documentElement.scrollTop
      const scrollX = window.scrollX || document.documentElement.scrollLeft

      setPosition({
        top: rect.bottom + scrollY + 4,
        left: rect.left + scrollX,
        width: rect.width
      })
    }
  }, [isOpen])

  // Cerrar al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Cerrar con Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const handleSelect = (optionValue: string) => {
    onChange(optionValue)
    setIsOpen(false)
  }

  return (
    <div className="flex items-center gap-2">
      {label && (
        <span className="text-xs text-tertiary">{label}</span>
      )}

      {/* Trigger Button */}
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "px-3 py-2 rounded-lg glass border border-glassBorder",
          "text-sm text-primary min-w-[250px]",
          "bg-glass/50 backdrop-blur-xl",
          "flex items-center justify-between",
          "cursor-pointer transition-all duration-200",
          "hover:bg-glass/70 hover:border-primary/30",
          "focus:outline-none focus:border-primary/50",
          className
        )}
      >
        <span className="truncate text-left">
          {displayLabel}
          {selectedOption?.count !== undefined && (
            <span className="text-tertiary ml-1">
              ({selectedOption.count} sesiones)
            </span>
          )}
        </span>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-tertiary transition-transform duration-200 ml-2 flex-shrink-0",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {/* Dropdown Portal */}
      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-50"
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
            width: `${position.width}px`
          }}
        >
          <div className="glass border border-glassBorder rounded-lg shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="py-1 max-h-[300px] overflow-y-auto">
              {options.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    "w-full px-3 py-2 text-sm text-left",
                    "transition-all duration-150",
                    "hover:bg-white/5",
                    value === option.value ? (
                      "bg-primary/10 text-primary font-medium"
                    ) : (
                      "text-secondary hover:text-primary"
                    )
                  )}
                >
                  <span>{option.label}</span>
                  {option.count !== undefined && (
                    <span className="text-tertiary ml-1">
                      ({option.count} sesiones)
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
