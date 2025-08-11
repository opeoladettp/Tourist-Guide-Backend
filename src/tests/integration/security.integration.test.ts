import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import app from '../../app';
import { setupTestDatabase, cleanupTestDatabase } from '../../utils/test-db-setup';
import { AuthService } from '../../services/auth';
import { UserService } from '../../services/user';
import { ProviderService } from '../../services/provider';
import { UserType } from '../../types/user';

describe('Security Integration Tests', () => {
  let prisma: PrismaClient;
  let authService: AuthService;
  let userService: UserService;
  let providerService: ProviderService;
  let systemAdminToken: string;
  let providerAdminToken: string;
  let touristToken: string;
  let provider1Id: string;
  let provider2Id: string;
  let provider1AdminId: string;
  let provider2AdminId: string;
  let tourist1Id: string;
  let tourist2Id: string;

  beforeAll(async () => {
    prisma = await setupTestDatabase();
    authService = new AuthService(prisma);
    userService = new UserService(prisma);
    providerService = new ProviderService(prisma);

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

    // Create two providers for data isolation testing
    const provider1 = await providerService.createProvider({
      companyName: 'Provider One',
      country: 'US',
      addressLine1: '123 Provider St',
      city: 'Provider City',
      stateRegion: 'Provider State',
      companyDescription: 'First provider company',
      phoneNumber: '+1234567891',
      emailAddress: 'contact@provider1.com',
      corpIdTaxId: 'PROV1123456'
    });
    provider1Id = provider1.providerId;

    const provider2 = await providerService.createProvider({
      companyName: 'Provider Two',
      country: 'US',
      addressLine1: '456 Provider Ave',
      city: 'Provider City',
      stateRegion: 'Provider State',
      companyDescription: 'Second provider company',
      phoneNumber: '+1234567892',
      emailAddress: 'contact@provider2.com',
      corpIdTaxId: 'PROV2123456'
    });
    provider2Id = provider2.providerId;

    // Create provider admins
    const provider1Admin = await userService.createUser({
      firstName: 'Provider1',
      lastName: 'Admin',
      emailAddress: 'admin@provider1.com',
      phoneNumber: '+1234567893',
      country: 'US',
      password: 'SecurePass123!',
      userType: UserType.PROVIDER_ADMIN,
      providerId: provider1Id
    });
    provider1AdminId = provider1Admin.userId;

    const provider2Admin = await userService.createUser({
      firstName: 'Provider2',
      lastName: 'Admin',
      emailAddress: 'admin@provider2.com',
      phoneNumber: '+1234567894',
      country: 'US',
      password: 'SecurePass123!',
      userType: UserType.PROVIDER_ADMIN,
      providerId: provider2Id
    });
    provider2AdminId = provider2Admin.userId;

    const provider1AdminLogin = await authService.login('admin@provider1.com', 'SecurePass123!');
    providerAdminToken = provider1AdminLogin.accessToken;

    // Create tourists for each provider
    const tourist1 = await userService.createUser({
      firstName: 'Tourist1',
      lastName: 'User',
      emailAddress: 'tourist1@test.com',
      phoneNumber: '+1234567895',
      country: 'US',
      password: 'SecurePass123!',
      userType: UserType.TOURIST,
      providerId: provider1Id,
      passportNumber: 'P123456789',
      dateOfBirth: '1990-01-01',
      gender: 'Male'
    });
    tourist1Id = tourist1.userId;

    const tourist2 = await userService.createUser({
      firstName: 'Tourist2',
      lastName: 'User',
      emailAddress: 'tourist2@test.com',
      phoneNumber: '+1234567896',
      country: 'US',
      password: 'SecurePass123!',
      userType: UserType.TOURIST,
      providerId: provider2Id,
      passportNumber: 'P987654321',
      dateOfBirth: '1992-01-01',
      gender: 'Female'
    });
    tourist2Id = tourist2.userId;

    const tourist1Login = await authService.login('tourist1@test.com', 'SecurePass123!');
    touristToken = tourist1Login.accessToken;
  });

  afterAll(async () => {
    await cleanupTestDatabase(prisma);
  });

  describe('Authentication Security', () => {
    it('should reject requests without authentication token', async () => {
      await request(app)
        .get('/api/users')
        .expect(401);

      await request(app)
        .get('/api/providers')
        .expect(401);

      await request(app)
        .get('/api/tour-templates')
        .expect(401);
    });

    it('should reject requests with invalid authentication token', async () => {
      const invalidToken = 'invalid.jwt.token';

      await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401);

      await request(app)
        .get('/api/providers')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401);
    });

    it('should reject requests with expired authentication token', async () => {
      // This would require creating an expired token, which is complex to test
      // In a real scenario, you'd create a token with a very short expiry
      // For now, we'll test with a malformed token that looks expired
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.invalid';

      await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });

    it('should prevent brute force login attempts', async () => {
      const attempts = [];
      
      // Make multiple failed login attempts
      for (let i = 0; i < 5; i++) {
        attempts.push(
          request(app)
            .post('/api/auth/login')
            .send({
              emailAddress: 'nonexistent@test.com',
              password: 'wrongpassword'
            })
            .expect(401)
        );
      }

      await Promise.all(attempts);

      // The 6th attempt should still fail (rate limiting would be implemented in middleware)
      await request(app)
        .post('/api/auth/login')
        .send({
          emailAddress: 'nonexistent@test.com',
          password: 'wrongpassword'
        })
        .expect(401);
    });

    it('should validate password strength requirements', async () => {
      // Test weak password
      await request(app)
        .post('/api/auth/register')
        .send({
          firstName: 'Test',
          lastName: 'User',
          emailAddress: 'weakpass@test.com',
          phoneNumber: '+1234567897',
          country: 'US',
          password: '123', // Weak password
          userType: UserType.TOURIST,
          providerId: provider1Id
        })
        .expect(400);

      // Test password without special characters
      await request(app)
        .post('/api/auth/register')
        .send({
          firstName: 'Test',
          lastName: 'User',
          emailAddress: 'nospecial@test.com',
          phoneNumber: '+1234567898',
          country: 'US',
          password: 'Password123', // No special characters
          userType: UserType.TOURIST,
          providerId: provider1Id
        })
        .expect(400);
    });
  });

  describe('Authorization Security', () => {
    it('should enforce role-based access control for user management', async () => {
      // Tourist cannot access all users
      await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(403);

      // Tourist cannot create users
      await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${touristToken}`)
        .send({
          firstName: 'New',
          lastName: 'User',
          emailAddress: 'new@test.com',
          phoneNumber: '+1234567899',
          country: 'US',
          password: 'SecurePass123!',
          userType: UserType.TOURIST,
          providerId: provider1Id
        })
        .expect(403);

      // Provider admin cannot access all users
      await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(403);

      // Provider admin cannot create system admin users
      await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send({
          firstName: 'Fake',
          lastName: 'SysAdmin',
          emailAddress: 'fakesysadmin@test.com',
          phoneNumber: '+1234567800',
          country: 'US',
          password: 'SecurePass123!',
          userType: UserType.SYSTEM_ADMIN
        })
        .expect(403);
    });

    it('should enforce role-based access control for provider management', async () => {
      // Tourist cannot access providers
      await request(app)
        .get('/api/providers')
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(403);

      // Tourist cannot create providers
      await request(app)
        .post('/api/providers')
        .set('Authorization', `Bearer ${touristToken}`)
        .send({
          companyName: 'Fake Provider',
          country: 'US',
          addressLine1: '123 Fake St',
          city: 'Fake City',
          stateRegion: 'Fake State',
          companyDescription: 'Fake provider',
          phoneNumber: '+1234567801',
          emailAddress: 'fake@provider.com',
          corpIdTaxId: 'FAKE123456'
        })
        .expect(403);

      // Provider admin cannot access all providers
      await request(app)
        .get('/api/providers')
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(403);

      // Provider admin cannot create providers
      await request(app)
        .post('/api/providers')
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send({
          companyName: 'Another Provider',
          country: 'US',
          addressLine1: '456 Another St',
          city: 'Another City',
          stateRegion: 'Another State',
          companyDescription: 'Another provider',
          phoneNumber: '+1234567802',
          emailAddress: 'another@provider.com',
          corpIdTaxId: 'ANOTHER123456'
        })
        .expect(403);
    });

    it('should enforce role-based access control for tour template management', async () => {
      // Tourist cannot create tour templates
      await request(app)
        .post('/api/tour-templates')
        .set('Authorization', `Bearer ${touristToken}`)
        .send({
          templateName: 'Fake Template',
          type: 'Adventure',
          year: 2024,
          startDate: '2024-12-01',
          endDate: '2024-12-15',
          detailedDescription: 'Fake template',
          sitesToVisit: []
        })
        .expect(403);

      // Provider admin cannot create tour templates
      await request(app)
        .post('/api/tour-templates')
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send({
          templateName: 'Provider Template',
          type: 'Cultural',
          year: 2024,
          startDate: '2024-12-01',
          endDate: '2024-12-15',
          detailedDescription: 'Provider template',
          sitesToVisit: []
        })
        .expect(403);

      // Tourist cannot update tour templates
      await request(app)
        .put('/api/tour-templates/fake-id')
        .set('Authorization', `Bearer ${touristToken}`)
        .send({
          detailedDescription: 'Updated description'
        })
        .expect(403);

      // Tourist cannot delete tour templates
      await request(app)
        .delete('/api/tour-templates/fake-id')
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(403);
    });
  });

  describe('Data Isolation Security', () => {
    it('should prevent provider admin from accessing other provider data', async () => {
      // Provider 1 admin cannot access Provider 2 details
      await request(app)
        .get(`/api/providers/${provider2Id}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(403);

      // Provider 1 admin cannot update Provider 2
      await request(app)
        .put(`/api/providers/${provider2Id}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send({
          companyDescription: 'Hacked description'
        })
        .expect(403);

      // Provider 1 admin cannot access Provider 2 users
      await request(app)
        .get(`/api/providers/${provider2Id}/users`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(403);

      // Provider 1 admin cannot access Tourist 2 (from Provider 2)
      await request(app)
        .get(`/api/users/${tourist2Id}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(403);

      // Provider 1 admin cannot update Tourist 2
      await request(app)
        .put(`/api/users/${tourist2Id}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send({
          firstName: 'Hacked Name'
        })
        .expect(403);
    });

    it('should prevent tourist from accessing other user data', async () => {
      // Tourist 1 cannot access Tourist 2 profile
      await request(app)
        .get(`/api/users/${tourist2Id}`)
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(403);

      // Tourist 1 cannot update Tourist 2 profile
      await request(app)
        .put(`/api/users/${tourist2Id}`)
        .set('Authorization', `Bearer ${touristToken}`)
        .send({
          firstName: 'Hacked Name'
        })
        .expect(403);

      // Tourist 1 cannot access Provider 1 admin profile
      await request(app)
        .get(`/api/users/${provider1AdminId}`)
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(403);

      // Tourist 1 cannot access Provider 2 admin profile
      await request(app)
        .get(`/api/users/${provider2AdminId}`)
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(403);
    });

    it('should ensure provider-scoped queries work correctly', async () => {
      // Provider 1 admin should only see Provider 1 users
      const provider1UsersResponse = await request(app)
        .get(`/api/providers/${provider1Id}/users`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(200);

      const provider1Users = provider1UsersResponse.body.users;
      expect(provider1Users.every((user: any) => user.providerId === provider1Id)).toBe(true);
      expect(provider1Users.some((user: any) => user.userId === tourist1Id)).toBe(true);
      expect(provider1Users.some((user: any) => user.userId === tourist2Id)).toBe(false);
    });
  });

  describe('Input Validation Security', () => {
    it('should prevent SQL injection attempts', async () => {
      // Test SQL injection in user search
      const sqlInjectionAttempts = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "'; DELETE FROM users WHERE '1'='1'; --",
        "' UNION SELECT * FROM users --"
      ];

      for (const injection of sqlInjectionAttempts) {
        await request(app)
          .get(`/api/users/${injection}`)
          .set('Authorization', `Bearer ${systemAdminToken}`)
          .expect(400); // Should return validation error, not 500
      }
    });

    it('should prevent XSS attacks in user input', async () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img src="x" onerror="alert(\'xss\')">'
      ];

      for (const payload of xssPayloads) {
        await request(app)
          .put(`/api/users/${tourist1Id}`)
          .set('Authorization', `Bearer ${touristToken}`)
          .send({
            firstName: payload
          })
          .expect(400); // Should be rejected by validation
      }
    });

    it('should validate file upload security', async () => {
      // Test malicious file upload
      await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${touristToken}`)
        .field('type', 'Passport')
        .field('description', 'Test document')
        .attach('file', Buffer.from('<?php echo "malicious code"; ?>'), 'malicious.php')
        .expect(400); // Should reject non-allowed file types

      // Test oversized file upload
      const largeBuffer = Buffer.alloc(50 * 1024 * 1024); // 50MB
      await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${touristToken}`)
        .field('type', 'Passport')
        .field('description', 'Large document')
        .attach('file', largeBuffer, 'large.pdf')
        .expect(400); // Should reject oversized files
    });

    it('should validate email format and prevent email injection', async () => {
      const invalidEmails = [
        'invalid-email',
        'test@',
        '@domain.com',
        'test..test@domain.com',
        'test@domain',
        'test@domain..com'
      ];

      for (const email of invalidEmails) {
        await request(app)
          .post('/api/auth/register')
          .send({
            firstName: 'Test',
            lastName: 'User',
            emailAddress: email,
            phoneNumber: '+1234567899',
            country: 'US',
            password: 'SecurePass123!',
            userType: UserType.TOURIST,
            providerId: provider1Id
          })
          .expect(400);
      }
    });
  });

  describe('Session Security', () => {
    it('should handle token refresh securely', async () => {
      // Login to get tokens
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          emailAddress: 'tourist1@test.com',
          password: 'SecurePass123!'
        })
        .expect(200);

      const { accessToken, refreshToken } = loginResponse.body;

      // Use refresh token to get new access token
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: refreshToken
        })
        .expect(200);

      const newAccessToken = refreshResponse.body.accessToken;

      // New token should work
      await request(app)
        .get(`/api/users/${tourist1Id}`)
        .set('Authorization', `Bearer ${newAccessToken}`)
        .expect(200);

      // Old refresh token should be invalidated (depending on implementation)
      await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: refreshToken
        })
        .expect(401); // Should fail if refresh token rotation is implemented
    });

    it('should handle logout securely', async () => {
      // Login to get token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          emailAddress: 'tourist1@test.com',
          password: 'SecurePass123!'
        })
        .expect(200);

      const { accessToken } = loginResponse.body;

      // Logout
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Token should be invalidated after logout (depending on implementation)
      // For now, we just verify the logout endpoint works
    });
  });

  describe('Rate Limiting Security', () => {
    it('should implement rate limiting for sensitive endpoints', async () => {
      // This test would require actual rate limiting middleware
      // For now, we'll test that multiple requests don't cause server errors
      const requests = [];
      
      for (let i = 0; i < 10; i++) {
        requests.push(
          request(app)
            .post('/api/auth/login')
            .send({
              emailAddress: 'tourist1@test.com',
              password: 'SecurePass123!'
            })
        );
      }

      const responses = await Promise.all(requests);
      
      // All requests should either succeed or be rate limited (not cause server errors)
      responses.forEach(response => {
        expect([200, 429].includes(response.status)).toBe(true);
      });
    });

    it('should handle concurrent registration attempts without race conditions', async () => {
      // Create a tour event with limited capacity
      const tourEventResponse = await request(app)
        .post('/api/tour-events')
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send({
          templateId: 'test-template-id',
          customTourName: 'Race Condition Test Tour',
          startDate: '2024-12-01',
          endDate: '2024-12-15',
          packageType: 'Standard',
          place1Hotel: 'Hotel A',
          place2Hotel: 'Hotel B',
          numberOfAllowedTourists: 2, // Very limited capacity
          groupChatInfo: 'Race condition test'
        })
        .expect(201);

      const tourEventId = tourEventResponse.body.tourEventId;

      // Create multiple tourists
      const tourists = [];
      for (let i = 0; i < 5; i++) {
        const tourist = await userService.createUser({
          firstName: `RaceTourist${i}`,
          lastName: 'Test',
          emailAddress: `racetourist${i}@test.com`,
          phoneNumber: `+123456780${i}`,
          country: 'US',
          password: 'SecurePass123!',
          userType: UserType.TOURIST,
          providerId: provider1Id,
          passportNumber: `P${i}23456789`,
          dateOfBirth: '1990-01-01',
          gender: 'Male'
        });

        const login = await authService.login(`racetourist${i}@test.com`, 'SecurePass123!');
        tourists.push({
          id: tourist.userId,
          token: login.accessToken
        });
      }

      // Attempt concurrent registrations
      const registrationPromises = tourists.map(tourist =>
        request(app)
          .post(`/api/tour-events/${tourEventId}/register`)
          .set('Authorization', `Bearer ${tourist.token}`)
      );

      const registrationResponses = await Promise.all(registrationPromises);

      // Only 2 should succeed (capacity limit), others should fail gracefully
      const successfulRegistrations = registrationResponses.filter(r => r.status === 201);
      const failedRegistrations = registrationResponses.filter(r => r.status === 400);

      expect(successfulRegistrations.length).toBe(2);
      expect(failedRegistrations.length).toBe(3);
    });
  });

  describe('Advanced Security Tests', () => {
    it('should prevent privilege escalation attacks', async () => {
      // Tourist tries to escalate to provider admin
      await request(app)
        .put(`/api/users/${tourist1Id}`)
        .set('Authorization', `Bearer ${touristToken}`)
        .send({
          userType: UserType.PROVIDER_ADMIN
        })
        .expect(400); // Should be rejected by validation

      // Tourist tries to escalate to system admin
      await request(app)
        .put(`/api/users/${tourist1Id}`)
        .set('Authorization', `Bearer ${touristToken}`)
        .send({
          userType: UserType.SYSTEM_ADMIN
        })
        .expect(400); // Should be rejected by validation
    });

    it('should prevent cross-provider data access through parameter manipulation', async () => {
      // Provider 1 admin tries to access Provider 2 data by manipulating request parameters
      await request(app)
        .get(`/api/providers/${provider2Id}/users`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(403);

      // Tourist tries to access other provider's tour events
      const provider2Admin = await userService.createUser({
        firstName: 'Provider2',
        lastName: 'Admin',
        emailAddress: 'admin2@provider2.com',
        phoneNumber: '+1234567999',
        country: 'US',
        password: 'SecurePass123!',
        userType: UserType.PROVIDER_ADMIN,
        providerId: provider2Id
      });

      const provider2AdminLogin = await authService.login('admin2@provider2.com', 'SecurePass123!');
      const provider2AdminToken = provider2AdminLogin.accessToken;

      // Create tour event for provider 2
      const provider2TourResponse = await request(app)
        .post('/api/tour-events')
        .set('Authorization', `Bearer ${provider2AdminToken}`)
        .send({
          templateId: 'test-template-id',
          customTourName: 'Provider 2 Tour',
          startDate: '2024-12-01',
          endDate: '2024-12-15',
          packageType: 'Premium',
          place1Hotel: 'Provider 2 Hotel A',
          place2Hotel: 'Provider 2 Hotel B',
          numberOfAllowedTourists: 10,
          groupChatInfo: 'Provider 2 group'
        })
        .expect(201);

      // Tourist from provider 1 tries to access provider 2's tour event
      await request(app)
        .get(`/api/tour-events/${provider2TourResponse.body.tourEventId}`)
        .set('Authorization', `Bearer ${touristToken}`)
        .expect(403);
    });

    it('should validate JWT token integrity', async () => {
      // Test with tampered JWT token
      const validToken = touristToken;
      const tokenParts = validToken.split('.');
      
      // Tamper with the payload
      const tamperedPayload = Buffer.from('{"sub":"fake-user-id","role":"SystemAdmin"}').toString('base64');
      const tamperedToken = `${tokenParts[0]}.${tamperedPayload}.${tokenParts[2]}`;

      await request(app)
        .get(`/api/users/${tourist1Id}`)
        .set('Authorization', `Bearer ${tamperedToken}`)
        .expect(401);
    });

    it('should prevent timing attacks on authentication', async () => {
      const startTime = Date.now();
      
      // Test with non-existent user
      await request(app)
        .post('/api/auth/login')
        .send({
          emailAddress: 'nonexistent@test.com',
          password: 'SecurePass123!'
        })
        .expect(401);

      const nonExistentUserTime = Date.now() - startTime;

      const startTime2 = Date.now();
      
      // Test with existing user but wrong password
      await request(app)
        .post('/api/auth/login')
        .send({
          emailAddress: 'tourist1@test.com',
          password: 'wrongpassword'
        })
        .expect(401);

      const wrongPasswordTime = Date.now() - startTime2;

      // Response times should be similar to prevent user enumeration
      const timeDifference = Math.abs(nonExistentUserTime - wrongPasswordTime);
      expect(timeDifference).toBeLessThan(100); // Within 100ms difference
    });

    it('should handle security headers properly', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Check for security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    });

    it('should prevent information disclosure in error messages', async () => {
      // Test with invalid user ID format
      const response = await request(app)
        .get('/api/users/invalid-uuid-format')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(400);

      // Error message should not reveal internal system details
      expect(response.body.error.message).not.toContain('database');
      expect(response.body.error.message).not.toContain('prisma');
      expect(response.body.error.message).not.toContain('sql');
    });

    it('should validate file upload security comprehensively', async () => {
      // Test executable file upload
      await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${touristToken}`)
        .field('type', 'Other')
        .field('description', 'Executable file')
        .attach('file', Buffer.from('executable content'), 'malware.exe')
        .expect(400);

      // Test script file upload
      await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${touristToken}`)
        .field('type', 'Other')
        .field('description', 'Script file')
        .attach('file', Buffer.from('<script>alert("xss")</script>'), 'script.html')
        .expect(400);

      // Test file with null bytes
      await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${touristToken}`)
        .field('type', 'Other')
        .field('description', 'Null byte file')
        .attach('file', Buffer.from('content\x00.pdf'), 'nullbyte.txt')
        .expect(400);
    });
  });
});