const { databasePool } = require('../config/database.config');
const { checkMetaAdsTableExists } = require('../utils/meta-helper');
const { adjustDateRange } = require('../utils/date-helper');
const { getGeoFromIP } = require('../utils/geo-helper');

const META_SOURCE_KEYWORDS = [
  'facebook',
  'facebook_paid',
  'facebook ads',
  'facebook_ads',
  'facebookpaid',
  'fb_ad',
  'fbads',
  'fb ads',
  'fb_paid',
  'meta',
  'meta_ads',
  'meta ads',
  'meta paid'
];

const META_SOURCE_PATTERNS = META_SOURCE_KEYWORDS.map(keyword => `%${keyword}%`);

class CampaignsService {
  async getCampaignsMetrics(startDate, endDate) {
    try {
      // Ajustar fechas para incluir todo el día
      const adjusted = adjustDateRange(startDate, endDate);
      startDate = adjusted.startDate;
      endDate = adjusted.endDate;
      const hasAdsTable = await checkMetaAdsTableExists();

      if (!hasAdsTable) {
        console.log('[CAMPAIGNS] No Meta ads synced, returning zero metrics');
        return {
          revenue: 0,
          spend: 0,
          roas: 0,
          sales: 0,
          leads: 0,
          clicks: 0,
          reach: 0,
          trends: {
            revenue: 0,
            spend: 0,
            roas: 0,
            sales: 0,
            leads: 0,
            clicks: 0,
            reach: 0
          }
        };
      }

      const dayMs = 24 * 60 * 60 * 1000;
      const normalizedStart = new Date(startDate);
      const normalizedEnd = new Date(endDate);
      const diffMs = Math.max(0, normalizedEnd - normalizedStart);
      const periodLength = Math.max(1, Math.round(diffMs / dayMs) + 1);

      const previousEndDate = new Date(normalizedStart);
      previousEndDate.setDate(previousEndDate.getDate() - 1);
      const previousStartDate = new Date(previousEndDate);
      previousStartDate.setDate(previousStartDate.getDate() - periodLength + 1);

      const metaQuery = `
        SELECT
          COALESCE(SUM(spend), 0) AS total_spend,
          COALESCE(SUM(clicks), 0) AS total_clicks,
          COALESCE(SUM(reach), 0) AS total_reach
        FROM meta.meta_ads
        WHERE date >= $1 AND date <= $2
      `;

      // NUEVA LÓGICA CON TRACKING.SESSIONS + FALLBACK para leads
      const leadsQuery = `
        WITH session_attribution AS (
          -- Para cada contacto con visitor_id, buscar su última sesión antes de convertir
          SELECT DISTINCT ON (c.contact_id)
            c.contact_id
          FROM contacts c
          INNER JOIN tracking.sessions s ON s.visitor_id = c.visitor_id
          WHERE c.visitor_id IS NOT NULL
            AND c.created_at >= $1 AND c.created_at <= $2
            AND s.started_at < c.created_at  -- Sesión ANTES de convertir
            AND s.ad_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM meta.meta_ads ma
              WHERE ma.ad_id = s.ad_id
            )
            AND (
              LOWER(COALESCE(s.channel, '')) LIKE ANY($3::text[])
              OR LOWER(COALESCE(s.source_platform, '')) LIKE ANY($3::text[])
              OR LOWER(COALESCE(s.utm_source, '')) LIKE ANY($3::text[])
            )
          ORDER BY c.contact_id, s.started_at DESC  -- Última sesión por contacto
        ),
        fallback_attribution AS (
          -- Fallback: usar attribution_ad_id para contactos sin sesiones o visitor_id
          SELECT
            c.contact_id
          FROM contacts c
          WHERE c.rstk_adid IS NOT NULL
            AND c.rstk_source IS NOT NULL
            AND LOWER(c.rstk_source) IN (
              'fb_ad', 'fb_ads', 'facebook_ad', 'facebook_ads', 'facebook_paid',
              'fb_paid', 'facebook', 'fb', 'meta_ad', 'meta_ads', 'meta_paid',
              'instagram_ad', 'instagram_ads', 'ig_ad', 'ig_ads', 'ig_paid'
            )
            AND c.created_at >= $1 AND c.created_at <= $2
            AND NOT EXISTS (
              SELECT 1 FROM session_attribution sa
              WHERE sa.contact_id = c.contact_id
            )
            AND EXISTS (
              SELECT 1 FROM meta.meta_ads ma
              WHERE ma.ad_id = c.rstk_adid
                AND (
                  ma.date::date = c.created_at::date
                  OR (
                    ma.date::date >= (c.created_at::date - INTERVAL '3 days')
                    AND ma.date::date <= c.created_at::date
                  )
                )
            )
        )
        SELECT COUNT(*) AS leads
        FROM (
          SELECT contact_id FROM session_attribution
          UNION ALL
          SELECT contact_id FROM fallback_attribution
        ) all_attributions
      `;

      // NUEVA LÓGICA CON TRACKING.SESSIONS + FALLBACK para sales
      const salesQuery = `
        WITH session_attribution AS (
          -- Para cada contacto con pagos y visitor_id, buscar su última sesión antes de convertir
          SELECT DISTINCT ON (c.contact_id)
            c.contact_id
          FROM contacts c
          INNER JOIN tracking.sessions s ON s.visitor_id = c.visitor_id
          WHERE c.visitor_id IS NOT NULL
            AND c.created_at >= $1 AND c.created_at <= $2
            AND s.started_at < c.created_at  -- Sesión ANTES del created_at
            AND s.ad_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM payments p
              WHERE p.contact_id = c.contact_id
              AND p.status = 'completed'
            )
            AND EXISTS (
              SELECT 1 FROM meta.meta_ads ma
              WHERE ma.ad_id = s.ad_id
            )
            AND (
              LOWER(COALESCE(s.channel, '')) LIKE ANY($3::text[])
              OR LOWER(COALESCE(s.source_platform, '')) LIKE ANY($3::text[])
              OR LOWER(COALESCE(s.utm_source, '')) LIKE ANY($3::text[])
            )
          ORDER BY c.contact_id, s.started_at DESC  -- Última sesión por contacto
        ),
        fallback_attribution AS (
          -- Fallback: usar attribution_ad_id para contactos sin sesiones o visitor_id
          SELECT
            c.contact_id
          FROM contacts c
          WHERE c.rstk_adid IS NOT NULL
            AND c.rstk_source IS NOT NULL
            AND LOWER(c.rstk_source) IN (
              'fb_ad', 'fb_ads', 'facebook_ad', 'facebook_ads', 'facebook_paid',
              'fb_paid', 'facebook', 'fb', 'meta_ad', 'meta_ads', 'meta_paid',
              'instagram_ad', 'instagram_ads', 'ig_ad', 'ig_ads', 'ig_paid'
            )
            AND c.created_at >= $1 AND c.created_at <= $2
            AND EXISTS (
              SELECT 1 FROM payments p
              WHERE p.contact_id = c.contact_id
              AND p.status = 'completed'
            )
            AND NOT EXISTS (
              SELECT 1 FROM session_attribution sa
              WHERE sa.contact_id = c.contact_id
            )
            AND EXISTS (
              SELECT 1 FROM meta.meta_ads ma
              WHERE ma.ad_id = c.rstk_adid
                AND (
                  ma.date::date = c.created_at::date
                  OR (
                    ma.date::date >= (c.created_at::date - INTERVAL '3 days')
                    AND ma.date::date <= c.created_at::date
                  )
                )
            )
        ),
        all_attributions AS (
          -- Combinar ambas fuentes
          SELECT contact_id FROM session_attribution
          UNION ALL
          SELECT contact_id FROM fallback_attribution
        ),
        -- Obtener los montos de pagos para los contactos atribuidos
        attributed_sales AS (
          SELECT
            aa.contact_id,
            COALESCE(SUM(p.amount), 0) AS revenue
          FROM all_attributions aa
          INNER JOIN payments p ON p.contact_id = aa.contact_id
          WHERE p.status = 'completed'
          GROUP BY aa.contact_id
        )
        SELECT
          COUNT(DISTINCT contact_id) AS sales,
          COALESCE(SUM(revenue), 0) AS revenue
        FROM attributed_sales
      `;

      const [
        currentMetaRes,
        previousMetaRes,
        currentLeadsRes,
        previousLeadsRes,
        currentSalesRes,
        previousSalesRes
      ] = await Promise.all([
        databasePool.query(metaQuery, [normalizedStart, normalizedEnd]),
        databasePool.query(metaQuery, [previousStartDate, previousEndDate]),
        databasePool.query(leadsQuery, [normalizedStart, normalizedEnd, META_SOURCE_PATTERNS]),
        databasePool.query(leadsQuery, [previousStartDate, previousEndDate, META_SOURCE_PATTERNS]),
        databasePool.query(salesQuery, [normalizedStart, normalizedEnd, META_SOURCE_PATTERNS]),
        databasePool.query(salesQuery, [previousStartDate, previousEndDate, META_SOURCE_PATTERNS])
      ]);

      const currentMeta = currentMetaRes.rows[0] || {};
      const previousMeta = previousMetaRes.rows[0] || {};
      const currentLeads = parseInt(currentLeadsRes.rows[0]?.leads, 10) || 0;
      const previousLeads = parseInt(previousLeadsRes.rows[0]?.leads, 10) || 0;
      const currentSalesRow = currentSalesRes.rows[0] || {};
      const previousSalesRow = previousSalesRes.rows[0] || {};

      const currentSpend = parseFloat(currentMeta.total_spend) || 0;
      const previousSpend = parseFloat(previousMeta.total_spend) || 0;
      const currentClicks = parseInt(currentMeta.total_clicks, 10) || 0;
      const previousClicks = parseInt(previousMeta.total_clicks, 10) || 0;
      const currentReach = parseInt(currentMeta.total_reach, 10) || 0;
      const previousReach = parseInt(previousMeta.total_reach, 10) || 0;
      const currentRevenue = parseFloat(currentSalesRow.revenue) || 0;
      const previousRevenue = parseFloat(previousSalesRow.revenue) || 0;
      const currentSales = parseInt(currentSalesRow.sales, 10) || 0;
      const previousSales = parseInt(previousSalesRow.sales, 10) || 0;

      const currentRoas = currentSpend > 0 ? currentRevenue / currentSpend : 0;
      const previousRoas = previousSpend > 0 ? previousRevenue / previousSpend : 0;

      const calculateChange = (currentValue, previousValue) => {
        if (previousValue === 0) {
          return currentValue > 0 ? 100 : 0;
        }
        return ((currentValue - previousValue) / Math.abs(previousValue)) * 100;
      };

      return {
        revenue: currentRevenue,
        spend: currentSpend,
        roas: currentRoas,
        sales: currentSales,
        leads: currentLeads,
        clicks: currentClicks,
        reach: currentReach,
        trends: {
          revenue: calculateChange(currentRevenue, previousRevenue),
          spend: calculateChange(currentSpend, previousSpend),
          roas: calculateChange(currentRoas, previousRoas),
          sales: calculateChange(currentSales, previousSales),
          leads: calculateChange(currentLeads, previousLeads),
          clicks: calculateChange(currentClicks, previousClicks),
          reach: calculateChange(currentReach, previousReach)
        }
      };
    } catch (error) {
      console.error('Error fetching campaigns metrics:', error);
      throw error;
    }
  }

  async getHierarchy(startDate, endDate) {
    try {
      // Ajustar fechas para incluir todo el día
      const adjusted = adjustDateRange(startDate, endDate);
      startDate = adjusted.startDate;
      endDate = adjusted.endDate;
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

      // 2) Visitors from tracking sessions - SOLO DE FACEBOOK/META
      // IMPORTANTE: Contamos visitantes ÚNICOS por día (si alguien visita lunes Y martes, cuenta como 2)
      const visitorsRes = await databasePool.query(
        `WITH filtered_sessions AS (
           SELECT
             ad_id,
             visitor_id,
             DATE_TRUNC('day', started_at)::date AS visit_date
           FROM tracking.sessions
           WHERE ad_id IS NOT NULL
             AND visitor_id IS NOT NULL
             AND started_at >= $1
             AND started_at <= $2
             AND (
               LOWER(COALESCE(channel, '')) LIKE ANY($3::text[])
               OR LOWER(COALESCE(source_platform, '')) LIKE ANY($3::text[])
               OR LOWER(COALESCE(utm_source, '')) LIKE ANY($3::text[])
             )
         )
         SELECT ad_id,
                COUNT(DISTINCT (visitor_id, visit_date)) AS visitors
         FROM filtered_sessions
         GROUP BY ad_id
        `,
        [startDate, endDate, META_SOURCE_PATTERNS]
      )

      // 3) Leads from contacts - NUEVA LÓGICA CON TRACKING.SESSIONS + FALLBACK
      // Primero intentamos con tracking.sessions, si no hay datos usamos attribution_ad_id
      const leadsRes = await databasePool.query(
        `WITH session_attribution AS (
           -- Para cada contacto con visitor_id, buscar su última sesión antes de convertir
           SELECT DISTINCT ON (c.contact_id)
             c.contact_id,
             s.ad_id
           FROM contacts c
           INNER JOIN tracking.sessions s ON s.visitor_id = c.visitor_id
           WHERE c.visitor_id IS NOT NULL
             AND c.created_at >= $1
             AND c.created_at <= $2
             AND s.started_at < c.created_at  -- Sesión ANTES de convertir
             AND s.ad_id IS NOT NULL
             AND (
               LOWER(COALESCE(s.channel, '')) LIKE ANY($3::text[])
               OR LOWER(COALESCE(s.source_platform, '')) LIKE ANY($3::text[])
               OR LOWER(COALESCE(s.utm_source, '')) LIKE ANY($3::text[])
             )
           ORDER BY c.contact_id, s.started_at DESC  -- Última sesión por contacto
         ),
         fallback_attribution AS (
           -- Fallback: usar attribution_ad_id para contactos sin sesiones o visitor_id
           SELECT
             c.contact_id,
             c.rstk_adid AS ad_id
           FROM contacts c
           WHERE c.rstk_adid IS NOT NULL
            AND c.rstk_source IS NOT NULL
            AND LOWER(c.rstk_source) IN (
              'fb_ad', 'fb_ads', 'facebook_ad', 'facebook_ads', 'facebook_paid',
              'fb_paid', 'facebook', 'fb', 'meta_ad', 'meta_ads', 'meta_paid',
              'instagram_ad', 'instagram_ads', 'ig_ad', 'ig_ads', 'ig_paid'
            )
             AND c.created_at >= $1
             AND c.created_at <= $2
             AND NOT EXISTS (
               SELECT 1 FROM session_attribution sa
               WHERE sa.contact_id = c.contact_id
             )
         ),
         all_attributions AS (
           -- Combinar ambas fuentes
           SELECT ad_id FROM session_attribution
           UNION ALL
           SELECT ad_id FROM fallback_attribution
         )
         SELECT
           aa.ad_id,
           COUNT(*) AS leads
         FROM all_attributions aa
         WHERE EXISTS (
           SELECT 1 FROM meta.meta_ads ma
           WHERE ma.ad_id = aa.ad_id
         )
         GROUP BY aa.ad_id
        `,
        [startDate, endDate, META_SOURCE_PATTERNS]
      )

      // 4) Appointments - NUEVA LÓGICA CON TRACKING.SESSIONS + FALLBACK
      // Basamos la atribución en contacts.created_at, no en cuando se agendó la cita
      const apptsRes = await databasePool.query(
        `WITH session_attribution AS (
           -- Para cada contacto con citas y visitor_id, buscar su última sesión antes de convertir
           SELECT DISTINCT ON (c.contact_id)
             c.contact_id,
             s.ad_id
           FROM appointments a
           INNER JOIN contacts c ON a.contact_id = c.contact_id
           INNER JOIN tracking.sessions s ON s.visitor_id = c.visitor_id
           WHERE c.visitor_id IS NOT NULL
             AND c.created_at >= $1
             AND c.created_at <= $2
             AND s.started_at < c.created_at  -- Sesión ANTES del created_at del contacto
             AND s.ad_id IS NOT NULL
             AND (
               LOWER(COALESCE(s.channel, '')) LIKE ANY($3::text[])
               OR LOWER(COALESCE(s.source_platform, '')) LIKE ANY($3::text[])
               OR LOWER(COALESCE(s.utm_source, '')) LIKE ANY($3::text[])
             )
           ORDER BY c.contact_id, s.started_at DESC  -- Última sesión por contacto
         ),
         fallback_attribution AS (
           -- Fallback: usar attribution_ad_id para contactos sin sesiones o visitor_id
           SELECT
             c.contact_id,
             c.rstk_adid AS ad_id
           FROM appointments a
           INNER JOIN contacts c ON a.contact_id = c.contact_id
           WHERE c.rstk_adid IS NOT NULL
            AND c.rstk_source IS NOT NULL
            AND LOWER(c.rstk_source) IN (
              'fb_ad', 'fb_ads', 'facebook_ad', 'facebook_ads', 'facebook_paid',
              'fb_paid', 'facebook', 'fb', 'meta_ad', 'meta_ads', 'meta_paid',
              'instagram_ad', 'instagram_ads', 'ig_ad', 'ig_ads', 'ig_paid'
            )
             AND c.created_at >= $1
             AND c.created_at <= $2
             AND NOT EXISTS (
               SELECT 1 FROM session_attribution sa
               WHERE sa.contact_id = c.contact_id
             )
         ),
         all_attributions AS (
           -- Combinar ambas fuentes
           SELECT contact_id, ad_id FROM session_attribution
           UNION ALL
           SELECT contact_id, ad_id FROM fallback_attribution
         )
         SELECT
           aa.ad_id,
           COUNT(DISTINCT aa.contact_id) AS appointments
         FROM all_attributions aa
         WHERE EXISTS (
           SELECT 1 FROM meta.meta_ads ma
           WHERE ma.ad_id = aa.ad_id
         )
         GROUP BY aa.ad_id
        `,
        [startDate, endDate, META_SOURCE_PATTERNS]
      )

      // 5) Sales/Revenue - NUEVA LÓGICA CON TRACKING.SESSIONS + FALLBACK
      // Basamos la atribución en contacts.created_at, no en payments.paid_at
      const salesRes = await databasePool.query(
        `WITH session_attribution AS (
           -- Para cada contacto con pagos y visitor_id, buscar su última sesión antes de convertir
           SELECT DISTINCT ON (c.contact_id)
             c.contact_id,
             s.ad_id
           FROM contacts c
           INNER JOIN tracking.sessions s ON s.visitor_id = c.visitor_id
           WHERE c.visitor_id IS NOT NULL
             AND c.created_at >= $1
             AND c.created_at <= $2
             AND s.started_at < c.created_at  -- Sesión ANTES del created_at del contacto
             AND s.ad_id IS NOT NULL
             AND EXISTS (
               SELECT 1 FROM payments p
               WHERE p.contact_id = c.contact_id
               AND p.status = 'completed'
             )
             AND (
               LOWER(COALESCE(s.channel, '')) LIKE ANY($3::text[])
               OR LOWER(COALESCE(s.source_platform, '')) LIKE ANY($3::text[])
               OR LOWER(COALESCE(s.utm_source, '')) LIKE ANY($3::text[])
             )
           ORDER BY c.contact_id, s.started_at DESC  -- Última sesión por contacto
         ),
         fallback_attribution AS (
           -- Fallback: usar attribution_ad_id para contactos sin sesiones o visitor_id
           SELECT
             c.contact_id,
             c.rstk_adid AS ad_id
           FROM contacts c
           WHERE c.rstk_adid IS NOT NULL
            AND c.rstk_source IS NOT NULL
            AND LOWER(c.rstk_source) IN (
              'fb_ad', 'fb_ads', 'facebook_ad', 'facebook_ads', 'facebook_paid',
              'fb_paid', 'facebook', 'fb', 'meta_ad', 'meta_ads', 'meta_paid',
              'instagram_ad', 'instagram_ads', 'ig_ad', 'ig_ads', 'ig_paid'
            )
             AND c.created_at >= $1
             AND c.created_at <= $2
             AND EXISTS (
               SELECT 1 FROM payments p
               WHERE p.contact_id = c.contact_id
               AND p.status = 'completed'
             )
             AND NOT EXISTS (
               SELECT 1 FROM session_attribution sa
               WHERE sa.contact_id = c.contact_id
             )
         ),
         all_attributions AS (
           -- Combinar ambas fuentes
           SELECT contact_id, ad_id FROM session_attribution
           UNION ALL
           SELECT contact_id, ad_id FROM fallback_attribution
         ),
         -- Obtener los montos de pagos para los contactos atribuidos
         attributed_sales AS (
           SELECT
             aa.ad_id,
             aa.contact_id,
             COALESCE(SUM(p.amount), 0) AS revenue
           FROM all_attributions aa
           INNER JOIN payments p ON p.contact_id = aa.contact_id
           WHERE p.status = 'completed'
           GROUP BY aa.ad_id, aa.contact_id
         )
         SELECT
           ads.ad_id,
           COUNT(DISTINCT ads.contact_id) AS sales,
           COALESCE(SUM(ads.revenue), 0) AS revenue
         FROM attributed_sales ads
         WHERE EXISTS (
           SELECT 1 FROM meta.meta_ads ma
           WHERE ma.ad_id = ads.ad_id
         )
         GROUP BY ads.ad_id
        `,
        [startDate, endDate, META_SOURCE_PATTERNS]
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
          roas: parseFloat(spend) > 0 ? salesData.revenue / parseFloat(spend) : 0,
          // Tasas de conversión calculadas
          webToLeadsRate: visitors > 0 ? (leads / visitors) * 100 : 0,
          leadsToApptsRate: leads > 0 ? (appointments / leads) * 100 : 0,
          apptsToSalesRate: appointments > 0 ? (salesData.sales / appointments) * 100 : 0
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
          // Tasas de conversión para AdSet
          adSet.webToLeadsRate = adSet.visitors > 0 ? (adSet.leads / adSet.visitors) * 100 : 0
          adSet.leadsToApptsRate = adSet.leads > 0 ? (adSet.appointments / adSet.leads) * 100 : 0
          adSet.apptsToSalesRate = adSet.appointments > 0 ? (adSet.sales / adSet.appointments) * 100 : 0
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
        // Tasas de conversión para Campaign
        campaign.webToLeadsRate = campaign.visitors > 0 ? (campaign.leads / campaign.visitors) * 100 : 0
        campaign.leadsToApptsRate = campaign.leads > 0 ? (campaign.appointments / campaign.leads) * 100 : 0
        campaign.apptsToSalesRate = campaign.appointments > 0 ? (campaign.sales / campaign.appointments) * 100 : 0
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
      // Ajustar fechas para incluir todo el día
      const adjusted = adjustDateRange(startDate, endDate);
      startDate = adjusted.startDate;
      endDate = adjusted.endDate;
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
         WHERE c.rstk_adid IS NOT NULL
            AND c.rstk_source IS NOT NULL
            AND LOWER(c.rstk_source) IN (
              'fb_ad', 'fb_ads', 'facebook_ad', 'facebook_ads', 'facebook_paid',
              'fb_paid', 'facebook', 'fb', 'meta_ad', 'meta_ads', 'meta_paid',
              'instagram_ad', 'instagram_ads', 'ig_ad', 'ig_ads', 'ig_paid'
            )
           AND c.created_at >= $1
           AND c.created_at <= $2
           AND EXISTS (
             SELECT 1 FROM meta.meta_ads ma
             WHERE ma.ad_id = c.rstk_adid
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

  async _resolveAdIds({ adIds = [], adSetIds = [], campaignIds = [], startDate, endDate }) {
    const adIdSet = new Set()

    const addIds = ids => {
      if (!ids) return
      const collection = Array.isArray(ids) ? ids : [ids]
      collection
        .map(id => (id === undefined || id === null ? '' : String(id).trim()))
        .filter(Boolean)
        .forEach(id => adIdSet.add(id))
    }

    addIds(adIds)

    const fetchFromMeta = async (ids, column) => {
      if (!ids) return
      const list = Array.isArray(ids) ? ids : [ids]
      const cleaned = list
        .map(id => (id === undefined || id === null ? '' : String(id).trim()))
        .filter(Boolean)

      if (cleaned.length === 0) {
        return
      }

      const query = `
        SELECT DISTINCT ad_id
        FROM meta.meta_ads
        WHERE ${column} = ANY($1::text[])
          AND ad_id IS NOT NULL
      `

      const params = [cleaned]
      const result = await databasePool.query(query, params)
      for (const row of result.rows) {
        if (row?.ad_id) {
          adIdSet.add(String(row.ad_id).trim())
        }
      }
    }

    await Promise.all([
      fetchFromMeta(adSetIds, 'adset_id'),
      fetchFromMeta(campaignIds, 'campaign_id')
    ])

    const resolved = Array.from(adIdSet)

    console.log('[Campaigns] _resolveAdIds', {
      inputAdIds: Array.isArray(adIds) ? adIds : [adIds],
      adSetIds,
      campaignIds,
      startDate,
      endDate,
      resolved
    })

    return resolved
  }

  // IMPORTANTE: MODELO DE LAST ATTRIBUTION
  // Los contactos se atribuyen a la campaña/ad cuando se CREAN (c.created_at)
  // NO cuando hacen una acción posterior (pago, cita, etc)
  // Esto significa que un contacto creado en enero y que paga en septiembre
  // se atribuye a las métricas de ENERO, no de septiembre
  async getContactsByHierarchy({
    adIds = [],
    adSetIds = [],
    campaignIds = [],
    startDate,
    endDate,
    type = 'leads'
  }) {
    try {
      const resolvedAdIds = await this._resolveAdIds({
        adIds,
        adSetIds,
        campaignIds,
        startDate,
        endDate
      });

      console.log('[Campaigns] getContactsByHierarchy input', {
        rawAdIds: Array.isArray(adIds) ? adIds : [adIds],
        resolvedAdIds,
        startDate,
        endDate,
        type
      });

      if (resolvedAdIds.length === 0) {
        console.log('[Campaigns] getContactsByHierarchy sin ad_ids resueltos');
        return [];
      }

      const allowedTypes = new Set(['leads', 'appointments', 'sales']);
      const normalizedType = allowedTypes.has(type) ? type : 'leads';

      const normalizedAdSetIds = (Array.isArray(adSetIds) ? adSetIds : [])
        .map(id => (id === undefined || id === null ? '' : String(id).trim()))
        .filter(Boolean);
      const normalizedCampaignIds = (Array.isArray(campaignIds) ? campaignIds : [])
        .map(id => (id === undefined || id === null ? '' : String(id).trim()))
        .filter(Boolean);

      const targetConditions = [];
      const queryParams = [];
      let paramIndex = 1;

      if (resolvedAdIds.length > 0) {
        targetConditions.push(`ma.ad_id = ANY($${paramIndex}::text[])`);
        queryParams.push(resolvedAdIds);
        paramIndex += 1;
      }

      if (normalizedAdSetIds.length > 0) {
        targetConditions.push(`ma.adset_id = ANY($${paramIndex}::text[])`);
        queryParams.push(normalizedAdSetIds);
        paramIndex += 1;
      }

      if (normalizedCampaignIds.length > 0) {
        targetConditions.push(`ma.campaign_id = ANY($${paramIndex}::text[])`);
        queryParams.push(normalizedCampaignIds);
        paramIndex += 1;
      }

      if (targetConditions.length === 0) {
        console.warn('[Campaigns] getContactsByHierarchy sin condiciones de jerarquía');
        return [];
      }

      // Para sales: usar EXISTS para no duplicar contactos
      // Para appointments: igual con EXISTS
      const typeFilterForScope = normalizedType === 'sales'
        ? `AND EXISTS (SELECT 1 FROM payments p WHERE p.contact_id = c.contact_id AND p.status = 'completed')`
        : normalizedType === 'appointments'
          ? `AND EXISTS (SELECT 1 FROM appointments a WHERE a.contact_id = c.contact_id)`
          : '';

      const scopedContactsQuery = `
        WITH scoped AS (
          SELECT DISTINCT c.contact_id
          FROM contacts c
          JOIN meta.meta_ads ma ON ma.ad_id = c.rstk_adid
          WHERE c.rstk_adid IS NOT NULL
            AND c.rstk_source IS NOT NULL
            AND LOWER(c.rstk_source) IN (
              'fb_ad', 'fb_ads', 'facebook_ad', 'facebook_ads', 'facebook_paid',
              'fb_paid', 'facebook', 'fb', 'meta_ad', 'meta_ads', 'meta_paid',
              'instagram_ad', 'instagram_ads', 'ig_ad', 'ig_ads', 'ig_paid'
            )
            -- Filtrar por fecha de creación del contacto
            AND c.created_at >= $${paramIndex}
            AND c.created_at <= $${paramIndex + 1}
            AND (
              ${targetConditions.join('\n              OR ')}
            )
            -- Validar que había una campaña activa cuando se creó el contacto
            AND EXISTS (
              SELECT 1 FROM meta.meta_ads ma2
              WHERE ma2.ad_id = c.rstk_adid
              AND ma2.date::date BETWEEN (c.created_at::date - INTERVAL '3 days') AND c.created_at::date
            )
            ${typeFilterForScope}
        )
        SELECT
          c.contact_id,
          c.first_name,
          c.last_name,
          c.email,
          c.phone,
          c.company,
          c.rstk_adid,
          c.ext_crm_id,
          c.status,
          c.source,
          c.created_at,
          c.updated_at,
          COALESCE(appt_data.appointments, 0) AS appointment_count,
          COALESCE(payment_data.payments, 0) AS payment_count,
          COALESCE(payment_data.ltv, 0) AS ltv
        FROM contacts c
        JOIN scoped s ON s.contact_id = c.contact_id
        LEFT JOIN LATERAL (
          SELECT COUNT(*) AS appointments
          FROM appointments a
          WHERE a.contact_id = c.contact_id
        ) AS appt_data ON true
        LEFT JOIN LATERAL (
          SELECT COUNT(*) AS payments,
                 COALESCE(SUM(p.amount), 0) AS ltv
          FROM payments p
          WHERE p.contact_id = c.contact_id
            AND p.status = 'completed'
        ) AS payment_data ON true
        ORDER BY c.created_at DESC
      `;

      queryParams.push(startDate, endDate);

      const result = await databasePool.query(scopedContactsQuery, queryParams);

      console.log('[Campaigns] getContactsByHierarchy resultados', {
        count: result.rowCount
      });

      return result.rows.map(row => {
        const appointmentCount = parseInt(row.appointment_count, 10) || 0;
        const paymentCount = parseInt(row.payment_count, 10) || 0;
        const ltv = parseFloat(row.ltv) || 0;

        const firstName = row.first_name || '';
        const lastName = row.last_name || '';
        const fullName = `${firstName} ${lastName}`.trim();

        // Un contacto es cliente si tiene al menos 1 pago completado (LTV > 0)
        const isClient = paymentCount > 0 && ltv > 0;

        return {
          id: row.contact_id,
          name: fullName || 'Sin nombre',
          email: row.email,
          phone: row.phone,
          company: row.company,
          attributionAdId: row.rstk_adid,
          ghlId: row.ext_crm_id,
          status: isClient ? 'client' : appointmentCount > 0 ? 'appointment' : 'lead',
          source: row.source || 'Direct',
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          appointments: appointmentCount,
          payments: paymentCount,
          ltv
        }
      });
    } catch (error) {
      console.error('[Campaigns] Error fetching contacts by hierarchy:', error)
      throw error
    }
  }

  async getHistoricalData(startDate, endDate) {
    try {
      // Ajustar fechas para incluir todo el día
      const adjusted = adjustDateRange(startDate, endDate);
      startDate = adjusted.startDate;
      endDate = adjusted.endDate;
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
          WHERE c.rstk_adid IS NOT NULL
            AND c.rstk_source IS NOT NULL
            AND LOWER(c.rstk_source) IN (
              'fb_ad', 'fb_ads', 'facebook_ad', 'facebook_ads', 'facebook_paid',
              'fb_paid', 'facebook', 'fb', 'meta_ad', 'meta_ads', 'meta_paid',
              'instagram_ad', 'instagram_ads', 'ig_ad', 'ig_ads', 'ig_paid'
            )
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

  async getVisitorsByHierarchy({
    adIds = [],
    adSetIds = [],
    campaignIds = [],
    startDate,
    endDate
  }) {
    try {
      const resolvedAdIds = await this._resolveAdIds({
        adIds,
        adSetIds,
        campaignIds,
        startDate,
        endDate
      });

      if (resolvedAdIds.length === 0) {
        return [];
      }

      // IMPORTANTE: Agrupamos por visitor_id, ad_id Y fecha para obtener visitantes únicos por día
      const query = `
        WITH filtered_sessions AS (
          SELECT
            s.visitor_id,
            s.ad_id,
            DATE_TRUNC('day', s.started_at)::date AS visit_date,
            MIN(s.started_at) AS first_visit,
            MAX(s.started_at) AS last_visit,
            COUNT(*) AS session_count,
            MAX(s.channel) AS channel,
            MAX(s.source_platform) AS source_platform,
            MAX(s.utm_source) AS utm_source,
            MAX(s.utm_medium) AS utm_medium,
            MAX(s.utm_campaign) AS utm_campaign,
            -- Agregamos los campos de dispositivo, ubicación e IP
            MAX(s.ip) AS ip,
            MAX(s.device_type) AS device_type,
            MAX(s.browser) AS browser,
            MAX(s.os) AS os,
            MAX(s.geo_country) AS geo_country,
            MAX(s.geo_region) AS geo_region,
            MAX(s.geo_city) AS geo_city
          FROM tracking.sessions s
          WHERE s.ad_id = ANY($1::text[])
            AND s.visitor_id IS NOT NULL
            AND s.started_at >= $2
            AND s.started_at <= $3
            AND (
              LOWER(COALESCE(s.channel, '')) LIKE ANY($4::text[])
              OR LOWER(COALESCE(s.source_platform, '')) LIKE ANY($4::text[])
              OR LOWER(COALESCE(s.utm_source, '')) LIKE ANY($4::text[])
            )
          GROUP BY s.visitor_id, s.ad_id, DATE_TRUNC('day', s.started_at)
        )
        SELECT
          fs.visitor_id,
          fs.ad_id,
          fs.visit_date,
          fs.first_visit,
          fs.last_visit,
          fs.session_count,
          fs.channel,
          fs.source_platform,
          fs.utm_source,
          fs.utm_medium,
          fs.utm_campaign,
          -- Agregamos los nuevos campos al SELECT principal
          fs.ip,
          fs.device_type,
          fs.browser,
          fs.os,
          fs.geo_country,
          fs.geo_region,
          fs.geo_city,
          c.contact_id,
          c.first_name,
          c.last_name,
          c.email,
          c.phone,
          c.created_at AS contact_created_at,
          COALESCE(payment_stats.total_amount, 0) AS ltv
        FROM filtered_sessions fs
        LEFT JOIN contacts c ON c.visitor_id = fs.visitor_id
        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(p.amount), 0) AS total_amount
          FROM payments p
          WHERE c.contact_id IS NOT NULL
            AND p.contact_id = c.contact_id
            AND p.status = 'completed'
        ) AS payment_stats ON true
        ORDER BY fs.first_visit DESC
      `;

      const result = await databasePool.query(query, [resolvedAdIds, startDate, endDate, META_SOURCE_PATTERNS]);

      return result.rows.map(row => {
        const sessionCount = parseInt(row.session_count, 10) || 1;
        const ltv = parseFloat(row.ltv) || 0;
        const contactName = `${row.first_name || ''} ${row.last_name || ''}`.trim();

        const contact = row.contact_id
          ? {
              id: row.contact_id,
              name: contactName || null,
              email: row.email,
              phone: row.phone,
              ltv
            }
          : null;

        return {
          visitorId: row.visitor_id,
          adId: row.ad_id,
          visitDate: row.visit_date,
          firstVisit: row.first_visit,
          lastVisit: row.last_visit,
          sessionCount,
          totalPageviews: sessionCount,
          hasContact: Boolean(row.contact_id),
          contact,
          sources: row.channel || row.source_platform || row.utm_source || 'Facebook',
          // Agregamos IP como campo directo
          ip: row.ip || null,
          // Datos del dispositivo con valores reales o por defecto agnósticos
          device: {
            type: row.device_type || 'No identificado',
            browser: row.browser || 'No identificado',
            os: row.os || 'No identificado'
          },
          // Ubicación: primero intentar con datos de BD, si no hay, usar geolocalización por IP
          location: (() => {
            // Si tenemos datos geo de la BD, usarlos
            if (row.geo_country) {
              return {
                country: row.geo_country,
                region: row.geo_region || null,
                city: row.geo_city || 'No disponible'
              };
            }
            // Si no hay datos en BD pero tenemos IP, intentar geolocalización
            if (row.ip) {
              const geoData = getGeoFromIP(row.ip);
              return {
                country: geoData.country || 'No disponible',
                region: geoData.region || null,
                city: geoData.city || 'No disponible'
              };
            }
            // Si no hay ni datos geo ni IP
            return {
              country: 'No disponible',
              region: null,
              city: 'No disponible'
            };
          })()
        };
      });
    } catch (error) {
      console.error('[Campaigns] Error fetching visitors by hierarchy:', error)
      throw error
    }
  }

  /**
   * Obtener contactos únicos por tipo de evento (leads, appointments, sales)
   * Método creado desde cero para el modal de detalles de contactos
   */
  async getUniqueContactsByType({ adIds, startDate, endDate, type }) {
    try {
      // Ajustar fechas para incluir todo el día si vienen
      if (startDate && endDate) {
        const adjusted = adjustDateRange(startDate, endDate);
        startDate = adjusted.startDate;
        endDate = adjusted.endDate;
      }
      // Verificar si existe la tabla de Meta ads
      const hasAdsTable = await checkMetaAdsTableExists();

      if (!hasAdsTable) {
        console.log('[CAMPAIGNS] No Meta ads table found, returning empty contacts');
        return [];
      }

      // LOG DEBUG: Ver qué fechas están llegando al servicio
      console.log('🔍 SERVICIO - Fechas recibidas:', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        type
      });

      // Mapeo de tipo a tabla/campo correspondiente
      let query;
      // SIMPLIFICADO: Solo pasamos las fechas, sin filtro de ad_ids por ahora
      const params = [startDate, endDate];

      switch(type) {
        case 'leads':
          // IMPORTANTE: Siempre filtrar por created_at del contacto para atribución correcta
          query = `
            SELECT DISTINCT
              c.contact_id,
              c.name,
              c.email,
              c.phone,
              c.created_at as event_date,
              c.status,
              0 as revenue,
              c.source as campaign_name,
              '' as adset_name,
              '' as ad_name,
              COALESCE(c.source, 'Direct') as source
            FROM contacts c
            WHERE
              c.created_at >= $1
              AND c.created_at <= $2
              AND c.status IN ('lead', 'appointment', 'appointment_scheduled', 'client')
            ORDER BY c.created_at DESC
            LIMIT 100
          `;
          break;

        case 'appointments':
          // IMPORTANTE: Filtrar por created_at del CONTACTO, no por fecha de cita
          query = `
            SELECT DISTINCT
              c.contact_id,
              c.name,
              c.email,
              c.phone,
              c.created_at as event_date,
              a.status as appointment_status,
              0 as revenue,
              COALESCE(c.source, 'Direct') as campaign_name,
              '' as adset_name,
              '' as ad_name,
              COALESCE(c.source, 'Direct') as source
            FROM contacts c
            INNER JOIN appointments a ON a.contact_id = c.contact_id
            WHERE
              c.created_at >= $1
              AND c.created_at <= $2
            ORDER BY c.created_at DESC
            LIMIT 100
          `;
          break;

        case 'sales':
          // IMPORTANTE: Agrupar por contacto y sumar LTV total
          // Un contacto es cliente si tiene al menos 1 pago completado
          query = `
            SELECT DISTINCT
              c.contact_id,
              c.name,
              c.email,
              c.phone,
              c.created_at as event_date,
              c.created_at as createdAt,
              'client' as status,
              COUNT(DISTINCT p.id) as payments,
              (SELECT COUNT(*) FROM appointments a WHERE a.contact_id = c.contact_id) as appointments,
              COALESCE(SUM(p.amount), 0) as ltv,
              COALESCE(SUM(p.amount), 0) as revenue,
              COALESCE(c.source, 'Direct') as campaign_name,
              '' as adset_name,
              '' as ad_name,
              COALESCE(c.source, 'Direct') as source
            FROM contacts c
            INNER JOIN payments p ON p.contact_id = c.contact_id AND p.status = 'completed'
            WHERE
              c.created_at >= $1
              AND c.created_at <= $2
            GROUP BY
              c.contact_id,
              c.name,
              c.email,
              c.phone,
              c.created_at,
              c.source
            HAVING COUNT(p.id) > 0
            ORDER BY c.created_at DESC
            LIMIT 100
          `;
          break;

        default:
          throw new Error(`Invalid contact type: ${type}`);
      }


      // Ejecutar query con los parámetros
      const result = await databasePool.query(query, params);


      // Formatear los resultados
      const contacts = result.rows.map(row => ({
        id: row.contact_id || row.payment_id || Math.random().toString(36).substring(7),
        contact_id: row.contact_id || row.payment_id,
        name: row.name || 'Sin nombre',
        email: row.email,
        phone: row.phone,
        event_date: row.event_date,
        created_at: row.event_date,
        createdAt: row.createdat || row.event_date,
        status: row.status,
        value: row.revenue || 0,
        revenue: row.revenue || 0,
        ltv: parseFloat(row.ltv) || 0,
        payments: parseInt(row.payments) || 0,
        appointments: parseInt(row.appointments) || 0,
        // Metadata adicional
        source: row.source,
        campaign_name: row.campaign_name,
        adset_name: row.adset_name,
        ad_name: row.ad_name
      }));

      console.log(`[CAMPAIGNS] Found ${contacts.length} unique ${type} for ads:`, adIds.slice(0, 3));

      return contacts;

    } catch (error) {
      console.error('[CAMPAIGNS] Error getting unique contacts by type:', error);
      throw error;
    }
  }


}

module.exports = new CampaignsService();
