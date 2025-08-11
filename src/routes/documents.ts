import { Router, Request, Response } from 'express';
import { DocumentService } from '../services/document';
import { AuthMiddleware } from '../middleware/auth';
import { PrismaClient } from '../generated/prisma';
import multer from 'multer';
import { UserType } from '../types/user';
import { DocumentType } from '../types/document';

const router = Router();
const prisma = new PrismaClient();
const documentService = new DocumentService(prisma);
const authMiddleware = new AuthMiddleware(prisma);

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow specific file types
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: PDF, JPEG, PNG, GIF, DOC, DOCX'));
    }
  },
});

/**
 * @swagger
 * /api/documents:
 *   get:
 *     tags:
 *       - Documents
 *     summary: Get documents
 *     description: Retrieve documents with role-based access. Users can see their own documents, ProviderAdmins can see documents from their company users, SystemAdmins can see all documents.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [Passport, Ticket, TourForm, Other]
 *         description: Filter documents by type
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter documents by user ID (admin access required)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Maximum number of documents to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of documents to skip for pagination
 *     responses:
 *       200:
 *         description: Documents retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Documents retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     documents:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Document'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         limit:
 *                           type: integer
 *                         offset:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Invalid query parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', authMiddleware.authenticate, async (req: Request, res: Response) => {
  try {
    const { sub: userId, role: userType, providerId } = req.user!;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    // Validate pagination parameters
    if (limit > 100) {
      return res.status(400).json({
        error: {
          code: 'INVALID_LIMIT',
          message: 'Limit cannot exceed 100',
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      });
    }

    const documents = await documentService.getDocuments(
      userId,
      userType as UserType,
      providerId,
      limit,
      offset
    );

    res.json({
      documents,
      pagination: {
        limit,
        offset,
        total: documents.length,
      },
    });
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch documents',
        timestamp: new Date().toISOString(),
        path: req.path,
      },
    });
  }
});

/**
 * @swagger
 * /api/documents:
 *   post:
 *     tags:
 *       - Documents
 *     summary: Upload a new document
 *     description: Upload a document file with metadata. Users can upload documents for themselves, ProviderAdmins can upload for their company users.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *               - type
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Document file to upload
 *               type:
 *                 type: string
 *                 enum: [Passport, Ticket, TourForm, Other]
 *                 description: Document type
 *                 example: "Passport"
 *               description:
 *                 type: string
 *                 maxLength: 500
 *                 description: Optional document description
 *                 example: "Passport copy for tour registration"
 *               targetUserId:
 *                 type: string
 *                 format: uuid
 *                 description: Target user ID (for admin uploads)
 *     responses:
 *       201:
 *         description: Document uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Document uploaded successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     document:
 *                       $ref: '#/components/schemas/Document'
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Invalid request data or file validation failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Insufficient permissions to upload for target user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       413:
 *         description: File too large
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       415:
 *         description: Unsupported file type
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', authMiddleware.authenticate, upload.single('file'), async (req: Request, res: Response) => {
  try {
    const { sub: userId, role: userType, providerId } = req.user!;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        error: {
          code: 'MISSING_FILE',
          message: 'No file provided',
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      });
    }

    const { targetUserId, type, description } = req.body;

    // Use requesting user ID if no target user specified
    const documentUserId = targetUserId || userId;

    const documentInput = {
      userId: documentUserId,
      type,
      fileName: file.originalname,
      description,
      fileBuffer: file.buffer,
      mimeType: file.mimetype,
    };

    const document = await documentService.uploadDocument(
      documentInput,
      userId,
      userType as UserType,
      providerId
    );

    res.status(201).json({
      message: 'Document uploaded successfully',
      document: {
        documentId: document.documentId,
        userId: document.userId,
        type: document.type,
        fileName: document.fileName,
        description: document.description,
        uploadDate: document.uploadDate,
        fileSize: document.fileSize,
        mimeType: document.mimeType,
      },
    });
  } catch (error) {
    console.error('Error uploading document:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('Validation error')) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: error.message,
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        });
      }
      
      if (error.message.includes('permissions')) {
        return res.status(403).json({
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: error.message,
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        });
      }
    }

    res.status(500).json({
      error: {
        code: 'UPLOAD_FAILED',
        message: 'Document upload failed',
        timestamp: new Date().toISOString(),
        path: req.path,
      },
    });
  }
});

/**
 * GET /api/documents/:id
 * Get document by ID with permission validation
 */
router.get('/:id', authMiddleware.authenticate, async (req: Request, res: Response) => {
  try {
    const { sub: userId, role: userType, providerId } = req.user!;
    const documentId = req.params.id;

    const document = await documentService.getDocumentById(
      documentId,
      userId,
      userType as UserType,
      providerId
    );

    if (!document) {
      return res.status(404).json({
        error: {
          code: 'DOCUMENT_NOT_FOUND',
          message: 'Document not found',
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      });
    }

    res.json({
      document: {
        documentId: document.documentId,
        userId: document.userId,
        type: document.type,
        fileName: document.fileName,
        description: document.description,
        uploadDate: document.uploadDate,
        fileSize: document.fileSize,
        mimeType: document.mimeType,
        uploadedByUserId: document.uploadedByUserId,
      },
    });
  } catch (error) {
    console.error('Error fetching document:', error);
    
    if (error instanceof Error && error.message.includes('permissions')) {
      return res.status(403).json({
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: error.message,
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      });
    }

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch document',
        timestamp: new Date().toISOString(),
        path: req.path,
      },
    });
  }
});

/**
 * DELETE /api/documents/:id
 * Delete document with permission validation
 */
router.delete('/:id', authMiddleware.authenticate, async (req: Request, res: Response) => {
  try {
    const { sub: userId, role: userType, providerId } = req.user!;
    const documentId = req.params.id;

    await documentService.deleteDocument(
      documentId,
      userId,
      userType as UserType,
      providerId
    );

    res.json({
      message: 'Document deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: {
            code: 'DOCUMENT_NOT_FOUND',
            message: 'Document not found',
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        });
      }
      
      if (error.message.includes('permissions')) {
        return res.status(403).json({
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: error.message,
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        });
      }
    }

    res.status(500).json({
      error: {
        code: 'DELETION_FAILED',
        message: 'Document deletion failed',
        timestamp: new Date().toISOString(),
        path: req.path,
      },
    });
  }
});

/**
 * GET /api/documents/forms/blank
 * Get list of available blank form templates
 */
router.get('/forms/blank', authMiddleware.authenticate, async (req: Request, res: Response) => {
  try {
    const category = req.query.category as string;
    
    let forms;
    if (category) {
      forms = await documentService.getBlankFormsByCategory(category);
    } else {
      forms = await documentService.getBlankForms();
    }

    res.json({
      forms,
      total: forms.length,
      message: 'Available blank forms retrieved successfully',
    });
  } catch (error) {
    console.error('Error fetching blank forms:', error);
    
    res.status(500).json({
      error: {
        code: 'FORMS_FETCH_FAILED',
        message: 'Failed to fetch blank forms',
        timestamp: new Date().toISOString(),
        path: req.path,
      },
    });
  }
});

/**
 * GET /api/documents/forms/:formId/download
 * Generate download URL for specific blank form
 */
router.get('/forms/:formId/download', authMiddleware.authenticate, async (req: Request, res: Response) => {
  try {
    const formId = req.params.formId;
    const expiresIn = parseInt(req.query.expiresIn as string) || 3600;

    const downloadInfo = await documentService.generateBlankFormDownloadUrl(formId, expiresIn);

    if (!downloadInfo) {
      return res.status(404).json({
        error: {
          code: 'FORM_NOT_FOUND',
          message: 'Form template not found',
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      });
    }

    res.json({
      downloadUrl: downloadInfo.downloadUrl,
      fileName: downloadInfo.fileName,
      fileSize: downloadInfo.fileSize,
      mimeType: downloadInfo.mimeType,
      expiresAt: downloadInfo.expiresAt,
      message: 'Form download URL generated successfully',
    });
  } catch (error) {
    console.error('Error generating form download URL:', error);
    
    res.status(500).json({
      error: {
        code: 'FORM_DOWNLOAD_FAILED',
        message: 'Failed to generate form download URL',
        timestamp: new Date().toISOString(),
        path: req.path,
      },
    });
  }
});

/**
 * GET /api/documents/forms/download/:formId
 * Direct download of form template file
 */
router.get('/forms/download/:formId', authMiddleware.authenticate, async (req: Request, res: Response) => {
  try {
    const formId = req.params.formId;
    const { expires, signature } = req.query;

    // Import form template service
    const { formTemplateService } = await import('../services/form-template');

    // Validate download signature if provided
    if (expires && signature) {
      const isValid = formTemplateService.validateDownloadSignature(
        formId,
        expires as string,
        signature as string
      );

      if (!isValid) {
        return res.status(403).json({
          error: {
            code: 'INVALID_SIGNATURE',
            message: 'Invalid or expired download signature',
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        });
      }
    }

    // Get form content
    const formContent = await formTemplateService.getFormContent(formId);
    const form = await formTemplateService.getFormById(formId);

    if (!formContent || !form) {
      return res.status(404).json({
        error: {
          code: 'FORM_NOT_FOUND',
          message: 'Form template not found',
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      });
    }

    // Set appropriate headers for file download
    res.setHeader('Content-Type', form.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${form.fileName}"`);
    res.setHeader('Content-Length', formContent.length.toString());
    res.setHeader('Cache-Control', 'private, no-cache');

    // Send file content
    res.send(formContent);
  } catch (error) {
    console.error('Error serving form download:', error);
    
    res.status(500).json({
      error: {
        code: 'FORM_DOWNLOAD_FAILED',
        message: 'Failed to download form template',
        timestamp: new Date().toISOString(),
        path: req.path,
      },
    });
  }
});

/**
 * GET /api/documents/search
 * Advanced document search with filtering and sorting
 */
router.get('/search', authMiddleware.authenticate, async (req: Request, res: Response) => {
  try {
    const { sub: userId, role: userType, providerId } = req.user!;
    
    // Parse query parameters
    const {
      type,
      fileName,
      description,
      mimeType,
      uploadedByUserId,
      dateFrom,
      dateTo,
      limit = '50',
      offset = '0',
      sortBy = 'uploadDate',
      sortOrder = 'desc',
    } = req.query;

    // Validate and parse parameters
    const parsedLimit = Math.min(parseInt(limit as string) || 50, 100);
    const parsedOffset = parseInt(offset as string) || 0;

    const searchCriteria = {
      ...(type && { type: type as DocumentType }),
      ...(fileName && { fileName: fileName as string }),
      ...(description && { description: description as string }),
      ...(mimeType && { mimeType: mimeType as string }),
      ...(uploadedByUserId && { uploadedByUserId: uploadedByUserId as string }),
      ...(dateFrom && { dateFrom: new Date(dateFrom as string) }),
      ...(dateTo && { dateTo: new Date(dateTo as string) }),
      limit: parsedLimit,
      offset: parsedOffset,
      sortBy: sortBy as 'uploadDate' | 'fileName' | 'fileSize' | 'type',
      sortOrder: sortOrder as 'asc' | 'desc',
    };

    const result = await documentService.searchDocuments(
      searchCriteria,
      userId,
      userType as UserType,
      providerId
    );

    res.json({
      documents: result.documents,
      pagination: {
        limit: parsedLimit,
        offset: parsedOffset,
        total: result.total,
        hasMore: result.hasMore,
      },
      searchCriteria: {
        ...searchCriteria,
        dateFrom: searchCriteria.dateFrom?.toISOString(),
        dateTo: searchCriteria.dateTo?.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error searching documents:', error);
    
    if (error instanceof Error && error.message.includes('Invalid date')) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DATE_FORMAT',
          message: 'Invalid date format. Use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)',
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      });
    }

    res.status(500).json({
      error: {
        code: 'SEARCH_FAILED',
        message: 'Document search failed',
        timestamp: new Date().toISOString(),
        path: req.path,
      },
    });
  }
});

/**
 * GET /api/documents/:id/metadata
 * Get detailed metadata for a specific document
 */
router.get('/:id/metadata', authMiddleware.authenticate, async (req: Request, res: Response) => {
  try {
    const { sub: userId, role: userType, providerId } = req.user!;
    const documentId = req.params.id;

    const metadata = await documentService.getDocumentMetadata(
      documentId,
      userId,
      userType as UserType,
      providerId
    );

    if (!metadata) {
      return res.status(404).json({
        error: {
          code: 'DOCUMENT_NOT_FOUND',
          message: 'Document not found',
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      });
    }

    res.json({
      metadata,
      message: 'Document metadata retrieved successfully',
    });
  } catch (error) {
    console.error('Error fetching document metadata:', error);
    
    if (error instanceof Error && error.message.includes('permissions')) {
      return res.status(403).json({
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: error.message,
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      });
    }

    res.status(500).json({
      error: {
        code: 'METADATA_FETCH_FAILED',
        message: 'Failed to fetch document metadata',
        timestamp: new Date().toISOString(),
        path: req.path,
      },
    });
  }
});

/**
 * GET /api/documents/statistics
 * Get document statistics for the requesting user's scope
 */
router.get('/statistics', authMiddleware.authenticate, async (req: Request, res: Response) => {
  try {
    const { sub: userId, role: userType, providerId } = req.user!;

    const statistics = await documentService.getDocumentStatistics(
      userId,
      userType as UserType,
      providerId
    );

    res.json({
      statistics,
      message: 'Document statistics retrieved successfully',
    });
  } catch (error) {
    console.error('Error fetching document statistics:', error);
    
    res.status(500).json({
      error: {
        code: 'STATISTICS_FETCH_FAILED',
        message: 'Failed to fetch document statistics',
        timestamp: new Date().toISOString(),
        path: req.path,
      },
    });
  }
});

/**
 * GET /api/documents/:id/validate
 * Validate document integrity
 */
router.get('/:id/validate', authMiddleware.authenticate, async (req: Request, res: Response) => {
  try {
    const { sub: userId, role: userType, providerId } = req.user!;
    const documentId = req.params.id;

    const validation = await documentService.validateDocumentIntegrity(
      documentId,
      userId,
      userType as UserType,
      providerId
    );

    res.json({
      validation,
      message: validation.isValid 
        ? 'Document integrity validation passed' 
        : 'Document integrity validation failed',
    });
  } catch (error) {
    console.error('Error validating document integrity:', error);
    
    if (error instanceof Error && error.message.includes('permissions')) {
      return res.status(403).json({
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: error.message,
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      });
    }

    res.status(500).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Document integrity validation failed',
        timestamp: new Date().toISOString(),
        path: req.path,
      },
    });
  }
});

/**
 * GET /api/documents/types/:type
 * Get documents by specific type
 */
router.get('/types/:type', authMiddleware.authenticate, async (req: Request, res: Response) => {
  try {
    const { sub: userId, role: userType, providerId } = req.user!;
    const documentType = req.params.type as DocumentType;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    // Validate document type
    if (!Object.values(DocumentType).includes(documentType)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DOCUMENT_TYPE',
          message: `Invalid document type. Must be one of: ${Object.values(DocumentType).join(', ')}`,
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      });
    }

    const documents = await documentService.getDocumentsByType(
      documentType,
      userId,
      userType as UserType,
      providerId,
      limit,
      offset
    );

    res.json({
      documents,
      documentType,
      pagination: {
        limit,
        offset,
        total: documents.length,
      },
      message: `Documents of type ${documentType} retrieved successfully`,
    });
  } catch (error) {
    console.error('Error fetching documents by type:', error);
    
    res.status(500).json({
      error: {
        code: 'TYPE_FETCH_FAILED',
        message: 'Failed to fetch documents by type',
        timestamp: new Date().toISOString(),
        path: req.path,
      },
    });
  }
});

/**
 * GET /api/documents/:id/download
 * Generate secure download URL for document
 */
router.get('/:id/download', authMiddleware.authenticate, async (req: Request, res: Response) => {
  try {
    const { sub: userId, role: userType, providerId } = req.user!;
    const documentId = req.params.id;
    const expiresIn = parseInt(req.query.expiresIn as string) || 3600; // 1 hour default

    const downloadUrl = await documentService.generateDownloadUrl(
      documentId,
      userId,
      userType as UserType,
      providerId,
      expiresIn
    );

    res.json({
      downloadUrl,
      expiresIn,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    });
  } catch (error) {
    console.error('Error generating download URL:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: {
            code: 'DOCUMENT_NOT_FOUND',
            message: 'Document not found',
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        });
      }
      
      if (error.message.includes('permissions')) {
        return res.status(403).json({
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: error.message,
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        });
      }
    }

    res.status(500).json({
      error: {
        code: 'URL_GENERATION_FAILED',
        message: 'Failed to generate download URL',
        timestamp: new Date().toISOString(),
        path: req.path,
      },
    });
  }
});

export default router;