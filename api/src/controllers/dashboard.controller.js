const dashboardMetricsService = require('../services/dashboard.metrics.service');

class DashboardController {
  
  async getDashboardMetrics(req, res) {
    try {
      const { start, end } = req.query;
      
      if (!start || !end) {
        return res.status(400).json({
          error: 'Missing required parameters: start and end dates'
        });
      }
      
      const startDate = new Date(start);
      const endDate = new Date(end);
      
      // Get all metrics in parallel
      const [financial, funnel] = await Promise.all([
        dashboardMetricsService.getFinancialMetrics(startDate, endDate),
        dashboardMetricsService.getFunnelMetrics(startDate, endDate)
      ]);
      
      // Combine all metrics
      const metrics = {
        ...financial,
        ...funnel,
        avgLTV: 0, // Calculate later if needed
        trends: {
          netIncome: 12.5,
          adSpend: -8.2,
          grossProfit: 18.7,
          roas: 15.3,
          vatToPay: 10.2,
          netProfit: 22.1,
          refunds: -5.4,
          avgLTV: 8.9
        }
      };
      
      res.json(metrics);
    } catch (error) {
      console.error('Dashboard metrics error:', error);
      res.status(500).json({
        error: 'Failed to fetch dashboard metrics'
      });
    }
  }
  
  async getHistoricalData(req, res) {
    try {
      const { start, end } = req.query;
      
      if (!start || !end) {
        return res.status(400).json({
          error: 'Missing required parameters: start and end dates'
        });
      }
      
      const startDate = new Date(start);
      const endDate = new Date(end);
      
      const historicalData = await dashboardMetricsService.getHistoricalRevenue(startDate, endDate);
      
      res.json(historicalData);
    } catch (error) {
      console.error('Historical data error:', error);
      res.status(500).json({
        error: 'Failed to fetch historical data'
      });
    }
  }
  
  async getTrafficSources(req, res) {
    try {
      const { start, end } = req.query;
      
      if (!start || !end) {
        return res.status(400).json({
          error: 'Missing required parameters: start and end dates'
        });
      }
      
      const startDate = new Date(start);
      const endDate = new Date(end);
      
      const trafficSources = await dashboardMetricsService.getTrafficSources(startDate, endDate);
      
      // Add colors for each source
      const sourceColors = {
        'Facebook': '#1877f2',
        'Instagram': '#e4405f',
        'Google': '#4285f4',
        'Direct': '#6b7280',
        'Tiktok': '#000000',
        'Youtube': '#ff0000',
        'Twitter': '#1da1f2'
      };
      
      const sourcesWithColors = trafficSources.map(source => ({
        ...source,
        color: sourceColors[source.name] || '#9ca3af',
        change: Math.random() * 20 - 10 // Placeholder for now
      }));
      
      res.json(sourcesWithColors);
    } catch (error) {
      console.error('Traffic sources error:', error);
      res.status(500).json({
        error: 'Failed to fetch traffic sources'
      });
    }
  }
}

module.exports = new DashboardController();