import React from 'react'
import { cn } from '../lib/utils'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'primary' | 'neutral' | 'secondary'
}

export function Badge({
  className,
  variant = 'default',
  children,
  ...props
}: BadgeProps) {
  const variants = {
    // Neutral - para leads, estados generales
    default: 'bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-300',
    neutral: 'bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-300',
    secondary: 'bg-gray-50 text-gray-600 dark:bg-gray-900/50 dark:text-gray-400',

    // Success - pagos completados, clientes activos
    success: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    primary: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',

    // Warning - pendiente, citas agendadas
    warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',

    // Error - reembolsado, cancelado
    error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',

    // Info - información general
    info: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium transition-colors',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}
