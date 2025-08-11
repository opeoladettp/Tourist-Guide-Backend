import { Router, Request, Response } from 'express';
import { PrismaClient } from '../generated/prisma';
import { ActivityTypeService } from '../services/activity-type';
import { AuthMiddleware } from '../middleware/auth';
import { CreateActivityTypeInput, UpdateActivityTypeInput } from '../types/activity-type';
import { UserType } from '../types/user';
import Joi from 'joi';

const router = Router();

// Initialize services
const prisma = new PrismaClient();
const activityTypeService = new ActivityTypeService(prisma);
const authMiddleware = new AuthMiddleware(prisma);

// Validation schemas
const createActivityTypeSchema = Joi.object({
  typeName: Joi.string().trim().min(1).max(100).required(),
  description: Joi.string().trim().max(500).optional().allow(''),
  isDefault: Joi.boolean().optional().default(true),
  isActive: Joi.boolean().optional().default(true)
});

const updateActivityTypeSchema = Joi.object({
  typeName: Joi.string().trim().min(1).max(100).optional(),
  description: Joi.string().trim().max(500).optional().allow(''),
  isDefault: Joi.boolean().optional(),
  isActive: Joi.boolean().optional()
});

const querySchema = Joi.object({
  activeOnly: Joi.boolean().optional().default(true)
});

/**
 * @swagger
 * /api/activity-types:
 *   get:
 *     tags:
 *       - Activity Types
 *     summary: Get all activity types
 *     description: Retrieve all available activity types for creating tour activities. Accessible by all authenticated users.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           maxLength: 100
 *         description: Filter activity types by category
 *         example: "Religious"
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *         example: true
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Maximum number of activity types to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of activity types to skip for pagination
 *     responses:
 *       200:
 *         description: Activity types retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Activity types retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     activityTypes:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           activityTypeId:
 *                             type: string
 *                             format: uuid
 *                           typeName:
 *                             type: string
 *                           category:
 *                             type: string
 *                           description:
 *                             type: string
 *                           defaultDuration:
 *                             type: string
 *                           isActive:
 *                             type: boolean
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                           updatedAt:
 *                             type: string
 *                             format: date-time
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

      const { activeOnly } = value;

      // Get activity types
      const activityTypes = await activityTypeService.getActivityTypes(
        req.user.sub,
        req.user.role,
        activeOnly
      );

      res.status(200).json({
        message: 'Activity types retrieved successfully',
        data: {
          activityTypes,
          total: activityTypes.length
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to retrieve activity types';
      
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: errorMessage,
          timestamp: new Date().toISOString(),
          path: req.path
        }
      });
    }
  }
);

/**
 * POST /api/activity-types
 * Create new activity type (System Admin only)
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
      const { error, value } = createActivityTypeSchema.validate(req.body);
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

      const createActivityTypeInput: CreateActivityTypeInput = value;

      // Create activity type
      const activityType = await activityTypeService.createActivityType(
        createActivityTypeInput,
        req.user.sub,
        req.user.role
      );

      res.status(201).json({
        message: 'Activity type created successfully',
        data: {
          activityType
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Activity type creation failed';
      
      let statusCode = 500;
      let errorCode = 'INTERNAL_SERVER_ERROR';
      
      if (errorMessage.includes('Validation error')) {
        statusCode = 400;
        errorCode = 'VALIDATION_ERROR';
      } else if (errorMessage.includes('Only System Administrators')) {
        statusCode = 403;
        errorCode = 'INSUFFICIENT_PERMISSIONS';
      } else if (errorMessage.includes('already exists')) {
        statusCode = 409;
        errorCode = 'ACTIVITY_TYPE_EXISTS';
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
 * GET /api/activity-types/statistics
 * Get activity type usage statistics (System Admin only)
 */
router.get('/statistics',
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

      // Get activity type statistics
      const statistics = await activityTypeService.getActivityTypeStatistics(
        req.user.sub,
        req.user.role
      );

      res.status(200).json({
        message: 'Activity type statistics retrieved successfully',
        data: {
          statistics
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to retrieve statistics';
      
      let statusCode = 500;
      let errorCode = 'INTERNAL_SERVER_ERROR';
      
      if (errorMessage.includes('Only System Administrators')) {
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
 * GET /api/activity-types/:id
 * Get activity type by ID
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

      const activityTypeId = req.params.id;

      // Get activity type
      const activityType = await activityTypeService.getActivityTypeById(
        activityTypeId,
        req.user.sub,
        req.user.role
      );

      if (!activityType) {
        res.status(404).json({
          error: {
            code: 'ACTIVITY_TYPE_NOT_FOUND',
            message: 'Activity type not found',
            timestamp: new Date().toISOString(),
            path: req.path
          }
        });
        return;
      }

      res.status(200).json({
        message: 'Activity type retrieved successfully',
        data: {
          activityType
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to retrieve activity type';
      
      let statusCode = 500;
      let errorCode = 'INTERNAL_SERVER_ERROR';
      
      if (errorMessage.includes('Invalid activity type ID')) {
        statusCode = 400;
        errorCode = 'INVALID_ACTIVITY_TYPE_ID';
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
 * PUT /api/activity-types/:id
 * Update activity type (System Admin only)
 */
router.put('/:id',
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
      const { error, value } = updateActivityTypeSchema.validate(req.body);
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

      const activityTypeId = req.params.id;
      const updateActivityTypeInput: UpdateActivityTypeInput = value;

      // Update activity type
      const updatedActivityType = await activityTypeService.updateActivityType(
        activityTypeId,
        updateActivityTypeInput,
        req.user.sub,
        req.user.role
      );

      res.status(200).json({
        message: 'Activity type updated successfully',
        data: {
          activityType: updatedActivityType
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Activity type update failed';
      
      let statusCode = 500;
      let errorCode = 'INTERNAL_SERVER_ERROR';
      
      if (errorMessage.includes('Activity type not found')) {
        statusCode = 404;
        errorCode = 'ACTIVITY_TYPE_NOT_FOUND';
      } else if (errorMessage.includes('Only System Administrators')) {
        statusCode = 403;
        errorCode = 'INSUFFICIENT_PERMISSIONS';
      } else if (errorMessage.includes('Validation error')) {
        statusCode = 400;
        errorCode = 'VALIDATION_ERROR';
      } else if (errorMessage.includes('already exists')) {
        statusCode = 409;
        errorCode = 'ACTIVITY_TYPE_EXISTS';
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
 * DELETE /api/activity-types/:id
 * Delete activity type (System Admin only)
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

      const activityTypeId = req.params.id;

      // Delete activity type
      await activityTypeService.deleteActivityType(
        activityTypeId,
        req.user.sub,
        req.user.role
      );

      res.status(200).json({
        message: 'Activity type deleted successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Activity type deletion failed';
      
      let statusCode = 500;
      let errorCode = 'INTERNAL_SERVER_ERROR';
      
      if (errorMessage.includes('Activity type not found')) {
        statusCode = 404;
        errorCode = 'ACTIVITY_TYPE_NOT_FOUND';
      } else if (errorMessage.includes('Only System Administrators')) {
        statusCode = 403;
        errorCode = 'INSUFFICIENT_PERMISSIONS';
      } else if (errorMessage.includes('Cannot delete activity type that is being used')) {
        statusCode = 422;
        errorCode = 'ACTIVITY_TYPE_IN_USE';
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