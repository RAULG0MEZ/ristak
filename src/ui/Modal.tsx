import React from 'react'
import ReactDOM from 'react-dom'
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

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999]"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
      onClick={(e) => {
        // Solo cerrar si clickeas directamente en el overlay, no en el contenido
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        className={`bg-secondary dark:glass rounded-xl border border-primary shadow-2xl ${sizeClasses[size]} w-full mx-4 max-h-[90vh] overflow-y-auto ${className}`}
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

  // Renderizar el modal en su contenedor específico
  const modalRoot = document.getElementById('modal-root')
  if (!modalRoot) return null

  return ReactDOM.createPortal(
    modalContent,
    modalRoot
  )
}
