import { Request, Response, NextFunction } from 'express';
import { ValidationError } from 'joi';

// Standard error codes
export enum ErrorCode {
  // Authentication errors (401)
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  AUTHENTICATION_REQUIRED = 'AUTHENTICATION_REQUIRED',

  // Authorization errors (403)
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  DATA_ISOLATION_VIOLATION = 'DATA_ISOLATION_VIOLATION',
  RESOURCE_ACCESS_DENIED = 'RESOURCE_ACCESS_DENIED',

  // Validation errors (400)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_REQUEST_DATA = 'INVALID_REQUEST_DATA',
  MISSING_REQUIRED_FIELDS = 'MISSING_REQUIRED_FIELDS',

  // Resource errors (404)
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  ENDPOINT_NOT_FOUND = 'ENDPOINT_NOT_FOUND',

  // Business logic errors (422)
  REGISTRATION_CONFLICT = 'REGISTRATION_CONFLICT',
  CAPACITY_LIMIT_EXCEEDED = 'CAPACITY_LIMIT_EXCEEDED',
  BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION',
  DUPLICATE_RESOURCE = 'DUPLICATE_RESOURCE',

  // Server errors (500)
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  FILE_STORAGE_ERROR = 'FILE_STORAGE_ERROR'
}

// Standard error response interface
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    path: string;
    requestId?: string;
  };
}

// Custom error class
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: any;
  public readonly isOperational: boolean;

  constructor(
    statusCode: number,
    code: ErrorCode,
    message: string,
    details?: any,
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }
}

// Error factory functions
export class ErrorFactory {
  // Authentication errors
  static invalidCredentials(message: string = 'Invalid credentials provided'): ApiError {
    return new ApiError(401, ErrorCode.INVALID_CREDENTIALS, message);
  }

  static tokenExpired(message: string = 'Authentication token has expired'): ApiError {
    return new ApiError(401, ErrorCode.TOKEN_EXPIRED, message);
  }

  static tokenInvalid(message: string = 'Invalid authentication token'): ApiError {
    return new ApiError(401, ErrorCode.TOKEN_INVALID, message);
  }

  static authenticationRequired(message: string = 'Authentication required'): ApiError {
    return new ApiError(401, ErrorCode.AUTHENTICATION_REQUIRED, message);
  }

  // Authorization errors
  static insufficientPermissions(message: string = 'Insufficient permissions for this operation'): ApiError {
    return new ApiError(403, ErrorCode.INSUFFICIENT_PERMISSIONS, message);
  }

  static dataIsolationViolation(message: string = 'Access to resource violates data isolation rules'): ApiError {
    return new ApiError(403, ErrorCode.DATA_ISOLATION_VIOLATION, message);
  }

  static resourceAccessDenied(message: string = 'Access to this resource is denied'): ApiError {
    return new ApiError(403, ErrorCode.RESOURCE_ACCESS_DENIED, message);
  }

  // Validation errors
  static validationError(message: string, details?: any): ApiError {
    return new ApiError(400, ErrorCode.VALIDATION_ERROR, message, details);
  }

  static invalidRequestData(message: string = 'Invalid request data provided'): ApiError {
    return new ApiError(400, ErrorCode.INVALID_REQUEST_DATA, message);
  }

  static missingRequiredFields(fields: string[]): ApiError {
    return new ApiError(
      400,
      ErrorCode.MISSING_REQUIRED_FIELDS,
      `Missing required fields: ${fields.join(', ')}`,
      { missingFields: fields }
    );
  }

  // Resource errors
  static resourceNotFound(resource: string, id?: string): ApiError {
    const message = id ? `${resource} with ID '${id}' not found` : `${resource} not found`;
    return new ApiError(404, ErrorCode.RESOURCE_NOT_FOUND, message);
  }

  static endpointNotFound(path: string): ApiError {
    return new ApiError(404, ErrorCode.ENDPOINT_NOT_FOUND, `Endpoint '${path}' not found`);
  }

  // Business logic errors
  static registrationConflict(message: string = 'Registration conflict detected'): ApiError {
    return new ApiError(422, ErrorCode.REGISTRATION_CONFLICT, message);
  }

  static capacityLimitExceeded(message: string = 'Capacity limit exceeded'): ApiError {
    return new ApiError(422, ErrorCode.CAPACITY_LIMIT_EXCEEDED, message);
  }

  static businessRuleViolation(message: string): ApiError {
    return new ApiError(422, ErrorCode.BUSINESS_RULE_VIOLATION, message);
  }

  static duplicateResource(resource: string, field?: string): ApiError {
    const message = field 
      ? `${resource} with this ${field} already exists`
      : `${resource} already exists`;
    return new ApiError(422, ErrorCode.DUPLICATE_RESOURCE, message);
  }

  // Server errors
  static internalServerError(message: string = 'An unexpected error occurred'): ApiError {
    return new ApiError(500, ErrorCode.INTERNAL_SERVER_ERROR, message, undefined, false);
  }

  static databaseError(message: string = 'Database operation failed'): ApiError {
    return new ApiError(500, ErrorCode.DATABASE_ERROR, message, undefined, false);
  }

  static externalServiceError(service: string, message?: string): ApiError {
    const errorMessage = message || `External service '${service}' is unavailable`;
    return new ApiError(500, ErrorCode.EXTERNAL_SERVICE_ERROR, errorMessage, undefined, false);
  }

  static fileStorageError(message: string = 'File storage operation failed'): ApiError {
    return new ApiError(500, ErrorCode.FILE_STORAGE_ERROR, message, undefined, false);
  }
}

// Error logging utility with enhanced monitoring capabilities
export class ErrorLogger {
  private static errorCounts: Map<string, number> = new Map();
  private static lastResetTime: number = Date.now();
  private static readonly RESET_INTERVAL = 60 * 60 * 1000; // 1 hour

  static log(error: Error, req: Request, additionalContext?: any): void {
    const logData = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.originalUrl,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: (req as any).user?.userId,
      providerId: (req as any).user?.providerId,
      requestId: req.headers['x-request-id'] || this.generateRequestId(),
      error: {
        name: error.name,
        message: error.message,
        stack: process.env.NODE_ENV === 'production' ? undefined : error.stack,
        ...(error instanceof ApiError && {
          code: error.code,
          statusCode: error.statusCode,
          details: error.details,
          isOperational: error.isOperational
        })
      },
      ...additionalContext
    };

    // Track error frequency for monitoring
    this.trackErrorFrequency(error);

    // Log based on error severity
    if (error instanceof ApiError && error.statusCode < 500) {
      // Client errors - log as info/warn
      console.warn('Client Error:', JSON.stringify(logData, null, 2));
    } else {
      // Server errors - log as error
      console.error('Server Error:', JSON.stringify(logData, null, 2));
      
      // Alert for critical errors in production
      if (process.env.NODE_ENV === 'production') {
        this.alertCriticalError(error, logData);
      }
    }

    // Log performance metrics if available
    if (req.startTime) {
      const duration = Date.now() - req.startTime;
      console.info('Request Performance:', JSON.stringify({
        requestId: logData.requestId,
        method: req.method,
        url: req.originalUrl,
        duration: `${duration}ms`,
        status: error instanceof ApiError ? error.statusCode : 500
      }));
    }
  }

  private static generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private static trackErrorFrequency(error: Error): void {
    const now = Date.now();
    
    // Reset counters every hour
    if (now - this.lastResetTime > this.RESET_INTERVAL) {
      this.errorCounts.clear();
      this.lastResetTime = now;
    }

    const errorKey = error instanceof ApiError ? error.code : error.name;
    const currentCount = this.errorCounts.get(errorKey) || 0;
    this.errorCounts.set(errorKey, currentCount + 1);

    // Alert if error frequency is high
    if (currentCount > 10) {
      console.warn('High Error Frequency Alert:', JSON.stringify({
        errorType: errorKey,
        count: currentCount + 1,
        timeWindow: '1 hour',
        timestamp: new Date().toISOString()
      }));
    }
  }

  private static alertCriticalError(error: Error, logData: any): void {
    // In production, this would integrate with monitoring services like:
    // - Sentry, DataDog, New Relic, etc.
    // - Email/SMS alerting systems
    // - Slack/Teams notifications
    
    console.error('CRITICAL ERROR ALERT:', JSON.stringify({
      severity: 'CRITICAL',
      environment: process.env.NODE_ENV,
      service: 'tourist-hub-api',
      error: {
        type: error.name,
        message: error.message,
        ...(error instanceof ApiError && { code: error.code })
      },
      request: {
        method: logData.method,
        url: logData.url,
        userId: logData.userId,
        ip: logData.ip
      },
      timestamp: logData.timestamp
    }));
  }

  // Get error statistics for monitoring dashboards
  static getErrorStats(): { errorType: string; count: number }[] {
    return Array.from(this.errorCounts.entries()).map(([errorType, count]) => ({
      errorType,
      count
    }));
  }

  // Health check method for monitoring
  static getHealthMetrics(): {
    totalErrors: number;
    errorTypes: number;
    lastResetTime: string;
    uptime: string;
  } {
    const totalErrors = Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0);
    
    return {
      totalErrors,
      errorTypes: this.errorCounts.size,
      lastResetTime: new Date(this.lastResetTime).toISOString(),
      uptime: process.uptime().toString()
    };
  }
}

// Joi validation error handler
export function handleJoiValidationError(error: ValidationError): ApiError {
  const details = error.details.map(detail => ({
    field: detail.path.join('.'),
    message: detail.message,
    value: detail.context?.value
  }));

  return ErrorFactory.validationError(
    'Request validation failed',
    {
      validationErrors: details,
      invalidFields: details.map(d => d.field)
    }
  );
}

// Global error handling middleware with enhanced monitoring
export function globalErrorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Generate request ID for tracking
  const requestId = req.headers['x-request-id'] as string || 
    `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  let apiError: ApiError;

  // Handle different error types
  if (error instanceof ApiError) {
    apiError = error;
  } else if (error.name === 'ValidationError') {
    // Joi validation error
    apiError = handleJoiValidationError(error as ValidationError);
  } else if (error.name === 'JsonWebTokenError') {
    apiError = ErrorFactory.tokenInvalid();
  } else if (error.name === 'TokenExpiredError') {
    apiError = ErrorFactory.tokenExpired();
  } else if (error.name === 'MulterError') {
    // File upload errors
    apiError = ErrorFactory.validationError(
      'File upload error',
      { multerError: error.message }
    );
  } else if (error.name === 'PrismaClientKnownRequestError') {
    // Database errors
    apiError = ErrorFactory.databaseError('Database operation failed');
  } else if (error.name === 'PrismaClientUnknownRequestError') {
    apiError = ErrorFactory.databaseError('Unknown database error');
  } else if (error.name === 'PrismaClientRustPanicError') {
    apiError = ErrorFactory.databaseError('Database connection error');
  } else if (error.name === 'PrismaClientInitializationError') {
    apiError = ErrorFactory.databaseError('Database initialization error');
  } else if (error.name === 'PrismaClientValidationError') {
    apiError = ErrorFactory.validationError('Database validation error');
  } else {
    // Unknown error - treat as internal server error
    apiError = ErrorFactory.internalServerError(
      process.env.NODE_ENV === 'production' 
        ? 'An unexpected error occurred'
        : error.message
    );
  }

  // Log the error with enhanced context
  ErrorLogger.log(error, req, { 
    requestId,
    userAgent: req.get('User-Agent'),
    referer: req.get('Referer'),
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length')
  });

  // Add rate limiting headers for client errors
  if (apiError.statusCode >= 400 && apiError.statusCode < 500) {
    const rateLimitHeaders = RateLimiter.getRateLimitHeaders(req.ip || 'unknown');
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
  }

  // Prepare error response
  const errorResponse: ApiErrorResponse = {
    error: {
      code: apiError.code,
      message: apiError.message,
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      requestId,
      ...(apiError.details && { details: apiError.details })
    }
  };

  // Don't expose sensitive details in production
  if (process.env.NODE_ENV === 'production' && !apiError.isOperational) {
    errorResponse.error.message = 'An unexpected error occurred';
    delete errorResponse.error.details;
  }

  // Add correlation headers for debugging
  res.setHeader('X-Request-ID', requestId);
  res.setHeader('X-Error-Code', apiError.code);

  res.status(apiError.statusCode).json(errorResponse);
}

// 404 handler middleware
export function notFoundHandler(req: Request, res: Response): void {
  const error = ErrorFactory.endpointNotFound(req.originalUrl);
  const errorResponse: ApiErrorResponse = {
    error: {
      code: error.code,
      message: error.message,
      timestamp: new Date().toISOString(),
      path: req.originalUrl
    }
  };

  res.status(error.statusCode).json(errorResponse);
}

// Request timing middleware for performance monitoring
export function requestTimingMiddleware(req: Request, res: Response, next: NextFunction): void {
  req.startTime = Date.now();
  
  // Add request ID if not present
  if (!req.headers['x-request-id']) {
    req.headers['x-request-id'] = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Log request start in development
  if (process.env.NODE_ENV === 'development') {
    console.info(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - Request started`);
  }

  // Override res.end to capture response time
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    const duration = Date.now() - req.startTime!;
    
    // Log successful requests
    if (res.statusCode < 400) {
      console.info('Request Completed:', JSON.stringify({
        requestId: req.headers['x-request-id'],
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      }));
    }

    // Call original end method
    return originalEnd.call(this, chunk, encoding);
  };

  next();
}

// Rate limiting helper for error monitoring
export class RateLimiter {
  private static requests: Map<string, { count: number; resetTime: number }> = new Map();
  private static readonly WINDOW_SIZE = 15 * 60 * 1000; // 15 minutes
  private static readonly MAX_REQUESTS = 100; // per window

  static checkRateLimit(identifier: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const key = identifier;
    const record = this.requests.get(key);

    if (!record || now > record.resetTime) {
      // New window or expired window
      const resetTime = now + this.WINDOW_SIZE;
      this.requests.set(key, { count: 1, resetTime });
      return { allowed: true, remaining: this.MAX_REQUESTS - 1, resetTime };
    }

    if (record.count >= this.MAX_REQUESTS) {
      return { allowed: false, remaining: 0, resetTime: record.resetTime };
    }

    record.count++;
    return { allowed: true, remaining: this.MAX_REQUESTS - record.count, resetTime: record.resetTime };
  }

  static getRateLimitHeaders(identifier: string): Record<string, string> {
    const { remaining, resetTime } = this.checkRateLimit(identifier);
    return {
      'X-RateLimit-Limit': this.MAX_REQUESTS.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': Math.ceil(resetTime / 1000).toString()
    };
  }
}

// Security headers middleware
export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Remove server header
  res.removeHeader('X-Powered-By');
  
  next();
}

// Async error wrapper utility
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Extend Request interface to include startTime
declare global {
  namespace Express {
    interface Request {
      startTime?: number;
    }
  }
}