const { databasePool } = require('../config/database.config');

class ReportsMetricsService {

  async getReportsMetrics(startDate, endDate) {
    try {
      // Calculate the previous period for comparison
      const periodLength = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
      const previousEndDate = new Date(startDate);
      previousEndDate.setDate(previousEndDate.getDate() - 1);
      const previousStartDate = new Date(previousEndDate);
      previousStartDate.setDate(previousStartDate.getDate() - periodLength + 1);

      // Query for current period metrics
      const currentMetricsQuery = `
        WITH revenue_stats AS (
          SELECT
            COALESCE(SUM(amount), 0) as total_revenue
          FROM payments
          WHERE paid_at >= $1 AND paid_at <= $2 AND status = 'completed'
        ),
        expense_stats AS (
          SELECT
            COALESCE(SUM(spend), 0) as total_spend
          FROM meta.meta_ads
          WHERE date >= $1 AND date <= $2
        ),
        customer_stats AS (
          SELECT
            COUNT(DISTINCT p.contact_id) as new_customers
          FROM payments p
          INNER JOIN contacts c ON p.contact_id = c.contact_id
          WHERE p.paid_at >= $1 AND p.paid_at <= $2
          AND p.status = 'completed'
          AND c.created_at >= $1 AND c.created_at <= $2
        )
        SELECT
          r.total_revenue,
          e.total_spend,
          c.new_customers,
          (r.total_revenue - e.total_spend) as profit,
          CASE
            WHEN r.total_revenue > 0
            THEN ((r.total_revenue - e.total_spend) / r.total_revenue) * 100
            ELSE 0
          END as profit_margin,
          CASE
            WHEN r.total_revenue > 0
            THEN (e.total_spend / r.total_revenue) * 100
            ELSE 0
          END as expense_percentage
        FROM revenue_stats r
        CROSS JOIN expense_stats e
        CROSS JOIN customer_stats c
      `;

      // Execute both queries in parallel
      const [currentResult, previousResult] = await Promise.all([
        databasePool.query(currentMetricsQuery, [startDate, endDate]),
        databasePool.query(currentMetricsQuery, [previousStartDate, previousEndDate])
      ]);

      const current = currentResult.rows[0];
      const previous = previousResult.rows[0];

      // Calculate percentage changes
      const calculateChange = (current, previous) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / Math.abs(previous)) * 100;
      };

      return {
        revenue: parseFloat(current.total_revenue),
        spend: parseFloat(current.total_spend),
        newCustomers: parseInt(current.new_customers),
        profit: parseFloat(current.profit),
        profitMargin: parseFloat(current.profit_margin),
        expensePercentage: parseFloat(current.expense_percentage),
        trends: {
          revenue: calculateChange(parseFloat(current.total_revenue), parseFloat(previous.total_revenue)),
          spend: calculateChange(parseFloat(current.total_spend), parseFloat(previous.total_spend)),
          newCustomers: calculateChange(parseInt(current.new_customers), parseInt(previous.new_customers)),
          profit: calculateChange(parseFloat(current.profit), parseFloat(previous.profit))
        }
      };
    } catch (error) {
      console.error('Error fetching reports metrics:', error);
      throw error;
    }
  }
}

module.exports = new ReportsMetricsService();