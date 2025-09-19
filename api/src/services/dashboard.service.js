const { databasePool } = require('../config/database.config');

class DashboardService {
  async getFinancialMetrics(startDate, endDate) {
    try {
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

      // Query for ad spend from Meta
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

      // Execute all queries in parallel
      const [paymentsResult, adSpendResult, refundsResult] = await Promise.all([
        databasePool.query(paymentsQuery, [startDate, endDate]),
        databasePool.query(adSpendQuery, [startDate, endDate]),
        databasePool.query(refundsQuery, [startDate, endDate])
      ]);

      const payments = paymentsResult.rows[0];
      const ads = adSpendResult.rows[0];
      const refunds = refundsResult.rows[0];

      const netIncome = parseFloat(payments.net_income) || 0;
      const adSpend = parseFloat(ads.ad_spend) || 0;
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

      const [prevPayments, prevAds, prevRefunds] = await Promise.all([
        databasePool.query(paymentsQuery, [previousStartDate, previousEndDate]),
        databasePool.query(adSpendQuery, [previousStartDate, previousEndDate]),
        databasePool.query(refundsQuery, [previousStartDate, previousEndDate])
      ]);

      const prevNetIncome = parseFloat(prevPayments.rows[0].net_income) || 0;
      const prevAdSpend = parseFloat(prevAds.rows[0].ad_spend) || 0;
      const prevRefundsAmount = parseFloat(prevRefunds.rows[0].total_refunds) || 0;
      const prevGrossProfit = prevNetIncome - prevAdSpend;
      const prevRoas = prevAdSpend > 0 ? prevNetIncome / prevAdSpend : 0;
      const prevNetProfit = prevGrossProfit - (prevNetIncome * 0.16);

      const calculateTrend = (current, previous) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / Math.abs(previous)) * 100;
      };

      return {
        netIncome,
        adSpend,
        grossProfit,
        netProfit,
        roas,
        ltv: payments.total_customers > 0 ? netIncome / payments.total_customers : 0,
        refunds: totalRefunds,
        vat: vatToPay,
        trends: {
          netIncome: calculateTrend(netIncome, prevNetIncome),
          adSpend: calculateTrend(adSpend, prevAdSpend),
          grossProfit: calculateTrend(grossProfit, prevGrossProfit),
          netProfit: calculateTrend(netProfit, prevNetProfit),
          roas: calculateTrend(roas, prevRoas),
          avgLTV: calculateTrend(
            payments.total_customers > 0 ? netIncome / payments.total_customers : 0,
            prevPayments.rows[0].total_customers > 0 ? prevNetIncome / prevPayments.rows[0].total_customers : 0
          )
        }
      };
    } catch (error) {
      console.error('Error fetching financial metrics:', error);
      throw error;
    }
  }

  async getFunnelMetrics(startDate, endDate) {
    try {
      // Query for funnel metrics
      const funnelQuery = `
        SELECT
          (SELECT COUNT(*) FROM contacts WHERE created_at >= $1 AND created_at <= $2) as leads,
          (SELECT COUNT(DISTINCT contact_id) FROM appointments WHERE created_at >= $1 AND created_at <= $2) as qualified,
          (SELECT COUNT(DISTINCT contact_id) FROM payments WHERE COALESCE(paid_at, created_at) >= $1 AND COALESCE(paid_at, created_at) <= $2 AND status = 'completed') as customers
      `;

      const result = await databasePool.query(funnelQuery, [startDate, endDate]);
      const metrics = result.rows[0];

      return {
        visitors: 0, // Tracking not fully implemented yet
        leads: parseInt(metrics.leads) || 0,
        qualified: parseInt(metrics.qualified) || 0,
        customers: parseInt(metrics.customers) || 0
      };
    } catch (error) {
      console.error('Error fetching funnel metrics:', error);
      throw error;
    }
  }

  async getHistoricalRevenue(startDate, endDate) {
    try {
      // Determine the appropriate grouping based on date range
      const daysDiff = (endDate - startDate) / (1000 * 60 * 60 * 24);
      let groupBy = 'day';

      if (daysDiff > 90) {
        groupBy = 'month';
      } else if (daysDiff > 365) {
        groupBy = 'year';
      }

      const query = `
        SELECT
          DATE_TRUNC($3, COALESCE(paid_at, created_at)) as period,
          COALESCE(SUM(amount), 0) as revenue,
          COUNT(*) as transactions
        FROM payments
        WHERE COALESCE(paid_at, created_at) >= $1 AND COALESCE(paid_at, created_at) <= $2
          AND status = 'completed'
        GROUP BY period
        ORDER BY period
      `;

      const result = await databasePool.query(query, [startDate, endDate, groupBy]);

      return result.rows.map(row => ({
        date: row.period,
        revenue: parseFloat(row.revenue) || 0,
        transactions: parseInt(row.transactions) || 0
      }));
    } catch (error) {
      console.error('Error fetching historical revenue:', error);
      throw error;
    }
  }

  async getTrafficSources(startDate, endDate) {
    try {
      const query = `
        SELECT
          COALESCE(source, 'Directo') as name,
          COUNT(*) as value,
          COUNT(*) * 100.0 / SUM(COUNT(*)) OVER() as percentage
        FROM contacts
        WHERE created_at >= $1 AND created_at <= $2
        GROUP BY source
        ORDER BY value DESC
      `;

      const result = await databasePool.query(query, [startDate, endDate]);

      return result.rows.map(row => ({
        name: row.name,
        value: parseInt(row.value) || 0,
        percentage: parseFloat(row.percentage) || 0
      }));
    } catch (error) {
      console.error('Error fetching traffic sources:', error);
      throw error;
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