const { databasePool } = require('../config/database.config');

class ContactsMetricsService {

  async getContactsMetrics(startDate, endDate) {
    try {
      // Calculate the previous period for comparison
      const periodLength = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
      const previousEndDate = new Date(startDate);
      previousEndDate.setDate(previousEndDate.getDate() - 1);
      const previousStartDate = new Date(previousEndDate);
      previousStartDate.setDate(previousStartDate.getDate() - periodLength + 1);

      // Query for current period metrics
      const currentMetricsQuery = `
        WITH contact_stats AS (
          SELECT
            COUNT(DISTINCT c.contact_id) as total_contacts,
            COUNT(DISTINCT CASE WHEN p.id IS NOT NULL THEN c.contact_id END) as customers,
            COALESCE(SUM(p.amount), 0) as total_ltv,
            CASE
              WHEN COUNT(DISTINCT CASE WHEN p.id IS NOT NULL THEN c.contact_id END) > 0
              THEN COALESCE(SUM(p.amount), 0) / COUNT(DISTINCT CASE WHEN p.id IS NOT NULL THEN c.contact_id END)
              ELSE 0
            END as avg_ltv,
            CASE
              WHEN COUNT(DISTINCT c.contact_id) > 0
              THEN CAST(COUNT(DISTINCT CASE WHEN p.id IS NOT NULL THEN c.contact_id END) AS FLOAT) / COUNT(DISTINCT c.contact_id) * 100
              ELSE 0
            END as conversion_rate
          FROM contacts c
          LEFT JOIN payments p ON c.contact_id = p.contact_id
            AND p.status = 'completed'
            AND p.paid_at >= $1 AND p.paid_at <= $2
          WHERE c.created_at >= $1 AND c.created_at <= $2
        )
        SELECT * FROM contact_stats
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
        totalContacts: parseInt(current.total_contacts),
        customers: parseInt(current.customers),
        totalLTV: parseFloat(current.total_ltv),
        avgLTV: parseFloat(current.avg_ltv),
        conversionRate: parseFloat(current.conversion_rate),
        trends: {
          totalLTV: calculateChange(parseFloat(current.total_ltv), parseFloat(previous.total_ltv)),
          avgLTV: calculateChange(parseFloat(current.avg_ltv), parseFloat(previous.avg_ltv))
        }
      };
    } catch (error) {
      console.error('Error fetching contacts metrics:', error);
      throw error;
    }
  }
}

module.exports = new ContactsMetricsService();