import React from 'react'
import { cn } from '../lib/utils'

interface Tab {
  value: string
  label: string
}

interface TabListProps {
  tabs: Tab[]
  value: string
  onChange: (value: string) => void
  className?: string
}

export function TabList({ tabs, value, onChange, className }: TabListProps) {
  return (
    <div className={cn("flex glass border border-primary rounded-xl p-1", className)}>
      {tabs.map(tab => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
            value === tab.value
              ? 'bg-secondary text-primary shadow-sm'
              : 'text-secondary hover:text-primary'
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
