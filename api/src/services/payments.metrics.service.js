const { databasePool } = require('../config/database.config');

class PaymentsMetricsService {

  async getPaymentsMetrics(startDate, endDate) {
    try {
      // Calculate the previous period for comparison
      const periodLength = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
      const previousEndDate = new Date(startDate);
      previousEndDate.setDate(previousEndDate.getDate() - 1);
      const previousStartDate = new Date(previousEndDate);
      previousStartDate.setDate(previousStartDate.getDate() - periodLength + 1);

      // Query for current period metrics
      const currentMetricsQuery = `
        WITH payment_stats AS (
          SELECT
            COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) as net_revenue,
            COALESCE(COUNT(CASE WHEN status = 'completed' THEN 1 END), 0) as completed_count,
            COALESCE(AVG(CASE WHEN status = 'completed' THEN amount END), 0) as avg_payment,
            COALESCE(SUM(CASE WHEN status = 'refunded' THEN amount ELSE 0 END), 0) as refunded_total,
            COALESCE(COUNT(CASE WHEN status = 'refunded' THEN 1 END), 0) as refunded_count
          FROM payments
          WHERE paid_at >= $1 AND paid_at <= $2
        )
        SELECT * FROM payment_stats
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
        netRevenue: parseFloat(current.net_revenue),
        completedCount: parseInt(current.completed_count),
        avgPayment: parseFloat(current.avg_payment),
        refundedTotal: parseFloat(current.refunded_total),
        refundedCount: parseInt(current.refunded_count),
        trends: {
          netRevenue: calculateChange(parseFloat(current.net_revenue), parseFloat(previous.net_revenue)),
          avgPayment: calculateChange(parseFloat(current.avg_payment), parseFloat(previous.avg_payment))
        }
      };
    } catch (error) {
      console.error('Error fetching payments metrics:', error);
      throw error;
    }
  }
}

module.exports = new PaymentsMetricsService();