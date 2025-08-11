import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import {
  ApiError,
  ErrorCode,
  ErrorFactory,
  ErrorLogger,
  globalErrorHandler,
  notFoundHandler,
  handleJoiValidationError,
  asyncHandler,
  requestTimingMiddleware,
  securityHeadersMiddleware,
  RateLimiter
} from '../../middleware/error-handler';
import Joi from 'joi';

// Mock console methods
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
const mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('ApiError', () => {
  it('should create an ApiError with correct properties', () => {
    const error = new ApiError(
      400,
      ErrorCode.VALIDATION_ERROR,
      'Test error',
      { field: 'test' },
      true
    );

    expect(error.statusCode).toBe(400);
    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(error.message).toBe('Test error');
    expect(error.details).toEqual({ field: 'test' });
    expect(error.isOperational).toBe(true);
    expect(error).toBeInstanceOf(Error);
  });

  it('should have default isOperational value of true', () => {
    const error = new ApiError(400, ErrorCode.VALIDATION_ERROR, 'Test error');
    expect(error.isOperational).toBe(true);
  });
});

describe('ErrorFactory', () => {
  describe('Authentication errors', () => {
    it('should create invalid credentials error', () => {
      const error = ErrorFactory.invalidCredentials();
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe(ErrorCode.INVALID_CREDENTIALS);
      expect(error.message).toBe('Invalid credentials provided');
    });

    it('should create token expired error', () => {
      const error = ErrorFactory.tokenExpired();
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe(ErrorCode.TOKEN_EXPIRED);
    });

    it('should create token invalid error', () => {
      const error = ErrorFactory.tokenInvalid();
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe(ErrorCode.TOKEN_INVALID);
    });

    it('should create authentication required error', () => {
      const error = ErrorFactory.authenticationRequired();
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe(ErrorCode.AUTHENTICATION_REQUIRED);
    });
  });

  describe('Authorization errors', () => {
    it('should create insufficient permissions error', () => {
      const error = ErrorFactory.insufficientPermissions();
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe(ErrorCode.INSUFFICIENT_PERMISSIONS);
    });

    it('should create data isolation violation error', () => {
      const error = ErrorFactory.dataIsolationViolation();
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe(ErrorCode.DATA_ISOLATION_VIOLATION);
    });

    it('should create resource access denied error', () => {
      const error = ErrorFactory.resourceAccessDenied();
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe(ErrorCode.RESOURCE_ACCESS_DENIED);
    });
  });

  describe('Validation errors', () => {
    it('should create validation error with details', () => {
      const details = { field: 'email', value: 'invalid' };
      const error = ErrorFactory.validationError('Invalid email', details);
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(error.message).toBe('Invalid email');
      expect(error.details).toEqual(details);
    });

    it('should create missing required fields error', () => {
      const fields = ['email', 'password'];
      const error = ErrorFactory.missingRequiredFields(fields);
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe(ErrorCode.MISSING_REQUIRED_FIELDS);
      expect(error.message).toBe('Missing required fields: email, password');
      expect(error.details).toEqual({ missingFields: fields });
    });
  });

  describe('Resource errors', () => {
    it('should create resource not found error with ID', () => {
      const error = ErrorFactory.resourceNotFound('User', '123');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe(ErrorCode.RESOURCE_NOT_FOUND);
      expect(error.message).toBe("User with ID '123' not found");
    });

    it('should create resource not found error without ID', () => {
      const error = ErrorFactory.resourceNotFound('User');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe(ErrorCode.RESOURCE_NOT_FOUND);
      expect(error.message).toBe('User not found');
    });

    it('should create endpoint not found error', () => {
      const error = ErrorFactory.endpointNotFound('/api/invalid');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe(ErrorCode.ENDPOINT_NOT_FOUND);
      expect(error.message).toBe("Endpoint '/api/invalid' not found");
    });
  });

  describe('Business logic errors', () => {
    it('should create registration conflict error', () => {
      const error = ErrorFactory.registrationConflict();
      expect(error.statusCode).toBe(422);
      expect(error.code).toBe(ErrorCode.REGISTRATION_CONFLICT);
    });

    it('should create capacity limit exceeded error', () => {
      const error = ErrorFactory.capacityLimitExceeded();
      expect(error.statusCode).toBe(422);
      expect(error.code).toBe(ErrorCode.CAPACITY_LIMIT_EXCEEDED);
    });

    it('should create business rule violation error', () => {
      const error = ErrorFactory.businessRuleViolation('Custom rule violated');
      expect(error.statusCode).toBe(422);
      expect(error.code).toBe(ErrorCode.BUSINESS_RULE_VIOLATION);
      expect(error.message).toBe('Custom rule violated');
    });

    it('should create duplicate resource error with field', () => {
      const error = ErrorFactory.duplicateResource('User', 'email');
      expect(error.statusCode).toBe(422);
      expect(error.code).toBe(ErrorCode.DUPLICATE_RESOURCE);
      expect(error.message).toBe('User with this email already exists');
    });

    it('should create duplicate resource error without field', () => {
      const error = ErrorFactory.duplicateResource('User');
      expect(error.statusCode).toBe(422);
      expect(error.code).toBe(ErrorCode.DUPLICATE_RESOURCE);
      expect(error.message).toBe('User already exists');
    });
  });

  describe('Server errors', () => {
    it('should create internal server error', () => {
      const error = ErrorFactory.internalServerError();
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe(ErrorCode.INTERNAL_SERVER_ERROR);
      expect(error.isOperational).toBe(false);
    });

    it('should create database error', () => {
      const error = ErrorFactory.databaseError();
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe(ErrorCode.DATABASE_ERROR);
      expect(error.isOperational).toBe(false);
    });

    it('should create external service error', () => {
      const error = ErrorFactory.externalServiceError('S3');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe(ErrorCode.EXTERNAL_SERVICE_ERROR);
      expect(error.message).toBe("External service 'S3' is unavailable");
      expect(error.isOperational).toBe(false);
    });

    it('should create file storage error', () => {
      const error = ErrorFactory.fileStorageError();
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe(ErrorCode.FILE_STORAGE_ERROR);
      expect(error.isOperational).toBe(false);
    });
  });
});

describe('ErrorLogger', () => {
  beforeEach(() => {
    mockConsoleError.mockClear();
    mockConsoleWarn.mockClear();
  });

  it('should log client errors as warnings', () => {
    const req = {
      method: 'GET',
      originalUrl: '/api/test',
      get: vi.fn().mockReturnValue('test-agent'),
      ip: '127.0.0.1',
      headers: {},
      user: { userId: 'user123' }
    } as any;

    const error = ErrorFactory.validationError('Test validation error');
    ErrorLogger.log(error, req);

    expect(mockConsoleWarn).toHaveBeenCalledWith(
      'Client Error:',
      expect.stringContaining('Test validation error')
    );
  });

  it('should log server errors as errors', () => {
    const req = {
      method: 'POST',
      originalUrl: '/api/test',
      get: vi.fn().mockReturnValue('test-agent'),
      ip: '127.0.0.1',
      headers: {}
    } as any;

    const error = ErrorFactory.internalServerError('Test server error');
    ErrorLogger.log(error, req);

    expect(mockConsoleError).toHaveBeenCalledWith(
      'Server Error:',
      expect.stringContaining('Test server error')
    );
  });

  it('should include additional context in logs', () => {
    const req = {
      method: 'GET',
      originalUrl: '/api/test',
      get: vi.fn().mockReturnValue('test-agent'),
      ip: '127.0.0.1',
      headers: {}
    } as any;

    const error = new Error('Test error');
    const additionalContext = { customField: 'customValue' };
    
    ErrorLogger.log(error, req, additionalContext);

    expect(mockConsoleError).toHaveBeenCalledWith(
      'Server Error:',
      expect.stringContaining('customValue')
    );
  });
});

describe('handleJoiValidationError', () => {
  it('should convert Joi validation error to ApiError', () => {
    const schema = Joi.object({
      email: Joi.string().email().required(),
      age: Joi.number().min(18).required()
    });

    const { error } = schema.validate({ email: 'invalid', age: 15 });
    const apiError = handleJoiValidationError(error!);

    expect(apiError).toBeInstanceOf(ApiError);
    expect(apiError.statusCode).toBe(400);
    expect(apiError.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(apiError.message).toBe('Request validation failed');
    expect(apiError.details).toHaveProperty('validationErrors');
    expect(apiError.details).toHaveProperty('invalidFields');
  });
});

describe('globalErrorHandler', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      originalUrl: '/api/test',
      method: 'GET',
      headers: {},
      get: vi.fn().mockReturnValue('test-agent'),
      ip: '127.0.0.1'
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      setHeader: vi.fn()
    };
    next = vi.fn();
    mockConsoleError.mockClear();
    mockConsoleWarn.mockClear();
  });

  it('should handle ApiError correctly', () => {
    const error = ErrorFactory.validationError('Test validation error');
    
    globalErrorHandler(error, req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Test validation error',
        timestamp: expect.any(String),
        path: '/api/test',
        requestId: expect.any(String)
      }
    });
  });

  it('should handle Joi ValidationError', () => {
    const joiError = new Error('Validation failed');
    joiError.name = 'ValidationError';
    (joiError as any).details = [{
      path: ['email'],
      message: 'email is required',
      context: { value: undefined }
    }];

    globalErrorHandler(joiError, req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Request validation failed'
        })
      })
    );
  });

  it('should handle JWT errors', () => {
    const jwtError = new Error('Invalid token');
    jwtError.name = 'JsonWebTokenError';

    globalErrorHandler(jwtError, req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: ErrorCode.TOKEN_INVALID
        })
      })
    );
  });

  it('should handle token expired errors', () => {
    const expiredError = new Error('Token expired');
    expiredError.name = 'TokenExpiredError';

    globalErrorHandler(expiredError, req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: ErrorCode.TOKEN_EXPIRED
        })
      })
    );
  });

  it('should handle Multer errors', () => {
    const multerError = new Error('File too large');
    multerError.name = 'MulterError';

    globalErrorHandler(multerError, req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: ErrorCode.VALIDATION_ERROR,
          message: 'File upload error'
        })
      })
    );
  });

  it('should handle unknown errors as internal server errors', () => {
    const unknownError = new Error('Unknown error');

    globalErrorHandler(unknownError, req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: ErrorCode.INTERNAL_SERVER_ERROR
        })
      })
    );
  });

  it('should mask error details in production for non-operational errors', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const error = ErrorFactory.internalServerError('Sensitive error details');
    
    globalErrorHandler(error, req as Request, res as Response, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          message: 'An unexpected error occurred'
        })
      })
    );

    process.env.NODE_ENV = originalEnv;
  });

  it('should include request ID from headers if present', () => {
    req.headers = { 'x-request-id': 'test-request-id' };
    req.get = vi.fn().mockReturnValue('test-agent');
    req.ip = '127.0.0.1';
    const error = ErrorFactory.validationError('Test error');
    
    globalErrorHandler(error, req as Request, res as Response, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          requestId: 'test-request-id'
        })
      })
    );
  });
});

describe('notFoundHandler', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;

  beforeEach(() => {
    req = {
      originalUrl: '/api/nonexistent'
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
  });

  it('should return 404 error for non-existent endpoints', () => {
    notFoundHandler(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: ErrorCode.ENDPOINT_NOT_FOUND,
        message: "Endpoint '/api/nonexistent' not found",
        timestamp: expect.any(String),
        path: '/api/nonexistent'
      }
    });
  });
});

describe('asyncHandler', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {};
    res = {};
    next = vi.fn();
  });

  it('should handle successful async functions', async () => {
    const asyncFn = vi.fn().mockResolvedValue('success');
    const handler = asyncHandler(asyncFn);

    await handler(req as Request, res as Response, next);

    expect(asyncFn).toHaveBeenCalledWith(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });

  it('should catch and pass errors to next', async () => {
    const error = new Error('Async error');
    const asyncFn = vi.fn().mockRejectedValue(error);
    const handler = asyncHandler(asyncFn);

    await handler(req as Request, res as Response, next);

    expect(asyncFn).toHaveBeenCalledWith(req, res, next);
    expect(next).toHaveBeenCalledWith(error);
  });

  it('should handle synchronous functions that return promises', async () => {
    const syncFn = vi.fn().mockReturnValue(Promise.resolve('success'));
    const handler = asyncHandler(syncFn);

    await handler(req as Request, res as Response, next);

    expect(syncFn).toHaveBeenCalledWith(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('requestTimingMiddleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      method: 'GET',
      originalUrl: '/api/test',
      headers: {}
    };
    res = {
      end: vi.fn()
    };
    next = vi.fn();
  });

  it('should add startTime to request', () => {
    requestTimingMiddleware(req as Request, res as Response, next);

    expect(req.startTime).toBeDefined();
    expect(typeof req.startTime).toBe('number');
    expect(next).toHaveBeenCalled();
  });

  it('should add request ID if not present', () => {
    requestTimingMiddleware(req as Request, res as Response, next);

    expect(req.headers!['x-request-id']).toBeDefined();
    expect(typeof req.headers!['x-request-id']).toBe('string');
  });

  it('should not override existing request ID', () => {
    const existingId = 'existing-request-id';
    req.headers!['x-request-id'] = existingId;

    requestTimingMiddleware(req as Request, res as Response, next);

    expect(req.headers!['x-request-id']).toBe(existingId);
  });
});

describe('securityHeadersMiddleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {};
    res = {
      setHeader: vi.fn(),
      removeHeader: vi.fn()
    };
    next = vi.fn();
  });

  it('should set security headers', () => {
    securityHeadersMiddleware(req as Request, res as Response, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(res.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
    expect(res.setHeader).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
    expect(res.setHeader).toHaveBeenCalledWith('Referrer-Policy', 'strict-origin-when-cross-origin');
    expect(res.setHeader).toHaveBeenCalledWith('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    expect(res.removeHeader).toHaveBeenCalledWith('X-Powered-By');
    expect(next).toHaveBeenCalled();
  });
});

describe('RateLimiter', () => {
  beforeEach(() => {
    // Clear rate limiter state
    (RateLimiter as any).requests.clear();
  });

  it('should allow requests within limit', () => {
    const result = RateLimiter.checkRateLimit('test-ip');

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(99); // MAX_REQUESTS - 1
    expect(result.resetTime).toBeGreaterThan(Date.now());
  });

  it('should track multiple requests from same identifier', () => {
    RateLimiter.checkRateLimit('test-ip');
    const result = RateLimiter.checkRateLimit('test-ip');

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(98); // MAX_REQUESTS - 2
  });

  it('should block requests when limit exceeded', () => {
    // Simulate 100 requests
    for (let i = 0; i < 100; i++) {
      RateLimiter.checkRateLimit('test-ip');
    }

    const result = RateLimiter.checkRateLimit('test-ip');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('should provide rate limit headers', () => {
    const headers = RateLimiter.getRateLimitHeaders('test-ip');

    expect(headers).toHaveProperty('X-RateLimit-Limit');
    expect(headers).toHaveProperty('X-RateLimit-Remaining');
    expect(headers).toHaveProperty('X-RateLimit-Reset');
    expect(headers['X-RateLimit-Limit']).toBe('100');
  });
});

describe('Enhanced ErrorLogger', () => {
  beforeEach(() => {
    mockConsoleError.mockClear();
    mockConsoleWarn.mockClear();
    // Clear error counts
    (ErrorLogger as any).errorCounts.clear();
  });

  it('should track error frequency', () => {
    const req = {
      method: 'GET',
      originalUrl: '/api/test',
      get: vi.fn().mockReturnValue('test-agent'),
      ip: '127.0.0.1',
      headers: {}
    } as any;

    const error = ErrorFactory.validationError('Test error');
    
    // Log the same error multiple times
    for (let i = 0; i < 5; i++) {
      ErrorLogger.log(error, req);
    }

    const stats = ErrorLogger.getErrorStats();
    expect(stats).toContainEqual({
      errorType: ErrorCode.VALIDATION_ERROR,
      count: 5
    });
  });

  it('should include enhanced context in logs', () => {
    const req = {
      method: 'POST',
      originalUrl: '/api/test',
      get: vi.fn().mockReturnValue('test-agent'),
      ip: '127.0.0.1',
      headers: { 'x-request-id': 'test-request-id' },
      user: { userId: 'user123', providerId: 'provider456' }
    } as any;

    const error = ErrorFactory.internalServerError('Test server error');
    ErrorLogger.log(error, req);

    expect(mockConsoleError).toHaveBeenCalledWith(
      'Server Error:',
      expect.stringContaining('user123')
    );
    expect(mockConsoleError).toHaveBeenCalledWith(
      'Server Error:',
      expect.stringContaining('provider456')
    );
  });

  it('should provide health metrics', () => {
    const req = {
      method: 'GET',
      originalUrl: '/api/test',
      get: vi.fn().mockReturnValue('test-agent'),
      ip: '127.0.0.1',
      headers: {}
    } as any;

    ErrorLogger.log(new Error('Test error'), req);
    
    const metrics = ErrorLogger.getHealthMetrics();
    expect(metrics).toHaveProperty('totalErrors');
    expect(metrics).toHaveProperty('errorTypes');
    expect(metrics).toHaveProperty('lastResetTime');
    expect(metrics).toHaveProperty('uptime');
    expect(metrics.totalErrors).toBeGreaterThan(0);
  });
});