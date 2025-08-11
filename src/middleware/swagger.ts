import { Request, Response, NextFunction } from 'express';
const swaggerUi = require('swagger-ui-express');
const yaml = require('js-yaml');
import { swaggerSpec } from '../config/swagger';

// Custom CSS for better styling
const customCss = `
  .swagger-ui .topbar { display: none }
  .swagger-ui .info { margin: 50px 0 }
  .swagger-ui .info .title { color: #2c3e50 }
  .swagger-ui .scheme-container { background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0 }
`;

// Swagger UI options
const swaggerUiOptions = {
  customCss,
  customSiteTitle: 'Tourist Hub API Documentation',
  customfavIcon: '/favicon.ico',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    docExpansion: 'none',
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
    tryItOutEnabled: true
  }
};

// Middleware to serve Swagger UI
export const swaggerUiMiddleware = swaggerUi.serve;
export const swaggerUiSetup = swaggerUi.setup(swaggerSpec, swaggerUiOptions);

// Middleware to serve raw OpenAPI spec as JSON
export const swaggerJsonMiddleware = (req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
};

// Middleware to serve raw OpenAPI spec as YAML
export const swaggerYamlMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    const yamlSpec = yaml.dump(swaggerSpec);
    res.setHeader('Content-Type', 'application/x-yaml');
    res.send(yamlSpec);
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'YAML_CONVERSION_ERROR',
        message: 'Failed to convert OpenAPI spec to YAML',
        timestamp: new Date().toISOString(),
        path: req.path
      }
    });
  }
};

// Health check for documentation
export const docsHealthCheck = (req: Request, res: Response) => {
  res.status(200).json({
    message: 'API Documentation is available',
    endpoints: {
      'Interactive Documentation': '/api-docs',
      'OpenAPI Specification (JSON)': '/api-docs/swagger.json',
      'OpenAPI Specification (YAML)': '/api-docs/swagger.yaml'
    },
    version: (swaggerSpec as any).info?.version || '1.0.0',
    title: (swaggerSpec as any).info?.title || 'Tourist Hub API'
  });
};

export default {
  swaggerUiMiddleware,
  swaggerUiSetup,
  swaggerJsonMiddleware,
  swaggerYamlMiddleware,
  docsHealthCheck
};