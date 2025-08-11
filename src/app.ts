import express from 'express';
import dotenv from 'dotenv';
import DatabaseService from './services/database';
import healthRoutes from './routes/health';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import providerRoutes from './routes/providers';
import tourTemplateRoutes from './routes/tour-templates';
import tourEventRoutes from './routes/tour-events';
import activityTypeRoutes from './routes/activity-types';
import documentRoutes from './routes/documents';
import docsRoutes from './routes/docs';
import versionRoutes from './routes/version';
import { 
  globalErrorHandler, 
  notFoundHandler, 
  requestTimingMiddleware 
} from './middleware/error-handler';
import { requestMetricsMiddleware, MonitoringService } from './utils/monitoring';
import { SystemMetricsService } from './services/system-metrics';
import { 
  swaggerUiMiddleware, 
  swaggerUiSetup, 
  swaggerJsonMiddleware, 
  swaggerYamlMiddleware, 
  docsHealthCheck 
} from './middleware/swagger';
import {
  corsMiddleware,
  helmetMiddleware,
  rateLimiters,
  ipBlockingMiddleware,
  requestSanitizationMiddleware,
  enhancedSecurityHeadersMiddleware,
  authFailureTrackingMiddleware,
  apiKeyValidationMiddleware,
  requestSizeValidationMiddleware,
  securityMonitoringHandler
} from './middleware/security';
import { securityConfig } from './config/security';

// Load environment variables
dotenv.config();

const app = express();

// Trust proxy if behind reverse proxy (nginx, load balancer)
if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', true);
}

// Security middleware (applied first)
app.use(helmetMiddleware);
app.use(enhancedSecurityHeadersMiddleware);
app.use(corsMiddleware);
app.use(ipBlockingMiddleware);
app.use(requestSizeValidationMiddleware);

// Rate limiting middleware
app.use('/api/auth', rateLimiters.auth);
app.use('/api/documents', rateLimiters.upload);
app.use(rateLimiters.general);

// Request processing middleware
app.use(requestTimingMiddleware);
app.use(requestMetricsMiddleware);
app.use(requestSanitizationMiddleware);
app.use(authFailureTrackingMiddleware);
app.use(apiKeyValidationMiddleware);

// Body parsing middleware with size limits
app.use(express.json({ 
  limit: securityConfig.requestLimits.json,
  verify: (req, res, buf) => {
    // Store raw body for webhook verification if needed
    (req as any).rawBody = buf;
  }
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: securityConfig.requestLimits.urlencoded 
}));

// Health check routes
app.use('/health', healthRoutes);

// Security monitoring endpoint (admin only in production)
if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_SECURITY_MONITORING === 'true') {
  app.get('/security/monitoring', securityMonitoringHandler);
}

// API Documentation routes
app.get('/api-docs/health', docsHealthCheck);
app.get('/api-docs/swagger.json', swaggerJsonMiddleware);
app.get('/api-docs/swagger.yaml', swaggerYamlMiddleware);
app.use('/api-docs', swaggerUiMiddleware, swaggerUiSetup);

// Authentication routes
app.use('/api/auth', authRoutes);

// User management routes
app.use('/api/users', userRoutes);

// Provider management routes
app.use('/api/providers', providerRoutes);

// Tour template management routes
app.use('/api/tour-templates', tourTemplateRoutes);

// Tour event management routes
app.use('/api/tour-events', tourEventRoutes);

// Activity type management routes
app.use('/api/activity-types', activityTypeRoutes);

// Document management routes
app.use('/api/documents', documentRoutes);

// Documentation routes
app.use('/api/docs', docsRoutes);

// Version information routes
app.use('/api/version', versionRoutes);

// API routes placeholder
app.get('/api', (req, res) => {
  res.status(200).json({
    message: 'Tourist Hub API',
    version: '1.0.0',
    status: 'Running'
  });
});

// 404 handler
app.use('*', notFoundHandler);

// Global error handler
app.use(globalErrorHandler);

// Start metrics logging in production
if (process.env.NODE_ENV === 'production') {
  MonitoringService.startMetricsLogging(300000); // Every 5 minutes
}

export default app;