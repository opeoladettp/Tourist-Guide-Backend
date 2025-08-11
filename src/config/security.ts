import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import { Request, Response } from 'express';

// Security configuration
export const securityConfig = {
  // Rate limiting configuration
  rateLimiting: {
    // General API rate limit
    general: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: {
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests from this IP, please try again later.',
          timestamp: new Date().toISOString()
        }
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req: Request, res: Response) => {
        res.status(429).json({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests from this IP, please try again later.',
            timestamp: new Date().toISOString(),
            path: req.originalUrl,
            retryAfter: Math.ceil(15 * 60) // 15 minutes in seconds
          }
        });
      }
    },
    
    // Authentication endpoints - stricter limits
    auth: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 10, // limit each IP to 10 login attempts per windowMs
      message: {
        error: {
          code: 'AUTH_RATE_LIMIT_EXCEEDED',
          message: 'Too many authentication attempts, please try again later.',
          timestamp: new Date().toISOString()
        }
      },
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: true, // Don't count successful requests
      handler: (req: Request, res: Response) => {
        res.status(429).json({
          error: {
            code: 'AUTH_RATE_LIMIT_EXCEEDED',
            message: 'Too many authentication attempts, please try again later.',
            timestamp: new Date().toISOString(),
            path: req.originalUrl,
            retryAfter: Math.ceil(15 * 60) // 15 minutes in seconds
          }
        });
      }
    },
    
    // File upload endpoints - more restrictive
    upload: {
      windowMs: 60 * 1000, // 1 minute
      max: 5, // limit each IP to 5 uploads per minute
      message: {
        error: {
          code: 'UPLOAD_RATE_LIMIT_EXCEEDED',
          message: 'Too many file uploads, please try again later.',
          timestamp: new Date().toISOString()
        }
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req: Request, res: Response) => {
        res.status(429).json({
          error: {
            code: 'UPLOAD_RATE_LIMIT_EXCEEDED',
            message: 'Too many file uploads, please try again later.',
            timestamp: new Date().toISOString(),
            path: req.originalUrl,
            retryAfter: Math.ceil(60) // 1 minute in seconds
          }
        });
      }
    }
  },

  // CORS configuration
  cors: {
    development: {
      origin: [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:8080',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
        'http://127.0.0.1:8080'
      ],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'X-Request-ID',
        'X-API-Key'
      ],
      exposedHeaders: [
        'X-Request-ID',
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset'
      ],
      maxAge: 86400 // 24 hours
    },
    
    production: {
      origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
        // Allow requests with no origin (mobile apps, etc.)
        if (!origin) return callback(null, true);
        
        // Define allowed origins from environment variables
        const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);
        
        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS policy'), false);
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'X-Request-ID',
        'X-API-Key'
      ],
      exposedHeaders: [
        'X-Request-ID',
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset'
      ],
      maxAge: 86400, // 24 hours
      optionsSuccessStatus: 200
    }
  },

  // Helmet security headers configuration
  helmet: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
        scriptSrc: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false, // Disable for API compatibility
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    },
    noSniff: true,
    frameguard: { action: 'deny' },
    xssFilter: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    permissionsPolicy: {
      features: {
        geolocation: [],
        microphone: [],
        camera: [],
        payment: [],
        usb: [],
        magnetometer: [],
        gyroscope: [],
        speaker: [],
        vibrate: [],
        fullscreen: ['self'],
        sync: []
      }
    }
  },

  // Request size limits
  requestLimits: {
    json: '10mb',
    urlencoded: '10mb',
    raw: '10mb',
    text: '10mb'
  },

  // File upload limits
  fileUpload: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ]
  },

  // Security monitoring
  monitoring: {
    logSecurityEvents: true,
    alertOnSuspiciousActivity: true,
    trackFailedAttempts: true,
    maxFailedAttempts: 5,
    lockoutDuration: 15 * 60 * 1000 // 15 minutes
  }
};

// Create rate limiters
export const rateLimiters = {
  general: rateLimit(securityConfig.rateLimiting.general),
  auth: rateLimit(securityConfig.rateLimiting.auth),
  upload: rateLimit(securityConfig.rateLimiting.upload)
};

// Create CORS middleware
export const corsMiddleware = cors(
  process.env.NODE_ENV === 'production' 
    ? securityConfig.cors.production 
    : securityConfig.cors.development
);

// Create Helmet middleware
export const helmetMiddleware = helmet(securityConfig.helmet);

// Security event logger
export class SecurityEventLogger {
  private static events: Array<{
    type: string;
    ip: string;
    userAgent?: string;
    userId?: string;
    timestamp: string;
    details?: any;
  }> = [];

  static logEvent(
    type: string,
    req: Request,
    details?: any
  ): void {
    const event = {
      type,
      ip: req.ip || 'unknown',
      userAgent: req.get('User-Agent'),
      userId: (req as any).user?.userId,
      timestamp: new Date().toISOString(),
      details
    };

    this.events.push(event);

    // Keep only last 1000 events
    if (this.events.length > 1000) {
      this.events = this.events.slice(-1000);
    }

    // Log security event
    console.warn('Security Event:', JSON.stringify(event, null, 2));

    // Alert on critical events
    if (this.isCriticalEvent(type)) {
      this.alertCriticalSecurityEvent(event);
    }
  }

  private static isCriticalEvent(type: string): boolean {
    const criticalEvents = [
      'MULTIPLE_FAILED_LOGINS',
      'SUSPICIOUS_REQUEST_PATTERN',
      'POTENTIAL_ATTACK',
      'UNAUTHORIZED_ACCESS_ATTEMPT',
      'RATE_LIMIT_ABUSE'
    ];
    return criticalEvents.includes(type);
  }

  private static alertCriticalSecurityEvent(event: any): void {
    console.error('CRITICAL SECURITY ALERT:', JSON.stringify({
      severity: 'CRITICAL',
      category: 'SECURITY',
      event,
      environment: process.env.NODE_ENV,
      service: 'tourist-hub-api'
    }, null, 2));
  }

  static getRecentEvents(limit: number = 100): any[] {
    return this.events.slice(-limit);
  }

  static getEventsByType(type: string, limit: number = 100): any[] {
    return this.events
      .filter(event => event.type === type)
      .slice(-limit);
  }

  static getEventsByIP(ip: string, limit: number = 100): any[] {
    return this.events
      .filter(event => event.ip === ip)
      .slice(-limit);
  }
}

// IP-based security tracking
export class IPSecurityTracker {
  private static suspiciousIPs: Map<string, {
    failedAttempts: number;
    lastAttempt: number;
    blocked: boolean;
    blockExpiry?: number;
  }> = new Map();

  static recordFailedAttempt(ip: string): void {
    const now = Date.now();
    const record = this.suspiciousIPs.get(ip) || {
      failedAttempts: 0,
      lastAttempt: now,
      blocked: false
    };

    record.failedAttempts++;
    record.lastAttempt = now;

    // Block IP if too many failed attempts
    if (record.failedAttempts >= securityConfig.monitoring.maxFailedAttempts) {
      record.blocked = true;
      record.blockExpiry = now + securityConfig.monitoring.lockoutDuration;
    }

    this.suspiciousIPs.set(ip, record);
  }

  static isBlocked(ip: string): boolean {
    const record = this.suspiciousIPs.get(ip);
    if (!record || !record.blocked) return false;

    // Check if block has expired
    if (record.blockExpiry && Date.now() > record.blockExpiry) {
      record.blocked = false;
      record.failedAttempts = 0;
      delete record.blockExpiry;
      this.suspiciousIPs.set(ip, record);
      return false;
    }

    return true;
  }

  static recordSuccessfulAttempt(ip: string): void {
    const record = this.suspiciousIPs.get(ip);
    if (record) {
      record.failedAttempts = 0;
      record.blocked = false;
      delete record.blockExpiry;
      this.suspiciousIPs.set(ip, record);
    }
  }

  static getBlockedIPs(): string[] {
    const now = Date.now();
    return Array.from(this.suspiciousIPs.entries())
      .filter(([_, record]) => 
        record.blocked && 
        (!record.blockExpiry || now < record.blockExpiry)
      )
      .map(([ip]) => ip);
  }

  static getSuspiciousActivity(): Array<{
    ip: string;
    failedAttempts: number;
    lastAttempt: string;
    blocked: boolean;
  }> {
    return Array.from(this.suspiciousIPs.entries())
      .filter(([_, record]) => record.failedAttempts > 0)
      .map(([ip, record]) => ({
        ip,
        failedAttempts: record.failedAttempts,
        lastAttempt: new Date(record.lastAttempt).toISOString(),
        blocked: record.blocked
      }));
  }
}

// Request validation and sanitization
export class RequestSanitizer {
  // Remove potentially dangerous characters from strings
  static sanitizeString(input: string): string {
    if (typeof input !== 'string') return input;
    
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '') // Remove event handlers with quotes
      .replace(/on\w+\s*=\s*[^>\s]+/gi, '') // Remove event handlers without quotes
      .replace(/<img[^>]*onerror[^>]*>/gi, '') // Remove img tags with onerror
      .trim();
  }

  // Sanitize object recursively
  static sanitizeObject(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    
    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }
    
    if (typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = this.sanitizeObject(value);
      }
      return sanitized;
    }
    
    return obj;
  }

  // Validate and sanitize request body
  static sanitizeRequestBody(req: Request): void {
    if (req.body) {
      req.body = this.sanitizeObject(req.body);
    }
  }
}