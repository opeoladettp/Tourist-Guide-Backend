import request from 'supertest';
import { PrismaClient } from '../../generated/prisma';
import app from '../../app';
import { setupTestDatabase, cleanupTestDatabase } from '../../utils/test-db-setup';
import { UserType } from '../../types/user';
import { AuthService } from '../../services/auth';

describe('User Management API Integration Tests', () => {
  let prisma: PrismaClient;
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
    const systemAdmin = await prisma.user.create({
      data: {
        firstName: 'System',
        lastName: 'Admin',
        emailAddress: 'sysadmin@test.com',
        phoneNumber: '+1234567890',
        country: 'Test Country',
        passwordHash: '$2b$10$test.hash.for.testing',
        userType: UserType.SYSTEM_ADMIN
      }
    });
    systemAdminId = systemAdmin.userId;

    const providerAdmin = await prisma.user.create({
      data: {
        firstName: 'Provider',
        lastName: 'Admin',
        emailAddress: 'provideradmin@test.com',
        phoneNumber: '+1234567891',
        country: 'Test Country',
        passwordHash: '$2b$10$test.hash.for.testing',
        userType: UserType.PROVIDER_ADMIN,
        providerId: providerId
      }
    });
    providerAdminId = providerAdmin.userId;

    const tourist = await prisma.user.create({
      data: {
        firstName: 'Test',
        lastName: 'Tourist',
        emailAddress: 'tourist@test.com',
        phoneNumber: '+1234567892',
        country: 'Test Country',
        passwordHash: '$2b$10$test.hash.for.testing',
        userType: UserType.TOURIST,
        providerId: providerId
      }
    });
    touristId = tourist.userId;

    // Generate tokens
    systemAdminToken = authService.generateAccessToken(systemAdmin);
    providerAdminToken = authService.generateAccessToken(providerAdmin);
    touristToken = authService.generateAccessToken(tourist);
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('GET /api/users', () => {
    it('should allow system admin to get all users', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(200);

      expect(response.body.message).toBe('Users retrieved successfully');
      expect(response.body.data.users).toHaveLength(3);
      expect(response.body.data.users.some((u: any) => u.userType === 'SystemAdmin')).toBe(true);
      expect(response.body.data.users.some((u: any) => u.userType === 'ProviderAdmin')).toBe(true);
      expect(response.body.data.users.some((u: any) => u.userType === 'Tourist')).toBe(true);
    });

    it('should allow provider admin to get users from their company only', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(200);

      expect(response.body.message).toBe('Users retrieved successfully');
      expect(response.body.data.users).toHaveLength(2); // Provider admin + tourist
      expect(response.body.data.users.every((u: any) => u.providerId === providerId)).toBe(true);
    });

    it('should not allow tourist to list users', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(403);

      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/users')
        .expect(401);

      expect(response.body.error.code).toBe('MISSING_AUTH_HEADER');
    });

    it('should support pagination parameters', async () => {
      const response = await request(app)
        .get('/api/users?limit=2&offset=0')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(200);

      expect(response.body.data.pagination.limit).toBe(2);
      expect(response.body.data.pagination.offset).toBe(0);
    });

    it('should validate pagination parameters', async () => {
      const response = await request(app)
        .get('/api/users?limit=invalid')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/users', () => {
    const validUserData = {
      firstName: 'New',
      lastName: 'User',
      emailAddress: 'newuser@test.com',
      phoneNumber: '+1234567893',
      country: 'Test Country',
      password: 'SecurePassword123!',
      userType: 'Tourist',
      providerId: null
    };

    it('should allow system admin to create users', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(validUserData)
        .expect(201);

      expect(response.body.message).toBe('User created successfully');
      expect(response.body.data.user.emailAddress).toBe(validUserData.emailAddress);
      expect(response.body.data.user.userType).toBe(validUserData.userType);
      expect(response.body.data.user).not.toHaveProperty('passwordHash');
    });

    it('should not allow provider admin to create users', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send({
          ...validUserData,
          emailAddress: 'another@test.com'
        })
        .expect(403);

      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should not allow tourist to create users', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${touristToken}`)
        .send({
          ...validUserData,
          emailAddress: 'tourist-created@test.com'
        })
        .expect(403);

      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/users')
        .send(validUserData)
        .expect(401);

      expect(response.body.error.code).toBe('MISSING_AUTH_HEADER');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({
          firstName: 'Test'
          // Missing required fields
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should prevent duplicate email addresses', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({
          ...validUserData,
          emailAddress: 'sysadmin@test.com' // Already exists
        })
        .expect(409);

      expect(response.body.error.code).toBe('USER_ALREADY_EXISTS');
    });

    it('should validate password strength', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({
          ...validUserData,
          emailAddress: 'weakpass@test.com',
          password: '123' // Weak password
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate provider exists when providerId is provided', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({
          ...validUserData,
          emailAddress: 'invalidprovider@test.com',
          providerId: 'non-existent-provider-id'
        })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_PROVIDER');
    });
  });

  describe('GET /api/users/:id', () => {
    it('should allow system admin to get any user', async () => {
      const response = await request(app)
        .get(`/api/users/${touristId}`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(200);

      expect(response.body.message).toBe('User retrieved successfully');
      expect(response.body.data.user.userId).toBe(touristId);
      expect(response.body.data.user).not.toHaveProperty('passwordHash');
    });

    it('should allow provider admin to get users from their company', async () => {
      const response = await request(app)
        .get(`/api/users/${touristId}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(200);

      expect(response.body.data.user.userId).toBe(touristId);
    });

    it('should allow provider admin to get their own profile', async () => {
      const response = await request(app)
        .get(`/api/users/${providerAdminId}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(200);

      expect(response.body.data.user.userId).toBe(providerAdminId);
    });

    it('should not allow provider admin to get users from other companies', async () => {
      const response = await request(app)
        .get(`/api/users/${systemAdminId}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(403);

      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should allow tourist to get their own profile', async () => {
      const response = await request(app)
        .get(`/api/users/${touristId}`)
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(200);

      expect(response.body.data.user.userId).toBe(touristId);
    });

    it('should not allow tourist to get other users', async () => {
      const response = await request(app)
        .get(`/api/users/${providerAdminId}`)
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(403);

      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should return 404 for non-existent user', async () => {
      const response = await request(app)
        .get('/api/users/non-existent-id')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(404);

      expect(response.body.error.code).toBe('USER_NOT_FOUND');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get(`/api/users/${touristId}`)
        .expect(401);

      expect(response.body.error.code).toBe('MISSING_AUTH_HEADER');
    });
  });

  describe('PUT /api/users/:id', () => {
    const updateData = {
      firstName: 'Updated',
      phoneNumber: '+9876543210'
    };

    it('should allow system admin to update any user', async () => {
      const response = await request(app)
        .put(`/api/users/${touristId}`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.message).toBe('User updated successfully');
      expect(response.body.data.user.firstName).toBe(updateData.firstName);
      expect(response.body.data.user.phoneNumber).toBe(updateData.phoneNumber);
    });

    it('should allow provider admin to update users from their company', async () => {
      const response = await request(app)
        .put(`/api/users/${touristId}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send({ lastName: 'UpdatedByProvider' })
        .expect(200);

      expect(response.body.data.user.lastName).toBe('UpdatedByProvider');
    });

    it('should allow users to update their own profile', async () => {
      const response = await request(app)
        .put(`/api/users/${touristId}`)
        .set('Authorization', `Bearer ${touristToken}`)
        .send({ firstName: 'SelfUpdated' })
        .expect(200);

      expect(response.body.data.user.firstName).toBe('SelfUpdated');
    });

    it('should not allow tourist to update status', async () => {
      const response = await request(app)
        .put(`/api/users/${touristId}`)
        .set('Authorization', `Bearer ${touristToken}`)
        .send({ status: 'Inactive' })
        .expect(403);

      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should allow admin to update user status', async () => {
      const response = await request(app)
        .put(`/api/users/${touristId}`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({ status: 'Inactive' })
        .expect(200);

      expect(response.body.data.user.status).toBe('Inactive');
    });

    it('should not allow tourist to update other users', async () => {
      const response = await request(app)
        .put(`/api/users/${providerAdminId}`)
        .set('Authorization', `Bearer ${touristToken}`)
        .send(updateData)
        .expect(403);

      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should return 404 for non-existent user', async () => {
      const response = await request(app)
        .put('/api/users/non-existent-id')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(updateData)
        .expect(404);

      expect(response.body.error.code).toBe('USER_NOT_FOUND');
    });

    it('should validate update data', async () => {
      const response = await request(app)
        .put(`/api/users/${touristId}`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({
          firstName: '', // Invalid empty string
          phoneNumber: '123' // Too short
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .put(`/api/users/${touristId}`)
        .send(updateData)
        .expect(401);

      expect(response.body.error.code).toBe('MISSING_AUTH_HEADER');
    });
  });

  describe('DELETE /api/users/:id', () => {
    let userToDelete: any;

    beforeEach(async () => {
      // Create a user to delete for each test
      userToDelete = await prisma.user.create({
        data: {
          firstName: 'Delete',
          lastName: 'Me',
          emailAddress: `delete-${Date.now()}@test.com`,
          phoneNumber: '+1234567894',
          country: 'Test Country',
          passwordHash: '$2b$10$test.hash.for.testing',
          userType: UserType.TOURIST,
          providerId: providerId
        }
      });
    });

    it('should allow system admin to delete any user', async () => {
      const response = await request(app)
        .delete(`/api/users/${userToDelete.userId}`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(200);

      expect(response.body.message).toBe('User deleted successfully');

      // Verify user is deleted
      const deletedUser = await prisma.user.findUnique({
        where: { userId: userToDelete.userId }
      });
      expect(deletedUser).toBeNull();
    });

    it('should allow provider admin to delete users from their company', async () => {
      const response = await request(app)
        .delete(`/api/users/${userToDelete.userId}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(200);

      expect(response.body.message).toBe('User deleted successfully');
    });

    it('should not allow provider admin to delete themselves', async () => {
      const response = await request(app)
        .delete(`/api/users/${providerAdminId}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(403);

      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should not allow tourist to delete users', async () => {
      const response = await request(app)
        .delete(`/api/users/${userToDelete.userId}`)
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(403);

      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should return 404 for non-existent user', async () => {
      const response = await request(app)
        .delete('/api/users/non-existent-id')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(404);

      expect(response.body.error.code).toBe('USER_NOT_FOUND');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .delete(`/api/users/${userToDelete.userId}`)
        .expect(401);

      expect(response.body.error.code).toBe('MISSING_AUTH_HEADER');
    });
  });

  describe('POST /api/auth/register', () => {
    const registrationData = {
      firstName: 'New',
      lastName: 'Tourist',
      emailAddress: 'newtourist@test.com',
      phoneNumber: '+1234567895',
      country: 'Test Country',
      password: 'SecurePassword123!',
      passportNumber: 'AB123456',
      dateOfBirth: '1990-01-01',
      gender: 'Male',
      providerId: null
    };

    it('should allow tourist registration', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(registrationData)
        .expect(201);

      expect(response.body.message).toBe('User registration successful');
      expect(response.body.data.user.emailAddress).toBe(registrationData.emailAddress);
      expect(response.body.data.user.userType).toBe('Tourist');
      expect(response.body.data.tokens).toHaveProperty('accessToken');
      expect(response.body.data.tokens).toHaveProperty('refreshToken');
    });

    it('should validate registration data', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          firstName: 'Test'
          // Missing required fields
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should prevent duplicate email registration', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          ...registrationData,
          emailAddress: 'tourist@test.com' // Already exists
        })
        .expect(409);

      expect(response.body.error.code).toBe('USER_ALREADY_EXISTS');
    });

    it('should validate password strength', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          ...registrationData,
          emailAddress: 'weakpassword@test.com',
          password: '123' // Weak password
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});