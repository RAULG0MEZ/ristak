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
    default: 'bg-white/10 text-primary border border-glassBorder',
    neutral: 'bg-white/10 text-primary border border-glassBorder',
    secondary: 'bg-white/5 text-secondary border border-glassBorder',

    // Success - pagos completados, clientes activos
    success: 'bg-success/15 text-success border border-success/20',
    primary: 'bg-primary/15 text-primary border border-primary/20',

    // Warning - pendiente, citas agendadas
    warning: 'bg-warning/15 text-warning border border-warning/20',

    // Error - reembolsado, cancelado
    error: 'bg-error/15 text-error border border-error/20',

    // Info - información general
    info: 'bg-info/15 text-info border border-info/20',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold transition-all',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}
