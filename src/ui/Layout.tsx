import React from 'react'
import { cn } from '../lib/utils'
import { useTheme } from '../contexts/ThemeContext'

interface LayoutProps {
  children: React.ReactNode
  sidebar: React.ReactNode
}

export function Layout({ children, sidebar }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const { themeData } = useTheme()
  
  return (
    <div 
      className="flex h-screen overflow-hidden relative bg-primary"
    >
      {/* Liquid glass background (photo/gradient + subtle blur) */}
      <div className="absolute inset-0 app-bg pointer-events-none" aria-hidden="true" />
      
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <aside className={cn(
        "w-[240px] border-r border-primary flex-shrink-0",
        "glass relative z-30",
        "lg:block",
        sidebarOpen ? "fixed inset-y-0 left-0 z-50" : "hidden lg:block"
      )}>
        {sidebar}
      </aside>
      
      {/* Main content */}
      <main className="flex-1 overflow-auto relative z-10">
        {/* Mobile menu button */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden fixed top-4 left-4 z-30 p-2 rounded-lg bg-secondary/80 backdrop-blur-md border border-primary"
        >
          <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        {children}
      </main>
    </div>
  )
}

interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  cols?: 1 | 2 | 3 | 4
}

export function Grid({ className, cols = 3, children, ...props }: GridProps) {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 lg:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  }

  return (
    <div
      className={cn('grid gap-6', gridCols[cols], className)}
      {...props}
    >
      {children}
    </div>
  )
}
