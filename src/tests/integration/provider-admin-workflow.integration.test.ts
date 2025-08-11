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

describe('Provider Admin End-to-End Workflow Integration Tests', () => {
  let prisma: PrismaClient;
  let authService: AuthService;
  let userService: UserService;
  let providerService: ProviderService;
  let tourTemplateService: TourTemplateService;
  let systemAdminToken: string;
  let providerAdminToken: string;
  let providerId: string;
  let providerAdminId: string;
  let templateId: string;

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

    const systemAdminLogin = await authService.login('sysadmin@test.com', 'SecurePass123!');
    systemAdminToken = systemAdminLogin.accessToken;

    // Create provider
    const provider = await providerService.createProvider({
      companyName: 'Test Travel Agency',
      country: 'US',
      addressLine1: '123 Travel St',
      city: 'Travel City',
      stateRegion: 'Travel State',
      companyDescription: 'A test travel agency',
      phoneNumber: '+1234567891',
      emailAddress: 'contact@testtravelagency.com',
      corpIdTaxId: 'TRAVEL123456'
    });
    providerId = provider.providerId;

    // Create provider admin
    const providerAdmin = await userService.createUser({
      firstName: 'Provider',
      lastName: 'Admin',
      emailAddress: 'admin@testtravelagency.com',
      phoneNumber: '+1234567892',
      country: 'US',
      password: 'SecurePass123!',
      userType: UserType.PROVIDER_ADMIN,
      providerId: providerId
    });
    providerAdminId = providerAdmin.userId;

    const providerAdminLogin = await authService.login('admin@testtravelagency.com', 'SecurePass123!');
    providerAdminToken = providerAdminLogin.accessToken;

    // Create tour template
    const template = await tourTemplateService.createTourTemplate({
      templateName: 'Cultural Heritage Tour',
      type: 'Cultural',
      year: 2024,
      startDate: new Date('2024-08-01'),
      endDate: new Date('2024-08-15'),
      detailedDescription: 'A comprehensive cultural heritage tour',
      sitesToVisit: [
        {
          siteName: 'Historic Museum',
          location: 'City Center',
          visitDuration: 180,
          category: 'Cultural',
          orderIndex: 1,
          estimatedCost: 30.00,
          description: 'Visit the historic museum'
        }
      ]
    });
    templateId = template.templateId;
  });

  afterAll(async () => {
    await cleanupTestDatabase(prisma);
  });

  beforeEach(async () => {
    // Clean up test data between tests
    await prisma.customTourEvent.deleteMany({
      where: { providerId: providerId }
    });
    await prisma.user.deleteMany({
      where: { 
        providerId: providerId,
        userId: { not: providerAdminId }
      }
    });
  });

  describe('Complete Provider Admin Workflow', () => {
    it('should complete full provider admin tour management workflow', async () => {
      // Step 1: Create tourists for the provider
      const tourist1Response = await request(app)
        .post('/api/auth/register')
        .send({
          firstName: 'Alice',
          lastName: 'Tourist',
          emailAddress: 'alice@test.com',
          phoneNumber: '+1234567893',
          country: 'US',
          password: 'SecurePass123!',
          userType: UserType.TOURIST,
          providerId: providerId,
          passportNumber: 'P123456789',
          dateOfBirth: '1985-05-15',
          gender: 'Female'
        })
        .expect(201);

      const tourist1Id = tourist1Response.body.user.userId;

      const tourist2Response = await request(app)
        .post('/api/auth/register')
        .send({
          firstName: 'Bob',
          lastName: 'Tourist',
          emailAddress: 'bob@test.com',
          phoneNumber: '+1234567894',
          country: 'US',
          password: 'SecurePass123!',
          userType: UserType.TOURIST,
          providerId: providerId,
          passportNumber: 'P987654321',
          dateOfBirth: '1990-10-20',
          gender: 'Male'
        })
        .expect(201);

      const tourist2Id = tourist2Response.body.user.userId;

      // Step 2: Create a custom tour event
      const tourEventResponse = await request(app)
        .post('/api/tour-events')
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send({
          templateId: templateId,
          customTourName: 'Summer Cultural Heritage Tour 2024',
          startDate: '2024-08-01',
          endDate: '2024-08-15',
          packageType: 'Premium',
          place1Hotel: 'Grand Heritage Hotel',
          place2Hotel: 'Cultural Palace Hotel',
          numberOfAllowedTourists: 10,
          groupChatInfo: 'WhatsApp group will be created'
        })
        .expect(201);

      const tourEventId = tourEventResponse.body.tourEventId;
      expect(tourEventResponse.body.customTourName).toBe('Summer Cultural Heritage Tour 2024');
      expect(tourEventResponse.body.status).toBe(TourEventStatus.ACTIVE);

      // Step 3: Login tourists and register for tour
      const tourist1Login = await authService.login('alice@test.com', 'SecurePass123!');
      const tourist1Token = tourist1Login.accessToken;

      const tourist2Login = await authService.login('bob@test.com', 'SecurePass123!');
      const tourist2Token = tourist2Login.accessToken;

      // Tourist 1 registers
      await request(app)
        .post(`/api/tour-events/${tourEventId}/register`)
        .set('Authorization', `Bearer ${tourist1Token}`)
        .expect(201);

      // Tourist 2 registers
      await request(app)
        .post(`/api/tour-events/${tourEventId}/register`)
        .set('Authorization', `Bearer ${tourist2Token}`)
        .expect(201);

      // Step 4: Provider admin reviews registrations
      const registrationsResponse = await request(app)
        .get(`/api/tour-events/${tourEventId}/registrations`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(200);

      expect(registrationsResponse.body.registrations).toHaveLength(2);
      const registration1 = registrationsResponse.body.registrations.find((r: any) => r.userId === tourist1Id);
      const registration2 = registrationsResponse.body.registrations.find((r: any) => r.userId === tourist2Id);

      // Step 5: Approve registrations
      await request(app)
        .put(`/api/tour-events/${tourEventId}/registrations/${registration1.registrationId}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send({
          approved: true
        })
        .expect(200);

      await request(app)
        .put(`/api/tour-events/${tourEventId}/registrations/${registration2.registrationId}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send({
          approved: true
        })
        .expect(200);

      // Step 6: Create daily schedule activities
      const activity1Response = await request(app)
        .post(`/api/tour-events/${tourEventId}/activities`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send({
          activityName: 'Museum Visit',
          activityType: 'Sightseeing',
          startTime: '09:00',
          endTime: '12:00',
          location: 'Historic Museum',
          description: 'Guided tour of the historic museum',
          activityDate: '2024-08-02',
          isOptional: false
        })
        .expect(201);

      const activity2Response = await request(app)
        .post(`/api/tour-events/${tourEventId}/activities`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send({
          activityName: 'Cultural Workshop',
          activityType: 'Workshop',
          startTime: '14:00',
          endTime: '17:00',
          location: 'Cultural Center',
          description: 'Hands-on cultural workshop',
          activityDate: '2024-08-02',
          isOptional: true,
          webLink: 'https://culturalcenter.com/workshop'
        })
        .expect(201);

      // Step 7: View complete schedule
      const scheduleResponse = await request(app)
        .get(`/api/tour-events/${tourEventId}/schedule`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(200);

      expect(scheduleResponse.body.activities).toHaveLength(2);
      expect(scheduleResponse.body.activities.some((a: any) => a.activityName === 'Museum Visit')).toBe(true);
      expect(scheduleResponse.body.activities.some((a: any) => a.activityName === 'Cultural Workshop')).toBe(true);

      // Step 8: Update tour event details
      const updatedTourResponse = await request(app)
        .put(`/api/tour-events/${tourEventId}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send({
          groupChatInfo: 'WhatsApp group created: +1234567890'
        })
        .expect(200);

      expect(updatedTourResponse.body.groupChatInfo).toBe('WhatsApp group created: +1234567890');

      // Step 9: Verify capacity management
      const capacityResponse = await request(app)
        .get(`/api/tour-events/${tourEventId}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(200);

      expect(capacityResponse.body.numberOfAllowedTourists).toBe(10);
      expect(capacityResponse.body.remainingTourists).toBe(8); // 10 - 2 approved registrations
    });

    it('should handle provider admin user management within company', async () => {
      // Create tourists for the provider
      const tourists = [];
      for (let i = 0; i < 3; i++) {
        const touristResponse = await request(app)
          .post('/api/auth/register')
          .send({
            firstName: `Tourist${i}`,
            lastName: 'Test',
            emailAddress: `tourist${i}@test.com`,
            phoneNumber: `+123456789${i}`,
            country: 'US',
            password: 'SecurePass123!',
            userType: UserType.TOURIST,
            providerId: providerId,
            passportNumber: `P12345678${i}`,
            dateOfBirth: '1990-01-01',
            gender: 'Male'
          })
          .expect(201);

        tourists.push(touristResponse.body.user);
      }

      // Provider admin should see only company users
      const companyUsersResponse = await request(app)
        .get(`/api/providers/${providerId}/users`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(200);

      expect(companyUsersResponse.body.users).toHaveLength(4); // 3 tourists + provider admin
      expect(companyUsersResponse.body.users.every((u: any) => u.providerId === providerId)).toBe(true);

      // Provider admin can view individual user details
      const userDetailResponse = await request(app)
        .get(`/api/users/${tourists[0].userId}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(200);

      expect(userDetailResponse.body.userId).toBe(tourists[0].userId);
      expect(userDetailResponse.body.firstName).toBe('Tourist0');

      // Provider admin cannot access users from other providers
      // This would be tested if we had another provider, but we'll verify the isolation
      const allUsersResponse = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(403); // Should be forbidden for provider admin
    });

    it('should handle provider admin tour event management and registration approval', async () => {
      // Create a tourist
      const touristResponse = await request(app)
        .post('/api/auth/register')
        .send({
          firstName: 'Test',
          lastName: 'Tourist',
          emailAddress: 'testtourist@test.com',
          phoneNumber: '+1234567895',
          country: 'US',
          password: 'SecurePass123!',
          userType: UserType.TOURIST,
          providerId: providerId,
          passportNumber: 'P555666777',
          dateOfBirth: '1988-03-15',
          gender: 'Female'
        })
        .expect(201);

      const touristId = touristResponse.body.user.userId;
      const touristLogin = await authService.login('testtourist@test.com', 'SecurePass123!');
      const touristToken = touristLogin.accessToken;

      // Create tour event with limited capacity
      const tourEventResponse = await request(app)
        .post('/api/tour-events')
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send({
          templateId: templateId,
          customTourName: 'Limited Capacity Tour',
          startDate: '2024-09-01',
          endDate: '2024-09-10',
          packageType: 'Standard',
          place1Hotel: 'Standard Hotel',
          place2Hotel: 'Budget Hotel',
          numberOfAllowedTourists: 1, // Very limited capacity
          groupChatInfo: 'Small group tour'
        })
        .expect(201);

      const tourEventId = tourEventResponse.body.tourEventId;

      // Tourist registers
      await request(app)
        .post(`/api/tour-events/${tourEventId}/register`)
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(201);

      // Provider admin gets registrations
      const registrationsResponse = await request(app)
        .get(`/api/tour-events/${tourEventId}/registrations`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(200);

      const registration = registrationsResponse.body.registrations[0];

      // Approve registration
      await request(app)
        .put(`/api/tour-events/${tourEventId}/registrations/${registration.registrationId}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send({
          approved: true
        })
        .expect(200);

      // Check tour event status - should be FULL
      const tourEventStatusResponse = await request(app)
        .get(`/api/tour-events/${tourEventId}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(200);

      expect(tourEventStatusResponse.body.status).toBe(TourEventStatus.FULL);
      expect(tourEventStatusResponse.body.remainingTourists).toBe(0);

      // Try to reject the registration (should update capacity)
      await request(app)
        .put(`/api/tour-events/${tourEventId}/registrations/${registration.registrationId}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send({
          approved: false,
          rejectedReason: 'Tour cancelled due to weather'
        })
        .expect(200);

      // Check tour event status - should be ACTIVE again
      const updatedTourEventResponse = await request(app)
        .get(`/api/tour-events/${tourEventId}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(200);

      expect(updatedTourEventResponse.body.status).toBe(TourEventStatus.ACTIVE);
      expect(updatedTourEventResponse.body.remainingTourists).toBe(1);
    });
  });
});