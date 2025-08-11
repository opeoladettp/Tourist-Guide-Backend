import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { UserType, UserStatus } from '../../types/user';

// Mock the modules first
vi.mock('../../services/auth');
vi.mock('../../services/user');
vi.mock('../../middleware/auth');
vi.mock('../../generated/prisma', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({}))
}));

// Import the router after mocking
import authRouter from '../../routes/auth';
import { AuthService } from '../../services/auth';
import { UserService } from '../../services/user';
import { AuthMiddleware } from '../../middleware/auth';

describe('Auth Routes', () => {
  let app: express.Application;
  let mockAuthService: any;
  let mockUserService: any;
  let mockAuthMiddleware: any;

  const mockUser = {
    userId: 'user-123',
    firstName: 'John',
    middleName: null,
    lastName: 'Doe',
    emailAddress: 'john.doe@example.com',
    phoneNumber: '+1234567890',
    country: 'USA',
    passwordHash: 'hashed-password',
    userType: UserType.TOURIST,
    status: UserStatus.ACTIVE,
    passportNumber: 'P123456789',
    dateOfBirth: new Date('1990-01-01'),
    gender: 'Male',
    providerId: null,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockTokens = {
    accessToken: 'access-token-123',
    refreshToken: 'refresh-token-123',
    expiresIn: '15m'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create mock instances
    mockAuthService = {
      authenticateUser: vi.fn(),
      refreshAccessToken: vi.fn(),
      logoutUser: vi.fn(),
      generateAccessToken: vi.fn(),
      generateRefreshToken: vi.fn(),
      revokeAllUserTokens: vi.fn(),
      validateAccessToken: vi.fn()
    };

    mockUserService = {
      createUser: vi.fn(),
      getUserById: vi.fn()
    };

    mockAuthMiddleware = {
      authenticate: vi.fn()
    };

    // Mock the constructors
    vi.mocked(AuthService).mockImplementation(() => mockAuthService);
    vi.mocked(UserService).mockImplementation(() => mockUserService);
    vi.mocked(AuthMiddleware).mockImplementation(() => mockAuthMiddleware);
    
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRouter);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/auth/login', () => {
    it('should login user with valid credentials', async () => {
      mockAuthService.authenticateUser.mockResolvedValue({
        user: mockUser,
        tokens: mockTokens
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'john.doe@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Authentication successful');
      expect(response.body.data.user.userId).toBe(mockUser.userId);
      expect(response.body.data.tokens).toEqual(mockTokens);
      expect(mockAuthService.authenticateUser).toHaveBeenCalledWith(
        'john.doe@example.com',
        'password123'
      );
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
      mockAuthService.authenticateUser.mockRejectedValue(new Error('Invalid credentials'));

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'john.doe@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('AUTHENTICATION_FAILED');
      expect(response.body.error.message).toBe('Invalid credentials');
    });

    it('should return 401 for inactive user', async () => {
      mockAuthService.authenticateUser.mockRejectedValue(new Error('User account is inactive'));

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'john.doe@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('AUTHENTICATION_FAILED');
      expect(response.body.error.message).toBe('User account is inactive');
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh tokens with valid refresh token', async () => {
      mockAuthService.refreshAccessToken.mockResolvedValue(mockTokens);

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: 'valid-refresh-token'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Token refresh successful');
      expect(response.body.data.tokens).toEqual(mockTokens);
      expect(mockAuthService.refreshAccessToken).toHaveBeenCalledWith('valid-refresh-token');
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
      mockAuthService.refreshAccessToken.mockRejectedValue(new Error('Invalid refresh token'));

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: 'invalid-refresh-token'
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('TOKEN_REFRESH_FAILED');
      expect(response.body.error.message).toBe('Invalid refresh token');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout user with valid refresh token', async () => {
      mockAuthService.logoutUser.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/auth/logout')
        .send({
          refreshToken: 'valid-refresh-token'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Logout successful');
      expect(mockAuthService.logoutUser).toHaveBeenCalledWith('valid-refresh-token');
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
      mockAuthService.logoutUser.mockRejectedValue(new Error('Invalid refresh token'));

      const response = await request(app)
        .post('/api/auth/logout')
        .send({
          refreshToken: 'invalid-refresh-token'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Logout successful');
    });
  });

  describe('POST /api/auth/register', () => {
    it('should register new tourist user', async () => {
      mockUserService.createUser.mockResolvedValue(mockUser);
      mockAuthService.generateAccessToken.mockReturnValue('access-token-123');
      mockAuthService.generateRefreshToken.mockResolvedValue('refresh-token-123');

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          firstName: 'John',
          lastName: 'Doe',
          emailAddress: 'john.doe@example.com',
          phoneNumber: '+1234567890',
          country: 'USA',
          password: 'password123',
          passportNumber: 'P123456789',
          dateOfBirth: '1990-01-01',
          gender: 'Male'
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('User registration successful');
      expect(response.body.data.user.userId).toBe(mockUser.userId);
      expect(response.body.data.tokens.accessToken).toBe('access-token-123');
      expect(mockUserService.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: 'John',
          lastName: 'Doe',
          emailAddress: 'john.doe@example.com',
          userType: UserType.TOURIST
        })
      );
    });

    it('should return 400 for invalid registration data', async () => {
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

    it('should return 409 for existing user', async () => {
      mockUserService.createUser.mockRejectedValue(new Error('User with this email address already exists'));

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          firstName: 'John',
          lastName: 'Doe',
          emailAddress: 'john.doe@example.com',
          phoneNumber: '+1234567890',
          country: 'USA',
          password: 'password123'
        });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('USER_ALREADY_EXISTS');
      expect(response.body.error.message).toBe('User with this email address already exists');
    });
  });

  describe('POST /api/auth/logout-all', () => {
    it('should logout user from all devices', async () => {
      // Mock authentication middleware
      const mockPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        role: UserType.TOURIST,
        providerId: 'provider-123'
      };

      mockAuthMiddleware.authenticate.mockImplementation((req: any, res: any, next: any) => {
        req.user = mockPayload;
        next();
      });

      mockAuthService.revokeAllUserTokens.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/auth/logout-all')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Logout from all devices successful');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user information', async () => {
      // Mock authentication middleware
      const mockPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        role: UserType.TOURIST,
        providerId: 'provider-123'
      };

      mockAuthMiddleware.authenticate.mockImplementation((req: any, res: any, next: any) => {
        req.user = mockPayload;
        next();
      });

      mockUserService.getUserById.mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('User information retrieved successfully');
      expect(response.body.data.user.userId).toBe(mockUser.userId);
      expect(response.body.data.user.passwordHash).toBeUndefined(); // Should not include password
    });
  });
});