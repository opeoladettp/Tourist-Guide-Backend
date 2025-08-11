import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { setupTestDatabase, cleanupTestDatabase } from '../../utils/test-db-setup';
import { PrismaClient } from '../../generated/prisma';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { UserType } from '../../types/user';

// Mock file storage service
vi.mock('../../services/file-storage', () => ({
  fileStorageService: {
    uploadFile: vi.fn().mockResolvedValue({
      key: 'documents/user123/Passport/test-file.pdf',
      url: 'https://test-bucket.s3.amazonaws.com/documents/user123/Passport/test-file.pdf',
      size: 1024,
      etag: '"test-etag"',
    }),
    generatePresignedUrl: vi.fn().mockResolvedValue('https://signed-url.com/download'),
    deleteFile: vi.fn().mockResolvedValue(undefined),
  },
  FileStorageService: vi.fn(),
}));

describe('Document Management Integration Tests', () => {
  let prisma: PrismaClient;
  let systemAdminToken: string;
  let providerAdminToken: string;
  let touristToken: string;
  let systemAdminUser: any;
  let providerAdminUser: any;
  let touristUser: any;
  let provider: any;

  beforeEach(async () => {
    prisma = await setupTestDatabase();

    // Create test provider
    provider = await prisma.provider.create({
      data: {
        companyName: 'Test Tours Inc',
        country: 'USA',
        addressLine1: '123 Test St',
        city: 'Test City',
        stateRegion: 'Test State',
        companyDescription: 'Test tour company',
        phoneNumber: '+1234567890',
        emailAddress: 'test@testtours.com',
        corpIdTaxId: 'TEST123',
        isIsolatedInstance: false,
      },
    });

    // Create test users
    systemAdminUser = await prisma.user.create({
      data: {
        firstName: 'System',
        lastName: 'Admin',
        emailAddress: 'sysadmin@test.com',
        phoneNumber: '+1234567890',
        country: 'USA',
        passwordHash: 'hashedpassword',
        userType: UserType.SYSTEM_ADMIN,
        status: 'Active',
      },
    });

    providerAdminUser = await prisma.user.create({
      data: {
        firstName: 'Provider',
        lastName: 'Admin',
        emailAddress: 'provideradmin@test.com',
        phoneNumber: '+1234567891',
        country: 'USA',
        passwordHash: 'hashedpassword',
        userType: UserType.PROVIDER_ADMIN,
        status: 'Active',
        providerId: provider.providerId,
      },
    });

    touristUser = await prisma.user.create({
      data: {
        firstName: 'Tourist',
        lastName: 'User',
        emailAddress: 'tourist@test.com',
        phoneNumber: '+1234567892',
        country: 'USA',
        passwordHash: 'hashedpassword',
        userType: UserType.TOURIST,
        status: 'Active',
        providerId: provider.providerId,
        passportNumber: 'P123456789',
        dateOfBirth: new Date('1990-01-01'),
        gender: 'Male',
      },
    });

    // Generate JWT tokens
    systemAdminToken = jwt.sign(
      {
        sub: systemAdminUser.userId,
        email: systemAdminUser.emailAddress,
        role: systemAdminUser.userType,
      },
      config.jwt.secret,
      { expiresIn: '1h' }
    );

    providerAdminToken = jwt.sign(
      {
        sub: providerAdminUser.userId,
        email: providerAdminUser.emailAddress,
        role: providerAdminUser.userType,
        providerId: provider.providerId,
      },
      config.jwt.secret,
      { expiresIn: '1h' }
    );

    touristToken = jwt.sign(
      {
        sub: touristUser.userId,
        email: touristUser.emailAddress,
        role: touristUser.userType,
        providerId: provider.providerId,
      },
      config.jwt.secret,
      { expiresIn: '1h' }
    );
  });

  afterEach(async () => {
    await cleanupTestDatabase();
  });

  describe('POST /api/documents', () => {
    it('should upload document successfully for tourist', async () => {
      const response = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${touristToken}`)
        .attach('file', Buffer.from('test file content'), 'test.pdf')
        .field('type', 'Passport')
        .field('description', 'Test passport document');

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        message: 'Document uploaded successfully',
        document: {
          documentId: expect.any(String),
          userId: touristUser.userId,
          type: 'Passport',
          fileName: 'test.pdf',
          description: 'Test passport document',
          fileSize: expect.any(Number),
          mimeType: 'application/pdf',
        },
      });
    });

    it('should allow provider admin to upload document for company user', async () => {
      const response = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${providerAdminToken}`)
        .attach('file', Buffer.from('test file content'), 'test.pdf')
        .field('targetUserId', touristUser.userId)
        .field('type', 'TourForm')
        .field('description', 'Tour form for tourist');

      expect(response.status).toBe(201);
      expect(response.body.document.userId).toBe(touristUser.userId);
    });

    it('should reject upload without file', async () => {
      const response = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${touristToken}`)
        .field('type', 'Passport');

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_FILE');
    });

    it('should reject unauthorized access', async () => {
      const response = await request(app)
        .post('/api/documents')
        .attach('file', Buffer.from('test file content'), 'test.pdf')
        .field('type', 'Passport');

      expect(response.status).toBe(401);
    });

    it('should reject tourist uploading for other users', async () => {
      const response = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${touristToken}`)
        .attach('file', Buffer.from('test file content'), 'test.pdf')
        .field('targetUserId', systemAdminUser.userId)
        .field('type', 'Passport');

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/documents', () => {
    let testDocument: any;

    beforeEach(async () => {
      testDocument = await prisma.document.create({
        data: {
          userId: touristUser.userId,
          type: 'Passport',
          fileName: 'test.pdf',
          description: 'Test document',
          uploadedByUserId: touristUser.userId,
          fileStoragePath: 'documents/test/test.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
        },
      });
    });

    it('should return documents for tourist (own documents only)', async () => {
      const response = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${touristToken}`);

      expect(response.status).toBe(200);
      expect(response.body.documents).toHaveLength(1);
      expect(response.body.documents[0].documentId).toBe(testDocument.documentId);
    });

    it('should return documents for provider admin (company documents)', async () => {
      const response = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${providerAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.documents).toHaveLength(1);
    });

    it('should return all documents for system admin', async () => {
      const response = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${systemAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.documents).toHaveLength(1);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/documents?limit=10&offset=0')
        .set('Authorization', `Bearer ${touristToken}`);

      expect(response.status).toBe(200);
      expect(response.body.pagination).toMatchObject({
        limit: 10,
        offset: 0,
        total: expect.any(Number),
      });
    });

    it('should reject excessive limit', async () => {
      const response = await request(app)
        .get('/api/documents?limit=200')
        .set('Authorization', `Bearer ${touristToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_LIMIT');
    });
  });

  describe('GET /api/documents/:id', () => {
    let testDocument: any;

    beforeEach(async () => {
      testDocument = await prisma.document.create({
        data: {
          userId: touristUser.userId,
          type: 'Passport',
          fileName: 'test.pdf',
          description: 'Test document',
          uploadedByUserId: touristUser.userId,
          fileStoragePath: 'documents/test/test.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
        },
      });
    });

    it('should return document for authorized user', async () => {
      const response = await request(app)
        .get(`/api/documents/${testDocument.documentId}`)
        .set('Authorization', `Bearer ${touristToken}`);

      expect(response.status).toBe(200);
      expect(response.body.document).toMatchObject({
        documentId: testDocument.documentId,
        userId: touristUser.userId,
        type: 'Passport',
        fileName: 'test.pdf',
      });
    });

    it('should return 404 for non-existent document', async () => {
      const response = await request(app)
        .get('/api/documents/non-existent-id')
        .set('Authorization', `Bearer ${touristToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('DOCUMENT_NOT_FOUND');
    });

    it('should reject unauthorized access to other user documents', async () => {
      // Create another user
      const otherUser = await prisma.user.create({
        data: {
          firstName: 'Other',
          lastName: 'User',
          emailAddress: 'other@test.com',
          phoneNumber: '+1234567893',
          country: 'USA',
          passwordHash: 'hashedpassword',
          userType: UserType.TOURIST,
          status: 'Active',
          providerId: provider.providerId,
        },
      });

      const otherToken = jwt.sign(
        {
          sub: otherUser.userId,
          email: otherUser.emailAddress,
          role: otherUser.userType,
          providerId: provider.providerId,
        },
        config.jwt.secret,
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get(`/api/documents/${testDocument.documentId}`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/documents/:id', () => {
    let testDocument: any;

    beforeEach(async () => {
      testDocument = await prisma.document.create({
        data: {
          userId: touristUser.userId,
          type: 'Passport',
          fileName: 'test.pdf',
          description: 'Test document',
          uploadedByUserId: touristUser.userId,
          fileStoragePath: 'documents/test/test.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
        },
      });
    });

    it('should delete document successfully for owner', async () => {
      const response = await request(app)
        .delete(`/api/documents/${testDocument.documentId}`)
        .set('Authorization', `Bearer ${touristToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Document deleted successfully');

      // Verify document is deleted
      const deletedDocument = await prisma.document.findUnique({
        where: { documentId: testDocument.documentId },
      });
      expect(deletedDocument).toBeNull();
    });

    it('should allow system admin to delete any document', async () => {
      const response = await request(app)
        .delete(`/api/documents/${testDocument.documentId}`)
        .set('Authorization', `Bearer ${systemAdminToken}`);

      expect(response.status).toBe(200);
    });

    it('should return 404 for non-existent document', async () => {
      const response = await request(app)
        .delete('/api/documents/non-existent-id')
        .set('Authorization', `Bearer ${touristToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('DOCUMENT_NOT_FOUND');
    });

    it('should reject deletion by non-owner', async () => {
      const response = await request(app)
        .delete(`/api/documents/${testDocument.documentId}`)
        .set('Authorization', `Bearer ${providerAdminToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/documents/:id/download', () => {
    let testDocument: any;

    beforeEach(async () => {
      testDocument = await prisma.document.create({
        data: {
          userId: touristUser.userId,
          type: 'Passport',
          fileName: 'test.pdf',
          description: 'Test document',
          uploadedByUserId: touristUser.userId,
          fileStoragePath: 'documents/test/test.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
        },
      });
    });

    it('should generate download URL for authorized user', async () => {
      const response = await request(app)
        .get(`/api/documents/${testDocument.documentId}/download`)
        .set('Authorization', `Bearer ${touristToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        downloadUrl: 'https://signed-url.com/download',
        expiresIn: 3600,
        expiresAt: expect.any(String),
      });
    });

    it('should support custom expiration time', async () => {
      const response = await request(app)
        .get(`/api/documents/${testDocument.documentId}/download?expiresIn=1800`)
        .set('Authorization', `Bearer ${touristToken}`);

      expect(response.status).toBe(200);
      expect(response.body.expiresIn).toBe(1800);
    });

    it('should return 404 for non-existent document', async () => {
      const response = await request(app)
        .get('/api/documents/non-existent-id/download')
        .set('Authorization', `Bearer ${touristToken}`);

      expect(response.status).toBe(404);
    });

    it('should reject unauthorized access', async () => {
      const response = await request(app)
        .get(`/api/documents/${testDocument.documentId}/download`);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/documents/search', () => {
    let testDocuments: any[];

    beforeEach(async () => {
      // Create test documents with different types and properties
      testDocuments = await Promise.all([
        prisma.document.create({
          data: {
            userId: touristUser.userId,
            type: 'PASSPORT',
            fileName: 'passport.pdf',
            description: 'My passport document',
            uploadedByUserId: touristUser.userId,
            fileStoragePath: 'documents/test/passport.pdf',
            fileSize: 1024,
            mimeType: 'application/pdf',
          },
        }),
        prisma.document.create({
          data: {
            userId: touristUser.userId,
            type: 'TICKET',
            fileName: 'flight_ticket.jpg',
            description: 'Flight booking',
            uploadedByUserId: touristUser.userId,
            fileStoragePath: 'documents/test/ticket.jpg',
            fileSize: 2048,
            mimeType: 'image/jpeg',
          },
        }),
        prisma.document.create({
          data: {
            userId: providerUser.userId,
            type: 'TOUR_FORM',
            fileName: 'registration.pdf',
            description: 'Tour registration form',
            uploadedByUserId: providerUser.userId,
            fileStoragePath: 'documents/test/form.pdf',
            fileSize: 1536,
            mimeType: 'application/pdf',
          },
        }),
      ]);
    });

    it('should search documents by type', async () => {
      const response = await request(app)
        .get('/api/documents/search')
        .query({ type: 'Passport' })
        .set('Authorization', `Bearer ${touristToken}`);

      expect(response.status).toBe(200);
      expect(response.body.documents).toHaveLength(1);
      expect(response.body.documents[0].type).toBe('Passport');
    });

    it('should search documents by file name', async () => {
      const response = await request(app)
        .get('/api/documents/search')
        .query({ fileName: 'passport' })
        .set('Authorization', `Bearer ${touristToken}`);

      expect(response.status).toBe(200);
      expect(response.body.documents).toHaveLength(1);
      expect(response.body.documents[0].fileName).toContain('passport');
    });

    it('should search documents with date range', async () => {
      const dateFrom = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // Yesterday
      const dateTo = new Date().toISOString(); // Now

      const response = await request(app)
        .get('/api/documents/search')
        .query({ dateFrom, dateTo })
        .set('Authorization', `Bearer ${touristToken}`);

      expect(response.status).toBe(200);
      expect(response.body.documents.length).toBeGreaterThan(0);
    });

    it('should apply pagination', async () => {
      const response = await request(app)
        .get('/api/documents/search')
        .query({ limit: 1, offset: 0 })
        .set('Authorization', `Bearer ${touristToken}`);

      expect(response.status).toBe(200);
      expect(response.body.documents).toHaveLength(1);
      expect(response.body.pagination.limit).toBe(1);
      expect(response.body.pagination.offset).toBe(0);
    });

    it('should apply sorting', async () => {
      const response = await request(app)
        .get('/api/documents/search')
        .query({ sortBy: 'fileName', sortOrder: 'asc' })
        .set('Authorization', `Bearer ${touristToken}`);

      expect(response.status).toBe(200);
      expect(response.body.searchCriteria.sortBy).toBe('fileName');
      expect(response.body.searchCriteria.sortOrder).toBe('asc');
    });

    it('should reject invalid date format', async () => {
      const response = await request(app)
        .get('/api/documents/search')
        .query({ dateFrom: 'invalid-date' })
        .set('Authorization', `Bearer ${touristToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_DATE_FORMAT');
    });

    it('should apply role-based filtering for provider admin', async () => {
      const response = await request(app)
        .get('/api/documents/search')
        .set('Authorization', `Bearer ${providerAdminToken}`);

      expect(response.status).toBe(200);
      // Should only see documents from users in their provider
      const userIds = response.body.documents.map((doc: any) => doc.userId);
      expect(userIds.every((id: string) => [providerUser.userId, providerAdminUser.userId].includes(id))).toBe(true);
    });
  });

  describe('GET /api/documents/:id/metadata', () => {
    let testDocument: any;

    beforeEach(async () => {
      testDocument = await prisma.document.create({
        data: {
          userId: touristUser.userId,
          type: 'PASSPORT',
          fileName: 'passport.pdf',
          description: 'Test document',
          uploadedByUserId: touristUser.userId,
          fileStoragePath: 'documents/test/test.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
        },
      });
    });

    it('should return document metadata for authorized user', async () => {
      const response = await request(app)
        .get(`/api/documents/${testDocument.documentId}/metadata`)
        .set('Authorization', `Bearer ${touristToken}`);

      expect(response.status).toBe(200);
      expect(response.body.metadata).toMatchObject({
        documentId: testDocument.documentId,
        originalFileName: 'passport.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        version: 1,
        isActive: true,
      });
    });

    it('should reject unauthorized access', async () => {
      const response = await request(app)
        .get(`/api/documents/${testDocument.documentId}/metadata`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(response.status).toBe(403);
    });

    it('should return 404 for non-existent document', async () => {
      const response = await request(app)
        .get('/api/documents/nonexistent/metadata')
        .set('Authorization', `Bearer ${touristToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/documents/statistics', () => {
    beforeEach(async () => {
      // Create test documents for statistics
      await Promise.all([
        prisma.document.create({
          data: {
            userId: touristUser.userId,
            type: 'PASSPORT',
            fileName: 'passport1.pdf',
            uploadedByUserId: touristUser.userId,
            fileStoragePath: 'documents/test/passport1.pdf',
            fileSize: 1024,
            mimeType: 'application/pdf',
          },
        }),
        prisma.document.create({
          data: {
            userId: touristUser.userId,
            type: 'TICKET',
            fileName: 'ticket1.jpg',
            uploadedByUserId: touristUser.userId,
            fileStoragePath: 'documents/test/ticket1.jpg',
            fileSize: 2048,
            mimeType: 'image/jpeg',
          },
        }),
      ]);
    });

    it('should return document statistics for tourist', async () => {
      const response = await request(app)
        .get('/api/documents/statistics')
        .set('Authorization', `Bearer ${touristToken}`);

      expect(response.status).toBe(200);
      expect(response.body.statistics).toMatchObject({
        totalDocuments: 2,
        documentsByType: {
          Passport: 1,
          Ticket: 1,
          TourForm: 0,
          Other: 0,
        },
        totalFileSize: 3072,
        averageFileSize: 1536,
      });
    });

    it('should return statistics for system admin', async () => {
      const response = await request(app)
        .get('/api/documents/statistics')
        .set('Authorization', `Bearer ${systemAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.statistics.totalDocuments).toBeGreaterThanOrEqual(2);
    });
  });

  describe('GET /api/documents/:id/validate', () => {
    let testDocument: any;

    beforeEach(async () => {
      testDocument = await prisma.document.create({
        data: {
          userId: touristUser.userId,
          type: 'PASSPORT',
          fileName: 'passport.pdf',
          description: 'Test document',
          uploadedByUserId: touristUser.userId,
          fileStoragePath: 'documents/test/test.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
        },
      });
    });

    it('should validate document integrity', async () => {
      const response = await request(app)
        .get(`/api/documents/${testDocument.documentId}/validate`)
        .set('Authorization', `Bearer ${touristToken}`);

      expect(response.status).toBe(200);
      expect(response.body.validation).toHaveProperty('isValid');
      expect(response.body.validation).toHaveProperty('issues');
    });

    it('should reject unauthorized access', async () => {
      const response = await request(app)
        .get(`/api/documents/${testDocument.documentId}/validate`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/documents/forms/blank', () => {
    it('should return list of available blank forms', async () => {
      const response = await request(app)
        .get('/api/documents/forms/blank')
        .set('Authorization', `Bearer ${touristToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        forms: expect.any(Array),
        total: expect.any(Number),
        message: 'Available blank forms retrieved successfully',
      });

      // Check that forms have required properties
      if (response.body.forms.length > 0) {
        expect(response.body.forms[0]).toMatchObject({
          id: expect.any(String),
          name: expect.any(String),
          description: expect.any(String),
          category: expect.any(String),
          version: expect.any(String),
          fileSize: expect.any(Number),
          lastUpdated: expect.any(String),
        });
      }
    });

    it('should filter forms by category', async () => {
      const response = await request(app)
        .get('/api/documents/forms/blank')
        .query({ category: 'registration' })
        .set('Authorization', `Bearer ${touristToken}`);

      expect(response.status).toBe(200);
      expect(response.body.forms).toBeInstanceOf(Array);
      
      // All returned forms should be in the registration category
      response.body.forms.forEach((form: any) => {
        expect(form.category).toBe('registration');
      });
    });

    it('should work for all user types', async () => {
      const tokens = [touristToken, providerAdminToken, systemAdminToken];
      
      for (const token of tokens) {
        const response = await request(app)
          .get('/api/documents/forms/blank')
          .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body.forms).toBeInstanceOf(Array);
      }
    });

    it('should reject unauthorized access', async () => {
      const response = await request(app)
        .get('/api/documents/forms/blank');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/documents/forms/:formId/download', () => {
    it('should generate download URL for valid form', async () => {
      // First get available forms to get a valid form ID
      const formsResponse = await request(app)
        .get('/api/documents/forms/blank')
        .set('Authorization', `Bearer ${touristToken}`);

      expect(formsResponse.status).toBe(200);
      expect(formsResponse.body.forms.length).toBeGreaterThan(0);

      const formId = formsResponse.body.forms[0].id;

      const response = await request(app)
        .get(`/api/documents/forms/${formId}/download`)
        .set('Authorization', `Bearer ${touristToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        downloadUrl: expect.any(String),
        fileName: expect.any(String),
        fileSize: expect.any(Number),
        mimeType: expect.any(String),
        expiresAt: expect.any(String),
        message: 'Form download URL generated successfully',
      });
    });

    it('should support custom expiration time', async () => {
      const formsResponse = await request(app)
        .get('/api/documents/forms/blank')
        .set('Authorization', `Bearer ${touristToken}`);

      const formId = formsResponse.body.forms[0].id;

      const response = await request(app)
        .get(`/api/documents/forms/${formId}/download`)
        .query({ expiresIn: 1800 })
        .set('Authorization', `Bearer ${touristToken}`);

      expect(response.status).toBe(200);
      
      // Check that expiration time is approximately 30 minutes from now
      const expiresAt = new Date(response.body.expiresAt);
      const expectedExpiry = new Date(Date.now() + 1800 * 1000);
      const timeDiff = Math.abs(expiresAt.getTime() - expectedExpiry.getTime());
      expect(timeDiff).toBeLessThan(5000); // Within 5 seconds
    });

    it('should return 404 for non-existent form', async () => {
      const response = await request(app)
        .get('/api/documents/forms/non-existent-form/download')
        .set('Authorization', `Bearer ${touristToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('FORM_NOT_FOUND');
    });

    it('should reject unauthorized access', async () => {
      const response = await request(app)
        .get('/api/documents/forms/some-form/download');

      expect(response.status).toBe(401);
    });

    it('should work for all user types', async () => {
      const formsResponse = await request(app)
        .get('/api/documents/forms/blank')
        .set('Authorization', `Bearer ${touristToken}`);

      const formId = formsResponse.body.forms[0].id;
      const tokens = [touristToken, providerAdminToken, systemAdminToken];
      
      for (const token of tokens) {
        const response = await request(app)
          .get(`/api/documents/forms/${formId}/download`)
          .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
      }
    });
  });

  describe('GET /api/documents/forms/download/:formId', () => {
    it('should serve form file with valid signature', async () => {
      // First get a download URL
      const formsResponse = await request(app)
        .get('/api/documents/forms/blank')
        .set('Authorization', `Bearer ${touristToken}`);

      const formId = formsResponse.body.forms[0].id;

      const downloadResponse = await request(app)
        .get(`/api/documents/forms/${formId}/download`)
        .set('Authorization', `Bearer ${touristToken}`);

      expect(downloadResponse.status).toBe(200);

      // Extract signature and expires from the download URL
      const downloadUrl = new URL(downloadResponse.body.downloadUrl);
      const expires = downloadUrl.searchParams.get('expires');
      const signature = downloadUrl.searchParams.get('signature');

      // Test direct file download
      const fileResponse = await request(app)
        .get(`/api/documents/forms/download/${formId}`)
        .query({ expires, signature })
        .set('Authorization', `Bearer ${touristToken}`);

      expect(fileResponse.status).toBe(200);
      expect(fileResponse.headers['content-type']).toBe('application/pdf');
      expect(fileResponse.headers['content-disposition']).toContain('attachment');
      expect(fileResponse.body).toBeInstanceOf(Buffer);
    });

    it('should reject invalid signature', async () => {
      const formsResponse = await request(app)
        .get('/api/documents/forms/blank')
        .set('Authorization', `Bearer ${touristToken}`);

      const formId = formsResponse.body.forms[0].id;

      const response = await request(app)
        .get(`/api/documents/forms/download/${formId}`)
        .query({ expires: Date.now() + 3600000, signature: 'invalid-signature' })
        .set('Authorization', `Bearer ${touristToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('INVALID_SIGNATURE');
    });

    it('should reject expired signature', async () => {
      const formsResponse = await request(app)
        .get('/api/documents/forms/blank')
        .set('Authorization', `Bearer ${touristToken}`);

      const formId = formsResponse.body.forms[0].id;

      // Create an expired signature
      const expiredTime = Date.now() - 1000; // 1 second ago
      const expiredSignature = Buffer.from(`${formId}-${expiredTime - 3600000}-3600`).toString('base64');

      const response = await request(app)
        .get(`/api/documents/forms/download/${formId}`)
        .query({ expires: expiredTime, signature: expiredSignature })
        .set('Authorization', `Bearer ${touristToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('INVALID_SIGNATURE');
    });

    it('should return 404 for non-existent form', async () => {
      const response = await request(app)
        .get('/api/documents/forms/download/non-existent-form')
        .set('Authorization', `Bearer ${touristToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('FORM_NOT_FOUND');
    });

    it('should work without signature for authenticated users', async () => {
      const formsResponse = await request(app)
        .get('/api/documents/forms/blank')
        .set('Authorization', `Bearer ${touristToken}`);

      const formId = formsResponse.body.forms[0].id;

      const response = await request(app)
        .get(`/api/documents/forms/download/${formId}`)
        .set('Authorization', `Bearer ${touristToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
    });
  });

  describe('GET /api/documents/types/:type', () => {
    beforeEach(async () => {
      await Promise.all([
        prisma.document.create({
          data: {
            userId: touristUser.userId,
            type: 'PASSPORT',
            fileName: 'passport1.pdf',
            uploadedByUserId: touristUser.userId,
            fileStoragePath: 'documents/test/passport1.pdf',
            fileSize: 1024,
            mimeType: 'application/pdf',
          },
        }),
        prisma.document.create({
          data: {
            userId: touristUser.userId,
            type: 'PASSPORT',
            fileName: 'passport2.pdf',
            uploadedByUserId: touristUser.userId,
            fileStoragePath: 'documents/test/passport2.pdf',
            fileSize: 2048,
            mimeType: 'application/pdf',
          },
        }),
        prisma.document.create({
          data: {
            userId: touristUser.userId,
            type: 'TICKET',
            fileName: 'ticket1.jpg',
            uploadedByUserId: touristUser.userId,
            fileStoragePath: 'documents/test/ticket1.jpg',
            fileSize: 1536,
            mimeType: 'image/jpeg',
          },
        }),
      ]);
    });

    it('should return documents of specific type', async () => {
      const response = await request(app)
        .get('/api/documents/types/Passport')
        .set('Authorization', `Bearer ${touristToken}`);

      expect(response.status).toBe(200);
      expect(response.body.documents).toHaveLength(2);
      expect(response.body.documents.every((doc: any) => doc.type === 'Passport')).toBe(true);
      expect(response.body.documentType).toBe('Passport');
    });

    it('should apply pagination to type-specific results', async () => {
      const response = await request(app)
        .get('/api/documents/types/Passport')
        .query({ limit: 1 })
        .set('Authorization', `Bearer ${touristToken}`);

      expect(response.status).toBe(200);
      expect(response.body.documents).toHaveLength(1);
      expect(response.body.pagination.limit).toBe(1);
    });

    it('should reject invalid document type', async () => {
      const response = await request(app)
        .get('/api/documents/types/InvalidType')
        .set('Authorization', `Bearer ${touristToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_DOCUMENT_TYPE');
    });

    it('should return empty array for type with no documents', async () => {
      const response = await request(app)
        .get('/api/documents/types/TourForm')
        .set('Authorization', `Bearer ${touristToken}`);

      expect(response.status).toBe(200);
      expect(response.body.documents).toHaveLength(0);
    });
  });
});