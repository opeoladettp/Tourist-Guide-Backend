import request from 'supertest';
import { app } from '../../app';
import { setupTestDatabase, cleanupTestDatabase } from '../../utils/test-db-setup';
import { PrismaClient } from '../../generated/prisma';
import jwt from 'jsonwebtoken';
import { UserType } from '../../types/user';

const prisma = new PrismaClient();

describe('Tour Events Activities Integration Tests', () => {
  let systemAdminToken: string;
  let providerAdminToken: string;
  let touristToken: string;
  let providerId: string;
  let tourEventId: string;
  let activityId: string;

  beforeAll(async () => {
    await setupTestDatabase();

    // Create test provider
    const provider = await prisma.provider.create({
      data: {
        companyName: 'Test Tour Company',
        country: 'Saudi Arabia',
        addressLine1: '123 Test St',
        city: 'Riyadh',
        stateRegion: 'Riyadh',
        companyDescription: 'Test company',
        phoneNumber: '+966501234567',
        emailAddress: 'test@company.com',
        corpIdTaxId: 'TAX123456',
        isIsolatedInstance: false
      }
    });
    providerId = provider.providerId;

    // Create test users
    const systemAdmin = await prisma.user.create({
      data: {
        firstName: 'System',
        lastName: 'Admin',
        emailAddress: 'sysadmin@test.com',
        phoneNumber: '+966501234567',
        country: 'Saudi Arabia',
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
        phoneNumber: '+966501234568',
        country: 'Saudi Arabia',
        passwordHash: 'hashedpassword',
        userType: UserType.PROVIDER_ADMIN,
        status: 'ACTIVE',
        providerId
      }
    });

    const tourist = await prisma.user.create({
      data: {
        firstName: 'Test',
        lastName: 'Tourist',
        emailAddress: 'tourist@test.com',
        phoneNumber: '+966501234569',
        country: 'Saudi Arabia',
        passwordHash: 'hashedpassword',
        userType: UserType.TOURIST,
        status: 'ACTIVE',
        providerId
      }
    });

    // Create tour template
    const template = await prisma.tourTemplate.create({
      data: {
        templateName: 'Test Template',
        type: 'Hajj',
        year: 2024,
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-06-10'),
        detailedDescription: 'Test template description'
      }
    });

    // Create tour event
    const tourEvent = await prisma.customTourEvent.create({
      data: {
        providerId,
        templateId: template.templateId,
        customTourName: 'Test Tour Event',
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-06-10'),
        packageType: 'Premium',
        place1Hotel: 'Hotel A',
        place2Hotel: 'Hotel B',
        numberOfAllowedTourists: 50,
        remainingTourists: 50,
        status: 'ACTIVE'
      }
    });
    tourEventId = tourEvent.tourEventId;

    // Generate JWT tokens
    const jwtSecret = process.env.JWT_SECRET || 'test-secret';
    
    systemAdminToken = jwt.sign(
      { 
        sub: systemAdmin.userId, 
        email: systemAdmin.emailAddress, 
        role: systemAdmin.userType 
      },
      jwtSecret,
      { expiresIn: '1h' }
    );

    providerAdminToken = jwt.sign(
      { 
        sub: providerAdmin.userId, 
        email: providerAdmin.emailAddress, 
        role: providerAdmin.userType,
        providerId 
      },
      jwtSecret,
      { expiresIn: '1h' }
    );

    touristToken = jwt.sign(
      { 
        sub: tourist.userId, 
        email: tourist.emailAddress, 
        role: tourist.userType,
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

  describe('GET /api/tour-events/:id/schedule', () => {
    it('should get tour event schedule for system admin', async () => {
      const response = await request(app)
        .get(`/api/tour-events/${tourEventId}/schedule`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(200);

      expect(response.body.message).toBe('Tour event schedule retrieved successfully');
      expect(response.body.data.activities).toBeInstanceOf(Array);
    });

    it('should get tour event schedule for provider admin', async () => {
      const response = await request(app)
        .get(`/api/tour-events/${tourEventId}/schedule`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(200);

      expect(response.body.message).toBe('Tour event schedule retrieved successfully');
      expect(response.body.data.activities).toBeInstanceOf(Array);
    });

    it('should get daily schedule for specific date', async () => {
      const response = await request(app)
        .get(`/api/tour-events/${tourEventId}/schedule?date=2024-06-01&includeIslamic=true`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(200);

      expect(response.body.message).toBe('Daily schedule retrieved successfully');
      expect(response.body.data.schedule).toHaveProperty('date');
      expect(response.body.data.schedule).toHaveProperty('calendarDate');
      expect(response.body.data.schedule).toHaveProperty('activities');
    });

    it('should return 400 for invalid date format', async () => {
      const response = await request(app)
        .get(`/api/tour-events/${tourEventId}/schedule?date=invalid-date`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_DATE');
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .get(`/api/tour-events/${tourEventId}/schedule`)
        .expect(401);
    });
  });

  describe('POST /api/tour-events/:id/activities', () => {
    it('should create activity as provider admin', async () => {
      const activityData = {
        activityDate: '2024-06-02',
        startTime: '09:00',
        endTime: '11:00',
        activityName: 'Morning Prayer',
        description: 'Group morning prayer session',
        location: 'Masjid al-Haram',
        activityType: 'Religious Visit',
        isOptional: false
      };

      const response = await request(app)
        .post(`/api/tour-events/${tourEventId}/activities`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send(activityData)
        .expect(201);

      expect(response.body.message).toBe('Activity created successfully');
      expect(response.body.data.activity).toHaveProperty('activityId');
      expect(response.body.data.activity.activityName).toBe(activityData.activityName);
      
      activityId = response.body.data.activity.activityId;
    });

    it('should create activity as system admin', async () => {
      const activityData = {
        activityDate: '2024-06-03',
        startTime: '14:00',
        endTime: '16:00',
        activityName: 'Sightseeing Tour',
        description: 'Visit historical sites',
        location: 'Mecca',
        activityType: 'Sightseeing',
        isOptional: true
      };

      const response = await request(app)
        .post(`/api/tour-events/${tourEventId}/activities`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(activityData)
        .expect(201);

      expect(response.body.message).toBe('Activity created successfully');
      expect(response.body.data.activity.activityName).toBe(activityData.activityName);
    });

    it('should return 403 for tourist trying to create activity', async () => {
      const activityData = {
        activityDate: '2024-06-04',
        startTime: '10:00',
        endTime: '12:00',
        activityName: 'Unauthorized Activity',
        activityType: 'Other'
      };

      const response = await request(app)
        .post(`/api/tour-events/${tourEventId}/activities`)
        .set('Authorization', `Bearer ${touristToken}`)
        .send(activityData)
        .expect(403);

      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should return 400 for invalid activity data', async () => {
      const invalidData = {
        activityDate: 'invalid-date',
        startTime: '25:00', // Invalid time
        endTime: '10:00',
        activityName: '', // Empty name
        activityType: 'Test'
      };

      const response = await request(app)
        .post(`/api/tour-events/${tourEventId}/activities`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 422 for invalid time order', async () => {
      const activityData = {
        activityDate: '2024-06-05',
        startTime: '15:00',
        endTime: '14:00', // End before start
        activityName: 'Invalid Time Activity',
        activityType: 'Other'
      };

      const response = await request(app)
        .post(`/api/tour-events/${tourEventId}/activities`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send(activityData)
        .expect(422);

      expect(response.body.error.code).toBe('INVALID_TIME_ORDER');
    });

    it('should return 422 for activity date outside tour event range', async () => {
      const activityData = {
        activityDate: '2024-07-01', // Outside tour event date range
        startTime: '10:00',
        endTime: '12:00',
        activityName: 'Out of Range Activity',
        activityType: 'Other'
      };

      const response = await request(app)
        .post(`/api/tour-events/${tourEventId}/activities`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send(activityData)
        .expect(422);

      expect(response.body.error.code).toBe('INVALID_ACTIVITY_DATE');
    });

    it('should return 409 for conflicting activity times', async () => {
      // First create an activity
      const firstActivity = {
        activityDate: '2024-06-06',
        startTime: '10:00',
        endTime: '12:00',
        activityName: 'First Activity',
        activityType: 'Meeting'
      };

      await request(app)
        .post(`/api/tour-events/${tourEventId}/activities`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send(firstActivity)
        .expect(201);

      // Try to create conflicting activity
      const conflictingActivity = {
        activityDate: '2024-06-06',
        startTime: '11:00',
        endTime: '13:00', // Overlaps with first activity
        activityName: 'Conflicting Activity',
        activityType: 'Meeting'
      };

      const response = await request(app)
        .post(`/api/tour-events/${tourEventId}/activities`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send(conflictingActivity)
        .expect(409);

      expect(response.body.error.code).toBe('ACTIVITY_CONFLICT');
    });
  });

  describe('PUT /api/tour-events/:id/activities/:activityId', () => {
    it('should update activity as provider admin', async () => {
      const updateData = {
        activityName: 'Updated Morning Prayer',
        description: 'Updated description',
        location: 'Updated location'
      };

      const response = await request(app)
        .put(`/api/tour-events/${tourEventId}/activities/${activityId}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.message).toBe('Activity updated successfully');
      expect(response.body.data.activity.activityName).toBe(updateData.activityName);
      expect(response.body.data.activity.description).toBe(updateData.description);
    });

    it('should update activity as system admin', async () => {
      const updateData = {
        activityType: 'Educational',
        isOptional: true
      };

      const response = await request(app)
        .put(`/api/tour-events/${tourEventId}/activities/${activityId}`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.message).toBe('Activity updated successfully');
      expect(response.body.data.activity.activityType).toBe(updateData.activityType);
      expect(response.body.data.activity.isOptional).toBe(updateData.isOptional);
    });

    it('should return 403 for tourist trying to update activity', async () => {
      const updateData = {
        activityName: 'Unauthorized Update'
      };

      const response = await request(app)
        .put(`/api/tour-events/${tourEventId}/activities/${activityId}`)
        .set('Authorization', `Bearer ${touristToken}`)
        .send(updateData)
        .expect(403);

      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should return 404 for non-existent activity', async () => {
      const updateData = {
        activityName: 'Updated Name'
      };

      const response = await request(app)
        .put(`/api/tour-events/${tourEventId}/activities/non-existent-id`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send(updateData)
        .expect(404);

      expect(response.body.error.code).toBe('ACTIVITY_NOT_FOUND');
    });

    it('should return 400 for invalid update data', async () => {
      const invalidData = {
        startTime: '25:00' // Invalid time format
      };

      const response = await request(app)
        .put(`/api/tour-events/${tourEventId}/activities/${activityId}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('DELETE /api/tour-events/:id/activities/:activityId', () => {
    it('should return 403 for tourist trying to delete activity', async () => {
      const response = await request(app)
        .delete(`/api/tour-events/${tourEventId}/activities/${activityId}`)
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(403);

      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should delete activity as provider admin', async () => {
      const response = await request(app)
        .delete(`/api/tour-events/${tourEventId}/activities/${activityId}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(200);

      expect(response.body.message).toBe('Activity deleted successfully');
    });

    it('should return 404 for already deleted activity', async () => {
      const response = await request(app)
        .delete(`/api/tour-events/${tourEventId}/activities/${activityId}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(404);

      expect(response.body.error.code).toBe('ACTIVITY_NOT_FOUND');
    });

    it('should return 404 for non-existent activity', async () => {
      const response = await request(app)
        .delete(`/api/tour-events/${tourEventId}/activities/non-existent-id`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(404);

      expect(response.body.error.code).toBe('ACTIVITY_NOT_FOUND');
    });
  });
});