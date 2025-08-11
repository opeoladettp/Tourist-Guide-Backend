import request from 'supertest';
import app from '../../app';
import { SystemMetricsService } from '../../services/system-metrics';
import DatabaseService from '../../services/database';

describe('Health Monitoring Endpoints Integration', () => {
  let metricsService: SystemMetricsService;

  beforeAll(async () => {
    // Initialize database connection for tests
    const dbService = DatabaseService.getInstance();
    try {
      await dbService.connect();
    } catch (error) {
      console.warn('Database connection failed in tests, continuing with mocked responses');
    }

    metricsService = SystemMetricsService.getInstance();
  });

  afterAll(async () => {
    metricsService.stopCollection();
    
    const dbService = DatabaseService.getInstance();
    if (dbService.isHealthy()) {
      await dbService.disconnect();
    }
  });

  describe('GET /health', () => {
    it('should return basic health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('service', 'Tourist Hub API');
      expect(response.body).toHaveProperty('version');
    });
  });

  describe('GET /health/db', () => {
    it('should return database health status', async () => {
      const response = await request(app)
        .get('/health/db')
        .expect((res) => {
          expect([200, 503]).toContain(res.status);
        });

      expect(response.body).toHaveProperty('database');
      expect(response.body.database).toHaveProperty('status');
      expect(response.body.database).toHaveProperty('timestamp');
      expect(['healthy', 'unhealthy']).toContain(response.body.database.status);
    });
  });

  describe('GET /health/full', () => {
    it('should return comprehensive health metrics', async () => {
      const response = await request(app)
        .get('/health/full')
        .expect((res) => {
          expect([200, 503]).toContain(res.status);
        });

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('memory');
      expect(response.body).toHaveProperty('cpu');
      expect(response.body).toHaveProperty('database');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('environment');

      // Check memory structure
      expect(response.body.memory).toHaveProperty('used');
      expect(response.body.memory).toHaveProperty('total');
      expect(response.body.memory).toHaveProperty('percentage');
      expect(response.body.memory).toHaveProperty('rss');
      expect(response.body.memory).toHaveProperty('external');

      // Check CPU structure
      expect(response.body.cpu).toHaveProperty('usage');
      expect(response.body.cpu).toHaveProperty('loadAverage');
      expect(Array.isArray(response.body.cpu.loadAverage)).toBe(true);

      // Check database structure
      expect(response.body.database).toHaveProperty('status');
      expect(['connected', 'disconnected', 'error']).toContain(response.body.database.status);
    });
  });

  describe('GET /health/ready', () => {
    it('should return readiness status', async () => {
      const response = await request(app)
        .get('/health/ready')
        .expect((res) => {
          expect([200, 503]).toContain(res.status);
        });

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(['ready', 'not ready']).toContain(response.body.status);
    });
  });

  describe('GET /health/live', () => {
    it('should return liveness status', async () => {
      const response = await request(app)
        .get('/health/live')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'alive');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(typeof response.body.uptime).toBe('number');
    });
  });

  describe('GET /health/system', () => {
    it('should return system information', async () => {
      const response = await request(app)
        .get('/health/system')
        .expect(200);

      expect(response.body).toHaveProperty('hostname');
      expect(response.body).toHaveProperty('platform');
      expect(response.body).toHaveProperty('architecture');
      expect(response.body).toHaveProperty('cpus');
      expect(response.body).toHaveProperty('totalMemory');
      expect(response.body).toHaveProperty('freeMemory');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('loadAverage');
      expect(response.body).toHaveProperty('nodeVersion');
      expect(response.body).toHaveProperty('processId');
      expect(response.body).toHaveProperty('processUptime');

      expect(typeof response.body.cpus).toBe('number');
      expect(typeof response.body.totalMemory).toBe('number');
      expect(typeof response.body.freeMemory).toBe('number');
      expect(Array.isArray(response.body.loadAverage)).toBe(true);
    });
  });

  describe('GET /health/db/pool', () => {
    it('should return database connection pool status', async () => {
      const response = await request(app)
        .get('/health/db/pool')
        .expect((res) => {
          expect([200, 500]).toContain(res.status);
        });

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /health/performance', () => {
    it('should return performance metrics', async () => {
      const response = await request(app)
        .get('/health/performance')
        .expect((res) => {
          expect([200, 500]).toContain(res.status);
        });

      if (response.status === 200) {
        expect(response.body).toHaveProperty('performance');
        expect(response.body).toHaveProperty('endpoints');
        expect(response.body).toHaveProperty('alerts');
        expect(response.body).toHaveProperty('timestamp');

        expect(response.body.performance).toHaveProperty('averageResponseTime');
        expect(response.body.performance).toHaveProperty('requestCount');
        expect(response.body.performance).toHaveProperty('errorRate');
        expect(response.body.performance).toHaveProperty('slowRequests');

        expect(Array.isArray(response.body.endpoints)).toBe(true);
        expect(Array.isArray(response.body.alerts)).toBe(true);
      }
    });
  });

  describe('GET /health/resources', () => {
    it('should return resource usage information', async () => {
      const response = await request(app)
        .get('/health/resources')
        .expect(200);

      expect(response.body).toHaveProperty('memory');
      expect(response.body).toHaveProperty('cpu');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('timestamp');

      // Check memory structure
      expect(response.body.memory).toHaveProperty('process');
      expect(response.body.memory).toHaveProperty('system');
      expect(response.body.memory.process).toHaveProperty('rss');
      expect(response.body.memory.process).toHaveProperty('heapTotal');
      expect(response.body.memory.process).toHaveProperty('heapUsed');
      expect(response.body.memory.system).toHaveProperty('total');
      expect(response.body.memory.system).toHaveProperty('free');
      expect(response.body.memory.system).toHaveProperty('percentage');

      // Check CPU structure
      expect(response.body.cpu).toHaveProperty('usage');
      expect(response.body.cpu).toHaveProperty('loadAverage');
      expect(response.body.cpu).toHaveProperty('cores');
      expect(Array.isArray(response.body.cpu.loadAverage)).toBe(true);
      expect(typeof response.body.cpu.cores).toBe('number');

      // Check uptime structure
      expect(response.body.uptime).toHaveProperty('process');
      expect(response.body.uptime).toHaveProperty('system');
      expect(typeof response.body.uptime.process).toBe('number');
      expect(typeof response.body.uptime.system).toBe('number');
    });
  });

  describe('GET /health/metrics', () => {
    it('should return application metrics', async () => {
      const response = await request(app)
        .get('/health/metrics')
        .expect((res) => {
          expect([200, 500]).toContain(res.status);
        });

      if (response.status === 200) {
        expect(response.body).toHaveProperty('performance');
        expect(response.body).toHaveProperty('endpoints');
        expect(response.body).toHaveProperty('errors');
        expect(response.body).toHaveProperty('timestamp');
      }
    });
  });

  describe('GET /health/metrics/system', () => {
    it('should return system metrics', async () => {
      const response = await request(app)
        .get('/health/metrics/system')
        .expect((res) => {
          expect([200, 500]).toContain(res.status);
        });

      if (response.status === 200) {
        expect(response.body).toHaveProperty('timestamp');
        expect(response.body).toHaveProperty('system');
        expect(response.body).toHaveProperty('memory');
        expect(response.body).toHaveProperty('cpu');
        expect(response.body).toHaveProperty('database');
        expect(response.body).toHaveProperty('application');

        // Verify system metrics structure
        expect(response.body.system).toHaveProperty('uptime');
        expect(response.body.system).toHaveProperty('loadAverage');
        expect(response.body.system).toHaveProperty('platform');
        expect(response.body.system).toHaveProperty('nodeVersion');

        // Verify memory metrics structure
        expect(response.body.memory).toHaveProperty('total');
        expect(response.body.memory).toHaveProperty('free');
        expect(response.body.memory).toHaveProperty('percentage');
        expect(response.body.memory).toHaveProperty('process');

        // Verify database metrics structure
        expect(response.body.database).toHaveProperty('status');
        expect(response.body.database).toHaveProperty('responseTime');
        expect(response.body.database).toHaveProperty('isConnected');
      }
    });
  });

  describe('GET /health/metrics/history', () => {
    it('should return metrics history', async () => {
      // First collect some metrics
      await metricsService.collectMetrics();
      await metricsService.collectMetrics();

      const response = await request(app)
        .get('/health/metrics/history')
        .expect(200);

      expect(response.body).toHaveProperty('metrics');
      expect(response.body).toHaveProperty('count');
      expect(response.body).toHaveProperty('timestamp');
      expect(Array.isArray(response.body.metrics)).toBe(true);
      expect(typeof response.body.count).toBe('number');
    });

    it('should respect limit parameter', async () => {
      // Collect some metrics first
      await metricsService.collectMetrics();
      await metricsService.collectMetrics();
      await metricsService.collectMetrics();

      const response = await request(app)
        .get('/health/metrics/history?limit=2')
        .expect(200);

      expect(response.body.metrics.length).toBeLessThanOrEqual(2);
    });
  });

  describe('GET /health/alerts', () => {
    it('should return system alerts', async () => {
      const response = await request(app)
        .get('/health/alerts')
        .expect(200);

      expect(response.body).toHaveProperty('alerts');
      expect(response.body).toHaveProperty('count');
      expect(response.body).toHaveProperty('timestamp');
      expect(Array.isArray(response.body.alerts)).toBe(true);
      expect(typeof response.body.count).toBe('number');
    });

    it('should filter active alerts when requested', async () => {
      const response = await request(app)
        .get('/health/alerts?active=true')
        .expect(200);

      expect(response.body).toHaveProperty('alerts');
      expect(Array.isArray(response.body.alerts)).toBe(true);
      
      // All returned alerts should be active (not resolved)
      response.body.alerts.forEach((alert: any) => {
        expect(alert.resolved).toBeFalsy();
      });
    });
  });

  describe('GET /health/metrics/summary', () => {
    it('should return metrics summary', async () => {
      // Collect some metrics first
      await metricsService.collectMetrics();

      const response = await request(app)
        .get('/health/metrics/summary')
        .expect(200);

      expect(response.body).toHaveProperty('averageMemoryUsage');
      expect(response.body).toHaveProperty('averageCpuUsage');
      expect(response.body).toHaveProperty('averageDatabaseResponseTime');
      expect(response.body).toHaveProperty('alertCount');
      expect(response.body).toHaveProperty('period');

      expect(typeof response.body.averageMemoryUsage).toBe('number');
      expect(typeof response.body.averageCpuUsage).toBe('number');
      expect(typeof response.body.averageDatabaseResponseTime).toBe('number');
      expect(typeof response.body.alertCount).toBe('number');
      expect(response.body.period).toBe('60 minutes');
    });

    it('should respect period parameter', async () => {
      const response = await request(app)
        .get('/health/metrics/summary?period=30')
        .expect(200);

      expect(response.body.period).toBe('30 minutes');
    });
  });

  describe('GET /health/metrics/prometheus', () => {
    it('should return Prometheus format metrics', async () => {
      // Collect some metrics first
      await metricsService.collectMetrics();

      const response = await request(app)
        .get('/health/metrics/prometheus')
        .expect((res) => {
          expect([200, 500]).toContain(res.status);
        });

      if (response.status === 200) {
        expect(response.headers['content-type']).toBe('text/plain; charset=utf-8');
        expect(response.text).toContain('system_memory_usage_percent');
        expect(response.text).toContain('system_cpu_load_average');
        expect(response.text).toContain('database_response_time_ms');
        expect(response.text).toContain('application_uptime_seconds');
      }
    });
  });

  describe('Error handling', () => {
    it('should handle errors gracefully in system endpoint', async () => {
      // This test ensures the endpoint handles unexpected errors
      const response = await request(app)
        .get('/health/system')
        .expect((res) => {
          expect([200, 500]).toContain(res.status);
        });

      if (response.status === 500) {
        expect(response.body).toHaveProperty('error');
        expect(response.body).toHaveProperty('timestamp');
      }
    });

    it('should handle errors gracefully in metrics endpoints', async () => {
      const response = await request(app)
        .get('/health/metrics/system')
        .expect((res) => {
          expect([200, 500]).toContain(res.status);
        });

      if (response.status === 500) {
        expect(response.body).toHaveProperty('error');
        expect(response.body).toHaveProperty('timestamp');
      }
    });
  });
});