import React from 'react'
import { Icons } from '../../icons'
import { Button } from '../../ui'
import { useTheme } from '../../contexts/ThemeContext'
import { useNavigate } from 'react-router-dom'

export function Header() {
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  
  return (
    <header className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-primary">
      <div className="flex items-center gap-2 sm:gap-4 flex-1 max-w-xl ml-12 lg:ml-0">
        <div className="relative flex-1">
          <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
          <input
            type="text"
            placeholder="Buscar"
            className="w-full pl-10 pr-3 sm:pr-4 py-2 glass border border-primary rounded-xl text-primary placeholder:text-tertiary focus-ring-accent transition-colors text-sm sm:text-base"
          />
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-3">
        <Button 
          variant="ghost" 
          size="sm" 
          className="p-1.5 sm:p-2"
          onClick={toggleTheme}
        >
          {theme === 'light' ? (
            <Icons.moon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          ) : (
            <Icons.sun className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          )}
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          className="p-1.5 sm:p-2"
          onClick={() => navigate('/settings')}
        >
          <Icons.settings className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
        </Button>
        <Button variant="ghost" size="sm" className="p-1.5 sm:p-2 relative">
          <Icons.notification className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          <span className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 w-1.5 h-1.5 sm:w-2 sm:h-2 bg-accent-red rounded-full"></span>
        </Button>
      </div>
    </header>
  )
}
