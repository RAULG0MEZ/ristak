const dashboardService = require('../services/dashboard.service');

class DashboardController {
  constructor() {
    // Bind all methods to this instance
    this.getDashboardMetrics = this.getDashboardMetrics.bind(this);
    this.getHistoricalData = this.getHistoricalData.bind(this);
    this.getTrafficSources = this.getTrafficSources.bind(this);
    this.getFunnelData = this.getFunnelData.bind(this);
  }

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

      // Get all metrics pero con manejo de errores por separado
      let financial = {};
      let funnel = {};

      try {
        financial = await dashboardService.getFinancialMetrics(startDate, endDate);
      } catch (error) {
        console.error('Error getting financial metrics:', error);
        // Devolver valores por defecto si falla
        financial = {
          netIncome: 0,
          adSpend: 0,
          grossProfit: 0,
          netProfit: 0,
          roas: 0,
          ltv: 0,
          refunds: 0,
          vat: 0,
          trends: {
            netIncome: 0,
            adSpend: 0,
            grossProfit: 0,
            netProfit: 0,
            roas: 0,
            avgLTV: 0
          }
        };
      }

      try {
        funnel = await dashboardService.getFunnelMetrics(startDate, endDate);
      } catch (error) {
        console.error('Error getting funnel metrics:', error);
        // Devolver valores por defecto si falla
        funnel = {
          visitors: 0,
          leads: 0,
          qualified: 0,
          customers: 0
        };
      }

      // Combine all metrics
      const metrics = {
        ...financial,
        ...funnel
      };

      res.json(metrics);
    } catch (error) {
      console.error('Dashboard metrics TOTAL error:', error);
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
      
      const historicalData = await dashboardService.getHistoricalRevenue(startDate, endDate);
      
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

      const trafficSources = await dashboardService.getTrafficSources(startDate, endDate);

      // El servicio ya devuelve colores, solo agregar el cambio
      const sourcesWithColors = trafficSources.map(source => ({
        ...source,
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

  async getFunnelData(req, res) {
    try {
      const { start, end } = req.query;

      if (!start || !end) {
        return res.status(400).json({
          error: 'Missing required parameters: start and end dates'
        });
      }

      const startDate = new Date(start);
      const endDate = new Date(end);

      const funnelMetrics = await dashboardService.getFunnelMetrics(startDate, endDate);

      // Transform to funnel chart format
      const funnelData = [
        {
          stage: 'Visitantes',
          value: funnelMetrics.visitors,
          icon: 'mousePointer'
        },
        {
          stage: 'Leads',
          value: funnelMetrics.leads,
          icon: 'userPlus'
        },
        {
          stage: 'Citas',
          value: funnelMetrics.qualified,
          icon: 'calendar'
        },
        {
          stage: 'Ventas',
          value: funnelMetrics.customers,
          icon: 'shoppingCart'
        }
      ];

      res.json(funnelData);
    } catch (error) {
      console.error('Funnel data error:', error);
      res.status(500).json({
        error: 'Failed to fetch funnel data'
      });
    }
  }
}

module.exports = new DashboardController();