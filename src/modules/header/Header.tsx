import React, { useState, useRef, useEffect } from 'react'
import { Icons } from '../../icons'
import { Button } from '../../ui'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import { LogOut, User, Settings, ChevronDown } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/utils'

export function Header() {
  const { theme, toggleTheme } = useTheme()
  const { logout, accountName, userEmail, userInitials } = useAuth()
  const isProduction = process.env.NODE_ENV === 'production' && window.location.hostname !== 'localhost'
  const [showUserMenu, setShowUserMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // El chiste pa' cerrar el menu cuando le picas fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false)
      }
    }

    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showUserMenu])
  
  return (
    <header className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-primary">
      <div className="flex items-center gap-2 sm:gap-4 flex-1 max-w-xl ml-12 lg:ml-0">
        <div className="flex items-center gap-2 flex-1">
          <input
            type="text"
            placeholder="Buscar"
            className="flex-1 px-3 sm:px-4 py-2 glass border border-primary rounded-xl text-primary placeholder:text-tertiary focus-ring-accent transition-colors text-sm sm:text-base"
          />
          <Button
            variant="ghost"
            size="sm"
            className="p-2 glass border border-primary rounded-xl hover:glass-hover"
          >
            <Icons.send className="w-4 h-4 text-primary" />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-3">
        {isProduction && accountName && (
          <div className="flex items-center gap-2 mr-1 sm:mr-2 px-2 sm:px-3 py-1 rounded-lg bg-glass border border-glassBorder">
            <span className="text-xs sm:text-sm text-primary font-medium truncate max-w-[100px] sm:max-w-[150px]">
              {accountName}
            </span>
          </div>
        )}

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
        <Button variant="ghost" size="sm" className="p-1.5 sm:p-2 relative">
          <Icons.notification className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          <span className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 w-1.5 h-1.5 sm:w-2 sm:h-2 bg-accent-red rounded-full"></span>
        </Button>

        {/* Avatar con dropdown menu - ahora siempre visible */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className={cn(
              'flex items-center gap-2 p-1.5 sm:p-2 rounded-lg transition-all',
              'hover:glass-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent'
            )}
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full glass border border-glassBorder flex items-center justify-center">
              <span className="text-xs sm:text-sm font-normal text-tertiary">{userInitials}</span>
            </div>
            <ChevronDown className={cn(
              'w-3 h-3 sm:w-4 sm:h-4 text-tertiary transition-transform',
              showUserMenu && 'rotate-180'
            )} />
          </button>

          {/* Dropdown menu */}
          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-64 glass rounded-xl border border-glassBorder shadow-xl z-50 overflow-hidden">
              {/* Info del usuario */}
              <div className="p-4 border-b border-gray-800/20 dark:border-gray-200/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full glass border border-glassBorder flex items-center justify-center">
                    <span className="text-sm font-normal text-tertiary">{userInitials}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-primary truncate">{accountName || 'Usuario'}</p>
                    <p className="text-xs text-tertiary truncate">{userEmail || 'usuario@example.com'}</p>
                  </div>
                </div>
              </div>

              {/* Opciones del menu */}
              <div className="py-2">
                <Link
                  to="/profile"
                  onClick={() => setShowUserMenu(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-primary hover:glass-hover transition-colors"
                >
                  <User className="w-4 h-4" />
                  Mi Perfil
                </Link>
                <Link
                  to="/settings"
                  onClick={() => setShowUserMenu(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-primary hover:glass-hover transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  Configuración
                </Link>
                <div className="my-2 mx-4 border-t border-gray-800/10 dark:border-gray-200/5" />
                <button
                  onClick={() => {
                    setShowUserMenu(false)
                    logout()
                  }}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:glass-hover hover:text-red-600 transition-colors w-full text-left"
                >
                  <LogOut className="w-4 h-4" />
                  Cerrar Sesión
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
