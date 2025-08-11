import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import app from '../../app';
import { setupTestDatabase, cleanupTestDatabase } from '../../utils/test-db-setup';
import { AuthService } from '../../services/auth';
import { UserService } from '../../services/user';
import { ProviderService } from '../../services/provider';
import { TourTemplateService } from '../../services/tour-template';
import { CustomTourEventService } from '../../services/custom-tour-event';
import { UserType } from '../../types/user';
import { TourEventStatus, RegistrationStatus } from '../../types/custom-tour-event';

describe('Tourist End-to-End Workflow Integration Tests', () => {
  let prisma: PrismaClient;
  let authService: AuthService;
  let userService: UserService;
  let providerService: ProviderService;
  let tourTemplateService: TourTemplateService;
  let customTourEventService: CustomTourEventService;
  let touristToken: string;
  let touristId: string;
  let providerId: string;
  let providerAdminToken: string;
  let templateId: string;

  beforeAll(async () => {
    prisma = await setupTestDatabase();
    authService = new AuthService(prisma);
    userService = new UserService(prisma);
    providerService = new ProviderService(prisma);
    tourTemplateService = new TourTemplateService(prisma);
    customTourEventService = new CustomTourEventService(prisma);

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

    // Create provider
    const provider = await providerService.createProvider({
      companyName: 'Tourist Experience Co',
      country: 'US',
      addressLine1: '789 Experience Blvd',
      city: 'Tourist City',
      stateRegion: 'Tourist State',
      companyDescription: 'Providing amazing tourist experiences',
      phoneNumber: '+1234567891',
      emailAddress: 'contact@touristexp.com',
      corpIdTaxId: 'TOURIST123456'
    });
    providerId = provider.providerId;

    // Create provider admin
    const providerAdmin = await userService.createUser({
      firstName: 'Provider',
      lastName: 'Admin',
      emailAddress: 'admin@touristexp.com',
      phoneNumber: '+1234567892',
      country: 'US',
      password: 'SecurePass123!',
      userType: UserType.PROVIDER_ADMIN,
      providerId: providerId
    });

    const providerAdminLogin = await authService.login('admin@touristexp.com', 'SecurePass123!');
    providerAdminToken = providerAdminLogin.accessToken;

    // Create tourist
    const tourist = await userService.createUser({
      firstName: 'Jane',
      lastName: 'Tourist',
      emailAddress: 'jane@test.com',
      phoneNumber: '+1234567893',
      country: 'US',
      password: 'SecurePass123!',
      userType: UserType.TOURIST,
      providerId: providerId,
      passportNumber: 'P123456789',
      dateOfBirth: '1992-07-10',
      gender: 'Female'
    });
    touristId = tourist.userId;

    const touristLogin = await authService.login('jane@test.com', 'SecurePass123!');
    touristToken = touristLogin.accessToken;

    // Create tour template
    const template = await tourTemplateService.createTourTemplate({
      templateName: 'Adventure Discovery Tour',
      type: 'Adventure',
      year: 2024,
      startDate: new Date('2024-10-01'),
      endDate: new Date('2024-10-14'),
      detailedDescription: 'An exciting adventure discovery tour',
      sitesToVisit: [
        {
          siteName: 'Mountain Peak',
          location: 'Rocky Mountains',
          visitDuration: 360,
          category: 'Adventure',
          orderIndex: 1,
          estimatedCost: 75.00,
          description: 'Hiking to the mountain peak'
        },
        {
          siteName: 'Adventure Park',
          location: 'Adventure Valley',
          visitDuration: 240,
          category: 'Adventure',
          orderIndex: 2,
          estimatedCost: 50.00,
          description: 'Zip-lining and rock climbing'
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
  });

  describe('Complete Tourist Workflow', () => {
    it('should complete full tourist registration and tour participation workflow', async () => {
      // Step 1: Tourist views available tour templates
      const templatesResponse = await request(app)
        .get('/api/tour-templates')
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(200);

      expect(templatesResponse.body.templates).toHaveLength(1);
      expect(templatesResponse.body.templates[0].templateName).toBe('Adventure Discovery Tour');

      // Step 2: Tourist views specific template details
      const templateDetailResponse = await request(app)
        .get(`/api/tour-templates/${templateId}`)
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(200);

      expect(templateDetailResponse.body.sitesToVisit).toHaveLength(2);
      expect(templateDetailResponse.body.sitesToVisit[0].siteName).toBe('Mountain Peak');

      // Step 3: Provider admin creates a tour event based on template
      const tourEventResponse = await request(app)
        .post('/api/tour-events')
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send({
          templateId: templateId,
          customTourName: 'October Adventure Discovery 2024',
          startDate: '2024-10-01',
          endDate: '2024-10-14',
          packageType: 'Premium',
          place1Hotel: 'Mountain Lodge',
          place2Hotel: 'Adventure Resort',
          numberOfAllowedTourists: 15,
          groupChatInfo: 'Adventure group chat will be created'
        })
        .expect(201);

      const tourEventId = tourEventResponse.body.tourEventId;

      // Step 4: Tourist views available tour events
      const tourEventsResponse = await request(app)
        .get('/api/tour-events')
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(200);

      expect(tourEventsResponse.body.tourEvents).toHaveLength(1);
      expect(tourEventsResponse.body.tourEvents[0].customTourName).toBe('October Adventure Discovery 2024');

      // Step 5: Tourist registers for the tour
      const registrationResponse = await request(app)
        .post(`/api/tour-events/${tourEventId}/register`)
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(201);

      expect(registrationResponse.body.status).toBe(RegistrationStatus.PENDING);
      expect(registrationResponse.body.userId).toBe(touristId);

      // Step 6: Tourist views their registration status
      const tourEventDetailResponse = await request(app)
        .get(`/api/tour-events/${tourEventId}`)
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(200);

      expect(tourEventDetailResponse.body.userRegistration).toBeDefined();
      expect(tourEventDetailResponse.body.userRegistration.status).toBe(RegistrationStatus.PENDING);

      // Step 7: Provider admin approves the registration
      const registrationsResponse = await request(app)
        .get(`/api/tour-events/${tourEventId}/registrations`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(200);

      const registration = registrationsResponse.body.registrations[0];

      await request(app)
        .put(`/api/tour-events/${tourEventId}/registrations/${registration.registrationId}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send({
          approved: true
        })
        .expect(200);

      // Step 8: Tourist sees approved registration status
      const approvedTourResponse = await request(app)
        .get(`/api/tour-events/${tourEventId}`)
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(200);

      expect(approvedTourResponse.body.userRegistration.status).toBe(RegistrationStatus.APPROVED);

      // Step 9: Provider admin creates daily activities
      await request(app)
        .post(`/api/tour-events/${tourEventId}/activities`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send({
          activityName: 'Mountain Hike',
          activityType: 'Hiking',
          startTime: '08:00',
          endTime: '14:00',
          location: 'Mountain Peak',
          description: 'Guided hike to the mountain peak',
          activityDate: '2024-10-02',
          isOptional: false
        })
        .expect(201);

      await request(app)
        .post(`/api/tour-events/${tourEventId}/activities`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send({
          activityName: 'Adventure Sports',
          activityType: 'Sports',
          startTime: '15:00',
          endTime: '19:00',
          location: 'Adventure Park',
          description: 'Zip-lining and rock climbing activities',
          activityDate: '2024-10-03',
          isOptional: true,
          webLink: 'https://adventurepark.com/activities'
        })
        .expect(201);

      // Step 10: Tourist views the tour schedule
      const scheduleResponse = await request(app)
        .get(`/api/tour-events/${tourEventId}/schedule`)
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(200);

      expect(scheduleResponse.body.activities).toHaveLength(2);
      expect(scheduleResponse.body.activities.some((a: any) => a.activityName === 'Mountain Hike')).toBe(true);
      expect(scheduleResponse.body.activities.some((a: any) => a.activityName === 'Adventure Sports')).toBe(true);

      // Step 11: Tourist updates their profile
      const profileUpdateResponse = await request(app)
        .put(`/api/users/${touristId}`)
        .set('Authorization', `Bearer ${touristToken}`)
        .send({
          phoneNumber: '+1234567899'
        })
        .expect(200);

      expect(profileUpdateResponse.body.phoneNumber).toBe('+1234567899');

      // Step 12: Tourist views their own profile
      const profileResponse = await request(app)
        .get(`/api/users/${touristId}`)
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(200);

      expect(profileResponse.body.firstName).toBe('Jane');
      expect(profileResponse.body.phoneNumber).toBe('+1234567899');
      expect(profileResponse.body).not.toHaveProperty('passwordHash'); // Security check
    });

    it('should handle tourist document management workflow', async () => {
      // Step 1: Tourist uploads passport document
      const passportUploadResponse = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${touristToken}`)
        .field('type', 'Passport')
        .field('description', 'My passport for travel')
        .attach('file', Buffer.from('fake passport content'), 'passport.pdf')
        .expect(201);

      const passportDocId = passportUploadResponse.body.documentId;
      expect(passportUploadResponse.body.type).toBe('Passport');

      // Step 2: Tourist uploads tour form document
      const tourFormUploadResponse = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${touristToken}`)
        .field('type', 'TourForm')
        .field('description', 'Completed tour registration form')
        .attach('file', Buffer.from('fake form content'), 'tour-form.pdf')
        .expect(201);

      const tourFormDocId = tourFormUploadResponse.body.documentId;
      expect(tourFormUploadResponse.body.type).toBe('TourForm');

      // Step 3: Tourist views their documents
      const documentsResponse = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(200);

      expect(documentsResponse.body.documents).toHaveLength(2);
      expect(documentsResponse.body.documents.some((d: any) => d.type === 'Passport')).toBe(true);
      expect(documentsResponse.body.documents.some((d: any) => d.type === 'TourForm')).toBe(true);

      // Step 4: Tourist views specific document details
      const passportDetailResponse = await request(app)
        .get(`/api/documents/${passportDocId}`)
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(200);

      expect(passportDetailResponse.body.type).toBe('Passport');
      expect(passportDetailResponse.body.description).toBe('My passport for travel');

      // Step 5: Tourist searches documents by type
      const passportSearchResponse = await request(app)
        .get('/api/documents/search?type=Passport')
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(200);

      expect(passportSearchResponse.body.documents).toHaveLength(1);
      expect(passportSearchResponse.body.documents[0].type).toBe('Passport');

      // Step 6: Tourist gets document statistics
      const statsResponse = await request(app)
        .get('/api/documents/statistics')
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(200);

      expect(statsResponse.body.totalDocuments).toBe(2);
      expect(statsResponse.body.documentsByType.Passport).toBe(1);
      expect(statsResponse.body.documentsByType.TourForm).toBe(1);

      // Step 7: Tourist downloads blank forms
      const blankFormsResponse = await request(app)
        .get('/api/documents/forms/blank')
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(200);

      expect(blankFormsResponse.body.forms).toBeDefined();
      expect(Array.isArray(blankFormsResponse.body.forms)).toBe(true);

      // Step 8: Tourist deletes a document
      await request(app)
        .delete(`/api/documents/${tourFormDocId}`)
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(200);

      // Verify document was deleted
      const remainingDocsResponse = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(200);

      expect(remainingDocsResponse.body.documents).toHaveLength(1);
      expect(remainingDocsResponse.body.documents[0].type).toBe('Passport');
    });

    it('should handle tourist registration conflicts and capacity limits', async () => {
      // Create two overlapping tour events
      const tourEvent1Response = await request(app)
        .post('/api/tour-events')
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send({
          templateId: templateId,
          customTourName: 'First Adventure Tour',
          startDate: '2024-11-01',
          endDate: '2024-11-10',
          packageType: 'Standard',
          place1Hotel: 'Hotel A',
          place2Hotel: 'Hotel B',
          numberOfAllowedTourists: 1, // Limited capacity
          groupChatInfo: 'First tour group'
        })
        .expect(201);

      const tourEvent2Response = await request(app)
        .post('/api/tour-events')
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send({
          templateId: templateId,
          customTourName: 'Second Adventure Tour',
          startDate: '2024-11-05', // Overlaps with first tour
          endDate: '2024-11-15',
          packageType: 'Premium',
          place1Hotel: 'Hotel C',
          place2Hotel: 'Hotel D',
          numberOfAllowedTourists: 5,
          groupChatInfo: 'Second tour group'
        })
        .expect(201);

      const tourEvent1Id = tourEvent1Response.body.tourEventId;
      const tourEvent2Id = tourEvent2Response.body.tourEventId;

      // Tourist registers for first tour
      await request(app)
        .post(`/api/tour-events/${tourEvent1Id}/register`)
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(201);

      // Get registration and approve it
      const registrations1Response = await request(app)
        .get(`/api/tour-events/${tourEvent1Id}/registrations`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(200);

      const registration1 = registrations1Response.body.registrations[0];

      await request(app)
        .put(`/api/tour-events/${tourEvent1Id}/registrations/${registration1.registrationId}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send({
          approved: true
        })
        .expect(200);

      // Tourist tries to register for overlapping tour - should be prevented
      const conflictRegistrationResponse = await request(app)
        .post(`/api/tour-events/${tourEvent2Id}/register`)
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(400);

      expect(conflictRegistrationResponse.body.error.message).toContain('overlapping');

      // Check that first tour is now at capacity (FULL status)
      const tourEvent1StatusResponse = await request(app)
        .get(`/api/tour-events/${tourEvent1Id}`)
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(200);

      expect(tourEvent1StatusResponse.body.status).toBe(TourEventStatus.FULL);
      expect(tourEvent1StatusResponse.body.remainingTourists).toBe(0);

      // Create another tourist to test capacity limits
      const anotherTourist = await userService.createUser({
        firstName: 'Another',
        lastName: 'Tourist',
        emailAddress: 'another@test.com',
        phoneNumber: '+1234567894',
        country: 'US',
        password: 'SecurePass123!',
        userType: UserType.TOURIST,
        providerId: providerId,
        passportNumber: 'P987654321',
        dateOfBirth: '1990-01-01',
        gender: 'Male'
      });

      const anotherTouristLogin = await authService.login('another@test.com', 'SecurePass123!');
      const anotherTouristToken = anotherTouristLogin.accessToken;

      // Another tourist tries to register for full tour - should be prevented
      const capacityRegistrationResponse = await request(app)
        .post(`/api/tour-events/${tourEvent1Id}/register`)
        .set('Authorization', `Bearer ${anotherTouristToken}`)
        .expect(400);

      expect(capacityRegistrationResponse.body.error.message).toContain('capacity');
    });

    it('should handle tourist authentication and profile management', async () => {
      // Test password change
      const passwordChangeResponse = await request(app)
        .put(`/api/users/${touristId}`)
        .set('Authorization', `Bearer ${touristToken}`)
        .send({
          password: 'NewSecurePass123!'
        })
        .expect(200);

      // Old token should still work until refresh
      await request(app)
        .get(`/api/users/${touristId}`)
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(200);

      // Login with new password
      const newLoginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          emailAddress: 'jane@test.com',
          password: 'NewSecurePass123!'
        })
        .expect(200);

      const newToken = newLoginResponse.body.accessToken;

      // Use new token to access profile
      const profileResponse = await request(app)
        .get(`/api/users/${touristId}`)
        .set('Authorization', `Bearer ${newToken}`)
        .expect(200);

      expect(profileResponse.body.firstName).toBe('Jane');

      // Test profile updates
      const profileUpdateResponse = await request(app)
        .put(`/api/users/${touristId}`)
        .set('Authorization', `Bearer ${newToken}`)
        .send({
          firstName: 'Jane Updated',
          passportNumber: 'P999888777'
        })
        .expect(200);

      expect(profileUpdateResponse.body.firstName).toBe('Jane Updated');
      expect(profileUpdateResponse.body.passportNumber).toBe('P999888777');

      // Test logout
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${newToken}`)
        .expect(200);

      // Token should be invalid after logout (this depends on implementation)
      // For now, we'll just verify the logout endpoint works
    });
  });
});