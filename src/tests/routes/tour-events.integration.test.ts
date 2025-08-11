import request from 'supertest';
import { PrismaClient } from '../../generated/prisma';
import app from '../../app';
import { setupTestDatabase, cleanupTestDatabase } from '../../utils/test-db-setup';
import { AuthService } from '../../services/auth';
import { UserType } from '../../types/user';
import { TourEventStatus } from '../../types/custom-tour-event';

describe('Tour Events Integration Tests', () => {
  let prisma: PrismaClient;
  let authService: AuthService;
  let systemAdminToken: string;
  let providerAdminToken: string;
  let touristToken: string;
  let providerId: string;
  let tourTemplateId: string;
  let tourEventId: string;

  beforeAll(async () => {
    prisma = await setupTestDatabase();
    authService = new AuthService(prisma);

    // Create test provider
    const provider = await prisma.provider.create({
      data: {
        companyName: 'Test Tour Company',
        country: 'USA',
        addressLine1: '123 Test St',
        city: 'Test City',
        stateRegion: 'Test State',
        companyDescription: 'Test company for tour events',
        phoneNumber: '+1234567890',
        emailAddress: 'test@company.com',
        corpIdTaxId: 'TEST123456',
        isIsolatedInstance: true
      }
    });
    providerId = provider.providerId;

    // Create test users
    const systemAdmin = await prisma.user.create({
      data: {
        firstName: 'System',
        lastName: 'Admin',
        emailAddress: 'sysadmin@test.com',
        phoneNumber: '+1234567890',
        country: 'USA',
        passwordHash: 'hashedpassword',
        userType: UserType.SYSTEM_ADMIN,
        status: 'ACTIVE'
      }
    });

    const providerAdmin = await prisma.user.create({
      data: {
        firstName: 'Provider',
        lastName: 'Admin',
        emailAddress: 'provideradmin@test.com',
        phoneNumber: '+1234567891',
        country: 'USA',
        passwordHash: 'hashedpassword',
        userType: UserType.PROVIDER_ADMIN,
        status: 'ACTIVE',
        providerId: providerId
      }
    });

    const tourist = await prisma.user.create({
      data: {
        firstName: 'Test',
        lastName: 'Tourist',
        emailAddress: 'tourist@test.com',
        phoneNumber: '+1234567892',
        country: 'USA',
        passwordHash: 'hashedpassword',
        userType: UserType.TOURIST,
        status: 'ACTIVE',
        providerId: providerId
      }
    });

    // Generate tokens
    systemAdminToken = authService.generateAccessToken({
      userId: systemAdmin.userId,
      email: systemAdmin.emailAddress,
      role: systemAdmin.userType,
      providerId: undefined
    });

    providerAdminToken = authService.generateAccessToken({
      userId: providerAdmin.userId,
      email: providerAdmin.emailAddress,
      role: providerAdmin.userType,
      providerId: providerId
    });

    touristToken = authService.generateAccessToken({
      userId: tourist.userId,
      email: tourist.emailAddress,
      role: tourist.userType,
      providerId: providerId
    });

    // Create test tour template
    const tourTemplate = await prisma.tourTemplate.create({
      data: {
        templateName: 'Test Tour Template',
        type: 'Cultural',
        year: 2024,
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-06-10'),
        detailedDescription: 'Test tour template for integration tests'
      }
    });
    tourTemplateId = tourTemplate.templateId;
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('POST /api/tour-events', () => {
    it('should create tour event as provider admin', async () => {
      const tourEventData = {
        templateId: tourTemplateId,
        customTourName: 'Amazing Cultural Tour',
        startDate: new Date('2024-07-01').toISOString(),
        endDate: new Date('2024-07-10').toISOString(),
        packageType: 'Premium',
        place1Hotel: 'Grand Hotel Mecca',
        place2Hotel: 'Luxury Hotel Medina',
        numberOfAllowedTourists: 50,
        groupChatInfo: 'WhatsApp group will be created'
      };

      const response = await request(app)
        .post('/api/tour-events')
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send(tourEventData)
        .expect(201);

      expect(response.body.message).toBe('Tour event created successfully');
      expect(response.body.data.tourEvent).toMatchObject({
        customTourName: tourEventData.customTourName,
        packageType: tourEventData.packageType,
        numberOfAllowedTourists: tourEventData.numberOfAllowedTourists,
        remainingTourists: tourEventData.numberOfAllowedTourists,
        status: TourEventStatus.DRAFT,
        providerId: providerId
      });

      tourEventId = response.body.data.tourEvent.tourEventId;
    });

    it('should reject tour event creation by tourist', async () => {
      const tourEventData = {
        customTourName: 'Unauthorized Tour',
        startDate: new Date('2024-08-01').toISOString(),
        endDate: new Date('2024-08-10').toISOString(),
        packageType: 'Basic',
        place1Hotel: 'Hotel A',
        place2Hotel: 'Hotel B',
        numberOfAllowedTourists: 30
      };

      await request(app)
        .post('/api/tour-events')
        .set('Authorization', `Bearer ${touristToken}`)
        .send(tourEventData)
        .expect(403);
    });

    it('should reject invalid tour event data', async () => {
      const invalidData = {
        customTourName: '', // Empty name
        startDate: new Date('2024-07-01').toISOString(),
        endDate: new Date('2024-06-01').toISOString(), // End before start
        packageType: 'Premium',
        place1Hotel: 'Hotel A',
        place2Hotel: 'Hotel B',
        numberOfAllowedTourists: -5 // Negative number
      };

      await request(app)
        .post('/api/tour-events')
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send(invalidData)
        .expect(400);
    });
  });

  describe('GET /api/tour-events', () => {
    it('should get tour events for provider admin', async () => {
      const response = await request(app)
        .get('/api/tour-events')
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(200);

      expect(response.body.message).toBe('Tour events retrieved successfully');
      expect(response.body.data.tourEvents).toBeInstanceOf(Array);
      expect(response.body.data.tourEvents.length).toBeGreaterThan(0);
      expect(response.body.data.pagination).toMatchObject({
        limit: 50,
        offset: 0
      });
    });

    it('should get tour events for system admin', async () => {
      const response = await request(app)
        .get('/api/tour-events')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(200);

      expect(response.body.message).toBe('Tour events retrieved successfully');
      expect(response.body.data.tourEvents).toBeInstanceOf(Array);
    });

    it('should filter tour events by status', async () => {
      const response = await request(app)
        .get('/api/tour-events?status=DRAFT')
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(200);

      expect(response.body.data.tourEvents).toBeInstanceOf(Array);
      response.body.data.tourEvents.forEach((event: any) => {
        expect(event.status).toBe(TourEventStatus.DRAFT);
      });
    });

    it('should apply pagination', async () => {
      const response = await request(app)
        .get('/api/tour-events?limit=10&offset=0')
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(200);

      expect(response.body.data.pagination).toMatchObject({
        limit: 10,
        offset: 0
      });
    });
  });

  describe('GET /api/tour-events/:id', () => {
    it('should get tour event by ID for provider admin', async () => {
      const response = await request(app)
        .get(`/api/tour-events/${tourEventId}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(200);

      expect(response.body.message).toBe('Tour event retrieved successfully');
      expect(response.body.data.tourEvent.tourEventId).toBe(tourEventId);
      expect(response.body.data.tourEvent.customTourName).toBe('Amazing Cultural Tour');
    });

    it('should get tour event by ID for system admin', async () => {
      const response = await request(app)
        .get(`/api/tour-events/${tourEventId}`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(200);

      expect(response.body.data.tourEvent.tourEventId).toBe(tourEventId);
    });

    it('should return 404 for non-existent tour event', async () => {
      await request(app)
        .get('/api/tour-events/non-existent-id')
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(404);
    });

    it('should reject access to tour event from different provider', async () => {
      // Create another provider and admin
      const otherProvider = await prisma.provider.create({
        data: {
          companyName: 'Other Tour Company',
          country: 'Canada',
          addressLine1: '456 Other St',
          city: 'Other City',
          stateRegion: 'Other State',
          companyDescription: 'Other test company',
          phoneNumber: '+1987654321',
          emailAddress: 'other@company.com',
          corpIdTaxId: 'OTHER123456',
          isIsolatedInstance: true
        }
      });

      const otherAdmin = await prisma.user.create({
        data: {
          firstName: 'Other',
          lastName: 'Admin',
          emailAddress: 'otheradmin@test.com',
          phoneNumber: '+1987654321',
          country: 'Canada',
          passwordHash: 'hashedpassword',
          userType: UserType.PROVIDER_ADMIN,
          status: 'ACTIVE',
          providerId: otherProvider.providerId
        }
      });

      const otherAdminToken = authService.generateAccessToken({
        userId: otherAdmin.userId,
        email: otherAdmin.emailAddress,
        role: otherAdmin.userType,
        providerId: otherProvider.providerId
      });

      await request(app)
        .get(`/api/tour-events/${tourEventId}`)
        .set('Authorization', `Bearer ${otherAdminToken}`)
        .expect(403);
    });
  });

  describe('PUT /api/tour-events/:id', () => {
    it('should update tour event as provider admin', async () => {
      const updateData = {
        customTourName: 'Updated Amazing Cultural Tour',
        packageType: 'Deluxe',
        numberOfAllowedTourists: 60,
        status: TourEventStatus.ACTIVE
      };

      const response = await request(app)
        .put(`/api/tour-events/${tourEventId}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.message).toBe('Tour event updated successfully');
      expect(response.body.data.tourEvent).toMatchObject({
        customTourName: updateData.customTourName,
        packageType: updateData.packageType,
        numberOfAllowedTourists: updateData.numberOfAllowedTourists,
        status: updateData.status
      });
    });

    it('should reject tour event update by tourist', async () => {
      const updateData = {
        customTourName: 'Unauthorized Update'
      };

      await request(app)
        .put(`/api/tour-events/${tourEventId}`)
        .set('Authorization', `Bearer ${touristToken}`)
        .send(updateData)
        .expect(403);
    });

    it('should return 404 for non-existent tour event', async () => {
      const updateData = {
        customTourName: 'Updated Name'
      };

      await request(app)
        .put('/api/tour-events/non-existent-id')
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send(updateData)
        .expect(404);
    });

    it('should reject invalid update data', async () => {
      const invalidData = {
        numberOfAllowedTourists: -10 // Negative number
      };

      await request(app)
        .put(`/api/tour-events/${tourEventId}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send(invalidData)
        .expect(400);
    });
  });

  describe('DELETE /api/tour-events/:id', () => {
    it('should reject tour event deletion by tourist', async () => {
      await request(app)
        .delete(`/api/tour-events/${tourEventId}`)
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(403);
    });

    it('should return 404 for non-existent tour event', async () => {
      await request(app)
        .delete('/api/tour-events/non-existent-id')
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(404);
    });

    it('should delete tour event as provider admin', async () => {
      const response = await request(app)
        .delete(`/api/tour-events/${tourEventId}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(200);

      expect(response.body.message).toBe('Tour event deleted successfully');

      // Verify tour event is deleted
      await request(app)
        .get(`/api/tour-events/${tourEventId}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(404);
    });
  });

  describe('Authentication and Authorization', () => {
    it('should reject requests without authentication', async () => {
      await request(app)
        .get('/api/tour-events')
        .expect(401);

      await request(app)
        .post('/api/tour-events')
        .send({})
        .expect(401);
    });

    it('should reject requests with invalid token', async () => {
      await request(app)
        .get('/api/tour-events')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });
});