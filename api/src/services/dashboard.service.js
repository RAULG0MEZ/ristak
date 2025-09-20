const { databasePool } = require('../config/database.config');
const { queryMetaAdsIfExists } = require('../utils/meta-helper');

class DashboardService {
  async getFinancialMetrics(startDate, endDate) {
    try {
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
      // Query para obtener datos reales de tracking.sessions
      const query = `
        WITH traffic_data AS (
          SELECT
            CASE
              -- Facebook Ads (por fbclid o utm_source)
              WHEN utm_source ILIKE '%facebook%' OR utm_source ILIKE '%fb%' OR fbclid IS NOT NULL THEN 'Facebook Ads'

              -- Google Ads (por gclid o utm_source)
              WHEN utm_source ILIKE '%google%' OR gclid IS NOT NULL THEN 'Google Ads'

              -- Instagram
              WHEN utm_source ILIKE '%instagram%' OR utm_source ILIKE '%ig%' THEN 'Instagram'

              -- TikTok
              WHEN utm_source ILIKE '%tiktok%' OR ttclid IS NOT NULL THEN 'TikTok'

              -- Email
              WHEN utm_medium ILIKE '%email%' OR utm_source ILIKE '%email%' THEN 'Email'

              -- Orgánico (viene de búsqueda pero sin utm)
              WHEN referrer_domain ILIKE '%google.%' AND utm_source IS NULL THEN 'Orgánico'
              WHEN referrer_domain ILIKE '%bing.%' AND utm_source IS NULL THEN 'Orgánico'
              WHEN referrer_domain ILIKE '%yahoo.%' AND utm_source IS NULL THEN 'Orgánico'
              WHEN referrer_domain ILIKE '%duckduckgo.%' AND utm_source IS NULL THEN 'Orgánico'

              -- Referidos (tiene referrer pero no es búsqueda ni social)
              WHEN referrer_domain IS NOT NULL
                AND referrer_domain NOT ILIKE '%google.%'
                AND referrer_domain NOT ILIKE '%facebook%'
                AND referrer_domain NOT ILIKE '%instagram%'
                AND utm_source IS NULL THEN 'Referidos'

              -- Directo (sin referrer ni utm)
              WHEN referrer_domain IS NULL AND utm_source IS NULL THEN 'Directo'

              -- Otros
              ELSE COALESCE(utm_source, 'Otros')
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

      // Asignar colores apropiados a cada fuente
      const colorMap = {
        'Facebook Ads': '#1877F2',  // Azul Facebook
        'Google Ads': '#4285F4',     // Azul Google
        'Instagram': '#E4405F',      // Rosa Instagram
        'TikTok': '#000000',        // Negro TikTok
        'Email': '#10B981',         // Verde
        'Orgánico': '#10B981',      // Verde
        'Directo': '#8B5CF6',       // Morado
        'Referidos': '#F59E0B',     // Amarillo
        'Otros': '#6B7280'          // Gris
      };

      // Calcular cambios con período anterior
      const periodLength = (endDate - startDate) / (1000 * 60 * 60 * 24);
      const previousEndDate = new Date(startDate);
      previousEndDate.setDate(previousEndDate.getDate() - 1);
      const previousStartDate = new Date(previousEndDate);
      previousStartDate.setDate(previousStartDate.getDate() - periodLength);

      const prevResult = await databasePool.query(query, [previousStartDate, previousEndDate]);
      const prevDataMap = new Map(prevResult.rows.map(row => [row.name, parseInt(row.value) || 0]));

      const trafficSources = result.rows.map(row => {
        const currentValue = parseInt(row.value) || 0;
        const prevValue = prevDataMap.get(row.name) || 0;
        const change = prevValue === 0 ? 0 : ((currentValue - prevValue) / prevValue) * 100;

        return {
          name: row.name,
          value: currentValue,
          percentage: Math.round(parseFloat(row.percentage) * 10) / 10, // Redondear a 1 decimal
          color: colorMap[row.name] || '#6b7280',
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
}

module.exports = new DashboardService();
