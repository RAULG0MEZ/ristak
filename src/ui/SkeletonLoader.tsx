import React from 'react'
import { cn } from '../lib/utils'

interface SkeletonLoaderProps {
  className?: string
  variant?: 'text' | 'card' | 'table'
  rows?: number
  columns?: number
}

export function SkeletonLoader({ 
  className, 
  variant = 'text',
  rows = 1,
  columns = 8
}: SkeletonLoaderProps) {
  if (variant === 'card') {
    return (
      <div className={cn('rounded-xl border border-primary p-4 glass relative overflow-hidden', className)}>
        <div className="animate-pulse">
          <div className="h-4 bg-[var(--color-background-glass)] rounded w-1/3 mb-3 relative overflow-hidden">
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
          </div>
          <div className="h-8 bg-[var(--color-background-glass)] rounded w-2/3 mb-2 relative overflow-hidden">
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
          </div>
          <div className="h-3 bg-[var(--color-background-glass)] rounded w-1/2 relative overflow-hidden">
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
          </div>
        </div>
      </div>
    )
  }

  if (variant === 'table') {
    return (
      <div className={cn('space-y-2', className)}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="animate-pulse flex gap-4 p-3">
            {Array.from({ length: columns }).map((_, j) => (
              <div key={j} className={cn(
                "h-4 bg-[var(--color-background-glass)] rounded relative overflow-hidden",
                j === 0 ? "flex-1" : j < 3 ? "w-24" : "w-20"
              )}>
                <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
              </div>
            ))}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={cn('animate-pulse', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-4 bg-[var(--color-background-glass)] rounded mb-2 relative overflow-hidden">
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
        </div>
      ))}
    </div>
  )
}
