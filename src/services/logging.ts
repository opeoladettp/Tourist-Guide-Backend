import { createLogger, format, transports, Logger } from 'winston';
import { config } from '../config';

// Log levels
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  HTTP = 'http',
  DEBUG = 'debug'
}

// Log context interface
export interface LogContext {
  requestId?: string;
  userId?: string;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  duration?: number;
  userAgent?: string;
  ip?: string;
  [key: string]: any;
}

// Custom log format
const customFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.errors({ stack: true }),
  format.json(),
  format.printf(({ timestamp, level, message, ...meta }) => {
    return JSON.stringify({
      timestamp,
      level,
      message,
      ...meta
    });
  })
);

// Console format for development
const consoleFormat = format.combine(
  format.colorize(),
  format.timestamp({ format: 'HH:mm:ss' }),
  format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

// Create logger instance
class LoggingService {
  private static instance: LoggingService;
  private logger: Logger;

  private constructor() {
    const logTransports: any[] = [];

    // Console transport for development
    if (config.nodeEnv === 'development') {
      logTransports.push(
        new transports.Console({
          format: consoleFormat,
          level: 'debug'
        })
      );
    } else {
      // JSON format for production
      logTransports.push(
        new transports.Console({
          format: customFormat,
          level: 'info'
        })
      );
    }

    // File transports for production
    if (config.nodeEnv === 'production') {
      // Error log file
      logTransports.push(
        new transports.File({
          filename: 'logs/error.log',
          level: 'error',
          format: customFormat,
          maxsize: 5242880, // 5MB
          maxFiles: 5
        })
      );

      // Combined log file
      logTransports.push(
        new transports.File({
          filename: 'logs/combined.log',
          format: customFormat,
          maxsize: 5242880, // 5MB
          maxFiles: 5
        })
      );

      // HTTP access log
      logTransports.push(
        new transports.File({
          filename: 'logs/access.log',
          level: 'http',
          format: customFormat,
          maxsize: 5242880, // 5MB
          maxFiles: 10
        })
      );
    }

    this.logger = createLogger({
      level: config.nodeEnv === 'development' ? 'debug' : 'info',
      format: customFormat,
      transports: logTransports,
      exitOnError: false
    });

    // Handle uncaught exceptions and unhandled rejections
    this.logger.exceptions.handle(
      new transports.File({ filename: 'logs/exceptions.log' })
    );

    this.logger.rejections.handle(
      new transports.File({ filename: 'logs/rejections.log' })
    );
  }

  public static getInstance(): LoggingService {
    if (!LoggingService.instance) {
      LoggingService.instance = new LoggingService();
    }
    return LoggingService.instance;
  }

  // Core logging methods
  public error(message: string, context?: LogContext): void {
    this.logger.error(message, context);
  }

  public warn(message: string, context?: LogContext): void {
    this.logger.warn(message, context);
  }

  public info(message: string, context?: LogContext): void {
    this.logger.info(message, context);
  }

  public http(message: string, context?: LogContext): void {
    this.logger.http(message, context);
  }

  public debug(message: string, context?: LogContext): void {
    this.logger.debug(message, context);
  }

  // Specialized logging methods
  public logRequest(context: LogContext): void {
    this.http('HTTP Request', {
      type: 'request',
      ...context
    });
  }

  public logResponse(context: LogContext): void {
    this.http('HTTP Response', {
      type: 'response',
      ...context
    });
  }

  public logError(error: Error, context?: LogContext): void {
    this.error(error.message, {
      type: 'error',
      stack: error.stack,
      name: error.name,
      ...context
    });
  }

  public logDatabaseQuery(query: string, duration: number, context?: LogContext): void {
    this.debug('Database Query', {
      type: 'database_query',
      query,
      duration,
      ...context
    });
  }

  public logAuthentication(success: boolean, context?: LogContext): void {
    this.info(`Authentication ${success ? 'successful' : 'failed'}`, {
      type: 'authentication',
      success,
      ...context
    });
  }

  public logSecurityEvent(event: string, context?: LogContext): void {
    this.warn(`Security Event: ${event}`, {
      type: 'security',
      event,
      ...context
    });
  }

  public logPerformanceMetric(metric: string, value: number, context?: LogContext): void {
    this.info(`Performance Metric: ${metric}`, {
      type: 'performance',
      metric,
      value,
      ...context
    });
  }

  public logBusinessEvent(event: string, context?: LogContext): void {
    this.info(`Business Event: ${event}`, {
      type: 'business',
      event,
      ...context
    });
  }

  // Get logger instance for advanced usage
  public getLogger(): Logger {
    return this.logger;
  }

  // Create child logger with default context
  public createChildLogger(defaultContext: LogContext): ChildLogger {
    return new ChildLogger(this, defaultContext);
  }
}

// Child logger with default context
class ChildLogger {
  constructor(
    private parent: LoggingService,
    private defaultContext: LogContext
  ) {}

  private mergeContext(context?: LogContext): LogContext {
    return { ...this.defaultContext, ...context };
  }

  public error(message: string, context?: LogContext): void {
    this.parent.error(message, this.mergeContext(context));
  }

  public warn(message: string, context?: LogContext): void {
    this.parent.warn(message, this.mergeContext(context));
  }

  public info(message: string, context?: LogContext): void {
    this.parent.info(message, this.mergeContext(context));
  }

  public http(message: string, context?: LogContext): void {
    this.parent.http(message, this.mergeContext(context));
  }

  public debug(message: string, context?: LogContext): void {
    this.parent.debug(message, this.mergeContext(context));
  }
}

// Export singleton instance
export const logger = LoggingService.getInstance();
export default LoggingService;