import React from 'react'
import { cn } from '../lib/utils'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glass' | 'metric' | 'warning' | 'info' | 'success' | 'error'
  noPadding?: boolean
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', noPadding = false, children, ...props }, ref) => {
    const variants = {
      default: 'bg-secondary',
      // All variants use glass without borders for clean look
      glass: 'glass glass-shadow glow-spot',
      metric: 'glass glass-shadow glow-spot transition-colors duration-300',
      warning: 'glass',
      info: 'glass',
      success: 'glass',
      error: 'glass',
    }

    return (
      <div
        ref={ref}
        className={cn(
          'rounded-xl relative overflow-hidden',
          variants[variant],
          !noPadding && 'p-6',
          className
        )}
        {...props}
      >
        {/* Degradado sutil + glow spot - solo en dark mode */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none only-dark">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-accent-blue rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-accent-purple rounded-full blur-3xl" />
        </div>
        <div className="relative z-10">
          {children}
        </div>
      </div>
    )
  }
)

Card.displayName = 'Card'
