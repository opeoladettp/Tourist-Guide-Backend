import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { 
  AuthMiddleware, 
  PermissionChecker, 
  extractProviderIdFromParams, 
  extractUserIdFromParams,
  extractResourceOwnerFromBody,
  extractResourceOwnerFromParams
} from '../../middleware/auth';
import { AuthService } from '../../services/auth';
import { UserType } from '../../types/user';

// Mock dependencies
vi.mock('../../services/auth');

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

describe('AuthMiddleware', () => {
  let authMiddleware: AuthMiddleware;
  let mockAuthService: any;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    
    authMiddleware = new AuthMiddleware(mockPrismaClient as any);
    mockAuthService = vi.mocked(AuthService);
    
    mockRequest = {
      headers: {},
      path: '/test',
      params: {},
      body: {}
    };
    
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    };
    
    mockNext = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('authenticate', () => {
    it('should authenticate valid token', async () => {
      const mockPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        role: UserType.TOURIST,
        providerId: 'provider-123'
      };

      mockRequest.headers = {
        authorization: 'Bearer valid-token'
      };

      // Mock the validateAccessToken method
      authMiddleware['authService'].validateAccessToken = vi.fn().mockReturnValue(mockPayload);

      await authMiddleware.authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toEqual(mockPayload);
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should reject request without authorization header', async () => {
      await authMiddleware.authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'MISSING_AUTH_HEADER',
          message: 'Authorization header is required',
          timestamp: expect.any(String),
          path: '/test'
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject invalid authorization header format', async () => {
      mockRequest.headers = {
        authorization: 'InvalidFormat token'
      };

      await authMiddleware.authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'INVALID_AUTH_HEADER',
          message: 'Invalid authorization header format. Expected: Bearer <token>',
          timestamp: expect.any(String),
          path: '/test'
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject invalid token', async () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid-token'
      };

      authMiddleware['authService'].validateAccessToken = vi.fn().mockImplementation(() => {
        throw new Error('Invalid access token');
      });

      await authMiddleware.authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'AUTHENTICATION_FAILED',
          message: 'Invalid access token',
          timestamp: expect.any(String),
          path: '/test'
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('authorize', () => {
    beforeEach(() => {
      mockRequest.user = {
        sub: 'user-123',
        email: 'test@example.com',
        role: UserType.TOURIST,
        providerId: 'provider-123'
      };
    });

    it('should allow access for authorized role', () => {
      const authorizeMiddleware = authMiddleware.authorize([UserType.TOURIST, UserType.PROVIDER_ADMIN]);
      
      authorizeMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should deny access for unauthorized role', () => {
      const authorizeMiddleware = authMiddleware.authorize([UserType.SYSTEM_ADMIN]);
      
      authorizeMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Access denied. Required roles: SYSTEM_ADMIN',
          timestamp: expect.any(String),
          path: '/test'
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should deny access for unauthenticated user', () => {
      mockRequest.user = undefined;
      const authorizeMiddleware = authMiddleware.authorize([UserType.TOURIST]);
      
      authorizeMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required',
          timestamp: expect.any(String),
          path: '/test'
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requireProviderAccess', () => {
    it('should allow system admin access', () => {
      mockRequest.user = {
        sub: 'user-123',
        email: 'admin@example.com',
        role: UserType.SYSTEM_ADMIN
      };

      authMiddleware.requireProviderAccess(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should allow provider admin with provider ID', () => {
      mockRequest.user = {
        sub: 'user-123',
        email: 'admin@example.com',
        role: UserType.PROVIDER_ADMIN,
        providerId: 'provider-123'
      };

      authMiddleware.requireProviderAccess(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should deny provider admin without provider ID', () => {
      mockRequest.user = {
        sub: 'user-123',
        email: 'admin@example.com',
        role: UserType.PROVIDER_ADMIN
      };

      authMiddleware.requireProviderAccess(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'MISSING_PROVIDER_ASSOCIATION',
          message: 'User must be associated with a provider',
          timestamp: expect.any(String),
          path: '/test'
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('validateProviderOwnership', () => {
    it('should allow system admin access to any provider', () => {
      mockRequest.user = {
        sub: 'user-123',
        email: 'admin@example.com',
        role: UserType.SYSTEM_ADMIN
      };
      mockRequest.params = { providerId: 'provider-456' };

      const middleware = authMiddleware.validateProviderOwnership(extractProviderIdFromParams);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should allow provider admin access to their own provider', () => {
      mockRequest.user = {
        sub: 'user-123',
        email: 'admin@example.com',
        role: UserType.PROVIDER_ADMIN,
        providerId: 'provider-123'
      };
      mockRequest.params = { providerId: 'provider-123' };

      const middleware = authMiddleware.validateProviderOwnership(extractProviderIdFromParams);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should deny provider admin access to different provider', () => {
      mockRequest.user = {
        sub: 'user-123',
        email: 'admin@example.com',
        role: UserType.PROVIDER_ADMIN,
        providerId: 'provider-123'
      };
      mockRequest.params = { providerId: 'provider-456' };

      const middleware = authMiddleware.validateProviderOwnership(extractProviderIdFromParams);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'PROVIDER_ACCESS_DENIED',
          message: 'Access denied to resource from different provider',
          timestamp: expect.any(String),
          path: '/test'
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('validateUserOwnership', () => {
    it('should allow user access to their own resource', () => {
      mockRequest.user = {
        sub: 'user-123',
        email: 'user@example.com',
        role: UserType.TOURIST,
        providerId: 'provider-123'
      };
      mockRequest.params = { userId: 'user-123' };

      const middleware = authMiddleware.validateUserOwnership(extractUserIdFromParams);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should deny user access to different user resource', () => {
      mockRequest.user = {
        sub: 'user-123',
        email: 'user@example.com',
        role: UserType.TOURIST,
        providerId: 'provider-123'
      };
      mockRequest.params = { userId: 'user-456' };

      const middleware = authMiddleware.validateUserOwnership(extractUserIdFromParams);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'USER_ACCESS_DENIED',
          message: 'Access denied to resource from different user',
          timestamp: expect.any(String),
          path: '/test'
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requireAuth', () => {
    it('should return authentication middleware only when no roles specified', () => {
      const middlewares = authMiddleware.requireAuth();
      expect(middlewares).toHaveLength(1);
      expect(middlewares[0]).toBe(authMiddleware.authenticate);
    });

    it('should return authentication and authorization middleware when roles specified', () => {
      const middlewares = authMiddleware.requireAuth([UserType.SYSTEM_ADMIN]);
      expect(middlewares).toHaveLength(2);
      expect(middlewares[0]).toBe(authMiddleware.authenticate);
    });
  });

  describe('requireCreatePermission', () => {
    beforeEach(() => {
      mockRequest.user = {
        sub: 'user-123',
        email: 'admin@example.com',
        role: UserType.PROVIDER_ADMIN,
        providerId: 'provider-123'
      };
    });

    it('should allow provider admin to create tour events', () => {
      const middleware = authMiddleware.requireCreatePermission('tour-event');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should deny tourist from creating tour events', () => {
      mockRequest.user!.role = UserType.TOURIST;
      const middleware = authMiddleware.requireCreatePermission('tour-event');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'CREATE_PERMISSION_DENIED',
          message: 'Insufficient permissions to create tour-event',
          timestamp: expect.any(String),
          path: '/test'
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should deny unauthenticated user', () => {
      mockRequest.user = undefined;
      const middleware = authMiddleware.requireCreatePermission('tour-event');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requireDeletePermission', () => {
    beforeEach(() => {
      mockRequest.user = {
        sub: 'user-123',
        email: 'admin@example.com',
        role: UserType.PROVIDER_ADMIN,
        providerId: 'provider-123'
      };
    });

    it('should allow provider admin to delete tour events in their company', () => {
      const getResourceOwnerInfo = () => ({ ownerId: 'user-456', ownerProviderId: 'provider-123' });
      const middleware = authMiddleware.requireDeletePermission('tour-event', getResourceOwnerInfo);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should deny provider admin from deleting tour events from different company', () => {
      const getResourceOwnerInfo = () => ({ ownerId: 'user-456', ownerProviderId: 'provider-456' });
      const middleware = authMiddleware.requireDeletePermission('tour-event', getResourceOwnerInfo);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'DELETE_PERMISSION_DENIED',
          message: 'Insufficient permissions to delete tour-event',
          timestamp: expect.any(String),
          path: '/test'
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requireTourEventAccess', () => {
    beforeEach(() => {
      mockRequest.user = {
        sub: 'user-123',
        email: 'tourist@example.com',
        role: UserType.TOURIST,
        providerId: 'provider-123'
      };
    });

    it('should allow registered tourist to access tour event', async () => {
      const getTourEventInfo = vi.fn().mockResolvedValue({
        providerId: 'provider-123',
        registeredTouristIds: ['user-123', 'user-456']
      });
      
      const middleware = authMiddleware.requireTourEventAccess(getTourEventInfo);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should deny unregistered tourist access to tour event', async () => {
      const getTourEventInfo = vi.fn().mockResolvedValue({
        providerId: 'provider-123',
        registeredTouristIds: ['user-456', 'user-789']
      });
      
      const middleware = authMiddleware.requireTourEventAccess(getTourEventInfo);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'TOUR_EVENT_ACCESS_DENIED',
          message: 'Access denied to tour event',
          timestamp: expect.any(String),
          path: '/test'
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const getTourEventInfo = vi.fn().mockRejectedValue(new Error('Database error'));
      
      const middleware = authMiddleware.requireTourEventAccess(getTourEventInfo);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'TOUR_EVENT_ACCESS_CHECK_FAILED',
          message: 'Failed to validate tour event access',
          timestamp: expect.any(String),
          path: '/test'
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requireDocumentAccess', () => {
    beforeEach(() => {
      mockRequest.user = {
        sub: 'user-123',
        email: 'admin@example.com',
        role: UserType.PROVIDER_ADMIN,
        providerId: 'provider-123'
      };
    });

    it('should allow provider admin to access documents from their company users', async () => {
      const getDocumentOwnerInfo = vi.fn().mockResolvedValue({
        ownerId: 'user-456',
        ownerProviderId: 'provider-123'
      });
      
      const middleware = authMiddleware.requireDocumentAccess(getDocumentOwnerInfo);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should deny provider admin access to documents from different company', async () => {
      const getDocumentOwnerInfo = vi.fn().mockResolvedValue({
        ownerId: 'user-456',
        ownerProviderId: 'provider-456'
      });
      
      const middleware = authMiddleware.requireDocumentAccess(getDocumentOwnerInfo);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'DOCUMENT_ACCESS_DENIED',
          message: 'Access denied to document',
          timestamp: expect.any(String),
          path: '/test'
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});

describe('PermissionChecker', () => {
  describe('canAccessUser', () => {
    it('should allow system admin to access any user', () => {
      const result = PermissionChecker.canAccessUser(
        UserType.SYSTEM_ADMIN,
        'admin-123',
        undefined,
        'user-456',
        'provider-789'
      );
      expect(result).toBe(true);
    });

    it('should allow provider admin to access users in their company', () => {
      const result = PermissionChecker.canAccessUser(
        UserType.PROVIDER_ADMIN,
        'admin-123',
        'provider-123',
        'user-456',
        'provider-123'
      );
      expect(result).toBe(true);
    });

    it('should allow provider admin to access themselves', () => {
      const result = PermissionChecker.canAccessUser(
        UserType.PROVIDER_ADMIN,
        'admin-123',
        'provider-123',
        'admin-123',
        'provider-456'
      );
      expect(result).toBe(true);
    });

    it('should deny provider admin access to users in different company', () => {
      const result = PermissionChecker.canAccessUser(
        UserType.PROVIDER_ADMIN,
        'admin-123',
        'provider-123',
        'user-456',
        'provider-789'
      );
      expect(result).toBe(false);
    });

    it('should allow tourist to access their own data', () => {
      const result = PermissionChecker.canAccessUser(
        UserType.TOURIST,
        'user-123',
        'provider-123',
        'user-123',
        'provider-123'
      );
      expect(result).toBe(true);
    });

    it('should deny tourist access to other users data', () => {
      const result = PermissionChecker.canAccessUser(
        UserType.TOURIST,
        'user-123',
        'provider-123',
        'user-456',
        'provider-123'
      );
      expect(result).toBe(false);
    });
  });

  describe('canAccessProvider', () => {
    it('should allow system admin to access any provider', () => {
      const result = PermissionChecker.canAccessProvider(
        UserType.SYSTEM_ADMIN,
        undefined,
        'provider-123'
      );
      expect(result).toBe(true);
    });

    it('should allow provider admin to access their own provider', () => {
      const result = PermissionChecker.canAccessProvider(
        UserType.PROVIDER_ADMIN,
        'provider-123',
        'provider-123'
      );
      expect(result).toBe(true);
    });

    it('should deny provider admin access to different provider', () => {
      const result = PermissionChecker.canAccessProvider(
        UserType.PROVIDER_ADMIN,
        'provider-123',
        'provider-456'
      );
      expect(result).toBe(false);
    });

    it('should deny tourist access to providers', () => {
      const result = PermissionChecker.canAccessProvider(
        UserType.TOURIST,
        'provider-123',
        'provider-123'
      );
      expect(result).toBe(false);
    });
  });

  describe('canModifyResource', () => {
    it('should allow system admin to modify anything', () => {
      const result = PermissionChecker.canModifyResource(
        UserType.SYSTEM_ADMIN,
        UserType.PROVIDER_ADMIN,
        'admin-123',
        'user-456',
        undefined,
        'provider-789'
      );
      expect(result).toBe(true);
    });

    it('should allow provider admin to modify tourist in their company', () => {
      const result = PermissionChecker.canModifyResource(
        UserType.PROVIDER_ADMIN,
        UserType.TOURIST,
        'admin-123',
        'user-456',
        'provider-123',
        'provider-123'
      );
      expect(result).toBe(true);
    });

    it('should deny provider admin modifying system admin', () => {
      const result = PermissionChecker.canModifyResource(
        UserType.PROVIDER_ADMIN,
        UserType.SYSTEM_ADMIN,
        'admin-123',
        'sysadmin-456',
        'provider-123',
        undefined
      );
      expect(result).toBe(false);
    });

    it('should deny provider admin modifying other provider admin', () => {
      const result = PermissionChecker.canModifyResource(
        UserType.PROVIDER_ADMIN,
        UserType.PROVIDER_ADMIN,
        'admin-123',
        'admin-456',
        'provider-123',
        'provider-123'
      );
      expect(result).toBe(false);
    });

    it('should allow provider admin to modify themselves', () => {
      const result = PermissionChecker.canModifyResource(
        UserType.PROVIDER_ADMIN,
        UserType.PROVIDER_ADMIN,
        'admin-123',
        'admin-123',
        'provider-123',
        'provider-123'
      );
      expect(result).toBe(true);
    });

    it('should allow tourist to modify their own data', () => {
      const result = PermissionChecker.canModifyResource(
        UserType.TOURIST,
        UserType.TOURIST,
        'user-123',
        'user-123',
        'provider-123',
        'provider-123'
      );
      expect(result).toBe(true);
    });

    it('should deny tourist modifying other users', () => {
      const result = PermissionChecker.canModifyResource(
        UserType.TOURIST,
        UserType.TOURIST,
        'user-123',
        'user-456',
        'provider-123',
        'provider-123'
      );
      expect(result).toBe(false);
    });
  });

  describe('canAccessTourEvent', () => {
    it('should allow system admin to access any tour event', () => {
      const result = PermissionChecker.canAccessTourEvent(
        UserType.SYSTEM_ADMIN,
        'admin-123',
        undefined,
        'provider-456',
        ['user-789']
      );
      expect(result).toBe(true);
    });

    it('should allow provider admin to access tour events from their company', () => {
      const result = PermissionChecker.canAccessTourEvent(
        UserType.PROVIDER_ADMIN,
        'admin-123',
        'provider-123',
        'provider-123',
        ['user-456']
      );
      expect(result).toBe(true);
    });

    it('should deny provider admin access to tour events from different company', () => {
      const result = PermissionChecker.canAccessTourEvent(
        UserType.PROVIDER_ADMIN,
        'admin-123',
        'provider-123',
        'provider-456',
        ['user-456']
      );
      expect(result).toBe(false);
    });

    it('should allow registered tourist to access tour event', () => {
      const result = PermissionChecker.canAccessTourEvent(
        UserType.TOURIST,
        'user-123',
        'provider-123',
        'provider-456',
        ['user-123', 'user-456']
      );
      expect(result).toBe(true);
    });

    it('should deny unregistered tourist access to tour event', () => {
      const result = PermissionChecker.canAccessTourEvent(
        UserType.TOURIST,
        'user-123',
        'provider-123',
        'provider-456',
        ['user-456', 'user-789']
      );
      expect(result).toBe(false);
    });
  });

  describe('canRegisterForTourEvent', () => {
    it('should allow tourist to register for available tour event', () => {
      const result = PermissionChecker.canRegisterForTourEvent(
        UserType.TOURIST,
        'user-123',
        'provider-123',
        'provider-456',
        ['user-456'],
        5
      );
      expect(result).toBe(true);
    });

    it('should deny non-tourist from registering', () => {
      const result = PermissionChecker.canRegisterForTourEvent(
        UserType.PROVIDER_ADMIN,
        'admin-123',
        'provider-123',
        'provider-456',
        ['user-456'],
        5
      );
      expect(result).toBe(false);
    });

    it('should deny already registered tourist', () => {
      const result = PermissionChecker.canRegisterForTourEvent(
        UserType.TOURIST,
        'user-123',
        'provider-123',
        'provider-456',
        ['user-123', 'user-456'],
        5
      );
      expect(result).toBe(false);
    });

    it('should deny registration when no capacity remaining', () => {
      const result = PermissionChecker.canRegisterForTourEvent(
        UserType.TOURIST,
        'user-123',
        'provider-123',
        'provider-456',
        ['user-456'],
        0
      );
      expect(result).toBe(false);
    });
  });

  describe('canAccessDocument', () => {
    it('should allow system admin to access any document', () => {
      const result = PermissionChecker.canAccessDocument(
        UserType.SYSTEM_ADMIN,
        'admin-123',
        undefined,
        'user-456',
        'provider-789'
      );
      expect(result).toBe(true);
    });

    it('should allow provider admin to access documents from their company users', () => {
      const result = PermissionChecker.canAccessDocument(
        UserType.PROVIDER_ADMIN,
        'admin-123',
        'provider-123',
        'user-456',
        'provider-123'
      );
      expect(result).toBe(true);
    });

    it('should deny provider admin access to documents from different company', () => {
      const result = PermissionChecker.canAccessDocument(
        UserType.PROVIDER_ADMIN,
        'admin-123',
        'provider-123',
        'user-456',
        'provider-456'
      );
      expect(result).toBe(false);
    });

    it('should allow tourist to access their own documents', () => {
      const result = PermissionChecker.canAccessDocument(
        UserType.TOURIST,
        'user-123',
        'provider-123',
        'user-123',
        'provider-123'
      );
      expect(result).toBe(true);
    });

    it('should deny tourist access to other users documents', () => {
      const result = PermissionChecker.canAccessDocument(
        UserType.TOURIST,
        'user-123',
        'provider-123',
        'user-456',
        'provider-123'
      );
      expect(result).toBe(false);
    });
  });

  describe('canCreateResource', () => {
    it('should allow system admin to create any resource', () => {
      expect(PermissionChecker.canCreateResource(UserType.SYSTEM_ADMIN, 'user')).toBe(true);
      expect(PermissionChecker.canCreateResource(UserType.SYSTEM_ADMIN, 'provider')).toBe(true);
      expect(PermissionChecker.canCreateResource(UserType.SYSTEM_ADMIN, 'tour-template')).toBe(true);
      expect(PermissionChecker.canCreateResource(UserType.SYSTEM_ADMIN, 'tour-event')).toBe(true);
      expect(PermissionChecker.canCreateResource(UserType.SYSTEM_ADMIN, 'document')).toBe(true);
    });

    it('should allow provider admin to create users and tour events', () => {
      expect(PermissionChecker.canCreateResource(UserType.PROVIDER_ADMIN, 'user')).toBe(true);
      expect(PermissionChecker.canCreateResource(UserType.PROVIDER_ADMIN, 'tour-event')).toBe(true);
      expect(PermissionChecker.canCreateResource(UserType.PROVIDER_ADMIN, 'document')).toBe(true);
      expect(PermissionChecker.canCreateResource(UserType.PROVIDER_ADMIN, 'provider')).toBe(false);
      expect(PermissionChecker.canCreateResource(UserType.PROVIDER_ADMIN, 'tour-template')).toBe(false);
    });

    it('should allow tourist to create documents only', () => {
      expect(PermissionChecker.canCreateResource(UserType.TOURIST, 'document')).toBe(true);
      expect(PermissionChecker.canCreateResource(UserType.TOURIST, 'user')).toBe(false);
      expect(PermissionChecker.canCreateResource(UserType.TOURIST, 'provider')).toBe(false);
      expect(PermissionChecker.canCreateResource(UserType.TOURIST, 'tour-template')).toBe(false);
      expect(PermissionChecker.canCreateResource(UserType.TOURIST, 'tour-event')).toBe(false);
    });
  });

  describe('canDeleteResource', () => {
    it('should allow system admin to delete any resource', () => {
      expect(PermissionChecker.canDeleteResource(
        UserType.SYSTEM_ADMIN, 'admin-123', undefined, 'user', 'user-456', 'provider-789'
      )).toBe(true);
    });

    it('should allow provider admin to delete users in their company', () => {
      expect(PermissionChecker.canDeleteResource(
        UserType.PROVIDER_ADMIN, 'admin-123', 'provider-123', 'user', 'user-456', 'provider-123'
      )).toBe(true);
    });

    it('should deny provider admin from deleting themselves', () => {
      expect(PermissionChecker.canDeleteResource(
        UserType.PROVIDER_ADMIN, 'admin-123', 'provider-123', 'user', 'admin-123', 'provider-123'
      )).toBe(false);
    });

    it('should allow users to delete themselves', () => {
      expect(PermissionChecker.canDeleteResource(
        UserType.TOURIST, 'user-123', 'provider-123', 'user', 'user-123', 'provider-123'
      )).toBe(true);
    });

    it('should deny non-system-admin from deleting providers', () => {
      expect(PermissionChecker.canDeleteResource(
        UserType.PROVIDER_ADMIN, 'admin-123', 'provider-123', 'provider', 'provider-123', undefined
      )).toBe(false);
    });

    it('should deny non-system-admin from deleting tour templates', () => {
      expect(PermissionChecker.canDeleteResource(
        UserType.PROVIDER_ADMIN, 'admin-123', 'provider-123', 'tour-template', undefined, undefined
      )).toBe(false);
    });
  });
});

describe('Utility Functions', () => {
  describe('extractResourceOwnerFromBody', () => {
    it('should extract owner info from request body', () => {
      const mockReq = {
        body: {
          userId: 'user-123',
          providerId: 'provider-456'
        }
      } as Request;

      const result = extractResourceOwnerFromBody(mockReq);
      expect(result).toEqual({
        ownerId: 'user-123',
        ownerProviderId: 'provider-456'
      });
    });

    it('should handle missing fields gracefully', () => {
      const mockReq = {
        body: {}
      } as Request;

      const result = extractResourceOwnerFromBody(mockReq);
      expect(result).toEqual({
        ownerId: undefined,
        ownerProviderId: undefined
      });
    });
  });

  describe('extractResourceOwnerFromParams', () => {
    it('should extract owner info from request params', () => {
      const mockReq = {
        params: {
          userId: 'user-123',
          providerId: 'provider-456'
        }
      } as Request;

      const result = extractResourceOwnerFromParams(mockReq);
      expect(result).toEqual({
        ownerId: 'user-123',
        ownerProviderId: 'provider-456'
      });
    });

    it('should handle missing params gracefully', () => {
      const mockReq = {
        params: {}
      } as Request;

      const result = extractResourceOwnerFromParams(mockReq);
      expect(result).toEqual({
        ownerId: undefined,
        ownerProviderId: undefined
      });
    });
  });
});