const { databasePool } = require('../config/database.config');
const { checkMetaAdsTableExists } = require('../utils/meta-helper');

class CampaignsService {
  async getCampaignsMetrics(startDate, endDate) {
    try {
      // Check if Meta ads table exists
      const hasAdsTable = await checkMetaAdsTableExists();

      // If table doesn't exist, return zeros
      if (!hasAdsTable) {
        console.log('[CAMPAIGNS] No Meta ads synced, returning zero metrics');
        return {
          totalSpend: 0,
          totalClicks: 0,
          totalReach: 0,
          totalLeads: 0,
          totalSales: 0,
          totalRevenue: 0,
          roas: 0,
          trends: {
            spend: 0,
            clicks: 0,
            reach: 0,
            leads: 0,
            sales: 0,
            revenue: 0,
            roas: 0
          }
        };
      }

      // Calculate the previous period for comparison
      const periodLength = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
      const previousEndDate = new Date(startDate);
      previousEndDate.setDate(previousEndDate.getDate() - 1);
      const previousStartDate = new Date(previousEndDate);
      previousStartDate.setDate(previousStartDate.getDate() - periodLength + 1);

      // Query for current period metrics - separate queries for unrelated data
      const currentQuery = `
        WITH meta_stats AS (
          SELECT
            COALESCE(SUM(spend), 0) as total_spend,
            COALESCE(SUM(clicks), 0) as total_clicks,
            COALESCE(SUM(reach), 0) as total_reach
          FROM meta.meta_ads
          WHERE date >= $1 AND date <= $2
        ),
        contact_stats AS (
          SELECT COUNT(DISTINCT contact_id) as total_leads
          FROM contacts
          WHERE created_at >= $1 AND created_at <= $2
        ),
        payment_stats AS (
          SELECT
            COALESCE(SUM(p.amount), 0) as total_revenue,
            COUNT(DISTINCT p.contact_id) as total_sales
          FROM payments p
          JOIN contacts c ON p.contact_id = c.contact_id
          WHERE p.paid_at >= $1 AND p.paid_at <= $2
            AND p.status = 'completed'
            AND c.created_at >= $1 AND c.created_at <= $2
            AND c.attribution_ad_id IS NOT NULL
        )
        SELECT
          m.total_spend,
          m.total_clicks,
          m.total_reach,
          c.total_leads,
          p.total_revenue,
          p.total_sales
        FROM meta_stats m
        CROSS JOIN contact_stats c
        CROSS JOIN payment_stats p
      `;

      // Query for previous period metrics - same structure
      const previousQuery = `
        WITH meta_stats AS (
          SELECT
            COALESCE(SUM(spend), 0) as total_spend,
            COALESCE(SUM(clicks), 0) as total_clicks,
            COALESCE(SUM(reach), 0) as total_reach
          FROM meta.meta_ads
          WHERE date >= $1 AND date <= $2
        ),
        contact_stats AS (
          SELECT COUNT(DISTINCT contact_id) as total_leads
          FROM contacts
          WHERE created_at >= $1 AND created_at <= $2
        ),
        payment_stats AS (
          SELECT
            COALESCE(SUM(p.amount), 0) as total_revenue,
            COUNT(DISTINCT p.contact_id) as total_sales
          FROM payments p
          JOIN contacts c ON p.contact_id = c.contact_id
          WHERE p.paid_at >= $1 AND p.paid_at <= $2
            AND p.status = 'completed'
            AND c.created_at >= $1 AND c.created_at <= $2
            AND c.attribution_ad_id IS NOT NULL
        )
        SELECT
          m.total_spend,
          m.total_clicks,
          m.total_reach,
          c.total_leads,
          p.total_revenue,
          p.total_sales
        FROM meta_stats m
        CROSS JOIN contact_stats c
        CROSS JOIN payment_stats p
      `;

      // Execute both queries in parallel
      const [currentResult, previousResult] = await Promise.all([
        databasePool.query(currentQuery, [startDate, endDate]),
        databasePool.query(previousQuery, [previousStartDate, previousEndDate])
      ]);

      const current = currentResult.rows[0];
      const previous = previousResult.rows[0];

      const totalSpend = parseFloat(current.total_spend) || 0;
      const totalRevenue = parseFloat(current.total_revenue) || 0;
      const prevTotalSpend = parseFloat(previous.total_spend) || 0;
      const prevTotalRevenue = parseFloat(previous.total_revenue) || 0;

      const roas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
      const prevRoas = prevTotalSpend > 0 ? prevTotalRevenue / prevTotalSpend : 0;

      // Calculate percentage changes
      const calculateChange = (current, previous) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / Math.abs(previous)) * 100;
      };

      return {
        revenue: totalRevenue,
        spend: totalSpend,
        roas: roas,
        sales: parseInt(current.total_sales) || 0,
        leads: parseInt(current.total_leads) || 0,
        clicks: parseInt(current.total_clicks) || 0,
        trends: {
          revenue: calculateChange(totalRevenue, prevTotalRevenue),
          spend: calculateChange(totalSpend, prevTotalSpend),
          roas: calculateChange(roas, prevRoas),
          sales: calculateChange(parseInt(current.total_sales), parseInt(previous.total_sales)),
          leads: calculateChange(parseInt(current.total_leads), parseInt(previous.total_leads)),
          clicks: calculateChange(parseInt(current.total_clicks), parseInt(previous.total_clicks))
        }
      };
    } catch (error) {
      console.error('Error fetching campaigns metrics:', error);
      throw error;
    }
  }

  async getHierarchy(startDate, endDate) {
    try {
      // Check if Meta ads table exists
      const hasAdsTable = await checkMetaAdsTableExists();

      // If table doesn't exist, return empty array
      if (!hasAdsTable) {
        console.log('[CAMPAIGNS] No Meta ads synced, returning empty campaigns');
        return [];
      }

      // NOTA: En modo single-tenant ya no filtramos por account_id / subaccount_id
      console.log('[Campaigns] Obteniendo datos en modo single-tenant');

      // 1) Base metrics from ads - FILTRADO POR TENANT
      const adsRes = await databasePool.query(
        `SELECT
           campaign_id,
           campaign_name,
           adset_id,
           adset_name,
           ad_id,
           ad_name,
           COALESCE(SUM(spend),0)  AS spend,
           COALESCE(SUM(reach),0)  AS reach,
           COALESCE(SUM(clicks),0) AS clicks
         FROM meta.meta_ads
         WHERE date >= $1 AND date <= $2
         GROUP BY campaign_id, campaign_name, adset_id, adset_name, ad_id, ad_name
        `,
        [startDate, endDate]
      )

      // 2) Visitors from tracking sessions - YA FILTRADO
      const visitorsRes = await databasePool.query(
        `SELECT ad_id, COUNT(DISTINCT visitor_id) AS visitors
         FROM tracking.sessions
         WHERE ad_id IS NOT NULL
           AND started_at >= $1
           AND started_at <= $2
         GROUP BY ad_id
        `,
        [startDate, endDate]
      )

      // 3) Leads from contacts - FILTRADO POR TENANT
      const leadsRes = await databasePool.query(
        `SELECT c.attribution_ad_id AS ad_id, COUNT(*) AS leads
         FROM contacts c
         WHERE c.attribution_ad_id IS NOT NULL
           AND c.created_at >= $1
           AND c.created_at <= $2
           AND EXISTS (
             SELECT 1 FROM meta.meta_ads ma
             WHERE ma.ad_id = c.attribution_ad_id
               AND (
                 ma.date::date = c.created_at::date
                 OR (
                   ma.date::date >= (c.created_at::date - INTERVAL '3 days')
                   AND ma.date::date <= c.created_at::date
                 )
               )
           )
         GROUP BY c.attribution_ad_id
        `,
        [startDate, endDate]
      )

      // 4) Appointments - FILTRADO POR TENANT
      const apptsRes = await databasePool.query(
        `SELECT c.attribution_ad_id AS ad_id, COUNT(*) AS appointments
         FROM appointments a
         JOIN contacts c ON a.contact_id = c.contact_id
         WHERE c.attribution_ad_id IS NOT NULL
           AND c.created_at >= $1
           AND c.created_at <= $2
           AND EXISTS (
             SELECT 1 FROM meta.meta_ads ma
             WHERE ma.ad_id = c.attribution_ad_id
               AND (
                 ma.date::date = c.created_at::date
                 OR (
                   ma.date::date >= (c.created_at::date - INTERVAL '3 days')
                   AND ma.date::date <= c.created_at::date
                 )
               )
           )
         GROUP BY c.attribution_ad_id
        `,
        [startDate, endDate]
      )

      // 5) Sales/Revenue - FILTRADO POR TENANT
      const salesRes = await databasePool.query(
        `SELECT c.attribution_ad_id AS ad_id,
                COUNT(DISTINCT p.id) AS sales,
                COALESCE(SUM(p.amount),0) AS revenue
         FROM contacts c
         JOIN payments p ON p.contact_id = c.contact_id
         WHERE c.attribution_ad_id IS NOT NULL
           AND p.status = 'completed'
           AND c.created_at >= $1
           AND c.created_at <= $2
           AND EXISTS (
             SELECT 1 FROM meta.meta_ads ma
             WHERE ma.ad_id = c.attribution_ad_id
               AND (
                 ma.date::date = c.created_at::date
                 OR (
                   ma.date::date >= (c.created_at::date - INTERVAL '3 days')
                   AND ma.date::date <= c.created_at::date
                 )
               )
           )
         GROUP BY c.attribution_ad_id
        `,
        [startDate, endDate]
      )

      // Mapear resultados por ad_id
      const visitorsMap = Object.fromEntries(visitorsRes.rows.map(r => [r.ad_id, parseInt(r.visitors)]))
      const leadsMap = Object.fromEntries(leadsRes.rows.map(r => [r.ad_id, parseInt(r.leads)]))
      const apptsMap = Object.fromEntries(apptsRes.rows.map(r => [r.ad_id, parseInt(r.appointments)]))
      const salesMap = Object.fromEntries(salesRes.rows.map(r => [r.ad_id, {
        sales: parseInt(r.sales),
        revenue: parseFloat(r.revenue)
      }]))

      // Construir jerarquía
      const campaignsMap = {}

      for (const ad of adsRes.rows) {
        const { campaign_id, campaign_name, adset_id, adset_name, ad_id, ad_name, spend, reach, clicks } = ad

        if (!campaignsMap[campaign_id]) {
          campaignsMap[campaign_id] = {
            campaignId: campaign_id,
            campaignName: campaign_name,
            status: 'active',
            adSets: []
          }
        }

        let adSet = campaignsMap[campaign_id].adSets.find(as => as.adSetId === adset_id)
        if (!adSet) {
          adSet = {
            adSetId: adset_id,
            adSetName: adset_name,
            status: 'active',
            ads: []
          }
          campaignsMap[campaign_id].adSets.push(adSet)
        }

        const visitors = visitorsMap[ad_id] || 0
        const leads = leadsMap[ad_id] || 0
        const appointments = apptsMap[ad_id] || 0
        const salesData = salesMap[ad_id] || { sales: 0, revenue: 0 }

        adSet.ads.push({
          adId: ad_id,
          adName: ad_name,
          status: 'active',
          spend: parseFloat(spend),
          reach: parseInt(reach),
          clicks: parseInt(clicks),
          cpc: clicks > 0 ? parseFloat(spend) / parseInt(clicks) : null,
          visitors,
          cpv: visitors > 0 ? parseFloat(spend) / visitors : null,
          leads,
          cpl: leads > 0 ? parseFloat(spend) / leads : null,
          appointments,
          sales: salesData.sales,
          cac: salesData.sales > 0 ? parseFloat(spend) / salesData.sales : null,
          revenue: salesData.revenue,
          roas: parseFloat(spend) > 0 ? salesData.revenue / parseFloat(spend) : 0
        })
      }

      // Calcular totales
      const campaigns = Object.values(campaignsMap)
      campaigns.forEach(campaign => {
        campaign.adSets.forEach(adSet => {
          adSet.spend = adSet.ads.reduce((sum, ad) => sum + ad.spend, 0)
          adSet.reach = adSet.ads.reduce((sum, ad) => sum + ad.reach, 0)
          adSet.clicks = adSet.ads.reduce((sum, ad) => sum + ad.clicks, 0)
          adSet.cpc = adSet.clicks > 0 ? adSet.spend / adSet.clicks : null
          adSet.visitors = adSet.ads.reduce((sum, ad) => sum + ad.visitors, 0)
          adSet.cpv = adSet.visitors > 0 ? adSet.spend / adSet.visitors : null
          adSet.leads = adSet.ads.reduce((sum, ad) => sum + ad.leads, 0)
          adSet.cpl = adSet.leads > 0 ? adSet.spend / adSet.leads : null
          adSet.appointments = adSet.ads.reduce((sum, ad) => sum + ad.appointments, 0)
          adSet.sales = adSet.ads.reduce((sum, ad) => sum + ad.sales, 0)
          adSet.cac = adSet.sales > 0 ? adSet.spend / adSet.sales : null
          adSet.revenue = adSet.ads.reduce((sum, ad) => sum + ad.revenue, 0)
          adSet.roas = adSet.spend > 0 ? adSet.revenue / adSet.spend : 0
        })

        campaign.spend = campaign.adSets.reduce((sum, as) => sum + as.spend, 0)
        campaign.reach = campaign.adSets.reduce((sum, as) => sum + as.reach, 0)
        campaign.clicks = campaign.adSets.reduce((sum, as) => sum + as.clicks, 0)
        campaign.cpc = campaign.clicks > 0 ? campaign.spend / campaign.clicks : null
        campaign.visitors = campaign.adSets.reduce((sum, as) => sum + as.visitors, 0)
        campaign.cpv = campaign.visitors > 0 ? campaign.spend / campaign.visitors : null
        campaign.leads = campaign.adSets.reduce((sum, as) => sum + as.leads, 0)
        campaign.cpl = campaign.leads > 0 ? campaign.spend / campaign.leads : null
        campaign.appointments = campaign.adSets.reduce((sum, as) => sum + as.appointments, 0)
        campaign.sales = campaign.adSets.reduce((sum, as) => sum + as.sales, 0)
        campaign.cac = campaign.sales > 0 ? campaign.spend / campaign.sales : null
        campaign.revenue = campaign.adSets.reduce((sum, as) => sum + as.revenue, 0)
        campaign.roas = campaign.spend > 0 ? campaign.revenue / campaign.spend : 0
      })

      console.log(`[Campaigns] Encontradas ${campaigns.length} campañas`);
      return campaigns

    } catch (error) {
      console.error('[Campaigns] Error al obtener jerarquía:', error)
      throw error
    }
  }

  async getMetrics(startDate, endDate) {
    try {
      console.log('[Campaigns] Obteniendo métricas en modo single-tenant');

      const result = await databasePool.query(
        `SELECT
           COALESCE(SUM(spend), 0) AS total_spend,
           COALESCE(SUM(reach), 0) AS total_reach,
           COALESCE(SUM(clicks), 0) AS total_clicks
         FROM meta.meta_ads
         WHERE date >= $1 AND date <= $2
        `,
        [startDate, endDate]
      )

      const salesResult = await databasePool.query(
        `SELECT COUNT(DISTINCT c.contact_id) AS total_leads,
               COUNT(DISTINCT p.id) AS total_sales,
               COALESCE(SUM(p.amount), 0) AS total_revenue
         FROM contacts c
         LEFT JOIN payments p ON p.contact_id = c.contact_id AND p.status = 'completed'
         WHERE c.attribution_ad_id IS NOT NULL
           AND c.created_at >= $1
           AND c.created_at <= $2
           AND EXISTS (
             SELECT 1 FROM meta.meta_ads ma
             WHERE ma.ad_id = c.attribution_ad_id
               AND ma.date::date >= (c.created_at::date - INTERVAL '3 days')
               AND ma.date::date <= c.created_at::date
           )
        `,
        [startDate, endDate]
      )

      const metrics = {
        ...result.rows[0],
        ...salesResult.rows[0],
        total_spend: parseFloat(result.rows[0].total_spend),
        total_revenue: parseFloat(salesResult.rows[0].total_revenue),
        roas: parseFloat(result.rows[0].total_spend) > 0
          ? parseFloat(salesResult.rows[0].total_revenue) / parseFloat(result.rows[0].total_spend)
          : 0
      }

      console.log('[Campaigns] Métricas calculadas:', metrics);
      return metrics
    } catch (error) {
      console.error('[Campaigns] Error al obtener métricas:', error)
      throw error
    }
  }

  async getHistoricalData(startDate, endDate) {
    try {
      // Generar datos diarios para el gráfico
      const query = `
        WITH daily_data AS (
          SELECT
            date::date as day,
            COALESCE(SUM(reach), 0) as reach,
            COALESCE(SUM(clicks), 0) as clicks,
            COALESCE(SUM(spend), 0) as spend
          FROM meta.meta_ads
          WHERE date >= $1::date
            AND date <= $2::date
          GROUP BY date::date
        ),
        daily_revenue AS (
          SELECT
            c.created_at::date as day,
            COALESCE(SUM(p.amount), 0) as revenue
          FROM contacts c
          JOIN payments p ON p.contact_id = c.contact_id
          WHERE c.attribution_ad_id IS NOT NULL
            AND p.status = 'completed'
            AND c.created_at >= $1::date
            AND c.created_at <= $2::date
          GROUP BY c.created_at::date
        ),
        all_days AS (
          SELECT generate_series($1::date, $2::date, '1 day'::interval)::date as day
        )
        SELECT
          d.day,
          COALESCE(dd.reach, 0) as reach,
          COALESCE(dd.clicks, 0) as clicks,
          COALESCE(dd.spend, 0) as spend,
          COALESCE(dr.revenue, 0) as revenue
        FROM all_days d
        LEFT JOIN daily_data dd ON dd.day = d.day
        LEFT JOIN daily_revenue dr ON dr.day = d.day
        ORDER BY d.day
      `;

      const result = await databasePool.query(
        query,
        [startDate, endDate]
      );

      // Formatear datos para el gráfico
      const chartData = result.rows.map(row => ({
        date: row.day,
        reach: parseInt(row.reach),
        clicks: parseInt(row.clicks),
        spend: parseFloat(row.spend),
        revenue: parseFloat(row.revenue),
        roas: parseFloat(row.spend) > 0 ? parseFloat(row.revenue) / parseFloat(row.spend) : 0
      }));

      return chartData;
    } catch (error) {
      console.error('[Campaigns] Error al obtener datos históricos:', error);
      throw error;
    }
  }
}

module.exports = new CampaignsService();
