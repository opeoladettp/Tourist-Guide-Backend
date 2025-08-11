import { Router, Request, Response } from 'express';
import { PrismaClient } from '../generated/prisma';
import { ProviderService } from '../services/provider';
import { AuthMiddleware, extractProviderIdFromParams } from '../middleware/auth';
import { CreateProviderInput, UpdateProviderInput } from '../types/provider';
import { UserType } from '../types/user';
import Joi from 'joi';

const router = Router();

// Initialize services
const prisma = new PrismaClient();
const providerService = new ProviderService(prisma);
const authMiddleware = new AuthMiddleware(prisma);

// Validation schemas
const createProviderSchema = Joi.object({
  companyName: Joi.string().trim().min(1).max(200).required(),
  country: Joi.string().trim().min(2).max(100).required(),
  addressLine1: Joi.string().trim().min(1).max(200).required(),
  addressLine2: Joi.string().trim().max(200).optional().allow(''),
  city: Joi.string().trim().min(1).max(100).required(),
  stateRegion: Joi.string().trim().min(1).max(100).required(),
  companyDescription: Joi.string().trim().min(1).max(1000).required(),
  phoneNumber: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).min(10).max(20).required(),
  emailAddress: Joi.string().email().required(),
  corpIdTaxId: Joi.string().trim().min(5).max(50).required(),
  isIsolatedInstance: Joi.boolean().optional().default(true)
});

const updateProviderSchema = Joi.object({
  companyName: Joi.string().trim().min(1).max(200).optional(),
  country: Joi.string().trim().min(2).max(100).optional(),
  addressLine1: Joi.string().trim().min(1).max(200).optional(),
  addressLine2: Joi.string().trim().max(200).optional().allow(''),
  city: Joi.string().trim().min(1).max(100).optional(),
  stateRegion: Joi.string().trim().min(1).max(100).optional(),
  companyDescription: Joi.string().trim().min(1).max(1000).optional(),
  phoneNumber: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).min(10).max(20).optional(),
  emailAddress: Joi.string().email().optional(),
  isIsolatedInstance: Joi.boolean().optional()
});

const querySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(50),
  offset: Joi.number().integer().min(0).default(0)
});

/**
 * @swagger
 * /api/providers:
 *   get:
 *     tags:
 *       - Providers
 *     summary: Get all providers
 *     description: Retrieve a list of all providers in the system. Only accessible by System Administrators.
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
 *         description: Maximum number of providers to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of providers to skip for pagination
 *     responses:
 *       200:
 *         description: Providers retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Providers retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     providers:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Provider'
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
 *       403:
 *         description: Insufficient permissions - SystemAdmin role required
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
  authMiddleware.authorize([UserType.SYSTEM_ADMIN]),
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

      // Get all providers
      const providers = await providerService.getProviders(req.user.role, limit, offset);

      res.status(200).json({
        message: 'Providers retrieved successfully',
        data: {
          providers,
          pagination: {
            limit,
            offset,
            total: providers.length
          }
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to retrieve providers';
      
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
 * @swagger
 * /api/providers:
 *   post:
 *     tags:
 *       - Providers
 *     summary: Create a new provider
 *     description: Create a new provider company. Only accessible by System Administrators.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - companyName
 *               - country
 *               - addressLine1
 *               - city
 *               - stateRegion
 *               - companyDescription
 *               - phoneNumber
 *               - emailAddress
 *               - corpIdTaxId
 *             properties:
 *               companyName:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 200
 *                 description: Company name
 *                 example: "Adventure Tours Inc."
 *               country:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *                 description: Company country
 *                 example: "United States"
 *               addressLine1:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 200
 *                 description: Primary address line
 *                 example: "123 Main Street"
 *               addressLine2:
 *                 type: string
 *                 maxLength: 200
 *                 description: Secondary address line (optional)
 *                 example: "Suite 456"
 *               city:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *                 description: City
 *                 example: "New York"
 *               stateRegion:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *                 description: State or region
 *                 example: "NY"
 *               companyDescription:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 1000
 *                 description: Company description
 *                 example: "Leading provider of adventure tours and travel experiences"
 *               phoneNumber:
 *                 type: string
 *                 pattern: '^\+?[\d\s\-\(\)]+$'
 *                 minLength: 10
 *                 maxLength: 20
 *                 description: Company phone number
 *                 example: "+1-555-123-4567"
 *               emailAddress:
 *                 type: string
 *                 format: email
 *                 description: Company email address
 *                 example: "contact@adventuretours.com"
 *               corpIdTaxId:
 *                 type: string
 *                 minLength: 5
 *                 maxLength: 50
 *                 description: Corporate ID or Tax ID
 *                 example: "12-3456789"
 *               isIsolatedInstance:
 *                 type: boolean
 *                 default: true
 *                 description: Whether this provider has data isolation
 *     responses:
 *       201:
 *         description: Provider created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Provider created successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     provider:
 *                       $ref: '#/components/schemas/Provider'
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
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Insufficient permissions - SystemAdmin role required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Provider with this email or corporate ID already exists
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
router.post('/',
  authMiddleware.authenticate,
  authMiddleware.authorize([UserType.SYSTEM_ADMIN]),
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
      const { error, value } = createProviderSchema.validate(req.body);
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

      const createProviderInput: CreateProviderInput = value;

      // Create provider
      const provider = await providerService.createProvider(createProviderInput, req.user.role);

      res.status(201).json({
        message: 'Provider created successfully',
        data: {
          provider
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Provider creation failed';
      
      let statusCode = 500;
      let errorCode = 'INTERNAL_SERVER_ERROR';
      
      if (errorMessage.includes('already exists')) {
        statusCode = 409;
        errorCode = 'PROVIDER_ALREADY_EXISTS';
      } else if (errorMessage.includes('Validation error')) {
        statusCode = 400;
        errorCode = 'VALIDATION_ERROR';
      } else if (errorMessage.includes('Insufficient permissions')) {
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
 * @swagger
 * /api/providers/{id}:
 *   get:
 *     tags:
 *       - Providers
 *     summary: Get provider by ID
 *     description: Retrieve a specific provider by ID. SystemAdmins can access any provider, while ProviderAdmins can only access their own provider.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Provider ID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: Provider retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Provider retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     provider:
 *                       $ref: '#/components/schemas/Provider'
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Insufficient permissions to access this provider
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Provider not found
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

      const providerId = req.params.id;

      // Get provider with role-based access control
      const provider = await providerService.getProviderById(
        providerId,
        req.user.role,
        req.user.providerId
      );

      if (!provider) {
        res.status(404).json({
          error: {
            code: 'PROVIDER_NOT_FOUND',
            message: 'Provider not found',
            timestamp: new Date().toISOString(),
            path: req.path
          }
        });
        return;
      }

      res.status(200).json({
        message: 'Provider retrieved successfully',
        data: {
          provider
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to retrieve provider';
      
      let statusCode = 500;
      let errorCode = 'INTERNAL_SERVER_ERROR';
      
      if (errorMessage.includes('Insufficient permissions')) {
        statusCode = 403;
        errorCode = 'INSUFFICIENT_PERMISSIONS';
      } else if (errorMessage.includes('Invalid provider ID')) {
        statusCode = 400;
        errorCode = 'INVALID_PROVIDER_ID';
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
 * @swagger
 * /api/providers/{id}:
 *   put:
 *     tags:
 *       - Providers
 *     summary: Update provider
 *     description: Update a provider's information. SystemAdmins can update any provider, while ProviderAdmins can only update their own provider.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Provider ID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               companyName:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 200
 *                 description: Company name
 *                 example: "Adventure Tours Inc."
 *               country:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *                 description: Company country
 *                 example: "United States"
 *               addressLine1:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 200
 *                 description: Primary address line
 *                 example: "123 Main Street"
 *               addressLine2:
 *                 type: string
 *                 maxLength: 200
 *                 description: Secondary address line (optional)
 *                 example: "Suite 456"
 *               city:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *                 description: City
 *                 example: "New York"
 *               stateRegion:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *                 description: State or region
 *                 example: "NY"
 *               companyDescription:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 1000
 *                 description: Company description
 *                 example: "Leading provider of adventure tours and travel experiences"
 *               phoneNumber:
 *                 type: string
 *                 pattern: '^\+?[\d\s\-\(\)]+$'
 *                 minLength: 10
 *                 maxLength: 20
 *                 description: Company phone number
 *                 example: "+1-555-123-4567"
 *               emailAddress:
 *                 type: string
 *                 format: email
 *                 description: Company email address
 *                 example: "contact@adventuretours.com"
 *               isIsolatedInstance:
 *                 type: boolean
 *                 description: Whether this provider has data isolation
 *     responses:
 *       200:
 *         description: Provider updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Provider updated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     provider:
 *                       $ref: '#/components/schemas/Provider'
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
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Insufficient permissions to update this provider
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Provider not found
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
      const { error, value } = updateProviderSchema.validate(req.body);
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

      const providerId = req.params.id;
      const updateProviderInput: UpdateProviderInput = value;

      // Update provider with role-based access control
      const updatedProvider = await providerService.updateProvider(
        providerId,
        updateProviderInput,
        req.user.role,
        req.user.providerId
      );

      res.status(200).json({
        message: 'Provider updated successfully',
        data: {
          provider: updatedProvider
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Provider update failed';
      
      let statusCode = 500;
      let errorCode = 'INTERNAL_SERVER_ERROR';
      
      if (errorMessage.includes('Provider not found')) {
        statusCode = 404;
        errorCode = 'PROVIDER_NOT_FOUND';
      } else if (errorMessage.includes('Insufficient permissions')) {
        statusCode = 403;
        errorCode = 'INSUFFICIENT_PERMISSIONS';
      } else if (errorMessage.includes('Validation error')) {
        statusCode = 400;
        errorCode = 'VALIDATION_ERROR';
      } else if (errorMessage.includes('already exists')) {
        statusCode = 409;
        errorCode = 'PROVIDER_ALREADY_EXISTS';
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
 * @swagger
 * /api/providers/{id}/users:
 *   get:
 *     tags:
 *       - Providers
 *     summary: Get provider users
 *     description: Retrieve all users belonging to a specific provider. SystemAdmins can access users from any provider, while ProviderAdmins can only access users from their own provider.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Provider ID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
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
 *       - in: query
 *         name: userType
 *         schema:
 *           type: string
 *           enum: [ProviderAdmin, Tourist]
 *         description: Filter users by type
 *     responses:
 *       200:
 *         description: Provider users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Provider users retrieved successfully"
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
 *       403:
 *         description: Insufficient permissions to access this provider's users
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Provider not found
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
router.get('/:id/users',
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
      const providerId = req.params.id;

      // Get provider users with role-based access control
      const users = await providerService.getProviderUsers(
        providerId,
        req.user.role,
        req.user.providerId,
        limit,
        offset
      );

      res.status(200).json({
        message: 'Provider users retrieved successfully',
        data: {
          users,
          pagination: {
            limit,
            offset,
            total: users.length
          }
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to retrieve provider users';
      
      let statusCode = 500;
      let errorCode = 'INTERNAL_SERVER_ERROR';
      
      if (errorMessage.includes('Provider not found')) {
        statusCode = 404;
        errorCode = 'PROVIDER_NOT_FOUND';
      } else if (errorMessage.includes('Insufficient permissions')) {
        statusCode = 403;
        errorCode = 'INSUFFICIENT_PERMISSIONS';
      } else if (errorMessage.includes('Invalid provider ID')) {
        statusCode = 400;
        errorCode = 'INVALID_PROVIDER_ID';
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
 * @swagger
 * /api/providers/{id}:
 *   delete:
 *     tags:
 *       - Providers
 *     summary: Delete provider
 *     description: Delete a provider and all associated data. Only accessible by System Administrators. This action cannot be undone.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Provider ID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: Provider deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Provider deleted successfully"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Insufficient permissions - SystemAdmin role required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Provider not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Cannot delete provider with active tour events or users
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
router.delete('/:id',
  authMiddleware.authenticate,
  authMiddleware.authorize([UserType.SYSTEM_ADMIN]),
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

      const providerId = req.params.id;

      // First check if provider exists and user has access
      const provider = await providerService.getProviderById(
        providerId,
        req.user.role,
        req.user.providerId
      );

      if (!provider) {
        res.status(404).json({
          error: {
            code: 'PROVIDER_NOT_FOUND',
            message: 'Provider not found',
            timestamp: new Date().toISOString(),
            path: req.path
          }
        });
        return;
      }

      // Delete provider
      await providerService.deleteProvider(providerId, req.user.role);

      res.status(200).json({
        message: 'Provider deleted successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Provider deletion failed';
      
      let statusCode = 500;
      let errorCode = 'INTERNAL_SERVER_ERROR';
      
      if (errorMessage.includes('Provider not found')) {
        statusCode = 404;
        errorCode = 'PROVIDER_NOT_FOUND';
      } else if (errorMessage.includes('Insufficient permissions')) {
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