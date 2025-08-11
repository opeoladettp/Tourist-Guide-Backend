import { EventEmitter } from 'events';
import DatabaseService from './database';

// System metrics interfaces
export interface SystemMetrics {
  timestamp: string;
  system: {
    uptime: number;
    loadAverage: number[];
    platform: string;
    nodeVersion: string;
  };
  memory: {
    total: number;
    free: number;
    used: number;
    percentage: number;
    process: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
    };
  };
  cpu: {
    cores: number;
    usage: {
      user: number;
      system: number;
    };
    loadAverage: number[];
  };
  database: {
    status: 'healthy' | 'unhealthy';
    responseTime: number;
    isConnected: boolean;
  };
  application: {
    processId: number;
    uptime: number;
    version: string;
    environment: string;
  };
}

export interface MetricsAlert {
  id: string;
  type: 'memory' | 'cpu' | 'database' | 'error_rate' | 'response_time';
  severity: 'warning' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: string;
  resolved: boolean;
}

// System metrics collection service
export class SystemMetricsService extends EventEmitter {
  private static instance: SystemMetricsService;
  private metricsHistory: SystemMetrics[] = [];
  private activeAlerts: Map<string, MetricsAlert> = new Map();
  private collectionInterval: NodeJS.Timeout | null = null;
  private readonly maxHistorySize = 1000; // Keep last 1000 metrics entries
  
  // Alert thresholds
  private readonly thresholds = {
    memory: {
      warning: 80,
      critical: 90
    },
    cpu: {
      warning: 70,
      critical: 85
    },
    database: {
      responseTime: {
        warning: 1000,
        critical: 3000
      }
    },
    errorRate: {
      warning: 5,
      critical: 10
    }
  };

  private constructor() {
    super();
  }

  public static getInstance(): SystemMetricsService {
    if (!SystemMetricsService.instance) {
      SystemMetricsService.instance = new SystemMetricsService();
    }
    return SystemMetricsService.instance;
  }

  // Start metrics collection
  public startCollection(intervalMs: number = 60000): void { // Default 1 minute
    if (this.collectionInterval) {
      console.warn('Metrics collection already started');
      return;
    }

    console.log(`Starting system metrics collection (interval: ${intervalMs}ms)`);
    
    // Collect initial metrics
    this.collectMetrics();

    // Set up periodic collection
    this.collectionInterval = setInterval(() => {
      this.collectMetrics();
    }, intervalMs);

    // Handle graceful shutdown
    process.on('SIGTERM', () => this.stopCollection());
    process.on('SIGINT', () => this.stopCollection());
  }

  // Stop metrics collection
  public stopCollection(): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
      console.log('System metrics collection stopped');
    }
  }

  // Collect current system metrics
  public async collectMetrics(): Promise<SystemMetrics> {
    try {
      const os = require('os');
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();

      // Get database metrics
      let databaseMetrics = {
        status: 'unhealthy' as 'healthy' | 'unhealthy',
        responseTime: 0,
        isConnected: false
      };

      try {
        const dbService = DatabaseService.getInstance();
        const healthCheck = await dbService.healthCheck();
        databaseMetrics = {
          status: healthCheck.status,
          responseTime: healthCheck.responseTime,
          isConnected: dbService.isHealthy()
        };
      } catch (error) {
        console.error('Failed to collect database metrics:', error);
      }

      const metrics: SystemMetrics = {
        timestamp: new Date().toISOString(),
        system: {
          uptime: os.uptime(),
          loadAverage: os.loadavg(),
          platform: os.platform(),
          nodeVersion: process.version
        },
        memory: {
          total: os.totalmem(),
          free: os.freemem(),
          used: os.totalmem() - os.freemem(),
          percentage: Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100),
          process: {
            rss: memoryUsage.rss,
            heapTotal: memoryUsage.heapTotal,
            heapUsed: memoryUsage.heapUsed,
            external: memoryUsage.external
          }
        },
        cpu: {
          cores: os.cpus().length,
          usage: {
            user: cpuUsage.user,
            system: cpuUsage.system
          },
          loadAverage: os.loadavg()
        },
        database: databaseMetrics,
        application: {
          processId: process.pid,
          uptime: process.uptime(),
          version: process.env.npm_package_version || '1.0.0',
          environment: process.env.NODE_ENV || 'development'
        }
      };

      // Add to history
      this.metricsHistory.push(metrics);
      
      // Trim history if needed
      if (this.metricsHistory.length > this.maxHistorySize) {
        this.metricsHistory = this.metricsHistory.slice(-this.maxHistorySize);
      }

      // Check for alerts
      this.checkAlerts(metrics);

      // Emit metrics event
      this.emit('metrics', metrics);

      return metrics;
    } catch (error) {
      console.error('Failed to collect system metrics:', error);
      throw error;
    }
  }

  // Check for alert conditions
  private checkAlerts(metrics: SystemMetrics): void {
    const alerts: MetricsAlert[] = [];

    // Memory alerts
    const memoryPercentage = Math.round((metrics.memory.process.heapUsed / metrics.memory.process.heapTotal) * 100);
    if (memoryPercentage >= this.thresholds.memory.critical) {
      alerts.push({
        id: 'memory-critical',
        type: 'memory',
        severity: 'critical',
        message: `Critical memory usage: ${memoryPercentage}%`,
        value: memoryPercentage,
        threshold: this.thresholds.memory.critical,
        timestamp: metrics.timestamp,
        resolved: false
      });
    } else if (memoryPercentage >= this.thresholds.memory.warning) {
      alerts.push({
        id: 'memory-warning',
        type: 'memory',
        severity: 'warning',
        message: `High memory usage: ${memoryPercentage}%`,
        value: memoryPercentage,
        threshold: this.thresholds.memory.warning,
        timestamp: metrics.timestamp,
        resolved: false
      });
    }

    // CPU alerts (based on load average)
    const loadAverage1min = metrics.cpu.loadAverage[0];
    const cpuPercentage = Math.round((loadAverage1min / metrics.cpu.cores) * 100);
    if (cpuPercentage >= this.thresholds.cpu.critical) {
      alerts.push({
        id: 'cpu-critical',
        type: 'cpu',
        severity: 'critical',
        message: `Critical CPU usage: ${cpuPercentage}%`,
        value: cpuPercentage,
        threshold: this.thresholds.cpu.critical,
        timestamp: metrics.timestamp,
        resolved: false
      });
    } else if (cpuPercentage >= this.thresholds.cpu.warning) {
      alerts.push({
        id: 'cpu-warning',
        type: 'cpu',
        severity: 'warning',
        message: `High CPU usage: ${cpuPercentage}%`,
        value: cpuPercentage,
        threshold: this.thresholds.cpu.warning,
        timestamp: metrics.timestamp,
        resolved: false
      });
    }

    // Database alerts
    if (metrics.database.status === 'unhealthy') {
      alerts.push({
        id: 'database-unhealthy',
        type: 'database',
        severity: 'critical',
        message: 'Database is unhealthy',
        value: 0,
        threshold: 1,
        timestamp: metrics.timestamp,
        resolved: false
      });
    } else if (metrics.database.responseTime >= this.thresholds.database.responseTime.critical) {
      alerts.push({
        id: 'database-slow-critical',
        type: 'database',
        severity: 'critical',
        message: `Critical database response time: ${metrics.database.responseTime}ms`,
        value: metrics.database.responseTime,
        threshold: this.thresholds.database.responseTime.critical,
        timestamp: metrics.timestamp,
        resolved: false
      });
    } else if (metrics.database.responseTime >= this.thresholds.database.responseTime.warning) {
      alerts.push({
        id: 'database-slow-warning',
        type: 'database',
        severity: 'warning',
        message: `Slow database response time: ${metrics.database.responseTime}ms`,
        value: metrics.database.responseTime,
        threshold: this.thresholds.database.responseTime.warning,
        timestamp: metrics.timestamp,
        resolved: false
      });
    }

    // Process new alerts
    for (const alert of alerts) {
      if (!this.activeAlerts.has(alert.id)) {
        this.activeAlerts.set(alert.id, alert);
        this.emit('alert', alert);
        console.warn('System Alert:', JSON.stringify(alert, null, 2));
      }
    }

    // Resolve alerts that are no longer active
    const currentAlertIds = new Set(alerts.map(a => a.id));
    for (const [alertId, alert] of this.activeAlerts.entries()) {
      if (!currentAlertIds.has(alertId) && !alert.resolved) {
        alert.resolved = true;
        this.emit('alertResolved', alert);
        console.info('System Alert Resolved:', JSON.stringify(alert, null, 2));
      }
    }
  }

  // Get current metrics
  public getCurrentMetrics(): SystemMetrics | null {
    return this.metricsHistory.length > 0 ? this.metricsHistory[this.metricsHistory.length - 1] : null;
  }

  // Get metrics history
  public getMetricsHistory(limit?: number): SystemMetrics[] {
    if (limit) {
      return this.metricsHistory.slice(-limit);
    }
    return [...this.metricsHistory];
  }

  // Get active alerts
  public getActiveAlerts(): MetricsAlert[] {
    return Array.from(this.activeAlerts.values()).filter(alert => !alert.resolved);
  }

  // Get all alerts (including resolved)
  public getAllAlerts(): MetricsAlert[] {
    return Array.from(this.activeAlerts.values());
  }

  // Get metrics summary
  public getMetricsSummary(periodMinutes: number = 60): {
    averageMemoryUsage: number;
    averageCpuUsage: number;
    averageDatabaseResponseTime: number;
    alertCount: number;
    period: string;
  } {
    const cutoffTime = new Date(Date.now() - (periodMinutes * 60 * 1000));
    const recentMetrics = this.metricsHistory.filter(m => new Date(m.timestamp) >= cutoffTime);

    if (recentMetrics.length === 0) {
      return {
        averageMemoryUsage: 0,
        averageCpuUsage: 0,
        averageDatabaseResponseTime: 0,
        alertCount: 0,
        period: `${periodMinutes} minutes`
      };
    }

    const avgMemory = recentMetrics.reduce((sum, m) => sum + m.memory.percentage, 0) / recentMetrics.length;
    const avgCpu = recentMetrics.reduce((sum, m) => {
      const cpuPercent = (m.cpu.loadAverage[0] / m.cpu.cores) * 100;
      return sum + cpuPercent;
    }, 0) / recentMetrics.length;
    const avgDbResponse = recentMetrics.reduce((sum, m) => sum + m.database.responseTime, 0) / recentMetrics.length;

    return {
      averageMemoryUsage: Math.round(avgMemory * 100) / 100,
      averageCpuUsage: Math.round(avgCpu * 100) / 100,
      averageDatabaseResponseTime: Math.round(avgDbResponse * 100) / 100,
      alertCount: this.getActiveAlerts().length,
      period: `${periodMinutes} minutes`
    };
  }

  // Export metrics for external monitoring systems
  public exportMetrics(format: 'json' | 'prometheus' = 'json'): string {
    const currentMetrics = this.getCurrentMetrics();
    if (!currentMetrics) {
      return format === 'json' ? '{}' : '';
    }

    if (format === 'prometheus') {
      // Export in Prometheus format
      return [
        `# HELP system_memory_usage_percent System memory usage percentage`,
        `# TYPE system_memory_usage_percent gauge`,
        `system_memory_usage_percent ${currentMetrics.memory.percentage}`,
        ``,
        `# HELP system_cpu_load_average System CPU load average (1 minute)`,
        `# TYPE system_cpu_load_average gauge`,
        `system_cpu_load_average ${currentMetrics.cpu.loadAverage[0]}`,
        ``,
        `# HELP database_response_time_ms Database response time in milliseconds`,
        `# TYPE database_response_time_ms gauge`,
        `database_response_time_ms ${currentMetrics.database.responseTime}`,
        ``,
        `# HELP application_uptime_seconds Application uptime in seconds`,
        `# TYPE application_uptime_seconds counter`,
        `application_uptime_seconds ${currentMetrics.application.uptime}`,
      ].join('\n');
    }

    return JSON.stringify(currentMetrics, null, 2);
  }
}