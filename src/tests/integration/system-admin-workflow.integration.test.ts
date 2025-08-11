import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import app from '../../app';
import { setupTestDatabase, cleanupTestDatabase } from '../../utils/test-db-setup';
import { AuthService } from '../../services/auth';
import { UserService } from '../../services/user';
import { UserType } from '../../types/user';

describe('System Admin End-to-End Workflow Integration Tests', () => {
  let prisma: PrismaClient;
  let authService: AuthService;
  let userService: UserService;
  let systemAdminToken: string;
  let systemAdminId: string;

  beforeAll(async () => {
    prisma = await setupTestDatabase();
    authService = new AuthService(prisma);
    userService = new UserService(prisma);

    // Create system admin user
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

    // Login to get token
    const loginResponse = await authService.login('sysadmin@test.com', 'SecurePass123!');
    systemAdminToken = loginResponse.accessToken;
  });

  afterAll(async () => {
    await cleanupTestDatabase(prisma);
  });

  beforeEach(async () => {
    // Clean up test data between tests
    await prisma.customTourEvent.deleteMany();
    await prisma.tourTemplate.deleteMany();
    await prisma.user.deleteMany({
      where: { userId: { not: systemAdminId } }
    });
    await prisma.provider.deleteMany();
  });

  describe('Complete System Admin Workflow', () => {
    it('should complete full system administration workflow', async () => {
      // Step 1: Create a provider company
      const providerResponse = await request(app)
        .post('/api/providers')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({
          companyName: 'Test Travel Company',
          country: 'US',
          addressLine1: '123 Main St',
          city: 'Test City',
          stateRegion: 'Test State',
          companyDescription: 'A test travel company',
          phoneNumber: '+1234567890',
          emailAddress: 'contact@testtravelco.com',
          corpIdTaxId: 'TEST123456'
        })
        .expect(201);

      const providerId = providerResponse.body.providerId;
      expect(providerResponse.body.companyName).toBe('Test Travel Company');

      // Step 2: Create a provider admin user
      const providerAdminResponse = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({
          firstName: 'Provider',
          lastName: 'Admin',
          emailAddress: 'admin@testtravelco.com',
          phoneNumber: '+1234567891',
          country: 'US',
          password: 'SecurePass123!',
          userType: UserType.PROVIDER_ADMIN,
          providerId: providerId
        })
        .expect(201);

      const providerAdminId = providerAdminResponse.body.userId;
      expect(providerAdminResponse.body.userType).toBe(UserType.PROVIDER_ADMIN);

      // Step 3: Create a tourist user
      const touristResponse = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({
          firstName: 'John',
          lastName: 'Tourist',
          emailAddress: 'tourist@test.com',
          phoneNumber: '+1234567892',
          country: 'US',
          password: 'SecurePass123!',
          userType: UserType.TOURIST,
          providerId: providerId,
          passportNumber: 'P123456789',
          dateOfBirth: '1990-01-01',
          gender: 'Male'
        })
        .expect(201);

      const touristId = touristResponse.body.userId;
      expect(touristResponse.body.userType).toBe(UserType.TOURIST);

      // Step 4: Create a tour template
      const templateResponse = await request(app)
        .post('/api/tour-templates')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({
          templateName: 'Holy Land Pilgrimage',
          type: 'Religious',
          year: 2024,
          startDate: '2024-06-01',
          endDate: '2024-06-15',
          detailedDescription: 'A comprehensive pilgrimage tour to the Holy Land',
          sitesToVisit: [
            {
              siteName: 'Jerusalem Old City',
              location: 'Jerusalem, Israel',
              visitDuration: 480,
              category: 'Religious',
              orderIndex: 1,
              estimatedCost: 50.00,
              description: 'Visit the holy sites in Jerusalem'
            }
          ]
        })
        .expect(201);

      const templateId = templateResponse.body.templateId;
      expect(templateResponse.body.templateName).toBe('Holy Land Pilgrimage');

      // Step 5: Verify all users can view the template
      const allUsersResponse = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(200);

      expect(allUsersResponse.body.users).toHaveLength(3); // System admin + provider admin + tourist
      expect(allUsersResponse.body.users.some((u: any) => u.userId === systemAdminId)).toBe(true);
      expect(allUsersResponse.body.users.some((u: any) => u.userId === providerAdminId)).toBe(true);
      expect(allUsersResponse.body.users.some((u: any) => u.userId === touristId)).toBe(true);

      // Step 6: Verify provider has associated users
      const providerUsersResponse = await request(app)
        .get(`/api/providers/${providerId}/users`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(200);

      expect(providerUsersResponse.body.users).toHaveLength(2); // Provider admin + tourist
      expect(providerUsersResponse.body.users.some((u: any) => u.userId === providerAdminId)).toBe(true);
      expect(providerUsersResponse.body.users.some((u: any) => u.userId === touristId)).toBe(true);

      // Step 7: Update provider information
      const updatedProviderResponse = await request(app)
        .put(`/api/providers/${providerId}`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({
          companyDescription: 'Updated test travel company description'
        })
        .expect(200);

      expect(updatedProviderResponse.body.companyDescription).toBe('Updated test travel company description');

      // Step 8: Update tour template
      const updatedTemplateResponse = await request(app)
        .put(`/api/tour-templates/${templateId}`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({
          detailedDescription: 'Updated comprehensive pilgrimage tour to the Holy Land'
        })
        .expect(200);

      expect(updatedTemplateResponse.body.detailedDescription).toBe('Updated comprehensive pilgrimage tour to the Holy Land');

      // Step 9: Verify system admin can access all data
      const providersResponse = await request(app)
        .get('/api/providers')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(200);

      expect(providersResponse.body.providers).toHaveLength(1);
      expect(providersResponse.body.providers[0].providerId).toBe(providerId);

      const templatesResponse = await request(app)
        .get('/api/tour-templates')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(200);

      expect(templatesResponse.body.templates).toHaveLength(1);
      expect(templatesResponse.body.templates[0].templateId).toBe(templateId);
    });

    it('should handle system admin user management operations', async () => {
      // Create provider first
      const providerResponse = await request(app)
        .post('/api/providers')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({
          companyName: 'User Management Test Co',
          country: 'US',
          addressLine1: '456 Test Ave',
          city: 'Test City',
          stateRegion: 'Test State',
          companyDescription: 'User management testing',
          phoneNumber: '+1234567893',
          emailAddress: 'contact@usermgmt.com',
          corpIdTaxId: 'USER123456'
        })
        .expect(201);

      const providerId = providerResponse.body.providerId;

      // Create multiple users
      const users = [];
      for (let i = 0; i < 3; i++) {
        const userResponse = await request(app)
          .post('/api/users')
          .set('Authorization', `Bearer ${systemAdminToken}`)
          .send({
            firstName: `User${i}`,
            lastName: 'Test',
            emailAddress: `user${i}@test.com`,
            phoneNumber: `+123456789${i}`,
            country: 'US',
            password: 'SecurePass123!',
            userType: UserType.TOURIST,
            providerId: providerId
          })
          .expect(201);

        users.push(userResponse.body);
      }

      // Verify all users were created
      const allUsersResponse = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(200);

      expect(allUsersResponse.body.users.length).toBeGreaterThanOrEqual(4); // 3 new users + system admin

      // Update a user
      const updatedUserResponse = await request(app)
        .put(`/api/users/${users[0].userId}`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({
          firstName: 'UpdatedUser0'
        })
        .expect(200);

      expect(updatedUserResponse.body.firstName).toBe('UpdatedUser0');

      // Delete a user
      await request(app)
        .delete(`/api/users/${users[1].userId}`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(200);

      // Verify user was deleted
      await request(app)
        .get(`/api/users/${users[1].userId}`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(404);
    });

    it('should handle system admin template and provider management', async () => {
      // Create multiple providers
      const providers = [];
      for (let i = 0; i < 2; i++) {
        const providerResponse = await request(app)
          .post('/api/providers')
          .set('Authorization', `Bearer ${systemAdminToken}`)
          .send({
            companyName: `Test Company ${i}`,
            country: 'US',
            addressLine1: `${i}00 Test St`,
            city: 'Test City',
            stateRegion: 'Test State',
            companyDescription: `Test company ${i}`,
            phoneNumber: `+12345678${i}0`,
            emailAddress: `contact${i}@test.com`,
            corpIdTaxId: `TEST${i}23456`
          })
          .expect(201);

        providers.push(providerResponse.body);
      }

      // Create multiple templates
      const templates = [];
      for (let i = 0; i < 2; i++) {
        const templateResponse = await request(app)
          .post('/api/tour-templates')
          .set('Authorization', `Bearer ${systemAdminToken}`)
          .send({
            templateName: `Tour Template ${i}`,
            type: 'Cultural',
            year: 2024,
            startDate: `2024-0${i + 7}-01`,
            endDate: `2024-0${i + 7}-15`,
            detailedDescription: `Test tour template ${i}`,
            sitesToVisit: [
              {
                siteName: `Site ${i}`,
                location: `Location ${i}`,
                visitDuration: 240,
                category: 'Cultural',
                orderIndex: 1,
                estimatedCost: 25.00
              }
            ]
          })
          .expect(201);

        templates.push(templateResponse.body);
      }

      // Verify all providers and templates exist
      const providersResponse = await request(app)
        .get('/api/providers')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(200);

      expect(providersResponse.body.providers).toHaveLength(2);

      const templatesResponse = await request(app)
        .get('/api/tour-templates')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(200);

      expect(templatesResponse.body.templates).toHaveLength(2);

      // Delete a provider
      await request(app)
        .delete(`/api/providers/${providers[0].providerId}`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(200);

      // Delete a template
      await request(app)
        .delete(`/api/tour-templates/${templates[0].templateId}`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(200);

      // Verify deletions
      const remainingProvidersResponse = await request(app)
        .get('/api/providers')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(200);

      expect(remainingProvidersResponse.body.providers).toHaveLength(1);

      const remainingTemplatesResponse = await request(app)
        .get('/api/tour-templates')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(200);

      expect(remainingTemplatesResponse.body.templates).toHaveLength(1);
    });

    it('should handle system admin activity type management', async () => {
      // Create activity types
      const activityType1Response = await request(app)
        .post('/api/activity-types')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({
          typeName: 'Sightseeing',
          description: 'Visit tourist attractions and landmarks',
          category: 'Cultural',
          defaultDuration: 180,
          isActive: true
        })
        .expect(201);

      const activityType2Response = await request(app)
        .post('/api/activity-types')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({
          typeName: 'Adventure Sports',
          description: 'Outdoor adventure activities',
          category: 'Adventure',
          defaultDuration: 240,
          isActive: true
        })
        .expect(201);

      // Verify activity types were created
      const activityTypesResponse = await request(app)
        .get('/api/activity-types')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(200);

      expect(activityTypesResponse.body.activityTypes.length).toBeGreaterThanOrEqual(2);
      expect(activityTypesResponse.body.activityTypes.some((at: any) => at.typeName === 'Sightseeing')).toBe(true);
      expect(activityTypesResponse.body.activityTypes.some((at: any) => at.typeName === 'Adventure Sports')).toBe(true);

      // Update activity type
      const updatedActivityTypeResponse = await request(app)
        .put(`/api/activity-types/${activityType1Response.body.activityTypeId}`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({
          description: 'Updated sightseeing description'
        })
        .expect(200);

      expect(updatedActivityTypeResponse.body.description).toBe('Updated sightseeing description');

      // Delete activity type
      await request(app)
        .delete(`/api/activity-types/${activityType2Response.body.activityTypeId}`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(200);

      // Verify deletion
      const remainingActivityTypesResponse = await request(app)
        .get('/api/activity-types')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(200);

      expect(remainingActivityTypesResponse.body.activityTypes.some((at: any) => at.typeName === 'Adventure Sports')).toBe(false);
    });

    it('should handle system admin monitoring and health checks', async () => {
      // Check system health
      const healthResponse = await request(app)
        .get('/health')
        .expect(200);

      expect(healthResponse.body.status).toBe('healthy');

      // Check database health
      const dbHealthResponse = await request(app)
        .get('/health/database')
        .expect(200);

      expect(dbHealthResponse.body.database).toBe('connected');

      // Check API documentation health
      const docsHealthResponse = await request(app)
        .get('/api-docs/health')
        .expect(200);

      expect(docsHealthResponse.body.status).toBe('healthy');

      // Get system version information
      const versionResponse = await request(app)
        .get('/api/version')
        .expect(200);

      expect(versionResponse.body.version).toBeDefined();
      expect(versionResponse.body.apiVersion).toBeDefined();

      // Get detailed version information
      const detailedVersionResponse = await request(app)
        .get('/api/version/detailed')
        .expect(200);

      expect(detailedVersionResponse.body.version).toBeDefined();
      expect(detailedVersionResponse.body.dependencies).toBeDefined();
    });
  });
});