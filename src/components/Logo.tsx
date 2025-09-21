import React from 'react'
import { useTheme } from '../contexts/ThemeContext'

interface LogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
}

export function Logo({ className = '', size = 'md' }: LogoProps) {
  const { theme } = useTheme()

  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-14 h-14',
    lg: 'w-20 h-20',
    xl: 'w-24 h-24',
    '2xl': 'w-24 h-10'  // Más pequeño para el sidebar
  }

  // Filtro para cambiar color del SVG según el tema
  const filterStyle = theme === 'dark' ? 'invert(1) brightness(2)' : 'invert(0)'

  return (
    <div className={`${sizeClasses[size]} ${className}`}>
      <img
        src="/logo.svg"
        alt="RISTAK"
        className="w-full h-full object-contain"
        style={{ filter: filterStyle }}
      />
    </div>
  )
}
