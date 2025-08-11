import { Router, Request, Response } from 'express';
import { PrismaClient } from '../generated/prisma';
import { UserService } from '../services/user';
import { AuthMiddleware, extractUserIdFromParams } from '../middleware/auth';
import { CreateUserInput, UpdateUserInput, UserType } from '../types/user';
import Joi from 'joi';

const router = Router();

// Initialize services
const prisma = new PrismaClient();
const userService = new UserService(prisma);
const authMiddleware = new AuthMiddleware(prisma);

// Validation schemas
const createUserSchema = Joi.object({
  firstName: Joi.string().min(1).max(50).required(),
  middleName: Joi.string().max(50).optional(),
  lastName: Joi.string().min(1).max(50).required(),
  emailAddress: Joi.string().email().required(),
  phoneNumber: Joi.string().min(10).max(20).required(),
  country: Joi.string().min(2).max(50).required(),
  password: Joi.string().min(8).required(),
  userType: Joi.string().valid('SystemAdmin', 'ProviderAdmin', 'Tourist').required(),
  passportNumber: Joi.string().max(20).optional(),
  dateOfBirth: Joi.date().optional(),
  gender: Joi.string().valid('Male', 'Female', 'Other').optional(),
  providerId: Joi.string().optional()
});

const updateUserSchema = Joi.object({
  firstName: Joi.string().min(1).max(50).optional(),
  middleName: Joi.string().max(50).optional(),
  lastName: Joi.string().min(1).max(50).optional(),
  phoneNumber: Joi.string().min(10).max(20).optional(),
  country: Joi.string().min(2).max(50).optional(),
  passportNumber: Joi.string().max(20).optional(),
  dateOfBirth: Joi.date().optional(),
  gender: Joi.string().valid('Male', 'Female', 'Other').optional(),
  status: Joi.string().valid('Active', 'Inactive').optional()
});

const querySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(50),
  offset: Joi.number().integer().min(0).default(0)
});

/**
 * @swagger
 * /api/users:
 *   get:
 *     tags:
 *       - User Management
 *     summary: Get users list
 *     description: |
 *       Retrieve users with role-based filtering:
 *       - SystemAdmin: Can see all users across all providers
 *       - ProviderAdmin: Can see users within their company only
 *       - Tourist: Can only see their own profile
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Maximum number of users to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of users to skip for pagination
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Users retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     users:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/User'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         limit:
 *                           type: integer
 *                         offset:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Invalid query parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', 
  authMiddleware.authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
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

      // Validate query parameters
      const { error, value } = querySchema.validate(req.query);
      if (error) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: error.details.map(d => d.message),
            timestamp: new Date().toISOString(),
            path: req.path
          }
        });
        return;
      }

      const { limit, offset } = value;

      // Get users with role-based filtering
      const users = await userService.getUsers(
        req.user.role,
        req.user.providerId,
        limit,
        offset
      );

      // Return users (excluding sensitive data)
      const sanitizedUsers = users.map(user => ({
        userId: user.userId,
        firstName: user.firstName,
        middleName: user.middleName,
        lastName: user.lastName,
        emailAddress: user.emailAddress,
        phoneNumber: user.phoneNumber,
        country: user.country,
        userType: user.userType,
        status: user.status,
        passportNumber: user.passportNumber,
        dateOfBirth: user.dateOfBirth,
        gender: user.gender,
        providerId: user.providerId,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }));

      res.status(200).json({
        message: 'Users retrieved successfully',
        data: {
          users: sanitizedUsers,
          pagination: {
            limit,
            offset,
            total: sanitizedUsers.length
          }
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to retrieve users';
      
      // Determine appropriate status code
      let statusCode = 500;
      let errorCode = 'INTERNAL_SERVER_ERROR';
      
      if (errorMessage.includes('Insufficient permissions')) {
        statusCode = 403;
        errorCode = 'INSUFFICIENT_PERMISSIONS';
      }

      res.status(statusCode).json({
        error: {
          code: errorCode,
          message: errorMessage,
          timestamp: new Date().toISOString(),
          path: req.path
        }
      });
    }
  }
);

/**
 * POST /api/users
 * Create new user (SysAd only)
 */
router.post('/',
  authMiddleware.authenticate,
  authMiddleware.authorize([UserType.SYSTEM_ADMIN]),
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Validate request body
      const { error, value } = createUserSchema.validate(req.body);
      if (error) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.details.map(d => d.message),
            timestamp: new Date().toISOString(),
            path: req.path
          }
        });
        return;
      }

      // Create user input
      const createUserInput: CreateUserInput = value;

      // Create user
      const user = await userService.createUser(createUserInput);

      // Return success response (excluding sensitive data)
      res.status(201).json({
        message: 'User created successfully',
        data: {
          user: {
            userId: user.userId,
            firstName: user.firstName,
            middleName: user.middleName,
            lastName: user.lastName,
            emailAddress: user.emailAddress,
            phoneNumber: user.phoneNumber,
            country: user.country,
            userType: user.userType,
            status: user.status,
            passportNumber: user.passportNumber,
            dateOfBirth: user.dateOfBirth,
            gender: user.gender,
            providerId: user.providerId,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
          }
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'User creation failed';
      
      // Determine appropriate status code
      let statusCode = 500;
      let errorCode = 'INTERNAL_SERVER_ERROR';
      
      if (errorMessage.includes('already exists')) {
        statusCode = 409;
        errorCode = 'USER_ALREADY_EXISTS';
      } else if (errorMessage.includes('Validation error') || errorMessage.includes('Password validation')) {
        statusCode = 400;
        errorCode = 'VALIDATION_ERROR';
      } else if (errorMessage.includes('Provider not found')) {
        statusCode = 400;
        errorCode = 'INVALID_PROVIDER';
      }

      res.status(statusCode).json({
        error: {
          code: errorCode,
          message: errorMessage,
          timestamp: new Date().toISOString(),
          path: req.path
        }
      });
    }
  }
);

/**
 * GET /api/users/:id
 * Get user by ID with access control
 */
router.get('/:id',
  authMiddleware.authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
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

      const userId = req.params.id;

      // Get user with role-based access control
      const user = await userService.getUserById(
        userId,
        req.user.sub,
        req.user.role,
        req.user.providerId
      );

      if (!user) {
        res.status(404).json({
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
            timestamp: new Date().toISOString(),
            path: req.path
          }
        });
        return;
      }

      // Return user information (excluding sensitive data)
      res.status(200).json({
        message: 'User retrieved successfully',
        data: {
          user: {
            userId: user.userId,
            firstName: user.firstName,
            middleName: user.middleName,
            lastName: user.lastName,
            emailAddress: user.emailAddress,
            phoneNumber: user.phoneNumber,
            country: user.country,
            userType: user.userType,
            status: user.status,
            passportNumber: user.passportNumber,
            dateOfBirth: user.dateOfBirth,
            gender: user.gender,
            providerId: user.providerId,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
          }
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to retrieve user';
      
      // Determine appropriate status code
      let statusCode = 500;
      let errorCode = 'INTERNAL_SERVER_ERROR';
      
      if (errorMessage.includes('Insufficient permissions')) {
        statusCode = 403;
        errorCode = 'INSUFFICIENT_PERMISSIONS';
      } else if (errorMessage.includes('Invalid user ID')) {
        statusCode = 400;
        errorCode = 'INVALID_USER_ID';
      }

      res.status(statusCode).json({
        error: {
          code: errorCode,
          message: errorMessage,
          timestamp: new Date().toISOString(),
          path: req.path
        }
      });
    }
  }
);

/**
 * PUT /api/users/:id
 * Update user profile
 */
router.put('/:id',
  authMiddleware.authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
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

      // Validate request body
      const { error, value } = updateUserSchema.validate(req.body);
      if (error) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.details.map(d => d.message),
            timestamp: new Date().toISOString(),
            path: req.path
          }
        });
        return;
      }

      const userId = req.params.id;
      const updateUserInput: UpdateUserInput = value;

      // Update user with role-based access control
      const updatedUser = await userService.updateUser(
        userId,
        updateUserInput,
        req.user.sub,
        req.user.role,
        req.user.providerId
      );

      // Return success response (excluding sensitive data)
      res.status(200).json({
        message: 'User updated successfully',
        data: {
          user: {
            userId: updatedUser.userId,
            firstName: updatedUser.firstName,
            middleName: updatedUser.middleName,
            lastName: updatedUser.lastName,
            emailAddress: updatedUser.emailAddress,
            phoneNumber: updatedUser.phoneNumber,
            country: updatedUser.country,
            userType: updatedUser.userType,
            status: updatedUser.status,
            passportNumber: updatedUser.passportNumber,
            dateOfBirth: updatedUser.dateOfBirth,
            gender: updatedUser.gender,
            providerId: updatedUser.providerId,
            createdAt: updatedUser.createdAt,
            updatedAt: updatedUser.updatedAt
          }
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'User update failed';
      
      // Determine appropriate status code
      let statusCode = 500;
      let errorCode = 'INTERNAL_SERVER_ERROR';
      
      if (errorMessage.includes('User not found')) {
        statusCode = 404;
        errorCode = 'USER_NOT_FOUND';
      } else if (errorMessage.includes('Insufficient permissions')) {
        statusCode = 403;
        errorCode = 'INSUFFICIENT_PERMISSIONS';
      } else if (errorMessage.includes('Validation error')) {
        statusCode = 400;
        errorCode = 'VALIDATION_ERROR';
      }

      res.status(statusCode).json({
        error: {
          code: errorCode,
          message: errorMessage,
          timestamp: new Date().toISOString(),
          path: req.path
        }
      });
    }
  }
);

/**
 * DELETE /api/users/:id
 * Delete user with role validation
 */
router.delete('/:id',
  authMiddleware.authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
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

      const userId = req.params.id;

      // Delete user with role-based access control
      await userService.deleteUser(
        userId,
        req.user.sub,
        req.user.role,
        req.user.providerId
      );

      // Return success response
      res.status(200).json({
        message: 'User deleted successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'User deletion failed';
      
      // Determine appropriate status code
      let statusCode = 500;
      let errorCode = 'INTERNAL_SERVER_ERROR';
      
      if (errorMessage.includes('User not found')) {
        statusCode = 404;
        errorCode = 'USER_NOT_FOUND';
      } else if (errorMessage.includes('Insufficient permissions') || errorMessage.includes('Cannot delete')) {
        statusCode = 403;
        errorCode = 'INSUFFICIENT_PERMISSIONS';
      }

      res.status(statusCode).json({
        error: {
          code: errorCode,
          message: errorMessage,
          timestamp: new Date().toISOString(),
          path: req.path
        }
      });
    }
  }
);

export default router;