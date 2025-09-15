const { databasePool } = require('../config/database.config');

class CampaignsService {
  async getHierarchy(startDate, endDate) {
    try {
      // 1) Base metrics from ads
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

      // 2) Visitors from tracking sessions
      const visitorsRes = await databasePool.query(
        `SELECT ad_id, COUNT(DISTINCT visitor_id) AS visitors
         FROM tracking_sessions
         WHERE ad_id IS NOT NULL AND ts >= $1 AND ts <= $2
         GROUP BY ad_id
        `,
        [startDate, endDate]
      )

      // 3) Leads from contacts (Last Attribution: fecha de creación del contacto)
      // 🚨🚨🚨 IMPORTANTE - SOLUCIÓN TEMPORAL 🚨🚨🚨
      // ⚠️ ACTUALMENTE: Usamos una ventana de atribución de 3 días como fallback
      // ⚠️ Esto significa que si un contacto se crea hasta 3 días después de que 
      // ⚠️ el anuncio terminó, AÚN se le atribuye al anuncio.
      // 
      // 📝 TODO: Una vez implementado el tracking con attribution_click_date:
      // 1. Cambiar la validación para usar attribution_click_date en lugar de created_at
      // 2. El click_date debe coincidir exactamente con un día activo del anuncio
      // 3. Eliminar la ventana de 3 días de gracia
      // 
      // 🎯 PROBLEMA ACTUAL:
      // - Sin tracking de clicks, solo sabemos cuándo se creó el contacto
      // - Si alguien hace click el último día del anuncio pero se registra al día siguiente,
      //   perdemos esa atribución (caso de Diego Hiram Romero Sikorski)
      // 
      // 🔧 SOLUCIÓN TEMPORAL:
      // - Ventana de atribución de 3 días después del último día activo del anuncio
      // - Esto captura conversiones tardías pero puede sobre-atribuir ligeramente
      // 🚨🚨🚨 FIN DE NOTA IMPORTANTE 🚨🚨🚨
      const leadsRes = await databasePool.query(
        `SELECT c.attribution_ad_id AS ad_id, COUNT(*) AS leads
         FROM contacts c
         WHERE c.attribution_ad_id IS NOT NULL 
           AND c.created_at >= $1 
           AND c.created_at <= $2
           -- Validar que el anuncio estaba activo cuando se creó el contacto
           -- O dentro de una ventana de 3 días después de que terminó (attribution window)
           AND EXISTS (
             SELECT 1 FROM meta.meta_ads ma
             WHERE ma.ad_id = c.attribution_ad_id
               AND (
                 ma.date::date = c.created_at::date
                 OR (
                   -- Ventana de atribución: 3 días después del último día activo
                   ma.date::date >= (c.created_at::date - INTERVAL '3 days')
                   AND ma.date::date <= c.created_at::date
                 )
               )
           )
         GROUP BY c.attribution_ad_id
        `,
        [startDate, endDate]
      )

      // 4) Appointments linked to contacts (Last Attribution: fecha de creación del contacto)
      // 🚨 NOTA: Aplicamos la misma ventana de atribución de 3 días
      const apptsRes = await databasePool.query(
        `SELECT c.attribution_ad_id AS ad_id, COUNT(*) AS appointments
         FROM appointments a
         JOIN contacts c ON a.contact_id = c.contact_id
         WHERE c.attribution_ad_id IS NOT NULL 
           -- Last Attribution: usar fecha de creación del contacto, no de la cita
           AND c.created_at >= $1 
           AND c.created_at <= $2
           -- Validar con ventana de atribución de 3 días
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

      // 5) Sales/Revenue from payments (Last Attribution: fecha de creación del contacto)
      // 🚨 NOTA: Aplicamos la misma ventana de atribución de 3 días
      const salesRes = await databasePool.query(
        `SELECT c.attribution_ad_id AS ad_id,
                COUNT(DISTINCT p.id) AS sales,
                COALESCE(SUM(p.amount),0) AS revenue
         FROM contacts c
         JOIN payments p ON p.contact_id = c.contact_id
         WHERE c.attribution_ad_id IS NOT NULL
           AND p.status = 'completed'
           -- Last Attribution: usar fecha de creación del contacto, no del pago
           AND c.created_at >= $1 
           AND c.created_at <= $2
           -- Validar con ventana de atribución de 3 días
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

      const byAd = new Map()

      const ensureAd = (adId, seed = {}) => {
        if (!byAd.has(adId)) {
          byAd.set(adId, {
            adId,
            adName: seed.adName || 'Unknown Ad',
            adSetId: seed.adSetId || 'unknown',
            adSetName: seed.adSetName || 'Unknown Ad Set',
            campaignId: seed.campaignId || 'unknown',
            campaignName: seed.campaignName || 'Unknown Campaign',
            status: 'active',
            spend: 0,
            reach: 0,
            clicks: 0,
            visitors: 0,
            leads: 0,
            appointments: 0,
            sales: 0,
            revenue: 0,
          })
        }
        return byAd.get(adId)
      }

      // Seed from meta ads
      for (const row of adsRes.rows) {
        const ad = ensureAd(row.ad_id, {
          adName: row.ad_name,
          adSetId: row.adset_id,
          adSetName: row.adset_name,
          campaignId: row.campaign_id,
          campaignName: row.campaign_name,
        })
        ad.spend += parseFloat(row.spend) || 0
        ad.reach += parseInt(row.reach) || 0
        ad.clicks += parseInt(row.clicks) || 0
      }

      // Merge visitors - only for ads that exist in meta_ads
      for (const row of visitorsRes.rows) {
        if (!row.ad_id || !byAd.has(row.ad_id)) continue
        const ad = byAd.get(row.ad_id)
        ad.visitors += parseInt(row.visitors) || 0
      }

      // Merge leads - only for ads that exist in meta_ads
      for (const row of leadsRes.rows) {
        if (!row.ad_id || !byAd.has(row.ad_id)) continue
        const ad = byAd.get(row.ad_id)
        ad.leads += parseInt(row.leads) || 0
      }

      // Merge appointments - only for ads that exist in meta_ads
      for (const row of apptsRes.rows) {
        if (!row.ad_id || !byAd.has(row.ad_id)) continue
        const ad = byAd.get(row.ad_id)
        ad.appointments += parseInt(row.appointments) || 0
      }

      // Merge sales/revenue - only for ads that exist in meta_ads
      for (const row of salesRes.rows) {
        if (!row.ad_id || !byAd.has(row.ad_id)) continue
        const ad = byAd.get(row.ad_id)
        ad.sales += parseInt(row.sales) || 0
        ad.revenue += parseFloat(row.revenue) || 0
      }

      // Derive per-ad metrics
      const adsList = Array.from(byAd.values()).map(ad => ({
        ...ad,
        cpc: ad.clicks > 0 ? ad.spend / ad.clicks : 0,
        cpv: ad.visitors > 0 ? ad.spend / ad.visitors : 0,
        cpl: ad.leads > 0 ? ad.spend / ad.leads : 0,
        cac: ad.sales > 0 ? ad.spend / ad.sales : 0,
        roas: ad.spend > 0 ? ad.revenue / ad.spend : 0,
      }))

      // Aggregate into ad sets and campaigns
      const byAdSet = new Map()
      for (const ad of adsList) {
        const key = ad.adSetId
        if (!byAdSet.has(key)) {
          byAdSet.set(key, {
            adSetId: ad.adSetId,
            adSetName: ad.adSetName,
            status: 'active',
            ads: [],
            spend: 0, reach: 0, clicks: 0, visitors: 0, leads: 0, appointments: 0, sales: 0, revenue: 0,
            campaignId: ad.campaignId,
            campaignName: ad.campaignName,
          })
        }
        const set = byAdSet.get(key)
        set.ads.push(ad)
        set.spend += ad.spend
        set.reach += ad.reach
        set.clicks += ad.clicks
        set.visitors += ad.visitors
        set.leads += ad.leads
        set.appointments += ad.appointments
        set.sales += ad.sales
        set.revenue += ad.revenue
      }

      for (const set of byAdSet.values()) {
        set.cpc = set.clicks > 0 ? set.spend / set.clicks : 0
        set.cpv = set.visitors > 0 ? set.spend / set.visitors : 0
        set.cpl = set.leads > 0 ? set.spend / set.leads : 0
        set.cac = set.sales > 0 ? set.spend / set.sales : 0
        set.roas = set.spend > 0 ? set.revenue / set.spend : 0
      }

      const byCampaign = new Map()
      for (const set of byAdSet.values()) {
        const key = set.campaignId
        if (!byCampaign.has(key)) {
          byCampaign.set(key, {
            campaignId: set.campaignId,
            campaignName: set.campaignName,
            status: 'active',
            adSets: [],
            spend: 0, reach: 0, clicks: 0, visitors: 0, leads: 0, appointments: 0, sales: 0, revenue: 0,
          })
        }
        const camp = byCampaign.get(key)
        camp.adSets.push(set)
        camp.spend += set.spend
        camp.reach += set.reach
        camp.clicks += set.clicks
        camp.visitors += set.visitors
        camp.leads += set.leads
        camp.appointments += set.appointments
        camp.sales += set.sales
        camp.revenue += set.revenue
      }

      for (const camp of byCampaign.values()) {
        camp.cpc = camp.clicks > 0 ? camp.spend / camp.clicks : 0
        camp.cpv = camp.visitors > 0 ? camp.spend / camp.visitors : 0
        camp.cpl = camp.leads > 0 ? camp.spend / camp.leads : 0
        camp.cac = camp.sales > 0 ? camp.spend / camp.sales : 0
        camp.roas = camp.spend > 0 ? camp.revenue / camp.spend : 0
      }

      // Return ordered by spend desc
      const campaigns = Array.from(byCampaign.values()).sort((a, b) => b.spend - a.spend)
      // Also sort adSets and ads by spend desc
      for (const c of campaigns) {
        c.adSets.sort((a, b) => b.spend - a.spend)
        for (const s of c.adSets) {
          s.ads.sort((a, b) => b.spend - a.spend)
        }
      }

      return campaigns
    } catch (error) {
      console.error('Error building campaigns hierarchy:', error)
      throw error
    }
  }

  async getHistoricalData(startDate, endDate) {
    try {
      // Obtener gastos diarios de meta_ads
      const spendRes = await databasePool.query(
        `SELECT 
           date,
           COALESCE(SUM(spend), 0) AS spend
         FROM meta.meta_ads
         WHERE date >= $1 AND date <= $2
         GROUP BY date
         ORDER BY date ASC`,
        [startDate, endDate]
      );

      // Obtener ingresos diarios basados en Last Attribution (fecha de creación del contacto)
      // 🚨 NOTA: Aplicamos la misma ventana de atribución de 3 días
      const revenueRes = await databasePool.query(
        `SELECT 
           DATE(c.created_at) AS date,
           COALESCE(SUM(
             -- Suma el LTV (lifetime value) de cada contacto creado en esta fecha
             COALESCE((
               SELECT SUM(amount) 
               FROM payments p 
               WHERE p.contact_id = c.contact_id 
                 AND p.status = 'completed'
             ), 0)
           ), 0) AS revenue
         FROM contacts c
         WHERE c.attribution_ad_id IS NOT NULL
           AND c.created_at >= $1 
           AND c.created_at <= $2
           -- Validar con ventana de atribución de 3 días
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
         GROUP BY DATE(c.created_at)
         ORDER BY date ASC`,
        [startDate, endDate]
      );

      // Crear un mapa de fechas
      const dataMap = new Map();
      
      // Agregar gastos
      for (const row of spendRes.rows) {
        const dateStr = row.date.toISOString().split('T')[0];
        if (!dataMap.has(dateStr)) {
          dataMap.set(dateStr, { date: dateStr, spend: 0, revenue: 0 });
        }
        dataMap.get(dateStr).spend = parseFloat(row.spend) || 0;
      }

      // Agregar ingresos
      for (const row of revenueRes.rows) {
        const dateStr = row.date.toISOString().split('T')[0];
        if (!dataMap.has(dateStr)) {
          dataMap.set(dateStr, { date: dateStr, spend: 0, revenue: 0 });
        }
        dataMap.get(dateStr).revenue = parseFloat(row.revenue) || 0;
      }

      // Convertir a array y ordenar por fecha
      const data = Array.from(dataMap.values()).sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      return data;
    } catch (error) {
      console.error('Error getting historical campaign data:', error);
      throw error;
    }
  }
}

module.exports = new CampaignsService()

