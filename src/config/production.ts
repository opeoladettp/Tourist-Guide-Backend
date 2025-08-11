// Production environment configuration
export const productionConfig = {
  // Server configuration
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || '0.0.0.0',
    trustProxy: true, // Enable if behind reverse proxy (nginx, load balancer)
    keepAliveTimeout: 65000, // Keep-alive timeout in milliseconds
    headersTimeout: 66000, // Headers timeout (should be higher than keepAliveTimeout)
    maxConnections: 1000, // Maximum number of concurrent connections
    timeout: 30000 // Request timeout in milliseconds
  },

  // Database configuration
  database: {
    // Connection pool settings
    pool: {
      min: 2,
      max: 10,
      acquireTimeoutMillis: 30000,
      createTimeoutMillis: 30000,
      destroyTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 200
    },
    // Connection retry settings
    retry: {
      max: 3,
      timeout: 5000,
      factor: 2
    },
    // Query timeout
    queryTimeout: 30000,
    // Enable query logging in production (be careful with sensitive data)
    logQueries: process.env.LOG_QUERIES === 'true',
    // SSL configuration
    ssl: process.env.DATABASE_SSL === 'true' ? {
      rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false'
    } : false
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: 'json',
    // Log file configuration
    files: {
      error: {
        filename: 'logs/error.log',
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
        tailable: true
      },
      combined: {
        filename: 'logs/combined.log',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
        tailable: true
      },
      access: {
        filename: 'logs/access.log',
        level: 'http',
        maxsize: 10485760, // 10MB
        maxFiles: 10,
        tailable: true
      }
    },
    // Console logging
    console: {
      enabled: process.env.CONSOLE_LOGGING !== 'false',
      level: 'info',
      colorize: false
    }
  },

  // Security configuration
  security: {
    // JWT configuration
    jwt: {
      accessTokenExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
      refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
      issuer: process.env.JWT_ISSUER || 'tourist-hub-api',
      audience: process.env.JWT_AUDIENCE || 'tourist-hub-clients'
    },
    
    // Password policy
    password: {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      maxAge: 90 * 24 * 60 * 60 * 1000, // 90 days
      preventReuse: 5 // Prevent reusing last 5 passwords
    },

    // Session configuration
    session: {
      maxConcurrentSessions: 3,
      absoluteTimeout: 8 * 60 * 60 * 1000, // 8 hours
      idleTimeout: 30 * 60 * 1000 // 30 minutes
    },

    // Rate limiting (production values)
    rateLimiting: {
      enabled: true,
      general: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 1000 // Increased for production
      },
      auth: {
        windowMs: 15 * 60 * 1000,
        max: 5 // Strict for auth endpoints
      },
      upload: {
        windowMs: 60 * 1000,
        max: 10
      }
    },

    // CORS configuration
    cors: {
      credentials: true,
      maxAge: 86400,
      optionsSuccessStatus: 200
    },

    // Content Security Policy
    csp: {
      enabled: true,
      reportOnly: false,
      reportUri: process.env.CSP_REPORT_URI
    }
  },

  // Monitoring and observability
  monitoring: {
    // Health checks
    healthCheck: {
      enabled: true,
      interval: 30000, // 30 seconds
      timeout: 5000,
      retries: 3
    },

    // Metrics collection
    metrics: {
      enabled: true,
      interval: 60000, // 1 minute
      retention: 24 * 60 * 60 * 1000, // 24 hours
      exportFormat: 'prometheus'
    },

    // Performance monitoring
    performance: {
      enabled: true,
      slowRequestThreshold: 1000, // 1 second
      memoryThreshold: 80, // 80% memory usage
      cpuThreshold: 80 // 80% CPU usage
    },

    // Error tracking
    errorTracking: {
      enabled: true,
      sampleRate: 1.0, // 100% in production
      environment: 'production'
    },

    // APM integration
    apm: {
      enabled: process.env.APM_ENABLED === 'true',
      serviceName: 'tourist-hub-api',
      environment: 'production',
      serverUrl: process.env.APM_SERVER_URL
    }
  },

  // File storage configuration
  storage: {
    // File upload limits
    upload: {
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      allowedTypes: [
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

    // AWS S3 configuration
    s3: {
      region: process.env.AWS_REGION || 'us-east-1',
      bucket: process.env.AWS_S3_BUCKET,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      signedUrlExpiry: 3600, // 1 hour
      serverSideEncryption: 'AES256'
    }
  },

  // Cache configuration
  cache: {
    // Redis configuration
    redis: {
      enabled: process.env.REDIS_ENABLED === 'true',
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      keyPrefix: 'tourist-hub:',
      ttl: 3600, // 1 hour default TTL
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      enableOfflineQueue: false,
      lazyConnect: true
    },

    // Memory cache fallback
    memory: {
      enabled: true,
      maxSize: 100, // Maximum number of items
      ttl: 300 // 5 minutes
    }
  },

  // Email configuration
  email: {
    enabled: process.env.EMAIL_ENABLED === 'true',
    provider: process.env.EMAIL_PROVIDER || 'smtp',
    
    // SMTP configuration
    smtp: {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    },

    // Email templates
    templates: {
      from: process.env.EMAIL_FROM || 'noreply@tourist-hub.com',
      replyTo: process.env.EMAIL_REPLY_TO
    }
  },

  // Background jobs configuration
  jobs: {
    enabled: process.env.JOBS_ENABLED === 'true',
    concurrency: parseInt(process.env.JOB_CONCURRENCY || '5'),
    
    // Job queues
    queues: {
      default: {
        name: 'default',
        concurrency: 3
      },
      email: {
        name: 'email',
        concurrency: 2
      },
      cleanup: {
        name: 'cleanup',
        concurrency: 1
      }
    },

    // Scheduled jobs
    schedules: {
      cleanup: '0 2 * * *', // Daily at 2 AM
      metrics: '*/5 * * * *', // Every 5 minutes
      healthCheck: '*/1 * * * *' // Every minute
    }
  },

  // Feature flags
  features: {
    // API versioning
    apiVersioning: {
      enabled: true,
      defaultVersion: 'v1',
      supportedVersions: ['v1']
    },

    // Documentation
    documentation: {
      enabled: process.env.API_DOCS_ENABLED !== 'false',
      swaggerUI: true,
      redoc: false
    },

    // Development features (disabled in production)
    development: {
      mockData: false,
      debugRoutes: false,
      verboseLogging: false
    }
  },

  // Graceful shutdown configuration
  shutdown: {
    timeout: 30000, // 30 seconds
    signals: ['SIGTERM', 'SIGINT'],
    cleanup: {
      database: true,
      cache: true,
      jobs: true,
      monitoring: true
    }
  }
};

// Environment validation
export function validateProductionEnvironment(): void {
  const requiredEnvVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    console.error('Missing required environment variables:', missingVars);
    process.exit(1);
  }

  // Validate JWT secrets strength
  const jwtSecret = process.env.JWT_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;

  if (jwtSecret && jwtSecret.length < 32) {
    console.error('JWT_SECRET must be at least 32 characters long');
    process.exit(1);
  }

  if (refreshSecret && refreshSecret.length < 32) {
    console.error('JWT_REFRESH_SECRET must be at least 32 characters long');
    process.exit(1);
  }

  // Validate database URL format
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl && !databaseUrl.startsWith('postgresql://')) {
    console.error('DATABASE_URL must be a valid PostgreSQL connection string');
    process.exit(1);
  }

  console.log('✅ Production environment validation passed');
}

// Production readiness checklist
export function checkProductionReadiness(): {
  ready: boolean;
  checks: Array<{ name: string; status: 'pass' | 'fail' | 'warn'; message: string }>;
} {
  const checks = [];

  // Environment variables check
  const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  checks.push({
    name: 'Environment Variables',
    status: missingVars.length === 0 ? 'pass' : 'fail',
    message: missingVars.length === 0 
      ? 'All required environment variables are set'
      : `Missing: ${missingVars.join(', ')}`
  });

  // Security configuration check
  checks.push({
    name: 'Security Configuration',
    status: process.env.NODE_ENV === 'production' ? 'pass' : 'warn',
    message: process.env.NODE_ENV === 'production' 
      ? 'Running in production mode'
      : 'Not running in production mode'
  });

  // HTTPS check
  checks.push({
    name: 'HTTPS Configuration',
    status: process.env.FORCE_HTTPS === 'true' ? 'pass' : 'warn',
    message: process.env.FORCE_HTTPS === 'true'
      ? 'HTTPS enforcement enabled'
      : 'HTTPS enforcement not configured'
  });

  // Logging configuration check
  checks.push({
    name: 'Logging Configuration',
    status: process.env.LOG_LEVEL ? 'pass' : 'warn',
    message: process.env.LOG_LEVEL 
      ? `Log level set to ${process.env.LOG_LEVEL}`
      : 'Log level not explicitly configured'
  });

  // Monitoring check
  checks.push({
    name: 'Monitoring Configuration',
    status: process.env.APM_ENABLED === 'true' ? 'pass' : 'warn',
    message: process.env.APM_ENABLED === 'true'
      ? 'APM monitoring enabled'
      : 'APM monitoring not configured'
  });

  const failedChecks = checks.filter(check => check.status === 'fail');
  
  return {
    ready: failedChecks.length === 0,
    checks
  };
}

export default productionConfig;