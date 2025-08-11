import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import tourTemplateRoutes from '../../routes/tour-templates';
import { TourTemplateService } from '../../services/tour-template';
import { AuthMiddleware } from '../../middleware/auth';
import { UserType } from '../../types/user';
import { SiteCategory } from '../../types/tour-template';

// Mock dependencies
vi.mock('../../generated/prisma', () => ({
  PrismaClient: vi.fn(() => ({}))
}));

vi.mock('../../services/tour-template', () => ({
  TourTemplateService: vi.fn()
}));

vi.mock('../../middleware/auth', () => ({
  AuthMiddleware: vi.fn()
}));

describe('Tour Template Routes Unit Tests', () => {
  let app: express.Application;
  let mockTourTemplateService: any;
  let mockAuthMiddleware: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create Express app with routes
    app = express();
    app.use(express.json());
    app.use('/api/tour-templates', tourTemplateRoutes);

    // Mock TourTemplateService
    mockTourTemplateService = {
      getTourTemplates: vi.fn(),
      createTourTemplate: vi.fn(),
      getTourTemplateById: vi.fn(),
      updateTourTemplate: vi.fn(),
      deleteTourTemplate: vi.fn()
    };
    vi.mocked(TourTemplateService).mockImplementation(() => mockTourTemplateService);

    // Mock AuthMiddleware
    mockAuthMiddleware = {
      authenticate: vi.fn((req, res, next) => {
        req.user = {
          sub: 'user-id',
          email: 'test@example.com',
          role: UserType.SYSTEM_ADMIN
        };
        next();
      }),
      authorize: vi.fn(() => (req: any, res: any, next: any) => next())
    };
    vi.mocked(AuthMiddleware).mockImplementation(() => mockAuthMiddleware);
  });

  describe('GET /api/tour-templates', () => {
    it('should return tour templates successfully', async () => {
      const mockTemplates = [
        {
          templateId: 'template-1',
          templateName: 'Test Template',
          type: 'Cultural',
          year: 2024,
          startDate: new Date('2024-06-01'),
          endDate: new Date('2024-06-15'),
          detailedDescription: 'Test description',
          createdAt: new Date(),
          updatedAt: new Date(),
          sitesToVisit: []
        }
      ];

      mockTourTemplateService.getTourTemplates.mockResolvedValue(mockTemplates);

      const response = await request(app)
        .get('/api/tour-templates')
        .expect(200);

      expect(response.body.message).toBe('Tour templates retrieved successfully');
      expect(response.body.data.tourTemplates).toEqual(mockTemplates);
      expect(mockTourTemplateService.getTourTemplates).toHaveBeenCalledWith(
        undefined, // year
        undefined, // type
        50, // limit
        0 // offset
      );
    });

    it('should handle query parameters', async () => {
      mockTourTemplateService.getTourTemplates.mockResolvedValue([]);

      await request(app)
        .get('/api/tour-templates?year=2024&type=Cultural&limit=10&offset=5')
        .expect(200);

      expect(mockTourTemplateService.getTourTemplates).toHaveBeenCalledWith(
        2024,
        'Cultural',
        10,
        5
      );
    });

    it('should validate query parameters', async () => {
      const response = await request(app)
        .get('/api/tour-templates?year=invalid')
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle service errors', async () => {
      mockTourTemplateService.getTourTemplates.mockRejectedValue(new Error('Service error'));

      const response = await request(app)
        .get('/api/tour-templates')
        .expect(500);

      expect(response.body.error.code).toBe('INTERNAL_SERVER_ERROR');
    });
  });

  describe('POST /api/tour-templates', () => {
    const validTemplate = {
      templateName: 'New Template',
      type: 'Cultural',
      year: 2024,
      startDate: '2024-06-01T00:00:00.000Z',
      endDate: '2024-06-15T00:00:00.000Z',
      detailedDescription: 'Test description',
      sitesToVisit: [
        {
          siteName: 'Test Site',
          location: 'Test Location',
          visitDuration: '2 hours',
          category: SiteCategory.CULTURAL,
          orderIndex: 1
        }
      ]
    };

    it('should create tour template successfully', async () => {
      const mockCreatedTemplate = {
        templateId: 'new-template-id',
        ...validTemplate,
        startDate: new Date(validTemplate.startDate),
        endDate: new Date(validTemplate.endDate),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockTourTemplateService.createTourTemplate.mockResolvedValue(mockCreatedTemplate);

      const response = await request(app)
        .post('/api/tour-templates')
        .send(validTemplate)
        .expect(201);

      expect(response.body.message).toBe('Tour template created successfully');
      expect(response.body.data.tourTemplate).toEqual(mockCreatedTemplate);
      expect(mockTourTemplateService.createTourTemplate).toHaveBeenCalledWith(
        validTemplate,
        UserType.SYSTEM_ADMIN
      );
    });

    it('should handle validation errors', async () => {
      mockTourTemplateService.createTourTemplate.mockRejectedValue(
        new Error('Validation error: Template name is required')
      );

      const response = await request(app)
        .post('/api/tour-templates')
        .send({ templateName: '' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle duplicate template errors', async () => {
      mockTourTemplateService.createTourTemplate.mockRejectedValue(
        new Error('Tour template with this name already exists for the specified year')
      );

      const response = await request(app)
        .post('/api/tour-templates')
        .send(validTemplate)
        .expect(409);

      expect(response.body.error.code).toBe('TEMPLATE_ALREADY_EXISTS');
    });

    it('should handle permission errors', async () => {
      mockTourTemplateService.createTourTemplate.mockRejectedValue(
        new Error('Insufficient permissions to create tour templates')
      );

      const response = await request(app)
        .post('/api/tour-templates')
        .send(validTemplate)
        .expect(403);

      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });
  });

  describe('GET /api/tour-templates/:id', () => {
    it('should return tour template by ID', async () => {
      const mockTemplate = {
        templateId: 'template-1',
        templateName: 'Test Template',
        type: 'Cultural',
        year: 2024,
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-06-15'),
        detailedDescription: 'Test description',
        createdAt: new Date(),
        updatedAt: new Date(),
        sitesToVisit: []
      };

      mockTourTemplateService.getTourTemplateById.mockResolvedValue(mockTemplate);

      const response = await request(app)
        .get('/api/tour-templates/template-1')
        .expect(200);

      expect(response.body.message).toBe('Tour template retrieved successfully');
      expect(response.body.data.tourTemplate).toEqual(mockTemplate);
      expect(mockTourTemplateService.getTourTemplateById).toHaveBeenCalledWith('template-1');
    });

    it('should return 404 for non-existent template', async () => {
      mockTourTemplateService.getTourTemplateById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/tour-templates/non-existent')
        .expect(404);

      expect(response.body.error.code).toBe('TEMPLATE_NOT_FOUND');
    });

    it('should handle invalid template ID', async () => {
      mockTourTemplateService.getTourTemplateById.mockRejectedValue(
        new Error('Invalid template ID: Template ID is required')
      );

      const response = await request(app)
        .get('/api/tour-templates/invalid-id')
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_TEMPLATE_ID');
    });
  });

  describe('PUT /api/tour-templates/:id', () => {
    const updateData = {
      templateName: 'Updated Template',
      detailedDescription: 'Updated description'
    };

    it('should update tour template successfully', async () => {
      const mockUpdatedTemplate = {
        templateId: 'template-1',
        templateName: 'Updated Template',
        type: 'Cultural',
        year: 2024,
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-06-15'),
        detailedDescription: 'Updated description',
        createdAt: new Date(),
        updatedAt: new Date(),
        sitesToVisit: []
      };

      mockTourTemplateService.updateTourTemplate.mockResolvedValue(mockUpdatedTemplate);

      const response = await request(app)
        .put('/api/tour-templates/template-1')
        .send(updateData)
        .expect(200);

      expect(response.body.message).toBe('Tour template updated successfully');
      expect(response.body.data.tourTemplate).toEqual(mockUpdatedTemplate);
      expect(mockTourTemplateService.updateTourTemplate).toHaveBeenCalledWith(
        'template-1',
        updateData,
        UserType.SYSTEM_ADMIN
      );
    });

    it('should handle template not found', async () => {
      mockTourTemplateService.updateTourTemplate.mockRejectedValue(
        new Error('Tour template not found')
      );

      const response = await request(app)
        .put('/api/tour-templates/non-existent')
        .send(updateData)
        .expect(404);

      expect(response.body.error.code).toBe('TEMPLATE_NOT_FOUND');
    });

    it('should handle validation errors', async () => {
      mockTourTemplateService.updateTourTemplate.mockRejectedValue(
        new Error('Validation error: Template name cannot be empty')
      );

      const response = await request(app)
        .put('/api/tour-templates/template-1')
        .send({ templateName: '' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle duplicate template errors', async () => {
      mockTourTemplateService.updateTourTemplate.mockRejectedValue(
        new Error('Tour template with this name already exists for the specified year')
      );

      const response = await request(app)
        .put('/api/tour-templates/template-1')
        .send(updateData)
        .expect(409);

      expect(response.body.error.code).toBe('TEMPLATE_ALREADY_EXISTS');
    });
  });

  describe('DELETE /api/tour-templates/:id', () => {
    it('should delete tour template successfully', async () => {
      mockTourTemplateService.deleteTourTemplate.mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/api/tour-templates/template-1')
        .expect(200);

      expect(response.body.message).toBe('Tour template deleted successfully');
      expect(mockTourTemplateService.deleteTourTemplate).toHaveBeenCalledWith(
        'template-1',
        UserType.SYSTEM_ADMIN
      );
    });

    it('should handle template not found', async () => {
      mockTourTemplateService.deleteTourTemplate.mockRejectedValue(
        new Error('Tour template not found')
      );

      const response = await request(app)
        .delete('/api/tour-templates/non-existent')
        .expect(404);

      expect(response.body.error.code).toBe('TEMPLATE_NOT_FOUND');
    });

    it('should handle template in use', async () => {
      mockTourTemplateService.deleteTourTemplate.mockRejectedValue(
        new Error('Cannot delete tour template that is being used by tour events')
      );

      const response = await request(app)
        .delete('/api/tour-templates/template-1')
        .expect(409);

      expect(response.body.error.code).toBe('TEMPLATE_IN_USE');
    });

    it('should handle permission errors', async () => {
      mockTourTemplateService.deleteTourTemplate.mockRejectedValue(
        new Error('Insufficient permissions to delete tour templates')
      );

      const response = await request(app)
        .delete('/api/tour-templates/template-1')
        .expect(403);

      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });
  });

  describe('Authentication and Authorization', () => {
    it('should require authentication for all endpoints', async () => {
      // Mock authentication to fail
      mockAuthMiddleware.authenticate = vi.fn((req, res, next) => {
        res.status(401).json({
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Authentication required',
            timestamp: new Date().toISOString(),
            path: req.path
          }
        });
      });

      // Test all endpoints require authentication
      await request(app).get('/api/tour-templates').expect(401);
      await request(app).post('/api/tour-templates').expect(401);
      await request(app).get('/api/tour-templates/test-id').expect(401);
      await request(app).put('/api/tour-templates/test-id').expect(401);
      await request(app).delete('/api/tour-templates/test-id').expect(401);
    });

    it('should require system admin role for create, update, and delete', async () => {
      // Mock authorization to fail for non-admin users
      mockAuthMiddleware.authorize = vi.fn(() => (req: any, res: any, next: any) => {
        res.status(403).json({
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Insufficient permissions',
            timestamp: new Date().toISOString(),
            path: req.path
          }
        });
      });

      await request(app).post('/api/tour-templates').send({}).expect(403);
      await request(app).put('/api/tour-templates/test-id').send({}).expect(403);
      await request(app).delete('/api/tour-templates/test-id').expect(403);
    });
  });
});