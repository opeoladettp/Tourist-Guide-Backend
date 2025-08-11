import { describe, it, expect } from 'vitest';
import { swaggerSpec } from '../../config/swagger';
import { 
  swaggerJsonMiddleware, 
  swaggerYamlMiddleware, 
  docsHealthCheck 
} from '../../middleware/swagger';

describe('Swagger Middleware', () => {
  describe('swaggerSpec', () => {
    it('should have valid OpenAPI 3.0 specification', () => {
      expect(swaggerSpec).toBeDefined();
      expect(swaggerSpec.openapi).toBe('3.0.0');
      expect(swaggerSpec.info).toBeDefined();
      expect(swaggerSpec.info.title).toBe('Tourist Hub API');
      expect(swaggerSpec.info.version).toBe('1.0.0');
    });

    it('should have authentication security scheme', () => {
      expect(swaggerSpec.components).toBeDefined();
      expect(swaggerSpec.components.securitySchemes).toBeDefined();
      expect(swaggerSpec.components.securitySchemes.bearerAuth).toBeDefined();
      expect(swaggerSpec.components.securitySchemes.bearerAuth.type).toBe('http');
      expect(swaggerSpec.components.securitySchemes.bearerAuth.scheme).toBe('bearer');
    });

    it('should have comprehensive schemas', () => {
      expect(swaggerSpec.components.schemas).toBeDefined();
      expect(swaggerSpec.components.schemas.User).toBeDefined();
      expect(swaggerSpec.components.schemas.Provider).toBeDefined();
      expect(swaggerSpec.components.schemas.TourTemplate).toBeDefined();
      expect(swaggerSpec.components.schemas.CustomTourEvent).toBeDefined();
      expect(swaggerSpec.components.schemas.Document).toBeDefined();
      expect(swaggerSpec.components.schemas.Error).toBeDefined();
    });

    it('should have server configuration', () => {
      expect(swaggerSpec.servers).toBeDefined();
      expect(Array.isArray(swaggerSpec.servers)).toBe(true);
      expect(swaggerSpec.servers.length).toBeGreaterThan(0);
    });
  });

  describe('Middleware Functions', () => {
    it('should export required middleware functions', () => {
      expect(typeof swaggerJsonMiddleware).toBe('function');
      expect(typeof swaggerYamlMiddleware).toBe('function');
      expect(typeof docsHealthCheck).toBe('function');
    });
  });
});