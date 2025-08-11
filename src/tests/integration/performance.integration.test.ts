import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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

describe('Performance Integration Tests', () => {
  let prisma: PrismaClient;
  let authService: AuthService;
  let userService: UserService;
  let providerService: ProviderService;
  let tourTemplateService: TourTemplateService;
  let customTourEventService: CustomTourEventService;
  let systemAdminToken: string;
  let providerAdminToken: string;
  let providerId: string;
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

    const systemAdminLogin = await authService.login('sysadmin@test.com', 'SecurePass123!');
    systemAdminToken = systemAdminLogin.accessToken;

    // Create provider
    const provider = await providerService.createProvider({
      companyName: 'Performance Test Provider',
      country: 'US',
      addressLine1: '123 Performance St',
      city: 'Performance City',
      stateRegion: 'Performance State',
      companyDescription: 'Provider for performance testing',
      phoneNumber: '+1234567891',
      emailAddress: 'contact@perftest.com',
      corpIdTaxId: 'PERF123456'
    });
    providerId = provider.providerId;

    // Create provider admin
    const providerAdmin = await userService.createUser({
      firstName: 'Provider',
      lastName: 'Admin',
      emailAddress: 'admin@perftest.com',
      phoneNumber: '+1234567892',
      country: 'US',
      password: 'SecurePass123!',
      userType: UserType.PROVIDER_ADMIN,
      providerId: providerId
    });

    const providerAdminLogin = await authService.login('admin@perftest.com', 'SecurePass123!');
    providerAdminToken = providerAdminLogin.accessToken;

    // Create tour template
    const template = await tourTemplateService.createTourTemplate({
      templateName: 'Performance Test Tour',
      type: 'Performance',
      year: 2024,
      startDate: new Date('2024-12-01'),
      endDate: new Date('2024-12-15'),
      detailedDescription: 'Tour template for performance testing',
      sitesToVisit: [
        {
          siteName: 'Performance Site',
          location: 'Performance Location',
          visitDuration: 120,
          category: 'Cultural',
          orderIndex: 1,
          estimatedCost: 25.00,
          description: 'Performance testing site'
        }
      ]
    });
    templateId = template.templateId;
  });

  afterAll(async () => {
    await cleanupTestDatabase(prisma);
  });

  describe('High Load Scenarios', () => {
    it('should handle concurrent user creation requests', async () => {
      const startTime = Date.now();
      const concurrentRequests = 20;
      const requests = [];

      for (let i = 0; i < concurrentRequests; i++) {
        requests.push(
          request(app)
            .post('/api/users')
            .set('Authorization', `Bearer ${systemAdminToken}`)
            .send({
              firstName: `ConcurrentUser${i}`,
              lastName: 'Test',
              emailAddress: `concurrent${i}@test.com`,
              phoneNumber: `+123456789${i.toString().padStart(2, '0')}`,
              country: 'US',
              password: 'SecurePass123!',
              userType: UserType.TOURIST,
              providerId: providerId,
              passportNumber: `P${i.toString().padStart(9, '0')}`,
              dateOfBirth: '1990-01-01',
              gender: 'Male'
            })
        );
      }

      const responses = await Promise.all(requests);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
      });

      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(10000); // 10 seconds
      
      console.log(`Concurrent user creation: ${concurrentRequests} requests in ${duration}ms`);
      console.log(`Average response time: ${duration / concurrentRequests}ms per request`);
    });

    it('should handle concurrent tour event registrations', async () => {
      // Create a tour event
      const tourEventResponse = await request(app)
        .post('/api/tour-events')
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .send({
          templateId: templateId,
          customTourName: 'Concurrent Registration Test Tour',
          startDate: '2024-12-01',
          endDate: '2024-12-15',
          packageType: 'Standard',
          place1Hotel: 'Hotel A',
          place2Hotel: 'Hotel B',
          numberOfAllowedTourists: 50,
          groupChatInfo: 'Concurrent test group'
        })
        .expect(201);

      const tourEventId = tourEventResponse.body.tourEventId;

      // Create multiple tourists
      const tourists = [];
      for (let i = 0; i < 15; i++) {
        const tourist = await userService.createUser({
          firstName: `Tourist${i}`,
          lastName: 'Concurrent',
          emailAddress: `tourist${i}@concurrent.com`,
          phoneNumber: `+123456780${i}`,
          country: 'US',
          password: 'SecurePass123!',
          userType: UserType.TOURIST,
          providerId: providerId,
          passportNumber: `P${(i + 100).toString()}456789`,
          dateOfBirth: '1990-01-01',
          gender: 'Male'
        });

        const login = await authService.login(`tourist${i}@concurrent.com`, 'SecurePass123!');
        tourists.push({
          id: tourist.userId,
          token: login.accessToken
        });
      }

      // Concurrent registration attempts
      const startTime = Date.now();
      const registrationRequests = tourists.map(tourist =>
        request(app)
          .post(`/api/tour-events/${tourEventId}/register`)
          .set('Authorization', `Bearer ${tourist.token}`)
      );

      const registrationResponses = await Promise.all(registrationRequests);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // All registrations should succeed
      registrationResponses.forEach(response => {
        expect(response.status).toBe(201);
      });

      console.log(`Concurrent registrations: ${tourists.length} requests in ${duration}ms`);
      console.log(`Average response time: ${duration / tourists.length}ms per request`);

      // Verify capacity is correctly managed
      const tourEventStatus = await request(app)
        .get(`/api/tour-events/${tourEventId}`)
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .expect(200);

      expect(tourEventStatus.body.remainingTourists).toBe(50 - tourists.length);
    });

    it('should handle concurrent document uploads', async () => {
      // Create a tourist for document uploads
      const tourist = await userService.createUser({
        firstName: 'Document',
        lastName: 'Uploader',
        emailAddress: 'docuploader@test.com',
        phoneNumber: '+1234567999',
        country: 'US',
        password: 'SecurePass123!',
        userType: UserType.TOURIST,
        providerId: providerId,
        passportNumber: 'P999888777',
        dateOfBirth: '1990-01-01',
        gender: 'Male'
      });

      const login = await authService.login('docuploader@test.com', 'SecurePass123!');
      const touristToken = login.accessToken;

      const startTime = Date.now();
      const concurrentUploads = 10;
      const uploadRequests = [];

      for (let i = 0; i < concurrentUploads; i++) {
        uploadRequests.push(
          request(app)
            .post('/api/documents')
            .set('Authorization', `Bearer ${touristToken}`)
            .field('type', 'Other')
            .field('description', `Concurrent upload test document ${i}`)
            .attach('file', Buffer.from(`Document content ${i}`), `document${i}.txt`)
        );
      }

      const uploadResponses = await Promise.all(uploadRequests);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // All uploads should succeed
      uploadResponses.forEach(response => {
        expect(response.status).toBe(201);
      });

      console.log(`Concurrent uploads: ${concurrentUploads} requests in ${duration}ms`);
      console.log(`Average response time: ${duration / concurrentUploads}ms per request`);
    });
  });

  describe('Database Query Performance', () => {
    it('should efficiently handle large user datasets', async () => {
      // Create many users for pagination testing
      const userCount = 100;
      const batchSize = 10;
      
      for (let batch = 0; batch < userCount / batchSize; batch++) {
        const batchRequests = [];
        
        for (let i = 0; i < batchSize; i++) {
          const userIndex = batch * batchSize + i;
          batchRequests.push(
            request(app)
              .post('/api/users')
              .set('Authorization', `Bearer ${systemAdminToken}`)
              .send({
                firstName: `User${userIndex}`,
                lastName: 'Performance',
                emailAddress: `user${userIndex}@perf.com`,
                phoneNumber: `+1234${userIndex.toString().padStart(6, '0')}`,
                country: 'US',
                password: 'SecurePass123!',
                userType: UserType.TOURIST,
                providerId: providerId,
                passportNumber: `P${userIndex.toString().padStart(9, '0')}`,
                dateOfBirth: '1990-01-01',
                gender: userIndex % 2 === 0 ? 'Male' : 'Female'
              })
          );
        }
        
        await Promise.all(batchRequests);
      }

      // Test pagination performance
      const startTime = Date.now();
      
      const paginationTests = [
        request(app)
          .get('/api/users?page=1&limit=20')
          .set('Authorization', `Bearer ${systemAdminToken}`),
        request(app)
          .get('/api/users?page=3&limit=20')
          .set('Authorization', `Bearer ${systemAdminToken}`),
        request(app)
          .get('/api/users?page=5&limit=20')
          .set('Authorization', `Bearer ${systemAdminToken}`)
      ];

      const paginationResponses = await Promise.all(paginationTests);
      const endTime = Date.now();
      const duration = endTime - startTime;

      paginationResponses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.users).toHaveLength(20);
      });

      console.log(`Pagination queries: ${paginationTests.length} requests in ${duration}ms`);
      console.log(`Average response time: ${duration / paginationTests.length}ms per request`);

      // Response time should be reasonable even with large dataset
      expect(duration / paginationTests.length).toBeLessThan(1000); // Less than 1 second per query
    });

    it('should efficiently handle complex tour event queries', async () => {
      // Create multiple tour events
      const tourEventCount = 20;
      const tourEventIds = [];

      for (let i = 0; i < tourEventCount; i++) {
        const tourEventResponse = await request(app)
          .post('/api/tour-events')
          .set('Authorization', `Bearer ${providerAdminToken}`)
          .send({
            templateId: templateId,
            customTourName: `Performance Tour ${i}`,
            startDate: `2024-12-${(i % 28 + 1).toString().padStart(2, '0')}`,
            endDate: `2024-12-${((i % 28 + 1) + 7).toString().padStart(2, '0')}`,
            packageType: i % 2 === 0 ? 'Standard' : 'Premium',
            place1Hotel: `Hotel ${i}A`,
            place2Hotel: `Hotel ${i}B`,
            numberOfAllowedTourists: 20 + (i % 10),
            groupChatInfo: `Group ${i}`
          })
          .expect(201);

        tourEventIds.push(tourEventResponse.body.tourEventId);
      }

      // Test complex queries
      const startTime = Date.now();
      
      const complexQueries = [
        request(app)
          .get('/api/tour-events')
          .set('Authorization', `Bearer ${providerAdminToken}`),
        request(app)
          .get('/api/tour-events?status=ACTIVE')
          .set('Authorization', `Bearer ${providerAdminToken}`),
        request(app)
          .get('/api/tour-events?packageType=Premium')
          .set('Authorization', `Bearer ${providerAdminToken}`)
      ];

      const queryResponses = await Promise.all(complexQueries);
      const endTime = Date.now();
      const duration = endTime - startTime;

      queryResponses.forEach(response => {
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body.tourEvents)).toBe(true);
      });

      console.log(`Complex tour event queries: ${complexQueries.length} requests in ${duration}ms`);
      console.log(`Average response time: ${duration / complexQueries.length}ms per request`);

      // Response time should be reasonable
      expect(duration / complexQueries.length).toBeLessThan(2000); // Less than 2 seconds per query
    });

    it('should efficiently handle document search queries', async () => {
      // Create a tourist with many documents
      const tourist = await userService.createUser({
        firstName: 'Document',
        lastName: 'Owner',
        emailAddress: 'docowner@test.com',
        phoneNumber: '+1234567888',
        country: 'US',
        password: 'SecurePass123!',
        userType: UserType.TOURIST,
        providerId: providerId,
        passportNumber: 'P888777666',
        dateOfBirth: '1990-01-01',
        gender: 'Female'
      });

      const login = await authService.login('docowner@test.com', 'SecurePass123!');
      const touristToken = login.accessToken;

      // Upload many documents
      const documentCount = 50;
      const documentTypes = ['Passport', 'Ticket', 'TourForm', 'Other'];
      
      for (let i = 0; i < documentCount; i++) {
        await request(app)
          .post('/api/documents')
          .set('Authorization', `Bearer ${touristToken}`)
          .field('type', documentTypes[i % documentTypes.length])
          .field('description', `Search test document ${i}`)
          .attach('file', Buffer.from(`Document content ${i}`), `searchdoc${i}.txt`)
          .expect(201);
      }

      // Test search performance
      const startTime = Date.now();
      
      const searchQueries = [
        request(app)
          .get('/api/documents/search?type=Passport')
          .set('Authorization', `Bearer ${touristToken}`),
        request(app)
          .get('/api/documents/search?fileName=searchdoc')
          .set('Authorization', `Bearer ${touristToken}`),
        request(app)
          .get('/api/documents/search?description=test')
          .set('Authorization', `Bearer ${touristToken}`),
        request(app)
          .get('/api/documents?page=1&limit=10')
          .set('Authorization', `Bearer ${touristToken}`)
      ];

      const searchResponses = await Promise.all(searchQueries);
      const endTime = Date.now();
      const duration = endTime - startTime;

      searchResponses.forEach(response => {
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body.documents)).toBe(true);
      });

      console.log(`Document search queries: ${searchQueries.length} requests in ${duration}ms`);
      console.log(`Average response time: ${duration / searchQueries.length}ms per request`);

      // Response time should be reasonable
      expect(duration / searchQueries.length).toBeLessThan(1500); // Less than 1.5 seconds per query
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should handle large file uploads efficiently', async () => {
      const tourist = await userService.createUser({
        firstName: 'Large',
        lastName: 'Uploader',
        emailAddress: 'largeuploader@test.com',
        phoneNumber: '+1234567777',
        country: 'US',
        password: 'SecurePass123!',
        userType: UserType.TOURIST,
        providerId: providerId,
        passportNumber: 'P777666555',
        dateOfBirth: '1990-01-01',
        gender: 'Male'
      });

      const login = await authService.login('largeuploader@test.com', 'SecurePass123!');
      const touristToken = login.accessToken;

      // Test with moderately large file (within limits)
      const largeFileSize = 5 * 1024 * 1024; // 5MB
      const largeBuffer = Buffer.alloc(largeFileSize, 'a');

      const startTime = Date.now();
      
      const uploadResponse = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${touristToken}`)
        .field('type', 'Other')
        .field('description', 'Large file upload test')
        .attach('file', largeBuffer, 'largefile.txt')
        .expect(201);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(uploadResponse.body.documentId).toBeDefined();
      
      console.log(`Large file upload (${largeFileSize} bytes): ${duration}ms`);
      
      // Should complete within reasonable time
      expect(duration).toBeLessThan(30000); // Less than 30 seconds
    });

    it('should handle multiple simultaneous API calls without memory leaks', async () => {
      const startTime = Date.now();
      const simultaneousRequests = 50;
      const requests = [];

      // Mix of different API calls
      for (let i = 0; i < simultaneousRequests; i++) {
        const requestType = i % 4;
        
        switch (requestType) {
          case 0:
            requests.push(
              request(app)
                .get('/api/tour-templates')
                .set('Authorization', `Bearer ${systemAdminToken}`)
            );
            break;
          case 1:
            requests.push(
              request(app)
                .get('/api/providers')
                .set('Authorization', `Bearer ${systemAdminToken}`)
            );
            break;
          case 2:
            requests.push(
              request(app)
                .get('/api/tour-events')
                .set('Authorization', `Bearer ${providerAdminToken}`)
            );
            break;
          case 3:
            requests.push(
              request(app)
                .get('/api/users')
                .set('Authorization', `Bearer ${systemAdminToken}`)
            );
            break;
        }
      }

      const responses = await Promise.all(requests);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect([200, 403].includes(response.status)).toBe(true); // Some may be forbidden based on auth
      });

      console.log(`Simultaneous API calls: ${simultaneousRequests} requests in ${duration}ms`);
      console.log(`Average response time: ${duration / simultaneousRequests}ms per request`);

      // Should complete within reasonable time
      expect(duration).toBeLessThan(15000); // Less than 15 seconds
    });
  });

  describe('Response Time Benchmarks', () => {
    it('should meet response time requirements for critical endpoints', async () => {
      const benchmarks = [
        {
          name: 'User Authentication',
          request: () => request(app)
            .post('/api/auth/login')
            .send({
              emailAddress: 'admin@perftest.com',
              password: 'SecurePass123!'
            }),
          maxTime: 2000 // 2 seconds
        },
        {
          name: 'User Profile Retrieval',
          request: () => request(app)
            .get(`/api/providers/${providerId}/users`)
            .set('Authorization', `Bearer ${providerAdminToken}`),
          maxTime: 1000 // 1 second
        },
        {
          name: 'Tour Template Listing',
          request: () => request(app)
            .get('/api/tour-templates')
            .set('Authorization', `Bearer ${systemAdminToken}`),
          maxTime: 1500 // 1.5 seconds
        },
        {
          name: 'Tour Event Creation',
          request: () => request(app)
            .post('/api/tour-events')
            .set('Authorization', `Bearer ${providerAdminToken}`)
            .send({
              templateId: templateId,
              customTourName: `Benchmark Tour ${Date.now()}`,
              startDate: '2024-12-20',
              endDate: '2024-12-30',
              packageType: 'Standard',
              place1Hotel: 'Benchmark Hotel A',
              place2Hotel: 'Benchmark Hotel B',
              numberOfAllowedTourists: 25,
              groupChatInfo: 'Benchmark group'
            }),
          maxTime: 2000 // 2 seconds
        }
      ];

      for (const benchmark of benchmarks) {
        const startTime = Date.now();
        const response = await benchmark.request();
        const endTime = Date.now();
        const duration = endTime - startTime;

        expect(response.status).toBeLessThan(400); // Should not be an error
        expect(duration).toBeLessThan(benchmark.maxTime);

        console.log(`${benchmark.name}: ${duration}ms (max: ${benchmark.maxTime}ms)`);
      }
    });

    it('should handle API endpoint stress testing', async () => {
      const stressTests = [
        {
          name: 'Health Check Stress',
          endpoint: '/health',
          method: 'GET',
          concurrent: 50,
          maxTime: 5000
        },
        {
          name: 'Authentication Stress',
          endpoint: '/api/auth/login',
          method: 'POST',
          body: {
            emailAddress: 'admin@perftest.com',
            password: 'SecurePass123!'
          },
          concurrent: 20,
          maxTime: 10000
        },
        {
          name: 'Tour Templates Stress',
          endpoint: '/api/tour-templates',
          method: 'GET',
          headers: { Authorization: `Bearer ${systemAdminToken}` },
          concurrent: 30,
          maxTime: 8000
        }
      ];

      for (const test of stressTests) {
        const startTime = Date.now();
        const requests = [];

        for (let i = 0; i < test.concurrent; i++) {
          let requestPromise;
          
          if (test.method === 'GET') {
            requestPromise = request(app)
              .get(test.endpoint)
              .set(test.headers || {});
          } else if (test.method === 'POST') {
            requestPromise = request(app)
              .post(test.endpoint)
              .set(test.headers || {})
              .send(test.body || {});
          }

          requests.push(requestPromise);
        }

        const responses = await Promise.all(requests);
        const endTime = Date.now();
        const duration = endTime - startTime;

        // Most requests should succeed
        const successfulResponses = responses.filter(r => r.status < 400);
        const successRate = (successfulResponses.length / responses.length) * 100;

        expect(successRate).toBeGreaterThan(80); // At least 80% success rate
        expect(duration).toBeLessThan(test.maxTime);

        console.log(`${test.name}: ${test.concurrent} requests in ${duration}ms (${successRate.toFixed(1)}% success)`);
      }
    });

    it('should maintain performance under mixed workload', async () => {
      const startTime = Date.now();
      const mixedRequests = [];

      // Create mixed workload
      for (let i = 0; i < 100; i++) {
        const requestType = i % 5;
        
        switch (requestType) {
          case 0: // Health checks
            mixedRequests.push(
              request(app).get('/health')
            );
            break;
          case 1: // Authentication
            mixedRequests.push(
              request(app)
                .post('/api/auth/login')
                .send({
                  emailAddress: 'admin@perftest.com',
                  password: 'SecurePass123!'
                })
            );
            break;
          case 2: // Tour templates
            mixedRequests.push(
              request(app)
                .get('/api/tour-templates')
                .set('Authorization', `Bearer ${systemAdminToken}`)
            );
            break;
          case 3: // User profile
            mixedRequests.push(
              request(app)
                .get(`/api/providers/${providerId}/users`)
                .set('Authorization', `Bearer ${providerAdminToken}`)
            );
            break;
          case 4: // Tour events
            mixedRequests.push(
              request(app)
                .get('/api/tour-events')
                .set('Authorization', `Bearer ${providerAdminToken}`)
            );
            break;
        }
      }

      const responses = await Promise.all(mixedRequests);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Analyze results
      const successfulResponses = responses.filter(r => r.status < 400);
      const successRate = (successfulResponses.length / responses.length) * 100;
      const averageResponseTime = duration / responses.length;

      expect(successRate).toBeGreaterThan(85); // At least 85% success rate
      expect(averageResponseTime).toBeLessThan(200); // Average under 200ms
      expect(duration).toBeLessThan(20000); // Total under 20 seconds

      console.log(`Mixed workload: ${responses.length} requests in ${duration}ms`);
      console.log(`Success rate: ${successRate.toFixed(1)}%`);
      console.log(`Average response time: ${averageResponseTime.toFixed(1)}ms`);
    });
  });

  describe('Scalability Tests', () => {
    it('should handle increasing user load gracefully', async () => {
      const loadLevels = [10, 25, 50, 75, 100];
      const results = [];

      for (const userCount of loadLevels) {
        const startTime = Date.now();
        const requests = [];

        // Create concurrent user authentication requests
        for (let i = 0; i < userCount; i++) {
          requests.push(
            request(app)
              .post('/api/auth/login')
              .send({
                emailAddress: 'admin@perftest.com',
                password: 'SecurePass123!'
              })
          );
        }

        const responses = await Promise.all(requests);
        const endTime = Date.now();
        const duration = endTime - startTime;

        const successfulResponses = responses.filter(r => r.status === 200);
        const successRate = (successfulResponses.length / responses.length) * 100;
        const averageResponseTime = duration / responses.length;

        results.push({
          userCount,
          duration,
          successRate,
          averageResponseTime
        });

        console.log(`Load test ${userCount} users: ${duration}ms total, ${averageResponseTime.toFixed(1)}ms avg, ${successRate.toFixed(1)}% success`);

        // Performance should degrade gracefully
        expect(successRate).toBeGreaterThan(70); // At least 70% success even under high load
        expect(averageResponseTime).toBeLessThan(1000); // Average under 1 second
      }

      // Verify that performance degrades gracefully (not exponentially)
      for (let i = 1; i < results.length; i++) {
        const current = results[i];
        const previous = results[i - 1];
        
        // Response time should not increase more than 3x
        const responseTimeIncrease = current.averageResponseTime / previous.averageResponseTime;
        expect(responseTimeIncrease).toBeLessThan(3);
      }
    });

    it('should handle database connection pooling efficiently', async () => {
      const connectionTests = [];
      
      // Create many concurrent database operations
      for (let i = 0; i < 50; i++) {
        connectionTests.push(
          request(app)
            .get('/health/database')
            .expect(200)
        );
      }

      const startTime = Date.now();
      const responses = await Promise.all(connectionTests);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // All database health checks should succeed
      responses.forEach(response => {
        expect(response.body.database).toBe('connected');
      });

      // Should complete within reasonable time
      expect(duration).toBeLessThan(5000); // Under 5 seconds

      console.log(`Database connection test: ${connectionTests.length} concurrent connections in ${duration}ms`);
    });
  });
});