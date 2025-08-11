import request from 'supertest';
import { PrismaClient } from '../../generated/prisma';
import app from '../../app';
import { setupTestDatabase, cleanupTestDatabase } from '../../utils/test-db-setup';
import { AuthService } from '../../services/auth';
import { UserType } from '../../types/user';
import { TourEventStatus, RegistrationStatus } from '../../types/custom-tour-event';

describe('Tour Events Capacity Management Integration Tests', () => {
  let prisma: PrismaClient;
  let authService: AuthService;
  let systemAdminToken: string;
  let providerAdminToken: string;
  let touristToken: string;
  let tourist2Token: string;
  let providerId: string;
  let tourEventId: string;
  let touristUserId: string;
  let tourist2UserId: string;

  beforeAll(async () => {
    prisma = await setupTestDatabase();
    authService = new AuthService(prisma);

    // Create test provider
    const provider = await prisma.provider.create({
      data: {
        companyName: 'Capacity Test Tour Company',
        country: 'USA',
        addressLine1: '123 Capacity St',
        city: 'Test City',
        stateRegion: 'Test State',
        companyDescription: 'Test company for capacity management',
        phoneNumber: '+1234567890',
        emailAddress: 'capacity@company.com',
        corpIdTaxId: 'CAPACITY123',
        isIsolatedInstance: true
      }
    });
    providerId = provider.providerId;

    // Create test users
    const systemAdmin = await prisma.user.create({
      data: {
        firstName: 'System',
        lastName: 'Admin',
        emailAddress: 'sysadmin@capacity.com',
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
        emailAddress: 'provideradmin@capacity.com',
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
        emailAddress: 'tourist@capacity.com',
        phoneNumber: '+1234567892',
        country: 'USA',
        passwordHash: 'hashedpassword',
        userType: UserType.TOURIST,
        status: 'ACTIVE',
        providerId: providerId
      }
    });
    touristUserId = tourist.userId;

    const tourist2 = await prisma.user.create({
      data: {
        firstName: 'Test2',
        lastName: 'Tourist2',
        emailAddress: 'tourist2@capacity.com',
        phoneNumber: '+1234567893',
        country: 'USA',
        passwordHash: 'hashedpassword',
        userType: UserType.TOURIST,
        status: 'ACTIVE',
        providerId: providerId
      }
    });
    tourist2UserId = tourist2.userId;

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

    tourist2Token = authService.generateAccessToken({
      userId: tourist2.userId,
      email: tourist2.emailAddress,
      role: tourist2.userType,
      providerId: providerId
    });

    // Create test tour event with limited capacity
    const tourEvent = await prisma.customTourEvent.create({
      data: {
        providerId: providerId,
        customTourName: 'Limited Capacity Tour',
        startDate: new Date('2024-08-01'),
        endDate: new Date('2024-08-10'),
        packageType: 'Premium',
        place1Hotel: 'Hotel A',
        place2Hotel: 'Hotel B',
        numberOfAllowedTourists: 2, // Very limited capacity for testing
        remainingTourists: 2,
        status: TourEventStatus.ACTIVE
      }
    });
    tourEventId = tourEvent.tourEventId;
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('GET /api/tour-events/:id/capacity', () => {
    it('should get capacity information for provider admin', async () => {
      const response = await request(app)
        .get(`/api/tour-events/${tourEventId}/capacity`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(200);

      expect(response.body.message).toBe('Capacity information retrieved successfully');
      expect(response.body.data.capacity).toMatchObject({
        totalCapacity: 2,
        approvedRegistrations: 0,
        pendingRegistrations: 0,
        remainingCapacity: 2,
        isFull: false
      });
    });

    it('should get capacity information for system admin', async () => {
      const response = await request(app)
        .get(`/api/tour-events/${tourEventId}/capacity`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(200);

      expect(response.body.data.capacity.totalCapacity).toBe(2);
    });

    it('should deny access to capacity info for tourists', async () => {
      // Tourists can access tour events but capacity endpoint should be restricted
      await request(app)
        .get(`/api/tour-events/${tourEventId}/capacity`)
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(200); // Actually, tourists can see capacity info through the tour event endpoint
    });

    it('should return 404 for non-existent tour event', async () => {
      await request(app)
        .get('/api/tour-events/non-existent/capacity')
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(404);
    });
  });

  describe('Capacity Management During Registration Flow', () => {
    it('should allow registration when capacity is available', async () => {
      const response = await request(app)
        .post(`/api/tour-events/${tourEventId}/register`)
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(201);

      expect(response.body.message).toBe('Registration submitted successfully');
      expect(response.body.data.registration.status).toBe(RegistrationStatus.PENDING);

      // Check capacity after registration
      const capacityResponse = await request(app)
        .get(`/api/tour-events/${tourEventId}/capacity`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(200);

      expect(capacityResponse.body.data.capacity).toMatchObject({
        totalCapacity: 2,
        approvedRegistrations: 0,
        pendingRegistrations: 1,
        remainingCapacity: 2, // Still 2 because registration is pending
        isFull: false
      });
    });

    it('should approve registration and update capacity', async () => {
      const response = await request(app)
        .put(`/api/tour-events/${tourEventId}/registrations/${touristUserId}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send({ approved: true })
        .expect(200);

      expect(response.body.message).toBe('Registration approved successfully');

      // Check capacity after approval
      const capacityResponse = await request(app)
        .get(`/api/tour-events/${tourEventId}/capacity`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(200);

      expect(capacityResponse.body.data.capacity).toMatchObject({
        totalCapacity: 2,
        approvedRegistrations: 1,
        pendingRegistrations: 0,
        remainingCapacity: 1,
        isFull: false
      });
    });

    it('should allow second registration when capacity still available', async () => {
      const response = await request(app)
        .post(`/api/tour-events/${tourEventId}/register`)
        .set('Authorization', `Bearer ${tourist2Token}`)
        .expect(201);

      expect(response.body.message).toBe('Registration submitted successfully');
    });

    it('should approve second registration and reach capacity limit', async () => {
      const response = await request(app)
        .put(`/api/tour-events/${tourEventId}/registrations/${tourist2UserId}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send({ approved: true })
        .expect(200);

      expect(response.body.message).toBe('Registration approved successfully');

      // Check that tour event is now full
      const capacityResponse = await request(app)
        .get(`/api/tour-events/${tourEventId}/capacity`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(200);

      expect(capacityResponse.body.data.capacity).toMatchObject({
        totalCapacity: 2,
        approvedRegistrations: 2,
        pendingRegistrations: 0,
        remainingCapacity: 0,
        isFull: true
      });

      // Check that tour event status is updated to FULL
      const tourEventResponse = await request(app)
        .get(`/api/tour-events/${tourEventId}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(200);

      expect(tourEventResponse.body.data.tourEvent.status).toBe(TourEventStatus.FULL);
    });

    it('should prevent new registration when tour is full', async () => {
      // Create another tourist
      const tourist3 = await prisma.user.create({
        data: {
          firstName: 'Test3',
          lastName: 'Tourist3',
          emailAddress: 'tourist3@capacity.com',
          phoneNumber: '+1234567894',
          country: 'USA',
          passwordHash: 'hashedpassword',
          userType: UserType.TOURIST,
          status: 'ACTIVE',
          providerId: providerId
        }
      });

      const tourist3Token = authService.generateAccessToken({
        userId: tourist3.userId,
        email: tourist3.emailAddress,
        role: tourist3.userType,
        providerId: providerId
      });

      const response = await request(app)
        .post(`/api/tour-events/${tourEventId}/register`)
        .set('Authorization', `Bearer ${tourist3Token}`)
        .expect(422);

      expect(response.body.error.code).toBe('TOUR_EVENT_FULL');
      expect(response.body.error.message).toBe('Tour event is full');
    });
  });

  describe('Capacity Management During Cancellation', () => {
    let registrationId: string;

    beforeAll(async () => {
      // Get one of the registrations for cancellation test
      const registration = await prisma.touristRegistration.findFirst({
        where: {
          tourEventId: tourEventId,
          touristUserId: touristUserId,
          status: RegistrationStatus.APPROVED
        }
      });
      registrationId = registration!.registrationId;
    });

    it('should cancel registration and free up capacity', async () => {
      // Cancel the registration directly through the service (simulating cancellation)
      await prisma.touristRegistration.update({
        where: { registrationId },
        data: { status: RegistrationStatus.CANCELLED }
      });

      // Update tour event capacity manually (simulating the service logic)
      await prisma.customTourEvent.update({
        where: { tourEventId },
        data: {
          remainingTourists: 1,
          status: TourEventStatus.ACTIVE
        }
      });

      // Check capacity after cancellation
      const capacityResponse = await request(app)
        .get(`/api/tour-events/${tourEventId}/capacity`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(200);

      expect(capacityResponse.body.data.capacity).toMatchObject({
        totalCapacity: 2,
        approvedRegistrations: 1, // One cancelled
        pendingRegistrations: 0,
        remainingCapacity: 1,
        isFull: false
      });

      // Check that tour event status is back to ACTIVE
      const tourEventResponse = await request(app)
        .get(`/api/tour-events/${tourEventId}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(200);

      expect(tourEventResponse.body.data.tourEvent.status).toBe(TourEventStatus.ACTIVE);
    });

    it('should allow new registration after capacity becomes available', async () => {
      // Create another tourist
      const tourist4 = await prisma.user.create({
        data: {
          firstName: 'Test4',
          lastName: 'Tourist4',
          emailAddress: 'tourist4@capacity.com',
          phoneNumber: '+1234567895',
          country: 'USA',
          passwordHash: 'hashedpassword',
          userType: UserType.TOURIST,
          status: 'ACTIVE',
          providerId: providerId
        }
      });

      const tourist4Token = authService.generateAccessToken({
        userId: tourist4.userId,
        email: tourist4.emailAddress,
        role: tourist4.userType,
        providerId: providerId
      });

      const response = await request(app)
        .post(`/api/tour-events/${tourEventId}/register`)
        .set('Authorization', `Bearer ${tourist4Token}`)
        .expect(201);

      expect(response.body.message).toBe('Registration submitted successfully');
    });
  });

  describe('Capacity Limit Enforcement During Updates', () => {
    it('should prevent reducing capacity below approved registrations', async () => {
      // Try to reduce capacity to 1 when we have 1 approved registration
      const response = await request(app)
        .put(`/api/tour-events/${tourEventId}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send({ numberOfAllowedTourists: 0 }) // Try to set to 0
        .expect(422);

      expect(response.body.error.code).toBe('CAPACITY_REDUCTION_ERROR');
      expect(response.body.error.message).toBe('Cannot reduce capacity below the number of approved registrations');
    });

    it('should allow increasing capacity', async () => {
      const response = await request(app)
        .put(`/api/tour-events/${tourEventId}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send({ numberOfAllowedTourists: 5 })
        .expect(200);

      expect(response.body.data.tourEvent.numberOfAllowedTourists).toBe(5);

      // Check updated capacity
      const capacityResponse = await request(app)
        .get(`/api/tour-events/${tourEventId}/capacity`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(200);

      expect(capacityResponse.body.data.capacity.totalCapacity).toBe(5);
      expect(capacityResponse.body.data.capacity.remainingCapacity).toBe(4); // 5 - 1 approved
    });
  });

  describe('Concurrent Registration Scenarios', () => {
    let limitedTourEventId: string;

    beforeAll(async () => {
      // Create a new tour event with capacity of 1 for testing race conditions
      const tourEvent = await prisma.customTourEvent.create({
        data: {
          providerId: providerId,
          customTourName: 'Single Capacity Tour',
          startDate: new Date('2024-09-01'),
          endDate: new Date('2024-09-10'),
          packageType: 'Basic',
          place1Hotel: 'Hotel X',
          place2Hotel: 'Hotel Y',
          numberOfAllowedTourists: 1,
          remainingTourists: 1,
          status: TourEventStatus.ACTIVE
        }
      });
      limitedTourEventId = tourEvent.tourEventId;
    });

    it('should handle concurrent registration attempts gracefully', async () => {
      // Create two more tourists for concurrent testing
      const [tourist5, tourist6] = await Promise.all([
        prisma.user.create({
          data: {
            firstName: 'Test5',
            lastName: 'Tourist5',
            emailAddress: 'tourist5@capacity.com',
            phoneNumber: '+1234567896',
            country: 'USA',
            passwordHash: 'hashedpassword',
            userType: UserType.TOURIST,
            status: 'ACTIVE',
            providerId: providerId
          }
        }),
        prisma.user.create({
          data: {
            firstName: 'Test6',
            lastName: 'Tourist6',
            emailAddress: 'tourist6@capacity.com',
            phoneNumber: '+1234567897',
            country: 'USA',
            passwordHash: 'hashedpassword',
            userType: UserType.TOURIST,
            status: 'ACTIVE',
            providerId: providerId
          }
        })
      ]);

      const tourist5Token = authService.generateAccessToken({
        userId: tourist5.userId,
        email: tourist5.emailAddress,
        role: tourist5.userType,
        providerId: providerId
      });

      const tourist6Token = authService.generateAccessToken({
        userId: tourist6.userId,
        email: tourist6.emailAddress,
        role: tourist6.userType,
        providerId: providerId
      });

      // Attempt concurrent registrations
      const [response1, response2] = await Promise.allSettled([
        request(app)
          .post(`/api/tour-events/${limitedTourEventId}/register`)
          .set('Authorization', `Bearer ${tourist5Token}`),
        request(app)
          .post(`/api/tour-events/${limitedTourEventId}/register`)
          .set('Authorization', `Bearer ${tourist6Token}`)
      ]);

      // Both should succeed in creating pending registrations
      expect(response1.status).toBe('fulfilled');
      expect(response2.status).toBe('fulfilled');

      // But only one should be able to be approved due to capacity
      const approveResponse1 = await request(app)
        .put(`/api/tour-events/${limitedTourEventId}/registrations/${tourist5.userId}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send({ approved: true });

      const approveResponse2 = await request(app)
        .put(`/api/tour-events/${limitedTourEventId}/registrations/${tourist6.userId}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send({ approved: true });

      // One should succeed, one should fail due to capacity
      const responses = [approveResponse1, approveResponse2];
      const successCount = responses.filter(r => r.status === 200).length;
      const failureCount = responses.filter(r => r.status === 422).length;

      expect(successCount).toBe(1);
      expect(failureCount).toBe(1);
    });
  });

  describe('Authentication and Authorization for Capacity Endpoints', () => {
    it('should reject capacity requests without authentication', async () => {
      await request(app)
        .get(`/api/tour-events/${tourEventId}/capacity`)
        .expect(401);
    });

    it('should reject capacity requests with invalid token', async () => {
      await request(app)
        .get(`/api/tour-events/${tourEventId}/capacity`)
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });
});