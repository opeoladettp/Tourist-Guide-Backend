import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import app from '../../app';
import { setupTestDatabase, cleanupTestDatabase } from '../../utils/test-db-setup';
import { PrismaClient } from '../../generated/prisma';
import { UserService } from '../../services/user';
import { AuthService } from '../../services/auth';
import { UserType } from '../../types/user';
import { SiteCategory } from '../../types/tour-template';

describe('Tour Template Routes Integration Tests', () => {
  let prisma: PrismaClient;
  let userService: UserService;
  let authService: AuthService;
  let systemAdminToken: string;
  let providerAdminToken: string;
  let touristToken: string;
  let systemAdminId: string;
  let providerAdminId: string;
  let touristId: string;
  let providerId: string;

  beforeAll(async () => {
    prisma = await setupTestDatabase();
    userService = new UserService(prisma);
    authService = new AuthService(prisma);

    // Create test provider
    const provider = await prisma.provider.create({
      data: {
        companyName: 'Test Provider Company',
        country: 'Test Country',
        addressLine1: '123 Test Street',
        city: 'Test City',
        stateRegion: 'Test State',
        companyDescription: 'Test company description',
        phoneNumber: '+1234567890',
        emailAddress: 'provider@test.com',
        corpIdTaxId: 'TEST123456',
        isIsolatedInstance: false
      }
    });
    providerId = provider.providerId;

    // Create test users
    const systemAdmin = await userService.createUser({
      firstName: 'System',
      lastName: 'Admin',
      emailAddress: 'sysadmin@test.com',
      phoneNumber: '+1234567890',
      country: 'Test Country',
      password: 'password123',
      userType: UserType.SYSTEM_ADMIN
    });
    systemAdminId = systemAdmin.userId;

    const providerAdmin = await userService.createUser({
      firstName: 'Provider',
      lastName: 'Admin',
      emailAddress: 'provideradmin@test.com',
      phoneNumber: '+1234567891',
      country: 'Test Country',
      password: 'password123',
      userType: UserType.PROVIDER_ADMIN,
      providerId
    });
    providerAdminId = providerAdmin.userId;

    const tourist = await userService.createUser({
      firstName: 'Test',
      lastName: 'Tourist',
      emailAddress: 'tourist@test.com',
      phoneNumber: '+1234567892',
      country: 'Test Country',
      password: 'password123',
      userType: UserType.TOURIST,
      providerId
    });
    touristId = tourist.userId;

    // Generate tokens
    systemAdminToken = authService.generateAccessToken(systemAdmin);
    providerAdminToken = authService.generateAccessToken(providerAdmin);
    touristToken = authService.generateAccessToken(tourist);
  });

  afterAll(async () => {
    await cleanupTestDatabase(prisma);
    await prisma.$disconnect();
  });

  describe('GET /api/tour-templates', () => {
    it('should return tour templates for authenticated users', async () => {
      // Create a test tour template
      await prisma.tourTemplate.create({
        data: {
          templateName: 'Test Template',
          type: 'Cultural',
          year: 2024,
          startDate: new Date('2024-06-01'),
          endDate: new Date('2024-06-15'),
          detailedDescription: 'A test tour template'
        }
      });

      const response = await request(app)
        .get('/api/tour-templates')
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(200);

      expect(response.body.message).toBe('Tour templates retrieved successfully');
      expect(response.body.data.tourTemplates).toHaveLength(1);
      expect(response.body.data.tourTemplates[0].templateName).toBe('Test Template');
    });

    it('should filter tour templates by year', async () => {
      // Create tour templates for different years
      await prisma.tourTemplate.createMany({
        data: [
          {
            templateName: 'Template 2024',
            type: 'Cultural',
            year: 2024,
            startDate: new Date('2024-06-01'),
            endDate: new Date('2024-06-15'),
            detailedDescription: 'Template for 2024'
          },
          {
            templateName: 'Template 2025',
            type: 'Historical',
            year: 2025,
            startDate: new Date('2025-06-01'),
            endDate: new Date('2025-06-15'),
            detailedDescription: 'Template for 2025'
          }
        ]
      });

      const response = await request(app)
        .get('/api/tour-templates?year=2024')
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(200);

      expect(response.body.data.tourTemplates).toHaveLength(1);
      expect(response.body.data.tourTemplates[0].year).toBe(2024);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/tour-templates')
        .expect(401);
    });
  });

  describe('POST /api/tour-templates', () => {
    const validTourTemplate = {
      templateName: 'New Tour Template',
      type: 'Cultural',
      year: 2024,
      startDate: '2024-06-01T00:00:00.000Z',
      endDate: '2024-06-15T00:00:00.000Z',
      detailedDescription: 'A detailed description of the tour template',
      sitesToVisit: [
        {
          siteName: 'Test Site',
          description: 'A test site',
          location: 'Test Location',
          visitDuration: '2 hours',
          estimatedCost: 50.00,
          category: SiteCategory.CULTURAL,
          isOptional: false,
          orderIndex: 1
        }
      ]
    };

    it('should create tour template for system admin', async () => {
      const response = await request(app)
        .post('/api/tour-templates')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(validTourTemplate)
        .expect(201);

      expect(response.body.message).toBe('Tour template created successfully');
      expect(response.body.data.tourTemplate.templateName).toBe('New Tour Template');
      expect(response.body.data.tourTemplate.sitesToVisit).toHaveLength(1);
    });

    it('should reject creation for provider admin', async () => {
      await request(app)
        .post('/api/tour-templates')
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send(validTourTemplate)
        .expect(403);
    });

    it('should reject creation for tourist', async () => {
      await request(app)
        .post('/api/tour-templates')
        .set('Authorization', `Bearer ${touristToken}`)
        .send(validTourTemplate)
        .expect(403);
    });

    it('should validate required fields', async () => {
      const invalidTemplate = {
        templateName: '',
        type: 'Cultural'
        // Missing required fields
      };

      const response = await request(app)
        .post('/api/tour-templates')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(invalidTemplate)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should prevent duplicate template names for same year', async () => {
      // Create first template
      await request(app)
        .post('/api/tour-templates')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(validTourTemplate)
        .expect(201);

      // Try to create duplicate
      const response = await request(app)
        .post('/api/tour-templates')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(validTourTemplate)
        .expect(409);

      expect(response.body.error.code).toBe('TEMPLATE_ALREADY_EXISTS');
    });
  });

  describe('GET /api/tour-templates/:id', () => {
    let templateId: string;

    beforeEach(async () => {
      const template = await prisma.tourTemplate.create({
        data: {
          templateName: 'Test Template',
          type: 'Cultural',
          year: 2024,
          startDate: new Date('2024-06-01'),
          endDate: new Date('2024-06-15'),
          detailedDescription: 'A test tour template'
        }
      });
      templateId = template.templateId;
    });

    it('should return tour template for authenticated users', async () => {
      const response = await request(app)
        .get(`/api/tour-templates/${templateId}`)
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(200);

      expect(response.body.message).toBe('Tour template retrieved successfully');
      expect(response.body.data.tourTemplate.templateName).toBe('Test Template');
    });

    it('should return 404 for non-existent template', async () => {
      const response = await request(app)
        .get('/api/tour-templates/non-existent-id')
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(404);

      expect(response.body.error.code).toBe('TEMPLATE_NOT_FOUND');
    });

    it('should require authentication', async () => {
      await request(app)
        .get(`/api/tour-templates/${templateId}`)
        .expect(401);
    });
  });

  describe('PUT /api/tour-templates/:id', () => {
    let templateId: string;

    beforeEach(async () => {
      const template = await prisma.tourTemplate.create({
        data: {
          templateName: 'Test Template',
          type: 'Cultural',
          year: 2024,
          startDate: new Date('2024-06-01'),
          endDate: new Date('2024-06-15'),
          detailedDescription: 'A test tour template'
        }
      });
      templateId = template.templateId;
    });

    const updateData = {
      templateName: 'Updated Template',
      detailedDescription: 'Updated description'
    };

    it('should update tour template for system admin', async () => {
      const response = await request(app)
        .put(`/api/tour-templates/${templateId}`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.message).toBe('Tour template updated successfully');
      expect(response.body.data.tourTemplate.templateName).toBe('Updated Template');
    });

    it('should reject update for provider admin', async () => {
      await request(app)
        .put(`/api/tour-templates/${templateId}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send(updateData)
        .expect(403);
    });

    it('should reject update for tourist', async () => {
      await request(app)
        .put(`/api/tour-templates/${templateId}`)
        .set('Authorization', `Bearer ${touristToken}`)
        .send(updateData)
        .expect(403);
    });

    it('should return 404 for non-existent template', async () => {
      const response = await request(app)
        .put('/api/tour-templates/non-existent-id')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(updateData)
        .expect(404);

      expect(response.body.error.code).toBe('TEMPLATE_NOT_FOUND');
    });
  });

  describe('DELETE /api/tour-templates/:id', () => {
    let templateId: string;

    beforeEach(async () => {
      const template = await prisma.tourTemplate.create({
        data: {
          templateName: 'Test Template',
          type: 'Cultural',
          year: 2024,
          startDate: new Date('2024-06-01'),
          endDate: new Date('2024-06-15'),
          detailedDescription: 'A test tour template'
        }
      });
      templateId = template.templateId;
    });

    it('should delete tour template for system admin', async () => {
      const response = await request(app)
        .delete(`/api/tour-templates/${templateId}`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(200);

      expect(response.body.message).toBe('Tour template deleted successfully');

      // Verify template is deleted
      const deletedTemplate = await prisma.tourTemplate.findUnique({
        where: { templateId }
      });
      expect(deletedTemplate).toBeNull();
    });

    it('should reject deletion for provider admin', async () => {
      await request(app)
        .delete(`/api/tour-templates/${templateId}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(403);
    });

    it('should reject deletion for tourist', async () => {
      await request(app)
        .delete(`/api/tour-templates/${templateId}`)
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(403);
    });

    it('should return 404 for non-existent template', async () => {
      const response = await request(app)
        .delete('/api/tour-templates/non-existent-id')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(404);

      expect(response.body.error.code).toBe('TEMPLATE_NOT_FOUND');
    });

    it('should prevent deletion of template in use', async () => {
      // Create a tour event using the template
      await prisma.customTourEvent.create({
        data: {
          providerId,
          templateId,
          customTourName: 'Test Tour Event',
          startDate: new Date('2024-06-01'),
          endDate: new Date('2024-06-15'),
          packageType: 'Standard',
          place1Hotel: 'Hotel A',
          place2Hotel: 'Hotel B',
          numberOfAllowedTourists: 20,
          remainingTourists: 20,
          status: 'ACTIVE'
        }
      });

      const response = await request(app)
        .delete(`/api/tour-templates/${templateId}`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(409);

      expect(response.body.error.code).toBe('TEMPLATE_IN_USE');
    });
  });

  describe('Site Management Endpoints', () => {
    let templateId: string;

    beforeEach(async () => {
      const template = await prisma.tourTemplate.create({
        data: {
          templateName: 'Test Template with Sites',
          type: 'Cultural',
          year: 2024,
          startDate: new Date('2024-06-01'),
          endDate: new Date('2024-06-15'),
          detailedDescription: 'A test tour template for site management'
        }
      });
      templateId = template.templateId;
    });

    describe('GET /api/tour-templates/:id/sites', () => {
      it('should return sites for template', async () => {
        // Add a site to the template
        await prisma.siteToVisit.create({
          data: {
            templateId,
            siteName: 'Test Site',
            location: 'Test Location',
            visitDuration: '2 hours',
            category: SiteCategory.CULTURAL,
            orderIndex: 1
          }
        });

        const response = await request(app)
          .get(`/api/tour-templates/${templateId}/sites`)
          .set('Authorization', `Bearer ${touristToken}`)
          .expect(200);

        expect(response.body.message).toBe('Template sites retrieved successfully');
        expect(response.body.data.sites).toHaveLength(1);
        expect(response.body.data.sites[0].siteName).toBe('Test Site');
      });

      it('should return empty array for template with no sites', async () => {
        const response = await request(app)
          .get(`/api/tour-templates/${templateId}/sites`)
          .set('Authorization', `Bearer ${touristToken}`)
          .expect(200);

        expect(response.body.data.sites).toHaveLength(0);
      });

      it('should require authentication', async () => {
        await request(app)
          .get(`/api/tour-templates/${templateId}/sites`)
          .expect(401);
      });
    });

    describe('POST /api/tour-templates/:id/sites', () => {
      const validSiteData = {
        siteName: 'New Test Site',
        description: 'A new test site',
        location: 'New Test Location',
        visitDuration: '3 hours',
        estimatedCost: 50.00,
        category: SiteCategory.HISTORICAL,
        isOptional: false,
        orderIndex: 1
      };

      it('should add site to template for system admin', async () => {
        const response = await request(app)
          .post(`/api/tour-templates/${templateId}/sites`)
          .set('Authorization', `Bearer ${systemAdminToken}`)
          .send(validSiteData)
          .expect(201);

        expect(response.body.message).toBe('Site added to template successfully');
        expect(response.body.data.site.siteName).toBe('New Test Site');
        expect(response.body.data.site.templateId).toBe(templateId);
      });

      it('should reject site addition for provider admin', async () => {
        await request(app)
          .post(`/api/tour-templates/${templateId}/sites`)
          .set('Authorization', `Bearer ${providerAdminToken}`)
          .send(validSiteData)
          .expect(403);
      });

      it('should reject site addition for tourist', async () => {
        await request(app)
          .post(`/api/tour-templates/${templateId}/sites`)
          .set('Authorization', `Bearer ${touristToken}`)
          .send(validSiteData)
          .expect(403);
      });

      it('should validate required fields', async () => {
        const invalidSiteData = {
          siteName: '',
          location: 'Test Location'
          // Missing required fields
        };

        const response = await request(app)
          .post(`/api/tour-templates/${templateId}/sites`)
          .set('Authorization', `Bearer ${systemAdminToken}`)
          .send(invalidSiteData)
          .expect(400);

        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should prevent duplicate order index', async () => {
        // Add first site
        await request(app)
          .post(`/api/tour-templates/${templateId}/sites`)
          .set('Authorization', `Bearer ${systemAdminToken}`)
          .send(validSiteData)
          .expect(201);

        // Try to add second site with same order index
        const response = await request(app)
          .post(`/api/tour-templates/${templateId}/sites`)
          .set('Authorization', `Bearer ${systemAdminToken}`)
          .send({ ...validSiteData, siteName: 'Another Site' })
          .expect(409);

        expect(response.body.error.code).toBe('SITE_ORDER_CONFLICT');
      });
    });

    describe('PUT /api/tour-templates/:id/sites/:siteId', () => {
      let siteId: string;

      beforeEach(async () => {
        const site = await prisma.siteToVisit.create({
          data: {
            templateId,
            siteName: 'Original Site',
            location: 'Original Location',
            visitDuration: '2 hours',
            category: SiteCategory.CULTURAL,
            orderIndex: 1
          }
        });
        siteId = site.siteId;
      });

      const updateData = {
        siteName: 'Updated Site Name',
        description: 'Updated description'
      };

      it('should update site for system admin', async () => {
        const response = await request(app)
          .put(`/api/tour-templates/${templateId}/sites/${siteId}`)
          .set('Authorization', `Bearer ${systemAdminToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body.message).toBe('Site updated successfully');
        expect(response.body.data.site.siteName).toBe('Updated Site Name');
        expect(response.body.data.site.description).toBe('Updated description');
      });

      it('should reject update for provider admin', async () => {
        await request(app)
          .put(`/api/tour-templates/${templateId}/sites/${siteId}`)
          .set('Authorization', `Bearer ${providerAdminToken}`)
          .send(updateData)
          .expect(403);
      });

      it('should return 404 for non-existent site', async () => {
        const response = await request(app)
          .put(`/api/tour-templates/${templateId}/sites/non-existent-id`)
          .set('Authorization', `Bearer ${systemAdminToken}`)
          .send(updateData)
          .expect(404);

        expect(response.body.error.code).toBe('SITE_NOT_FOUND');
      });
    });

    describe('DELETE /api/tour-templates/:id/sites/:siteId', () => {
      let siteId: string;

      beforeEach(async () => {
        const site = await prisma.siteToVisit.create({
          data: {
            templateId,
            siteName: 'Site to Delete',
            location: 'Test Location',
            visitDuration: '2 hours',
            category: SiteCategory.CULTURAL,
            orderIndex: 1
          }
        });
        siteId = site.siteId;
      });

      it('should delete site for system admin', async () => {
        const response = await request(app)
          .delete(`/api/tour-templates/${templateId}/sites/${siteId}`)
          .set('Authorization', `Bearer ${systemAdminToken}`)
          .expect(200);

        expect(response.body.message).toBe('Site removed from template successfully');

        // Verify site is deleted
        const deletedSite = await prisma.siteToVisit.findUnique({
          where: { siteId }
        });
        expect(deletedSite).toBeNull();
      });

      it('should reject deletion for provider admin', async () => {
        await request(app)
          .delete(`/api/tour-templates/${templateId}/sites/${siteId}`)
          .set('Authorization', `Bearer ${providerAdminToken}`)
          .expect(403);
      });

      it('should return 404 for non-existent site', async () => {
        const response = await request(app)
          .delete(`/api/tour-templates/${templateId}/sites/non-existent-id`)
          .set('Authorization', `Bearer ${systemAdminToken}`)
          .expect(404);

        expect(response.body.error.code).toBe('SITE_NOT_FOUND');
      });
    });

    describe('PUT /api/tour-templates/:id/sites/reorder', () => {
      let site1Id: string;
      let site2Id: string;

      beforeEach(async () => {
        const site1 = await prisma.siteToVisit.create({
          data: {
            templateId,
            siteName: 'Site 1',
            location: 'Location 1',
            visitDuration: '2 hours',
            category: SiteCategory.CULTURAL,
            orderIndex: 1
          }
        });
        site1Id = site1.siteId;

        const site2 = await prisma.siteToVisit.create({
          data: {
            templateId,
            siteName: 'Site 2',
            location: 'Location 2',
            visitDuration: '3 hours',
            category: SiteCategory.HISTORICAL,
            orderIndex: 2
          }
        });
        site2Id = site2.siteId;
      });

      it('should reorder sites for system admin', async () => {
        const reorderData = {
          siteOrders: [
            { siteId: site1Id, orderIndex: 2 },
            { siteId: site2Id, orderIndex: 1 }
          ]
        };

        const response = await request(app)
          .put(`/api/tour-templates/${templateId}/sites/reorder`)
          .set('Authorization', `Bearer ${systemAdminToken}`)
          .send(reorderData)
          .expect(200);

        expect(response.body.message).toBe('Sites reordered successfully');
        expect(response.body.data.sites).toHaveLength(2);
        
        // Verify order is correct
        const reorderedSites = response.body.data.sites;
        expect(reorderedSites[0].orderIndex).toBe(1);
        expect(reorderedSites[1].orderIndex).toBe(2);
      });

      it('should reject reordering for provider admin', async () => {
        const reorderData = {
          siteOrders: [
            { siteId: site1Id, orderIndex: 2 },
            { siteId: site2Id, orderIndex: 1 }
          ]
        };

        await request(app)
          .put(`/api/tour-templates/${templateId}/sites/reorder`)
          .set('Authorization', `Bearer ${providerAdminToken}`)
          .send(reorderData)
          .expect(403);
      });

      it('should validate request body', async () => {
        const invalidData = {
          siteOrders: 'not-an-array'
        };

        const response = await request(app)
          .put(`/api/tour-templates/${templateId}/sites/reorder`)
          .set('Authorization', `Bearer ${systemAdminToken}`)
          .send(invalidData)
          .expect(400);

        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });
    });
  });

  describe('Template Utility Endpoints', () => {
    let templateId: string;

    beforeEach(async () => {
      const template = await prisma.tourTemplate.create({
        data: {
          templateName: 'Utility Test Template',
          type: 'Cultural',
          year: 2024,
          startDate: new Date('2024-06-01'),
          endDate: new Date('2024-06-15'),
          detailedDescription: 'A test tour template for utility testing'
        }
      });
      templateId = template.templateId;

      // Add some sites
      await prisma.siteToVisit.createMany({
        data: [
          {
            templateId,
            siteName: 'Historical Site',
            location: 'City Center',
            visitDuration: '2 hours',
            estimatedCost: 25.50,
            category: SiteCategory.HISTORICAL,
            isOptional: false,
            orderIndex: 1
          },
          {
            templateId,
            siteName: 'Cultural Museum',
            location: 'Museum District',
            visitDuration: '3 hours',
            estimatedCost: 15.00,
            category: SiteCategory.CULTURAL,
            isOptional: true,
            orderIndex: 2
          }
        ]
      });
    });

    describe('GET /api/tour-templates/:id/tour-event-creation', () => {
      it('should return template with suggested activities', async () => {
        const response = await request(app)
          .get(`/api/tour-templates/${templateId}/tour-event-creation`)
          .set('Authorization', `Bearer ${touristToken}`)
          .expect(200);

        expect(response.body.message).toBe('Template data for tour event creation retrieved successfully');
        expect(response.body.data.template).toBeDefined();
        expect(response.body.data.suggestedActivities).toHaveLength(2);
        expect(response.body.data.suggestedActivities[0].activityName).toBe('Visit Historical Site');
        expect(response.body.data.suggestedActivities[0].activityType).toBe('Sightseeing');
      });

      it('should require authentication', async () => {
        await request(app)
          .get(`/api/tour-templates/${templateId}/tour-event-creation`)
          .expect(401);
      });

      it('should return 404 for non-existent template', async () => {
        const response = await request(app)
          .get('/api/tour-templates/non-existent-id/tour-event-creation')
          .set('Authorization', `Bearer ${touristToken}`)
          .expect(404);

        expect(response.body.error.code).toBe('TEMPLATE_NOT_FOUND');
      });
    });

    describe('POST /api/tour-templates/:id/validate-compatibility', () => {
      it('should validate template compatibility', async () => {
        const compatibilityData = {
          startDate: '2024-06-01T00:00:00.000Z',
          endDate: '2024-06-15T00:00:00.000Z'
        };

        const response = await request(app)
          .post(`/api/tour-templates/${templateId}/validate-compatibility`)
          .set('Authorization', `Bearer ${touristToken}`)
          .send(compatibilityData)
          .expect(200);

        expect(response.body.message).toBe('Template compatibility validation completed');
        expect(response.body.data.isCompatible).toBeDefined();
        expect(response.body.data.warnings).toBeDefined();
        expect(response.body.data.recommendations).toBeDefined();
      });

      it('should validate request data', async () => {
        const invalidData = {
          startDate: '2024-06-01T00:00:00.000Z',
          endDate: '2024-05-01T00:00:00.000Z' // End before start
        };

        const response = await request(app)
          .post(`/api/tour-templates/${templateId}/validate-compatibility`)
          .set('Authorization', `Bearer ${touristToken}`)
          .send(invalidData)
          .expect(400);

        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should require authentication', async () => {
        await request(app)
          .post(`/api/tour-templates/${templateId}/validate-compatibility`)
          .send({
            startDate: '2024-06-01T00:00:00.000Z',
            endDate: '2024-06-15T00:00:00.000Z'
          })
          .expect(401);
      });
    });

    describe('POST /api/tour-templates/:id/generate-schedule', () => {
      it('should generate activity schedule', async () => {
        const scheduleData = {
          startDate: '2024-06-01T00:00:00.000Z',
          endDate: '2024-06-03T00:00:00.000Z'
        };

        const response = await request(app)
          .post(`/api/tour-templates/${templateId}/generate-schedule`)
          .set('Authorization', `Bearer ${touristToken}`)
          .send(scheduleData)
          .expect(200);

        expect(response.body.message).toBe('Activity schedule generated successfully');
        expect(response.body.data.schedule).toBeDefined();
        expect(Array.isArray(response.body.data.schedule)).toBe(true);
      });

      it('should validate request data', async () => {
        const invalidData = {
          startDate: 'invalid-date',
          endDate: '2024-06-15T00:00:00.000Z'
        };

        const response = await request(app)
          .post(`/api/tour-templates/${templateId}/generate-schedule`)
          .set('Authorization', `Bearer ${touristToken}`)
          .send(invalidData)
          .expect(400);

        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should require authentication', async () => {
        await request(app)
          .post(`/api/tour-templates/${templateId}/generate-schedule`)
          .send({
            startDate: '2024-06-01T00:00:00.000Z',
            endDate: '2024-06-15T00:00:00.000Z'
          })
          .expect(401);
      });
    });

    describe('GET /api/tour-templates/:id/cost-estimate', () => {
      it('should calculate cost estimate', async () => {
        const response = await request(app)
          .get(`/api/tour-templates/${templateId}/cost-estimate`)
          .set('Authorization', `Bearer ${touristToken}`)
          .expect(200);

        expect(response.body.message).toBe('Cost estimate calculated successfully');
        expect(response.body.data.totalEstimatedCost).toBe(40.50); // 25.50 + 15.00
        expect(response.body.data.requiredSitesCost).toBe(25.50);
        expect(response.body.data.optionalSitesCost).toBe(15.00);
        expect(response.body.data.costBreakdown).toHaveLength(2);
      });

      it('should require authentication', async () => {
        await request(app)
          .get(`/api/tour-templates/${templateId}/cost-estimate`)
          .expect(401);
      });

      it('should return 404 for non-existent template', async () => {
        const response = await request(app)
          .get('/api/tour-templates/non-existent-id/cost-estimate')
          .set('Authorization', `Bearer ${touristToken}`)
          .expect(404);

        expect(response.body.error.code).toBe('TEMPLATE_NOT_FOUND');
      });
    });

    describe('GET /api/tour-templates/:id/statistics', () => {
      it('should return template statistics', async () => {
        const response = await request(app)
          .get(`/api/tour-templates/${templateId}/statistics`)
          .set('Authorization', `Bearer ${touristToken}`)
          .expect(200);

        expect(response.body.message).toBe('Template statistics retrieved successfully');
        expect(response.body.data.totalSites).toBe(2);
        expect(response.body.data.requiredSites).toBe(1);
        expect(response.body.data.optionalSites).toBe(1);
        expect(response.body.data.sitesByCategory).toBeDefined();
        expect(response.body.data.templateDurationDays).toBe(15);
      });

      it('should require authentication', async () => {
        await request(app)
          .get(`/api/tour-templates/${templateId}/statistics`)
          .expect(401);
      });

      it('should return 404 for non-existent template', async () => {
        const response = await request(app)
          .get('/api/tour-templates/non-existent-id/statistics')
          .set('Authorization', `Bearer ${touristToken}`)
          .expect(404);

        expect(response.body.error.code).toBe('TEMPLATE_NOT_FOUND');
      });
    });
  });
});