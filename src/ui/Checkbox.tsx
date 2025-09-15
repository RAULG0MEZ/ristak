import React from 'react'
import { cn } from '../lib/utils'

interface CheckboxProps {
  checked: boolean
  onChange: () => void
  disabled?: boolean
  indeterminate?: boolean
  className?: string
}

export function Checkbox({
  checked,
  onChange,
  disabled = false,
  indeterminate = false,
  className
}: CheckboxProps) {
  return (
    <div
      onClick={disabled ? undefined : onChange}
      className={cn(
        "w-5 h-5 rounded border transition-all duration-200 cursor-pointer",
        "flex items-center justify-center",
        "focus-ring-accent",
        // Unchecked state
        !checked && !indeterminate && [
          "bg-secondary border-primary",
          "glass-hover"
        ],
        // Checked state
        checked && !indeterminate && [
          "border-[var(--color-accent-blue)] bg-[var(--color-accent-blue)]",
          "hover:bg-[color-mix(in_srgb,var(--color-accent-blue)_85%,_black_15%)]",
        ],
        // Indeterminate state
        indeterminate && [
          "border-[var(--color-accent-blue)] bg-[var(--color-accent-blue)]",
          "hover:bg-[color-mix(in_srgb,var(--color-accent-blue)_85%,_black_15%)]",
        ],
        // Disabled state
        disabled && "opacity-50 cursor-not-allowed pointer-events-none",
        className
      )}
    >
      {checked && !indeterminate && (
        <svg
          className="w-3 h-3 text-onAccent"
          viewBox="0 0 12 12"
        >
          <path
            fill="currentColor"
            d="M10.293 2.293a1 1 0 011.414 1.414l-6 6a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414L5 7.586l5.293-5.293z"
          />
        </svg>
      )}
      {indeterminate && (
        <svg
          className="w-3 h-3 text-onAccent"
          viewBox="0 0 12 12"
        >
          <rect
            fill="currentColor"
            x="2"
            y="5"
            width="8"
            height="2"
            rx="0.5"
          />
        </svg>
      )}
    </div>
  )
}
