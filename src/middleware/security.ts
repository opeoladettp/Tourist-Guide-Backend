import { Request, Response, NextFunction } from 'express';
import { 
  rateLimiters, 
  corsMiddleware, 
  helmetMiddleware,
  SecurityEventLogger,
  IPSecurityTracker,
  RequestSanitizer
} from '../config/security';
import { ErrorFactory } from './error-handler';

// IP blocking middleware
export function ipBlockingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
  
  if (IPSecurityTracker.isBlocked(clientIP)) {
    SecurityEventLogger.logEvent('BLOCKED_IP_ACCESS_ATTEMPT', req, {
      blockedIP: clientIP,
      url: req.originalUrl,
      method: req.method
    });
    
    const error = ErrorFactory.resourceAccessDenied('Access temporarily blocked due to suspicious activity');
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        timestamp: new Date().toISOString(),
        path: req.originalUrl
      }
    });
    return;
  }
  
  next();
}

// Request sanitization middleware
export function requestSanitizationMiddleware(req: Request, res: Response, next: NextFunction): void {
  try {
    // Sanitize request body
    RequestSanitizer.sanitizeRequestBody(req);
    
    // Sanitize query parameters
    if (req.query) {
      req.query = RequestSanitizer.sanitizeObject(req.query);
    }
    
    // Sanitize URL parameters
    if (req.params) {
      req.params = RequestSanitizer.sanitizeObject(req.params);
    }
    
    next();
  } catch (error) {
    SecurityEventLogger.logEvent('REQUEST_SANITIZATION_ERROR', req, {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    next(error);
  }
}

// Security headers middleware (enhanced version)
export function enhancedSecurityHeadersMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Basic security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('X-Download-Options', 'noopen');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  
  // Content Security Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ');
  
  res.setHeader('Content-Security-Policy', csp);
  
  // HSTS (only in production with HTTPS)
  if (process.env.NODE_ENV === 'production' && req.secure) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  // Permissions Policy
  const permissionsPolicy = [
    'geolocation=()',
    'microphone=()',
    'camera=()',
    'payment=()',
    'usb=()',
    'magnetometer=()',
    'gyroscope=()',
    'speaker=()',
    'vibrate=()',
    'fullscreen=(self)',
    'sync=()'
  ].join(', ');
  
  res.setHeader('Permissions-Policy', permissionsPolicy);
  
  // Remove server identification headers
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');
  
  // Add custom security headers
  res.setHeader('X-API-Version', '1.0.0');
  res.setHeader('X-Request-ID', req.headers['x-request-id'] || generateRequestId());
  
  next();
}

// Authentication failure tracking middleware
export function authFailureTrackingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const originalJson = res.json;
  
  res.json = function(body: any) {
    // Check if this is an authentication failure
    if (res.statusCode === 401 || res.statusCode === 403) {
      const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
      
      IPSecurityTracker.recordFailedAttempt(clientIP);
      
      SecurityEventLogger.logEvent('AUTHENTICATION_FAILURE', req, {
        statusCode: res.statusCode,
        endpoint: req.originalUrl,
        userAgent: req.get('User-Agent'),
        responseBody: body
      });
      
      // Check for suspicious patterns
      checkSuspiciousActivity(req, clientIP);
    } else if (res.statusCode >= 200 && res.statusCode < 300) {
      // Successful authentication
      const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
      IPSecurityTracker.recordSuccessfulAttempt(clientIP);
    }
    
    return originalJson.call(this, body);
  };
  
  next();
}

// Suspicious activity detection
function checkSuspiciousActivity(req: Request, ip: string): void {
  const recentFailures = SecurityEventLogger.getEventsByIP(ip, 50)
    .filter(event => 
      event.type === 'AUTHENTICATION_FAILURE' && 
      Date.now() - new Date(event.timestamp).getTime() < 5 * 60 * 1000 // Last 5 minutes
    );
  
  if (recentFailures.length >= 5) {
    SecurityEventLogger.logEvent('SUSPICIOUS_REQUEST_PATTERN', req, {
      pattern: 'MULTIPLE_FAILED_LOGINS',
      count: recentFailures.length,
      timeWindow: '5 minutes'
    });
  }
  
  // Check for rapid requests from same IP
  const recentEvents = SecurityEventLogger.getEventsByIP(ip, 100)
    .filter(event => Date.now() - new Date(event.timestamp).getTime() < 60 * 1000); // Last minute
  
  if (recentEvents.length >= 20) {
    SecurityEventLogger.logEvent('SUSPICIOUS_REQUEST_PATTERN', req, {
      pattern: 'RAPID_REQUESTS',
      count: recentEvents.length,
      timeWindow: '1 minute'
    });
  }
}

// File upload security middleware
export function fileUploadSecurityMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Apply upload rate limiting
  rateLimiters.upload(req, res, (err) => {
    if (err) {
      SecurityEventLogger.logEvent('UPLOAD_RATE_LIMIT_EXCEEDED', req);
      return next(err);
    }
    
    // Additional file upload security checks would go here
    // (file type validation, virus scanning, etc.)
    
    next();
  });
}

// API key validation middleware (if using API keys)
export function apiKeyValidationMiddleware(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] as string;
  
  // Skip API key validation for certain endpoints
  const skipPaths = ['/health', '/api-docs', '/api/auth/login', '/api/auth/register'];
  if (skipPaths.some(path => req.path.startsWith(path))) {
    return next();
  }
  
  // If API key is provided, validate it
  if (apiKey) {
    const validApiKeys = (process.env.VALID_API_KEYS || '').split(',').filter(Boolean);
    
    if (!validApiKeys.includes(apiKey)) {
      SecurityEventLogger.logEvent('INVALID_API_KEY', req, { providedKey: apiKey });
      
      const error = ErrorFactory.authenticationRequired('Invalid API key provided');
      return res.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message,
          timestamp: new Date().toISOString(),
          path: req.originalUrl
        }
      });
    }
    
    // Log successful API key usage
    SecurityEventLogger.logEvent('API_KEY_USED', req, { apiKey: apiKey.substring(0, 8) + '...' });
  }
  
  next();
}

// Request size validation middleware
export function requestSizeValidationMiddleware(req: Request, res: Response, next: NextFunction): void {
  const contentLength = parseInt(req.headers['content-length'] || '0');
  const maxSize = 10 * 1024 * 1024; // 10MB
  
  if (contentLength > maxSize) {
    SecurityEventLogger.logEvent('REQUEST_SIZE_EXCEEDED', req, {
      contentLength,
      maxAllowed: maxSize
    });
    
    const error = ErrorFactory.validationError('Request size exceeds maximum allowed limit');
    return res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        timestamp: new Date().toISOString(),
        path: req.originalUrl
      }
    });
  }
  
  next();
}

// Security monitoring endpoint
export function securityMonitoringHandler(req: Request, res: Response): void {
  const recentEvents = SecurityEventLogger.getRecentEvents(100);
  const blockedIPs = IPSecurityTracker.getBlockedIPs();
  const suspiciousActivity = IPSecurityTracker.getSuspiciousActivity();
  
  res.json({
    security: {
      recentEvents: recentEvents.length,
      blockedIPs: blockedIPs.length,
      suspiciousIPs: suspiciousActivity.length,
      lastUpdated: new Date().toISOString()
    },
    events: recentEvents.slice(0, 20), // Last 20 events
    blockedIPs,
    suspiciousActivity: suspiciousActivity.slice(0, 10) // Top 10 suspicious IPs
  });
}

// Utility function to generate request ID
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Export all middleware and utilities
export {
  corsMiddleware,
  helmetMiddleware,
  rateLimiters,
  SecurityEventLogger,
  IPSecurityTracker,
  RequestSanitizer
};