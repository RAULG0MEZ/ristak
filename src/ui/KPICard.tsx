import React from 'react'
import { Card } from './Card'
import { cn } from '../lib/utils'

interface KPICardProps {
  title: string
  value: string | number
  change?: number
  trend?: 'up' | 'down'
  subtitle?: string
  icon?: React.ComponentType<any>
  iconColor?: string
  className?: string
}

export function KPICard({
  title,
  value,
  change,
  trend,
  subtitle,
  icon: Icon,
  iconColor = 'text-accent-blue',
  className,
}: KPICardProps) {
  const trendColor = trend === 'up' ? 'text-success' : trend === 'down' ? 'text-error' : 'text-tertiary'

  return (
    <Card variant="glass" className={cn('p-4 overflow-hidden', className)}>
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-tertiary mb-1">{title}</p>
          <p className="text-2xl font-bold text-primary truncate">{value}</p>
          {change !== undefined && (
            <div className={cn('text-xs mt-1', trendColor)}>
              <span>{change > 0 ? '+' : ''}{change.toFixed(1)}%</span>
              <span className="text-tertiary ml-1">vs anterior</span>
            </div>
          )}
          {subtitle && (
            <p className="text-xs text-tertiary mt-1">{subtitle}</p>
          )}
        </div>
        {Icon && (
          <Icon className={cn('w-6 h-6 flex-shrink-0', iconColor)} />
        )}
      </div>
    </Card>
  )
}
