import React from 'react'
import { cn } from '../lib/utils'

interface ChartContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string
  subtitle?: string
  height?: string | number
}

export function ChartContainer({
  className,
  title,
  subtitle,
  height = 300,
  children,
  ...props
}: ChartContainerProps) {
  return (
    <div className={cn('space-y-3', className)} {...props}>
      {(title || subtitle) && (
        <div>
          {title && <h3 className="text-lg font-semibold text-primary">{title}</h3>}
          {subtitle && <p className="text-sm text-tertiary">{subtitle}</p>}
        </div>
      )}
      <div className="relative" style={{ height }}>
        {children}
      </div>
    </div>
  )
}
