import React from 'react'
import { cn } from '../lib/utils'

interface PageContainerProps {
  children: React.ReactNode
  className?: string
}

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div className={cn("p-6 text-primary", className)}>
      <div className="max-w-7xl mx-auto">
        {children}
      </div>
    </div>
  )
}