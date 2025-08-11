import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SystemMetricsService, SystemMetrics, MetricsAlert } from '../../services/system-metrics';
import DatabaseService from '../../services/database';

// Mock the database service
vi.mock('../../services/database');
const mockDatabaseService = vi.mocked(DatabaseService);

describe('SystemMetricsService', () => {
  let metricsService: SystemMetricsService;
  let mockDbInstance: any;

  beforeEach(() => {
    // Reset the singleton instance
    (SystemMetricsService as any).instance = undefined;
    metricsService = SystemMetricsService.getInstance();

    // Mock database service instance
    mockDbInstance = {
      healthCheck: vi.fn(),
      isHealthy: vi.fn()
    };
    mockDatabaseService.getInstance.mockReturnValue(mockDbInstance);
  });

  afterEach(() => {
    metricsService.stopCollection();
    vi.clearAllMocks();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = SystemMetricsService.getInstance();
      const instance2 = SystemMetricsService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('collectMetrics', () => {
    it('should collect system metrics successfully', async () => {
      // Mock database health check
      mockDbInstance.healthCheck.mockResolvedValue({
        status: 'healthy',
        responseTime: 50,
        timestamp: new Date().toISOString()
      });
      mockDbInstance.isHealthy.mockReturnValue(true);

      const metrics = await metricsService.collectMetrics();

      expect(metrics).toHaveProperty('timestamp');
      expect(metrics).toHaveProperty('system');
      expect(metrics).toHaveProperty('memory');
      expect(metrics).toHaveProperty('cpu');
      expect(metrics).toHaveProperty('database');
      expect(metrics).toHaveProperty('application');

      expect(metrics.system).toHaveProperty('uptime');
      expect(metrics.system).toHaveProperty('loadAverage');
      expect(metrics.system).toHaveProperty('platform');
      expect(metrics.system).toHaveProperty('nodeVersion');

      expect(metrics.memory).toHaveProperty('total');
      expect(metrics.memory).toHaveProperty('free');
      expect(metrics.memory).toHaveProperty('used');
      expect(metrics.memory).toHaveProperty('percentage');
      expect(metrics.memory).toHaveProperty('process');

      expect(metrics.database.status).toBe('healthy');
      expect(metrics.database.responseTime).toBe(50);
      expect(metrics.database.isConnected).toBe(true);
    });

    it('should handle database health check failure', async () => {
      // Mock database health check failure
      mockDbInstance.healthCheck.mockRejectedValue(new Error('Database connection failed'));
      mockDbInstance.isHealthy.mockReturnValue(false);

      const metrics = await metricsService.collectMetrics();

      expect(metrics.database.status).toBe('unhealthy');
      expect(metrics.database.isConnected).toBe(false);
    });

    it('should add metrics to history', async () => {
      mockDbInstance.healthCheck.mockResolvedValue({
        status: 'healthy',
        responseTime: 50,
        timestamp: new Date().toISOString()
      });
      mockDbInstance.isHealthy.mockReturnValue(true);

      await metricsService.collectMetrics();
      await metricsService.collectMetrics();

      const history = metricsService.getMetricsHistory();
      expect(history).toHaveLength(2);
    });
  });

  describe('startCollection and stopCollection', () => {
    it('should start and stop metrics collection', (done) => {
      mockDbInstance.healthCheck.mockResolvedValue({
        status: 'healthy',
        responseTime: 50,
        timestamp: new Date().toISOString()
      });
      mockDbInstance.isHealthy.mockReturnValue(true);

      let metricsCollected = 0;
      metricsService.on('metrics', () => {
        metricsCollected++;
        if (metricsCollected >= 2) {
          metricsService.stopCollection();
          expect(metricsCollected).toBeGreaterThanOrEqual(2);
          done();
        }
      });

      metricsService.startCollection(100); // Collect every 100ms for testing
    });

    it('should not start collection if already started', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      metricsService.startCollection(1000);
      metricsService.startCollection(1000);

      expect(consoleSpy).toHaveBeenCalledWith('Metrics collection already started');
      consoleSpy.mockRestore();
    });
  });

  describe('getMetricsHistory', () => {
    beforeEach(async () => {
      mockDbInstance.healthCheck.mockResolvedValue({
        status: 'healthy',
        responseTime: 50,
        timestamp: new Date().toISOString()
      });
      mockDbInstance.isHealthy.mockReturnValue(true);

      // Add some metrics to history
      await metricsService.collectMetrics();
      await metricsService.collectMetrics();
      await metricsService.collectMetrics();
    });

    it('should return all metrics history when no limit specified', () => {
      const history = metricsService.getMetricsHistory();
      expect(history).toHaveLength(3);
    });

    it('should return limited metrics history when limit specified', () => {
      const history = metricsService.getMetricsHistory(2);
      expect(history).toHaveLength(2);
    });
  });

  describe('getCurrentMetrics', () => {
    it('should return null when no metrics collected', () => {
      const current = metricsService.getCurrentMetrics();
      expect(current).toBeNull();
    });

    it('should return latest metrics when available', async () => {
      mockDbInstance.healthCheck.mockResolvedValue({
        status: 'healthy',
        responseTime: 50,
        timestamp: new Date().toISOString()
      });
      mockDbInstance.isHealthy.mockReturnValue(true);

      await metricsService.collectMetrics();
      const current = metricsService.getCurrentMetrics();
      
      expect(current).not.toBeNull();
      expect(current).toHaveProperty('timestamp');
    });
  });

  describe('getMetricsSummary', () => {
    beforeEach(async () => {
      mockDbInstance.healthCheck.mockResolvedValue({
        status: 'healthy',
        responseTime: 100,
        timestamp: new Date().toISOString()
      });
      mockDbInstance.isHealthy.mockReturnValue(true);

      // Add some metrics to history
      await metricsService.collectMetrics();
      await metricsService.collectMetrics();
    });

    it('should return metrics summary for specified period', () => {
      const summary = metricsService.getMetricsSummary(60);
      
      expect(summary).toHaveProperty('averageMemoryUsage');
      expect(summary).toHaveProperty('averageCpuUsage');
      expect(summary).toHaveProperty('averageDatabaseResponseTime');
      expect(summary).toHaveProperty('alertCount');
      expect(summary).toHaveProperty('period');
      
      expect(summary.period).toBe('60 minutes');
      expect(summary.averageDatabaseResponseTime).toBe(100);
    });

    it('should return zero values when no metrics in period', () => {
      // Clear any existing metrics first
      (metricsService as any).metricsHistory = [];
      
      const summary = metricsService.getMetricsSummary(0); // 0 minutes = no metrics
      
      expect(summary.averageMemoryUsage).toBe(0);
      expect(summary.averageCpuUsage).toBe(0);
      expect(summary.averageDatabaseResponseTime).toBe(0);
      expect(summary.alertCount).toBe(0);
    });
  });

  describe('exportMetrics', () => {
    beforeEach(async () => {
      mockDbInstance.healthCheck.mockResolvedValue({
        status: 'healthy',
        responseTime: 50,
        timestamp: new Date().toISOString()
      });
      mockDbInstance.isHealthy.mockReturnValue(true);

      await metricsService.collectMetrics();
    });

    it('should export metrics in JSON format', () => {
      const exported = metricsService.exportMetrics('json');
      const parsed = JSON.parse(exported);
      
      expect(parsed).toHaveProperty('timestamp');
      expect(parsed).toHaveProperty('system');
      expect(parsed).toHaveProperty('memory');
    });

    it('should export metrics in Prometheus format', () => {
      const exported = metricsService.exportMetrics('prometheus');
      
      expect(exported).toContain('system_memory_usage_percent');
      expect(exported).toContain('system_cpu_load_average');
      expect(exported).toContain('database_response_time_ms');
      expect(exported).toContain('application_uptime_seconds');
    });

    it('should return empty string for Prometheus format when no metrics', () => {
      // Clear metrics history to simulate no metrics
      (metricsService as any).metricsHistory = [];
      
      const exported = metricsService.exportMetrics('prometheus');
      expect(exported).toBe('');
    });
  });

  describe('alert system', () => {
    it('should emit alerts when thresholds are exceeded', async () => {
      // Mock high memory usage scenario
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = vi.fn().mockReturnValue({
        rss: 1000000000,
        heapTotal: 1000000000,
        heapUsed: 950000000, // 95% usage - should trigger critical alert
        external: 0,
        arrayBuffers: 0
      });

      mockDbInstance.healthCheck.mockResolvedValue({
        status: 'healthy',
        responseTime: 50,
        timestamp: new Date().toISOString()
      });
      mockDbInstance.isHealthy.mockReturnValue(true);

      return new Promise<void>((resolve) => {
        metricsService.on('alert', (alert: MetricsAlert) => {
          expect(alert.type).toBe('memory');
          expect(alert.severity).toBe('critical');
          expect(alert.value).toBeGreaterThan(90);
          
          // Restore original function
          process.memoryUsage = originalMemoryUsage;
          resolve();
        });

        metricsService.collectMetrics();
      });
    });

    it('should track active alerts', async () => {
      // Mock unhealthy database
      mockDbInstance.healthCheck.mockResolvedValue({
        status: 'unhealthy',
        responseTime: 5000,
        timestamp: new Date().toISOString()
      });
      mockDbInstance.isHealthy.mockReturnValue(false);

      await metricsService.collectMetrics();
      
      const activeAlerts = metricsService.getActiveAlerts();
      expect(activeAlerts.length).toBeGreaterThan(0);
      
      const databaseAlert = activeAlerts.find(alert => alert.type === 'database');
      expect(databaseAlert).toBeDefined();
      expect(databaseAlert?.severity).toBe('critical');
    });
  });
});