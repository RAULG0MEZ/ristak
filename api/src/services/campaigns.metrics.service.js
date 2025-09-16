const { databasePool } = require('../config/database.config');

class CampaignsMetricsService {

  async getCampaignsMetrics(startDate, endDate) {
    try {
      // Calculate the previous period for comparison
      const periodLength = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
      const previousEndDate = new Date(startDate);
      previousEndDate.setDate(previousEndDate.getDate() - 1);
      const previousStartDate = new Date(previousEndDate);
      previousStartDate.setDate(previousStartDate.getDate() - periodLength + 1);

      // Query for current period metrics
      const currentQuery = `
        SELECT
          COALESCE(SUM(ma.spend), 0) as total_spend,
          COALESCE(SUM(ma.clicks), 0) as total_clicks,
          COALESCE(SUM(ma.reach), 0) as total_reach,
          COUNT(DISTINCT c.contact_id) as total_leads,
          COALESCE(SUM(p.amount), 0) as total_revenue,
          COUNT(DISTINCT p.contact_id) as total_sales
        FROM meta.meta_ads ma
        FULL OUTER JOIN contacts c ON c.created_at >= $1 AND c.created_at <= $2
        FULL OUTER JOIN payments p ON p.paid_at >= $1 AND p.paid_at <= $2 AND p.status = 'completed'
        WHERE ma.date >= $1 AND ma.date <= $2
      `;

      // Query for previous period metrics
      const previousQuery = `
        SELECT
          COALESCE(SUM(ma.spend), 0) as total_spend,
          COALESCE(SUM(ma.clicks), 0) as total_clicks,
          COALESCE(SUM(ma.reach), 0) as total_reach,
          COUNT(DISTINCT c.contact_id) as total_leads,
          COALESCE(SUM(p.amount), 0) as total_revenue,
          COUNT(DISTINCT p.contact_id) as total_sales
        FROM meta.meta_ads ma
        FULL OUTER JOIN contacts c ON c.created_at >= $1 AND c.created_at <= $2
        FULL OUTER JOIN payments p ON p.paid_at >= $1 AND p.paid_at <= $2 AND p.status = 'completed'
        WHERE ma.date >= $1 AND ma.date <= $2
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
}

module.exports = new CampaignsMetricsService();