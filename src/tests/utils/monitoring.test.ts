import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response } from 'express';
import {
  MonitoringService,
  requestMetricsMiddleware,
  healthCheckHandler,
  metricsHandler
} from '../../utils/monitoring';

describe('MonitoringService', () => {
  beforeEach(() => {
    // Clear metrics
    (MonitoringService as any).requestMetrics.clear();
    (MonitoringService as any).metricsResetTime = Date.now();
  });

  describe('recordRequest', () => {
    it('should record successful request metrics', () => {
      const req = {
        method: 'GET',
        route: { path: '/api/test' },
        path: '/api/test',
        originalUrl: '/api/test'
      } as any;

      const res = {
        statusCode: 200
      } as any;

      MonitoringService.recordRequest(req, res, 150);

      const performanceMetrics = MonitoringService.getPerformanceMetrics();
      expect(performanceMetrics.requestCount).toBe(1);
      expect(performanceMetrics.averageResponseTime).toBe(150);
      expect(performanceMetrics.errorRate).toBe(0);
    });

    it('should record error request metrics', () => {
      const req = {
        method: 'POST',
        route: { path: '/api/test' },
        path: '/api/test',
        originalUrl: '/api/test'
      } as any;

      const res = {
        statusCode: 400
      } as any;

      MonitoringService.recordRequest(req, res, 200);

      const performanceMetrics = MonitoringService.getPerformanceMetrics();
      expect(performanceMetrics.requestCount).toBe(1);
      expect(performanceMetrics.errorRate).toBe(100); // 100% error rate
    });

    it('should track slow requests', () => {
      const mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const req = {
        method: 'GET',
        route: { path: '/api/slow' },
        path: '/api/slow',
        originalUrl: '/api/slow'
      } as any;

      const res = {
        statusCode: 200
      } as any;

      MonitoringService.recordRequest(req, res, 2000); // 2 seconds (slow)

      expect(mockConsoleWarn).toHaveBeenCalledWith(
        'Slow Request Detected:',
        expect.stringContaining('2000ms')
      );

      mockConsoleWarn.mockRestore();
    });

    it('should aggregate metrics for same endpoint', () => {
      const req = {
        method: 'GET',
        route: { path: '/api/test' },
        path: '/api/test',
        originalUrl: '/api/test'
      } as any;

      const res = {
        statusCode: 200
      } as any;

      // Record multiple requests
      MonitoringService.recordRequest(req, res, 100);
      MonitoringService.recordRequest(req, res, 200);
      MonitoringService.recordRequest(req, res, 300);

      const performanceMetrics = MonitoringService.getPerformanceMetrics();
      expect(performanceMetrics.requestCount).toBe(3);
      expect(performanceMetrics.averageResponseTime).toBe(200); // (100+200+300)/3
    });
  });

  describe('getHealthMetrics', () => {
    it('should return health metrics', async () => {
      const healthMetrics = await MonitoringService.getHealthMetrics();

      expect(healthMetrics).toHaveProperty('status');
      expect(healthMetrics).toHaveProperty('timestamp');
      expect(healthMetrics).toHaveProperty('uptime');
      expect(healthMetrics).toHaveProperty('memory');
      expect(healthMetrics).toHaveProperty('errors');
      expect(healthMetrics).toHaveProperty('database');
      expect(healthMetrics).toHaveProperty('version');
      expect(healthMetrics).toHaveProperty('environment');

      expect(['healthy', 'degraded', 'unhealthy']).toContain(healthMetrics.status);
      expect(typeof healthMetrics.uptime).toBe('number');
      expect(healthMetrics.memory).toHaveProperty('used');
      expect(healthMetrics.memory).toHaveProperty('total');
      expect(healthMetrics.memory).toHaveProperty('percentage');
    });

    it('should determine health status based on conditions', async () => {
      // Mock error logger to return high error count
      const { ErrorLogger } = await import('../../middleware/error-handler');
      const mockGetHealthMetrics = vi.spyOn(
        ErrorLogger,
        'getHealthMetrics'
      ).mockReturnValue({
        totalErrors: 150, // High error count
        errorTypes: 5,
        lastResetTime: new Date().toISOString(),
        uptime: '3600'
      });

      const healthMetrics = await MonitoringService.getHealthMetrics();
      expect(healthMetrics.status).toBe('unhealthy');

      mockGetHealthMetrics.mockRestore();
    });
  });

  describe('getPerformanceMetrics', () => {
    it('should return performance metrics', () => {
      const performanceMetrics = MonitoringService.getPerformanceMetrics();

      expect(performanceMetrics).toHaveProperty('averageResponseTime');
      expect(performanceMetrics).toHaveProperty('requestCount');
      expect(performanceMetrics).toHaveProperty('errorRate');
      expect(performanceMetrics).toHaveProperty('slowRequests');
      expect(performanceMetrics).toHaveProperty('timestamp');

      expect(typeof performanceMetrics.averageResponseTime).toBe('number');
      expect(typeof performanceMetrics.requestCount).toBe('number');
      expect(typeof performanceMetrics.errorRate).toBe('number');
      expect(typeof performanceMetrics.slowRequests).toBe('number');
    });

    it('should return zero metrics when no requests recorded', () => {
      const performanceMetrics = MonitoringService.getPerformanceMetrics();

      expect(performanceMetrics.averageResponseTime).toBe(0);
      expect(performanceMetrics.requestCount).toBe(0);
      expect(performanceMetrics.errorRate).toBe(0);
      expect(performanceMetrics.slowRequests).toBe(0);
    });
  });

  describe('getEndpointMetrics', () => {
    it('should return endpoint-specific metrics', () => {
      const req = {
        method: 'GET',
        route: { path: '/api/users' },
        path: '/api/users',
        originalUrl: '/api/users'
      } as any;

      const res = {
        statusCode: 200
      } as any;

      MonitoringService.recordRequest(req, res, 150);

      const endpointMetrics = MonitoringService.getEndpointMetrics();
      expect(endpointMetrics).toHaveLength(1);
      expect(endpointMetrics[0]).toEqual({
        endpoint: 'GET /api/users',
        requestCount: 1,
        averageResponseTime: 150,
        errorRate: 0
      });
    });
  });

  describe('checkAlerts', () => {
    it('should return alerts for high error rate', () => {
      const req = {
        method: 'GET',
        route: { path: '/api/test' },
        path: '/api/test',
        originalUrl: '/api/test'
      } as any;

      // Record requests with high error rate
      for (let i = 0; i < 10; i++) {
        const res = { statusCode: i < 8 ? 500 : 200 } as any; // 80% error rate
        MonitoringService.recordRequest(req, res, 100);
      }

      const alerts = MonitoringService.checkAlerts();
      const errorRateAlert = alerts.find(alert => alert.type === 'HIGH_ERROR_RATE');
      
      expect(errorRateAlert).toBeDefined();
      expect(errorRateAlert!.severity).toBe('critical'); // 80% > 20%
      expect(errorRateAlert!.value).toBe(80);
    });

    it('should return alerts for slow response time', () => {
      const req = {
        method: 'GET',
        route: { path: '/api/slow' },
        path: '/api/slow',
        originalUrl: '/api/slow'
      } as any;

      const res = { statusCode: 200 } as any;

      // Record slow requests
      MonitoringService.recordRequest(req, res, 3000); // 3 seconds

      const alerts = MonitoringService.checkAlerts();
      const responseTimeAlert = alerts.find(alert => alert.type === 'SLOW_RESPONSE_TIME');
      
      expect(responseTimeAlert).toBeDefined();
      expect(responseTimeAlert!.value).toBe(3000);
      expect(responseTimeAlert!.threshold).toBe(2000);
    });

    it('should return no alerts when metrics are healthy', () => {
      const req = {
        method: 'GET',
        route: { path: '/api/healthy' },
        path: '/api/healthy',
        originalUrl: '/api/healthy'
      } as any;

      const res = { statusCode: 200 } as any;

      MonitoringService.recordRequest(req, res, 100); // Fast, successful request

      const alerts = MonitoringService.checkAlerts();
      expect(alerts).toHaveLength(0);
    });
  });

  describe('startMetricsLogging', () => {
    it('should start periodic metrics logging', () => {
      const mockConsoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {});
      
      const interval = MonitoringService.startMetricsLogging(100); // 100ms for testing
      
      // Wait for at least one log cycle
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          clearInterval(interval);
          expect(mockConsoleInfo).toHaveBeenCalledWith(
            'System Metrics:',
            expect.any(String)
          );
          mockConsoleInfo.mockRestore();
          resolve();
        }, 150);
      });
    });
  });
});

describe('requestMetricsMiddleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: Function;

  beforeEach(() => {
    req = {
      method: 'GET',
      route: { path: '/api/test' },
      path: '/api/test',
      originalUrl: '/api/test'
    };
    res = {
      statusCode: 200,
      end: vi.fn()
    };
    next = vi.fn();
  });

  it('should override res.end to capture metrics', () => {
    const originalEnd = res.end;
    
    requestMetricsMiddleware(req as Request, res as Response, next);
    
    expect(res.end).not.toBe(originalEnd);
    expect(next).toHaveBeenCalled();
  });

  it('should record metrics when response ends', () => {
    const recordRequestSpy = vi.spyOn(MonitoringService, 'recordRequest');
    
    requestMetricsMiddleware(req as Request, res as Response, next);
    
    // Simulate response end
    res.end!();
    
    expect(recordRequestSpy).toHaveBeenCalledWith(
      req,
      res,
      expect.any(Number)
    );
    
    recordRequestSpy.mockRestore();
  });
});

describe('healthCheckHandler', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;

  beforeEach(() => {
    req = {};
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
  });

  it('should return health metrics with 200 status for healthy system', async () => {
    // Mock healthy system
    const mockGetHealthMetrics = vi.spyOn(MonitoringService, 'getHealthMetrics')
      .mockResolvedValue({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: 3600,
        memory: { used: 1000, total: 2000, percentage: 50 },
        errors: { totalErrors: 0, errorTypes: 0, lastResetTime: new Date().toISOString() },
        database: { status: 'connected', responseTime: 10 },
        version: '1.0.0',
        environment: 'test'
      });

    await healthCheckHandler(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'healthy'
      })
    );

    mockGetHealthMetrics.mockRestore();
  });

  it('should return 503 status for unhealthy system', async () => {
    // Mock unhealthy system
    const mockGetHealthMetrics = vi.spyOn(MonitoringService, 'getHealthMetrics')
      .mockResolvedValue({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: 3600,
        memory: { used: 1000, total: 2000, percentage: 50 },
        errors: { totalErrors: 200, errorTypes: 10, lastResetTime: new Date().toISOString() },
        database: { status: 'error' },
        version: '1.0.0',
        environment: 'test'
      });

    await healthCheckHandler(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'unhealthy'
      })
    );

    mockGetHealthMetrics.mockRestore();
  });

  it('should handle errors gracefully', async () => {
    // Mock error in health check
    const mockGetHealthMetrics = vi.spyOn(MonitoringService, 'getHealthMetrics')
      .mockRejectedValue(new Error('Health check failed'));

    await healthCheckHandler(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'unhealthy',
        error: 'Health check failed'
      })
    );

    mockGetHealthMetrics.mockRestore();
  });
});

describe('metricsHandler', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;

  beforeEach(() => {
    req = {};
    res = {
      json: vi.fn()
    };
  });

  it('should return comprehensive metrics', async () => {
    const mockGetPerformanceMetrics = vi.spyOn(MonitoringService, 'getPerformanceMetrics')
      .mockReturnValue({
        averageResponseTime: 150,
        requestCount: 100,
        errorRate: 5,
        slowRequests: 2,
        timestamp: new Date().toISOString()
      });

    const mockGetEndpointMetrics = vi.spyOn(MonitoringService, 'getEndpointMetrics')
      .mockReturnValue([
        {
          endpoint: 'GET /api/users',
          requestCount: 50,
          averageResponseTime: 120,
          errorRate: 2
        }
      ]);

    const { ErrorLogger } = await import('../../middleware/error-handler');
    const mockGetErrorStats = vi.spyOn(
      ErrorLogger,
      'getErrorStats'
    ).mockReturnValue([
      { errorType: 'VALIDATION_ERROR', count: 5 }
    ]);

    metricsHandler(req as Request, res as Response);

    expect(res.json).toHaveBeenCalledWith({
      performance: expect.objectContaining({
        averageResponseTime: 150,
        requestCount: 100,
        errorRate: 5,
        slowRequests: 2
      }),
      endpoints: expect.arrayContaining([
        expect.objectContaining({
          endpoint: 'GET /api/users'
        })
      ]),
      errors: expect.arrayContaining([
        expect.objectContaining({
          errorType: 'VALIDATION_ERROR'
        })
      ]),
      timestamp: expect.any(String)
    });

    mockGetPerformanceMetrics.mockRestore();
    mockGetEndpointMetrics.mockRestore();
    mockGetErrorStats.mockRestore();
  });
});