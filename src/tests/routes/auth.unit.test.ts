import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import authRouter from '../../routes/auth';
import { beforeEach } from 'node:test';

describe('Auth Routes Unit Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRouter);
  });

  describe('Endpoint Structure Tests', () => {
    it('should have POST /login endpoint', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({});

      // Should not return 404 (endpoint exists)
      expect(response.status).not.toBe(404);
    });

    it('should have POST /refresh endpoint', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({});

      // Should not return 404 (endpoint exists)
      expect(response.status).not.toBe(404);
    });

    it('should have POST /logout endpoint', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .send({});

      // Should not return 404 (endpoint exists)
      expect(response.status).not.toBe(404);
    });

    it('should have POST /register endpoint', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({});

      // Should not return 404 (endpoint exists)
      expect(response.status).not.toBe(404);
    });

    it('should have POST /logout-all endpoint', async () => {
      const response = await request(app)
        .post('/api/auth/logout-all');

      // Should not return 404 (endpoint exists)
      expect(response.status).not.toBe(404);
    });

    it('should have GET /me endpoint', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      // Should not return 404 (endpoint exists)
      expect(response.status).not.toBe(404);
    });
  });

  describe('Validation Tests', () => {
    it('should validate login request body', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'invalid-email',
          password: ''
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Invalid request data');
    });

    it('should validate refresh request body', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Invalid request data');
    });

    it('should validate logout request body', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Invalid request data');
    });

    it('should validate register request body', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          firstName: '',
          lastName: 'Doe',
          emailAddress: 'invalid-email',
          password: '123' // too short
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Invalid request data');
    });
  });

  describe('Authentication Required Tests', () => {
    it('should require authentication for /logout-all', async () => {
      const response = await request(app)
        .post('/api/auth/logout-all');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('MISSING_AUTH_HEADER');
    });

    it('should require authentication for /me', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('MISSING_AUTH_HEADER');
    });
  });

  describe('Error Response Format Tests', () => {
    it('should return standardized error format', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'invalid-email'
        });

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('message');
      expect(response.body.error).toHaveProperty('timestamp');
      expect(response.body.error).toHaveProperty('path');
    });
  });
});