import React, { useRef, useEffect, useState } from 'react'
import { cn } from '../lib/utils'
import { createPortal } from 'react-dom'

interface DropdownProps {
  trigger: React.ReactNode
  children: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  align?: 'start' | 'center' | 'end'
  className?: string
}

export function Dropdown({
  trigger,
  children,
  open: controlledOpen,
  onOpenChange,
  align = 'end',
  className
}: DropdownProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setOpen = onOpenChange || setInternalOpen

  useEffect(() => {
    if (open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const scrollY = window.scrollY || document.documentElement.scrollTop
      const scrollX = window.scrollX || document.documentElement.scrollLeft
      
      let left = rect.left + scrollX
      
      if (align === 'end') {
        left = rect.right + scrollX
      } else if (align === 'center') {
        left = rect.left + scrollX + rect.width / 2
      }
      
      setPosition({
        top: rect.bottom + scrollY + 8,
        left,
        width: rect.width
      })
    }
  }, [open, align])

  useEffect(() => {
    if (!open) return

    const handleClickOutside = (event: MouseEvent) => {
      if (
        triggerRef.current && 
        !triggerRef.current.contains(event.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open, setOpen])

  return (
    <>
      <div 
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        className="inline-block"
      >
        {trigger}
      </div>
      
      {open && createPortal(
        <div
          ref={dropdownRef}
          className={cn(
            "fixed z-[9999] min-w-[200px]",
            "glass border border-primary rounded-xl shadow-2xl",
            "animate-in fade-in-0 zoom-in-95",
            className
          )}
          style={{
            top: `${position.top}px`,
            left: align === 'end' ? undefined : `${position.left}px`,
            right: align === 'end' ? `${window.innerWidth - position.left}px` : undefined,
            transform: align === 'center' ? 'translateX(-50%)' : undefined
          }}
        >
          {children}
        </div>,
        document.body
      )}
    </>
  )
}
