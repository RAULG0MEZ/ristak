import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Icons } from '../../icons'
import { Logo } from '../../ui'
import { cn } from '../../lib/utils'
import { useDeployment } from '../../contexts/DeploymentContext'

const navigation = [
  { name: 'Dashboard', href: '/', icon: Icons.dashboard },
  { name: 'Reportes', href: '/reports', icon: Icons.reports },
  { name: 'Campañas', href: '/campaigns', icon: Icons.campaigns },
  { name: 'Pagos', href: '/payments', icon: Icons.dollar },
  { name: 'Contactos', href: '/contacts', icon: Icons.users },
]

export function Sidebar() {
  const location = useLocation()
  const { isDeploying, startDeployment } = useDeployment()
  
  // Only show deploy button on localhost
  const [showDeployButton, setShowDeployButton] = useState(false)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname
      setShowDeployButton(host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1')
    }
  }, [])
  
  
  return (
    <div className="flex flex-col h-full p-4">
      <div className="flex items-center justify-center mb-8">
        <Logo size="2xl" />
      </div>

      <nav className="flex-1 space-y-1">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium',
                isActive
                  ? 'glass text-primary'
                  : 'text-tertiary hover:text-primary glass-hover'
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </Link>
          )
        })}
      </nav>

      {/* Deploy button - only visible on localhost */}
      {showDeployButton && (
        <div className="px-2 pb-4">
          <button
            onClick={startDeployment}
            disabled={isDeploying}
            className={cn(
              'w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150',
              'glass-primary text-primary hover:opacity-90',
              isDeploying && 'opacity-60 cursor-wait'
            )}
            title="Deploy a producción"
          >
            <Icons.rocket className={cn('w-4 h-4', isDeploying && 'animate-pulse')} />
            {isDeploying ? 'Desplegando…' : 'Deploy a producción'}
          </button>
        </div>
      )}

      <div className="mt-auto pt-4 border-t border-primary">
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-700 to-gray-900 dark:from-gray-200 dark:to-gray-400 flex items-center justify-center flex-shrink-0 shadow-lg">
            <span className="text-base font-bold text-white dark:text-gray-900">RG</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-primary truncate">Raúl Gómez</p>
            <p className="text-xs text-tertiary truncate">raulgomiez@gmail.com</p>
          </div>
        </div>
      </div>
    </div>
  )
}
