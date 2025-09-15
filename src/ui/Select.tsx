import React from 'react'
import { cn } from '../lib/utils'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  placeholder?: string
}

export function Select({ className, placeholder, children, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        'px-4 py-2 glass border border-primary rounded-xl',
        'text-primary focus-ring-accent transition-all',
        'appearance-none cursor-pointer',
        className
      )}
      {...props}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {children}
    </select>
  )
}
