const { databasePool } = require('../config/database.config');
const { queryMetaAdsIfExists } = require('../utils/meta-helper');
const { getGeoFromIP } = require('../utils/geo-helper');

class DashboardService {
  async getFinancialMetrics(startDate, endDate) {
    try {
      // Ajustar fechas para incluir todo el día completo
      const adjustedStartDate = new Date(startDate);
      adjustedStartDate.setHours(0, 0, 0, 0);

      const adjustedEndDate = new Date(endDate);
      adjustedEndDate.setHours(23, 59, 59, 999);

      // Usar las fechas ajustadas para todas las queries
      startDate = adjustedStartDate;
      endDate = adjustedEndDate;
      // First check if Meta ads are synced
      const checkAdsQuery = `
        SELECT COUNT(*) as count
        FROM meta.meta_ads
        LIMIT 1
      `;

      const checkResult = await databasePool.query(checkAdsQuery);
      const hasMetaAds = parseInt(checkResult.rows[0].count) > 0;

      // Query for payments and calculate metrics
      const paymentsQuery = `
        SELECT
          COALESCE(SUM(amount), 0) as net_income,
          COUNT(DISTINCT contact_id) as total_customers,
          AVG(amount) as avg_transaction
        FROM payments
        WHERE COALESCE(paid_at, created_at) >= $1 AND COALESCE(paid_at, created_at) <= $2
          AND status = 'completed'
      `;

      // Query for ad spend from Meta - only if ads exist
      const adSpendQuery = `
        SELECT
          COALESCE(SUM(spend), 0) as ad_spend,
          COALESCE(SUM(clicks), 0) as total_clicks,
          COALESCE(SUM(reach), 0) as total_reach
        FROM meta.meta_ads
        WHERE date >= $1 AND date <= $2
      `;

      // Query for refunds
      const refundsQuery = `
        SELECT
          COALESCE(SUM(amount), 0) as total_refunds
        FROM payments
        WHERE COALESCE(paid_at, created_at) >= $1 AND COALESCE(paid_at, created_at) <= $2
          AND status = 'refunded'
      `;

      // Execute queries - only query ads if they exist
      const [paymentsResult, refundsResult] = await Promise.all([
        databasePool.query(paymentsQuery, [startDate, endDate]),
        databasePool.query(refundsQuery, [startDate, endDate])
      ]);

      // Only query ad spend if Meta ads exist
      let adSpendResult = { rows: [{ ad_spend: 0, total_clicks: 0, total_reach: 0 }] };
      if (hasMetaAds) {
        adSpendResult = await databasePool.query(adSpendQuery, [startDate, endDate]);
      }

      const payments = paymentsResult.rows[0];
      const ads = adSpendResult.rows[0];
      const refunds = refundsResult.rows[0];

      const netIncome = parseFloat(payments.net_income) || 0;
      const adSpend = hasMetaAds ? (parseFloat(ads.ad_spend) || 0) : 0;
      const totalRefunds = parseFloat(refunds.total_refunds) || 0;
      const grossProfit = netIncome - adSpend;
      const roas = adSpend > 0 ? netIncome / adSpend : 0;
      const vatToPay = netIncome * 0.16; // 16% VAT
      const netProfit = grossProfit - vatToPay;

      // Calculate trends (comparing with previous period)
      const periodLength = (endDate - startDate) / (1000 * 60 * 60 * 24);
      const previousEndDate = new Date(startDate);
      previousEndDate.setDate(previousEndDate.getDate() - 1);
      const previousStartDate = new Date(previousEndDate);
      previousStartDate.setDate(previousStartDate.getDate() - periodLength);

      const [prevPayments, prevRefunds] = await Promise.all([
        databasePool.query(paymentsQuery, [previousStartDate, previousEndDate]),
        databasePool.query(refundsQuery, [previousStartDate, previousEndDate])
      ]);

      // Only query previous ad spend if Meta ads exist
      let prevAds = { rows: [{ ad_spend: 0 }] };
      if (hasMetaAds) {
        prevAds = await databasePool.query(adSpendQuery, [previousStartDate, previousEndDate]);
      }

      const prevNetIncome = parseFloat(prevPayments.rows[0].net_income) || 0;
      const prevAdSpend = hasMetaAds ? (parseFloat(prevAds.rows[0].ad_spend) || 0) : 0;
      const prevRefundsAmount = parseFloat(prevRefunds.rows[0].total_refunds) || 0;
      const prevGrossProfit = prevNetIncome - prevAdSpend;
      const prevRoas = prevAdSpend > 0 ? prevNetIncome / prevAdSpend : 0;
      const prevNetProfit = prevGrossProfit - (prevNetIncome * 0.16);

      const calculateTrend = (current, previous) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / Math.abs(previous)) * 100;
      };

      const avgLTV = payments.total_customers > 0 ? netIncome / payments.total_customers : 0;
      const prevAvgLTV = prevPayments.rows[0].total_customers > 0 ? prevNetIncome / prevPayments.rows[0].total_customers : 0;

      return {
        netIncome,
        adSpend,
        grossProfit,
        netProfit,
        roas,
        ltv: avgLTV,
        avgLTV: avgLTV,  // Agregar avgLTV como campo principal
        refunds: totalRefunds,
        vat: vatToPay,
        vatToPay: vatToPay,  // Agregar vatToPay también
        trends: {
          netIncome: calculateTrend(netIncome, prevNetIncome),
          adSpend: calculateTrend(adSpend, prevAdSpend),
          grossProfit: calculateTrend(grossProfit, prevGrossProfit),
          netProfit: calculateTrend(netProfit, prevNetProfit),
          roas: calculateTrend(roas, prevRoas),
          avgLTV: calculateTrend(avgLTV, prevAvgLTV),
          vatToPay: calculateTrend(vatToPay, prevNetIncome * 0.16),
          refunds: calculateTrend(totalRefunds, prevRefundsAmount)
        }
      };
    } catch (error) {
      console.error('Error fetching financial metrics:', error);
      throw error;
    }
  }

  async getFunnelMetrics(startDate, endDate) {
    try {
      // Ajustar fechas para incluir todo el día completo
      const adjustedStartDate = new Date(startDate);
      adjustedStartDate.setHours(0, 0, 0, 0);

      const adjustedEndDate = new Date(endDate);
      adjustedEndDate.setHours(23, 59, 59, 999);

      // Usar las fechas ajustadas para todas las queries
      startDate = adjustedStartDate;
      endDate = adjustedEndDate;
      // Primero verificar si hay datos de sesiones
      const sessionsCountQuery = `
        SELECT COUNT(*) as visitors_count
        FROM tracking.sessions
        WHERE created_at >= $1 AND created_at <= $2
      `;

      const sessionsResult = await databasePool.query(sessionsCountQuery, [startDate, endDate]);
      const visitorsCount = parseInt(sessionsResult.rows[0].visitors_count) || 0;
      const hasTrackingData = visitorsCount > 0;

      // Query para las otras métricas del embudo
      const funnelQuery = `
        SELECT
          (SELECT COUNT(*) FROM contacts WHERE created_at >= $1 AND created_at <= $2) as leads,
          (SELECT COUNT(DISTINCT contact_id) FROM appointments WHERE created_at >= $1 AND created_at <= $2) as qualified,
          (SELECT COUNT(DISTINCT contact_id) FROM payments WHERE COALESCE(paid_at, created_at) >= $1 AND COALESCE(paid_at, created_at) <= $2 AND status = 'completed') as customers
      `;

      const result = await databasePool.query(funnelQuery, [startDate, endDate]);
      const metrics = result.rows[0];

      const leads = parseInt(metrics.leads) || 0;
      const qualified = parseInt(metrics.qualified) || 0;
      const customers = parseInt(metrics.customers) || 0;

      // Si hay datos de tracking, devolver embudo completo
      if (hasTrackingData) {
        return {
          visitors: visitorsCount,
          leads: leads,
          qualified: qualified,
          customers: customers,
          hasTrackingData: true,
          funnelType: 'full' // Embudo completo con visitantes
        };
      }

      // Si NO hay datos de tracking, ajustar el embudo para empezar con leads
      return {
        visitors: 0,
        leads: leads,
        qualified: qualified,
        customers: customers,
        hasTrackingData: false,
        funnelType: 'simplified' // Embudo simplificado sin visitantes
      };
    } catch (error) {
      console.error('Error fetching funnel metrics:', error);
      throw error;
    }
  }

  async getHistoricalRevenue(startDate, endDate) {
    try {
      // Ajustar fechas para incluir todo el día completo
      const adjustedStartDate = new Date(startDate);
      adjustedStartDate.setHours(0, 0, 0, 0);

      const adjustedEndDate = new Date(endDate);
      adjustedEndDate.setHours(23, 59, 59, 999);

      // Usar las fechas ajustadas para todas las queries
      startDate = adjustedStartDate;
      endDate = adjustedEndDate;
      // Check if Meta ads exist
      const checkAdsQuery = `
        SELECT COUNT(*) as count
        FROM meta.meta_ads
        LIMIT 1
      `;

      const checkResult = await databasePool.query(checkAdsQuery);
      const hasMetaAds = parseInt(checkResult.rows[0].count) > 0;

      // Query para ingresos agrupados por mes
      const revenueQuery = `
        SELECT
          TO_CHAR(DATE_TRUNC('month', COALESCE(paid_at, created_at)), 'YYYY-MM') as month_key,
          COALESCE(SUM(amount), 0) as revenue,
          COUNT(*) as transactions
        FROM payments
        WHERE COALESCE(paid_at, created_at) >= $1
          AND COALESCE(paid_at, created_at) <= $2
          AND status = 'completed'
        GROUP BY month_key
        ORDER BY month_key
      `;

      // Query para gastos de publicidad agrupados por mes
      const adSpendQuery = `
        SELECT
          TO_CHAR(DATE_TRUNC('month', date), 'YYYY-MM') as month_key,
          COALESCE(SUM(spend), 0) as ad_spend
        FROM meta.meta_ads
        WHERE date >= $1 AND date <= $2
        GROUP BY month_key
        ORDER BY month_key
      `;

      // Ejecutar queries
      const [revenueResult, adSpendResult] = await Promise.all([
        databasePool.query(revenueQuery, [startDate, endDate]),
        queryMetaAdsIfExists(adSpendQuery, [startDate, endDate])
      ]);

      // Crear mapas para datos
      const revenueMap = new Map();
      const expensesMap = new Map();

      // Procesar ingresos
      revenueResult.rows.forEach(row => {
        revenueMap.set(row.month_key, {
          revenue: parseFloat(row.revenue) || 0,
          transactions: parseInt(row.transactions) || 0
        });
      });

      // Procesar gastos
      adSpendResult.rows.forEach(row => {
        expensesMap.set(row.month_key, parseFloat(row.ad_spend) || 0);
      });

      // Generar array con los últimos 12 meses
      const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      const result = [];

      // Crear fecha de inicio del primer mes
      const currentDate = new Date(endDate);
      const iterDate = new Date(startDate);
      iterDate.setDate(1);
      iterDate.setHours(0, 0, 0, 0);

      while (iterDate <= currentDate) {
        const year = iterDate.getFullYear();
        const month = iterDate.getMonth();
        const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

        const revenueData = revenueMap.get(monthKey) || { revenue: 0, transactions: 0 };
        const expenses = expensesMap.get(monthKey) || 0;

        result.push({
          date: new Date(year, month, 1).toISOString(),
          month: `${monthNames[month]} ${year}`,
          monthKey: monthKey, // Para debug
          income: Math.round(revenueData.revenue),
          expenses: Math.round(expenses),
          revenue: Math.round(revenueData.revenue), // Para compatibilidad
          transactions: revenueData.transactions
        });

        // Avanzar al siguiente mes
        iterDate.setMonth(iterDate.getMonth() + 1);
      }

      return result;
    } catch (error) {
      console.error('Error fetching historical revenue:', error);
      throw error;
    }
  }

  async getTrafficSources(startDate, endDate) {
    try {
      // Ajustar fechas para incluir todo el día completo
      const adjustedStartDate = new Date(startDate);
      adjustedStartDate.setHours(0, 0, 0, 0);

      const adjustedEndDate = new Date(endDate);
      adjustedEndDate.setHours(23, 59, 59, 999);

      // Usar las fechas ajustadas para todas las queries
      startDate = adjustedStartDate;
      endDate = adjustedEndDate;
      // Query que identifica Instagram Ads vs Facebook Ads basándose en browser y site_source_name
      const query = `
        WITH traffic_data AS (
          SELECT
            CASE
              -- Instagram Ads (cuando viene de Instagram app o site_source es 'ig')
              WHEN browser = 'Instagram' OR site_source_name = 'ig' THEN 'Instagram Ads'

              -- Facebook Ads (cuando viene de Facebook app o site_source es 'fb' o tiene fbclid)
              WHEN browser = 'Facebook' OR site_source_name = 'fb' OR fbclid IS NOT NULL THEN 'Facebook Ads'

              -- Google Ads
              WHEN gclid IS NOT NULL OR utm_source ILIKE '%google%' THEN 'Google Ads'

              -- TikTok
              WHEN ttclid IS NOT NULL OR utm_source ILIKE '%tiktok%' THEN 'TikTok Ads'

              -- LinkedIn
              WHEN li_fat_id IS NOT NULL OR utm_source ILIKE '%linkedin%' THEN 'LinkedIn Ads'

              -- Twitter/X
              WHEN twclid IS NOT NULL OR utm_source ILIKE '%twitter%' THEN 'Twitter/X Ads'

              -- Pinterest
              WHEN epik IS NOT NULL OR utm_source ILIKE '%pinterest%' THEN 'Pinterest Ads'

              -- Snapchat
              WHEN sc_click_id IS NOT NULL OR utm_source ILIKE '%snapchat%' THEN 'Snapchat Ads'

              -- Reddit
              WHEN rdt_cid IS NOT NULL OR utm_source ILIKE '%reddit%' THEN 'Reddit Ads'

              -- Email
              WHEN utm_medium ILIKE '%email%' OR utm_source ILIKE '%email%' THEN 'Email'

              -- WhatsApp
              WHEN referrer_domain ILIKE '%whatsapp%' OR utm_source ILIKE '%whatsapp%' THEN 'WhatsApp'

              -- Orgánico (búsqueda sin publicidad)
              WHEN referrer_domain ILIKE '%google.%' AND utm_source IS NULL AND gclid IS NULL THEN 'Orgánico'
              WHEN referrer_domain ILIKE '%bing.%' AND utm_source IS NULL THEN 'Orgánico'
              WHEN referrer_domain ILIKE '%yahoo.%' AND utm_source IS NULL THEN 'Orgánico'
              WHEN referrer_domain ILIKE '%duckduckgo.%' AND utm_source IS NULL THEN 'Orgánico'

              -- Referidos
              WHEN referrer_domain IS NOT NULL
                AND referrer_domain NOT ILIKE '%google.%'
                AND referrer_domain NOT ILIKE '%facebook%'
                AND referrer_domain NOT ILIKE '%instagram%'
                AND referrer_domain NOT ILIKE '%twitter%'
                AND referrer_domain NOT ILIKE '%linkedin%'
                AND referrer_domain NOT ILIKE '%whatsapp%'
                AND utm_source IS NULL THEN 'Referidos'

              -- Directo
              WHEN referrer_domain IS NULL AND utm_source IS NULL THEN 'Directo'

              -- Otros
              ELSE 'Otros'
            END as traffic_source
          FROM tracking.sessions
          WHERE created_at >= $1 AND created_at <= $2
        )
        SELECT
          traffic_source as name,
          COUNT(*) as value,
          COUNT(*) * 100.0 / NULLIF(SUM(COUNT(*)) OVER(), 0) as percentage
        FROM traffic_data
        GROUP BY traffic_source
        ORDER BY value DESC
      `;

      const result = await databasePool.query(query, [startDate, endDate]);

      // Si no hay datos, devolver array vacío
      if (!result.rows || result.rows.length === 0) {
        console.log('[Traffic Sources] No hay datos de sesiones para el período seleccionado');
        return [];
      }

      // Colores oficiales 2024 de cada plataforma
      const colorMap = {
        'Facebook Ads': '#1877f2',   // Azul Facebook oficial
        'Instagram Ads': '#c32aa3',  // Magenta Instagram (color principal del gradiente)
        'Google Ads': '#4285f4',      // Azul Google oficial
        'TikTok Ads': '#ee1d52',      // Rosa-Rojo TikTok oficial
        'LinkedIn Ads': '#0a66c2',    // Azul LinkedIn oficial
        'Twitter/X Ads': '#000000',   // Negro X oficial
        'Pinterest Ads': '#bd081c',   // Rojo Pinterest oficial
        'Snapchat Ads': '#fffc00',    // Amarillo Snapchat oficial
        'Reddit Ads': '#ff4301',      // Naranja-Rojo Reddit oficial
        'WhatsApp': '#25d366',        // Verde WhatsApp oficial
        'Email': '#ea4335',           // Rojo Gmail (más reconocible para email)
        'Orgánico': '#34a853',        // Verde Google (para búsqueda orgánica)
        'Directo': '#5865f2',         // Morado Discord-like (para tráfico directo)
        'Referidos': '#fbbc05',       // Amarillo Google (para referidos)
        'Otros': '#6b7280'            // Gris neutral
      };

      // Calcular cambios con período anterior
      const periodLength = (endDate - startDate) / (1000 * 60 * 60 * 24);
      const previousEndDate = new Date(startDate);
      previousEndDate.setDate(previousEndDate.getDate() - 1);
      const previousStartDate = new Date(previousEndDate);
      previousStartDate.setDate(previousStartDate.getDate() - periodLength);

      const prevResult = await databasePool.query(query, [previousStartDate, previousEndDate]);
      const prevDataMap = new Map(prevResult.rows.map(row => [row.name, parseInt(row.value) || 0]));

      // Mapa de íconos para cada plataforma (usando nombres de React Icons)
      const iconMap = {
        'Facebook Ads': 'FaFacebook',
        'Instagram Ads': 'FaInstagram',
        'Google Ads': 'FaGoogle',
        'TikTok Ads': 'FaTiktok',
        'LinkedIn Ads': 'FaLinkedin',
        'Twitter/X Ads': 'FaXTwitter',
        'Pinterest Ads': 'FaPinterest',
        'Snapchat Ads': 'FaSnapchat',
        'Reddit Ads': 'FaReddit',
        'WhatsApp': 'FaWhatsapp',
        'Email': 'HiMail',
        'Orgánico': 'HiSearch',
        'Directo': 'HiLink',
        'Referidos': 'HiExternalLink',
        'Otros': 'HiQuestionMarkCircle'
      };

      const trafficSources = result.rows.map(row => {
        const currentValue = parseInt(row.value) || 0;
        const prevValue = prevDataMap.get(row.name) || 0;
        const change = prevValue === 0 ? 0 : ((currentValue - prevValue) / prevValue) * 100;

        return {
          name: row.name,
          value: currentValue,
          percentage: Math.round(parseFloat(row.percentage) * 10) / 10, // Redondear a 1 decimal
          color: colorMap[row.name] || '#6B7280',
          icon: iconMap[row.name] || 'HiQuestionMarkCircle',
          change: Math.round(change * 100) / 100 // Redondear a 2 decimales
        };
      });

      console.log(`[Traffic Sources] Encontradas ${trafficSources.length} fuentes de tráfico`);
      return trafficSources;
    } catch (error) {
      console.error('Error fetching traffic sources:', error);
      // En caso de error, devolver array vacío en lugar de lanzar
      return [];
    }
  }

  // Legacy method for backwards compatibility
  async getMetrics(startDate, endDate) {
    try {
      const [financial, funnel] = await Promise.all([
        this.getFinancialMetrics(startDate, endDate),
        this.getFunnelMetrics(startDate, endDate)
      ]);

      return {
        ...financial,
        ...funnel
      };
    } catch (error) {
      console.error('Error fetching dashboard metrics:', error);
      throw error;
    }
  }

  async getVisitorLocations(startDate, endDate, country = null) {
    try {
      // Ajustar fechas para incluir todo el día completo
      const adjustedStartDate = new Date(startDate);
      adjustedStartDate.setHours(0, 0, 0, 0);

      const adjustedEndDate = new Date(endDate);
      adjustedEndDate.setHours(23, 59, 59, 999);

      // Query para obtener visitantes agrupados por país
      const query = `
        WITH visitor_locations AS (
          SELECT
            visitor_id,
            ip,
            geo_country,
            geo_city,
            geo_region,
            created_at
          FROM tracking.sessions
          WHERE created_at >= $1 AND created_at <= $2
            AND visitor_id IS NOT NULL
        ),
        unique_visitors AS (
          SELECT DISTINCT ON (visitor_id)
            visitor_id,
            ip,
            geo_country,
            geo_city,
            geo_region
          FROM visitor_locations
          ORDER BY visitor_id, created_at DESC
        )
        SELECT
          ip,
          geo_country,
          geo_city,
          geo_region,
          COUNT(*) as visitor_count
        FROM unique_visitors
        GROUP BY ip, geo_country, geo_city, geo_region
        ORDER BY visitor_count DESC
        LIMIT 100
      `;

      const result = await databasePool.query(query, [adjustedStartDate, adjustedEndDate]);

      // Procesar resultados y enriquecer con geolocalización
      const locationMap = new Map();
      const stateMap = new Map(); // Para agrupar por estados cuando sea necesario

      result.rows.forEach(row => {
        let countryName = row.geo_country;
        let cityName = row.geo_city;
        let regionName = row.geo_region;

        // Si no hay datos geo pero tenemos IP, intentar obtenerlos
        if (!countryName && row.ip) {
          const geoData = getGeoFromIP(row.ip);
          countryName = geoData.country;
          cityName = geoData.city;
          regionName = geoData.region;
        }

        // Si aún no hay país, usar "Desconocido"
        if (!countryName || countryName === 'Via Facebook/Proxy') {
          countryName = 'Desconocido';
        }

        const visitorCount = parseInt(row.visitor_count) || 1;

        // Si estamos filtrando por país específico (ej: México), agrupar por estado/región
        if (country && countryName === country && regionName) {
          const stateKey = regionName;

          if (stateMap.has(stateKey)) {
            stateMap.get(stateKey).visitors += visitorCount;
            if (cityName && !stateMap.get(stateKey).cities.includes(cityName)) {
              stateMap.get(stateKey).cities.push(cityName);
            }
          } else {
            stateMap.set(stateKey, {
              country: countryName,
              state: regionName,
              visitors: visitorCount,
              cities: cityName ? [cityName] : [],
              percentage: 0
            });
          }
        }

        // Siempre agrupar por país para vista mundial
        const key = countryName;

        if (locationMap.has(key)) {
          locationMap.get(key).visitors += visitorCount;
          // Agregar ciudad si existe y no está ya en la lista
          if (cityName && !locationMap.get(key).cities.includes(cityName)) {
            locationMap.get(key).cities.push(cityName);
          }
          // Agregar región/estado
          if (regionName && !locationMap.get(key).regions) {
            locationMap.get(key).regions = [];
          }
          if (regionName && locationMap.get(key).regions && !locationMap.get(key).regions.includes(regionName)) {
            locationMap.get(key).regions.push(regionName);
          }
        } else {
          locationMap.set(key, {
            country: countryName,
            visitors: visitorCount,
            cities: cityName ? [cityName] : [],
            regions: regionName ? [regionName] : [],
            percentage: 0
          });
        }
      });

      // Decidir qué datos usar según si hay filtro de país
      let locations;
      let isStateView = false;

      if (country && stateMap.size > 0) {
        // Si hay filtro de país y tenemos datos de estados, usar estados
        locations = Array.from(stateMap.values());
        isStateView = true;
      } else {
        // Si no, usar países
        locations = Array.from(locationMap.values());
      }

      const totalVisitors = locations.reduce((sum, loc) => sum + loc.visitors, 0);

      locations.forEach(loc => {
        loc.percentage = totalVisitors > 0 ? (loc.visitors / totalVisitors) * 100 : 0;
      });

      // Ordenar por número de visitantes
      locations.sort((a, b) => b.visitors - a.visitors);

      // Tomar top 15 ubicaciones
      const topLocations = locations.slice(0, 15);

      // Agregar coordenadas para los países principales (para el mapa)
      const countryCoordinates = {
        'México': { lat: 23.6345, lng: -102.5528 },
        'Estados Unidos': { lat: 37.0902, lng: -95.7129 },
        'Canadá': { lat: 56.1304, lng: -106.3468 },
        'España': { lat: 40.4637, lng: -3.7492 },
        'Argentina': { lat: -38.4161, lng: -63.6167 },
        'Colombia': { lat: 4.5709, lng: -74.2973 },
        'Chile': { lat: -35.6751, lng: -71.5430 },
        'Perú': { lat: -9.1900, lng: -75.0152 },
        'Brasil': { lat: -14.2350, lng: -51.9253 },
        'Venezuela': { lat: 6.4238, lng: -66.5897 },
        'Ecuador': { lat: -1.8312, lng: -78.1834 },
        'Guatemala': { lat: 15.7835, lng: -90.2308 },
        'Costa Rica': { lat: 9.7489, lng: -83.7534 },
        'Panamá': { lat: 8.5380, lng: -80.7821 },
        'República Dominicana': { lat: 18.7357, lng: -70.1627 },
        'Honduras': { lat: 15.2000, lng: -86.2419 },
        'El Salvador': { lat: 13.7942, lng: -88.8965 },
        'Nicaragua': { lat: 12.8654, lng: -85.2072 },
        'Bolivia': { lat: -16.2902, lng: -63.5887 },
        'Paraguay': { lat: -23.4425, lng: -58.4438 },
        'Uruguay': { lat: -32.5228, lng: -55.7658 },
        'Local': { lat: 0, lng: 0 },
        'Desconocido': { lat: 0, lng: 0 }
      };

      // Agregar coordenadas a las ubicaciones
      topLocations.forEach(loc => {
        const coords = countryCoordinates[loc.country];
        if (coords) {
          loc.lat = coords.lat;
          loc.lng = coords.lng;
        } else {
          // Si no tenemos coordenadas, usar 0,0
          loc.lat = 0;
          loc.lng = 0;
        }
      });

      return {
        locations: topLocations,
        totalVisitors: totalVisitors,
        totalCountries: isStateView ? stateMap.size : locationMap.size,
        viewType: isStateView ? 'states' : 'countries'
      };
    } catch (error) {
      console.error('Error fetching visitor locations:', error);
      throw error;
    }
  }
}

module.exports = new DashboardService();
