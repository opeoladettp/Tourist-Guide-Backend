import { Router, Request, Response } from 'express';
import { PrismaClient } from '../generated/prisma';
import { CustomTourEventService } from '../services/custom-tour-event';
import { ActivityService } from '../services/activity';
import { AuthMiddleware } from '../middleware/auth';
import { CreateCustomTourEventInput, UpdateCustomTourEventInput, TourEventStatus, RegistrationStatus } from '../types/custom-tour-event';
import { CreateActivityInput, UpdateActivityInput } from '../types/activity';
import { UserType } from '../types/user';
import Joi from 'joi';

const router = Router();

// Initialize services
const prisma = new PrismaClient();
const customTourEventService = new CustomTourEventService(prisma);
const activityService = new ActivityService(prisma);
const authMiddleware = new AuthMiddleware(prisma);

// Validation schemas
const createTourEventSchema = Joi.object({
  templateId: Joi.string().trim().optional(),
  customTourName: Joi.string().trim().min(1).max(200).required(),
  startDate: Joi.date().min('now').required(),
  endDate: Joi.date().greater(Joi.ref('startDate')).required(),
  packageType: Joi.string().trim().min(1).max(100).required(),
  place1Hotel: Joi.string().trim().min(1).max(200).required(),
  place2Hotel: Joi.string().trim().min(1).max(200).required(),
  numberOfAllowedTourists: Joi.number().integer().min(1).max(1000).required(),
  groupChatInfo: Joi.string().trim().max(500).optional().allow('')
});

const updateTourEventSchema = Joi.object({
  customTourName: Joi.string().trim().min(1).max(200).optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().when('startDate', {
    is: Joi.exist(),
    then: Joi.date().greater(Joi.ref('startDate')),
    otherwise: Joi.date()
  }).optional(),
  packageType: Joi.string().trim().min(1).max(100).optional(),
  place1Hotel: Joi.string().trim().min(1).max(200).optional(),
  place2Hotel: Joi.string().trim().min(1).max(200).optional(),
  numberOfAllowedTourists: Joi.number().integer().min(1).max(1000).optional(),
  groupChatInfo: Joi.string().trim().max(500).optional().allow(''),
  status: Joi.string().valid(...Object.values(TourEventStatus)).optional()
});

const querySchema = Joi.object({
  status: Joi.string().valid(...Object.values(TourEventStatus)).optional(),
  limit: Joi.number().integer().min(1).max(100).default(50),
  offset: Joi.number().integer().min(0).default(0)
});

const registrationQuerySchema = Joi.object({
  status: Joi.string().valid(...Object.values(RegistrationStatus)).optional()
});

const registrationApprovalSchema = Joi.object({
  approved: Joi.boolean().required(),
  rejectedReason: Joi.string().trim().max(500).when('approved', {
    is: false,
    then: Joi.required(),
    otherwise: Joi.optional()
  })
});

const createActivitySchema = Joi.object({
  activityDate: Joi.date().required(),
  startTime: Joi.string().trim().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
  endTime: Joi.string().trim().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
  activityName: Joi.string().trim().min(1).max(200).required(),
  description: Joi.string().trim().max(1000).optional().allow(''),
  location: Joi.string().trim().max(300).optional().allow(''),
  activityType: Joi.string().trim().min(1).max(100).required(),
  isOptional: Joi.boolean().optional().default(false)
});

const updateActivitySchema = Joi.object({
  activityDate: Joi.date().optional(),
  startTime: Joi.string().trim().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  endTime: Joi.string().trim().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  activityName: Joi.string().trim().min(1).max(200).optional(),
  description: Joi.string().trim().max(1000).optional().allow(''),
  location: Joi.string().trim().max(300).optional().allow(''),
  activityType: Joi.string().trim().min(1).max(100).optional(),
  isOptional: Joi.boolean().optional()
});

/**
 * @swagger
 * /api/tour-events:
 *   get:
 *     tags:
 *       - Tour Events
 *     summary: Get tour events
 *     description: Retrieve tour events with role-based filtering. SystemAdmins see all events, ProviderAdmins see their company's events, Tourists see events they can register for or are registered in.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [Draft, Active, Full, Completed, Cancelled]
 *         description: Filter events by status
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter events starting from this date
 *         example: "2024-06-01"
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter events ending before this date
 *         example: "2024-12-31"
 *       - in: query
 *         name: templateId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter events by template ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Maximum number of events to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of events to skip for pagination
 *     responses:
 *       200:
 *         description: Tour events retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Tour events retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     tourEvents:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/CustomTourEvent'
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

      const { status, limit, offset } = value;

      // Get tour events with role-based filtering
      const tourEvents = await customTourEventService.getTourEvents(
        req.user.sub,
        req.user.role,
        req.user.providerId,
        status,
        limit,
        offset
      );

      res.status(200).json({
        message: 'Tour events retrieved successfully',
        data: {
          tourEvents,
          pagination: {
            limit,
            offset,
            total: tourEvents.length
          }
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to retrieve tour events';
      
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
 * /api/tour-events:
 *   post:
 *     tags:
 *       - Tour Events
 *     summary: Create a new tour event
 *     description: Create a new tour event based on a template. Only accessible by Provider Administrators.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateTourEventRequest'
 *     responses:
 *       201:
 *         description: Tour event created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Tour event created successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     tourEvent:
 *                       $ref: '#/components/schemas/CustomTourEvent'
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
 *         description: Insufficient permissions - ProviderAdmin role required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Template not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Tour event with this name already exists for the provider
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
  authMiddleware.authorize([UserType.PROVIDER_ADMIN]),
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

      if (!req.user.providerId) {
        res.status(400).json({
          error: {
            code: 'INVALID_USER_DATA',
            message: 'Provider ID is required for Provider Admin users',
            timestamp: new Date().toISOString(),
            path: req.path
          }
        });
        return;
      }

      // Validate request body
      const { error, value } = createTourEventSchema.validate(req.body);
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

      const createTourEventInput: CreateCustomTourEventInput = value;

      // Create tour event
      const tourEvent = await customTourEventService.createCustomTourEvent(
        createTourEventInput,
        req.user.sub,
        req.user.role,
        req.user.providerId
      );

      res.status(201).json({
        message: 'Tour event created successfully',
        data: {
          tourEvent
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Tour event creation failed';
      
      let statusCode = 500;
      let errorCode = 'INTERNAL_SERVER_ERROR';
      
      if (errorMessage.includes('Validation error')) {
        statusCode = 400;
        errorCode = 'VALIDATION_ERROR';
      } else if (errorMessage.includes('Insufficient permissions')) {
        statusCode = 403;
        errorCode = 'INSUFFICIENT_PERMISSIONS';
      } else if (errorMessage.includes('Tour template not found')) {
        statusCode = 404;
        errorCode = 'TOUR_TEMPLATE_NOT_FOUND';
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
 * GET /api/tour-events/:id
 * Get tour event by ID with access control
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

      const tourEventId = req.params.id;

      // Get tour event with role-based access control
      const tourEvent = await customTourEventService.getTourEventById(
        tourEventId,
        req.user.sub,
        req.user.role,
        req.user.providerId
      );

      if (!tourEvent) {
        res.status(404).json({
          error: {
            code: 'TOUR_EVENT_NOT_FOUND',
            message: 'Tour event not found',
            timestamp: new Date().toISOString(),
            path: req.path
          }
        });
        return;
      }

      res.status(200).json({
        message: 'Tour event retrieved successfully',
        data: {
          tourEvent
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to retrieve tour event';
      
      let statusCode = 500;
      let errorCode = 'INTERNAL_SERVER_ERROR';
      
      if (errorMessage.includes('Insufficient permissions')) {
        statusCode = 403;
        errorCode = 'INSUFFICIENT_PERMISSIONS';
      } else if (errorMessage.includes('Invalid tour event ID')) {
        statusCode = 400;
        errorCode = 'INVALID_TOUR_EVENT_ID';
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
 * PUT /api/tour-events/:id
 * Update tour event with ownership validation
 */
router.put('/:id',
  authMiddleware.authenticate,
  authMiddleware.authorize([UserType.PROVIDER_ADMIN]),
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

      if (!req.user.providerId) {
        res.status(400).json({
          error: {
            code: 'INVALID_USER_DATA',
            message: 'Provider ID is required for Provider Admin users',
            timestamp: new Date().toISOString(),
            path: req.path
          }
        });
        return;
      }

      // Validate request body
      const { error, value } = updateTourEventSchema.validate(req.body);
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

      const tourEventId = req.params.id;
      const updateTourEventInput: UpdateCustomTourEventInput = value;

      // Update tour event with ownership validation
      const updatedTourEvent = await customTourEventService.updateTourEvent(
        tourEventId,
        updateTourEventInput,
        req.user.sub,
        req.user.role,
        req.user.providerId
      );

      res.status(200).json({
        message: 'Tour event updated successfully',
        data: {
          tourEvent: updatedTourEvent
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Tour event update failed';
      
      let statusCode = 500;
      let errorCode = 'INTERNAL_SERVER_ERROR';
      
      if (errorMessage.includes('Tour event not found')) {
        statusCode = 404;
        errorCode = 'TOUR_EVENT_NOT_FOUND';
      } else if (errorMessage.includes('Insufficient permissions')) {
        statusCode = 403;
        errorCode = 'INSUFFICIENT_PERMISSIONS';
      } else if (errorMessage.includes('Validation error')) {
        statusCode = 400;
        errorCode = 'VALIDATION_ERROR';
      } else if (errorMessage.includes('Cannot reduce capacity')) {
        statusCode = 422;
        errorCode = 'CAPACITY_REDUCTION_ERROR';
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
 * DELETE /api/tour-events/:id
 * Delete tour event with ownership validation (Provider Admin only)
 */
router.delete('/:id',
  authMiddleware.authenticate,
  authMiddleware.authorize([UserType.PROVIDER_ADMIN]),
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

      if (!req.user.providerId) {
        res.status(400).json({
          error: {
            code: 'INVALID_USER_DATA',
            message: 'Provider ID is required for Provider Admin users',
            timestamp: new Date().toISOString(),
            path: req.path
          }
        });
        return;
      }

      const tourEventId = req.params.id;

      // First check if tour event exists and user has access
      const tourEvent = await customTourEventService.getTourEventById(
        tourEventId,
        req.user.sub,
        req.user.role,
        req.user.providerId
      );

      if (!tourEvent) {
        res.status(404).json({
          error: {
            code: 'TOUR_EVENT_NOT_FOUND',
            message: 'Tour event not found',
            timestamp: new Date().toISOString(),
            path: req.path
          }
        });
        return;
      }

      // Delete tour event (using Prisma directly since service doesn't have delete method)
      await prisma.customTourEvent.delete({
        where: { tourEventId }
      });

      res.status(200).json({
        message: 'Tour event deleted successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Tour event deletion failed';
      
      let statusCode = 500;
      let errorCode = 'INTERNAL_SERVER_ERROR';
      
      if (errorMessage.includes('Tour event not found')) {
        statusCode = 404;
        errorCode = 'TOUR_EVENT_NOT_FOUND';
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
 * POST /api/tour-events/:id/register
 * Register tourist for tour event
 */
router.post('/:id/register',
  authMiddleware.authenticate,
  authMiddleware.authorize([UserType.TOURIST]),
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

      const tourEventId = req.params.id;

      // Register tourist for tour event
      const registration = await customTourEventService.registerTourist(
        { tourEventId },
        req.user.sub,
        req.user.role,
        req.user.providerId
      );

      res.status(201).json({
        message: 'Registration submitted successfully',
        data: {
          registration
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Registration failed';
      
      let statusCode = 500;
      let errorCode = 'INTERNAL_SERVER_ERROR';
      
      if (errorMessage.includes('Tour event not found')) {
        statusCode = 404;
        errorCode = 'TOUR_EVENT_NOT_FOUND';
      } else if (errorMessage.includes('not available for registration')) {
        statusCode = 422;
        errorCode = 'TOUR_EVENT_NOT_AVAILABLE';
      } else if (errorMessage.includes('already registered')) {
        statusCode = 409;
        errorCode = 'ALREADY_REGISTERED';
      } else if (errorMessage.includes('overlapping time period')) {
        statusCode = 409;
        errorCode = 'OVERLAPPING_REGISTRATION';
      } else if (errorMessage.includes('Tour event is full')) {
        statusCode = 422;
        errorCode = 'TOUR_EVENT_FULL';
      } else if (errorMessage.includes('Only tourists can register')) {
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
 * GET /api/tour-events/:id/registrations
 * Get registrations for tour event (Provider Admin only)
 */
router.get('/:id/registrations',
  authMiddleware.authenticate,
  authMiddleware.authorize([UserType.PROVIDER_ADMIN]),
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

      if (!req.user.providerId) {
        res.status(400).json({
          error: {
            code: 'INVALID_USER_DATA',
            message: 'Provider ID is required for Provider Admin users',
            timestamp: new Date().toISOString(),
            path: req.path
          }
        });
        return;
      }

      // Validate query parameters
      const { error, value } = registrationQuerySchema.validate(req.query);
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

      const tourEventId = req.params.id;
      const { status } = value;

      // Get registrations for tour event
      const registrations = await customTourEventService.getTourEventRegistrations(
        tourEventId,
        req.user.sub,
        req.user.role,
        req.user.providerId,
        status
      );

      res.status(200).json({
        message: 'Registrations retrieved successfully',
        data: {
          registrations,
          total: registrations.length
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to retrieve registrations';
      
      let statusCode = 500;
      let errorCode = 'INTERNAL_SERVER_ERROR';
      
      if (errorMessage.includes('Tour event not found')) {
        statusCode = 404;
        errorCode = 'TOUR_EVENT_NOT_FOUND';
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
 * PUT /api/tour-events/:id/registrations/:userId
 * Approve or reject tourist registration (Provider Admin only)
 */
router.put('/:id/registrations/:userId',
  authMiddleware.authenticate,
  authMiddleware.authorize([UserType.PROVIDER_ADMIN]),
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

      if (!req.user.providerId) {
        res.status(400).json({
          error: {
            code: 'INVALID_USER_DATA',
            message: 'Provider ID is required for Provider Admin users',
            timestamp: new Date().toISOString(),
            path: req.path
          }
        });
        return;
      }

      // Validate request body
      const { error, value } = registrationApprovalSchema.validate(req.body);
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

      const tourEventId = req.params.id;
      const userId = req.params.userId;

      // Find the registration by tour event and user
      const registration = await prisma.touristRegistration.findUnique({
        where: {
          tourEventId_touristUserId: {
            tourEventId,
            touristUserId: userId
          }
        }
      });

      if (!registration) {
        res.status(404).json({
          error: {
            code: 'REGISTRATION_NOT_FOUND',
            message: 'Registration not found',
            timestamp: new Date().toISOString(),
            path: req.path
          }
        });
        return;
      }

      // Process registration approval/rejection
      const updatedRegistration = await customTourEventService.processRegistration(
        {
          registrationId: registration.registrationId,
          approved: value.approved,
          rejectedReason: value.rejectedReason
        },
        req.user.sub,
        req.user.role,
        req.user.providerId
      );

      res.status(200).json({
        message: `Registration ${value.approved ? 'approved' : 'rejected'} successfully`,
        data: {
          registration: updatedRegistration
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to process registration';
      
      let statusCode = 500;
      let errorCode = 'INTERNAL_SERVER_ERROR';
      
      if (errorMessage.includes('Registration not found')) {
        statusCode = 404;
        errorCode = 'REGISTRATION_NOT_FOUND';
      } else if (errorMessage.includes('Insufficient permissions')) {
        statusCode = 403;
        errorCode = 'INSUFFICIENT_PERMISSIONS';
      } else if (errorMessage.includes('already been processed')) {
        statusCode = 422;
        errorCode = 'REGISTRATION_ALREADY_PROCESSED';
      } else if (errorMessage.includes('Tour event is full')) {
        statusCode = 422;
        errorCode = 'TOUR_EVENT_FULL';
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
 * GET /api/tour-events/:id/capacity
 * Get capacity information for tour event
 */
router.get('/:id/capacity',
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

      const tourEventId = req.params.id;

      // Get capacity information
      const capacityInfo = await customTourEventService.getCapacityInfo(
        tourEventId,
        req.user.sub,
        req.user.role,
        req.user.providerId
      );

      res.status(200).json({
        message: 'Capacity information retrieved successfully',
        data: {
          capacity: capacityInfo
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to retrieve capacity information';
      
      let statusCode = 500;
      let errorCode = 'INTERNAL_SERVER_ERROR';
      
      if (errorMessage.includes('Tour event not found') || errorMessage.includes('access denied')) {
        statusCode = 404;
        errorCode = 'TOUR_EVENT_NOT_FOUND';
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
 * GET /api/tour-events/:id/schedule
 * Get daily schedule for tour event
 */
router.get('/:id/schedule',
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

      const tourEventId = req.params.id;
      const { date, includeIslamic } = req.query;

      // If specific date is provided, get daily schedule for that date
      if (date) {
        const scheduleDate = new Date(date as string);
        if (isNaN(scheduleDate.getTime())) {
          res.status(400).json({
            error: {
              code: 'INVALID_DATE',
              message: 'Invalid date format',
              timestamp: new Date().toISOString(),
              path: req.path
            }
          });
          return;
        }

        const dailySchedule = await activityService.getDailySchedule(
          tourEventId,
          scheduleDate,
          req.user.sub,
          req.user.role,
          req.user.providerId,
          includeIslamic === 'true'
        );

        res.status(200).json({
          message: 'Daily schedule retrieved successfully',
          data: {
            schedule: dailySchedule
          },
          timestamp: new Date().toISOString()
        });
      } else {
        // Get all activities for the tour event
        const activities = await activityService.getTourEventActivities(
          tourEventId,
          req.user.sub,
          req.user.role,
          req.user.providerId
        );

        res.status(200).json({
          message: 'Tour event schedule retrieved successfully',
          data: {
            activities
          },
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to retrieve schedule';
      
      let statusCode = 500;
      let errorCode = 'INTERNAL_SERVER_ERROR';
      
      if (errorMessage.includes('Tour event not found')) {
        statusCode = 404;
        errorCode = 'TOUR_EVENT_NOT_FOUND';
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
 * POST /api/tour-events/:id/activities
 * Create new activity for tour event
 */
router.post('/:id/activities',
  authMiddleware.authenticate,
  authMiddleware.authorize([UserType.PROVIDER_ADMIN, UserType.SYSTEM_ADMIN]),
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
      const { error, value } = createActivitySchema.validate(req.body);
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

      const tourEventId = req.params.id;
      const createActivityInput: CreateActivityInput = {
        ...value,
        tourEventId
      };

      // Create activity
      const activity = await activityService.createActivity(
        createActivityInput,
        req.user.sub,
        req.user.role,
        req.user.providerId
      );

      res.status(201).json({
        message: 'Activity created successfully',
        data: {
          activity
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Activity creation failed';
      
      let statusCode = 500;
      let errorCode = 'INTERNAL_SERVER_ERROR';
      
      if (errorMessage.includes('Validation error')) {
        statusCode = 400;
        errorCode = 'VALIDATION_ERROR';
      } else if (errorMessage.includes('Tour event not found')) {
        statusCode = 404;
        errorCode = 'TOUR_EVENT_NOT_FOUND';
      } else if (errorMessage.includes('Insufficient permissions')) {
        statusCode = 403;
        errorCode = 'INSUFFICIENT_PERMISSIONS';
      } else if (errorMessage.includes('conflicts with existing activity')) {
        statusCode = 409;
        errorCode = 'ACTIVITY_CONFLICT';
      } else if (errorMessage.includes('must be within tour event date range')) {
        statusCode = 422;
        errorCode = 'INVALID_ACTIVITY_DATE';
      } else if (errorMessage.includes('Start time must be before end time')) {
        statusCode = 422;
        errorCode = 'INVALID_TIME_ORDER';
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
 * PUT /api/tour-events/:id/activities/:activityId
 * Update activity for tour event
 */
router.put('/:id/activities/:activityId',
  authMiddleware.authenticate,
  authMiddleware.authorize([UserType.PROVIDER_ADMIN, UserType.SYSTEM_ADMIN]),
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
      const { error, value } = updateActivitySchema.validate(req.body);
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

      const activityId = req.params.activityId;
      const updateActivityInput: UpdateActivityInput = value;

      // Update activity
      const updatedActivity = await activityService.updateActivity(
        activityId,
        updateActivityInput,
        req.user.sub,
        req.user.role,
        req.user.providerId
      );

      res.status(200).json({
        message: 'Activity updated successfully',
        data: {
          activity: updatedActivity
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Activity update failed';
      
      let statusCode = 500;
      let errorCode = 'INTERNAL_SERVER_ERROR';
      
      if (errorMessage.includes('Activity not found')) {
        statusCode = 404;
        errorCode = 'ACTIVITY_NOT_FOUND';
      } else if (errorMessage.includes('Insufficient permissions')) {
        statusCode = 403;
        errorCode = 'INSUFFICIENT_PERMISSIONS';
      } else if (errorMessage.includes('Validation error')) {
        statusCode = 400;
        errorCode = 'VALIDATION_ERROR';
      } else if (errorMessage.includes('conflicts with existing activity')) {
        statusCode = 409;
        errorCode = 'ACTIVITY_CONFLICT';
      } else if (errorMessage.includes('must be within tour event date range')) {
        statusCode = 422;
        errorCode = 'INVALID_ACTIVITY_DATE';
      } else if (errorMessage.includes('Start time must be before end time')) {
        statusCode = 422;
        errorCode = 'INVALID_TIME_ORDER';
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
 * DELETE /api/tour-events/:id/activities/:activityId
 * Delete activity from tour event
 */
router.delete('/:id/activities/:activityId',
  authMiddleware.authenticate,
  authMiddleware.authorize([UserType.PROVIDER_ADMIN, UserType.SYSTEM_ADMIN]),
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

      const activityId = req.params.activityId;

      // Delete activity
      await activityService.deleteActivity(
        activityId,
        req.user.sub,
        req.user.role,
        req.user.providerId
      );

      res.status(200).json({
        message: 'Activity deleted successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Activity deletion failed';
      
      let statusCode = 500;
      let errorCode = 'INTERNAL_SERVER_ERROR';
      
      if (errorMessage.includes('Activity not found')) {
        statusCode = 404;
        errorCode = 'ACTIVITY_NOT_FOUND';
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