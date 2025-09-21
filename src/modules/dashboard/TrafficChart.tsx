import React from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { Card } from '../../ui'
import { Icons } from '../../icons'
import { useDateRange } from '../../contexts/DateContext'
import { useTrafficData } from '../../hooks/useTrafficData'
import { useTheme } from '../../contexts/ThemeContext'
// Íconos de redes sociales oficiales
import {
  FaFacebook, FaInstagram, FaGoogle, FaTiktok,
  FaLinkedin, FaXTwitter, FaPinterest, FaSnapchat,
  FaReddit, FaWhatsapp
} from 'react-icons/fa6'
import { HiMail, HiSearch, HiLink, HiExternalLink, HiQuestionMarkCircle } from 'react-icons/hi'

// Mapeo con íconos oficiales y colores de marca 2024
const sourceConfig: Record<string, { icon: any; brandColor: string }> = {
  'Facebook Ads': { icon: FaFacebook, brandColor: '#1877f2' },
  'Instagram Ads': { icon: FaInstagram, brandColor: '#c32aa3' },
  'Google Ads': { icon: FaGoogle, brandColor: '#4285f4' },
  'TikTok Ads': { icon: FaTiktok, brandColor: '#ee1d52' },
  'LinkedIn Ads': { icon: FaLinkedin, brandColor: '#0a66c2' },
  'Twitter/X Ads': { icon: FaXTwitter, brandColor: '#000000' },
  'Pinterest Ads': { icon: FaPinterest, brandColor: '#bd081c' },
  'Snapchat Ads': { icon: FaSnapchat, brandColor: '#fffc00' },
  'Reddit Ads': { icon: FaReddit, brandColor: '#ff4301' },
  'WhatsApp': { icon: FaWhatsapp, brandColor: '#25d366' },
  'Email': { icon: HiMail, brandColor: '#ea4335' },
  'Orgánico': { icon: HiSearch, brandColor: '#34a853' },
  'Directo': { icon: HiLink, brandColor: '#5865f2' },
  'Referidos': { icon: HiExternalLink, brandColor: '#fbbc05' },
  'Otros': { icon: HiQuestionMarkCircle, brandColor: '#6b7280' },
  'Other': { icon: HiQuestionMarkCircle, brandColor: '#6b7280' }
}

export function TrafficChart() {
  const { dateRange } = useDateRange()
  const { theme } = useTheme()
  const { data: trafficData, loading } = useTrafficData({
    start: dateRange.start,
    end: dateRange.end
  })
  
  // Enriquecer datos con iconos y colores de marca
  const data = trafficData.length > 0 ? trafficData.map((item) => {
    const config = sourceConfig[item.name] || sourceConfig.Other
    return {
      ...item,
      ...config,
      // Usar colores de marca con opacidad para el gráfico de dona
      color: theme === 'dark'
        ? `${config.brandColor}99` // 60% opacidad en dark mode
        : config.brandColor // Color completo en light mode
    }
  }) : []

  const totalVisits = data.reduce((sum, item) => sum + item.value, 0)
  const maxValue = Math.max(...data.map(d => d.value), 1) // Evitar división por 0
  
  return (
    <Card variant="glass" className="p-6 overflow-hidden relative">
      {/* Fondo degradado ultra sutil - solo en dark mode */}
      <div className="absolute inset-0 opacity-[0.03] only-dark">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-accent-purple rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-accent-blue rounded-full blur-3xl" />
      </div>
      
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-primary">Fuentes de Tráfico</h3>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-bold text-primary">
                {totalVisits.toLocaleString()}
              </span>
              <span className="text-sm text-tertiary">visitantes totales</span>
            </div>
          </div>
          <button className="p-2 glass-hover rounded-xl transition-colors">
            <Icons.more className="w-4 h-4 text-tertiary" />
          </button>
        </div>

        {/* Gráfico de dona con colores neutros */}
        <div className="h-56 relative mb-6">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-pulse text-tertiary">Cargando datos...</div>
            </div>
          ) : data.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  startAngle={90}
                  endAngle={450}
                  stroke="none"
                >
                  {data.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color}
                      className="transition-opacity hover:opacity-80"
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>

            {/* Centro del donut con estadística principal */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{data.length}</p>
                <p className="text-xs text-tertiary">fuentes</p>
              </div>
            </div>
          </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Icons.globe className="w-12 h-12 text-tertiary mb-2 mx-auto" />
                <p className="text-sm text-tertiary">Sin datos de tráfico</p>
                <p className="text-xs text-tertiary mt-1">Los datos aparecerán cuando haya visitas</p>
              </div>
            </div>
          )}
        </div>

        {/* Lista de fuentes rediseñada - sin líneas conectoras */}
        <div className="grid gap-3">
          {loading ? (
            <div className="grid gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-4 animate-pulse">
                  <div className="w-12 h-12 rounded-xl bg-[var(--color-background-glass)] flex-shrink-0" />
                  <div className="flex-1">
                    <div className="h-4 bg-[var(--color-background-glass)] rounded w-24 mb-2" />
                    <div className="h-3 bg-[var(--color-background-glass)] rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
          data.map((item) => {
            const Icon = item.icon
            const percentage = (item.value / totalVisits) * 100

            return (
              <div key={item.name} className="group transition-all hover:scale-[1.02]">
                <div className="flex items-center gap-4">
                  {/* Icono con color de marca */}
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all group-hover:shadow-lg"
                    style={{
                      backgroundColor: theme === 'dark'
                        ? `${item.brandColor}20` // 12% opacidad del color de marca en dark
                        : `${item.brandColor}15`  // 9% opacidad en light
                    }}
                  >
                    <Icon
                      className="w-5 h-5 transition-transform group-hover:scale-110"
                      style={{ color: item.brandColor }}
                    />
                  </div>

                  {/* Contenido principal */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-primary">{item.name}</span>
                        <span
                          className="px-2 py-0.5 text-xs font-medium rounded-full"
                          style={{
                            backgroundColor: theme === 'dark'
                              ? `${item.brandColor}20`
                              : `${item.brandColor}10`,
                            color: theme === 'dark'
                              ? '#ffffff'
                              : item.brandColor
                          }}
                        >
                          {item.percentage}%
                        </span>
                      </div>
                      <span className="text-lg font-bold text-primary">
                        {item.value.toLocaleString()}
                      </span>
                    </div>

                    {/* Barra de progreso más delgada y elegante */}
                    <div className="relative">
                      <div className="h-2 bg-gray-100 dark:bg-gray-800/30 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-1000 ease-out group-hover:shadow-sm"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: item.brandColor,
                            opacity: theme === 'dark' ? 0.7 : 0.8
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })
          )}
        </div>

        {/* Insights destacados */}
        {!loading && data.length > 0 && (
        <div className="mt-8 p-4 rounded-xl bg-glass-subtle border border-primary">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-tertiary mb-1">Mayor fuente</p>
              <p className="text-sm font-semibold text-primary">
                <span className="block sm:inline">{data[0].name}</span>
                <span className="text-success sm:ml-2">
                  {data[0].percentage}%
                </span>
              </p>
            </div>
            <div>
              <p className="text-xs text-tertiary mb-1">Diversificación</p>
              <p className="text-sm font-semibold text-primary truncate">
                {data.length} fuentes activas
              </p>
            </div>
          </div>
        </div>
        )}
      </div>
    </Card>
  )
}