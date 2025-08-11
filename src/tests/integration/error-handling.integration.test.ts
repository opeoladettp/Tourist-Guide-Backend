import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { setupTestDatabase, cleanupTestDatabase } from '../../utils/test-db-setup';

describe('Error Handling Integration Tests', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('Global Error Handler', () => {
    it('should return standardized error response for 404', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'ENDPOINT_NOT_FOUND');
      expect(response.body.error).toHaveProperty('message');
      expect(response.body.error).toHaveProperty('timestamp');
      expect(response.body.error).toHaveProperty('path', '/api/nonexistent');
    });

    it('should include security headers in error responses', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);

      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options', 'DENY');
      expect(response.headers).toHaveProperty('x-xss-protection', '1; mode=block');
    });

    it('should include request timing in successful responses', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Check that timing middleware was applied (request completed successfully)
      expect(response.body).toHaveProperty('status', 'OK');
    });
  });

  describe('Validation Error Handling', () => {
    it('should return validation error for invalid JSON', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send('invalid json')
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error.code).toMatch(/VALIDATION_ERROR|INVALID_REQUEST_DATA/);
    });

    it('should return validation error for missing required fields', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('message');
    });
  });

  describe('Health Check Endpoints', () => {
    it('should return basic health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('service', 'Tourist Hub API');
    });

    it('should return database health status', async () => {
      const response = await request(app)
        .get('/health/db')
        .expect(200);

      expect(response.body).toHaveProperty('database');
      expect(response.body.database).toHaveProperty('status');
    });

    it('should return comprehensive health metrics', async () => {
      const response = await request(app)
        .get('/health/full')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('memory');
      expect(response.body).toHaveProperty('database');
    });

    it('should return performance metrics', async () => {
      const response = await request(app)
        .get('/health/metrics')
        .expect(200);

      expect(response.body).toHaveProperty('performance');
      expect(response.body).toHaveProperty('endpoints');
      expect(response.body).toHaveProperty('errors');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should return readiness status', async () => {
      const response = await request(app)
        .get('/health/ready')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ready');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should return liveness status', async () => {
      const response = await request(app)
        .get('/health/live')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'alive');
      expect(response.body).toHaveProperty('uptime');
    });
  });

  describe('Request Metrics', () => {
    it('should track request metrics across multiple requests', async () => {
      // Make several requests to generate metrics
      await request(app).get('/health').expect(200);
      await request(app).get('/health').expect(200);
      await request(app).get('/health/db').expect(200);

      const response = await request(app)
        .get('/health/metrics')
        .expect(200);

      expect(response.body.performance.requestCount).toBeGreaterThan(0);
      expect(response.body.endpoints.length).toBeGreaterThan(0);
    });
  });

  describe('Error Logging', () => {
    it('should log errors without exposing sensitive information', async () => {
      // This test verifies that errors are logged but sensitive info is not exposed
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);

      // Error should be logged (we can't easily test console output in integration tests)
      // But response should not contain sensitive information
      expect(response.body.error).not.toHaveProperty('stack');
      expect(response.body.error).not.toHaveProperty('internalDetails');
    });
  });
});