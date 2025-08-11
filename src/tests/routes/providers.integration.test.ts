import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import app from '../../app';
import { PrismaClient } from '../../generated/prisma';
import { setupTestDatabase, cleanupTestDatabase } from '../../utils/test-db-setup';
import { AuthService } from '../../services/auth';
import { UserService } from '../../services/user';
import { ProviderService } from '../../services/provider';
import { UserType } from '../../types/user';

describe('Provider Routes Integration Tests', () => {
  let prisma: PrismaClient;
  let authService: AuthService;
  let userService: UserService;
  let providerService: ProviderService;
  let systemAdminToken: string;
  let providerAdminToken: string;
  let touristToken: string;
  let testProviderId: string;
  let systemAdminUserId: string;
  let providerAdminUserId: string;
  let touristUserId: string;

  beforeAll(async () => {
    prisma = await setupTestDatabase();
    authService = new AuthService(prisma);
    userService = new UserService(prisma);
    providerService = new ProviderService(prisma);
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  beforeEach(async () => {
    // Clean up existing data
    await prisma.user.deleteMany();
    await prisma.provider.deleteMany();

    // Create test provider first
    const testProvider = await providerService.createProvider({
      companyName: 'Test Provider Company',
      country: 'Test Country',
      addressLine1: '123 Test Street',
      city: 'Test City',
      stateRegion: 'Test State',
      companyDescription: 'A test provider company',
      phoneNumber: '+1234567890',
      emailAddress: 'provider@test.com',
      corpIdTaxId: 'TEST123456',
      isIsolatedInstance: true
    }, UserType.SYSTEM_ADMIN);
    testProviderId = testProvider.providerId;

    // Create test users
    const systemAdmin = await userService.createUser({
      firstName: 'System',
      lastName: 'Admin',
      emailAddress: 'sysadmin@test.com',
      phoneNumber: '+1234567890',
      country: 'Test Country',
      password: 'password123',
      userType: UserType.SYSTEM_ADMIN
    });
    systemAdminUserId = systemAdmin.userId;

    const providerAdmin = await userService.createUser({
      firstName: 'Provider',
      lastName: 'Admin',
      emailAddress: 'provideradmin@test.com',
      phoneNumber: '+1234567891',
      country: 'Test Country',
      password: 'password123',
      userType: UserType.PROVIDER_ADMIN,
      providerId: testProviderId
    });
    providerAdminUserId = providerAdmin.userId;

    const tourist = await userService.createUser({
      firstName: 'Test',
      lastName: 'Tourist',
      emailAddress: 'tourist@test.com',
      phoneNumber: '+1234567892',
      country: 'Test Country',
      password: 'password123',
      userType: UserType.TOURIST,
      providerId: testProviderId
    });
    touristUserId = tourist.userId;

    // Generate tokens
    systemAdminToken = authService.generateAccessToken({
      sub: systemAdminUserId,
      email: 'sysadmin@test.com',
      role: UserType.SYSTEM_ADMIN
    });

    providerAdminToken = authService.generateAccessToken({
      sub: providerAdminUserId,
      email: 'provideradmin@test.com',
      role: UserType.PROVIDER_ADMIN,
      providerId: testProviderId
    });

    touristToken = authService.generateAccessToken({
      sub: touristUserId,
      email: 'tourist@test.com',
      role: UserType.TOURIST,
      providerId: testProviderId
    });
  });

  describe('GET /api/providers', () => {
    it('should allow system admin to get all providers', async () => {
      const response = await request(app)
        .get('/api/providers')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(200);

      expect(response.body.message).toBe('Providers retrieved successfully');
      expect(response.body.data.providers).toHaveLength(1);
      expect(response.body.data.providers[0].companyName).toBe('Test Provider Company');
      expect(response.body.data.pagination).toEqual({
        limit: 50,
        offset: 0,
        total: 1
      });
    });

    it('should deny provider admin access to list all providers', async () => {
      const response = await request(app)
        .get('/api/providers')
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(403);

      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should deny tourist access to list all providers', async () => {
      const response = await request(app)
        .get('/api/providers')
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(403);

      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should deny unauthenticated access', async () => {
      const response = await request(app)
        .get('/api/providers')
        .expect(401);

      expect(response.body.error.code).toBe('MISSING_AUTH_HEADER');
    });

    it('should handle pagination parameters', async () => {
      const response = await request(app)
        .get('/api/providers?limit=10&offset=0')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(200);

      expect(response.body.data.pagination.limit).toBe(10);
      expect(response.body.data.pagination.offset).toBe(0);
    });

    it('should validate pagination parameters', async () => {
      const response = await request(app)
        .get('/api/providers?limit=invalid')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/providers', () => {
    const validProviderData = {
      companyName: 'New Provider Company',
      country: 'New Country',
      addressLine1: '456 New Street',
      city: 'New City',
      stateRegion: 'New State',
      companyDescription: 'A new provider company',
      phoneNumber: '+9876543210',
      emailAddress: 'newprovider@test.com',
      corpIdTaxId: 'NEW123456',
      isIsolatedInstance: true
    };

    it('should allow system admin to create provider', async () => {
      const response = await request(app)
        .post('/api/providers')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(validProviderData)
        .expect(201);

      expect(response.body.message).toBe('Provider created successfully');
      expect(response.body.data.provider.companyName).toBe('New Provider Company');
      expect(response.body.data.provider.emailAddress).toBe('newprovider@test.com');
      expect(response.body.data.provider.isIsolatedInstance).toBe(true);
    });

    it('should deny provider admin access to create provider', async () => {
      const response = await request(app)
        .post('/api/providers')
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send(validProviderData)
        .expect(403);

      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should deny tourist access to create provider', async () => {
      const response = await request(app)
        .post('/api/providers')
        .set('Authorization', `Bearer ${touristToken}`)
        .send(validProviderData)
        .expect(403);

      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should validate required fields', async () => {
      const invalidData = { ...validProviderData };
      delete invalidData.companyName;

      const response = await request(app)
        .post('/api/providers')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toContain('"companyName" is required');
    });

    it('should validate email format', async () => {
      const invalidData = { ...validProviderData, emailAddress: 'invalid-email' };

      const response = await request(app)
        .post('/api/providers')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate phone number format', async () => {
      const invalidData = { ...validProviderData, phoneNumber: 'invalid' };

      const response = await request(app)
        .post('/api/providers')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should prevent duplicate email addresses', async () => {
      const duplicateData = { ...validProviderData, emailAddress: 'provider@test.com' };

      const response = await request(app)
        .post('/api/providers')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(duplicateData)
        .expect(409);

      expect(response.body.error.code).toBe('PROVIDER_ALREADY_EXISTS');
    });

    it('should prevent duplicate corporate ID/Tax ID', async () => {
      const duplicateData = { ...validProviderData, corpIdTaxId: 'TEST123456' };

      const response = await request(app)
        .post('/api/providers')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(duplicateData)
        .expect(409);

      expect(response.body.error.code).toBe('PROVIDER_ALREADY_EXISTS');
    });
  });

  describe('GET /api/providers/:id', () => {
    it('should allow system admin to get any provider', async () => {
      const response = await request(app)
        .get(`/api/providers/${testProviderId}`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(200);

      expect(response.body.message).toBe('Provider retrieved successfully');
      expect(response.body.data.provider.providerId).toBe(testProviderId);
      expect(response.body.data.provider.companyName).toBe('Test Provider Company');
    });

    it('should allow provider admin to get their own provider', async () => {
      const response = await request(app)
        .get(`/api/providers/${testProviderId}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(200);

      expect(response.body.message).toBe('Provider retrieved successfully');
      expect(response.body.data.provider.providerId).toBe(testProviderId);
    });

    it('should deny tourist access to provider details', async () => {
      const response = await request(app)
        .get(`/api/providers/${testProviderId}`)
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(403);

      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should return 404 for non-existent provider', async () => {
      const response = await request(app)
        .get('/api/providers/non-existent-id')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(404);

      expect(response.body.error.code).toBe('PROVIDER_NOT_FOUND');
    });

    it('should deny provider admin access to other providers', async () => {
      // Create another provider
      const anotherProvider = await providerService.createProvider({
        companyName: 'Another Provider',
        country: 'Another Country',
        addressLine1: '789 Another Street',
        city: 'Another City',
        stateRegion: 'Another State',
        companyDescription: 'Another provider company',
        phoneNumber: '+1111111111',
        emailAddress: 'another@test.com',
        corpIdTaxId: 'ANOTHER123',
        isIsolatedInstance: true
      }, UserType.SYSTEM_ADMIN);

      const response = await request(app)
        .get(`/api/providers/${anotherProvider.providerId}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(403);

      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });
  });

  describe('PUT /api/providers/:id', () => {
    const updateData = {
      companyName: 'Updated Provider Company',
      companyDescription: 'Updated description'
    };

    it('should allow system admin to update any provider', async () => {
      const response = await request(app)
        .put(`/api/providers/${testProviderId}`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.message).toBe('Provider updated successfully');
      expect(response.body.data.provider.companyName).toBe('Updated Provider Company');
      expect(response.body.data.provider.companyDescription).toBe('Updated description');
    });

    it('should allow provider admin to update their own provider', async () => {
      const response = await request(app)
        .put(`/api/providers/${testProviderId}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.message).toBe('Provider updated successfully');
      expect(response.body.data.provider.companyName).toBe('Updated Provider Company');
    });

    it('should deny tourist access to update provider', async () => {
      const response = await request(app)
        .put(`/api/providers/${testProviderId}`)
        .set('Authorization', `Bearer ${touristToken}`)
        .send(updateData)
        .expect(403);

      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should return 404 for non-existent provider', async () => {
      const response = await request(app)
        .put('/api/providers/non-existent-id')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(updateData)
        .expect(404);

      expect(response.body.error.code).toBe('PROVIDER_NOT_FOUND');
    });

    it('should validate update data', async () => {
      const invalidData = { companyName: '' };

      const response = await request(app)
        .put(`/api/providers/${testProviderId}`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should prevent duplicate email addresses on update', async () => {
      // Create another provider
      await providerService.createProvider({
        companyName: 'Another Provider',
        country: 'Another Country',
        addressLine1: '789 Another Street',
        city: 'Another City',
        stateRegion: 'Another State',
        companyDescription: 'Another provider company',
        phoneNumber: '+1111111111',
        emailAddress: 'another@test.com',
        corpIdTaxId: 'ANOTHER123',
        isIsolatedInstance: true
      }, UserType.SYSTEM_ADMIN);

      const duplicateEmailData = { emailAddress: 'another@test.com' };

      const response = await request(app)
        .put(`/api/providers/${testProviderId}`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(duplicateEmailData)
        .expect(409);

      expect(response.body.error.code).toBe('PROVIDER_ALREADY_EXISTS');
    });

    it('should deny provider admin access to update other providers', async () => {
      // Create another provider
      const anotherProvider = await providerService.createProvider({
        companyName: 'Another Provider',
        country: 'Another Country',
        addressLine1: '789 Another Street',
        city: 'Another City',
        stateRegion: 'Another State',
        companyDescription: 'Another provider company',
        phoneNumber: '+1111111111',
        emailAddress: 'another@test.com',
        corpIdTaxId: 'ANOTHER123',
        isIsolatedInstance: true
      }, UserType.SYSTEM_ADMIN);

      const response = await request(app)
        .put(`/api/providers/${anotherProvider.providerId}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send(updateData)
        .expect(403);

      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });
  });

  describe('GET /api/providers/:id/users', () => {
    it('should allow system admin to get users from any provider', async () => {
      const response = await request(app)
        .get(`/api/providers/${testProviderId}/users`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(200);

      expect(response.body.message).toBe('Provider users retrieved successfully');
      expect(response.body.data.users).toHaveLength(2); // Provider admin and tourist
      expect(response.body.data.pagination).toEqual({
        limit: 50,
        offset: 0,
        total: 2
      });

      // Verify users belong to the provider
      const users = response.body.data.users;
      expect(users.every((user: any) => user.providerId === testProviderId)).toBe(true);
      
      // Verify password hash is not included
      expect(users.every((user: any) => !user.passwordHash)).toBe(true);
    });

    it('should allow provider admin to get users from their own provider', async () => {
      const response = await request(app)
        .get(`/api/providers/${testProviderId}/users`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(200);

      expect(response.body.message).toBe('Provider users retrieved successfully');
      expect(response.body.data.users).toHaveLength(2);
      
      // Verify all users belong to the same provider
      const users = response.body.data.users;
      expect(users.every((user: any) => user.providerId === testProviderId)).toBe(true);
    });

    it('should deny provider admin access to users from other providers', async () => {
      // Create another provider with users
      const anotherProvider = await providerService.createProvider({
        companyName: 'Another Provider',
        country: 'Another Country',
        addressLine1: '789 Another Street',
        city: 'Another City',
        stateRegion: 'Another State',
        companyDescription: 'Another provider company',
        phoneNumber: '+1111111111',
        emailAddress: 'another@test.com',
        corpIdTaxId: 'ANOTHER123',
        isIsolatedInstance: true
      }, UserType.SYSTEM_ADMIN);

      const response = await request(app)
        .get(`/api/providers/${anotherProvider.providerId}/users`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(403);

      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
      expect(response.body.error.message).toContain('Insufficient permissions to access users from this provider');
    });

    it('should deny tourist access to provider user lists', async () => {
      const response = await request(app)
        .get(`/api/providers/${testProviderId}/users`)
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(403);

      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
      expect(response.body.error.message).toContain('Insufficient permissions to access provider users');
    });

    it('should return 404 for non-existent provider', async () => {
      const response = await request(app)
        .get('/api/providers/non-existent-id/users')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(404);

      expect(response.body.error.code).toBe('PROVIDER_NOT_FOUND');
    });

    it('should handle pagination parameters', async () => {
      const response = await request(app)
        .get(`/api/providers/${testProviderId}/users?limit=1&offset=0`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(200);

      expect(response.body.data.users).toHaveLength(1);
      expect(response.body.data.pagination.limit).toBe(1);
      expect(response.body.data.pagination.offset).toBe(0);
    });

    it('should validate pagination parameters', async () => {
      const response = await request(app)
        .get(`/api/providers/${testProviderId}/users?limit=invalid`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return empty array for provider with no users', async () => {
      // Create a provider without users
      const emptyProvider = await providerService.createProvider({
        companyName: 'Empty Provider',
        country: 'Empty Country',
        addressLine1: '000 Empty Street',
        city: 'Empty City',
        stateRegion: 'Empty State',
        companyDescription: 'A provider with no users',
        phoneNumber: '+0000000000',
        emailAddress: 'empty@test.com',
        corpIdTaxId: 'EMPTY123',
        isIsolatedInstance: true
      }, UserType.SYSTEM_ADMIN);

      const response = await request(app)
        .get(`/api/providers/${emptyProvider.providerId}/users`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(200);

      expect(response.body.message).toBe('Provider users retrieved successfully');
      expect(response.body.data.users).toHaveLength(0);
      expect(response.body.data.pagination.total).toBe(0);
    });

    it('should enforce data isolation between providers', async () => {
      // Create another provider with users
      const anotherProvider = await providerService.createProvider({
        companyName: 'Another Provider',
        country: 'Another Country',
        addressLine1: '789 Another Street',
        city: 'Another City',
        stateRegion: 'Another State',
        companyDescription: 'Another provider company',
        phoneNumber: '+1111111111',
        emailAddress: 'another@test.com',
        corpIdTaxId: 'ANOTHER123',
        isIsolatedInstance: true
      }, UserType.SYSTEM_ADMIN);

      // Create users for the other provider
      await userService.createUser({
        firstName: 'Another',
        lastName: 'User',
        emailAddress: 'anotheruser@test.com',
        phoneNumber: '+2222222222',
        country: 'Another Country',
        password: 'password123',
        userType: UserType.TOURIST,
        providerId: anotherProvider.providerId
      });

      // Get users from first provider - should not include users from second provider
      const response = await request(app)
        .get(`/api/providers/${testProviderId}/users`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(200);

      const users = response.body.data.users;
      expect(users).toHaveLength(2); // Only original provider's users
      expect(users.every((user: any) => user.providerId === testProviderId)).toBe(true);
      expect(users.some((user: any) => user.emailAddress === 'anotheruser@test.com')).toBe(false);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get(`/api/providers/${testProviderId}/users`)
        .expect(401);

      expect(response.body.error.code).toBe('MISSING_AUTH_HEADER');
    });

    it('should reject invalid tokens', async () => {
      const response = await request(app)
        .get(`/api/providers/${testProviderId}/users`)
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_FAILED');
    });

    it('should validate provider ID format', async () => {
      const response = await request(app)
        .get('/api/providers/invalid-uuid-format/users')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_PROVIDER_ID');
    });

    it('should order users by creation date (newest first)', async () => {
      // Create additional users with slight delays to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const newUser1 = await userService.createUser({
        firstName: 'New',
        lastName: 'User1',
        emailAddress: 'newuser1@test.com',
        phoneNumber: '+3333333333',
        country: 'Test Country',
        password: 'password123',
        userType: UserType.TOURIST,
        providerId: testProviderId
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      const newUser2 = await userService.createUser({
        firstName: 'New',
        lastName: 'User2',
        emailAddress: 'newuser2@test.com',
        phoneNumber: '+4444444444',
        country: 'Test Country',
        password: 'password123',
        userType: UserType.TOURIST,
        providerId: testProviderId
      });

      const response = await request(app)
        .get(`/api/providers/${testProviderId}/users`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(200);

      const users = response.body.data.users;
      expect(users).toHaveLength(4);
      
      // Verify ordering (newest first)
      const timestamps = users.map((user: any) => new Date(user.createdAt).getTime());
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i-1]).toBeGreaterThanOrEqual(timestamps[i]);
      }
    });
  });

  describe('DELETE /api/providers/:id', () => {
    it('should allow system admin to delete provider without dependencies', async () => {
      // Create a provider without any dependencies
      const newProvider = await providerService.createProvider({
        companyName: 'Deletable Provider',
        country: 'Delete Country',
        addressLine1: '999 Delete Street',
        city: 'Delete City',
        stateRegion: 'Delete State',
        companyDescription: 'A provider to be deleted',
        phoneNumber: '+9999999999',
        emailAddress: 'delete@test.com',
        corpIdTaxId: 'DELETE123',
        isIsolatedInstance: true
      }, UserType.SYSTEM_ADMIN);

      const response = await request(app)
        .delete(`/api/providers/${newProvider.providerId}`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(200);

      expect(response.body.message).toBe('Provider deleted successfully');

      // Verify provider is deleted
      const checkResponse = await request(app)
        .get(`/api/providers/${newProvider.providerId}`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(404);
    });

    it('should deny provider admin access to delete provider', async () => {
      const response = await request(app)
        .delete(`/api/providers/${testProviderId}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(403);

      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should deny tourist access to delete provider', async () => {
      const response = await request(app)
        .delete(`/api/providers/${testProviderId}`)
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(403);

      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should return 404 for non-existent provider', async () => {
      const response = await request(app)
        .delete('/api/providers/non-existent-id')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(404);

      expect(response.body.error.code).toBe('PROVIDER_NOT_FOUND');
    });

    it('should prevent deletion of provider with associated users', async () => {
      const response = await request(app)
        .delete(`/api/providers/${testProviderId}`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(500);

      expect(response.body.error.message).toContain('Cannot delete provider with associated users');
    });
  });

  describe('Authentication and Authorization', () => {
    it('should require authentication for all endpoints', async () => {
      const endpoints = [
        { method: 'get', path: '/api/providers' },
        { method: 'post', path: '/api/providers' },
        { method: 'get', path: `/api/providers/${testProviderId}` },
        { method: 'put', path: `/api/providers/${testProviderId}` },
        { method: 'delete', path: `/api/providers/${testProviderId}` },
        { method: 'get', path: `/api/providers/${testProviderId}/users` }
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)[endpoint.method](endpoint.path);
        expect(response.status).toBe(401);
        expect(response.body.error.code).toBe('MISSING_AUTH_HEADER');
      }
    });

    it('should reject invalid tokens', async () => {
      const response = await request(app)
        .get('/api/providers')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_FAILED');
    });

    it('should reject malformed authorization headers', async () => {
      const response = await request(app)
        .get('/api/providers')
        .set('Authorization', 'InvalidFormat')
        .expect(401);

      expect(response.body.error.code).toBe('INVALID_AUTH_HEADER');
    });
  });
});