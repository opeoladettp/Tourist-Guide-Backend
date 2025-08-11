import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import app from '../../app';
import { setupTestDatabase, cleanupTestDatabase } from '../../utils/test-db-setup';
import { AuthService } from '../../services/auth';
import { UserService } from '../../services/user';
import { ProviderService } from '../../services/provider';
import { TourTemplateService } from '../../services/tour-template';
import { UserType } from '../../types/user';
import { TourEventStatus } from '../../types/custom-tour-event';

describe('API Endpoints Integration Tests', () => {
  let prisma: PrismaClient;
  let authService: AuthService;
  let userService: UserService;
  let providerService: ProviderService;
  let tourTemplateService: TourTemplateService;
  let systemAdminToken: string;
  let providerAdminToken: string;
  let touristToken: string;
  let providerId: string;
  let templateId: string;
  let systemAdminId: string;
  let providerAdminId: string;
  let touristId: string;

  beforeAll(async () => {
    prisma = await setupTestDatabase();
    authService = new AuthService(prisma);
    userService = new UserService(prisma);
    providerService = new ProviderService(prisma);
    tourTemplateService = new TourTemplateService(prisma);

    // Create system admin
    const systemAdmin = await userService.createUser({
      firstName: 'System',
      lastName: 'Admin',
      emailAddress: 'sysadmin@test.com',
      phoneNumber: '+1234567890',
      country: 'US',
      password: 'SecurePass123!',
      userType: UserType.SYSTEM_ADMIN
    });
    systemAdminId = systemAdmin.userId;

    const systemAdminLogin = await authService.login('sysadmin@test.com', 'SecurePass123!');
    systemAdminToken = systemAdminLogin.accessToken;

    // Create provider
    const provider = await providerService.createProvider({
      companyName: 'Test Travel Co',
      country: 'US',
      addressLine1: '123 Test St',
      city: 'Test City',
      stateRegion: 'Test State',
      companyDescription: 'Test travel company',
      phoneNumber: '+1234567891',
      emailAddress: 'contact@testtravelco.com',
      corpIdTaxId: 'TEST123456'
    });
    providerId = provider.providerId;

    // Create provider admin
    const providerAdmin = await userService.createUser({
      firstName: 'Provider',
      lastName: 'Admin',
      emailAddress: 'admin@testtravelco.com',
      phoneNumber: '+1234567892',
      country: 'US',
      password: 'SecurePass123!',
      userType: UserType.PROVIDER_ADMIN,
      providerId: providerId
    });
    providerAdminId = providerAdmin.userId;

    const providerAdminLogin = await authService.login('admin@testtravelco.com', 'SecurePass123!');
    providerAdminToken = providerAdminLogin.accessToken;

    // Create tourist
    const tourist = await userService.createUser({
      firstName: 'Test',
      lastName: 'Tourist',
      emailAddress: 'tourist@test.com',
      phoneNumber: '+1234567893',
      country: 'US',
      password: 'SecurePass123!',
      userType: UserType.TOURIST,
      providerId: providerId,
      passportNumber: 'P123456789',
      dateOfBirth: '1990-01-01',
      gender: 'Male'
    });
    touristId = tourist.userId;

    const touristLogin = await authService.login('tourist@test.com', 'SecurePass123!');
    touristToken = touristLogin.accessToken;

    // Create tour template
    const template = await tourTemplateService.createTourTemplate({
      templateName: 'Test Tour Template',
      type: 'Cultural',
      year: 2024,
      startDate: new Date('2024-08-01'),
      endDate: new Date('2024-08-15'),
      detailedDescription: 'A test tour template',
      sitesToVisit: [
        {
          siteName: 'Test Site',
          location: 'Test Location',
          visitDuration: 120,
          category: 'Cultural',
          orderIndex: 1,
          estimatedCost: 25.00,
          description: 'Test site description'
        }
      ]
    });
    templateId = template.templateId;
  });

  afterAll(async () => {
    await cleanupTestDatabase(prisma);
  });

  beforeEach(async () => {
    // Clean up test data between tests (except core users and provider)
    await prisma.customTourEvent.deleteMany({
      where: { providerId: providerId }
    });
    await prisma.document.deleteMany({
      where: { userId: { in: [systemAdminId, providerAdminId, touristId] } }
    });
  });

  describe('Health Check Endpoints', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.timestamp).toBeDefined();
    });

    it('should return database health status', async () => {
      const response = await request(app)
        .get('/health/database')
        .expect(200);

      expect(response.body.database).toBe('connected');
    });
  });

  describe('Authentication Endpoints', () => {
    it('should handle user login', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          emailAddress: 'tourist@test.com',
          password: 'SecurePass123!'
        })
        .expect(200);

      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      expect(response.body.user.emailAddress).toBe('tourist@test.com');
    });

    it('should handle invalid login credentials', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({
          emailAddress: 'tourist@test.com',
          password: 'wrongpassword'
        })
        .expect(401);
    });

    it('should handle user registration', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          firstName: 'New',
          lastName: 'Tourist',
          emailAddress: 'newtourist@test.com',
          phoneNumber: '+1234567894',
          country: 'US',
          password: 'SecurePass123!',
          userType: UserType.TOURIST,
          providerId: providerId,
          passportNumber: 'P987654321',
          dateOfBirth: '1992-01-01',
          gender: 'Female'
        })
        .expect(201);

      expect(response.body.user.emailAddress).toBe('newtourist@test.com');
      expect(response.body.accessToken).toBeDefined();
    });

    it('should handle token refresh', async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          emailAddress: 'tourist@test.com',
          password: 'SecurePass123!'
        })
        .expect(200);

      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: loginResponse.body.refreshToken
        })
        .expect(200);

      expect(refreshResponse.body.accessToken).toBeDefined();
    });

    it('should handle user logout', async () => {
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(200);
    });
  });

  describe('User Management Endpoints', () => {
    it('should allow system admin to get all users', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(200);

      expect(Array.isArray(response.body.users)).toBe(true);
      expect(response.body.users.length).toBeGreaterThan(0);
    });

    it('should prevent non-admin from getting all users', async () => {
      await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(403);
    });

    it('should allow system admin to create users', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({
          firstName: 'Created',
          lastName: 'User',
          emailAddress: 'created@test.com',
          phoneNumber: '+1234567895',
          country: 'US',
          password: 'SecurePass123!',
          userType: UserType.TOURIST,
          providerId: providerId
        })
        .expect(201);

      expect(response.body.emailAddress).toBe('created@test.com');
    });

    it('should allow users to get their own profile', async () => {
      const response = await request(app)
        .get(`/api/users/${touristId}`)
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(200);

      expect(response.body.userId).toBe(touristId);
      expect(response.body.firstName).toBe('Test');
    });

    it('should allow users to update their own profile', async () => {
      const response = await request(app)
        .put(`/api/users/${touristId}`)
        .set('Authorization', `Bearer ${touristToken}`)
        .send({
          firstName: 'Updated Test'
        })
        .expect(200);

      expect(response.body.firstName).toBe('Updated Test');
    });

    it('should prevent users from accessing other user profiles', async () => {
      await request(app)
        .get(`/api/users/${systemAdminId}`)
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(403);
    });
  });

  describe('Provider Management Endpoints', () => {
    it('should allow system admin to get all providers', async () => {
      const response = await request(app)
        .get('/api/providers')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(200);

      expect(Array.isArray(response.body.providers)).toBe(true);
      expect(response.body.providers.length).toBeGreaterThan(0);
    });

    it('should prevent non-admin from getting all providers', async () => {
      await request(app)
        .get('/api/providers')
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(403);
    });

    it('should allow system admin to create providers', async () => {
      const response = await request(app)
        .post('/api/providers')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({
          companyName: 'New Travel Co',
          country: 'US',
          addressLine1: '456 New St',
          city: 'New City',
          stateRegion: 'New State',
          companyDescription: 'New travel company',
          phoneNumber: '+1234567896',
          emailAddress: 'contact@newtravelco.com',
          corpIdTaxId: 'NEW123456'
        })
        .expect(201);

      expect(response.body.companyName).toBe('New Travel Co');
    });

    it('should allow provider admin to get their own provider', async () => {
      const response = await request(app)
        .get(`/api/providers/${providerId}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(200);

      expect(response.body.providerId).toBe(providerId);
    });

    it('should allow provider admin to update their own provider', async () => {
      const response = await request(app)
        .put(`/api/providers/${providerId}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send({
          companyDescription: 'Updated company description'
        })
        .expect(200);

      expect(response.body.companyDescription).toBe('Updated company description');
    });

    it('should allow provider admin to get their company users', async () => {
      const response = await request(app)
        .get(`/api/providers/${providerId}/users`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(200);

      expect(Array.isArray(response.body.users)).toBe(true);
      expect(response.body.users.length).toBeGreaterThan(0);
    });
  });

  describe('Tour Template Endpoints', () => {
    it('should allow all authenticated users to get tour templates', async () => {
      const response = await request(app)
        .get('/api/tour-templates')
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(200);

      expect(Array.isArray(response.body.templates)).toBe(true);
      expect(response.body.templates.length).toBeGreaterThan(0);
    });

    it('should allow system admin to create tour templates', async () => {
      const response = await request(app)
        .post('/api/tour-templates')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({
          templateName: 'New Tour Template',
          type: 'Adventure',
          year: 2024,
          startDate: '2024-09-01',
          endDate: '2024-09-15',
          detailedDescription: 'A new adventure tour template',
          sitesToVisit: [
            {
              siteName: 'Adventure Site',
              location: 'Mountain Range',
              visitDuration: 180,
              category: 'Adventure',
              orderIndex: 1,
              estimatedCost: 50.00,
              description: 'Exciting adventure site'
            }
          ]
        })
        .expect(201);

      expect(response.body.templateName).toBe('New Tour Template');
    });

    it('should prevent non-admin from creating tour templates', async () => {
      await request(app)
        .post('/api/tour-templates')
        .set('Authorization', `Bearer ${touristToken}`)
        .send({
          templateName: 'Unauthorized Template',
          type: 'Cultural',
          year: 2024,
          startDate: '2024-10-01',
          endDate: '2024-10-15',
          detailedDescription: 'Unauthorized template',
          sitesToVisit: []
        })
        .expect(403);
    });

    it('should allow all users to get specific tour template', async () => {
      const response = await request(app)
        .get(`/api/tour-templates/${templateId}`)
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(200);

      expect(response.body.templateId).toBe(templateId);
    });

    it('should allow system admin to update tour templates', async () => {
      const response = await request(app)
        .put(`/api/tour-templates/${templateId}`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({
          detailedDescription: 'Updated template description'
        })
        .expect(200);

      expect(response.body.detailedDescription).toBe('Updated template description');
    });

    it('should allow system admin to delete tour templates', async () => {
      // Create a template to delete
      const createResponse = await request(app)
        .post('/api/tour-templates')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({
          templateName: 'Template to Delete',
          type: 'Cultural',
          year: 2024,
          startDate: '2024-11-01',
          endDate: '2024-11-15',
          detailedDescription: 'Template for deletion test',
          sitesToVisit: []
        })
        .expect(201);

      await request(app)
        .delete(`/api/tour-templates/${createResponse.body.templateId}`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(200);
    });
  });

  describe('Tour Event Endpoints', () => {
    let tourEventId: string;

    beforeEach(async () => {
      // Create a tour event for testing
      const response = await request(app)
        .post('/api/tour-events')
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send({
          templateId: templateId,
          customTourName: 'Test Tour Event',
          startDate: '2024-08-01',
          endDate: '2024-08-15',
          packageType: 'Standard',
          place1Hotel: 'Test Hotel A',
          place2Hotel: 'Test Hotel B',
          numberOfAllowedTourists: 10,
          groupChatInfo: 'Test group chat'
        })
        .expect(201);

      tourEventId = response.body.tourEventId;
    });

    it('should allow provider admin to create tour events', async () => {
      const response = await request(app)
        .post('/api/tour-events')
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send({
          templateId: templateId,
          customTourName: 'Another Test Tour Event',
          startDate: '2024-09-01',
          endDate: '2024-09-15',
          packageType: 'Premium',
          place1Hotel: 'Premium Hotel A',
          place2Hotel: 'Premium Hotel B',
          numberOfAllowedTourists: 15,
          groupChatInfo: 'Premium group chat'
        })
        .expect(201);

      expect(response.body.customTourName).toBe('Another Test Tour Event');
      expect(response.body.status).toBe(TourEventStatus.ACTIVE);
    });

    it('should allow tourists to view tour events', async () => {
      const response = await request(app)
        .get('/api/tour-events')
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(200);

      expect(Array.isArray(response.body.tourEvents)).toBe(true);
      expect(response.body.tourEvents.length).toBeGreaterThan(0);
    });

    it('should allow tourists to get specific tour event', async () => {
      const response = await request(app)
        .get(`/api/tour-events/${tourEventId}`)
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(200);

      expect(response.body.tourEventId).toBe(tourEventId);
    });

    it('should allow provider admin to update their tour events', async () => {
      const response = await request(app)
        .put(`/api/tour-events/${tourEventId}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send({
          groupChatInfo: 'Updated group chat info'
        })
        .expect(200);

      expect(response.body.groupChatInfo).toBe('Updated group chat info');
    });

    it('should allow tourists to register for tour events', async () => {
      const response = await request(app)
        .post(`/api/tour-events/${tourEventId}/register`)
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(201);

      expect(response.body.userId).toBe(touristId);
      expect(response.body.tourEventId).toBe(tourEventId);
    });

    it('should allow provider admin to view registrations', async () => {
      // Register tourist first
      await request(app)
        .post(`/api/tour-events/${tourEventId}/register`)
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(201);

      const response = await request(app)
        .get(`/api/tour-events/${tourEventId}/registrations`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(200);

      expect(Array.isArray(response.body.registrations)).toBe(true);
      expect(response.body.registrations.length).toBe(1);
    });

    it('should allow provider admin to approve/reject registrations', async () => {
      // Register tourist first
      await request(app)
        .post(`/api/tour-events/${tourEventId}/register`)
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(201);

      // Get registration
      const registrationsResponse = await request(app)
        .get(`/api/tour-events/${tourEventId}/registrations`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(200);

      const registration = registrationsResponse.body.registrations[0];

      // Approve registration
      const response = await request(app)
        .put(`/api/tour-events/${tourEventId}/registrations/${registration.registrationId}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send({
          approved: true
        })
        .expect(200);

      expect(response.body.approved).toBe(true);
    });
  });

  describe('Activity Management Endpoints', () => {
    let tourEventId: string;

    beforeEach(async () => {
      // Create a tour event for activity testing
      const response = await request(app)
        .post('/api/tour-events')
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send({
          templateId: templateId,
          customTourName: 'Activity Test Tour Event',
          startDate: '2024-08-01',
          endDate: '2024-08-15',
          packageType: 'Standard',
          place1Hotel: 'Activity Hotel A',
          place2Hotel: 'Activity Hotel B',
          numberOfAllowedTourists: 10,
          groupChatInfo: 'Activity test group'
        })
        .expect(201);

      tourEventId = response.body.tourEventId;
    });

    it('should allow provider admin to create activities', async () => {
      const response = await request(app)
        .post(`/api/tour-events/${tourEventId}/activities`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send({
          activityName: 'Test Activity',
          activityType: 'Sightseeing',
          startTime: '09:00',
          endTime: '12:00',
          location: 'Test Location',
          description: 'Test activity description',
          activityDate: '2024-08-02',
          isOptional: false
        })
        .expect(201);

      expect(response.body.activityName).toBe('Test Activity');
    });

    it('should allow users to view tour event schedule', async () => {
      // Create an activity first
      await request(app)
        .post(`/api/tour-events/${tourEventId}/activities`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send({
          activityName: 'Schedule Test Activity',
          activityType: 'Cultural',
          startTime: '14:00',
          endTime: '17:00',
          location: 'Cultural Center',
          description: 'Cultural activity',
          activityDate: '2024-08-03',
          isOptional: true
        })
        .expect(201);

      const response = await request(app)
        .get(`/api/tour-events/${tourEventId}/schedule`)
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(200);

      expect(Array.isArray(response.body.activities)).toBe(true);
      expect(response.body.activities.length).toBeGreaterThan(0);
    });

    it('should allow provider admin to update activities', async () => {
      // Create an activity first
      const createResponse = await request(app)
        .post(`/api/tour-events/${tourEventId}/activities`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send({
          activityName: 'Update Test Activity',
          activityType: 'Adventure',
          startTime: '10:00',
          endTime: '13:00',
          location: 'Adventure Site',
          description: 'Adventure activity',
          activityDate: '2024-08-04',
          isOptional: false
        })
        .expect(201);

      const activityId = createResponse.body.activityId;

      const response = await request(app)
        .put(`/api/tour-events/${tourEventId}/activities/${activityId}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send({
          description: 'Updated adventure activity description'
        })
        .expect(200);

      expect(response.body.description).toBe('Updated adventure activity description');
    });

    it('should allow provider admin to delete activities', async () => {
      // Create an activity first
      const createResponse = await request(app)
        .post(`/api/tour-events/${tourEventId}/activities`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send({
          activityName: 'Delete Test Activity',
          activityType: 'Workshop',
          startTime: '15:00',
          endTime: '18:00',
          location: 'Workshop Room',
          description: 'Workshop activity',
          activityDate: '2024-08-05',
          isOptional: true
        })
        .expect(201);

      const activityId = createResponse.body.activityId;

      await request(app)
        .delete(`/api/tour-events/${tourEventId}/activities/${activityId}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(200);
    });
  });

  describe('Activity Type Endpoints', () => {
    it('should allow all users to get activity types', async () => {
      const response = await request(app)
        .get('/api/activity-types')
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(200);

      expect(Array.isArray(response.body.activityTypes)).toBe(true);
    });

    it('should allow system admin to create activity types', async () => {
      const response = await request(app)
        .post('/api/activity-types')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({
          typeName: 'Test Activity Type',
          description: 'A test activity type',
          category: 'Cultural',
          defaultDuration: 120,
          isActive: true
        })
        .expect(201);

      expect(response.body.typeName).toBe('Test Activity Type');
    });

    it('should prevent non-admin from creating activity types', async () => {
      await request(app)
        .post('/api/activity-types')
        .set('Authorization', `Bearer ${touristToken}`)
        .send({
          typeName: 'Unauthorized Activity Type',
          description: 'Unauthorized type',
          category: 'Adventure',
          defaultDuration: 180,
          isActive: true
        })
        .expect(403);
    });
  });

  describe('Document Management Endpoints', () => {
    it('should allow users to upload documents', async () => {
      const response = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${touristToken}`)
        .field('type', 'Passport')
        .field('description', 'Test passport document')
        .attach('file', Buffer.from('test document content'), 'passport.pdf')
        .expect(201);

      expect(response.body.type).toBe('Passport');
      expect(response.body.fileName).toBe('passport.pdf');
    });

    it('should allow users to view their documents', async () => {
      // Upload a document first
      await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${touristToken}`)
        .field('type', 'TourForm')
        .field('description', 'Test tour form')
        .attach('file', Buffer.from('tour form content'), 'tourform.pdf')
        .expect(201);

      const response = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(200);

      expect(Array.isArray(response.body.documents)).toBe(true);
      expect(response.body.documents.length).toBeGreaterThan(0);
    });

    it('should allow users to get specific document details', async () => {
      // Upload a document first
      const uploadResponse = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${touristToken}`)
        .field('type', 'Other')
        .field('description', 'Test other document')
        .attach('file', Buffer.from('other document content'), 'other.pdf')
        .expect(201);

      const documentId = uploadResponse.body.documentId;

      const response = await request(app)
        .get(`/api/documents/${documentId}`)
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(200);

      expect(response.body.documentId).toBe(documentId);
      expect(response.body.type).toBe('Other');
    });

    it('should allow users to delete their documents', async () => {
      // Upload a document first
      const uploadResponse = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${touristToken}`)
        .field('type', 'Ticket')
        .field('description', 'Test ticket document')
        .attach('file', Buffer.from('ticket content'), 'ticket.pdf')
        .expect(201);

      const documentId = uploadResponse.body.documentId;

      await request(app)
        .delete(`/api/documents/${documentId}`)
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(200);
    });

    it('should allow users to download blank forms', async () => {
      const response = await request(app)
        .get('/api/documents/forms/blank')
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(200);

      expect(response.body.forms).toBeDefined();
    });
  });

  describe('API Documentation Endpoints', () => {
    it('should serve OpenAPI JSON specification', async () => {
      const response = await request(app)
        .get('/api-docs/swagger.json')
        .expect(200);

      expect(response.body.openapi).toBeDefined();
      expect(response.body.info).toBeDefined();
      expect(response.body.paths).toBeDefined();
    });

    it('should serve OpenAPI YAML specification', async () => {
      const response = await request(app)
        .get('/api-docs/swagger.yaml')
        .expect(200);

      expect(response.text).toContain('openapi:');
      expect(response.text).toContain('info:');
      expect(response.text).toContain('paths:');
    });

    it('should serve API documentation UI', async () => {
      const response = await request(app)
        .get('/api-docs/')
        .expect(200);

      expect(response.text).toContain('swagger-ui');
    });

    it('should provide documentation health check', async () => {
      const response = await request(app)
        .get('/api-docs/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.documentation).toBe('available');
    });
  });

  describe('Version Information Endpoints', () => {
    it('should return API version information', async () => {
      const response = await request(app)
        .get('/api/version')
        .expect(200);

      expect(response.body.version).toBeDefined();
      expect(response.body.apiVersion).toBeDefined();
      expect(response.body.buildDate).toBeDefined();
    });

    it('should return detailed version information', async () => {
      const response = await request(app)
        .get('/api/version/detailed')
        .expect(200);

      expect(response.body.version).toBeDefined();
      expect(response.body.dependencies).toBeDefined();
      expect(response.body.environment).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for non-existent endpoints', async () => {
      await request(app)
        .get('/api/non-existent-endpoint')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(404);
    });

    it('should handle malformed JSON requests', async () => {
      await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);
    });

    it('should handle missing required fields', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({
          emailAddress: 'test@test.com'
          // Missing password
        })
        .expect(400);
    });

    it('should handle unauthorized access', async () => {
      await request(app)
        .get('/api/users')
        .expect(401);
    });

    it('should handle forbidden access', async () => {
      await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(403);
    });
  });

  describe('Request Validation', () => {
    it('should validate email format', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          firstName: 'Test',
          lastName: 'User',
          emailAddress: 'invalid-email',
          phoneNumber: '+1234567890',
          country: 'US',
          password: 'SecurePass123!',
          userType: UserType.TOURIST,
          providerId: providerId
        })
        .expect(400);
    });

    it('should validate phone number format', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          firstName: 'Test',
          lastName: 'User',
          emailAddress: 'test@test.com',
          phoneNumber: 'invalid-phone',
          country: 'US',
          password: 'SecurePass123!',
          userType: UserType.TOURIST,
          providerId: providerId
        })
        .expect(400);
    });

    it('should validate date formats', async () => {
      await request(app)
        .post('/api/tour-templates')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({
          templateName: 'Invalid Date Template',
          type: 'Cultural',
          year: 2024,
          startDate: 'invalid-date',
          endDate: '2024-08-15',
          detailedDescription: 'Template with invalid date',
          sitesToVisit: []
        })
        .expect(400);
    });

    it('should validate required fields', async () => {
      await request(app)
        .post('/api/providers')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({
          // Missing required fields
          companyName: 'Incomplete Provider'
        })
        .expect(400);
    });
  });
});