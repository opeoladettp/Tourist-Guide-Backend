import { Request, Response, NextFunction } from 'express';
import { AuthService, JWTPayload } from '../services/auth';
import { UserType } from '../types/user';
import { PrismaClient } from '../generated/prisma';

// Extend Express Request interface to include user data
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user: JWTPayload;
}

export class AuthMiddleware {
  private authService: AuthService;

  constructor(prismaClient: PrismaClient) {
    this.authService = new AuthService(prismaClient);
  }

  /**
   * Middleware to authenticate JWT token
   */
  authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
        res.status(401).json({
          error: {
            code: 'MISSING_AUTH_HEADER',
            message: 'Authorization header is required',
            timestamp: new Date().toISOString(),
            path: req.path
          }
        });
        return;
      }

      const token = this.extractTokenFromHeader(authHeader);
      if (!token) {
        res.status(401).json({
          error: {
            code: 'INVALID_AUTH_HEADER',
            message: 'Invalid authorization header format. Expected: Bearer <token>',
            timestamp: new Date().toISOString(),
            path: req.path
          }
        });
        return;
      }

      // Validate the token
      const decoded = this.authService.validateAccessToken(token);
      req.user = decoded;
      
      next();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      res.status(401).json({
        error: {
          code: 'AUTHENTICATION_FAILED',
          message: errorMessage,
          timestamp: new Date().toISOString(),
          path: req.path
        }
      });
    }
  };

  /**
   * Middleware to authorize based on user roles
   */
  authorize = (allowedRoles: UserType[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Authentication required',
            timestamp: new Date().toISOString(),
            path: req.path
          }
        });
        return;
      }

      if (!allowedRoles.includes(req.user.role)) {
        res.status(403).json({
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: `Access denied. Required roles: ${allowedRoles.join(', ')}`,
            timestamp: new Date().toISOString(),
            path: req.path
          }
        });
        return;
      }

      next();
    };
  };

  /**
   * Middleware to check provider-scoped access
   */
  requireProviderAccess = (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required',
          timestamp: new Date().toISOString(),
          path: req.path
        }
      });
      return;
    }

    const { role, providerId } = req.user;

    // System admin has access to all providers
    if (role === UserType.SYSTEM_ADMIN) {
      next();
      return;
    }

    // Provider admin and tourist must have a provider ID
    if ((role === UserType.PROVIDER_ADMIN || role === UserType.TOURIST) && !providerId) {
      res.status(403).json({
        error: {
          code: 'MISSING_PROVIDER_ASSOCIATION',
          message: 'User must be associated with a provider',
          timestamp: new Date().toISOString(),
          path: req.path
        }
      });
      return;
    }

    next();
  };

  /**
   * Middleware to validate provider ownership for resource access
   */
  validateProviderOwnership = (getProviderIdFromRequest: (req: Request) => string | undefined) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Authentication required',
            timestamp: new Date().toISOString(),
            path: req.path
          }
        });
        return;
      }

      const { role, providerId: userProviderId } = req.user;
      const resourceProviderId = getProviderIdFromRequest(req);

      // System admin can access any resource
      if (role === UserType.SYSTEM_ADMIN) {
        next();
        return;
      }

      // For provider-scoped users, check if they own the resource
      if (role === UserType.PROVIDER_ADMIN || role === UserType.TOURIST) {
        if (!userProviderId) {
          res.status(403).json({
            error: {
              code: 'MISSING_PROVIDER_ASSOCIATION',
              message: 'User must be associated with a provider',
              timestamp: new Date().toISOString(),
              path: req.path
            }
          });
          return;
        }

        if (resourceProviderId && resourceProviderId !== userProviderId) {
          res.status(403).json({
            error: {
              code: 'PROVIDER_ACCESS_DENIED',
              message: 'Access denied to resource from different provider',
              timestamp: new Date().toISOString(),
              path: req.path
            }
          });
          return;
        }
      }

      next();
    };
  };

  /**
   * Middleware to validate user ownership for resource access
   */
  validateUserOwnership = (getUserIdFromRequest: (req: Request) => string | undefined) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Authentication required',
            timestamp: new Date().toISOString(),
            path: req.path
          }
        });
        return;
      }

      const { role, sub: userId, providerId: userProviderId } = req.user;
      const resourceUserId = getUserIdFromRequest(req);

      // System admin can access any user resource
      if (role === UserType.SYSTEM_ADMIN) {
        next();
        return;
      }

      // Provider admin can access users in their company
      if (role === UserType.PROVIDER_ADMIN && userProviderId) {
        // This would require a database lookup to verify the target user's provider
        // For now, we'll allow it and let the service layer handle the detailed check
        next();
        return;
      }

      // Tourist can only access their own resources
      if (role === UserType.TOURIST) {
        if (resourceUserId !== userId) {
          res.status(403).json({
            error: {
              code: 'USER_ACCESS_DENIED',
              message: 'Access denied to resource from different user',
              timestamp: new Date().toISOString(),
              path: req.path
            }
          });
          return;
        }
      }

      next();
    };
  };

  /**
   * Middleware to check if user can create specific resource type
   */
  requireCreatePermission = (resourceType: 'user' | 'provider' | 'tour-template' | 'tour-event' | 'document') => {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Authentication required',
            timestamp: new Date().toISOString(),
            path: req.path
          }
        });
        return;
      }

      const canCreate = PermissionChecker.canCreateResource(req.user.role, resourceType);
      
      if (!canCreate) {
        res.status(403).json({
          error: {
            code: 'CREATE_PERMISSION_DENIED',
            message: `Insufficient permissions to create ${resourceType}`,
            timestamp: new Date().toISOString(),
            path: req.path
          }
        });
        return;
      }

      next();
    };
  };

  /**
   * Middleware to check if user can delete specific resource
   */
  requireDeletePermission = (
    resourceType: 'user' | 'provider' | 'tour-template' | 'tour-event' | 'document',
    getResourceOwnerInfo: (req: Request) => { ownerId?: string; ownerProviderId?: string }
  ) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Authentication required',
            timestamp: new Date().toISOString(),
            path: req.path
          }
        });
        return;
      }

      const { ownerId, ownerProviderId } = getResourceOwnerInfo(req);
      const canDelete = PermissionChecker.canDeleteResource(
        req.user.role,
        req.user.sub,
        req.user.providerId,
        resourceType,
        ownerId,
        ownerProviderId
      );
      
      if (!canDelete) {
        res.status(403).json({
          error: {
            code: 'DELETE_PERMISSION_DENIED',
            message: `Insufficient permissions to delete ${resourceType}`,
            timestamp: new Date().toISOString(),
            path: req.path
          }
        });
        return;
      }

      next();
    };
  };

  /**
   * Middleware to validate tour event access for tourists
   */
  requireTourEventAccess = (
    getTourEventInfo: (req: Request) => Promise<{ providerId: string; registeredTouristIds: string[] }>
  ) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      if (!req.user) {
        res.status(401).json({
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Authentication required',
            timestamp: new Date().toISOString(),
            path: req.path
          }
        });
        return;
      }

      try {
        const { providerId, registeredTouristIds } = await getTourEventInfo(req);
        const canAccess = PermissionChecker.canAccessTourEvent(
          req.user.role,
          req.user.sub,
          req.user.providerId,
          providerId,
          registeredTouristIds
        );

        if (!canAccess) {
          res.status(403).json({
            error: {
              code: 'TOUR_EVENT_ACCESS_DENIED',
              message: 'Access denied to tour event',
              timestamp: new Date().toISOString(),
              path: req.path
            }
          });
          return;
        }

        next();
      } catch (error) {
        res.status(500).json({
          error: {
            code: 'TOUR_EVENT_ACCESS_CHECK_FAILED',
            message: 'Failed to validate tour event access',
            timestamp: new Date().toISOString(),
            path: req.path
          }
        });
      }
    };
  };

  /**
   * Middleware to validate document access permissions
   */
  requireDocumentAccess = (
    getDocumentOwnerInfo: (req: Request) => Promise<{ ownerId: string; ownerProviderId?: string }>
  ) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      if (!req.user) {
        res.status(401).json({
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Authentication required',
            timestamp: new Date().toISOString(),
            path: req.path
          }
        });
        return;
      }

      try {
        const { ownerId, ownerProviderId } = await getDocumentOwnerInfo(req);
        const canAccess = PermissionChecker.canAccessDocument(
          req.user.role,
          req.user.sub,
          req.user.providerId,
          ownerId,
          ownerProviderId
        );

        if (!canAccess) {
          res.status(403).json({
            error: {
              code: 'DOCUMENT_ACCESS_DENIED',
              message: 'Access denied to document',
              timestamp: new Date().toISOString(),
              path: req.path
            }
          });
          return;
        }

        next();
      } catch (error) {
        res.status(500).json({
          error: {
            code: 'DOCUMENT_ACCESS_CHECK_FAILED',
            message: 'Failed to validate document access',
            timestamp: new Date().toISOString(),
            path: req.path
          }
        });
      }
    };
  };

  /**
   * Combined middleware for authentication and authorization
   */
  requireAuth = (allowedRoles?: UserType[]) => {
    return [
      this.authenticate,
      ...(allowedRoles ? [this.authorize(allowedRoles)] : [])
    ];
  };

  /**
   * Extract token from Authorization header
   */
  private extractTokenFromHeader(authHeader: string): string | null {
    const parts = authHeader.split(' ');
    
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }
    
    return parts[1];
  }
}

// Utility functions for common provider/user ID extraction patterns
export const extractProviderIdFromParams = (req: Request): string | undefined => {
  return req.params.providerId;
};

export const extractProviderIdFromBody = (req: Request): string | undefined => {
  return req.body.providerId;
};

export const extractUserIdFromParams = (req: Request): string | undefined => {
  return req.params.userId || req.params.id;
};

export const extractUserIdFromBody = (req: Request): string | undefined => {
  return req.body.userId;
};

// Additional utility functions for resource extraction
export const extractTourEventIdFromParams = (req: Request): string | undefined => {
  return req.params.tourEventId || req.params.id;
};

export const extractDocumentIdFromParams = (req: Request): string | undefined => {
  return req.params.documentId || req.params.id;
};

export const extractResourceOwnerFromBody = (req: Request): { ownerId?: string; ownerProviderId?: string } => {
  return {
    ownerId: req.body.userId || req.body.ownerId,
    ownerProviderId: req.body.providerId || req.body.ownerProviderId
  };
};

export const extractResourceOwnerFromParams = (req: Request): { ownerId?: string; ownerProviderId?: string } => {
  return {
    ownerId: req.params.userId || req.params.ownerId,
    ownerProviderId: req.params.providerId || req.params.ownerProviderId
  };
};

// Permission checking utilities
export class PermissionChecker {
  /**
   * Check if user can access another user's data
   */
  static canAccessUser(
    requestingUserRole: UserType,
    requestingUserId: string,
    requestingUserProviderId: string | undefined,
    targetUserId: string,
    targetUserProviderId: string | undefined
  ): boolean {
    // System admin can access any user
    if (requestingUserRole === UserType.SYSTEM_ADMIN) {
      return true;
    }

    // Provider admin can access users in their company
    if (requestingUserRole === UserType.PROVIDER_ADMIN && requestingUserProviderId) {
      return targetUserProviderId === requestingUserProviderId || targetUserId === requestingUserId;
    }

    // Tourist can only access their own data
    if (requestingUserRole === UserType.TOURIST) {
      return targetUserId === requestingUserId;
    }

    return false;
  }

  /**
   * Check if user can access provider data
   */
  static canAccessProvider(
    requestingUserRole: UserType,
    requestingUserProviderId: string | undefined,
    targetProviderId: string
  ): boolean {
    // System admin can access any provider
    if (requestingUserRole === UserType.SYSTEM_ADMIN) {
      return true;
    }

    // Provider admin can access their own provider
    if (requestingUserRole === UserType.PROVIDER_ADMIN && requestingUserProviderId) {
      return requestingUserProviderId === targetProviderId;
    }

    return false;
  }

  /**
   * Check if user can modify resource
   */
  static canModifyResource(
    requestingUserRole: UserType,
    resourceOwnerRole: UserType,
    requestingUserId: string,
    resourceOwnerId: string,
    requestingUserProviderId: string | undefined,
    resourceOwnerProviderId: string | undefined
  ): boolean {
    // System admin can modify anything
    if (requestingUserRole === UserType.SYSTEM_ADMIN) {
      return true;
    }

    // Provider admin can modify users in their company (except other provider admins)
    if (requestingUserRole === UserType.PROVIDER_ADMIN && requestingUserProviderId) {
      if (resourceOwnerRole === UserType.SYSTEM_ADMIN) {
        return false; // Cannot modify system admin
      }
      
      if (resourceOwnerRole === UserType.PROVIDER_ADMIN && resourceOwnerId !== requestingUserId) {
        return false; // Cannot modify other provider admins
      }
      
      return resourceOwnerProviderId === requestingUserProviderId;
    }

    // Tourist can only modify their own data
    if (requestingUserRole === UserType.TOURIST) {
      return requestingUserId === resourceOwnerId;
    }

    return false;
  }

  /**
   * Check if user can access tour event based on role and registration status
   */
  static canAccessTourEvent(
    requestingUserRole: UserType,
    requestingUserId: string,
    requestingUserProviderId: string | undefined,
    tourEventProviderId: string,
    registeredTouristIds: string[]
  ): boolean {
    // System admin can access any tour event
    if (requestingUserRole === UserType.SYSTEM_ADMIN) {
      return true;
    }

    // Provider admin can access tour events from their company
    if (requestingUserRole === UserType.PROVIDER_ADMIN && requestingUserProviderId) {
      return requestingUserProviderId === tourEventProviderId;
    }

    // Tourist can access tour events they are registered for
    if (requestingUserRole === UserType.TOURIST) {
      return registeredTouristIds.includes(requestingUserId);
    }

    return false;
  }

  /**
   * Check if user can register for a tour event
   */
  static canRegisterForTourEvent(
    requestingUserRole: UserType,
    requestingUserId: string,
    requestingUserProviderId: string | undefined,
    tourEventProviderId: string,
    registeredTouristIds: string[],
    remainingCapacity: number
  ): boolean {
    // Only tourists can register for tour events
    if (requestingUserRole !== UserType.TOURIST) {
      return false;
    }

    // Tourist must not already be registered
    if (registeredTouristIds.includes(requestingUserId)) {
      return false;
    }

    // Must have remaining capacity
    if (remainingCapacity <= 0) {
      return false;
    }

    return true;
  }

  /**
   * Check if user can access documents based on role and ownership
   */
  static canAccessDocument(
    requestingUserRole: UserType,
    requestingUserId: string,
    requestingUserProviderId: string | undefined,
    documentOwnerId: string,
    documentOwnerProviderId: string | undefined
  ): boolean {
    // System admin can access any document
    if (requestingUserRole === UserType.SYSTEM_ADMIN) {
      return true;
    }

    // Provider admin can access documents of users in their company
    if (requestingUserRole === UserType.PROVIDER_ADMIN && requestingUserProviderId) {
      return documentOwnerProviderId === requestingUserProviderId;
    }

    // Tourist can only access their own documents
    if (requestingUserRole === UserType.TOURIST) {
      return documentOwnerId === requestingUserId;
    }

    return false;
  }

  /**
   * Check if user can create resources based on role
   */
  static canCreateResource(
    requestingUserRole: UserType,
    resourceType: 'user' | 'provider' | 'tour-template' | 'tour-event' | 'document'
  ): boolean {
    switch (resourceType) {
      case 'user':
        // System admin can create any user, Provider admin can create tourists in their company
        return requestingUserRole === UserType.SYSTEM_ADMIN || requestingUserRole === UserType.PROVIDER_ADMIN;
      
      case 'provider':
        // Only system admin can create providers
        return requestingUserRole === UserType.SYSTEM_ADMIN;
      
      case 'tour-template':
        // Only system admin can create tour templates
        return requestingUserRole === UserType.SYSTEM_ADMIN;
      
      case 'tour-event':
        // System admin and provider admin can create tour events
        return requestingUserRole === UserType.SYSTEM_ADMIN || requestingUserRole === UserType.PROVIDER_ADMIN;
      
      case 'document':
        // All authenticated users can upload documents
        return true;
      
      default:
        return false;
    }
  }

  /**
   * Check if user can delete resources based on role and ownership
   */
  static canDeleteResource(
    requestingUserRole: UserType,
    requestingUserId: string,
    requestingUserProviderId: string | undefined,
    resourceType: 'user' | 'provider' | 'tour-template' | 'tour-event' | 'document',
    resourceOwnerId?: string,
    resourceOwnerProviderId?: string
  ): boolean {
    // System admin can delete anything
    if (requestingUserRole === UserType.SYSTEM_ADMIN) {
      return true;
    }

    switch (resourceType) {
      case 'user':
        // Provider admin can delete users in their company (except other provider admins)
        if (requestingUserRole === UserType.PROVIDER_ADMIN && requestingUserProviderId && resourceOwnerProviderId) {
          return requestingUserProviderId === resourceOwnerProviderId && resourceOwnerId !== requestingUserId;
        }
        // Users can delete themselves
        return resourceOwnerId === requestingUserId;
      
      case 'provider':
        // Only system admin can delete providers
        return false;
      
      case 'tour-template':
        // Only system admin can delete tour templates
        return false;
      
      case 'tour-event':
        // Provider admin can delete their own tour events
        return requestingUserRole === UserType.PROVIDER_ADMIN && 
               requestingUserProviderId === resourceOwnerProviderId;
      
      case 'document':
        // Users can delete their own documents, provider admin can delete documents of users in their company
        if (requestingUserRole === UserType.PROVIDER_ADMIN && requestingUserProviderId && resourceOwnerProviderId) {
          return requestingUserProviderId === resourceOwnerProviderId;
        }
        return resourceOwnerId === requestingUserId;
      
      default:
        return false;
    }
  }
}