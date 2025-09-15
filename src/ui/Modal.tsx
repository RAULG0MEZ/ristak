import React from 'react'
import { Icons } from '../icons'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  icon?: React.ReactNode
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showCloseButton?: boolean
  className?: string
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

export function Modal({ 
  isOpen, 
  onClose, 
  title, 
  icon,
  children, 
  size = 'md',
  showCloseButton = true,
  className = ''
}: ModalProps) {
  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100]" 
      onClick={onClose}
    >
      <div 
        className={`bg-secondary dark:glass rounded-xl border border-primary shadow-2xl ${sizeClasses[size]} w-full mx-4 max-h-[90vh] overflow-y-auto z-[101] ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between p-6 border-b border-primary">
            <div className="flex items-center gap-3">
              {icon}
              {title && <h2 className="text-lg font-semibold text-primary">{title}</h2>}
            </div>
            {showCloseButton && (
              <button 
                onClick={onClose} 
                className="text-tertiary hover:text-primary transition-colors"
              >
                <Icons.x className="w-5 h-5" />
              </button>
            )}
          </div>
        )}
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  )
}
