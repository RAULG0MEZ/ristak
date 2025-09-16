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
    default: 'bg-primary/10 text-secondary',
    neutral: 'bg-primary/10 text-secondary',
    secondary: 'bg-primary/10 text-tertiary',

    // Success - pagos completados, clientes activos
    success: 'bg-success/10 text-success',
    primary: 'bg-success/10 text-success',

    // Warning - pendiente, citas agendadas
    warning: 'bg-warning/10 text-warning',

    // Error - reembolsado, cancelado
    error: 'bg-error/10 text-error',

    // Info - información general
    info: 'bg-info/10 text-info',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium transition-all',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}
