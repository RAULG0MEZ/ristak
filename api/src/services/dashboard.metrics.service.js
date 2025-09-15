const { databasePool } = require('../config/database.config');

class DashboardMetricsService {
  
  async getFinancialMetrics(startDate, endDate) {
    try {
      // Get advertising spend from meta_ads table (in meta schema)
      const adSpendQuery = `
        SELECT 
          COALESCE(SUM(spend), 0) as total_spend,
          COALESCE(SUM(clicks), 0) as total_clicks,
          COALESCE(SUM(reach), 0) as total_reach
        FROM meta.meta_ads
        WHERE date >= $1 AND date <= $2
      `;
      
      // Get payments from payments table
      const paymentsQuery = `
        SELECT 
          COALESCE(SUM(amount), 0) as total_income,
          COUNT(*) as payment_count
        FROM payments
        WHERE paid_at >= $1 AND paid_at <= $2 AND status = 'completed'
      `;
      
      // Get refunds
      const refundsQuery = `
        SELECT COALESCE(SUM(amount), 0) as total_refunds
        FROM payments
        WHERE paid_at >= $1 AND paid_at <= $2 AND status = 'refunded'
      `;
      
      const [adSpend, payments, refunds] = await Promise.all([
        databasePool.query(adSpendQuery, [startDate, endDate]),
        databasePool.query(paymentsQuery, [startDate, endDate]),
        databasePool.query(refundsQuery, [startDate, endDate])
      ]);
      
      const totalSpend = parseFloat(adSpend.rows[0].total_spend);
      const totalIncome = parseFloat(payments.rows[0].total_income);
      const totalRefunds = parseFloat(refunds.rows[0].total_refunds);
      
      // Calculate metrics
      const grossProfit = totalIncome - totalSpend - totalRefunds;
      const roas = totalSpend > 0 ? totalIncome / totalSpend : 0;
      const vatRate = 0.16; // 16% VAT in Mexico
      const vatAmount = totalIncome * vatRate;
      const netProfit = grossProfit - vatAmount;
      
      return {
        netIncome: totalIncome,
        adSpend: totalSpend,
        grossProfit: grossProfit,
        roas: roas,
        vatToPay: vatAmount,
        netProfit: netProfit,
        refunds: totalRefunds
      };
    } catch (error) {
      console.error('Error fetching financial metrics:', error);
      throw error;
    }
  }
  
  async getFunnelMetrics(startDate, endDate) {
    try {
      // Get unique visitors - TRACKING NO IMPLEMENTADO AÚN
      // Por ahora retornamos 0 visitantes hasta implementar tracking
      const visitorsQuery = `SELECT 0 as visitor_count`;
      
      // Get leads count
      const leadsQuery = `
        SELECT COUNT(*) as lead_count
        FROM contacts
        WHERE created_at >= $1 AND created_at <= $2
      `;
      
      // Get appointments (qualified leads)
      const appointmentsQuery = `
        SELECT COUNT(*) as appointment_count
        FROM appointments
        WHERE created_at >= $1 AND created_at <= $2
      `;
      
      // Get customers (contacts with completed payments)
      const customersQuery = `
        SELECT COUNT(DISTINCT c.contact_id) as customer_count
        FROM contacts c
        JOIN payments p ON c.contact_id = p.contact_id
        WHERE c.created_at >= $1 AND c.created_at <= $2
        AND p.status = 'completed'
      `;
      
      const [visitors, leads, appointments, customers] = await Promise.all([
        databasePool.query(visitorsQuery), // Sin parámetros porque no consulta tracking
        databasePool.query(leadsQuery, [startDate, endDate]),
        databasePool.query(appointmentsQuery, [startDate, endDate]),
        databasePool.query(customersQuery, [startDate, endDate])
      ]);
      
      return {
        visitors: parseInt(visitors.rows[0].visitor_count) || 0,
        leads: parseInt(leads.rows[0].lead_count) || 0,
        qualified: parseInt(appointments.rows[0].appointment_count) || 0,
        customers: parseInt(customers.rows[0].customer_count) || 0
      };
    } catch (error) {
      console.error('Error fetching funnel metrics:', error);
      throw error;
    }
  }
  
  async getTrafficSources(startDate, endDate) {
    try {
      // Traffic sources - TRACKING NO IMPLEMENTADO AÚN
      // Por ahora retornamos array vacío hasta implementar tracking
      const query = `SELECT 'Direct' as traffic_source, 0 as session_count WHERE 1=0`;

      const result = await databasePool.query(query); // Sin parámetros porque no consulta tracking
      
      const total = result.rows.reduce((sum, row) => sum + parseInt(row.session_count), 0);
      
      return result.rows.map(row => ({
        name: row.traffic_source.charAt(0).toUpperCase() + row.traffic_source.slice(1),
        value: parseInt(row.session_count),
        percentage: total > 0 ? Math.round((parseInt(row.session_count) / total) * 100) : 0
      }));
    } catch (error) {
      console.error('Error fetching traffic sources:', error);
      throw error;
    }
  }
  
  async getHistoricalRevenue(startDate, endDate) {
    try {
      const query = `
        WITH monthly_payments AS (
          SELECT 
            DATE_TRUNC('month', paid_at) as month,
            COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) as income
          FROM payments
          WHERE paid_at >= $1 AND paid_at <= $2
          GROUP BY DATE_TRUNC('month', paid_at)
        ),
        monthly_expenses AS (
          SELECT 
            DATE_TRUNC('month', date) as month,
            COALESCE(SUM(spend), 0) as expenses
          FROM meta.meta_ads
          WHERE date >= $1 AND date <= $2
          GROUP BY DATE_TRUNC('month', date)
        )
        SELECT 
          COALESCE(p.month, e.month) as month,
          COALESCE(p.income, 0) as income,
          COALESCE(e.expenses, 0) as expenses
        FROM monthly_payments p
        FULL OUTER JOIN monthly_expenses e ON p.month = e.month
        ORDER BY month
      `;
      
      const result = await databasePool.query(query, [startDate, endDate]);
      
      const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      
      return result.rows.map(row => ({
        month: monthNames[new Date(row.month).getMonth()],
        income: parseFloat(row.income),
        expenses: parseFloat(row.expenses)
      }));
    } catch (error) {
      console.error('Error fetching historical revenue:', error);
      throw error;
    }
  }
}

module.exports = new DashboardMetricsService();