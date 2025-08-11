import { Router, Request, Response } from 'express';
import { PrismaClient } from '../generated/prisma';
import { AuthService } from '../services/auth';
import { AuthMiddleware } from '../middleware/auth';
import { UserService } from '../services/user';
import { CreateUserInput, UserType } from '../types/user';
import Joi from 'joi';

const router = Router();

// Initialize services
const prisma = new PrismaClient();
const authService = new AuthService(prisma);
const authMiddleware = new AuthMiddleware(prisma);
const userService = new UserService(prisma);

// Validation schemas
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(1).required()
});

const refreshSchema = Joi.object({
  refreshToken: Joi.string().required()
});

const registerSchema = Joi.object({
  firstName: Joi.string().min(1).max(50).required(),
  middleName: Joi.string().max(50).optional(),
  lastName: Joi.string().min(1).max(50).required(),
  emailAddress: Joi.string().email().required(),
  phoneNumber: Joi.string().min(10).max(20).required(),
  country: Joi.string().min(2).max(50).required(),
  password: Joi.string().min(8).required(),
  passportNumber: Joi.string().max(20).optional(),
  dateOfBirth: Joi.date().optional(),
  gender: Joi.string().valid('Male', 'Female', 'Other').optional(),
  providerId: Joi.string().optional()
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: User login
 *     description: Authenticate user with email and password to obtain access and refresh tokens
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User email address
 *                 example: "user@example.com"
 *               password:
 *                 type: string
 *                 description: User password
 *                 example: "securePassword123"
 *             required:
 *               - email
 *               - password
 *     responses:
 *       200:
 *         description: Authentication successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Authentication successful"
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         userId:
 *                           type: string
 *                           format: uuid
 *                         firstName:
 *                           type: string
 *                         middleName:
 *                           type: string
 *                           nullable: true
 *                         lastName:
 *                           type: string
 *                         emailAddress:
 *                           type: string
 *                           format: email
 *                         userType:
 *                           type: string
 *                           enum: [SystemAdmin, ProviderAdmin, Tourist]
 *                         providerId:
 *                           type: string
 *                           format: uuid
 *                           nullable: true
 *                     tokens:
 *                       type: object
 *                       properties:
 *                         accessToken:
 *                           type: string
 *                           description: JWT access token (expires in 15 minutes)
 *                         refreshToken:
 *                           type: string
 *                           description: JWT refresh token (expires in 7 days)
 *                         expiresIn:
 *                           type: string
 *                           example: "15m"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Invalid request data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Authentication failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error:
 *                 code: "AUTHENTICATION_FAILED"
 *                 message: "Invalid credentials"
 *                 timestamp: "2024-01-01T12:00:00.000Z"
 *                 path: "/api/auth/login"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate request body
    const { error, value } = loginSchema.validate(req.body);
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

    const { email, password } = value;

    // Authenticate user
    const result = await authService.authenticateUser(email, password);

    // Return success response
    res.status(200).json({
      message: 'Authentication successful',
      data: {
        user: {
          userId: result.user.userId,
          firstName: result.user.firstName,
          middleName: result.user.middleName,
          lastName: result.user.lastName,
          emailAddress: result.user.emailAddress,
          userType: result.user.userType,
          providerId: result.user.providerId
        },
        tokens: result.tokens
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
    
    // Determine appropriate status code
    const statusCode = errorMessage.includes('Invalid credentials') || 
                      errorMessage.includes('User account is inactive') ? 401 : 500;

    res.status(statusCode).json({
      error: {
        code: statusCode === 401 ? 'AUTHENTICATION_FAILED' : 'INTERNAL_SERVER_ERROR',
        message: errorMessage,
        timestamp: new Date().toISOString(),
        path: req.path
      }
    });
  }
});

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Refresh access token
 *     description: Obtain a new access token using a valid refresh token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Valid refresh token
 *                 example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *             required:
 *               - refreshToken
 *     responses:
 *       200:
 *         description: Token refresh successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Token refresh successful"
 *                 data:
 *                   type: object
 *                   properties:
 *                     tokens:
 *                       type: object
 *                       properties:
 *                         accessToken:
 *                           type: string
 *                           description: New JWT access token
 *                         refreshToken:
 *                           type: string
 *                           description: New JWT refresh token (rotated)
 *                         expiresIn:
 *                           type: string
 *                           example: "15m"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Invalid request data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Token refresh failed (invalid, expired, or revoked token)
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
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate request body
    const { error, value } = refreshSchema.validate(req.body);
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

    const { refreshToken } = value;

    // Refresh tokens
    const newTokens = await authService.refreshAccessToken(refreshToken);

    // Return success response
    res.status(200).json({
      message: 'Token refresh successful',
      data: {
        tokens: newTokens
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Token refresh failed';
    
    // Determine appropriate status code
    const statusCode = errorMessage.includes('token') || 
                      errorMessage.includes('expired') ||
                      errorMessage.includes('revoked') ||
                      errorMessage.includes('invalid') ? 401 : 500;

    res.status(statusCode).json({
      error: {
        code: statusCode === 401 ? 'TOKEN_REFRESH_FAILED' : 'INTERNAL_SERVER_ERROR',
        message: errorMessage,
        timestamp: new Date().toISOString(),
        path: req.path
      }
    });
  }
});

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: User logout
 *     description: Logout user by revoking the provided refresh token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Refresh token to revoke
 *                 example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *             required:
 *               - refreshToken
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Logout successful"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Invalid request data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/logout', async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate request body
    const { error, value } = refreshSchema.validate(req.body);
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

    const { refreshToken } = value;

    // Logout user
    await authService.logoutUser(refreshToken);

    // Return success response
    res.status(200).json({
      message: 'Logout successful',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    // For logout, we generally want to succeed even if the token is invalid
    // This prevents issues where users can't logout due to expired tokens
    console.warn('Logout warning:', error);
    
    res.status(200).json({
      message: 'Logout successful',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Register new tourist user
 *     description: Register a new tourist user account and receive authentication tokens
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 50
 *                 description: User first name
 *                 example: "John"
 *               middleName:
 *                 type: string
 *                 maxLength: 50
 *                 description: User middle name (optional)
 *                 example: "Michael"
 *               lastName:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 50
 *                 description: User last name
 *                 example: "Doe"
 *               emailAddress:
 *                 type: string
 *                 format: email
 *                 description: User email address
 *                 example: "john.doe@example.com"
 *               phoneNumber:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 20
 *                 description: User phone number
 *                 example: "+1234567890"
 *               country:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 50
 *                 description: User country
 *                 example: "United States"
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 description: User password (minimum 8 characters)
 *                 example: "securePassword123"
 *               passportNumber:
 *                 type: string
 *                 maxLength: 20
 *                 description: Passport number (optional)
 *                 example: "A12345678"
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *                 description: Date of birth (optional)
 *                 example: "1990-01-15"
 *               gender:
 *                 type: string
 *                 enum: [Male, Female, Other]
 *                 description: User gender (optional)
 *                 example: "Male"
 *               providerId:
 *                 type: string
 *                 format: uuid
 *                 description: Associated provider ID (optional)
 *             required:
 *               - firstName
 *               - lastName
 *               - emailAddress
 *               - phoneNumber
 *               - country
 *               - password
 *     responses:
 *       201:
 *         description: User registration successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "User registration successful"
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         userId:
 *                           type: string
 *                           format: uuid
 *                         firstName:
 *                           type: string
 *                         middleName:
 *                           type: string
 *                           nullable: true
 *                         lastName:
 *                           type: string
 *                         emailAddress:
 *                           type: string
 *                           format: email
 *                         userType:
 *                           type: string
 *                           example: "Tourist"
 *                         providerId:
 *                           type: string
 *                           format: uuid
 *                           nullable: true
 *                     tokens:
 *                       type: object
 *                       properties:
 *                         accessToken:
 *                           type: string
 *                         refreshToken:
 *                           type: string
 *                         expiresIn:
 *                           type: string
 *                           example: "15m"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Invalid request data or validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: User already exists
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
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate request body
    const { error, value } = registerSchema.validate(req.body);
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

    // Create user input with TOURIST role
    const createUserInput: CreateUserInput = {
      ...value,
      userType: UserType.TOURIST
    };

    // Create user
    const user = await userService.createUser(createUserInput);

    // Generate tokens for the new user
    const accessToken = authService.generateAccessToken(user);
    const refreshToken = await authService.generateRefreshToken(user.userId);

    // Return success response
    res.status(201).json({
      message: 'User registration successful',
      data: {
        user: {
          userId: user.userId,
          firstName: user.firstName,
          middleName: user.middleName,
          lastName: user.lastName,
          emailAddress: user.emailAddress,
          userType: user.userType,
          providerId: user.providerId
        },
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: '15m'
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Registration failed';
    
    // Determine appropriate status code
    let statusCode = 500;
    let errorCode = 'INTERNAL_SERVER_ERROR';
    
    if (errorMessage.includes('already exists')) {
      statusCode = 409;
      errorCode = 'USER_ALREADY_EXISTS';
    } else if (errorMessage.includes('Validation error') || errorMessage.includes('Password validation')) {
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
});

/**
 * @swagger
 * /api/auth/logout-all:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Logout from all devices
 *     description: Logout user from all devices by revoking all refresh tokens
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout from all devices successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Logout from all devices successful"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
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
router.post('/logout-all', authMiddleware.authenticate, async (req: Request, res: Response): Promise<void> => {
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

    // Revoke all user tokens
    await authService.revokeAllUserTokens(req.user.sub);

    // Return success response
    res.status(200).json({
      message: 'Logout from all devices successful',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Logout failed';
    
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: errorMessage,
        timestamp: new Date().toISOString(),
        path: req.path
      }
    });
  }
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     tags:
 *       - Authentication
 *     summary: Get current user information
 *     description: Retrieve detailed information about the currently authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "User information retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: User not found
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
router.get('/me', authMiddleware.authenticate, async (req: Request, res: Response): Promise<void> => {
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

    // Get user details from database
    const user = await userService.getUserById(
      req.user.sub,
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
      message: 'User information retrieved successfully',
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
    const errorMessage = error instanceof Error ? error.message : 'Failed to retrieve user information';
    
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: errorMessage,
        timestamp: new Date().toISOString(),
        path: req.path
      }
    });
  }
});

export default router;