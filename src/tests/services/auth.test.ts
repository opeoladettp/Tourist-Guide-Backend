import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { AuthService, JWTPayload } from '../../services/auth';
import { UserService } from '../../services/user';
import { User, UserType, UserStatus } from '../../types/user';
import { config } from '../../config';

// Mock dependencies
vi.mock('../../services/user');
vi.mock('../../config', () => ({
  config: {
    jwt: {
      secret: 'test-secret',
      refreshSecret: 'test-refresh-secret',
      expiresIn: '15m',
      refreshExpiresIn: '7d'
    }
  }
}));

// Mock Prisma client
const mockPrismaClient = {
  refreshToken: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn()
  },
  user: {
    findUnique: vi.fn()
  }
};

describe('AuthService', () => {
  let authService: AuthService;
  let mockUserService: any;

  const mockUser: User = {
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

  beforeEach(() => {
    vi.clearAllMocks();
    authService = new AuthService(mockPrismaClient as any);
    mockUserService = vi.mocked(UserService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateAccessToken', () => {
    it('should generate a valid JWT access token', () => {
      const token = authService.generateAccessToken(mockUser);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      
      // Verify token structure
      const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;
      expect(decoded.sub).toBe(mockUser.userId);
      expect(decoded.email).toBe(mockUser.emailAddress);
      expect(decoded.role).toBe(mockUser.userType);
      expect(decoded.providerId).toBeUndefined(); // null becomes undefined
    });

    it('should include providerId when user has one', () => {
      const userWithProvider = { ...mockUser, providerId: 'provider-123' };
      const token = authService.generateAccessToken(userWithProvider);
      
      const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;
      expect(decoded.providerId).toBe('provider-123');
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a refresh token and store it in database', async () => {
      mockPrismaClient.refreshToken.create.mockResolvedValue({
        tokenId: 'token-123',
        userId: mockUser.userId,
        expiresAt: new Date(),
        isRevoked: false
      });

      const token = await authService.generateRefreshToken(mockUser.userId);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(mockPrismaClient.refreshToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUser.userId,
          isRevoked: false
        })
      });
    });
  });

  describe('validateAccessToken', () => {
    it('should validate a valid access token', () => {
      const token = authService.generateAccessToken(mockUser);
      const decoded = authService.validateAccessToken(token);
      
      expect(decoded.sub).toBe(mockUser.userId);
      expect(decoded.email).toBe(mockUser.emailAddress);
      expect(decoded.role).toBe(mockUser.userType);
    });

    it('should throw error for expired token', () => {
      const expiredToken = jwt.sign(
        { sub: mockUser.userId, email: mockUser.emailAddress, role: mockUser.userType },
        config.jwt.secret,
        { expiresIn: '-1h' }
      );

      expect(() => authService.validateAccessToken(expiredToken))
        .toThrow('Access token has expired');
    });

    it('should throw error for invalid token', () => {
      expect(() => authService.validateAccessToken('invalid-token'))
        .toThrow('Invalid access token');
    });

    it('should throw error for token with wrong secret', () => {
      const wrongToken = jwt.sign(
        { sub: mockUser.userId, email: mockUser.emailAddress, role: mockUser.userType },
        'wrong-secret'
      );

      expect(() => authService.validateAccessToken(wrongToken))
        .toThrow('Invalid access token');
    });
  });

  describe('validateRefreshToken', () => {
    it('should validate a valid refresh token', async () => {
      const tokenId = 'token-123';
      const refreshToken = jwt.sign(
        { sub: mockUser.userId, tokenId, type: 'refresh' },
        config.jwt.refreshSecret
      );

      mockPrismaClient.refreshToken.findUnique.mockResolvedValue({
        tokenId,
        userId: mockUser.userId,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day from now
        isRevoked: false
      });

      const result = await authService.validateRefreshToken(refreshToken);
      
      expect(result.userId).toBe(mockUser.userId);
      expect(result.tokenId).toBe(tokenId);
    });

    it('should throw error for revoked token', async () => {
      const tokenId = 'token-123';
      const refreshToken = jwt.sign(
        { sub: mockUser.userId, tokenId, type: 'refresh' },
        config.jwt.refreshSecret
      );

      mockPrismaClient.refreshToken.findUnique.mockResolvedValue({
        tokenId,
        userId: mockUser.userId,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        isRevoked: true
      });

      await expect(authService.validateRefreshToken(refreshToken))
        .rejects.toThrow('Refresh token has been revoked');
    });

    it('should throw error for expired token in database', async () => {
      const tokenId = 'token-123';
      const refreshToken = jwt.sign(
        { sub: mockUser.userId, tokenId, type: 'refresh' },
        config.jwt.refreshSecret
      );

      mockPrismaClient.refreshToken.findUnique.mockResolvedValue({
        tokenId,
        userId: mockUser.userId,
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        isRevoked: false
      });

      await expect(authService.validateRefreshToken(refreshToken))
        .rejects.toThrow('Refresh token has expired');
    });

    it('should throw error for non-existent token', async () => {
      const tokenId = 'token-123';
      const refreshToken = jwt.sign(
        { sub: mockUser.userId, tokenId, type: 'refresh' },
        config.jwt.refreshSecret
      );

      mockPrismaClient.refreshToken.findUnique.mockResolvedValue(null);

      await expect(authService.validateRefreshToken(refreshToken))
        .rejects.toThrow('Refresh token has been revoked');
    });
  });

  describe('authenticateUser', () => {
    beforeEach(() => {
      // Mock the UserService instance methods
      authService['userService'].verifyCredentials = vi.fn();
    });

    it('should authenticate user with valid credentials', async () => {
      authService['userService'].verifyCredentials = vi.fn().mockResolvedValue(mockUser);
      mockPrismaClient.refreshToken.create.mockResolvedValue({
        tokenId: 'token-123',
        userId: mockUser.userId,
        expiresAt: new Date(),
        isRevoked: false
      });

      const result = await authService.authenticateUser('john.doe@example.com', 'password123');
      
      expect(result.user).toEqual(mockUser);
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
      expect(result.tokens.expiresIn).toBe(config.jwt.expiresIn);
    });

    it('should throw error for invalid credentials', async () => {
      authService['userService'].verifyCredentials = vi.fn().mockResolvedValue(null);

      await expect(authService.authenticateUser('john.doe@example.com', 'wrongpassword'))
        .rejects.toThrow('Invalid credentials');
    });

    it('should throw error for inactive user', async () => {
      const inactiveUser = { ...mockUser, status: UserStatus.INACTIVE };
      authService['userService'].verifyCredentials = vi.fn().mockResolvedValue(inactiveUser);

      await expect(authService.authenticateUser('john.doe@example.com', 'password123'))
        .rejects.toThrow('User account is inactive');
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh access token with valid refresh token', async () => {
      const tokenId = 'token-123';
      const refreshToken = jwt.sign(
        { sub: mockUser.userId, tokenId, type: 'refresh' },
        config.jwt.refreshSecret
      );

      // Mock refresh token validation
      mockPrismaClient.refreshToken.findUnique.mockResolvedValue({
        tokenId,
        userId: mockUser.userId,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        isRevoked: false
      });

      // Mock user lookup
      mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);

      // Mock token revocation and creation
      mockPrismaClient.refreshToken.update.mockResolvedValue({});
      mockPrismaClient.refreshToken.create.mockResolvedValue({
        tokenId: 'new-token-123',
        userId: mockUser.userId,
        expiresAt: new Date(),
        isRevoked: false
      });

      const result = await authService.refreshAccessToken(refreshToken);
      
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.expiresIn).toBe(config.jwt.expiresIn);
      expect(mockPrismaClient.refreshToken.update).toHaveBeenCalledWith({
        where: { tokenId },
        data: { isRevoked: true }
      });
    });

    it('should throw error for inactive user', async () => {
      const tokenId = 'token-123';
      const refreshToken = jwt.sign(
        { sub: mockUser.userId, tokenId, type: 'refresh' },
        config.jwt.refreshSecret
      );

      mockPrismaClient.refreshToken.findUnique.mockResolvedValue({
        tokenId,
        userId: mockUser.userId,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        isRevoked: false
      });

      const inactiveUser = { ...mockUser, status: UserStatus.INACTIVE };
      mockPrismaClient.user.findUnique.mockResolvedValue(inactiveUser);

      await expect(authService.refreshAccessToken(refreshToken))
        .rejects.toThrow('User not found or inactive');
    });
  });

  describe('revokeRefreshToken', () => {
    it('should revoke refresh token', async () => {
      const tokenId = 'token-123';
      mockPrismaClient.refreshToken.update.mockResolvedValue({});

      await authService.revokeRefreshToken(tokenId);
      
      expect(mockPrismaClient.refreshToken.update).toHaveBeenCalledWith({
        where: { tokenId },
        data: { isRevoked: true }
      });
    });
  });

  describe('revokeAllUserTokens', () => {
    it('should revoke all user tokens', async () => {
      mockPrismaClient.refreshToken.updateMany.mockResolvedValue({ count: 3 });

      await authService.revokeAllUserTokens(mockUser.userId);
      
      expect(mockPrismaClient.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { 
          userId: mockUser.userId,
          isRevoked: false
        },
        data: { isRevoked: true }
      });
    });
  });

  describe('logoutUser', () => {
    it('should logout user by revoking refresh token', async () => {
      const tokenId = 'token-123';
      const refreshToken = jwt.sign(
        { sub: mockUser.userId, tokenId, type: 'refresh' },
        config.jwt.refreshSecret
      );

      mockPrismaClient.refreshToken.findUnique.mockResolvedValue({
        tokenId,
        userId: mockUser.userId,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        isRevoked: false
      });

      mockPrismaClient.refreshToken.update.mockResolvedValue({});

      await authService.logoutUser(refreshToken);
      
      expect(mockPrismaClient.refreshToken.update).toHaveBeenCalledWith({
        where: { tokenId },
        data: { isRevoked: true }
      });
    });

    it('should handle invalid refresh token gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      await expect(authService.logoutUser('invalid-token')).resolves.not.toThrow();
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should clean up expired and revoked tokens', async () => {
      mockPrismaClient.refreshToken.deleteMany.mockResolvedValue({ count: 5 });

      await authService.cleanupExpiredTokens();
      
      expect(mockPrismaClient.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { expiresAt: { lt: expect.any(Date) } },
            { isRevoked: true }
          ]
        }
      });
    });
  });
});