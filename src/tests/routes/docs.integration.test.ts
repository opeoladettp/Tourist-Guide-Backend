import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { setupTestDatabase, cleanupTestDatabase } from '../../utils/test-db-setup';

describe('API Documentation Endpoints', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('GET /api-docs/health', () => {
    it('should return documentation health status', async () => {
      const response = await request(app)
        .get('/api-docs/health')
        .expect(200);

      expect(response.body).toHaveProperty('message', 'API Documentation is available');
      expect(response.body).toHaveProperty('endpoints');
      expect(response.body.endpoints).toHaveProperty('Interactive Documentation');
      expect(response.body.endpoints).toHaveProperty('OpenAPI Specification (JSON)');
      expect(response.body.endpoints).toHaveProperty('OpenAPI Specification (YAML)');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('title');
    });
  });

  describe('GET /api-docs/swagger.json', () => {
    it('should return OpenAPI specification in JSON format', async () => {
      const response = await request(app)
        .get('/api-docs/swagger.json')
        .expect(200)
        .expect('Content-Type', /application\/json/);

      expect(response.body).toHaveProperty('openapi', '3.0.0');
      expect(response.body).toHaveProperty('info');
      expect(response.body.info).toHaveProperty('title', 'Tourist Hub API');
      expect(response.body.info).toHaveProperty('version', '1.0.0');
      expect(response.body).toHaveProperty('paths');
      expect(response.body).toHaveProperty('components');
      expect(response.body.components).toHaveProperty('securitySchemes');
      expect(response.body.components).toHaveProperty('schemas');
    });

    it('should include authentication security scheme', async () => {
      const response = await request(app)
        .get('/api-docs/swagger.json')
        .expect(200);

      expect(response.body.components.securitySchemes).toHaveProperty('bearerAuth');
      expect(response.body.components.securitySchemes.bearerAuth).toEqual({
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token obtained from /api/auth/login'
      });
    });

    it('should include common schemas', async () => {
      const response = await request(app)
        .get('/api-docs/swagger.json')
        .expect(200);

      const schemas = response.body.components.schemas;
      expect(schemas).toHaveProperty('Error');
      expect(schemas).toHaveProperty('User');
      expect(schemas).toHaveProperty('Provider');
      expect(schemas).toHaveProperty('LoginRequest');
      expect(schemas).toHaveProperty('LoginResponse');
    });
  });

  describe('GET /api-docs/swagger.yaml', () => {
    it('should return OpenAPI specification in YAML format', async () => {
      const response = await request(app)
        .get('/api-docs/swagger.yaml')
        .expect(200)
        .expect('Content-Type', /application\/x-yaml/);

      expect(response.text).toContain('openapi: 3.0.0');
      expect(response.text).toContain('title: Tourist Hub API');
      expect(response.text).toContain('version: 1.0.0');
      expect(response.text).toContain('paths:');
      expect(response.text).toContain('components:');
    });
  });

  describe('GET /api/docs', () => {
    it('should return documentation overview', async () => {
      const response = await request(app)
        .get('/api/docs')
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Tourist Hub API Documentation');
      expect(response.body).toHaveProperty('endpoints');
      expect(response.body.endpoints).toHaveProperty('interactive');
      expect(response.body.endpoints).toHaveProperty('openapi_json');
      expect(response.body.endpoints).toHaveProperty('openapi_yaml');
      expect(response.body.endpoints).toHaveProperty('examples');
      expect(response.body.endpoints).toHaveProperty('integration_guide');
      expect(response.body).toHaveProperty('version', '1.0.0');
      expect(response.body).toHaveProperty('title', 'Tourist Hub API');
    });
  });

  describe('GET /api/docs/examples', () => {
    it('should return comprehensive API usage examples', async () => {
      const response = await request(app)
        .get('/api/docs/examples')
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Tourist Hub API Usage Examples');
      expect(response.body).toHaveProperty('examples');
      
      const examples = response.body.examples;
      expect(examples).toHaveProperty('authentication');
      expect(examples).toHaveProperty('user_management');
      expect(examples).toHaveProperty('tour_management');
      expect(examples).toHaveProperty('error_handling');

      // Check authentication examples
      expect(examples.authentication.examples).toHaveProperty('login');
      expect(examples.authentication.examples).toHaveProperty('authenticated_request');

      // Check error handling examples
      expect(examples.error_handling.examples).toHaveProperty('validation_error');
      expect(examples.error_handling.examples).toHaveProperty('authentication_error');
      expect(examples.error_handling.examples).toHaveProperty('authorization_error');
    });
  });

  describe('GET /api/docs/integration', () => {
    it('should return integration guide', async () => {
      const response = await request(app)
        .get('/api/docs/integration')
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Tourist Hub API Integration Guide');
      expect(response.body).toHaveProperty('guide');
      
      const guide = response.body.guide;
      expect(guide).toHaveProperty('overview');
      expect(guide).toHaveProperty('getting_started');
      expect(guide).toHaveProperty('client_libraries');
      expect(guide).toHaveProperty('common_workflows');
      expect(guide).toHaveProperty('troubleshooting');

      // Check getting started steps
      expect(guide.getting_started).toHaveProperty('steps');
      expect(Array.isArray(guide.getting_started.steps)).toBe(true);
      expect(guide.getting_started.steps.length).toBeGreaterThan(0);

      // Check client libraries
      expect(guide.client_libraries).toHaveProperty('javascript');
      expect(guide.client_libraries).toHaveProperty('python');

      // Check workflows
      expect(guide.common_workflows).toHaveProperty('tourist_workflow');
      expect(guide.common_workflows).toHaveProperty('provider_admin_workflow');

      // Check troubleshooting
      expect(guide.troubleshooting).toHaveProperty('common_issues');
      expect(Array.isArray(guide.troubleshooting.common_issues)).toBe(true);
    });
  });

  describe('GET /api-docs (Swagger UI)', () => {
    it('should serve Swagger UI interface', async () => {
      const response = await request(app)
        .get('/api-docs/')
        .expect(200)
        .expect('Content-Type', /text\/html/);

      expect(response.text).toContain('swagger-ui');
      expect(response.text).toContain('Tourist Hub API Documentation');
    });
  });
});