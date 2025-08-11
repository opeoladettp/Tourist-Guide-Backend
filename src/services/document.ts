import { PrismaClient } from '../generated/prisma';
import { 
  CreateDocumentInput, 
  UpdateDocumentInput, 
  Document, 
  DocumentType,
  DocumentSearchCriteria,
  DocumentSearchResult,
  DocumentMetadata
} from '../types/document';
import { UserType } from '../types/user';
import { 
  createDocumentSchema, 
  updateDocumentSchema, 
  documentIdSchema,
  validateFileType,
  validateFileSize,
  validateDocumentTypeSpecific,
  validateFileName
} from '../validation/document';
import { fileStorageService, FileStorageService } from './file-storage';

export class DocumentService {
  constructor(
    private prisma: PrismaClient,
    private fileStorage: FileStorageService = fileStorageService
  ) {}

  /**
   * Convert custom DocumentType to Prisma DocumentType
   */
  private convertToDbDocumentType(type: DocumentType): any {
    switch (type) {
      case DocumentType.PASSPORT:
        return 'PASSPORT';
      case DocumentType.TICKET:
        return 'TICKET';
      case DocumentType.TOUR_FORM:
        return 'TOUR_FORM';
      case DocumentType.OTHER:
        return 'OTHER';
      default:
        return 'OTHER';
    }
  }

  /**
   * Convert Prisma DocumentType to custom DocumentType
   */
  private convertFromDbDocumentType(type: string): DocumentType {
    switch (type) {
      case 'PASSPORT':
        return DocumentType.PASSPORT;
      case 'TICKET':
        return DocumentType.TICKET;
      case 'TOUR_FORM':
        return DocumentType.TOUR_FORM;
      case 'OTHER':
        return DocumentType.OTHER;
      default:
        return DocumentType.OTHER;
    }
  }

  /**
   * Convert database document to Document type
   */
  private convertDocumentFromDb(dbDocument: any): Document {
    return {
      documentId: dbDocument.documentId,
      userId: dbDocument.userId,
      type: this.convertFromDbDocumentType(dbDocument.type),
      fileName: dbDocument.fileName,
      description: dbDocument.description,
      uploadedByUserId: dbDocument.uploadedByUserId,
      uploadDate: dbDocument.uploadDate,
      fileStoragePath: dbDocument.fileStoragePath,
      fileSize: dbDocument.fileSize,
      mimeType: dbDocument.mimeType,
      createdAt: dbDocument.createdAt,
      updatedAt: dbDocument.updatedAt,
    };
  }

  /**
   * Upload a new document
   */
  async uploadDocument(
    input: CreateDocumentInput,
    requestingUserId: string,
    requestingUserType: UserType,
    requestingUserProviderId?: string
  ): Promise<Document> {
    // Validate input
    const { error, value } = createDocumentSchema.validate(input);
    if (error) {
      throw new Error(`Validation error: ${error.details.map(d => d.message).join(', ')}`);
    }

    // Validate file name
    const fileNameValidation = validateFileName(value.fileName);
    if (!fileNameValidation.isValid) {
      throw new Error(`File name validation failed: ${fileNameValidation.errors.join(', ')}`);
    }

    // Validate file type
    if (!validateFileType(value.mimeType)) {
      throw new Error('Invalid file type. Allowed types: PDF, JPEG, PNG, GIF, DOC, DOCX');
    }

    // Validate file size
    if (!validateFileSize(value.fileBuffer.length)) {
      throw new Error('File size exceeds maximum limit of 10MB');
    }

    // Validate document type specific rules
    const typeValidation = validateDocumentTypeSpecific(
      value.type,
      value.mimeType,
      value.fileBuffer.length,
      value.fileName,
      value.description
    );
    if (!typeValidation.isValid) {
      throw new Error(`Document type validation failed: ${typeValidation.errors.join(', ')}`);
    }

    // Check permissions - users can upload documents for themselves or their company users
    if (requestingUserType === UserType.TOURIST && value.userId !== requestingUserId) {
      throw new Error('Tourists can only upload documents for themselves');
    }

    if (requestingUserType === UserType.PROVIDER_ADMIN) {
      // Provider admin can upload for users in their company
      const targetUser = await this.prisma.user.findUnique({
        where: { userId: value.userId }
      });

      if (!targetUser) {
        throw new Error('Target user not found');
      }

      if (targetUser.providerId !== requestingUserProviderId && targetUser.userId !== requestingUserId) {
        throw new Error('Insufficient permissions to upload documents for this user');
      }
    }

    try {
      // Upload file to storage service
      const uploadResult = await this.fileStorage.uploadFile(value.fileBuffer, {
        originalName: value.fileName,
        mimeType: value.mimeType,
        size: value.fileBuffer.length,
        userId: value.userId,
        documentType: value.type,
      });

      // Create document record
      const document = await this.prisma.document.create({
        data: {
          userId: value.userId,
          type: this.convertToDbDocumentType(value.type),
          fileName: value.fileName,
          description: value.description || null,
          uploadedByUserId: requestingUserId,
          fileStoragePath: uploadResult.key,
          fileSize: value.fileBuffer.length,
          mimeType: value.mimeType
        }
      });

      return this.convertDocumentFromDb(document);
    } catch (error) {
      throw new Error(`Document upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get document by ID with role-based access control
   */
  async getDocumentById(
    documentId: string,
    requestingUserId: string,
    requestingUserType: UserType,
    requestingUserProviderId?: string
  ): Promise<Document | null> {
    // Validate document ID
    const { error } = documentIdSchema.validate(documentId);
    if (error) {
      throw new Error(`Invalid document ID: ${error.details[0].message}`);
    }

    const document = await this.prisma.document.findUnique({
      where: { documentId },
      include: {
        user: {
          select: {
            userId: true,
            firstName: true,
            lastName: true,
            providerId: true
          }
        }
      }
    });

    if (!document) {
      return null;
    }

    // Role-based access control
    if (requestingUserType === UserType.SYSTEM_ADMIN) {
      // System admin can access any document
      return this.convertDocumentFromDb(document);
    } else if (requestingUserType === UserType.PROVIDER_ADMIN) {
      // Provider admin can access documents of users in their company
      if (document.user.providerId === requestingUserProviderId || document.userId === requestingUserId) {
        return this.convertDocumentFromDb(document);
      }
    } else if (requestingUserType === UserType.TOURIST) {
      // Tourist can only access their own documents
      if (document.userId === requestingUserId) {
        return this.convertDocumentFromDb(document);
      }
    }

    throw new Error('Insufficient permissions to access this document');
  }

  /**
   * Get documents for a user with role-based access control
   */
  async getUserDocuments(
    userId: string,
    requestingUserId: string,
    requestingUserType: UserType,
    requestingUserProviderId?: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Document[]> {
    // Check permissions
    if (requestingUserType === UserType.TOURIST && userId !== requestingUserId) {
      throw new Error('Tourists can only access their own documents');
    }

    if (requestingUserType === UserType.PROVIDER_ADMIN) {
      // Provider admin can access documents of users in their company
      const targetUser = await this.prisma.user.findUnique({
        where: { userId }
      });

      if (!targetUser) {
        throw new Error('User not found');
      }

      if (targetUser.providerId !== requestingUserProviderId && targetUser.userId !== requestingUserId) {
        throw new Error('Insufficient permissions to access documents for this user');
      }
    }

    const documents = await this.prisma.document.findMany({
      where: { userId },
      take: limit,
      skip: offset,
      orderBy: { uploadDate: 'desc' }
    });

    return documents.map(doc => this.convertDocumentFromDb(doc));
  }

  /**
   * Update document metadata
   */
  async updateDocument(
    documentId: string,
    input: UpdateDocumentInput,
    requestingUserId: string,
    requestingUserType: UserType,
    requestingUserProviderId?: string
  ): Promise<Document> {
    // Validate input
    const { error, value } = updateDocumentSchema.validate(input);
    if (error) {
      throw new Error(`Validation error: ${error.details.map(d => d.message).join(', ')}`);
    }

    // Get existing document and check permissions
    const existingDocument = await this.getDocumentById(
      documentId,
      requestingUserId,
      requestingUserType,
      requestingUserProviderId
    );

    if (!existingDocument) {
      throw new Error('Document not found');
    }

    // Update document
    const updatedDocument = await this.prisma.document.update({
      where: { documentId },
      data: {
        description: value.description ?? existingDocument.description
      }
    });

    return this.convertDocumentFromDb(updatedDocument);
  }

  /**
   * Delete document
   */
  async deleteDocument(
    documentId: string,
    requestingUserId: string,
    requestingUserType: UserType,
    requestingUserProviderId?: string
  ): Promise<void> {
    // Get existing document and check permissions
    const existingDocument = await this.getDocumentById(
      documentId,
      requestingUserId,
      requestingUserType,
      requestingUserProviderId
    );

    if (!existingDocument) {
      throw new Error('Document not found');
    }

    // Additional permission check - only document owner or system admin can delete
    if (requestingUserType !== UserType.SYSTEM_ADMIN && existingDocument.userId !== requestingUserId) {
      throw new Error('Only document owner or system admin can delete documents');
    }

    try {
      // Delete file from storage
      await this.fileStorage.deleteFile(existingDocument.fileStoragePath);
    } catch (error) {
      // Log error but don't fail the operation if file deletion fails
      console.error(`Failed to delete file from storage: ${error}`);
    }

    // Delete document record
    await this.prisma.document.delete({
      where: { documentId }
    });
  }

  /**
   * Get all documents with role-based filtering
   */
  async getDocuments(
    requestingUserId: string,
    requestingUserType: UserType,
    requestingUserProviderId?: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Document[]> {
    let whereClause: any = {};

    // Apply role-based filtering
    if (requestingUserType === UserType.PROVIDER_ADMIN && requestingUserProviderId) {
      // Provider admin can see documents of users in their company
      whereClause = {
        user: {
          providerId: requestingUserProviderId
        }
      };
    } else if (requestingUserType === UserType.TOURIST) {
      // Tourist can only see their own documents
      whereClause = { userId: requestingUserId };
    }
    // System admin can see all documents (no filtering)

    const documents = await this.prisma.document.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            userId: true,
            firstName: true,
            lastName: true,
            emailAddress: true
          }
        }
      },
      take: limit,
      skip: offset,
      orderBy: { uploadDate: 'desc' }
    });

    return documents.map(doc => this.convertDocumentFromDb(doc));
  }

  /**
   * Generate download URL for document
   */
  async generateDownloadUrl(
    documentId: string,
    requestingUserId: string,
    requestingUserType: UserType,
    requestingUserProviderId?: string,
    expiresIn: number = 3600
  ): Promise<string> {
    // Get document and check permissions
    const document = await this.getDocumentById(
      documentId,
      requestingUserId,
      requestingUserType,
      requestingUserProviderId
    );

    if (!document) {
      throw new Error('Document not found');
    }

    try {
      // Generate presigned URL for secure download
      const downloadUrl = await this.fileStorage.generatePresignedUrl(
        document.fileStoragePath,
        expiresIn
      );

      return downloadUrl;
    } catch (error) {
      throw new Error(`Failed to generate download URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search documents with advanced criteria
   */
  async searchDocuments(
    criteria: DocumentSearchCriteria,
    requestingUserId: string,
    requestingUserType: UserType,
    requestingUserProviderId?: string
  ): Promise<DocumentSearchResult> {
    const limit = Math.min(criteria.limit || 50, 100);
    const offset = criteria.offset || 0;
    const sortBy = criteria.sortBy || 'uploadDate';
    const sortOrder = criteria.sortOrder || 'desc';

    // Build where clause based on role-based access
    let whereClause: any = {};

    // Apply role-based filtering
    if (requestingUserType === UserType.PROVIDER_ADMIN && requestingUserProviderId) {
      whereClause.user = {
        providerId: requestingUserProviderId
      };
    } else if (requestingUserType === UserType.TOURIST) {
      whereClause.userId = requestingUserId;
    }
    // System admin can see all documents (no additional filtering)

    // Apply search criteria
    if (criteria.userId) {
      whereClause.userId = criteria.userId;
    }

    if (criteria.type) {
      whereClause.type = this.convertToDbDocumentType(criteria.type);
    }

    if (criteria.fileName) {
      whereClause.fileName = {
        contains: criteria.fileName,
        mode: 'insensitive'
      };
    }

    if (criteria.description) {
      whereClause.description = {
        contains: criteria.description,
        mode: 'insensitive'
      };
    }

    if (criteria.mimeType) {
      whereClause.mimeType = criteria.mimeType;
    }

    if (criteria.uploadedByUserId) {
      whereClause.uploadedByUserId = criteria.uploadedByUserId;
    }

    if (criteria.dateFrom || criteria.dateTo) {
      whereClause.uploadDate = {};
      if (criteria.dateFrom) {
        whereClause.uploadDate.gte = criteria.dateFrom;
      }
      if (criteria.dateTo) {
        whereClause.uploadDate.lte = criteria.dateTo;
      }
    }

    // Get total count
    const total = await this.prisma.document.count({
      where: whereClause
    });

    // Get documents
    const documents = await this.prisma.document.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            userId: true,
            firstName: true,
            lastName: true,
            emailAddress: true
          }
        }
      },
      take: limit,
      skip: offset,
      orderBy: {
        [sortBy]: sortOrder
      }
    });

    return {
      documents: documents.map(doc => this.convertDocumentFromDb(doc)),
      total,
      hasMore: offset + documents.length < total
    };
  }

  /**
   * Get document metadata
   */
  async getDocumentMetadata(
    documentId: string,
    requestingUserId: string,
    requestingUserType: UserType,
    requestingUserProviderId?: string
  ): Promise<DocumentMetadata | null> {
    // First check if user has access to the document
    const document = await this.getDocumentById(
      documentId,
      requestingUserId,
      requestingUserType,
      requestingUserProviderId
    );

    if (!document) {
      return null;
    }

    // Get file metadata from storage
    const storageMetadata = await this.fileStorage.getFileMetadata(document.fileStoragePath);

    return {
      documentId: document.documentId,
      originalFileName: document.fileName,
      fileSize: document.fileSize,
      mimeType: document.mimeType,
      uploadDate: document.uploadDate,
      lastModified: storageMetadata?.lastModified || document.updatedAt,
      version: 1, // Simple versioning - could be enhanced
      isActive: true,
      tags: [], // Could be extended to support tags
    };
  }

  /**
   * Get documents by type
   */
  async getDocumentsByType(
    documentType: DocumentType,
    requestingUserId: string,
    requestingUserType: UserType,
    requestingUserProviderId?: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Document[]> {
    const result = await this.searchDocuments(
      {
        type: documentType,
        limit,
        offset
      },
      requestingUserId,
      requestingUserType,
      requestingUserProviderId
    );
    return result.documents;
  }

  /**
   * Get document statistics
   */
  async getDocumentStatistics(
    requestingUserId: string,
    requestingUserType: UserType,
    requestingUserProviderId?: string
  ): Promise<{
    totalDocuments: number;
    documentsByType: Record<DocumentType, number>;
    totalFileSize: number;
    averageFileSize: number;
  }> {
    // Build where clause based on role-based access
    let whereClause: any = {};

    if (requestingUserType === UserType.PROVIDER_ADMIN && requestingUserProviderId) {
      whereClause.user = {
        providerId: requestingUserProviderId
      };
    } else if (requestingUserType === UserType.TOURIST) {
      whereClause.userId = requestingUserId;
    }

    // Get total count and aggregations
    const [totalDocuments, documentsByType, fileSizeStats] = await Promise.all([
      this.prisma.document.count({ where: whereClause }),
      
      this.prisma.document.groupBy({
        by: ['type'],
        where: whereClause,
        _count: {
          type: true
        }
      }),
      
      this.prisma.document.aggregate({
        where: whereClause,
        _sum: {
          fileSize: true
        },
        _avg: {
          fileSize: true
        }
      })
    ]);

    // Format document counts by type
    const documentTypeCount: Record<DocumentType, number> = {
      [DocumentType.PASSPORT]: 0,
      [DocumentType.TICKET]: 0,
      [DocumentType.TOUR_FORM]: 0,
      [DocumentType.OTHER]: 0
    };

    documentsByType.forEach(item => {
      const convertedType = this.convertFromDbDocumentType(item.type);
      documentTypeCount[convertedType] = item._count.type;
    });

    return {
      totalDocuments,
      documentsByType: documentTypeCount,
      totalFileSize: fileSizeStats._sum.fileSize || 0,
      averageFileSize: fileSizeStats._avg.fileSize || 0
    };
  }

  /**
   * Validate document integrity
   */
  async validateDocumentIntegrity(
    documentId: string,
    requestingUserId: string,
    requestingUserType: UserType,
    requestingUserProviderId?: string
  ): Promise<{ isValid: boolean; issues: string[] }> {
    const issues: string[] = [];

    // Get document
    const document = await this.getDocumentById(
      documentId,
      requestingUserId,
      requestingUserType,
      requestingUserProviderId
    );

    if (!document) {
      return { isValid: false, issues: ['Document not found'] };
    }

    // Check if file exists in storage
    const fileExists = await this.fileStorage.fileExists(document.fileStoragePath);
    if (!fileExists) {
      issues.push('File not found in storage');
    }

    // Get storage metadata and compare
    const storageMetadata = await this.fileStorage.getFileMetadata(document.fileStoragePath);
    if (storageMetadata) {
      if (storageMetadata.size !== document.fileSize) {
        issues.push(`File size mismatch: expected ${document.fileSize}, found ${storageMetadata.size}`);
      }

      if (storageMetadata.contentType !== document.mimeType) {
        issues.push(`MIME type mismatch: expected ${document.mimeType}, found ${storageMetadata.contentType}`);
      }
    }

    // Validate document type rules
    const typeValidation = validateDocumentTypeSpecific(
      document.type,
      document.mimeType,
      document.fileSize,
      document.fileName,
      document.description || undefined
    );

    if (!typeValidation.isValid) {
      issues.push(...typeValidation.errors);
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }

  /**
   * Get blank form templates
   */
  async getBlankForms(): Promise<{
    id: string;
    name: string;
    description: string;
    category: string;
    version: string;
    fileSize: number;
    lastUpdated: Date;
  }[]> {
    // Import here to avoid circular dependency
    const { formTemplateService } = await import('./form-template');
    const forms = await formTemplateService.getAllForms();
    
    return forms.map(form => ({
      id: form.id,
      name: form.name,
      description: form.description,
      category: form.category,
      version: form.version,
      fileSize: form.fileSize,
      lastUpdated: form.lastUpdated,
    }));
  }

  /**
   * Generate download URL for blank form
   */
  async generateBlankFormDownloadUrl(
    formId: string,
    expiresIn: number = 3600
  ): Promise<{
    downloadUrl: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    expiresAt: Date;
  } | null> {
    // Import here to avoid circular dependency
    const { formTemplateService } = await import('./form-template');
    return await formTemplateService.generateFormDownloadUrl(formId, expiresIn);
  }

  /**
   * Get blank forms by category
   */
  async getBlankFormsByCategory(category: string): Promise<{
    id: string;
    name: string;
    description: string;
    category: string;
    version: string;
    fileSize: number;
    lastUpdated: Date;
  }[]> {
    // Import here to avoid circular dependency
    const { formTemplateService } = await import('./form-template');
    const forms = await formTemplateService.getFormsByCategory(category as any);
    
    return forms.map(form => ({
      id: form.id,
      name: form.name,
      description: form.description,
      category: form.category,
      version: form.version,
      fileSize: form.fileSize,
      lastUpdated: form.lastUpdated,
    }));
  }
}