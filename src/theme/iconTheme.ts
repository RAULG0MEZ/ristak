// Centralizado de estilos de iconos para consistencia entre KPIs y otros componentes
export const iconTheme = {
  // Colores para iconos en light mode
  light: {
    visitors: {
      iconColor: 'text-accent-blue',
      bgColor: 'bg-accent-blue/5',
      borderColor: 'border-accent-blue/10'
    },
    leads: {
      iconColor: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-100'
    },
    qualified: {
      iconColor: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      borderColor: 'border-indigo-100'
    },
    customers: {
      iconColor: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-100'
    },
    // KPI default
    default: {
      iconColor: 'text-primary',
      bgColor: 'bg-glass-subtle',
      borderColor: 'border-primary'
    }
  },
  // Colores para iconos en dark mode
  dark: {
    visitors: {
      iconColor: 'text-accent-blue',
      bgColor: 'bg-accent-blue/10',
      borderColor: 'border-accent-blue/20'
    },
    leads: {
      iconColor: 'text-purple-400', 
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/20'
    },
    qualified: {
      iconColor: 'text-indigo-400',
      bgColor: 'bg-indigo-500/10',
      borderColor: 'border-indigo-500/20'
    },
    customers: {
      iconColor: 'text-green-400',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/20'
    },
    // KPI default
    default: {
      iconColor: 'text-primary',
      bgColor: 'bg-glass-subtle',
      borderColor: 'border-primary'
    }
  },
  // Colores sólidos para barras de progreso
  progressColors: {
    light: {
      visitors: 'bg-accent-blue',
      leads: 'bg-purple-500',
      qualified: 'bg-indigo-500',
      customers: 'bg-green-500'
    },
    dark: {
      visitors: 'bg-accent-blue',
      leads: 'bg-purple-400',
      qualified: 'bg-indigo-400',
      customers: 'bg-green-400'
    }
  }
}