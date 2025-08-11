import { Router, Request, Response } from 'express';
import DatabaseService from '../services/database';
import { healthCheckHandler, metricsHandler } from '../utils/monitoring';
import { SystemMetricsService } from '../services/system-metrics';

const router = Router();

// Basic health check endpoint
router.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Tourist Hub API',
    version: '1.0.0'
  });
});

// Database health check endpoint
router.get('/db', async (req: Request, res: Response) => {
  try {
    const dbService = DatabaseService.getInstance();
    const healthCheck = await dbService.healthCheck();
    
    const statusCode = healthCheck.status === 'healthy' ? 200 : 503;
    
    res.status(statusCode).json({
      database: healthCheck,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Health check endpoint error:', error);
    
    res.status(503).json({
      database: {
        status: 'unhealthy',
        message: 'Health check failed',
        timestamp: new Date().toISOString(),
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

// Comprehensive health check endpoint with monitoring
router.get('/full', healthCheckHandler);

// Performance metrics endpoint
router.get('/metrics', metricsHandler);

// Readiness probe endpoint (for Kubernetes/container orchestration)
router.get('/ready', async (req: Request, res: Response) => {
  try {
    const dbService = DatabaseService.getInstance();
    const dbHealth = await dbService.healthCheck();
    
    if (dbHealth.status === 'healthy') {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        reason: 'Database not healthy',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      reason: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

// Liveness probe endpoint (for Kubernetes/container orchestration)
router.get('/live', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// System information endpoint
router.get('/system', async (req: Request, res: Response) => {
  try {
    const os = require('os');
    const systemInfo = {
      hostname: os.hostname(),
      platform: os.platform(),
      architecture: os.arch(),
      cpus: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      uptime: os.uptime(),
      loadAverage: os.loadavg(),
      networkInterfaces: Object.keys(os.networkInterfaces()),
      nodeVersion: process.version,
      processId: process.pid,
      processUptime: process.uptime(),
      timestamp: new Date().toISOString()
    };

    res.json(systemInfo);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve system information',
      timestamp: new Date().toISOString()
    });
  }
});

// Database connection pool status
router.get('/db/pool', async (req: Request, res: Response) => {
  try {
    const dbService = DatabaseService.getInstance();
    const client = dbService.getClient();
    
    // Get connection pool information if available
    let poolInfo: {
      status: string;
      message: string;
      details?: {
        engineType?: string;
      };
    } = {
      status: 'unknown',
      message: 'Connection pool information not available'
    };

    if (client && (client as any)._engine) {
      const engine = (client as any)._engine;
      poolInfo = {
        status: 'available',
        message: 'Connection pool is active',
        details: {
          engineType: engine.constructor.name,
          // Add more pool-specific details as available
        }
      };
    }

    res.json({
      ...poolInfo,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve connection pool status',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Performance monitoring endpoint with detailed metrics
router.get('/performance', async (req: Request, res: Response) => {
  try {
    const { MonitoringService } = require('../utils/monitoring');
    const performanceMetrics = MonitoringService.getPerformanceMetrics();
    const endpointMetrics = MonitoringService.getEndpointMetrics();
    const alerts = MonitoringService.checkAlerts();

    res.json({
      performance: performanceMetrics,
      endpoints: endpointMetrics,
      alerts,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve performance metrics',
      timestamp: new Date().toISOString()
    });
  }
});

// Resource usage monitoring endpoint
router.get('/resources', (req: Request, res: Response) => {
  try {
    const os = require('os');
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const resources = {
      memory: {
        process: {
          rss: memoryUsage.rss,
          heapTotal: memoryUsage.heapTotal,
          heapUsed: memoryUsage.heapUsed,
          external: memoryUsage.external,
          arrayBuffers: memoryUsage.arrayBuffers
        },
        system: {
          total: os.totalmem(),
          free: os.freemem(),
          used: os.totalmem() - os.freemem(),
          percentage: Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100)
        }
      },
      cpu: {
        usage: {
          user: cpuUsage.user,
          system: cpuUsage.system
        },
        loadAverage: os.loadavg(),
        cores: os.cpus().length
      },
      uptime: {
        process: process.uptime(),
        system: os.uptime()
      },
      timestamp: new Date().toISOString()
    };

    res.json(resources);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve resource usage',
      timestamp: new Date().toISOString()
    });
  }
});

// System metrics endpoints
router.get('/metrics/system', async (req: Request, res: Response) => {
  try {
    const metricsService = SystemMetricsService.getInstance();
    const currentMetrics = await metricsService.collectMetrics();
    
    res.json(currentMetrics);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to collect system metrics',
      timestamp: new Date().toISOString()
    });
  }
});

// System metrics history
router.get('/metrics/history', (req: Request, res: Response) => {
  try {
    const metricsService = SystemMetricsService.getInstance();
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const history = metricsService.getMetricsHistory(limit);
    
    res.json({
      metrics: history,
      count: history.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve metrics history',
      timestamp: new Date().toISOString()
    });
  }
});

// System alerts endpoint
router.get('/alerts', (req: Request, res: Response) => {
  try {
    const metricsService = SystemMetricsService.getInstance();
    const activeOnly = req.query.active === 'true';
    const alerts = activeOnly ? metricsService.getActiveAlerts() : metricsService.getAllAlerts();
    
    res.json({
      alerts,
      count: alerts.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve system alerts',
      timestamp: new Date().toISOString()
    });
  }
});

// Metrics summary endpoint
router.get('/metrics/summary', (req: Request, res: Response) => {
  try {
    const metricsService = SystemMetricsService.getInstance();
    const periodMinutes = req.query.period ? parseInt(req.query.period as string) : 60;
    const summary = metricsService.getMetricsSummary(periodMinutes);
    
    res.json(summary);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve metrics summary',
      timestamp: new Date().toISOString()
    });
  }
});

// Prometheus metrics export endpoint
router.get('/metrics/prometheus', (req: Request, res: Response) => {
  try {
    const metricsService = SystemMetricsService.getInstance();
    const prometheusMetrics = metricsService.exportMetrics('prometheus');
    
    res.set('Content-Type', 'text/plain');
    res.send(prometheusMetrics);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to export Prometheus metrics',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;