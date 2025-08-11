import request from 'supertest';
import { app } from '../../app';
import { setupTestDatabase, cleanupTestDatabase } from '../../utils/test-db-setup';
import { PrismaClient } from '../../generated/prisma';
import jwt from 'jsonwebtoken';
import { UserType } from '../../types/user';

const prisma = new PrismaClient();

describe('Activity Types Integration Tests', () => {
  let systemAdminToken: string;
  let providerAdminToken: string;
  let touristToken: string;
  let activityTypeId: string;

  beforeAll(async () => {
    await setupTestDatabase();

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
        status: 'ACTIVE'
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
        status: 'ACTIVE'
      }
    });

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
        role: providerAdmin.userType 
      },
      jwtSecret,
      { expiresIn: '1h' }
    );

    touristToken = jwt.sign(
      { 
        sub: tourist.userId, 
        email: tourist.emailAddress, 
        role: tourist.userType 
      },
      jwtSecret,
      { expiresIn: '1h' }
    );

    // Create some default activity types
    await prisma.activityType.createMany({
      data: [
        {
          typeName: 'Transportation',
          description: 'Travel and transportation activities',
          isDefault: true,
          isActive: true
        },
        {
          typeName: 'Religious Visit',
          description: 'Religious sites and worship activities',
          isDefault: true,
          isActive: true
        },
        {
          typeName: 'Sightseeing',
          description: 'Tourist sightseeing and exploration',
          isDefault: true,
          isActive: true
        }
      ]
    });
  });

  afterAll(async () => {
    await cleanupTestDatabase();
    await prisma.$disconnect();
  });

  describe('GET /api/activity-types', () => {
    it('should get all activity types for authenticated user', async () => {
      const response = await request(app)
        .get('/api/activity-types')
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(200);

      expect(response.body.message).toBe('Activity types retrieved successfully');
      expect(response.body.data.activityTypes).toBeInstanceOf(Array);
      expect(response.body.data.activityTypes.length).toBeGreaterThan(0);
      expect(response.body.data.total).toBeGreaterThan(0);
    });

    it('should get only active activity types by default', async () => {
      const response = await request(app)
        .get('/api/activity-types?activeOnly=true')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(200);

      expect(response.body.data.activityTypes).toBeInstanceOf(Array);
      response.body.data.activityTypes.forEach((type: any) => {
        expect(type.isActive).toBe(true);
      });
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .get('/api/activity-types')
        .expect(401);
    });
  });

  describe('POST /api/activity-types', () => {
    it('should create activity type as system admin', async () => {
      const activityTypeData = {
        typeName: 'Custom Activity Type',
        description: 'A custom activity type for testing',
        isDefault: false,
        isActive: true
      };

      const response = await request(app)
        .post('/api/activity-types')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(activityTypeData)
        .expect(201);

      expect(response.body.message).toBe('Activity type created successfully');
      expect(response.body.data.activityType).toHaveProperty('activityTypeId');
      expect(response.body.data.activityType.typeName).toBe(activityTypeData.typeName);
      expect(response.body.data.activityType.description).toBe(activityTypeData.description);
      
      activityTypeId = response.body.data.activityType.activityTypeId;
    });

    it('should return 403 for provider admin trying to create activity type', async () => {
      const activityTypeData = {
        typeName: 'Unauthorized Activity Type',
        description: 'This should not be created'
      };

      const response = await request(app)
        .post('/api/activity-types')
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send(activityTypeData)
        .expect(403);

      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should return 403 for tourist trying to create activity type', async () => {
      const activityTypeData = {
        typeName: 'Tourist Activity Type',
        description: 'This should not be created'
      };

      const response = await request(app)
        .post('/api/activity-types')
        .set('Authorization', `Bearer ${touristToken}`)
        .send(activityTypeData)
        .expect(403);

      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should return 400 for invalid activity type data', async () => {
      const invalidData = {
        typeName: '', // Empty name
        description: 'A' * 600 // Too long description
      };

      const response = await request(app)
        .post('/api/activity-types')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 409 for duplicate activity type name', async () => {
      const duplicateData = {
        typeName: 'Transportation', // Already exists
        description: 'Duplicate type'
      };

      const response = await request(app)
        .post('/api/activity-types')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(duplicateData)
        .expect(409);

      expect(response.body.error.code).toBe('ACTIVITY_TYPE_EXISTS');
    });
  });

  describe('GET /api/activity-types/:id', () => {
    it('should get activity type by ID', async () => {
      const response = await request(app)
        .get(`/api/activity-types/${activityTypeId}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(200);

      expect(response.body.message).toBe('Activity type retrieved successfully');
      expect(response.body.data.activityType.activityTypeId).toBe(activityTypeId);
      expect(response.body.data.activityType.typeName).toBe('Custom Activity Type');
    });

    it('should return 404 for non-existent activity type', async () => {
      const response = await request(app)
        .get('/api/activity-types/non-existent-id')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(404);

      expect(response.body.error.code).toBe('ACTIVITY_TYPE_NOT_FOUND');
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .get(`/api/activity-types/${activityTypeId}`)
        .expect(401);
    });
  });

  describe('PUT /api/activity-types/:id', () => {
    it('should update activity type as system admin', async () => {
      const updateData = {
        typeName: 'Updated Custom Activity Type',
        description: 'Updated description',
        isActive: false
      };

      const response = await request(app)
        .put(`/api/activity-types/${activityTypeId}`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.message).toBe('Activity type updated successfully');
      expect(response.body.data.activityType.typeName).toBe(updateData.typeName);
      expect(response.body.data.activityType.description).toBe(updateData.description);
      expect(response.body.data.activityType.isActive).toBe(updateData.isActive);
    });

    it('should return 403 for provider admin trying to update activity type', async () => {
      const updateData = {
        typeName: 'Unauthorized Update'
      };

      const response = await request(app)
        .put(`/api/activity-types/${activityTypeId}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send(updateData)
        .expect(403);

      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should return 404 for non-existent activity type', async () => {
      const updateData = {
        typeName: 'Updated Name'
      };

      const response = await request(app)
        .put('/api/activity-types/non-existent-id')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(updateData)
        .expect(404);

      expect(response.body.error.code).toBe('ACTIVITY_TYPE_NOT_FOUND');
    });

    it('should return 400 for invalid update data', async () => {
      const invalidData = {
        typeName: 'A' * 150 // Too long name
      };

      const response = await request(app)
        .put(`/api/activity-types/${activityTypeId}`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('DELETE /api/activity-types/:id', () => {
    it('should return 403 for provider admin trying to delete activity type', async () => {
      const response = await request(app)
        .delete(`/api/activity-types/${activityTypeId}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(403);

      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should return 403 for tourist trying to delete activity type', async () => {
      const response = await request(app)
        .delete(`/api/activity-types/${activityTypeId}`)
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(403);

      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should delete activity type as system admin when not in use', async () => {
      const response = await request(app)
        .delete(`/api/activity-types/${activityTypeId}`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(200);

      expect(response.body.message).toBe('Activity type deleted successfully');
    });

    it('should return 404 for already deleted activity type', async () => {
      const response = await request(app)
        .delete(`/api/activity-types/${activityTypeId}`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(404);

      expect(response.body.error.code).toBe('ACTIVITY_TYPE_NOT_FOUND');
    });

    it('should return 404 for non-existent activity type', async () => {
      const response = await request(app)
        .delete('/api/activity-types/non-existent-id')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(404);

      expect(response.body.error.code).toBe('ACTIVITY_TYPE_NOT_FOUND');
    });
  });

  describe('Activity Type Usage Prevention', () => {
    it('should prevent deletion of activity type that is in use', async () => {
      // First create a new activity type
      const activityTypeData = {
        typeName: 'In Use Activity Type',
        description: 'This type will be used in an activity'
      };

      const createResponse = await request(app)
        .post('/api/activity-types')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(activityTypeData)
        .expect(201);

      const inUseTypeId = createResponse.body.data.activityType.activityTypeId;

      // Create a provider and tour event to use this activity type
      const provider = await prisma.provider.create({
        data: {
          companyName: 'Test Company',
          country: 'Saudi Arabia',
          addressLine1: '123 Test St',
          city: 'Riyadh',
          stateRegion: 'Riyadh',
          companyDescription: 'Test company',
          phoneNumber: '+966501234567',
          emailAddress: 'testcompany@test.com',
          corpIdTaxId: 'TAX123456',
          isIsolatedInstance: false
        }
      });

      const tourEvent = await prisma.customTourEvent.create({
        data: {
          providerId: provider.providerId,
          customTourName: 'Test Tour',
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

      // Create an activity using this activity type
      await prisma.activity.create({
        data: {
          tourEventId: tourEvent.tourEventId,
          activityDate: new Date('2024-06-02'),
          startTime: '09:00',
          endTime: '11:00',
          activityName: 'Test Activity',
          activityType: activityTypeData.typeName,
          isOptional: false
        }
      });

      // Try to delete the activity type - should fail
      const response = await request(app)
        .delete(`/api/activity-types/${inUseTypeId}`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(422);

      expect(response.body.error.code).toBe('ACTIVITY_TYPE_IN_USE');
      expect(response.body.error.message).toContain('Cannot delete activity type that is being used');
    });
  });
});