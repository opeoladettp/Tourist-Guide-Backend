import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { setupTestDatabase, cleanupTestDatabase } from '../../utils/test-db-setup';
import { PrismaClient } from '../../generated/prisma';
import { UserService } from '../../services/user';
import { AuthService } from '../../services/auth';
import { UserType } from '../../types/user';

describe('Auth Routes Integration Tests', () => {
  let prisma: PrismaClient;
  let userService: UserService;
  let authService: AuthService;
  let testUser: any;
  let testTokens: any;

  beforeEach(async () => {
    prisma = await setupTestDatabase();
    userService = new UserService(prisma);
    authService = new AuthService(prisma);

    // Create a test user
    testUser = await userService.createUser({
      firstName: 'John',
      lastName: 'Doe',
      emailAddress: 'john.doe@test.com',
      phoneNumber: '+1234567890',
      country: 'USA',
      password: 'password123',
      userType: UserType.TOURIST,
      passportNumber: 'P123456789',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'Male'
    });

    // Generate tokens for authenticated tests
    const accessToken = authService.generateAccessToken(testUser);
    const refreshToken = await authService.generateRefreshToken(testUser.userId);
    testTokens = {
      accessToken,
      refreshToken,
      expiresIn: '15m'
    };
  });

  afterEach(async () => {
    await cleanupTestDatabase(prisma);
  });

  describe('POST /api/auth/login', () => {
    it('should login user with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'john.doe@test.com',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Authentication successful');
      expect(response.body.data.user.userId).toBe(testUser.userId);
      expect(response.body.data.user.emailAddress).toBe('john.doe@test.com');
      expect(response.body.data.tokens.accessToken).toBeDefined();
      expect(response.body.data.tokens.refreshToken).toBeDefined();
      expect(response.body.data.user.passwordHash).toBeUndefined(); // Should not include password
    });

    it('should return 400 for invalid request data', async () => {
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

    it('should return 401 for invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'john.doe@test.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('AUTHENTICATION_FAILED');
      expect(response.body.error.message).toBe('Invalid credentials');
    });

    it('should return 401 for non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'password123'
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('AUTHENTICATION_FAILED');
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh tokens with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: testTokens.refreshToken
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Token refresh successful');
      expect(response.body.data.tokens.accessToken).toBeDefined();
      expect(response.body.data.tokens.refreshToken).toBeDefined();
      expect(response.body.data.tokens.expiresIn).toBe('15m');
    });

    it('should return 400 for missing refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Invalid request data');
    });

    it('should return 401 for invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: 'invalid-refresh-token'
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('TOKEN_REFRESH_FAILED');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout user with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .send({
          refreshToken: testTokens.refreshToken
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Logout successful');
    });

    it('should return 400 for missing refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Invalid request data');
    });

    it('should succeed even with invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .send({
          refreshToken: 'invalid-refresh-token'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Logout successful');
    });

    it('should invalidate refresh token after logout', async () => {
      // First logout
      await request(app)
        .post('/api/auth/logout')
        .send({
          refreshToken: testTokens.refreshToken
        });

      // Try to use the same refresh token again
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: testTokens.refreshToken
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('TOKEN_REFRESH_FAILED');
    });
  });

  describe('POST /api/auth/register', () => {
    it('should register new tourist user', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          firstName: 'Jane',
          lastName: 'Smith',
          emailAddress: 'jane.smith@test.com',
          phoneNumber: '+1987654321',
          country: 'Canada',
          password: 'password123',
          passportNumber: 'P987654321',
          dateOfBirth: '1992-05-15',
          gender: 'Female'
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('User registration successful');
      expect(response.body.data.user.emailAddress).toBe('jane.smith@test.com');
      expect(response.body.data.user.userType).toBe(UserType.TOURIST);
      expect(response.body.data.tokens.accessToken).toBeDefined();
      expect(response.body.data.tokens.refreshToken).toBeDefined();
      expect(response.body.data.user.passwordHash).toBeUndefined(); // Should not include password
    });

    it('should return 400 for invalid registration data', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          firstName: '',
          lastName: 'Smith',
          emailAddress: 'invalid-email',
          password: '123' // too short
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Invalid request data');
    });

    it('should return 409 for existing user', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          firstName: 'John',
          lastName: 'Doe',
          emailAddress: 'john.doe@test.com', // Same as existing user
          phoneNumber: '+1234567890',
          country: 'USA',
          password: 'password123'
        });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('USER_ALREADY_EXISTS');
    });
  });

  describe('POST /api/auth/logout-all', () => {
    it('should logout user from all devices', async () => {
      const response = await request(app)
        .post('/api/auth/logout-all')
        .set('Authorization', `Bearer ${testTokens.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Logout from all devices successful');
    });

    it('should return 401 for unauthenticated request', async () => {
      const response = await request(app)
        .post('/api/auth/logout-all');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('should invalidate all refresh tokens after logout-all', async () => {
      // Create another refresh token
      const secondRefreshToken = await authService.generateRefreshToken(testUser.userId);

      // Logout from all devices
      await request(app)
        .post('/api/auth/logout-all')
        .set('Authorization', `Bearer ${testTokens.accessToken}`);

      // Try to use both refresh tokens
      const response1 = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: testTokens.refreshToken });

      const response2 = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: secondRefreshToken });

      expect(response1.status).toBe(401);
      expect(response2.status).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user information', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${testTokens.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('User information retrieved successfully');
      expect(response.body.data.user.userId).toBe(testUser.userId);
      expect(response.body.data.user.emailAddress).toBe('john.doe@test.com');
      expect(response.body.data.user.passwordHash).toBeUndefined(); // Should not include password
    });

    it('should return 401 for unauthenticated request', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('should return 401 for invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHENTICATED');
    });
  });

  describe('Authentication Flow Integration', () => {
    it('should complete full authentication flow', async () => {
      // 1. Register new user
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          firstName: 'Test',
          lastName: 'User',
          emailAddress: 'test.user@test.com',
          phoneNumber: '+1111111111',
          country: 'USA',
          password: 'password123'
        });

      expect(registerResponse.status).toBe(201);
      const { accessToken, refreshToken } = registerResponse.body.data.tokens;

      // 2. Get user info with access token
      const meResponse = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(meResponse.status).toBe(200);
      expect(meResponse.body.data.user.emailAddress).toBe('test.user@test.com');

      // 3. Refresh tokens
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });

      expect(refreshResponse.status).toBe(200);
      const newTokens = refreshResponse.body.data.tokens;

      // 4. Use new access token
      const meResponse2 = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${newTokens.accessToken}`);

      expect(meResponse2.status).toBe(200);

      // 5. Logout
      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .send({ refreshToken: newTokens.refreshToken });

      expect(logoutResponse.status).toBe(200);

      // 6. Try to refresh with logged out token (should fail)
      const failedRefreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: newTokens.refreshToken });

      expect(failedRefreshResponse.status).toBe(401);
    });
  });
});