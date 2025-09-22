import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Icons } from '../../icons'
import { Logo } from '../../ui'
import { cn } from '../../lib/utils'
import { useDeployment } from '../../contexts/DeploymentContext'

const navigation = [
  { name: 'Dashboard', href: '/', icon: Icons.dashboard },
  { name: 'Reportes', href: '/reports', icon: Icons.reports },
  { name: 'Analíticas', href: '/analytics', icon: Icons.trendingUp },
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
    <div className="flex flex-col h-full">
      {/* Logo - alineación exacta con el header */}
      <div className="flex items-center justify-center px-4 h-[84px] border-b border-primary">
        <Logo size="2xl" />
      </div>

      <nav className="flex-1 space-y-1 p-4 pt-3">
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
        <div className="p-4 pt-0">
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

      {/* Configuración en la parte de abajo */}
      <div className="mt-auto p-4 border-t border-primary">
        <Link
          to="/settings"
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full',
            location.pathname === '/settings'
              ? 'glass text-primary'
              : 'text-tertiary hover:text-primary glass-hover'
          )}
        >
          <Icons.settings className="w-5 h-5" />
          Configuración
        </Link>
      </div>
    </div>
  )
}
