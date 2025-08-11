import { Router, Request, Response } from 'express';
import { PrismaClient } from '../generated/prisma';
import { TourTemplateService } from '../services/tour-template';
import { TourTemplateUtilitiesService } from '../services/tour-template-utilities';
import { AuthMiddleware } from '../middleware/auth';
import { CreateTourTemplateInput, UpdateTourTemplateInput } from '../types/tour-template';
import { UserType } from '../types/user';
import Joi from 'joi';

const router = Router();

// Initialize services
const prisma = new PrismaClient();
const tourTemplateService = new TourTemplateService(prisma);
const tourTemplateUtilitiesService = new TourTemplateUtilitiesService(prisma);
const authMiddleware = new AuthMiddleware(prisma);

// Query validation schema
const querySchema = Joi.object({
  year: Joi.number().integer().min(2020).max(2100).optional(),
  type: Joi.string().trim().max(100).optional(),
  limit: Joi.number().integer().min(1).max(100).default(50),
  offset: Joi.number().integer().min(0).default(0)
});

/**
 * @swagger
 * /api/tour-templates:
 *   get:
 *     tags:
 *       - Tour Templates
 *     summary: Get all tour templates
 *     description: Retrieve a list of all tour templates. Accessible by all authenticated users.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *           minimum: 2020
 *           maximum: 2100
 *         description: Filter templates by year
 *         example: 2024
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           maxLength: 100
 *         description: Filter templates by type
 *         example: "Pilgrimage"
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Maximum number of templates to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of templates to skip for pagination
 *     responses:
 *       200:
 *         description: Tour templates retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Tour templates retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     templates:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/TourTemplate'
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

      const { year, type, limit, offset } = value;

      // Get tour templates
      const tourTemplates = await tourTemplateService.getTourTemplates(
        year,
        type,
        limit,
        offset
      );

      res.status(200).json({
        message: 'Tour templates retrieved successfully',
        data: {
          tourTemplates,
          pagination: {
            limit,
            offset,
            total: tourTemplates.length
          }
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to retrieve tour templates';
      
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
 * @swagger
 * /api/tour-templates:
 *   post:
 *     tags:
 *       - Tour Templates
 *     summary: Create a new tour template
 *     description: Create a new tour template with sites to visit. Only accessible by System Administrators.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - templateName
 *               - type
 *               - year
 *               - startDate
 *               - endDate
 *               - detailedDescription
 *             properties:
 *               templateName:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 200
 *                 description: Template name
 *                 example: "Hajj Pilgrimage 2024"
 *               type:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *                 description: Tour type
 *                 example: "Pilgrimage"
 *               year:
 *                 type: integer
 *                 minimum: 2020
 *                 maximum: 2100
 *                 description: Tour year
 *                 example: 2024
 *               startDate:
 *                 type: string
 *                 format: date
 *                 description: Tour start date
 *                 example: "2024-06-15"
 *               endDate:
 *                 type: string
 *                 format: date
 *                 description: Tour end date
 *                 example: "2024-06-25"
 *               detailedDescription:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 2000
 *                 description: Detailed tour description
 *                 example: "Complete Hajj pilgrimage package including all major rituals and sites"
 *               sitesToVisit:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - siteName
 *                     - visitDate
 *                   properties:
 *                     siteName:
 *                       type: string
 *                       minLength: 1
 *                       maxLength: 200
 *                       description: Name of the site
 *                       example: "Masjid al-Haram"
 *                     siteDescription:
 *                       type: string
 *                       maxLength: 1000
 *                       description: Description of the site
 *                       example: "The holiest mosque in Islam, surrounding the Kaaba"
 *                     visitDate:
 *                       type: string
 *                       format: date
 *                       description: Planned visit date
 *                       example: "2024-06-16"
 *                     duration:
 *                       type: string
 *                       maxLength: 100
 *                       description: Expected duration of visit
 *                       example: "Full day"
 *                     location:
 *                       type: string
 *                       maxLength: 200
 *                       description: Site location
 *                       example: "Mecca, Saudi Arabia"
 *     responses:
 *       201:
 *         description: Tour template created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Tour template created successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     template:
 *                       $ref: '#/components/schemas/TourTemplate'
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
 *         description: Template with this name and year already exists
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

      // Create tour template
      const tourTemplate = await tourTemplateService.createTourTemplate(
        req.body as CreateTourTemplateInput,
        req.user.role as UserType
      );

      res.status(201).json({
        message: 'Tour template created successfully',
        data: {
          tourTemplate
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Tour template creation failed';
      
      // Determine appropriate status code
      let statusCode = 500;
      let errorCode = 'INTERNAL_SERVER_ERROR';
      
      if (errorMessage.includes('already exists')) {
        statusCode = 409;
        errorCode = 'TEMPLATE_ALREADY_EXISTS';
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
 * GET /api/tour-templates/:id
 * Get tour template by ID (All authenticated users)
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

      const templateId = req.params.id;

      // Get tour template by ID
      const tourTemplate = await tourTemplateService.getTourTemplateById(templateId);

      if (!tourTemplate) {
        res.status(404).json({
          error: {
            code: 'TEMPLATE_NOT_FOUND',
            message: 'Tour template not found',
            timestamp: new Date().toISOString(),
            path: req.path
          }
        });
        return;
      }

      res.status(200).json({
        message: 'Tour template retrieved successfully',
        data: {
          tourTemplate
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to retrieve tour template';
      
      // Determine appropriate status code
      let statusCode = 500;
      let errorCode = 'INTERNAL_SERVER_ERROR';
      
      if (errorMessage.includes('Invalid template ID')) {
        statusCode = 400;
        errorCode = 'INVALID_TEMPLATE_ID';
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
 * PUT /api/tour-templates/:id
 * Update tour template (SysAd only)
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

      const templateId = req.params.id;

      // Update tour template
      const updatedTourTemplate = await tourTemplateService.updateTourTemplate(
        templateId,
        req.body as UpdateTourTemplateInput,
        req.user.role as UserType
      );

      res.status(200).json({
        message: 'Tour template updated successfully',
        data: {
          tourTemplate: updatedTourTemplate
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Tour template update failed';
      
      // Determine appropriate status code
      let statusCode = 500;
      let errorCode = 'INTERNAL_SERVER_ERROR';
      
      if (errorMessage.includes('Tour template not found')) {
        statusCode = 404;
        errorCode = 'TEMPLATE_NOT_FOUND';
      } else if (errorMessage.includes('already exists')) {
        statusCode = 409;
        errorCode = 'TEMPLATE_ALREADY_EXISTS';
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
 * DELETE /api/tour-templates/:id
 * Delete tour template (SysAd only)
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

      const templateId = req.params.id;

      // Delete tour template
      await tourTemplateService.deleteTourTemplate(
        templateId,
        req.user.role as UserType
      );

      res.status(200).json({
        message: 'Tour template deleted successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Tour template deletion failed';
      
      // Determine appropriate status code
      let statusCode = 500;
      let errorCode = 'INTERNAL_SERVER_ERROR';
      
      if (errorMessage.includes('Tour template not found')) {
        statusCode = 404;
        errorCode = 'TEMPLATE_NOT_FOUND';
      } else if (errorMessage.includes('Cannot delete tour template')) {
        statusCode = 409;
        errorCode = 'TEMPLATE_IN_USE';
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
 * GET /api/tour-templates/:id/sites
 * Get sites for a specific template (All authenticated users)
 */
router.get('/:id/sites',
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

      const templateId = req.params.id;

      // Get template sites
      const sites = await tourTemplateService.getTemplateSites(templateId);

      res.status(200).json({
        message: 'Template sites retrieved successfully',
        data: {
          sites
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to retrieve template sites';
      
      // Determine appropriate status code
      let statusCode = 500;
      let errorCode = 'INTERNAL_SERVER_ERROR';
      
      if (errorMessage.includes('Tour template not found')) {
        statusCode = 404;
        errorCode = 'TEMPLATE_NOT_FOUND';
      } else if (errorMessage.includes('Invalid template ID')) {
        statusCode = 400;
        errorCode = 'INVALID_TEMPLATE_ID';
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
 * POST /api/tour-templates/:id/sites
 * Add site to tour template (SysAd only)
 */
router.post('/:id/sites',
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

      const templateId = req.params.id;

      // Add site to template
      const site = await tourTemplateService.addSiteToTemplate(
        templateId,
        req.body,
        req.user.role as UserType
      );

      res.status(201).json({
        message: 'Site added to template successfully',
        data: {
          site
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add site to template';
      
      // Determine appropriate status code
      let statusCode = 500;
      let errorCode = 'INTERNAL_SERVER_ERROR';
      
      if (errorMessage.includes('Tour template not found')) {
        statusCode = 404;
        errorCode = 'TEMPLATE_NOT_FOUND';
      } else if (errorMessage.includes('Validation error')) {
        statusCode = 400;
        errorCode = 'VALIDATION_ERROR';
      } else if (errorMessage.includes('already exists')) {
        statusCode = 409;
        errorCode = 'SITE_ORDER_CONFLICT';
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
 * PUT /api/tour-templates/:id/sites/:siteId
 * Update site in tour template (SysAd only)
 */
router.put('/:id/sites/:siteId',
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

      const templateId = req.params.id;
      const siteId = req.params.siteId;

      // Update site in template
      const updatedSite = await tourTemplateService.updateSiteInTemplate(
        templateId,
        siteId,
        req.body,
        req.user.role as UserType
      );

      res.status(200).json({
        message: 'Site updated successfully',
        data: {
          site: updatedSite
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update site';
      
      // Determine appropriate status code
      let statusCode = 500;
      let errorCode = 'INTERNAL_SERVER_ERROR';
      
      if (errorMessage.includes('Tour template not found')) {
        statusCode = 404;
        errorCode = 'TEMPLATE_NOT_FOUND';
      } else if (errorMessage.includes('Site not found')) {
        statusCode = 404;
        errorCode = 'SITE_NOT_FOUND';
      } else if (errorMessage.includes('Validation error')) {
        statusCode = 400;
        errorCode = 'VALIDATION_ERROR';
      } else if (errorMessage.includes('already exists')) {
        statusCode = 409;
        errorCode = 'SITE_ORDER_CONFLICT';
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
 * DELETE /api/tour-templates/:id/sites/:siteId
 * Remove site from tour template (SysAd only)
 */
router.delete('/:id/sites/:siteId',
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

      const templateId = req.params.id;
      const siteId = req.params.siteId;

      // Remove site from template
      await tourTemplateService.removeSiteFromTemplate(
        templateId,
        siteId,
        req.user.role as UserType
      );

      res.status(200).json({
        message: 'Site removed from template successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to remove site from template';
      
      // Determine appropriate status code
      let statusCode = 500;
      let errorCode = 'INTERNAL_SERVER_ERROR';
      
      if (errorMessage.includes('Tour template not found')) {
        statusCode = 404;
        errorCode = 'TEMPLATE_NOT_FOUND';
      } else if (errorMessage.includes('Site not found')) {
        statusCode = 404;
        errorCode = 'SITE_NOT_FOUND';
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
 * PUT /api/tour-templates/:id/sites/reorder
 * Reorder sites in a template (SysAd only)
 */
router.put('/:id/sites/reorder',
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

      const templateId = req.params.id;
      const { siteOrders } = req.body;

      // Validate request body
      if (!Array.isArray(siteOrders)) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'siteOrders must be an array',
            timestamp: new Date().toISOString(),
            path: req.path
          }
        });
        return;
      }

      // Reorder sites
      const reorderedSites = await tourTemplateService.reorderTemplateSites(
        templateId,
        siteOrders,
        req.user.role as UserType
      );

      res.status(200).json({
        message: 'Sites reordered successfully',
        data: {
          sites: reorderedSites
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to reorder sites';
      
      // Determine appropriate status code
      let statusCode = 500;
      let errorCode = 'INTERNAL_SERVER_ERROR';
      
      if (errorMessage.includes('Tour template not found')) {
        statusCode = 404;
        errorCode = 'TEMPLATE_NOT_FOUND';
      } else if (errorMessage.includes('do not belong to this template')) {
        statusCode = 400;
        errorCode = 'INVALID_SITE_IDS';
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
 * GET /api/tour-templates/:id/tour-event-creation
 * Get template with suggested activities for tour event creation (All authenticated users)
 */
router.get('/:id/tour-event-creation',
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

      const templateId = req.params.id;

      // Get template for tour event creation
      const templateData = await tourTemplateUtilitiesService.getTemplateForTourEventCreation(templateId);

      res.status(200).json({
        message: 'Template data for tour event creation retrieved successfully',
        data: templateData,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to retrieve template data';
      
      // Determine appropriate status code
      let statusCode = 500;
      let errorCode = 'INTERNAL_SERVER_ERROR';
      
      if (errorMessage.includes('Tour template not found')) {
        statusCode = 404;
        errorCode = 'TEMPLATE_NOT_FOUND';
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
 * POST /api/tour-templates/:id/validate-compatibility
 * Validate template compatibility for tour event creation (All authenticated users)
 */
router.post('/:id/validate-compatibility',
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

      const templateId = req.params.id;
      const { startDate, endDate } = req.body;

      // Validate request body
      const validationSchema = Joi.object({
        startDate: Joi.date().required().messages({
          'date.base': 'Start date must be a valid date',
          'any.required': 'Start date is required'
        }),
        endDate: Joi.date().greater(Joi.ref('startDate')).required().messages({
          'date.base': 'End date must be a valid date',
          'date.greater': 'End date must be after start date',
          'any.required': 'End date is required'
        })
      });

      const { error, value } = validationSchema.validate({ startDate, endDate });
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

      // Validate template compatibility
      const compatibilityResult = await tourTemplateUtilitiesService.validateTemplateForTourEvent(
        templateId,
        new Date(value.startDate),
        new Date(value.endDate)
      );

      res.status(200).json({
        message: 'Template compatibility validation completed',
        data: compatibilityResult,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to validate template compatibility';
      
      // Determine appropriate status code
      let statusCode = 500;
      let errorCode = 'INTERNAL_SERVER_ERROR';
      
      if (errorMessage.includes('Tour template not found')) {
        statusCode = 404;
        errorCode = 'TEMPLATE_NOT_FOUND';
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
 * POST /api/tour-templates/:id/generate-schedule
 * Generate activity schedule from template sites (All authenticated users)
 */
router.post('/:id/generate-schedule',
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

      const templateId = req.params.id;
      const { startDate, endDate } = req.body;

      // Validate request body
      const validationSchema = Joi.object({
        startDate: Joi.date().required().messages({
          'date.base': 'Start date must be a valid date',
          'any.required': 'Start date is required'
        }),
        endDate: Joi.date().greater(Joi.ref('startDate')).required().messages({
          'date.base': 'End date must be a valid date',
          'date.greater': 'End date must be after start date',
          'any.required': 'End date is required'
        })
      });

      const { error, value } = validationSchema.validate({ startDate, endDate });
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

      // Generate activity schedule
      const schedule = await tourTemplateUtilitiesService.generateActivityScheduleFromTemplate(
        templateId,
        new Date(value.startDate),
        new Date(value.endDate)
      );

      res.status(200).json({
        message: 'Activity schedule generated successfully',
        data: {
          schedule
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate activity schedule';
      
      // Determine appropriate status code
      let statusCode = 500;
      let errorCode = 'INTERNAL_SERVER_ERROR';
      
      if (errorMessage.includes('Tour template not found')) {
        statusCode = 404;
        errorCode = 'TEMPLATE_NOT_FOUND';
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
 * GET /api/tour-templates/:id/cost-estimate
 * Calculate estimated costs from template sites (All authenticated users)
 */
router.get('/:id/cost-estimate',
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

      const templateId = req.params.id;

      // Calculate estimated costs
      const costEstimate = await tourTemplateUtilitiesService.calculateEstimatedCosts(templateId);

      res.status(200).json({
        message: 'Cost estimate calculated successfully',
        data: costEstimate,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to calculate cost estimate';
      
      // Determine appropriate status code
      let statusCode = 500;
      let errorCode = 'INTERNAL_SERVER_ERROR';
      
      if (errorMessage.includes('Tour template not found')) {
        statusCode = 404;
        errorCode = 'TEMPLATE_NOT_FOUND';
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
 * GET /api/tour-templates/:id/statistics
 * Get template statistics for analysis (All authenticated users)
 */
router.get('/:id/statistics',
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

      const templateId = req.params.id;

      // Get template statistics
      const statistics = await tourTemplateUtilitiesService.getTemplateStatistics(templateId);

      res.status(200).json({
        message: 'Template statistics retrieved successfully',
        data: statistics,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to retrieve template statistics';
      
      // Determine appropriate status code
      let statusCode = 500;
      let errorCode = 'INTERNAL_SERVER_ERROR';
      
      if (errorMessage.includes('Tour template not found')) {
        statusCode = 404;
        errorCode = 'TEMPLATE_NOT_FOUND';
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