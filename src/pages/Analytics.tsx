import React, { useState, useEffect, useMemo } from 'react'
import { PageContainer, Card } from '../ui'
import { KPICard } from '../ui/KPICard'
import { DateRangePicker } from '../ui/DateRangePicker'
import { ChartContainer } from '../ui/ChartContainer'
import { Select } from '../ui/Select'
import { TreeFilter } from '../ui/TreeFilter'
import { Icons } from '../icons'
import { useDateRange } from '../contexts/DateContext'
import { formatNumber, formatCurrency, formatDate } from '../lib/utils'
import { iconTheme } from '../theme/iconTheme'
import { SmartRechartsTooltip } from '../components/SmartRechartsTooltip'
import { useTheme } from '../contexts/ThemeContext'
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts'
import { getApiUrl, fetchWithAuth } from '../config/api'
import { TrafficChart } from '../modules/dashboard/TrafficChart'
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps'
import { SocialIcon } from '../components/SocialIcons'

interface Session {
  session_id: string
  visitor_id: string
  contact_id?: string // Agregado para tracking de contactos identificados
  event_name?: string // NUEVO: Para detectar conversiones marcadas como 'lead'
  created_at: string
  landing_url?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string // Agregado para anuncios
  referrer_domain?: string
  browser?: string
  device_type?: string
  os?: string
  placement?: string
  source_platform?: string
  pageviews_count: number
  events_count: number
  is_bounce: boolean
  properties?: any
}

type ContactLike = { [key: string]: any }

// Funciones simplificadas eliminadas - ya no necesitamos metadata compleja

export function Analytics() {
  const { dateRange } = useDateRange()
  const { theme, themeData } = useTheme()
  const isDarkMode = theme === 'dark'
  const [loading, setLoading] = useState(false)
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>({}) // Filtros multi-categor\u00eda
  const [availablePages, setAvailablePages] = useState<{page: string, count: number}[]>([])
  const [allSessions, setAllSessions] = useState<Session[]>([]) // Todas las sesiones sin filtrar
  const [sessions, setSessions] = useState<Session[]>([]) // Sesiones filtradas
  const [previousSessions, setPreviousSessions] = useState<Session[]>([]) // Sesiones del período anterior
  const [contactsData, setContactsData] = useState<any[]>([]) // Contactos creados en el período

  // Métricas principales con trends
  const [metrics, setMetrics] = useState({
    pageViews: 0,
    uniqueVisitors: 0,
    registros: 0,
    conversionRate: 0,
    avgSessionDuration: 0,
    bounceRate: 0,
    returningUsers: 0,
    avgPagePerSession: 0,
    trends: {
      pageViews: 0,
      uniqueVisitors: 0,
      registros: 0,
      conversionRate: 0,
      avgSessionDuration: 0,
      bounceRate: 0,
      returningUsers: 0,
      avgPagePerSession: 0
    }
  })

  // Datos para gráficas
  const [dailyTraffic, setDailyTraffic] = useState<any[]>([])
  const [dailyConversions, setDailyConversions] = useState<any[]>([]) // Nuevo: gráfico de conversiones
  const [trafficSources, setTrafficSources] = useState<any[]>([])
  const [platformsData, setPlatformsData] = useState<any[]>([])
  const [placementsData, setPlacementsData] = useState<any[]>([])
  const [devicesData, setDevicesData] = useState<any[]>([])
  const [osData, setOsData] = useState<any[]>([])
  const [browserData, setBrowserData] = useState<any[]>([])
  const [topVisitors, setTopVisitors] = useState<any[]>([]) // Estado faltante para top visitors
  const [locationData, setLocationData] = useState<any>(null) // Datos de ubicaciones geográficas
  const [availableFilterData, setAvailableFilterData] = useState<any>({}) // Datos disponibles para filtros
  const [mapView, setMapView] = useState<'world' | 'country'>('country') // Vista del mapa - México por defecto
  const [selectedCountry, setSelectedCountry] = useState<string>('México') // País seleccionado
  const [mapZoom, setMapZoom] = useState(2.5) // Nivel de zoom del mapa - inicia con zoom más alto
  const [isDragging, setIsDragging] = useState(false) // Estado de arrastre del mapa

// Funciones de atribución compleja eliminadas - ya no las necesitamos

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true)
      try {
        // Ajustar las fechas para incluir el día completo actual
        const adjustedEndDate = new Date(dateRange.end)
        adjustedEndDate.setDate(adjustedEndDate.getDate() + 1) // Incluir hasta el final del día

        const startDate = dateRange.start.toISOString().split('T')[0]
        const endDate = adjustedEndDate.toISOString().split('T')[0]

        // Calcular período anterior para comparación
        const msPerDay = 24 * 60 * 60 * 1000
        const periodLength = Math.round((dateRange.end.getTime() - dateRange.start.getTime()) / msPerDay)
        const previousEnd = new Date(dateRange.start)
        previousEnd.setDate(previousEnd.getDate() - 1)
        const previousStart = new Date(previousEnd)
        previousStart.setDate(previousStart.getDate() - periodLength)

        const prevStartDate = previousStart.toISOString().split('T')[0]
        const prevEndDate = previousEnd.toISOString().split('T')[0]

        // URLs para fetch
        const url = getApiUrl(`/tracking/sessions?start=${startDate}&end=${endDate}`)
        const prevUrl = getApiUrl(`/tracking/sessions?start=${prevStartDate}&end=${prevEndDate}`)
        const contactsUrl = getApiUrl(`/contacts?start=${startDate}&end=${endDate}`)
        const prevContactsUrl = getApiUrl(`/contacts?start=${prevStartDate}&end=${prevEndDate}`) // Contactos del período anterior

        // Fetching analytics...

        // Fetch en paralelo: sesiones actuales, anteriores y contactos (actuales y anteriores)
        const [fetchResponse, prevFetchResponse, contactsFetchResponse, prevContactsFetchResponse] = await Promise.all([
          fetchWithAuth(url),
          fetchWithAuth(prevUrl),
          fetchWithAuth(contactsUrl),
          fetchWithAuth(prevContactsUrl)
        ])

        const [sessionsApiResponse, prevSessionsApiResponse, contactsApiResponse, prevContactsApiResponse] = await Promise.all([
          fetchResponse.json(),
          prevFetchResponse.json(),
          contactsFetchResponse.json(),
          prevContactsFetchResponse.json()
        ])

        // El endpoint de contacts devuelve {success: true, data: [...]} no array directo
        // El endpoint de tracking/sessions devuelve array directo
        const response = Array.isArray(sessionsApiResponse) ? sessionsApiResponse : (sessionsApiResponse?.data || [])
        const prevResponse = Array.isArray(prevSessionsApiResponse) ? prevSessionsApiResponse : (prevSessionsApiResponse?.data || [])
        const contactsResponse = contactsApiResponse?.data || contactsApiResponse || []
        const prevContactsResponse = prevContactsApiResponse?.data || prevContactsApiResponse || []

        // Response received

        if (response && response.length > 0) {
          setAllSessions(response) // Guardar todas las sesiones
          setSessions(response) // Inicialmente mostrar todas
          setPreviousSessions(prevResponse || []) // Guardar sesiones anteriores
          setContactsData(contactsResponse || []) // Guardar contactos

          // Calcular KPIs principales del período actual
          const uniqueVids = new Set(response.map((s: Session) => s.visitor_id)).size
          const totalPageViews = response.reduce((acc: number, s: Session) =>
            acc + (s.pageviews_count || 1), 0
          )

          // REGISTROS REALES: Usando método de proximidad temporal
          const mainContactIds = new Set<string>()
          const mainSessionContactIds = new Set<string>()

          // Contar contactos que aparecen en sessions
          contactsResponse?.forEach((contact: any) => {
            const contactId = contact.contact_id || contact.contactId || contact.id || contact.ID
            if (contactId) {
              mainContactIds.add(contactId.toString())
            }
          })

          response.forEach((session: Session) => {
            if (session.contact_id) {
              mainSessionContactIds.add(session.contact_id.toString())
            }
          })

          // Usar método de proximidad temporal
          const optIns = new Set([...mainContactIds].filter(id => mainSessionContactIds.has(id)))
          const registros = optIns.size
          const conversionPages = new Map<string, string>()

          // Para el fallback, intentar encontrar la página más cercana temporalmente
          optIns.forEach(contactId => {
              const contact = contactsResponse?.find((c: any) =>
                (c.contact_id || c.contactId || c.id || c.ID)?.toString() === contactId
              )
              if (contact && contact.createdAt) {
                // Buscar sesión más cercana en tiempo
                const contactCreatedTime = new Date(contact.createdAt).getTime()
                let closestSession: Session | null = null
                let minTimeDiff = Infinity

                response.forEach((session: Session) => {
                  if (session.contact_id?.toString() === contactId && session.landing_url) {
                    const sessionTime = new Date(session.created_at).getTime()
                    const timeDiff = Math.abs(sessionTime - contactCreatedTime)
                    if (timeDiff < minTimeDiff) {
                      minTimeDiff = timeDiff
                      closestSession = session
                    }
                  }
                })

                if (closestSession) {
                  conversionPages.set(contactId, closestSession.landing_url || 'unknown')
                }
              }
            })

          console.log('📊 Usando método de proximidad temporal para opt-ins:', registros)

          // DEBUG: Ver opt-ins del período y páginas de conversión
          console.log('📊 Opt-ins del período:', {
            totalContactos: contactsResponse?.length || 0,
            optInsReales: registros,
            páginasDeConversión: Array.from(conversionPages.entries()).map(([contactId, url]) => ({
              contactId: contactId.substring(0, 15) + '...',
              página: url
            }))
          })

          // Nota: Opt-ins reales - contactos que aparecen en AMBOS (creados Y en tracking)

          // Tasa de conversión: Registros / Visitantes únicos
          const conversionRate = uniqueVids > 0 && !isNaN(registros) ? ((registros / uniqueVids) * 100) : 0

          // Bounce rate
          const bounceRate = response.length > 0 ?
            ((response.filter((s: Session) => s.is_bounce).length / response.length) * 100) : 0

          // Usuarios recurrentes (aparecen más de una vez)
          const visitorCounts: { [key: string]: number } = {}
          response.forEach((s: Session) => {
            visitorCounts[s.visitor_id] = (visitorCounts[s.visitor_id] || 0) + 1
          })
          const returningUsers = Object.values(visitorCounts).filter(count => count > 1).length

          // Promedio páginas por sesión
          const avgPagePerSession = response.length > 0 ?
            (totalPageViews / response.length) : 0

          // Duración promedio (estimada)
          const avgDuration = response.length > 0 ?
            Math.round(response.reduce((acc: number, s: Session) =>
              acc + (s.events_count || 1) * 45, 0) / response.length) : 0

          // Calcular métricas del período anterior para trends
          const prevUniqueVids = prevResponse && prevResponse.length > 0 ?
            new Set(prevResponse.map((s: Session) => s.visitor_id)).size : 0
          const prevTotalPageViews = prevResponse && prevResponse.length > 0 ?
            prevResponse.reduce((acc: number, s: Session) => acc + (s.pageviews_count || 1), 0) : 0

          // Opt-ins reales del período anterior con método de proximidad temporal
          const prevContactIds = new Set<string>()
          const prevSessionContactIds = new Set<string>()

          prevContactsResponse?.forEach((contact: any) => {
            const contactId = contact.contact_id || contact.contactId || contact.id || contact.ID
            if (contactId) {
              prevContactIds.add(contactId.toString())
            }
          })

          prevResponse?.forEach((session: Session) => {
            if (session.contact_id) {
              prevSessionContactIds.add(session.contact_id.toString())
            }
          })

          // Usar método de proximidad temporal
          const prevOptIns = new Set([...prevContactIds].filter(id => prevSessionContactIds.has(id)))
          const prevRegistros = prevOptIns.size

          const prevConversionRate = prevUniqueVids > 0 ? ((prevRegistros / prevUniqueVids) * 100) : 0
          const prevBounceRate = prevResponse && prevResponse.length > 0 ?
            ((prevResponse.filter((s: Session) => s.is_bounce).length / prevResponse.length) * 100) : 0

          const prevVisitorCounts: { [key: string]: number } = {}
          if (prevResponse && prevResponse.length > 0) {
            prevResponse.forEach((s: Session) => {
              prevVisitorCounts[s.visitor_id] = (prevVisitorCounts[s.visitor_id] || 0) + 1
            })
          }
          const prevReturningUsers = Object.values(prevVisitorCounts).filter(count => count > 1).length
          const prevAvgPagePerSession = prevResponse && prevResponse.length > 0 ?
            (prevTotalPageViews / prevResponse.length) : 0
          const prevAvgDuration = prevResponse && prevResponse.length > 0 ?
            Math.round(prevResponse.reduce((acc: number, s: Session) =>
              acc + (s.events_count || 1) * 45, 0) / prevResponse.length) : 0

          // Función para calcular trends
          const calculateTrend = (current: number, previous: number) => {
            if (previous === 0) return current > 0 ? 100 : 0
            return ((current - previous) / Math.abs(previous)) * 100
          }

          setMetrics({
            pageViews: totalPageViews,
            uniqueVisitors: uniqueVids,
            registros,
            conversionRate,
            avgSessionDuration: avgDuration,
            bounceRate,
            returningUsers,
            avgPagePerSession,
            trends: {
              pageViews: calculateTrend(totalPageViews, prevTotalPageViews),
              uniqueVisitors: calculateTrend(uniqueVids, prevUniqueVids),
              registros: calculateTrend(registros, prevRegistros),
              conversionRate: calculateTrend(conversionRate, prevConversionRate),
              avgSessionDuration: calculateTrend(avgDuration, prevAvgDuration),
              bounceRate: calculateTrend(bounceRate, prevBounceRate),
              returningUsers: calculateTrend(returningUsers, prevReturningUsers),
              avgPagePerSession: calculateTrend(avgPagePerSession, prevAvgPagePerSession)
            }
          })

          // Métricas calculadas

          // GRÁFICO LINEAL INTELIGENTE - Agregación según el rango
          // Calcular diferencia de días entre las fechas
          const msPerDay = 24 * 60 * 60 * 1000
          const daysDiff = Math.round((dateRange.end.getTime() - dateRange.start.getTime()) / msPerDay)

          // Determinar el nivel de agregación basado en el rango
          let aggregationLevel: 'day' | 'week' | 'month' | 'quarter' | 'year'
          let dateFormat: Intl.DateTimeFormatOptions

          if (daysDiff <= 31) {
            // Menos de un mes: mostrar por día
            aggregationLevel = 'day'
            dateFormat = { day: 'numeric', month: 'short' }
          } else if (daysDiff <= 90) {
            // 1-3 meses: mostrar por semana
            aggregationLevel = 'week'
            dateFormat = { day: 'numeric', month: 'short' }
          } else if (daysDiff <= 365) {
            // 3-12 meses: mostrar por mes
            aggregationLevel = 'month'
            dateFormat = { month: 'short', year: 'numeric' }
          } else if (daysDiff <= 730) {
            // 1-2 años: mostrar por trimestre
            aggregationLevel = 'quarter'
            dateFormat = { month: 'short', year: 'numeric' }
          } else {
            // Más de 2 años: mostrar por año
            aggregationLevel = 'year'
            dateFormat = { year: 'numeric' }
          }

          // Función para obtener la clave de agregación
          const getAggregationKey = (dateStr: string): string => {
            const date = new Date(dateStr)

            switch (aggregationLevel) {
              case 'day':
                return dateStr.split('T')[0]
              case 'week':
                // Obtener el lunes de esa semana
                const weekDate = new Date(date)
                const day = weekDate.getDay()
                const diff = weekDate.getDate() - day + (day === 0 ? -6 : 1)
                weekDate.setDate(diff)
                return weekDate.toISOString().split('T')[0]
              case 'month':
                return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
              case 'quarter':
                const quarter = Math.floor(date.getMonth() / 3) + 1
                return `${date.getFullYear()}-Q${quarter}`
              case 'year':
                return String(date.getFullYear())
              default:
                return dateStr.split('T')[0]
            }
          }

          // Agregar datos según el nivel de agregación
          const aggregatedStats: { [key: string]: { totalVisits: number, uniqueVisitors: Set<string> } } = {}

          response.forEach((session: Session) => {
            const key = getAggregationKey(session.created_at)

            if (!aggregatedStats[key]) {
              aggregatedStats[key] = {
                totalVisits: 0,
                uniqueVisitors: new Set()
              }
            }

            aggregatedStats[key].totalVisits++
            aggregatedStats[key].uniqueVisitors.add(session.visitor_id)
          })

          // Generar todas las fechas/períodos en el rango (para mostrar días sin datos)
          const allPeriods: string[] = []
          const currentDate = new Date(dateRange.start)
          const endDate = new Date(dateRange.end)

          while (currentDate <= endDate) {
            const key = getAggregationKey(currentDate.toISOString())

            if (!allPeriods.includes(key)) {
              allPeriods.push(key)
            }

            // Avanzar según el nivel de agregación
            switch (aggregationLevel) {
              case 'day':
                currentDate.setDate(currentDate.getDate() + 1)
                break
              case 'week':
                currentDate.setDate(currentDate.getDate() + 7)
                break
              case 'month':
                currentDate.setMonth(currentDate.getMonth() + 1)
                break
              case 'quarter':
                currentDate.setMonth(currentDate.getMonth() + 3)
                break
              case 'year':
                currentDate.setFullYear(currentDate.getFullYear() + 1)
                break
            }
          }

          // Formatear datos para el gráfico
          const chartData = allPeriods
            .sort()
            .map(period => {
              const stats = aggregatedStats[period] || { totalVisits: 0, uniqueVisitors: new Set() }

              // Formatear la etiqueta según el período
              let label: string
              if (aggregationLevel === 'quarter') {
                const [year, quarter] = period.split('-Q')
                label = `Q${quarter} ${year}`
              } else if (aggregationLevel === 'week') {
                const date = new Date(period)
                const endOfWeek = new Date(date)
                endOfWeek.setDate(date.getDate() + 6)
                label = `${date.getDate()} - ${endOfWeek.getDate()} ${formatDate(date, { month: 'short' })}`
              } else {
                const date = aggregationLevel === 'month'
                  ? new Date(period + '-01')
                  : new Date(period)
                label = formatDate(date, dateFormat)
              }

              return {
                date: label,
                visitas: stats.totalVisits,
                visitantesUnicos: stats.uniqueVisitors.size
              }
            })

          // Datos del gráfico preparados
          setDailyTraffic(chartData)

          // Opt-ins reales por período: Usando método de proximidad temporal
          const conversionsPerPeriod: Record<string, Set<string>> = {}

          // Método de proximidad temporal basado en contactos creados
          const chartContactIds = new Set<string>()
          const chartSessionContactIds = new Set<string>()

          contactsResponse.forEach((contact: any) => {
            const contactId = contact.contact_id || contact.contactId || contact.id || contact.ID
            if (contactId) {
              chartContactIds.add(contactId.toString())
            }
          })

          response.forEach((session: Session) => {
            if (session.contact_id) {
              chartSessionContactIds.add(session.contact_id.toString())
            }
          })

          // Solo contar registros reales por período usando contact.createdAt

          contactsResponse.forEach((contact: any) => {
            const contactId = contact.contact_id || contact.contactId || contact.id || contact.ID
            if (contactId && contact.createdAt && chartContactIds.has(contactId.toString()) && chartSessionContactIds.has(contactId.toString())) {
              const createdDate = new Date(contact.createdAt)
              const periodKey = getAggregationKey(createdDate.toISOString())


              if (!conversionsPerPeriod[periodKey]) {
                conversionsPerPeriod[periodKey] = new Set()
              }

              conversionsPerPeriod[periodKey].add(contactId.toString())
            }
          })

          const totalConversiones = Object.values(conversionsPerPeriod).reduce((sum, set) => sum + set.size, 0)

          // conversionsPerPeriod ya está definido arriba

          const conversionChartData = allPeriods
            .sort()
            .map(period => {
              const contactsInPeriod = conversionsPerPeriod[period] || new Set()
              const conversions = contactsInPeriod.size

              // Formatear la etiqueta según el período
              let label: string
              if (aggregationLevel === 'quarter') {
                const [year, quarter] = period.split('-Q')
                label = `Q${quarter} ${year}`
              } else if (aggregationLevel === 'week') {
                const date = new Date(period)
                const endOfWeek = new Date(date)
                endOfWeek.setDate(date.getDate() + 6)
                label = `${date.getDate()} - ${endOfWeek.getDate()} ${formatDate(date, { month: 'short' })}`
              } else {
                // Para evitar problemas de timezone, creamos la fecha directamente en el timezone local
                // en lugar de permitir que JS la interprete como UTC y luego la convierta
                if (aggregationLevel === 'month') {
                  const [year, month] = period.split('-')
                  const date = new Date(parseInt(year), parseInt(month) - 1, 1)
                  label = formatDate(date, dateFormat)
                } else {
                  // Para días (period = "2025-09-19"), crear fecha local sin timezone conversion
                  const [year, month, day] = period.split('-')
                  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
                  label = formatDate(date, dateFormat)
                }
              }

              return {
                date: label,
                conversiones: conversions,
                contactosIdentificados: contactsInPeriod.size
              }
            })

          // Datos de conversiones preparados

          setDailyConversions(conversionChartData)

          // Obtener páginas únicas de las URLs reales de la DB
          const pageMap: { [key: string]: number } = {}
          response.forEach((session: Session) => {
            if (session.landing_url) {
              const urlPath = session.landing_url.split('?')[0]
              const pageName = urlPath.split('/').pop() || 'home'
              pageMap[pageName] = (pageMap[pageName] || 0) + 1
            }
          })

          const pageList = Object.entries(pageMap)
            .map(([page, count]) => ({ page, count }))
            .sort((a, b) => b.count - a.count)

          setAvailablePages(pageList)
          // Páginas disponibles

          // Agn\u00f3stico: Recopilar TODOS los datos disponibles para el TreeFilter
          const filterData: any = {
            pages: pageList,
            campaigns: [],
            adsets: [],
            ads: [],
            sources: [],
            devices: [],
            browsers: [],
            os: [],
            placements: []
          }

          // Recolectar campañas únicas
          const campaignsMap: { [key: string]: number } = {}
          const adsMap: { [key: string]: number } = {}
          const sourcesMap: { [key: string]: number } = {}
          const devicesMap: { [key: string]: number } = {}
          const browsersMap: { [key: string]: number } = {}
          const osMap: { [key: string]: number } = {}
          const placementsMap: { [key: string]: number } = {}

          response.forEach((session: Session) => {
            // Campañas
            if (session.utm_campaign) {
              campaignsMap[session.utm_campaign] = (campaignsMap[session.utm_campaign] || 0) + 1
            }
            // Anuncios (utm_content)
            if (session.utm_content) {
              adsMap[session.utm_content] = (adsMap[session.utm_content] || 0) + 1
            }
            // Fuentes
            if (session.utm_source) {
              sourcesMap[session.utm_source] = (sourcesMap[session.utm_source] || 0) + 1
            }
            // Dispositivos
            if (session.device_type) {
              devicesMap[session.device_type] = (devicesMap[session.device_type] || 0) + 1
            }
            // Navegadores
            if (session.browser) {
              browsersMap[session.browser] = (browsersMap[session.browser] || 0) + 1
            }
            // Sistemas Operativos
            if (session.os) {
              osMap[session.os] = (osMap[session.os] || 0) + 1
            }
            // Placements
            if (session.placement) {
              placementsMap[session.placement] = (placementsMap[session.placement] || 0) + 1
            }
          })

          // Convertir mapas a arrays para el TreeFilter
          filterData.campaigns = Object.entries(campaignsMap)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)

          filterData.ads = Object.entries(adsMap)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)

          filterData.sources = Object.entries(sourcesMap)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)

          filterData.devices = Object.entries(devicesMap)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)

          filterData.browsers = Object.entries(browsersMap)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)

          filterData.os = Object.entries(osMap)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)

          filterData.placements = Object.entries(placementsMap)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)

          setAvailableFilterData(filterData)

          // Analizar fuentes de tráfico - SEPARAR ORGÁNICO VS PAGO
          // Este mapeo determina cómo categorizamos cada fuente
          const organicSources: { [key: string]: number } = {
            'Facebook Orgánico': 0,
            'Instagram Orgánico': 0,
            'Google Orgánico': 0,
            'Twitter Orgánico': 0,
            'LinkedIn Orgánico': 0,
            'YouTube Orgánico': 0,
            'Pinterest Orgánico': 0,
            'Reddit Orgánico': 0,
            'Snapchat Orgánico': 0,
            'Directo': 0
          }

          const paidSources: { [key: string]: number } = {
            'Facebook Ads': 0,
            'Instagram Ads': 0,
            'Google Ads': 0,
            'TikTok Ads': 0,
            'Twitter Ads': 0,
            'LinkedIn Ads': 0,
            'YouTube Ads': 0,
            'Pinterest Ads': 0,
            'Snapchat Ads': 0,
            'Reddit Ads': 0
          }

          response.forEach((session: Session) => {
            const utm = session.utm_source?.toLowerCase() || ''
            const medium = session.utm_medium?.toLowerCase() || ''
            const referrer = session.referrer_domain?.toLowerCase() || ''

            // Detectar si es tráfico pagado basado en parámetros UTM estándar
            const hasPaidParams = medium.includes('cpc') ||
                                 medium.includes('ppc') ||
                                 medium.includes('paid') ||
                                 utm.includes('fb_ad') ||
                                 utm.includes('paid')

            // Clasificar fuente con lógica mejorada
            if (utm.includes('fb') || utm.includes('facebook') || referrer.includes('facebook')) {
              if (hasPaidParams) {
                paidSources['Facebook Ads']++
              } else {
                organicSources['Facebook Orgánico']++
              }
            } else if (utm.includes('ig') || utm.includes('instagram') || referrer.includes('instagram')) {
              if (hasPaidParams) {
                paidSources['Instagram Ads']++
              } else {
                organicSources['Instagram Orgánico']++
              }
            } else if (utm.includes('google') || referrer.includes('google')) {
              if (hasPaidParams || medium === 'cpc') {
                paidSources['Google Ads']++
              } else {
                organicSources['Google Orgánico']++
              }
            } else if (utm.includes('tiktok') || referrer.includes('tiktok')) {
              paidSources['TikTok Ads']++
            } else if (utm.includes('twitter') || referrer.includes('twitter')) {
              if (hasPaidParams) {
                paidSources['Twitter Ads']++
              } else {
                organicSources['Twitter Orgánico']++
              }
            } else if (utm.includes('linkedin') || referrer.includes('linkedin')) {
              if (hasPaidParams) {
                paidSources['LinkedIn Ads']++
              } else {
                organicSources['LinkedIn Orgánico']++
              }
            } else if (utm.includes('youtube') || referrer.includes('youtube')) {
              if (hasPaidParams) {
                paidSources['YouTube Ads']++
              } else {
                organicSources['YouTube Orgánico']++
              }
            } else if (utm.includes('pinterest') || referrer.includes('pinterest')) {
              if (hasPaidParams) {
                paidSources['Pinterest Ads']++
              } else {
                organicSources['Pinterest Orgánico']++
              }
            } else if (utm.includes('snapchat') || referrer.includes('snapchat')) {
              if (hasPaidParams) {
                paidSources['Snapchat Ads']++
              } else {
                organicSources['Snapchat Orgánico']++
              }
            } else if (utm.includes('reddit') || referrer.includes('reddit')) {
              if (hasPaidParams) {
                paidSources['Reddit Ads']++
              } else {
                organicSources['Reddit Orgánico']++
              }
            } else {
              organicSources['Directo']++
            }
          })

          // Combinar y filtrar fuentes con tráfico
          const allSources = { ...organicSources, ...paidSources }
          const sourceData = Object.entries(allSources)
            .filter(([_, count]) => count > 0)
            .map(([name, count]) => ({
              name,
              value: count,
              percentage: ((count / response.length) * 100).toFixed(1),
              isPaid: name.includes('Ads')
            }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5)

          setTrafficSources(sourceData)

          // Navegadores
          const browsers: { [key: string]: number } = {}
          response.forEach((session: Session) => {
            const browser = session.browser || 'Desconocido'
            browsers[browser] = (browsers[browser] || 0) + 1
          })

          const browserStats = Object.entries(browsers)
            .map(([browser, count]) => ({
              name: browser,
              icon: browser, // Guardar el nombre, lo renderizaremos con SocialIcon
              users: count,
              percentage: ((count / response.length) * 100).toFixed(1)
            }))
            .sort((a, b) => b.users - a.users)
            .slice(0, 5)

          setBrowserData(browserStats)

          // Plataformas (source_platform)
          const platforms: { [key: string]: number } = {}
          response.forEach((session: Session) => {
            const platform = session.source_platform || session.utm_source || 'Directo'
            platforms[platform] = (platforms[platform] || 0) + 1
          })

          const platformStats = Object.entries(platforms)
            .map(([platform, count]) => ({
              name: platform,
              icon: platform, // Guardar el nombre, lo renderizaremos con SocialIcon
              users: count,
              percentage: ((count / response.length) * 100).toFixed(1)
            }))
            .sort((a, b) => b.users - a.users)
            .slice(0, 5)

          setPlatformsData(platformStats)

          // Ubicaciones (placement)
          const placements: { [key: string]: number } = {}
          response.forEach((session: Session) => {
            const placement = session.placement || 'Sin ubicación'
            placements[placement] = (placements[placement] || 0) + 1
          })

          const placementStats = Object.entries(placements)
            .map(([placement, count]) => ({
              name: placement.replace(/_/g, ' '),
              icon: placement, // Guardar el nombre, lo renderizaremos con SocialIcon
              users: count,
              percentage: ((count / response.length) * 100).toFixed(1)
            }))
            .sort((a, b) => b.users - a.users)
            .slice(0, 5)

          setPlacementsData(placementStats)

          // Dispositivos (device_type)
          const devices: { [key: string]: number } = {}
          response.forEach((session: Session) => {
            const device = session.device_type || 'Desconocido'
            devices[device] = (devices[device] || 0) + 1
          })

          const deviceStats = Object.entries(devices)
            .map(([device, count]) => ({
              name: device,
              icon: device, // Guardar el nombre, lo renderizaremos con SocialIcon
              users: count,
              percentage: ((count / response.length) * 100).toFixed(1)
            }))
            .sort((a, b) => b.users - a.users)
            .slice(0, 5)

          setDevicesData(deviceStats)

          // Sistema Operativo (os)
          const operatingSystems: { [key: string]: number } = {}
          response.forEach((session: Session) => {
            const os = session.os || 'Desconocido'
            operatingSystems[os] = (operatingSystems[os] || 0) + 1
          })

          const osStats = Object.entries(operatingSystems)
            .map(([os, count]) => ({
              name: os,
              icon: os, // Guardar el nombre, lo renderizaremos con SocialIcon
              users: count,
              percentage: ((count / response.length) * 100).toFixed(1)
            }))
            .sort((a, b) => b.users - a.users)
            .slice(0, 5)

          setOsData(osStats)


        } else {
          // Reset si no hay datos
          setMetrics({
            pageViews: 0,
            uniqueVisitors: 0,
            registros: 0,
            conversionRate: 0,
            avgSessionDuration: 0,
            bounceRate: 0,
            returningUsers: 0,
            avgPagePerSession: 0,
            trends: {
              pageViews: 0,
              uniqueVisitors: 0,
              registros: 0,
              conversionRate: 0,
              avgSessionDuration: 0,
              bounceRate: 0,
              returningUsers: 0,
              avgPagePerSession: 0
            }
          })
          setDailyTraffic([])
          setTrafficSources([])
          setPlatformsData([])
          setPlacementsData([])
          setDevicesData([])
          setOsData([])
          setBrowserData([])
          setAllSessions([])
          setSessions([])
          setAvailablePages([])
        }
      } catch (error) {
        console.error('Error cargando analytics:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
  }, [dateRange]) // Se vuelve a ejecutar cuando cambian las fechas

  // Efecto para cargar datos de ubicaciones
  useEffect(() => {
    const fetchLocationData = async () => {
      try {
        const startDate = dateRange.start.toISOString().split('T')[0]
        const endDate = dateRange.end.toISOString().split('T')[0]

        // Si la vista es por país, enviar el país para obtener datos por estados
        const countryParam = mapView === 'country' ? '&country=México' : ''

        const response = await fetchWithAuth(
          getApiUrl(`/dashboard/visitor-locations?start=${startDate}&end=${endDate}${countryParam}`)
        )

        if (response.ok) {
          const data = await response.json()
          setLocationData(data)
        }
      } catch (error) {
        console.error('Error cargando ubicaciones:', error)
      }
    }

    fetchLocationData()
  }, [dateRange, mapView])

  // Efecto para filtrar sesiones cuando cambian los filtros seleccionados
  useEffect(() => {
    // Agn\u00f3stico: Si no hay filtros, mostrar todas las sesiones
    if (Object.keys(selectedFilters).length === 0) {
      setSessions(allSessions)
    } else {
      // Filtrar sesiones basándose en TODOS los filtros activos
      const filtered = allSessions.filter((session: Session) => {
        // Cada categoría de filtro debe cumplirse (AND entre categorías, OR dentro de categorías)
        for (const [field, values] of Object.entries(selectedFilters)) {
          if (values.length === 0) continue

          let fieldMatch = false

          // Verificar si la sesión cumple con al menos uno de los valores de esta categoría
          for (const value of values) {
            switch (field) {
              case 'landing_url':
                if (session.landing_url) {
                  const urlPath = session.landing_url.split('?')[0]
                  const pageName = urlPath.split('/').pop() || 'home'
                  if (pageName === value) fieldMatch = true
                }
                break
              case 'utm_campaign':
                if (session.utm_campaign === value) fieldMatch = true
                break
              case 'utm_content':
                if (session.utm_content === value) fieldMatch = true
                break
              case 'utm_source':
                if (session.utm_source === value) fieldMatch = true
                break
              case 'device_type':
                if (session.device_type === value) fieldMatch = true
                break
              case 'browser':
                if (session.browser === value) fieldMatch = true
                break
              case 'os':
                if (session.os === value) fieldMatch = true
                break
              case 'placement':
                if (session.placement === value) fieldMatch = true
                break
            }
          }

          // Si no hay coincidencia en esta categoría, la sesión no pasa el filtro
          if (!fieldMatch) return false
        }

        return true
      })

      setSessions(filtered)
    }
  }, [selectedFilters, allSessions]) // Se ejecuta cuando cambian los filtros o las sesiones

  // Recalcular métricas cuando cambian las sesiones filtradas
  useEffect(() => {
    if (sessions.length === 0) {
      // Reset métricas si no hay datos
      setMetrics({
        pageViews: 0,
        uniqueVisitors: 0,
        registros: 0,
        conversionRate: 0,
        avgSessionDuration: 0,
        bounceRate: 0,
        returningUsers: 0,
        avgPagePerSession: 0,
        trends: {
          pageViews: 0,
          uniqueVisitors: 0,
          registros: 0,
          conversionRate: 0,
          avgSessionDuration: 0,
          bounceRate: 0,
          returningUsers: 0,
          avgPagePerSession: 0
        }
      })
      setDailyTraffic([])
      setTrafficSources([])
      setPlatformsData([])
      setPlacementsData([])
      setDevicesData([])
      setOsData([])
      setBrowserData([])
      return
    }

    // Recalcular todas las métricas con las sesiones filtradas
    const uniqueVids = new Set(sessions.map((s: Session) => s.visitor_id)).size
    const totalPageViews = sessions.reduce((acc: number, s: Session) =>
      acc + (s.pageviews_count || 1), 0
    )

    // Opt-ins reales: contactos que aparecen en AMBOS (creados Y en tracking)
    const filterContactIds = new Set<string>()
    const filterSessionContactIds = new Set<string>()
    
    contactsData.forEach((contact: any) => {
      const contactId = contact.contact_id || contact.contactId || contact.id || contact.ID
      if (contactId) {
        filterContactIds.add(contactId.toString())
      }
    })
    
    sessions.forEach((session: Session) => {
      if (session.contact_id) {
        filterSessionContactIds.add(session.contact_id.toString())
      }
    })
    
    const optIns = new Set([...filterContactIds].filter(id => filterSessionContactIds.has(id)))
    const registros = optIns.size

    const conversionRate = uniqueVids > 0 && !isNaN(registros) ? ((registros / uniqueVids) * 100) : 0
    const bounceRate = sessions.length > 0 ?
      ((sessions.filter((s: Session) => s.is_bounce).length / sessions.length) * 100) : 0

    const visitorCounts: { [key: string]: number } = {}
    sessions.forEach((s: Session) => {
      visitorCounts[s.visitor_id] = (visitorCounts[s.visitor_id] || 0) + 1
    })
    const returningUsers = Object.values(visitorCounts).filter(count => count > 1).length
    const avgPagePerSession = sessions.length > 0 ?
      (totalPageViews / sessions.length) : 0
    const avgDuration = sessions.length > 0 ?
      Math.round(sessions.reduce((acc: number, s: Session) =>
        acc + (s.events_count || 1) * 45, 0) / sessions.length) : 0

    setMetrics(prev => ({
      ...prev,
      pageViews: totalPageViews,
      uniqueVisitors: uniqueVids,
      registros, // Ahora usa los registros reales calculados arriba
      conversionRate,
      avgSessionDuration: avgDuration,
      bounceRate,
      returningUsers,
      avgPagePerSession
    }))

    // Recalcular el gráfico con las sesiones filtradas
    const msPerDay = 24 * 60 * 60 * 1000
    const daysDiff = Math.round((dateRange.end.getTime() - dateRange.start.getTime()) / msPerDay)

    let aggregationLevel: 'day' | 'week' | 'month' | 'quarter' | 'year'
    let dateFormat: Intl.DateTimeFormatOptions

    if (daysDiff <= 31) {
      aggregationLevel = 'day'
      dateFormat = { day: 'numeric', month: 'short' }
    } else if (daysDiff <= 90) {
      aggregationLevel = 'week'
      dateFormat = { day: 'numeric', month: 'short' }
    } else if (daysDiff <= 365) {
      aggregationLevel = 'month'
      dateFormat = { month: 'short', year: 'numeric' }
    } else if (daysDiff <= 730) {
      aggregationLevel = 'quarter'
      dateFormat = { month: 'short', year: 'numeric' }
    } else {
      aggregationLevel = 'year'
      dateFormat = { year: 'numeric' }
    }

    const getAggregationKey = (dateStr: string): string => {
      const date = new Date(dateStr)
      switch (aggregationLevel) {
        case 'day':
          return dateStr.split('T')[0]
        case 'week':
          const weekDate = new Date(date)
          const day = weekDate.getDay()
          const diff = weekDate.getDate() - day + (day === 0 ? -6 : 1)
          weekDate.setDate(diff)
          return weekDate.toISOString().split('T')[0]
        case 'month':
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        case 'quarter':
          const quarter = Math.floor(date.getMonth() / 3) + 1
          return `${date.getFullYear()}-Q${quarter}`
        case 'year':
          return String(date.getFullYear())
        default:
          return dateStr.split('T')[0]
      }
    }

    const aggregatedStats: { [key: string]: { totalVisits: number, uniqueVisitors: Set<string> } } = {}
    sessions.forEach((session: Session) => {
      const key = getAggregationKey(session.created_at)
      if (!aggregatedStats[key]) {
        aggregatedStats[key] = {
          totalVisits: 0,
          uniqueVisitors: new Set()
        }
      }
      aggregatedStats[key].totalVisits++
      aggregatedStats[key].uniqueVisitors.add(session.visitor_id)
    })

    const allPeriods: string[] = []
    const currentDate = new Date(dateRange.start)
    const endDate = new Date(dateRange.end)

    while (currentDate <= endDate) {
      const key = getAggregationKey(currentDate.toISOString())
      if (!allPeriods.includes(key)) {
        allPeriods.push(key)
      }

      switch (aggregationLevel) {
        case 'day':
          currentDate.setDate(currentDate.getDate() + 1)
          break
        case 'week':
          currentDate.setDate(currentDate.getDate() + 7)
          break
        case 'month':
          currentDate.setMonth(currentDate.getMonth() + 1)
          break
        case 'quarter':
          currentDate.setMonth(currentDate.getMonth() + 3)
          break
        case 'year':
          currentDate.setFullYear(currentDate.getFullYear() + 1)
          break
      }
    }

    const chartData = allPeriods
      .sort()
      .map(period => {
        const stats = aggregatedStats[period] || { totalVisits: 0, uniqueVisitors: new Set() }
        let label: string
        if (aggregationLevel === 'quarter') {
          const [year, quarter] = period.split('-Q')
          label = `Q${quarter} ${year}`
        } else if (aggregationLevel === 'week') {
          const date = new Date(period)
          const endOfWeek = new Date(date)
          endOfWeek.setDate(date.getDate() + 6)
          label = `${date.getDate()} - ${endOfWeek.getDate()} ${formatDate(date, { month: 'short' })}`
        } else {
          const date = aggregationLevel === 'month'
            ? new Date(period + '-01')
            : new Date(period)
          label = formatDate(date, dateFormat)
        }
        return {
          date: label,
          visitas: stats.totalVisits,
          visitantesUnicos: stats.uniqueVisitors.size
        }
      })

    setDailyTraffic(chartData)

    // Opt-ins reales por período: solo contactos que aparecen en AMBOS
    const conversionsPerPeriodFiltered: Record<string, Set<string>> = {}

    // Crear mapas de contactos y sesiones para cruzar datos
    const finalContactIds = new Set<string>()
    const finalSessionContactIds = new Set<string>()

    contactsData.forEach((contact: any) => {
      const contactId = contact.contact_id || contact.contactId || contact.id || contact.ID
      if (contactId) {
        finalContactIds.add(contactId.toString())
      }
    })

    // IMPORTANTE: Usar 'sessions' (filtradas) en vez de 'allSessions' para respetar el filtro de páginas
    sessions.forEach((session: Session) => {
      if (session.contact_id) {
        finalSessionContactIds.add(session.contact_id.toString())
      }
    })

    // Solo contar registros reales por período usando contact.createdAt
    contactsData.forEach((contact: any) => {
      const contactId = contact.contact_id || contact.contactId || contact.id || contact.ID
      if (contactId && contact.createdAt && finalContactIds.has(contactId.toString()) && finalSessionContactIds.has(contactId.toString())) {
        const createdDate = new Date(contact.createdAt)
        const periodKey = getAggregationKey(createdDate.toISOString())

        if (!conversionsPerPeriodFiltered[periodKey]) {
          conversionsPerPeriodFiltered[periodKey] = new Set()
        }

        conversionsPerPeriodFiltered[periodKey].add(contactId.toString())
      }
    })

    // Crear datos del gráfico
    const conversionChartDataFiltered = allPeriods
      .sort()
      .map(period => {
        const contactsInPeriod = conversionsPerPeriodFiltered[period] || new Set()
        const conversions = contactsInPeriod.size

        // Formatear la etiqueta según el período
        let label: string
        if (aggregationLevel === 'quarter') {
          const [year, quarter] = period.split('-Q')
          label = `Q${quarter} ${year}`
        } else if (aggregationLevel === 'week') {
          const date = new Date(period)
          const endOfWeek = new Date(date)
          endOfWeek.setDate(date.getDate() + 6)
          label = `${date.getDate()} - ${endOfWeek.getDate()} ${formatDate(date, { month: 'short' })}`
        } else {
          const date = aggregationLevel === 'month'
            ? new Date(period + '-01')
            : new Date(period)
          label = formatDate(date, dateFormat)
        }

        return {
          date: label,
          conversiones: conversions,
          registros: conversions
        }
      })

    setDailyConversions(conversionChartDataFiltered)

    // Recalcular fuentes de tráfico con sesiones filtradas
    const organicSources: { [key: string]: number } = {
      'Facebook Orgánico': 0,
      'Instagram Orgánico': 0,
      'Google Orgánico': 0,
      'Twitter Orgánico': 0,
      'LinkedIn Orgánico': 0,
      'YouTube Orgánico': 0,
      'Pinterest Orgánico': 0,
      'Reddit Orgánico': 0,
      'Snapchat Orgánico': 0,
      'Directo': 0
    }

    const paidSources: { [key: string]: number } = {
      'Facebook Ads': 0,
      'Instagram Ads': 0,
      'Google Ads': 0,
      'TikTok Ads': 0,
      'Twitter Ads': 0,
      'LinkedIn Ads': 0,
      'YouTube Ads': 0,
      'Pinterest Ads': 0,
      'Snapchat Ads': 0,
      'Reddit Ads': 0
    }

    sessions.forEach((session: Session) => {
      const utm = session.utm_source?.toLowerCase() || ''
      const medium = session.utm_medium?.toLowerCase() || ''
      const referrer = session.referrer_domain?.toLowerCase() || ''
      const hasPaidParams = medium.includes('cpc') ||
                           medium.includes('ppc') ||
                           medium.includes('paid') ||
                           utm.includes('fb_ad') ||
                           utm.includes('paid')

      if (utm.includes('fb') || utm.includes('facebook') || referrer.includes('facebook')) {
        if (hasPaidParams) {
          paidSources['Facebook Ads']++
        } else {
          organicSources['Facebook Orgánico']++
        }
      } else if (utm.includes('ig') || utm.includes('instagram') || referrer.includes('instagram')) {
        if (hasPaidParams) {
          paidSources['Instagram Ads']++
        } else {
          organicSources['Instagram Orgánico']++
        }
      } else if (utm.includes('google') || referrer.includes('google')) {
        if (hasPaidParams || medium === 'cpc') {
          paidSources['Google Ads']++
        } else {
          organicSources['Google Orgánico']++
        }
      } else if (utm.includes('tiktok') || referrer.includes('tiktok')) {
        paidSources['TikTok Ads']++
      } else if (utm.includes('twitter') || referrer.includes('twitter')) {
        if (hasPaidParams) {
          paidSources['Twitter Ads']++
        } else {
          organicSources['Twitter Orgánico']++
        }
      } else if (utm.includes('linkedin') || referrer.includes('linkedin')) {
        if (hasPaidParams) {
          paidSources['LinkedIn Ads']++
        } else {
          organicSources['LinkedIn Orgánico']++
        }
      } else if (utm.includes('youtube') || referrer.includes('youtube')) {
        if (hasPaidParams) {
          paidSources['YouTube Ads']++
        } else {
          organicSources['YouTube Orgánico']++
        }
      } else if (utm.includes('pinterest') || referrer.includes('pinterest')) {
        if (hasPaidParams) {
          paidSources['Pinterest Ads']++
        } else {
          organicSources['Pinterest Orgánico']++
        }
      } else if (utm.includes('snapchat') || referrer.includes('snapchat')) {
        if (hasPaidParams) {
          paidSources['Snapchat Ads']++
        } else {
          organicSources['Snapchat Orgánico']++
        }
      } else if (utm.includes('reddit') || referrer.includes('reddit')) {
        if (hasPaidParams) {
          paidSources['Reddit Ads']++
        } else {
          organicSources['Reddit Orgánico']++
        }
      } else {
        organicSources['Directo']++
      }
    })

    const allSources = { ...organicSources, ...paidSources }
    const sourceData = Object.entries(allSources)
      .filter(([_, count]) => count > 0)
      .map(([name, count]) => ({
        name,
        value: count,
        percentage: ((count / sessions.length) * 100).toFixed(1),
        isPaid: name.includes('Ads')
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)

    setTrafficSources(sourceData)

    // Los datos de navegadores ya se calculan arriba en loadAnalyticsData
    // No necesitamos recalcular aquí

    // Top Visitors con sesiones filtradas
    const topVisitorsList = Object.entries(visitorCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([visitorId, count]) => ({
        id: visitorId.substring(0, 24) + '...',
        requests: count
      }))

    setTopVisitors(topVisitorsList)
  }, [sessions, dateRange, contactsData]) // Se ejecuta cuando cambian las sesiones filtradas o los contactos

  // Preparar métricas para KPICards con cambios reales
  const getTrend = (value: number): 'up' | 'down' | undefined => {
    return value > 0 ? 'up' : value < 0 ? 'down' : undefined
  }

  const mainMetrics = [
    {
      label: 'Página Visualizaciones',
      value: metrics.pageViews > 1000 ? `${(metrics.pageViews / 1000).toFixed(1)}K` : metrics.pageViews.toString(),
      change: metrics.trends?.pageViews || 0,
      trend: getTrend(metrics.trends?.pageViews || 0)
    },
    {
      label: 'Visitantes Únicos',
      value: metrics.uniqueVisitors.toString(),
      change: metrics.trends?.uniqueVisitors || 0,
      trend: getTrend(metrics.trends?.uniqueVisitors || 0)
    },
    {
      label: 'Registros',
      value: metrics.registros.toString(),
      change: metrics.trends?.registros || 0,
      trend: getTrend(metrics.trends?.registros || 0)
    },
    {
      label: 'Tasa de Conversión',
      value: `${metrics.conversionRate.toFixed(1)}%`,
      change: metrics.trends?.conversionRate || 0,
      trend: getTrend(metrics.trends?.conversionRate || 0)
    }
  ]

  const getTrendInverted = (value: number): 'up' | 'down' | undefined => {
    return value < 0 ? 'up' : value > 0 ? 'down' : undefined // Invertido para métricas donde menos es mejor
  }

  const secondaryMetrics = [
    {
      label: 'Tasa de Rebote',
      value: `${metrics.bounceRate.toFixed(1)}%`,
      change: metrics.trends?.bounceRate || 0,
      trend: getTrendInverted(metrics.trends?.bounceRate || 0) // Invertido porque menos rebote es mejor
    },
    {
      label: 'Duración Promedio',
      value: `${Math.floor(metrics.avgSessionDuration / 60)}:${(metrics.avgSessionDuration % 60).toString().padStart(2, '0')}`,
      change: metrics.trends?.avgSessionDuration || 0,
      trend: getTrend(metrics.trends?.avgSessionDuration || 0)
    },
    {
      label: 'Usuarios Recurrentes',
      value: metrics.returningUsers.toString(),
      change: metrics.trends?.returningUsers || 0,
      trend: getTrend(metrics.trends?.returningUsers || 0)
    },
    {
      label: 'Páginas/Sesión',
      value: metrics.avgPagePerSession.toFixed(1),
      change: metrics.trends?.avgPagePerSession || 0,
      trend: getTrend(metrics.trends?.avgPagePerSession || 0)
    }
  ]



  return (
    <PageContainer>
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-4">
          <h1 className="text-2xl font-bold text-primary">Analíticas</h1>

          {/* Selector de fechas y Filtro en árbol juntos */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <DateRangePicker />
            <TreeFilter
              availableData={availableFilterData}
              selectedFilters={selectedFilters}
              onFilterChange={setSelectedFilters}
            />
          </div>
        </div>

        {/* Métricas principales - Usando KPICard como Dashboard */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {mainMetrics.map((metric, index) => {
            // Para las métricas principales, usar iconos apropiados
            const icons = [Icons.eye, Icons.users, Icons.userCheck, Icons.target]
            return (
              <KPICard
                key={metric.label}
                title={metric.label}
                value={metric.value}
                change={metric.change}
                trend={metric.trend}
                icon={icons[index]}
                iconColor='text-primary' // Mismo patrón que Dashboard
                className={loading ? 'animate-pulse' : ''}
              />
            )
          })}
        </div>

        {/* Métricas secundarias */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {secondaryMetrics.map((metric, index) => {
            // Para las métricas secundarias, usar iconos apropiados
            const icons = [Icons.activity, Icons.clock, Icons.refresh, Icons.fileText]
            return (
              <KPICard
                key={metric.label}
                title={metric.label}
                value={metric.value}
                change={metric.change}
                trend={metric.trend}
                icon={icons[index]}
                iconColor='text-primary' // Mismo patrón que Dashboard
                className={loading ? 'animate-pulse' : ''}
              />
            )
          })}
        </div>

        {/* Grid de gráficos: Tráfico y Conversiones lado a lado */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Gráfica de tráfico - Exactamente igual que Dashboard */}
          <Card variant="glass" className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-primary">Tráfico del Sitio</h3>
                <p className="text-xs text-secondary mt-0.5">Visualizaciones de página y visitantes únicos</p>
              </div>
            </div>

          <ChartContainer height={250}>
            {loading || !dailyTraffic.length ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-pulse text-tertiary">Cargando datos...</div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyTraffic} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <defs>
                    {/* Gradientes para Visitas Totales - Color MORADO */}
                    <linearGradient
                      id={`gradient-visitas-${isDarkMode ? 'dark' : 'light'}`}
                      x1="0" y1="0" x2="0" y2="1"
                    >
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.2} />
                      <stop offset="50%" stopColor="#8b5cf6" stopOpacity={0.1} />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.02} />
                    </linearGradient>
                    {/* Gradientes para Visitantes Únicos - Color AZUL */}
                    <linearGradient
                      id={`gradient-visitantes-${isDarkMode ? 'dark' : 'light'}`}
                      x1="0" y1="0" x2="0" y2="1"
                    >
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.2} />
                      <stop offset="50%" stopColor="#3b82f6" stopOpacity={0.1} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" stroke={themeData.colors.chart.grid} />

                  <XAxis
                    dataKey="date"
                    tick={{ fill: themeData.colors.text.tertiary, fontSize: 12 }}
                    axisLine={{ stroke: themeData.colors.text.tertiary, opacity: 0.2 }}
                  />

                  <YAxis
                    tick={{ fill: themeData.colors.text.tertiary, fontSize: 12 }}
                    axisLine={{ stroke: themeData.colors.text.tertiary, opacity: 0.2 }}
                    tickFormatter={(value, index) => {
                      // Ocultar el primer valor del eje Y para evitar solapamiento
                      if (index === 0) return ''
                      if (value >= 1000) {
                        return `${Math.round(value / 1000)}k`
                      }
                      return Math.round(value).toString()
                    }}
                    domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.4)]}
                  />

                  <SmartRechartsTooltip
                    content={({ active, payload, label }: any) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="glass rounded-lg p-3 shadow-xl">
                            <p className="text-xs text-tertiary mb-2">{label}</p>
                            {payload.map((item: any, index: number) => (
                              <div key={index} className="flex items-center gap-2 text-sm">
                                <div
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: item.color }}
                                />
                                <span className="text-secondary">
                                  {item.name}:
                                </span>
                                <span className="text-primary font-medium">
                                  {formatNumber(item.value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )
                      }
                      return null
                    }}
                    cursor={false}
                    prefer="tr"
                    offset={{ x: 0, y: 60 }}
                    portalToBody
                    allowEscapeViewBox={{ x: true, y: true }}
                  />

                  <Area
                    type="monotone"
                    dataKey="visitantesUnicos"
                    name="Visitantes Únicos"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    fill={`url(#gradient-visitantes-${isDarkMode ? 'dark' : 'light'})`}
                    dot={false}
                    activeDot={{
                      r: 6,
                      fill: '#3b82f6',
                      stroke: isDarkMode ? '#0a0b0d' : '#ffffff',
                      strokeWidth: 2
                    }}
                  />

                  <Area
                    type="monotone"
                    dataKey="visitas"
                    name="Visitas Totales"
                    stroke="#8b5cf6"
                    strokeWidth={2.5}
                    fill={`url(#gradient-visitas-${isDarkMode ? 'dark' : 'light'})`}
                    dot={false}
                    activeDot={{
                      r: 6,
                      fill: '#8b5cf6',
                      stroke: isDarkMode ? '#0a0b0d' : '#ffffff',
                      strokeWidth: 2
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ChartContainer>
        </Card>

        {/* Gráfica de Conversiones/Registros */}
        <Card variant="glass" className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-primary">Registros</h3>
              <p className="text-xs text-secondary mt-0.5">
                {Object.keys(selectedFilters).length === 0
                  ? 'Todos los datos'
                  : `${Object.values(selectedFilters).flat().length} filtros activos`}
              </p>
            </div>
          </div>

          <ChartContainer height={250}>
            {loading || !dailyConversions.length ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-pulse text-tertiary">Cargando datos...</div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyConversions} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <defs>
                    {/* Gradiente para Conversiones - Color verde success */}
                    <linearGradient
                      id={`gradient-conversiones-${isDarkMode ? 'dark' : 'light'}`}
                      x1="0" y1="0" x2="0" y2="1"
                    >
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="50%" stopColor="#10b981" stopOpacity={0.1} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" stroke={themeData.colors.chart.grid} />

                  <XAxis
                    dataKey="date"
                    tick={{ fill: themeData.colors.text.tertiary, fontSize: 12 }}
                    axisLine={{ stroke: themeData.colors.text.tertiary, opacity: 0.2 }}
                  />

                  <YAxis
                    tick={{ fill: themeData.colors.text.tertiary, fontSize: 12 }}
                    axisLine={{ stroke: themeData.colors.text.tertiary, opacity: 0.2 }}
                    tickFormatter={(value, index) => {
                      // Ocultar el primer valor del eje Y
                      if (index === 0) return ''
                      return Math.round(value).toString()
                    }}
                    domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.4)]}
                  />

                  <SmartRechartsTooltip
                    content={({ active, payload, label }: any) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="glass rounded-lg p-3 shadow-xl">
                            <p className="text-xs text-tertiary mb-2">{label}</p>
                            {payload.map((item: any, index: number) => (
                              <div key={index} className="flex items-center gap-2 text-sm">
                                <div
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: item.color }}
                                />
                                <span className="text-secondary">
                                  {item.name}:
                                </span>
                                <span className="text-primary font-medium">
                                  {formatNumber(item.value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )
                      }
                      return null
                    }}
                    cursor={false}
                    prefer="tr"
                    offset={{ x: 0, y: 60 }}
                    portalToBody
                    allowEscapeViewBox={{ x: true, y: true }}
                  />

                  <Area
                    type="monotone"
                    dataKey="conversiones"
                    name="Conversiones"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fill={`url(#gradient-conversiones-${isDarkMode ? 'dark' : 'light'})`}
                    dot={false}
                    activeDot={{
                      r: 6,
                      fill: '#10b981',
                      stroke: isDarkMode ? '#0a0b0d' : '#ffffff',
                      strokeWidth: 2
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ChartContainer>
        </Card>
        </div>

        {/* Primera fila - Fuentes de tráfico y Plataformas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Fuentes de tráfico - Usando el mismo componente que Dashboard */}
          <TrafficChart />

          {/* Top Plataformas */}
          <Card variant="glass">
            <div className="p-4 border-b border-primary">
              <h3 className="text-sm font-semibold text-primary">Top Plataformas</h3>
            </div>
            <div className="p-5 space-y-4">
              {platformsData.map((platform, index) => {
                return (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <SocialIcon name={platform.icon} className="w-4 h-4 text-secondary" />
                        <span className="text-sm text-primary">{platform.name}</span>
                      </div>
                      <span className="text-sm font-semibold text-primary">{platform.users}</span>
                    </div>
                    <div className="w-full h-2 bg-glass rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gray-500 dark:bg-gray-400 opacity-60 transition-all duration-500"
                        style={{ width: `${platform.percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>

        {/* Sección del Mapa de Ubicaciones */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Mapa - ocupa 2 columnas */}
          <Card variant="glass" className="lg:col-span-2">
            <div className="p-4 border-b border-primary">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
                    <Icons.mapPin className="w-4 h-4" />
                    Mapa de Visitantes
                  </h3>
                  <p className="text-xs text-secondary mt-0.5">
                    {locationData?.totalVisitors || 0} visitantes de {locationData?.totalCountries || 0} {mapView === 'country' ? 'estados' : 'países'}
                  </p>
                </div>
                <Select
                  value={mapView}
                  onChange={(value) => setMapView(value as 'world' | 'country')}
                  options={[
                    { value: 'world', label: 'Vista Mundial' },
                    { value: 'country', label: 'México' }
                  ]}
                />
              </div>
            </div>
            <div className="p-4 relative" style={{ height: '400px' }}>
              {/* Controles de zoom estilo Google Maps mejorados */}
              <div className="absolute top-4 right-4 z-10 flex flex-col">
                <div className="glass rounded-lg shadow-lg backdrop-blur-sm">
                  <button
                    onClick={() => setMapZoom(prev => Math.min(prev * 1.5, 8))}
                    className="hover:bg-primary/10 active:bg-primary/20 transition-all p-2.5 rounded-t-lg border-b border-primary/10 group"
                    title="Acercar (también puedes usar scroll)"
                    disabled={mapZoom >= 8}
                  >
                    <Icons.plus className={`w-4 h-4 transition-colors ${mapZoom >= 8 ? 'text-tertiary' : 'text-primary group-hover:text-info'}` } />
                  </button>
                  <button
                    onClick={() => setMapZoom(prev => Math.max(prev / 1.5, 0.5))}
                    className="hover:bg-primary/10 active:bg-primary/20 transition-all p-2.5 rounded-b-lg group"
                    title="Alejar (también puedes usar scroll)"
                    disabled={mapZoom <= 0.5}
                  >
                    <Icons.minus className={`w-4 h-4 transition-colors ${mapZoom <= 0.5 ? 'text-tertiary' : 'text-primary group-hover:text-info'}`} />
                  </button>
                </div>

                <div className="mt-2 glass rounded-lg shadow-lg backdrop-blur-sm">
                  <button
                    onClick={() => {
                      setMapZoom(2.5)
                      setMapView('country')
                    }}
                    className="hover:bg-primary/10 active:bg-primary/20 transition-all p-2.5 rounded-lg group"
                    title="Restablecer vista con zoom"
                  >
                    <Icons.home className="w-4 h-4 text-primary group-hover:text-info transition-colors" />
                  </button>
                </div>
              </div>

              {/* Indicador de nivel de zoom */}
              <div className="absolute top-4 left-4 z-10">
                <div className="glass px-3 py-1.5 rounded-lg backdrop-blur-sm flex items-center gap-2">
                  <Icons.search className="w-3.5 h-3.5 text-secondary" />
                  <span className="text-xs text-secondary font-medium">
                    Zoom: {(mapZoom * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              {/* Indicador de arrastre con animación */}
              <div className="absolute bottom-4 left-4 z-10">
                <div className="flex items-center gap-2 text-xs text-secondary glass px-3 py-2 rounded-lg backdrop-blur-sm">
                  <div className="relative">
                    <Icons.move className="w-3.5 h-3.5 animate-pulse" />
                  </div>
                  <span className="flex items-center gap-1.5">
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" transform="rotate(45 10 10)"/>
                      </svg>
                      Arrastra
                    </span>
                    •
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" transform="rotate(90 12 12)"/>
                      </svg>
                      Scroll
                    </span>
                  </span>
                </div>
              </div>

              <ComposableMap
                projection="geoMercator"
                projectionConfig={{
                  center: mapView === 'world' ? [0, 20] : [-102, 23.5],
                  scale: mapView === 'world' ? 120 : 550
                }}
                style={{
                  cursor: isDragging ? 'grabbing' : 'grab',
                  width: '100%',
                  height: '100%'
                }}
              >
                <ZoomableGroup
                  zoom={mapZoom}
                  minZoom={0.5}
                  maxZoom={8}
                  center={mapView === 'world' ? [0, 20] : [-102, 23.5]}
                  onMoveStart={() => setIsDragging(true)}
                  onMoveEnd={() => setIsDragging(false)}
                  translateExtent={[[-1000, -1000], [1000, 1000]]}
                  onZoomStart={() => {}}
                  onZoomEnd={(e: any) => {
                    setMapZoom(e.zoom)
                  }}
                >
                  <Geographies
                    geography={mapView === 'world'
                      ? "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"
                      : "https://raw.githubusercontent.com/angelnmara/geojson/master/mexicoHigh.json"
                    }
                  >
                    {({ geographies }) =>
                      geographies.map((geo) => {
                        // Buscar datos para este país/estado
                        const locationName = geo.properties.NAME || geo.properties.name || geo.properties.ADMIN || geo.properties.NAME_1
                        const locationInfo = locationData?.locations?.find(
                          (loc: any) => {
                            if (mapView === 'country') {
                              // En vista de país, buscar por estado
                              return loc.state === locationName || loc.state?.includes(locationName)
                            } else {
                              // En vista mundial, buscar por país
                              return loc.country === locationName
                            }
                          }
                        )

                        // Color basado en cantidad de visitantes
                        const visitors = locationInfo?.visitors || 0
                        const maxVisitors = Math.max(...(locationData?.locations?.map((l: any) => l.visitors) || [1]))
                        const intensity = visitors / maxVisitors

                        return (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            fill={visitors > 0
                              ? `rgba(59, 130, 246, ${0.2 + intensity * 0.8})` // Azul con intensidad
                              : isDarkMode ? '#1e293b' : '#e2e8f0' // Color base
                            }
                            stroke={isDarkMode ? '#334155' : '#cbd5e1'}
                            strokeWidth={0.5}
                            style={{
                              default: {
                                outline: 'none',
                                transition: 'fill 0.2s ease'
                              },
                              hover: {
                                outline: 'none',
                                fill: visitors > 0
                                  ? `rgba(59, 130, 246, ${0.4 + intensity * 0.6})`
                                  : isDarkMode ? '#334155' : '#cbd5e1',
                                cursor: 'pointer'
                              },
                              pressed: {
                                outline: 'none',
                                fill: visitors > 0
                                  ? `rgba(59, 130, 246, ${0.6 + intensity * 0.4})`
                                  : isDarkMode ? '#475569' : '#94a3b8'
                              }
                            }}
                            onMouseEnter={() => {
                              // Tooltip se puede agregar aquí si se necesita
                              document.body.style.cursor = 'pointer'
                            }}
                            onMouseLeave={() => {
                              document.body.style.cursor = 'auto'
                            }}
                          />
                        )
                      })
                    }
                  </Geographies>

                  {/* Marcadores para países o ciudades principales - sin números, solo puntos */}
                  {locationData?.locations?.map((location: any, index: number) => {
                    // Solo mostrar marcadores si tenemos coordenadas
                    if (location.lat && location.lng) {
                      return (
                        <Marker
                          key={index}
                          coordinates={[location.lng, location.lat]}
                        >
                          <g
                            onMouseEnter={(e) => {
                              // Crear tooltip al hacer hover
                              const tooltip = document.getElementById('map-tooltip')
                              if (tooltip) {
                                tooltip.innerHTML = `
                                  <div class="glass rounded-lg p-3 shadow-xl backdrop-blur-sm">
                                    <p class="text-sm font-semibold text-primary">${location.state || location.country}</p>
                                    <p class="text-xs text-secondary mt-1">${location.visitors} visitantes</p>
                                    ${location.cities?.length > 0 ? `
                                      <p class="text-xs text-tertiary mt-1">
                                        ${location.cities.slice(0, 3).join(', ')}
                                        ${location.cities.length > 3 ? ` +${location.cities.length - 3} más` : ''}
                                      </p>
                                    ` : ''}
                                  </div>
                                `
                                tooltip.style.display = 'block'
                                tooltip.style.left = `${e.clientX + 10}px`
                                tooltip.style.top = `${e.clientY - 40}px`
                              }
                            }}
                            onMouseMove={(e) => {
                              const tooltip = document.getElementById('map-tooltip')
                              if (tooltip) {
                                tooltip.style.left = `${e.clientX + 10}px`
                                tooltip.style.top = `${e.clientY - 40}px`
                              }
                            }}
                            onMouseLeave={() => {
                              const tooltip = document.getElementById('map-tooltip')
                              if (tooltip) {
                                tooltip.style.display = 'none'
                              }
                            }}
                            style={{ cursor: 'pointer' }}
                          >
                            {/* Círculo exterior con animación de pulso */}
                            <circle
                              r={Math.max(5, Math.min(15, Math.sqrt(location.visitors) * 3))}
                              fill="#ef4444"
                              fillOpacity={0.2}
                              className="animate-ping"
                            />
                            {/* Círculo principal */}
                            <circle
                              r={Math.max(3, Math.min(10, Math.sqrt(location.visitors) * 2))}
                              fill="#ef4444"
                              fillOpacity={0.8}
                              stroke="#ffffff"
                              strokeWidth={1.5}
                              className="transition-all duration-200 hover:fillOpacity-100"
                            />
                          </g>
                        </Marker>
                      )
                    }
                    return null
                  })}
                </ZoomableGroup>
              </ComposableMap>
            </div>
            {/* Contenedor del tooltip flotante para el mapa */}
            <div
              id="map-tooltip"
              className="fixed z-50 pointer-events-none transition-opacity duration-200"
              style={{ display: 'none' }}
            />
          </Card>

          {/* Lista de Ubicaciones - ocupa 1 columna */}
          <Card variant="glass">
            <div className="p-4 border-b border-primary">
              <h3 className="text-sm font-semibold text-primary">Top Ubicaciones</h3>
            </div>
            <div className="p-4 space-y-3" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {locationData?.locations?.slice(0, 10).map((location: any, index: number) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-gray-500 dark:bg-gray-400" />
                      <div>
                        <span className="text-sm font-medium text-primary">
                          {location.state || location.country}
                        </span>
                        {location.cities?.length > 0 && (
                          <p className="text-xs text-secondary">
                            {location.cities.slice(0, 2).join(', ')}
                            {location.cities.length > 2 && ` +${location.cities.length - 2}`}
                          </p>
                        )}
                        {location.regions?.length > 0 && mapView === 'world' && (
                          <p className="text-xs text-tertiary">
                            {location.regions.length} regiones
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-primary">
                        {location.visitors}
                      </span>
                      <p className="text-xs text-secondary">
                        {location.percentage?.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-glass rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gray-500 dark:bg-gray-400 opacity-50 transition-all duration-500"
                      style={{ width: `${location.percentage}%` }}
                    />
                  </div>
                </div>
              ))}

              {!locationData?.locations?.length && (
                <div className="text-center py-8 text-secondary">
                  <Icons.globe className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No hay datos de ubicación disponibles</p>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Segunda fila - 4 columnas: Ubicaciones, Dispositivos, OS y Navegadores */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Ubicaciones */}
          <Card variant="glass">
            <div className="p-4 border-b border-primary">
              <h3 className="text-sm font-semibold text-primary">Ubicaciones</h3>
            </div>
            <div className="p-4 space-y-3">
              {placementsData.map((placement, index) => {
                return (
                  <div key={index} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <SocialIcon name={placement.icon} className="w-3.5 h-3.5 text-secondary flex-shrink-0" />
                        <span className="text-xs text-primary truncate" title={placement.name}>{placement.name}</span>
                      </div>
                      <span className="text-xs font-medium text-primary ml-2 flex-shrink-0">{placement.users}</span>
                    </div>
                    <div className="w-full h-1.5 bg-glass rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gray-500 dark:bg-gray-400 opacity-50 transition-all duration-500"
                        style={{ width: `${placement.percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          {/* Dispositivos */}
          <Card variant="glass">
            <div className="p-4 border-b border-primary">
              <h3 className="text-sm font-semibold text-primary">Dispositivos</h3>
            </div>
            <div className="p-4 space-y-3">
              {devicesData.map((device, index) => {
                return (
                  <div key={index} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <SocialIcon name={device.icon} className="w-3.5 h-3.5 text-secondary" />
                        <span className="text-xs text-primary">{device.name}</span>
                      </div>
                      <span className="text-xs font-medium text-primary">{device.users}</span>
                    </div>
                    <div className="w-full h-1.5 bg-glass rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gray-500 dark:bg-gray-400 opacity-40 transition-all duration-500"
                        style={{ width: `${device.percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          {/* Sistema Operativo */}
          <Card variant="glass">
            <div className="p-4 border-b border-primary">
              <h3 className="text-sm font-semibold text-primary">Sistema Operativo</h3>
            </div>
            <div className="p-4 space-y-3">
              {osData.map((os, index) => {
                return (
                  <div key={index} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <SocialIcon name={os.icon} className="w-3.5 h-3.5 text-secondary" />
                        <span className="text-xs text-primary">{os.name}</span>
                      </div>
                      <span className="text-xs font-medium text-primary">{os.users}</span>
                    </div>
                    <div className="w-full h-1.5 bg-glass rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gray-500 dark:bg-gray-400 opacity-45 transition-all duration-500"
                        style={{ width: `${os.percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          {/* Navegadores - Ahora en la misma fila */}
          <Card variant="glass">
            <div className="p-4 border-b border-primary">
              <h3 className="text-sm font-semibold text-primary">Navegadores</h3>
            </div>
            <div className="p-4 space-y-3">
              {browserData.map((browser, index) => {
                return (
                  <div key={index} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <SocialIcon name={browser.icon} className="w-3.5 h-3.5 text-secondary" />
                        <span className="text-xs text-primary">{browser.name}</span>
                      </div>
                      <span className="text-xs font-medium text-primary">{browser.users}</span>
                    </div>
                    <div className="w-full h-1.5 bg-glass rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gray-500 dark:bg-gray-400 opacity-55 transition-all duration-500"
                        style={{ width: `${browser.percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>

      </div>
    </PageContainer>
  )
}
