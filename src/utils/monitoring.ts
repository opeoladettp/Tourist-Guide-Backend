import { Request, Response } from 'express';
import { ErrorLogger } from '../middleware/error-handler';

// System health metrics
export interface HealthMetrics {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
    rss: number;
    external: number;
  };
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  errors: {
    totalErrors: number;
    errorTypes: number;
    lastResetTime: string;
  };
  database: {
    status: 'connected' | 'disconnected' | 'error';
    responseTime?: number;
    connectionPool?: {
      active: number;
      idle: number;
      total: number;
    };
  };
  fileSystem: {
    diskUsage?: {
      total: number;
      used: number;
      available: number;
      percentage: number;
    };
  };
  network: {
    activeConnections: number;
  };
  version: string;
  environment: string;
  nodeVersion: string;
  platform: string;
}

// Performance metrics
export interface PerformanceMetrics {
  averageResponseTime: number;
  requestCount: number;
  errorRate: number;
  slowRequests: number;
  timestamp: string;
}

// Monitoring service
export class MonitoringService {
  private static requestMetrics: Map<string, { count: number; totalTime: number; errors: number }> = new Map();
  private static slowRequestThreshold = 1000; // 1 second
  private static metricsResetTime = Date.now();
  private static readonly METRICS_RESET_INTERVAL = 60 * 60 * 1000; // 1 hour

  // Record request metrics
  static recordRequest(req: Request, res: Response, duration: number): void {
    const endpoint = `${req.method} ${req.route?.path || req.path}`;
    const isError = res.statusCode >= 400;
    
    const metrics = this.requestMetrics.get(endpoint) || { count: 0, totalTime: 0, errors: 0 };
    metrics.count++;
    metrics.totalTime += duration;
    
    if (isError) {
      metrics.errors++;
    }
    
    this.requestMetrics.set(endpoint, metrics);

    // Log slow requests
    if (duration > this.slowRequestThreshold) {
      console.warn('Slow Request Detected:', JSON.stringify({
        endpoint,
        duration: `${duration}ms`,
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        timestamp: new Date().toISOString()
      }));
    }

    // Reset metrics periodically
    if (Date.now() - this.metricsResetTime > this.METRICS_RESET_INTERVAL) {
      this.requestMetrics.clear();
      this.metricsResetTime = Date.now();
    }
  }

  // Get system health metrics
  static async getHealthMetrics(): Promise<HealthMetrics> {
    const memoryUsage = process.memoryUsage();
    const errorStats = ErrorLogger.getHealthMetrics();
    const cpuUsage = process.cpuUsage();
    const loadAverage = require('os').loadavg();
    
    // Check database health with actual database service
    let databaseStatus: 'connected' | 'disconnected' | 'error' = 'connected';
    let dbResponseTime: number | undefined;
    let connectionPool: { active: number; idle: number; total: number } | undefined;
    
    try {
      const { default: DatabaseService } = await import('../services/database');
      const dbService = DatabaseService.getInstance();
      const startTime = Date.now();
      
      const healthCheck = await dbService.healthCheck();
      dbResponseTime = Date.now() - startTime;
      databaseStatus = healthCheck.status === 'healthy' ? 'connected' : 'error';
      
      // Get connection pool stats if available
      const client = dbService.getClient();
      if (client && (client as any)._engine && (client as any)._engine.connectionPool) {
        const pool = (client as any)._engine.connectionPool;
        connectionPool = {
          active: pool.activeConnections || 0,
          idle: pool.idleConnections || 0,
          total: pool.totalConnections || 0
        };
      }
    } catch (error) {
      databaseStatus = 'error';
      console.error('Database health check failed:', error);
    }

    // Get file system stats
    let diskUsage: { total: number; used: number; available: number; percentage: number } | undefined;
    try {
      const fs = require('fs');
      const stats = fs.statSync(process.cwd());
      // Note: This is a simplified disk usage check
      // In production, you'd use a proper disk usage library
      diskUsage = {
        total: 0,
        used: 0,
        available: 0,
        percentage: 0
      };
    } catch (error) {
      // Disk usage check failed, continue without it
    }

    // Get network stats (simplified)
    const activeConnections = process.listenerCount('connection') || 0;

    // Calculate CPU usage percentage
    const cpuPercent = Math.round(((cpuUsage.user + cpuUsage.system) / 1000000) * 100) / 100;

    // Determine overall health status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    const memoryPercentage = Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100);
    
    if (databaseStatus === 'error' || errorStats.totalErrors > 100 || memoryPercentage > 90) {
      status = 'unhealthy';
    } else if (errorStats.totalErrors > 50 || memoryPercentage > 80) {
      status = 'degraded';
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        used: memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
        percentage: memoryPercentage,
        rss: memoryUsage.rss,
        external: memoryUsage.external
      },
      cpu: {
        usage: cpuPercent,
        loadAverage
      },
      errors: errorStats,
      database: {
        status: databaseStatus,
        responseTime: dbResponseTime,
        connectionPool
      },
      fileSystem: {
        diskUsage
      },
      network: {
        activeConnections
      },
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      platform: process.platform
    };
  }

  // Get performance metrics
  static getPerformanceMetrics(): PerformanceMetrics {
    let totalRequests = 0;
    let totalTime = 0;
    let totalErrors = 0;
    let slowRequests = 0;

    for (const metrics of this.requestMetrics.values()) {
      totalRequests += metrics.count;
      totalTime += metrics.totalTime;
      totalErrors += metrics.errors;
      
      // Count slow requests (average response time > threshold)
      const avgTime = metrics.totalTime / metrics.count;
      if (avgTime > this.slowRequestThreshold) {
        slowRequests += metrics.count;
      }
    }

    return {
      averageResponseTime: totalRequests > 0 ? Math.round(totalTime / totalRequests) : 0,
      requestCount: totalRequests,
      errorRate: totalRequests > 0 ? Math.round((totalErrors / totalRequests) * 100) : 0,
      slowRequests,
      timestamp: new Date().toISOString()
    };
  }

  // Get detailed endpoint metrics
  static getEndpointMetrics(): Array<{
    endpoint: string;
    requestCount: number;
    averageResponseTime: number;
    errorRate: number;
  }> {
    return Array.from(this.requestMetrics.entries()).map(([endpoint, metrics]) => ({
      endpoint,
      requestCount: metrics.count,
      averageResponseTime: Math.round(metrics.totalTime / metrics.count),
      errorRate: Math.round((metrics.errors / metrics.count) * 100)
    }));
  }

  // Alert thresholds configuration
  static readonly ALERT_THRESHOLDS = {
    ERROR_RATE: 10, // 10% error rate
    RESPONSE_TIME: 2000, // 2 seconds average response time
    MEMORY_USAGE: 80, // 80% memory usage
    DATABASE_RESPONSE_TIME: 500 // 500ms database response time
  };

  // Check if alerts should be triggered
  static checkAlerts(): Array<{
    type: string;
    severity: 'warning' | 'critical';
    message: string;
    value: number;
    threshold: number;
  }> {
    const alerts: Array<{
      type: string;
      severity: 'warning' | 'critical';
      message: string;
      value: number;
      threshold: number;
    }> = [];

    const performanceMetrics = this.getPerformanceMetrics();
    const memoryUsage = process.memoryUsage();
    const memoryPercentage = Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100);

    // Check error rate
    if (performanceMetrics.errorRate > this.ALERT_THRESHOLDS.ERROR_RATE) {
      alerts.push({
        type: 'HIGH_ERROR_RATE',
        severity: performanceMetrics.errorRate > 20 ? 'critical' : 'warning',
        message: `Error rate is ${performanceMetrics.errorRate}%`,
        value: performanceMetrics.errorRate,
        threshold: this.ALERT_THRESHOLDS.ERROR_RATE
      });
    }

    // Check response time
    if (performanceMetrics.averageResponseTime > this.ALERT_THRESHOLDS.RESPONSE_TIME) {
      alerts.push({
        type: 'SLOW_RESPONSE_TIME',
        severity: performanceMetrics.averageResponseTime > 5000 ? 'critical' : 'warning',
        message: `Average response time is ${performanceMetrics.averageResponseTime}ms`,
        value: performanceMetrics.averageResponseTime,
        threshold: this.ALERT_THRESHOLDS.RESPONSE_TIME
      });
    }

    // Check memory usage
    if (memoryPercentage > this.ALERT_THRESHOLDS.MEMORY_USAGE) {
      alerts.push({
        type: 'HIGH_MEMORY_USAGE',
        severity: memoryPercentage > 90 ? 'critical' : 'warning',
        message: `Memory usage is ${memoryPercentage}%`,
        value: memoryPercentage,
        threshold: this.ALERT_THRESHOLDS.MEMORY_USAGE
      });
    }

    return alerts;
  }

  // Log system metrics periodically
  static startMetricsLogging(intervalMs: number = 300000): NodeJS.Timeout { // Default 5 minutes
    return setInterval(async () => {
      const healthMetrics = await this.getHealthMetrics();
      const performanceMetrics = this.getPerformanceMetrics();
      const alerts = this.checkAlerts();

      console.info('System Metrics:', JSON.stringify({
        health: healthMetrics,
        performance: performanceMetrics,
        alerts: alerts.length > 0 ? alerts : undefined
      }, null, 2));

      // Log alerts separately for visibility
      if (alerts.length > 0) {
        console.warn('System Alerts:', JSON.stringify(alerts, null, 2));
      }
    }, intervalMs);
  }
}

// Request metrics middleware
export function requestMetricsMiddleware(req: Request, res: Response, next: Function): void {
  const startTime = Date.now();

  // Override res.end to capture metrics
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    const duration = Date.now() - startTime;
    MonitoringService.recordRequest(req, res, duration);
    return originalEnd.call(this, chunk, encoding);
  };

  next();
}

// Health check endpoint handler
export async function healthCheckHandler(req: Request, res: Response): Promise<void> {
  try {
    const healthMetrics = await MonitoringService.getHealthMetrics();
    const statusCode = healthMetrics.status === 'healthy' ? 200 : 
                      healthMetrics.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json(healthMetrics);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
}

// Metrics endpoint handler
export function metricsHandler(req: Request, res: Response): void {
  const performanceMetrics = MonitoringService.getPerformanceMetrics();
  const endpointMetrics = MonitoringService.getEndpointMetrics();
  const errorStats = ErrorLogger.getErrorStats();

  res.json({
    performance: performanceMetrics,
    endpoints: endpointMetrics,
    errors: errorStats,
    timestamp: new Date().toISOString()
  });
}