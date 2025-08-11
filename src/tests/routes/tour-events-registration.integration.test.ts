import request from 'supertest';
import { app } from '../../app';
import { PrismaClient } from '../../generated/prisma';
import { setupTestDatabase, cleanupTestDatabase } from '../../utils/test-db-setup';
import { UserType, UserStatus } from '../../types/user';
import { TourEventStatus, RegistrationStatus } from '../../types/custom-tour-event';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

describe('Tour Events Registration Integration Tests', () => {
  let systemAdminToken: string;
  let providerAdminToken: string;
  let touristToken: string;
  let tourist2Token: string;
  let providerId: string;
  let tourEventId: string;
  let systemAdminId: string;
  let providerAdminId: string;
  let touristId: string;
  let tourist2Id: string;

  beforeAll(async () => {
    await setupTestDatabase();

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
        status: UserStatus.ACTIVE
      }
    });
    systemAdminId = systemAdmin.userId;

    // Create provider
    const provider = await prisma.provider.create({
      data: {
        companyName: 'Test Tours',
        country: 'USA',
        addressLine1: '123 Main St',
        city: 'Test City',
        stateRegion: 'Test State',
        companyDescription: 'Test tour company',
        phoneNumber: '+1234567890',
        emailAddress: 'provider@test.com',
        corpIdTaxId: 'TEST123'
      }
    });
    providerId = provider.providerId;

    const providerAdmin = await prisma.user.create({
      data: {
        firstName: 'Provider',
        lastName: 'Admin',
        emailAddress: 'provideradmin@test.com',
        phoneNumber: '+1234567891',
        country: 'USA',
        passwordHash: 'hashedpassword',
        userType: UserType.PROVIDER_ADMIN,
        status: UserStatus.ACTIVE,
        providerId
      }
    });
    providerAdminId = providerAdmin.userId;

    const tourist = await prisma.user.create({
      data: {
        firstName: 'John',
        lastName: 'Tourist',
        emailAddress: 'tourist@test.com',
        phoneNumber: '+1234567892',
        country: 'USA',
        passwordHash: 'hashedpassword',
        userType: UserType.TOURIST,
        status: UserStatus.ACTIVE,
        providerId
      }
    });
    touristId = tourist.userId;

    const tourist2 = await prisma.user.create({
      data: {
        firstName: 'Jane',
        lastName: 'Tourist',
        emailAddress: 'tourist2@test.com',
        phoneNumber: '+1234567893',
        country: 'USA',
        passwordHash: 'hashedpassword',
        userType: UserType.TOURIST,
        status: UserStatus.ACTIVE,
        providerId
      }
    });
    tourist2Id = tourist2.userId;

    // Create tour event
    const tourEvent = await prisma.customTourEvent.create({
      data: {
        providerId,
        customTourName: 'Test Tour Event',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-07'),
        packageType: 'Premium',
        place1Hotel: 'Hotel A',
        place2Hotel: 'Hotel B',
        numberOfAllowedTourists: 2,
        remainingTourists: 2,
        status: TourEventStatus.ACTIVE
      }
    });
    tourEventId = tourEvent.tourEventId;

    // Generate JWT tokens
    const jwtSecret = process.env.JWT_SECRET || 'test-secret';
    
    systemAdminToken = jwt.sign(
      { 
        sub: systemAdminId, 
        email: 'sysadmin@test.com', 
        role: UserType.SYSTEM_ADMIN 
      },
      jwtSecret,
      { expiresIn: '1h' }
    );

    providerAdminToken = jwt.sign(
      { 
        sub: providerAdminId, 
        email: 'provideradmin@test.com', 
        role: UserType.PROVIDER_ADMIN,
        providerId 
      },
      jwtSecret,
      { expiresIn: '1h' }
    );

    touristToken = jwt.sign(
      { 
        sub: touristId, 
        email: 'tourist@test.com', 
        role: UserType.TOURIST,
        providerId 
      },
      jwtSecret,
      { expiresIn: '1h' }
    );

    tourist2Token = jwt.sign(
      { 
        sub: tourist2Id, 
        email: 'tourist2@test.com', 
        role: UserType.TOURIST,
        providerId 
      },
      jwtSecret,
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    await cleanupTestDatabase();
    await prisma.$disconnect();
  });

  describe('POST /api/tour-events/:id/register', () => {
    it('should allow tourist to register for tour event', async () => {
      const response = await request(app)
        .post(`/api/tour-events/${tourEventId}/register`)
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(201);

      expect(response.body.message).toBe('Registration submitted successfully');
      expect(response.body.data.registration).toMatchObject({
        tourEventId,
        touristUserId: touristId,
        status: RegistrationStatus.PENDING
      });
    });

    it('should prevent duplicate registration', async () => {
      const response = await request(app)
        .post(`/api/tour-events/${tourEventId}/register`)
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(409);

      expect(response.body.error.code).toBe('ALREADY_REGISTERED');
    });

    it('should prevent non-tourist from registering', async () => {
      const response = await request(app)
        .post(`/api/tour-events/${tourEventId}/register`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(403);

      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should prevent registration for non-existent tour event', async () => {
      const response = await request(app)
        .post('/api/tour-events/non-existent-id/register')
        .set('Authorization', `Bearer ${tourist2Token}`)
        .expect(404);

      expect(response.body.error.code).toBe('TOUR_EVENT_NOT_FOUND');
    });

    it('should prevent registration for draft tour event', async () => {
      // Create draft tour event
      const draftEvent = await prisma.customTourEvent.create({
        data: {
          providerId,
          customTourName: 'Draft Tour Event',
          startDate: new Date('2025-07-01'),
          endDate: new Date('2025-07-07'),
          packageType: 'Standard',
          place1Hotel: 'Hotel C',
          place2Hotel: 'Hotel D',
          numberOfAllowedTourists: 5,
          remainingTourists: 5,
          status: TourEventStatus.DRAFT
        }
      });

      const response = await request(app)
        .post(`/api/tour-events/${draftEvent.tourEventId}/register`)
        .set('Authorization', `Bearer ${tourist2Token}`)
        .expect(422);

      expect(response.body.error.code).toBe('TOUR_EVENT_NOT_AVAILABLE');
    });

    it('should prevent overlapping registrations', async () => {
      // Create overlapping tour event
      const overlappingEvent = await prisma.customTourEvent.create({
        data: {
          providerId,
          customTourName: 'Overlapping Tour Event',
          startDate: new Date('2025-06-03'), // Overlaps with existing registration
          endDate: new Date('2025-06-10'),
          packageType: 'Standard',
          place1Hotel: 'Hotel E',
          place2Hotel: 'Hotel F',
          numberOfAllowedTourists: 5,
          remainingTourists: 5,
          status: TourEventStatus.ACTIVE
        }
      });

      const response = await request(app)
        .post(`/api/tour-events/${overlappingEvent.tourEventId}/register`)
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(409);

      expect(response.body.error.code).toBe('OVERLAPPING_REGISTRATION');
    });
  });

  describe('GET /api/tour-events/:id/registrations', () => {
    it('should allow provider admin to view registrations', async () => {
      const response = await request(app)
        .get(`/api/tour-events/${tourEventId}/registrations`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(200);

      expect(response.body.message).toBe('Registrations retrieved successfully');
      expect(response.body.data.registrations).toHaveLength(1);
      expect(response.body.data.registrations[0]).toMatchObject({
        tourEventId,
        touristUserId: touristId,
        status: RegistrationStatus.PENDING
      });
    });

    it('should filter registrations by status', async () => {
      const response = await request(app)
        .get(`/api/tour-events/${tourEventId}/registrations?status=PENDING`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(200);

      expect(response.body.data.registrations).toHaveLength(1);
      expect(response.body.data.registrations[0].status).toBe(RegistrationStatus.PENDING);
    });

    it('should prevent tourist from viewing registrations', async () => {
      const response = await request(app)
        .get(`/api/tour-events/${tourEventId}/registrations`)
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(403);

      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should prevent provider admin from viewing other provider registrations', async () => {
      // Create another provider and tour event
      const otherProvider = await prisma.provider.create({
        data: {
          companyName: 'Other Tours',
          country: 'USA',
          addressLine1: '456 Other St',
          city: 'Other City',
          stateRegion: 'Other State',
          companyDescription: 'Other tour company',
          phoneNumber: '+1234567894',
          emailAddress: 'other@test.com',
          corpIdTaxId: 'OTHER123'
        }
      });

      const otherTourEvent = await prisma.customTourEvent.create({
        data: {
          providerId: otherProvider.providerId,
          customTourName: 'Other Tour Event',
          startDate: new Date('2025-08-01'),
          endDate: new Date('2025-08-07'),
          packageType: 'Standard',
          place1Hotel: 'Hotel G',
          place2Hotel: 'Hotel H',
          numberOfAllowedTourists: 5,
          remainingTourists: 5,
          status: TourEventStatus.ACTIVE
        }
      });

      const response = await request(app)
        .get(`/api/tour-events/${otherTourEvent.tourEventId}/registrations`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(403);

      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });
  });

  describe('PUT /api/tour-events/:id/registrations/:userId', () => {
    let registrationId: string;

    beforeAll(async () => {
      // Get the registration ID for testing
      const registration = await prisma.touristRegistration.findFirst({
        where: {
          tourEventId,
          touristUserId: touristId
        }
      });
      registrationId = registration!.registrationId;
    });

    it('should allow provider admin to approve registration', async () => {
      const response = await request(app)
        .put(`/api/tour-events/${tourEventId}/registrations/${touristId}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send({
          approved: true
        })
        .expect(200);

      expect(response.body.message).toBe('Registration approved successfully');
      expect(response.body.data.registration.status).toBe(RegistrationStatus.APPROVED);

      // Verify remaining tourists count decreased
      const updatedEvent = await prisma.customTourEvent.findUnique({
        where: { tourEventId }
      });
      expect(updatedEvent!.remainingTourists).toBe(1);
    });

    it('should allow second tourist to register after first approval', async () => {
      const response = await request(app)
        .post(`/api/tour-events/${tourEventId}/register`)
        .set('Authorization', `Bearer ${tourist2Token}`)
        .expect(201);

      expect(response.body.data.registration.status).toBe(RegistrationStatus.PENDING);
    });

    it('should allow provider admin to reject registration with reason', async () => {
      const response = await request(app)
        .put(`/api/tour-events/${tourEventId}/registrations/${tourist2Id}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send({
          approved: false,
          rejectedReason: 'Tour is full'
        })
        .expect(200);

      expect(response.body.message).toBe('Registration rejected successfully');
      expect(response.body.data.registration.status).toBe(RegistrationStatus.REJECTED);
      expect(response.body.data.registration.rejectedReason).toBe('Tour is full');
    });

    it('should require rejection reason when rejecting', async () => {
      // Create another registration to test
      const tourist3 = await prisma.user.create({
        data: {
          firstName: 'Bob',
          lastName: 'Tourist',
          emailAddress: 'tourist3@test.com',
          phoneNumber: '+1234567895',
          country: 'USA',
          passwordHash: 'hashedpassword',
          userType: UserType.TOURIST,
          status: UserStatus.ACTIVE,
          providerId
        }
      });

      const tourist3Token = jwt.sign(
        { 
          sub: tourist3.userId, 
          email: 'tourist3@test.com', 
          role: UserType.TOURIST,
          providerId 
        },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );

      // Create another tour event for this test
      const testEvent = await prisma.customTourEvent.create({
        data: {
          providerId,
          customTourName: 'Test Rejection Event',
          startDate: new Date('2025-09-01'),
          endDate: new Date('2025-09-07'),
          packageType: 'Standard',
          place1Hotel: 'Hotel I',
          place2Hotel: 'Hotel J',
          numberOfAllowedTourists: 5,
          remainingTourists: 5,
          status: TourEventStatus.ACTIVE
        }
      });

      // Register tourist
      await request(app)
        .post(`/api/tour-events/${testEvent.tourEventId}/register`)
        .set('Authorization', `Bearer ${tourist3Token}`)
        .expect(201);

      // Try to reject without reason
      const response = await request(app)
        .put(`/api/tour-events/${testEvent.tourEventId}/registrations/${tourist3.userId}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send({
          approved: false
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should prevent tourist from processing registrations', async () => {
      const response = await request(app)
        .put(`/api/tour-events/${tourEventId}/registrations/${touristId}`)
        .set('Authorization', `Bearer ${touristToken}`)
        .send({
          approved: true
        })
        .expect(403);

      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should prevent processing non-existent registration', async () => {
      const response = await request(app)
        .put(`/api/tour-events/${tourEventId}/registrations/non-existent-user`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send({
          approved: true
        })
        .expect(404);

      expect(response.body.error.code).toBe('REGISTRATION_NOT_FOUND');
    });

    it('should prevent processing already processed registration', async () => {
      const response = await request(app)
        .put(`/api/tour-events/${tourEventId}/registrations/${touristId}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send({
          approved: false,
          rejectedReason: 'Already processed'
        })
        .expect(422);

      expect(response.body.error.code).toBe('REGISTRATION_ALREADY_PROCESSED');
    });
  });

  describe('Tour Event Capacity Management', () => {
    it('should prevent registration when tour is full', async () => {
      // Create a tour event with capacity 1
      const fullEvent = await prisma.customTourEvent.create({
        data: {
          providerId,
          customTourName: 'Full Tour Event',
          startDate: new Date('2025-10-01'),
          endDate: new Date('2025-10-07'),
          packageType: 'Standard',
          place1Hotel: 'Hotel K',
          place2Hotel: 'Hotel L',
          numberOfAllowedTourists: 1,
          remainingTourists: 1,
          status: TourEventStatus.ACTIVE
        }
      });

      // Create a new tourist for this test
      const tourist4 = await prisma.user.create({
        data: {
          firstName: 'Alice',
          lastName: 'Tourist',
          emailAddress: 'tourist4@test.com',
          phoneNumber: '+1234567896',
          country: 'USA',
          passwordHash: 'hashedpassword',
          userType: UserType.TOURIST,
          status: UserStatus.ACTIVE,
          providerId
        }
      });

      const tourist4Token = jwt.sign(
        { 
          sub: tourist4.userId, 
          email: 'tourist4@test.com', 
          role: UserType.TOURIST,
          providerId 
        },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );

      // Register and approve first tourist
      await request(app)
        .post(`/api/tour-events/${fullEvent.tourEventId}/register`)
        .set('Authorization', `Bearer ${tourist4Token}`)
        .expect(201);

      await request(app)
        .put(`/api/tour-events/${fullEvent.tourEventId}/registrations/${tourist4.userId}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send({ approved: true })
        .expect(200);

      // Verify tour event status changed to FULL
      const updatedEvent = await prisma.customTourEvent.findUnique({
        where: { tourEventId: fullEvent.tourEventId }
      });
      expect(updatedEvent!.status).toBe(TourEventStatus.FULL);
      expect(updatedEvent!.remainingTourists).toBe(0);

      // Try to register another tourist - should fail
      const tourist5 = await prisma.user.create({
        data: {
          firstName: 'Charlie',
          lastName: 'Tourist',
          emailAddress: 'tourist5@test.com',
          phoneNumber: '+1234567897',
          country: 'USA',
          passwordHash: 'hashedpassword',
          userType: UserType.TOURIST,
          status: UserStatus.ACTIVE,
          providerId
        }
      });

      const tourist5Token = jwt.sign(
        { 
          sub: tourist5.userId, 
          email: 'tourist5@test.com', 
          role: UserType.TOURIST,
          providerId 
        },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .post(`/api/tour-events/${fullEvent.tourEventId}/register`)
        .set('Authorization', `Bearer ${tourist5Token}`)
        .expect(422);

      expect(response.body.error.code).toBe('TOUR_EVENT_FULL');
    });
  });
});