import React from 'react'
import { cn } from '../lib/utils'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: React.ReactNode
  variant?: 'default' | 'glass'
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, icon, variant = 'glass', ...props }, ref) => {
    const variants = {
      default: 'bg-secondary border border-glassBorder',
      glass: 'glass',
    }

    return (
      <div className="space-y-2">
        {label && (
          <label className="text-sm font-medium text-primary">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-tertiary">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={cn(
              'w-full rounded-xl px-4 py-3 text-primary placeholder-tertiary',
              'transition-all duration-200 focus-ring-accent',
              variants[variant],
              icon && 'pl-10',
              error && 'border-error',
              className
            )}
            {...props}
          />
        </div>
        {error && (
          <p className="text-sm text-error">{error}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'