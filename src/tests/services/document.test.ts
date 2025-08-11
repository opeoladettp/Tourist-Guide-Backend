import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PrismaClient } from '../../generated/prisma';
import { DocumentService } from '../../services/document';
import { DocumentType } from '../../types/document';
import { UserType } from '../../types/user';
import { FileStorageService } from '../../services/file-storage';

// Mock the file storage service
const mockFileStorageService = {
  uploadFile: vi.fn(),
  deleteFile: vi.fn(),
  generatePresignedUrl: vi.fn(),
  fileExists: vi.fn(),
  getFileMetadata: vi.fn(),
} as unknown as FileStorageService;

// Mock Prisma client
const mockPrisma = {
  document: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
    aggregate: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
} as unknown as PrismaClient;

describe('DocumentService', () => {
  let documentService: DocumentService;

  beforeEach(() => {
    documentService = new DocumentService(mockPrisma, mockFileStorageService);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('uploadDocument', () => {
    const validDocumentInput = {
      userId: 'user123',
      type: DocumentType.PASSPORT,
      fileName: 'passport.pdf',
      description: 'My passport document',
      fileBuffer: Buffer.from('test file content'),
      mimeType: 'application/pdf',
    };

    const mockUploadResult = {
      key: 'documents/user123/Passport/passport.pdf',
      url: 'https://test-bucket.s3.amazonaws.com/documents/user123/Passport/passport.pdf',
      etag: '"test-etag"',
      size: 17,
    };

    const mockCreatedDocument = {
      documentId: 'doc123',
      userId: 'user123',
      type: 'PASSPORT',
      fileName: 'passport.pdf',
      description: 'My passport document',
      uploadedByUserId: 'user123',
      uploadDate: new Date(),
      fileStoragePath: 'documents/user123/Passport/passport.pdf',
      fileSize: 17,
      mimeType: 'application/pdf',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should upload document successfully for tourist', async () => {
      mockFileStorageService.uploadFile = vi.fn().mockResolvedValue(mockUploadResult);
      mockPrisma.document.create = vi.fn().mockResolvedValue(mockCreatedDocument);

      const result = await documentService.uploadDocument(
        validDocumentInput,
        'user123',
        UserType.TOURIST
      );

      expect(result.documentId).toBe('doc123');
      expect(result.type).toBe(DocumentType.PASSPORT);
      expect(mockFileStorageService.uploadFile).toHaveBeenCalledWith(
        validDocumentInput.fileBuffer,
        expect.objectContaining({
          originalName: 'passport.pdf',
          mimeType: 'application/pdf',
          size: 17,
          userId: 'user123',
          documentType: DocumentType.PASSPORT,
        })
      );
    });

    it('should validate document type specific rules', async () => {
      const tourFormInput = {
        ...validDocumentInput,
        type: DocumentType.TOUR_FORM,
        description: undefined, // Missing required description
      };

      await expect(
        documentService.uploadDocument(tourFormInput, 'user123', UserType.TOURIST)
      ).rejects.toThrow('Description is required for TourForm');
    });

    it('should reject invalid file types', async () => {
      const invalidInput = {
        ...validDocumentInput,
        mimeType: 'application/exe',
      };

      await expect(
        documentService.uploadDocument(invalidInput, 'user123', UserType.TOURIST)
      ).rejects.toThrow('Invalid file type');
    });

    it('should reject oversized files', async () => {
      const oversizedInput = {
        ...validDocumentInput,
        fileBuffer: Buffer.alloc(11 * 1024 * 1024), // 11MB
      };

      await expect(
        documentService.uploadDocument(oversizedInput, 'user123', UserType.TOURIST)
      ).rejects.toThrow('File size exceeds maximum limit');
    });

    it('should enforce provider admin permissions', async () => {
      const targetUser = {
        userId: 'target123',
        providerId: 'provider456',
      };

      mockPrisma.user.findUnique = vi.fn().mockResolvedValue(targetUser);

      const inputForOtherUser = {
        ...validDocumentInput,
        userId: 'target123',
      };

      await expect(
        documentService.uploadDocument(
          inputForOtherUser,
          'admin123',
          UserType.PROVIDER_ADMIN,
          'provider789' // Different provider
        )
      ).rejects.toThrow('Insufficient permissions');
    });

    it('should allow provider admin to upload for company users', async () => {
      const targetUser = {
        userId: 'target123',
        providerId: 'provider456',
      };

      mockPrisma.user.findUnique = vi.fn().mockResolvedValue(targetUser);
      mockFileStorageService.uploadFile = vi.fn().mockResolvedValue(mockUploadResult);
      mockPrisma.document.create = vi.fn().mockResolvedValue({
        ...mockCreatedDocument,
        userId: 'target123',
      });

      const inputForCompanyUser = {
        ...validDocumentInput,
        userId: 'target123',
      };

      const result = await documentService.uploadDocument(
        inputForCompanyUser,
        'admin123',
        UserType.PROVIDER_ADMIN,
        'provider456' // Same provider
      );

      expect(result.userId).toBe('target123');
    });
  });

  describe('searchDocuments', () => {
    const mockSearchResults = [
      {
        documentId: 'doc1',
        userId: 'user123',
        type: 'PASSPORT',
        fileName: 'passport.pdf',
        description: 'My passport',
        uploadedByUserId: 'user123',
        uploadDate: new Date('2024-01-01'),
        fileStoragePath: 'documents/user123/passport.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        user: {
          userId: 'user123',
          firstName: 'John',
          lastName: 'Doe',
          emailAddress: 'john@example.com',
        },
      },
    ];

    it('should search documents with basic criteria', async () => {
      mockPrisma.document.count = vi.fn().mockResolvedValue(1);
      mockPrisma.document.findMany = vi.fn().mockResolvedValue(mockSearchResults);

      const searchCriteria = {
        type: DocumentType.PASSPORT,
        limit: 10,
        offset: 0,
      };

      const result = await documentService.searchDocuments(
        searchCriteria,
        'user123',
        UserType.TOURIST
      );

      expect(result.documents).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
      expect(result.documents[0].type).toBe(DocumentType.PASSPORT);
    });

    it('should apply role-based filtering for provider admin', async () => {
      mockPrisma.document.count = vi.fn().mockResolvedValue(1);
      mockPrisma.document.findMany = vi.fn().mockResolvedValue(mockSearchResults);

      const searchCriteria = {
        fileName: 'passport',
        limit: 10,
        offset: 0,
      };

      await documentService.searchDocuments(
        searchCriteria,
        'admin123',
        UserType.PROVIDER_ADMIN,
        'provider456'
      );

      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            user: {
              providerId: 'provider456',
            },
            fileName: {
              contains: 'passport',
              mode: 'insensitive',
            },
          }),
        })
      );
    });

    it('should apply date range filtering', async () => {
      mockPrisma.document.count = vi.fn().mockResolvedValue(1);
      mockPrisma.document.findMany = vi.fn().mockResolvedValue(mockSearchResults);

      const dateFrom = new Date('2024-01-01');
      const dateTo = new Date('2024-12-31');

      const searchCriteria = {
        dateFrom,
        dateTo,
        limit: 10,
        offset: 0,
      };

      await documentService.searchDocuments(
        searchCriteria,
        'user123',
        UserType.SYSTEM_ADMIN
      );

      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            uploadDate: {
              gte: dateFrom,
              lte: dateTo,
            },
          }),
        })
      );
    });

    it('should support sorting options', async () => {
      mockPrisma.document.count = vi.fn().mockResolvedValue(1);
      mockPrisma.document.findMany = vi.fn().mockResolvedValue(mockSearchResults);

      const searchCriteria = {
        sortBy: 'fileName' as const,
        sortOrder: 'asc' as const,
        limit: 10,
        offset: 0,
      };

      await documentService.searchDocuments(
        searchCriteria,
        'user123',
        UserType.SYSTEM_ADMIN
      );

      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: {
            fileName: 'asc',
          },
        })
      );
    });

    it('should handle pagination correctly', async () => {
      mockPrisma.document.count = vi.fn().mockResolvedValue(25);
      mockPrisma.document.findMany = vi.fn().mockResolvedValue(mockSearchResults);

      const searchCriteria = {
        limit: 10,
        offset: 10,
      };

      const result = await documentService.searchDocuments(
        searchCriteria,
        'user123',
        UserType.SYSTEM_ADMIN
      );

      expect(result.hasMore).toBe(true);
      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 10,
        })
      );
    });
  });

  describe('getDocumentMetadata', () => {
    const mockDocument = {
      documentId: 'doc123',
      userId: 'user123',
      type: DocumentType.PASSPORT,
      fileName: 'passport.pdf',
      description: 'My passport',
      uploadedByUserId: 'user123',
      uploadDate: new Date('2024-01-01'),
      fileStoragePath: 'documents/user123/passport.pdf',
      fileSize: 1024,
      mimeType: 'application/pdf',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    };

    const mockStorageMetadata = {
      size: 1024,
      contentType: 'application/pdf',
      lastModified: new Date('2024-01-02'),
      etag: '"test-etag"',
    };

    it('should return document metadata for authorized user', async () => {
      // Mock the getDocumentById method
      vi.spyOn(documentService, 'getDocumentById').mockResolvedValue(mockDocument);
      mockFileStorageService.getFileMetadata = vi.fn().mockResolvedValue(mockStorageMetadata);

      const metadata = await documentService.getDocumentMetadata(
        'doc123',
        'user123',
        UserType.TOURIST
      );

      expect(metadata).toEqual({
        documentId: 'doc123',
        originalFileName: 'passport.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        uploadDate: mockDocument.uploadDate,
        lastModified: mockStorageMetadata.lastModified,
        version: 1,
        isActive: true,
        tags: [],
      });
    });

    it('should return null for non-existent document', async () => {
      vi.spyOn(documentService, 'getDocumentById').mockResolvedValue(null);

      const metadata = await documentService.getDocumentMetadata(
        'nonexistent',
        'user123',
        UserType.TOURIST
      );

      expect(metadata).toBeNull();
    });

    it('should use document updatedAt when storage metadata unavailable', async () => {
      vi.spyOn(documentService, 'getDocumentById').mockResolvedValue(mockDocument);
      mockFileStorageService.getFileMetadata = vi.fn().mockResolvedValue(null);

      const metadata = await documentService.getDocumentMetadata(
        'doc123',
        'user123',
        UserType.TOURIST
      );

      expect(metadata?.lastModified).toEqual(mockDocument.updatedAt);
    });
  });

  describe('getDocumentStatistics', () => {
    const mockCountResult = 5;
    const mockGroupByResult = [
      { type: 'PASSPORT', _count: { type: 2 } },
      { type: 'TICKET', _count: { type: 1 } },
      { type: 'TOUR_FORM', _count: { type: 1 } },
      { type: 'OTHER', _count: { type: 1 } },
    ];
    const mockAggregateResult = {
      _sum: { fileSize: 5120 },
      _avg: { fileSize: 1024 },
    };

    it('should return document statistics for system admin', async () => {
      mockPrisma.document.count = vi.fn().mockResolvedValue(mockCountResult);
      mockPrisma.document.groupBy = vi.fn().mockResolvedValue(mockGroupByResult);
      mockPrisma.document.aggregate = vi.fn().mockResolvedValue(mockAggregateResult);

      const stats = await documentService.getDocumentStatistics(
        'admin123',
        UserType.SYSTEM_ADMIN
      );

      expect(stats).toEqual({
        totalDocuments: 5,
        documentsByType: {
          [DocumentType.PASSPORT]: 2,
          [DocumentType.TICKET]: 1,
          [DocumentType.TOUR_FORM]: 1,
          [DocumentType.OTHER]: 1,
        },
        totalFileSize: 5120,
        averageFileSize: 1024,
      });
    });

    it('should apply provider filtering for provider admin', async () => {
      mockPrisma.document.count = vi.fn().mockResolvedValue(mockCountResult);
      mockPrisma.document.groupBy = vi.fn().mockResolvedValue(mockGroupByResult);
      mockPrisma.document.aggregate = vi.fn().mockResolvedValue(mockAggregateResult);

      await documentService.getDocumentStatistics(
        'admin123',
        UserType.PROVIDER_ADMIN,
        'provider456'
      );

      const expectedWhereClause = {
        user: {
          providerId: 'provider456',
        },
      };

      expect(mockPrisma.document.count).toHaveBeenCalledWith({
        where: expectedWhereClause,
      });
      expect(mockPrisma.document.groupBy).toHaveBeenCalledWith({
        by: ['type'],
        where: expectedWhereClause,
        _count: { type: true },
      });
      expect(mockPrisma.document.aggregate).toHaveBeenCalledWith({
        where: expectedWhereClause,
        _sum: { fileSize: true },
        _avg: { fileSize: true },
      });
    });

    it('should apply user filtering for tourist', async () => {
      mockPrisma.document.count = vi.fn().mockResolvedValue(mockCountResult);
      mockPrisma.document.groupBy = vi.fn().mockResolvedValue(mockGroupByResult);
      mockPrisma.document.aggregate = vi.fn().mockResolvedValue(mockAggregateResult);

      await documentService.getDocumentStatistics(
        'user123',
        UserType.TOURIST
      );

      const expectedWhereClause = {
        userId: 'user123',
      };

      expect(mockPrisma.document.count).toHaveBeenCalledWith({
        where: expectedWhereClause,
      });
    });

    it('should handle zero documents gracefully', async () => {
      mockPrisma.document.count = vi.fn().mockResolvedValue(0);
      mockPrisma.document.groupBy = vi.fn().mockResolvedValue([]);
      mockPrisma.document.aggregate = vi.fn().mockResolvedValue({
        _sum: { fileSize: null },
        _avg: { fileSize: null },
      });

      const stats = await documentService.getDocumentStatistics(
        'user123',
        UserType.TOURIST
      );

      expect(stats).toEqual({
        totalDocuments: 0,
        documentsByType: {
          [DocumentType.PASSPORT]: 0,
          [DocumentType.TICKET]: 0,
          [DocumentType.TOUR_FORM]: 0,
          [DocumentType.OTHER]: 0,
        },
        totalFileSize: 0,
        averageFileSize: 0,
      });
    });
  });

  describe('validateDocumentIntegrity', () => {
    const mockDocument = {
      documentId: 'doc123',
      userId: 'user123',
      type: DocumentType.PASSPORT,
      fileName: 'passport.pdf',
      description: 'My passport',
      uploadedByUserId: 'user123',
      uploadDate: new Date('2024-01-01'),
      fileStoragePath: 'documents/user123/passport.pdf',
      fileSize: 1024,
      mimeType: 'application/pdf',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    };

    it('should validate document integrity successfully', async () => {
      vi.spyOn(documentService, 'getDocumentById').mockResolvedValue(mockDocument);
      mockFileStorageService.fileExists = vi.fn().mockResolvedValue(true);
      mockFileStorageService.getFileMetadata = vi.fn().mockResolvedValue({
        size: 1024,
        contentType: 'application/pdf',
        lastModified: new Date(),
        etag: '"test-etag"',
      });

      const result = await documentService.validateDocumentIntegrity(
        'doc123',
        'user123',
        UserType.TOURIST
      );

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should detect missing file in storage', async () => {
      vi.spyOn(documentService, 'getDocumentById').mockResolvedValue(mockDocument);
      mockFileStorageService.fileExists = vi.fn().mockResolvedValue(false);

      const result = await documentService.validateDocumentIntegrity(
        'doc123',
        'user123',
        UserType.TOURIST
      );

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('File not found in storage');
    });

    it('should detect file size mismatch', async () => {
      vi.spyOn(documentService, 'getDocumentById').mockResolvedValue(mockDocument);
      mockFileStorageService.fileExists = vi.fn().mockResolvedValue(true);
      mockFileStorageService.getFileMetadata = vi.fn().mockResolvedValue({
        size: 2048, // Different size
        contentType: 'application/pdf',
        lastModified: new Date(),
        etag: '"test-etag"',
      });

      const result = await documentService.validateDocumentIntegrity(
        'doc123',
        'user123',
        UserType.TOURIST
      );

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('File size mismatch: expected 1024, found 2048');
    });

    it('should detect MIME type mismatch', async () => {
      vi.spyOn(documentService, 'getDocumentById').mockResolvedValue(mockDocument);
      mockFileStorageService.fileExists = vi.fn().mockResolvedValue(true);
      mockFileStorageService.getFileMetadata = vi.fn().mockResolvedValue({
        size: 1024,
        contentType: 'image/jpeg', // Different MIME type
        lastModified: new Date(),
        etag: '"test-etag"',
      });

      const result = await documentService.validateDocumentIntegrity(
        'doc123',
        'user123',
        UserType.TOURIST
      );

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('MIME type mismatch: expected application/pdf, found image/jpeg');
    });

    it('should return error for non-existent document', async () => {
      vi.spyOn(documentService, 'getDocumentById').mockResolvedValue(null);

      const result = await documentService.validateDocumentIntegrity(
        'nonexistent',
        'user123',
        UserType.TOURIST
      );

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Document not found');
    });

    it('should validate document type rules', async () => {
      const tourFormDocument = {
        ...mockDocument,
        type: DocumentType.TOUR_FORM,
        description: null, // Missing required description
      };

      vi.spyOn(documentService, 'getDocumentById').mockResolvedValue(tourFormDocument);
      mockFileStorageService.fileExists = vi.fn().mockResolvedValue(true);
      mockFileStorageService.getFileMetadata = vi.fn().mockResolvedValue({
        size: 1024,
        contentType: 'application/pdf',
        lastModified: new Date(),
        etag: '"test-etag"',
      });

      const result = await documentService.validateDocumentIntegrity(
        'doc123',
        'user123',
        UserType.TOURIST
      );

      expect(result.isValid).toBe(false);
      expect(result.issues.some(issue => issue.includes('Description is required'))).toBe(true);
    });
  });

  describe('getDocumentsByType', () => {
    it('should get documents by specific type', async () => {
      const mockSearchResult = {
        documents: [
          {
            documentId: 'doc1',
            userId: 'user123',
            type: DocumentType.PASSPORT,
            fileName: 'passport.pdf',
            description: 'My passport',
            uploadedByUserId: 'user123',
            uploadDate: new Date(),
            fileStoragePath: 'documents/user123/passport.pdf',
            fileSize: 1024,
            mimeType: 'application/pdf',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        total: 1,
        hasMore: false,
      };

      vi.spyOn(documentService, 'searchDocuments').mockResolvedValue(mockSearchResult);

      const result = await documentService.getDocumentsByType(
        DocumentType.PASSPORT,
        'user123',
        UserType.TOURIST,
        undefined,
        10,
        0
      );

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe(DocumentType.PASSPORT);
      expect(documentService.searchDocuments).toHaveBeenCalledWith(
        {
          type: DocumentType.PASSPORT,
          limit: 10,
          offset: 0,
        },
        'user123',
        UserType.TOURIST,
        undefined
      );
    });
  });
});