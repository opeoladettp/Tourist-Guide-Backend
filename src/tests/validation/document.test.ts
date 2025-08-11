import { describe, it, expect } from 'vitest';
import { 
  createDocumentSchema, 
  updateDocumentSchema, 
  documentIdSchema,
  validateFileType,
  validateFileSize,
  validateDocumentTypeSpecific,
  validateFileName,
  getDocumentTypeInfo,
  getAllowedFileTypesForDocumentType,
  getMaxFileSizeForDocumentType,
  documentTypeRules,
  validateDocumentMetadata,
  validateSearchCriteria,
  validateFileIntegrity,
  generateDocumentValidationReport,
  getDocumentTypeValidationRules
} from '../../validation/document';
import { DocumentType } from '../../types/document';

describe('Document Validation Schemas', () => {
  describe('createDocumentSchema', () => {
    const validDocumentData = {
      userId: 'user123',
      type: DocumentType.PASSPORT,
      fileName: 'passport.pdf',
      description: 'My passport document',
      mimeType: 'application/pdf',
      fileBuffer: Buffer.from('test file content')
    };

    it('should validate valid document data', () => {
      const { error, value } = createDocumentSchema.validate(validDocumentData);
      expect(error).toBeUndefined();
      expect(value.userId).toBe(validDocumentData.userId);
    });

    it('should require userId', () => {
      const { error } = createDocumentSchema.validate({ ...validDocumentData, userId: '' });
      expect(error?.details[0].message).toContain('User ID cannot be empty');
    });

    it('should require type', () => {
      const { error } = createDocumentSchema.validate({ ...validDocumentData, type: undefined });
      expect(error?.details[0].message).toContain('Document type is required');
    });

    it('should validate document type enum', () => {
      const { error } = createDocumentSchema.validate({ ...validDocumentData, type: 'INVALID_TYPE' });
      expect(error?.details[0].message).toContain('Document type must be one of');
    });

    it('should require fileName', () => {
      const { error } = createDocumentSchema.validate({ ...validDocumentData, fileName: '' });
      expect(error?.details[0].message).toContain('not allowed to be empty');
    });

    it('should validate fileName length', () => {
      const longFileName = 'a'.repeat(256);
      const { error } = createDocumentSchema.validate({ ...validDocumentData, fileName: longFileName });
      expect(error?.details[0].message).toContain('File name cannot exceed 255 characters');
    });

    it('should require mimeType', () => {
      const { error } = createDocumentSchema.validate({ ...validDocumentData, mimeType: '' });
      expect(error?.details[0].message).toContain('MIME type cannot be empty');
    });

    it('should require fileBuffer', () => {
      const { error } = createDocumentSchema.validate({ ...validDocumentData, fileBuffer: undefined });
      expect(error?.details[0].message).toContain('File content is required');
    });

    it('should allow optional description', () => {
      const { error } = createDocumentSchema.validate({ ...validDocumentData, description: undefined });
      expect(error).toBeUndefined();
    });

    it('should validate description length', () => {
      const longDescription = 'a'.repeat(501);
      const { error } = createDocumentSchema.validate({ ...validDocumentData, description: longDescription });
      expect(error?.details[0].message).toContain('Description cannot exceed 500 characters');
    });
  });

  describe('updateDocumentSchema', () => {
    it('should validate partial updates', () => {
      const updateData = { description: 'Updated description' };
      const { error, value } = updateDocumentSchema.validate(updateData);
      expect(error).toBeUndefined();
      expect(value).toEqual(updateData);
    });

    it('should allow empty update', () => {
      const { error } = updateDocumentSchema.validate({});
      expect(error).toBeUndefined();
    });

    it('should validate description length in updates', () => {
      const longDescription = 'a'.repeat(501);
      const { error } = updateDocumentSchema.validate({ description: longDescription });
      expect(error?.details[0].message).toContain('Description cannot exceed 500 characters');
    });

    it('should allow empty description', () => {
      const { error } = updateDocumentSchema.validate({ description: '' });
      expect(error).toBeUndefined();
    });
  });

  describe('documentIdSchema', () => {
    it('should validate valid document ID', () => {
      const { error, value } = documentIdSchema.validate('doc123');
      expect(error).toBeUndefined();
      expect(value).toBe('doc123');
    });

    it('should require document ID', () => {
      const { error } = documentIdSchema.validate('');
      expect(error?.details[0].message).toContain('Document ID cannot be empty');
    });

    it('should require document ID to be provided', () => {
      const { error } = documentIdSchema.validate(undefined);
      expect(error?.details[0].message).toContain('Document ID is required');
    });
  });

  describe('validateFileType', () => {
    it('should accept valid MIME types', () => {
      expect(validateFileType('application/pdf')).toBe(true);
      expect(validateFileType('image/jpeg')).toBe(true);
      expect(validateFileType('image/png')).toBe(true);
      expect(validateFileType('image/gif')).toBe(true);
      expect(validateFileType('application/msword')).toBe(true);
    });

    it('should reject invalid MIME types', () => {
      expect(validateFileType('application/exe')).toBe(false);
      expect(validateFileType('text/plain')).toBe(false);
      expect(validateFileType('video/mp4')).toBe(false);
    });

    it('should handle case insensitive MIME types', () => {
      expect(validateFileType('APPLICATION/PDF')).toBe(true);
      expect(validateFileType('Image/JPEG')).toBe(true);
    });
  });

  describe('validateFileSize', () => {
    it('should accept files within size limit', () => {
      expect(validateFileSize(1024)).toBe(true); // 1KB
      expect(validateFileSize(1024 * 1024)).toBe(true); // 1MB
      expect(validateFileSize(5 * 1024 * 1024)).toBe(true); // 5MB
      expect(validateFileSize(10 * 1024 * 1024)).toBe(true); // 10MB (exactly at limit)
    });

    it('should reject files exceeding size limit', () => {
      expect(validateFileSize(11 * 1024 * 1024)).toBe(false); // 11MB
      expect(validateFileSize(20 * 1024 * 1024)).toBe(false); // 20MB
    });

    it('should handle zero size files', () => {
      expect(validateFileSize(0)).toBe(true);
    });
  });

  describe('validateDocumentTypeSpecific', () => {
    describe('Passport documents', () => {
      it('should accept valid passport documents', () => {
        const result = validateDocumentTypeSpecific(
          DocumentType.PASSPORT,
          'application/pdf',
          1024 * 1024, // 1MB
          'passport.pdf'
        );
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject invalid MIME types for passport', () => {
        const result = validateDocumentTypeSpecific(
          DocumentType.PASSPORT,
          'application/msword',
          1024 * 1024,
          'passport.doc'
        );
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain('Invalid file type for Passport');
      });

      it('should reject oversized passport files', () => {
        const result = validateDocumentTypeSpecific(
          DocumentType.PASSPORT,
          'application/pdf',
          6 * 1024 * 1024, // 6MB (exceeds 5MB limit)
          'passport.pdf'
        );
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain('File size exceeds 5MB limit');
      });

      it('should validate file extension matches MIME type', () => {
        const result = validateDocumentTypeSpecific(
          DocumentType.PASSPORT,
          'application/pdf',
          1024 * 1024,
          'passport.jpg' // Wrong extension for PDF
        );
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain('File extension .jpg does not match MIME type');
      });
    });

    describe('Tour Form documents', () => {
      it('should require description for tour forms', () => {
        const result = validateDocumentTypeSpecific(
          DocumentType.TOUR_FORM,
          'application/pdf',
          1024 * 1024,
          'form.pdf'
          // No description provided
        );
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain('Description is required for TourForm');
      });

      it('should accept tour forms with description', () => {
        const result = validateDocumentTypeSpecific(
          DocumentType.TOUR_FORM,
          'application/pdf',
          1024 * 1024,
          'form.pdf',
          'Tourist registration form'
        );
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject empty description for tour forms', () => {
        const result = validateDocumentTypeSpecific(
          DocumentType.TOUR_FORM,
          'application/pdf',
          1024 * 1024,
          'form.pdf',
          '   ' // Whitespace only
        );
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain('Description is required for TourForm');
      });
    });

    describe('Other documents', () => {
      it('should require description for other documents', () => {
        const result = validateDocumentTypeSpecific(
          DocumentType.OTHER,
          'application/pdf',
          1024 * 1024,
          'document.pdf'
        );
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain('Description is required for Other');
      });

      it('should accept all valid MIME types for other documents', () => {
        const result = validateDocumentTypeSpecific(
          DocumentType.OTHER,
          'application/msword',
          1024 * 1024,
          'document.doc',
          'Supporting document'
        );
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    describe('Ticket documents', () => {
      it('should accept valid ticket documents', () => {
        const result = validateDocumentTypeSpecific(
          DocumentType.TICKET,
          'image/jpeg',
          2 * 1024 * 1024, // 2MB
          'ticket.jpg'
        );
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject oversized ticket files', () => {
        const result = validateDocumentTypeSpecific(
          DocumentType.TICKET,
          'image/jpeg',
          4 * 1024 * 1024, // 4MB (exceeds 3MB limit)
          'ticket.jpg'
        );
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain('File size exceeds 3MB limit');
      });
    });
  });

  describe('validateFileName', () => {
    it('should accept valid file names', () => {
      const result = validateFileName('document.pdf');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject file names without extensions', () => {
      const result = validateFileName('document');
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('File must have an extension');
    });

    it('should reject file names that are too long', () => {
      const longName = 'a'.repeat(252) + '.pdf'; // 256 characters total
      const result = validateFileName(longName);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('File name cannot exceed 255 characters');
    });

    it('should reject file names with invalid characters', () => {
      const result = validateFileName('file<name>.pdf');
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('File name contains invalid characters');
    });

    it('should reject reserved system names', () => {
      const result = validateFileName('CON.pdf');
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('File name uses a reserved system name');
    });

    it('should handle multiple validation errors', () => {
      const result = validateFileName('CON<>.pdf'.repeat(50)); // Long + invalid chars + reserved name
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('Document type utility functions', () => {
    it('should return document type info', () => {
      const info = getDocumentTypeInfo(DocumentType.PASSPORT);
      expect(info.allowedMimeTypes).toContain('application/pdf');
      expect(info.maxFileSize).toBe(5 * 1024 * 1024);
      expect(info.description).toContain('Passport');
    });

    it('should return allowed file types for document type', () => {
      const types = getAllowedFileTypesForDocumentType(DocumentType.TOUR_FORM);
      expect(types).toContain('application/pdf');
      expect(types).toContain('application/msword');
    });

    it('should return max file size for document type', () => {
      const maxSize = getMaxFileSizeForDocumentType(DocumentType.TICKET);
      expect(maxSize).toBe(3 * 1024 * 1024); // 3MB
    });

    it('should have rules for all document types', () => {
      Object.values(DocumentType).forEach(type => {
        expect(documentTypeRules[type]).toBeDefined();
        expect(documentTypeRules[type].allowedMimeTypes).toBeInstanceOf(Array);
        expect(documentTypeRules[type].maxFileSize).toBeGreaterThan(0);
        expect(documentTypeRules[type].description).toBeTruthy();
      });
    });
  });

  describe('Advanced validation functions', () => {
    describe('validateDocumentMetadata', () => {
      it('should validate complete document metadata', () => {
        const metadata = {
          fileName: 'passport.pdf',
          fileSize: 1024 * 1024, // 1MB
          mimeType: 'application/pdf',
          documentType: DocumentType.PASSPORT,
        };

        const result = validateDocumentMetadata(metadata);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should detect multiple validation errors', () => {
        const metadata = {
          fileName: 'invalid<file>.exe', // Invalid characters and extension
          fileSize: 15 * 1024 * 1024, // Too large
          mimeType: 'application/exe', // Invalid MIME type
          documentType: DocumentType.PASSPORT,
        };

        const result = validateDocumentMetadata(metadata);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(1);
      });

      it('should validate tour form with description requirement', () => {
        const metadata = {
          fileName: 'form.pdf',
          fileSize: 1024 * 1024,
          mimeType: 'application/pdf',
          documentType: DocumentType.TOUR_FORM,
          description: 'Tourist registration form',
        };

        const result = validateDocumentMetadata(metadata);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    describe('validateSearchCriteria', () => {
      it('should validate valid search criteria', () => {
        const criteria = {
          type: DocumentType.PASSPORT,
          fileName: 'passport',
          dateFrom: '2024-01-01T00:00:00.000Z',
          dateTo: '2024-12-31T23:59:59.999Z',
          limit: 50,
          offset: 0,
          sortBy: 'uploadDate',
          sortOrder: 'desc',
        };

        const result = validateSearchCriteria(criteria);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject invalid document type', () => {
        const criteria = {
          type: 'INVALID_TYPE',
        };

        const result = validateSearchCriteria(criteria);
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain('Invalid document type');
      });

      it('should reject invalid date formats', () => {
        const criteria = {
          dateFrom: 'invalid-date',
          dateTo: '2024-13-45', // Invalid date
        };

        const result = validateSearchCriteria(criteria);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(error => error.includes('Invalid dateFrom format'))).toBe(true);
        expect(result.errors.some(error => error.includes('Invalid dateTo format'))).toBe(true);
      });

      it('should reject invalid date range', () => {
        const criteria = {
          dateFrom: '2024-12-31T00:00:00.000Z',
          dateTo: '2024-01-01T00:00:00.000Z', // dateFrom > dateTo
        };

        const result = validateSearchCriteria(criteria);
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain('dateFrom cannot be later than dateTo');
      });

      it('should reject invalid pagination parameters', () => {
        const criteria = {
          limit: 150, // Too high
          offset: -5, // Negative
        };

        const result = validateSearchCriteria(criteria);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(error => error.includes('Limit must be between 1 and 100'))).toBe(true);
        expect(result.errors.some(error => error.includes('Offset must be non-negative'))).toBe(true);
      });

      it('should reject invalid sort parameters', () => {
        const criteria = {
          sortBy: 'invalidField',
          sortOrder: 'invalidOrder',
        };

        const result = validateSearchCriteria(criteria);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(error => error.includes('Invalid sortBy field'))).toBe(true);
        expect(result.errors.some(error => error.includes('Invalid sortOrder'))).toBe(true);
      });
    });

    describe('validateFileIntegrity', () => {
      it('should validate matching file metadata', () => {
        const expected = {
          fileName: 'passport.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
          checksum: 'abc123',
        };

        const actual = {
          fileName: 'passport.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
          checksum: 'abc123',
        };

        const result = validateFileIntegrity(expected, actual);
        expect(result.isValid).toBe(true);
        expect(result.issues).toHaveLength(0);
      });

      it('should detect file size mismatch', () => {
        const expected = {
          fileName: 'passport.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
        };

        const actual = {
          fileSize: 2048, // Different size
        };

        const result = validateFileIntegrity(expected, actual);
        expect(result.isValid).toBe(false);
        expect(result.issues[0]).toContain('File size mismatch');
      });

      it('should detect MIME type mismatch', () => {
        const expected = {
          fileName: 'passport.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
        };

        const actual = {
          mimeType: 'image/jpeg', // Different MIME type
        };

        const result = validateFileIntegrity(expected, actual);
        expect(result.isValid).toBe(false);
        expect(result.issues[0]).toContain('MIME type mismatch');
      });

      it('should detect checksum mismatch', () => {
        const expected = {
          fileName: 'passport.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
          checksum: 'abc123',
        };

        const actual = {
          checksum: 'def456', // Different checksum
        };

        const result = validateFileIntegrity(expected, actual);
        expect(result.isValid).toBe(false);
        expect(result.issues[0]).toContain('Checksum mismatch');
      });
    });

    describe('generateDocumentValidationReport', () => {
      it('should generate validation report for mixed documents', () => {
        const documents = [
          {
            documentId: 'doc1',
            fileName: 'passport.pdf',
            fileSize: 1024 * 1024,
            mimeType: 'application/pdf',
            type: DocumentType.PASSPORT,
          },
          {
            documentId: 'doc2',
            fileName: 'invalid<file>.exe',
            fileSize: 15 * 1024 * 1024, // Too large
            mimeType: 'application/exe', // Invalid
            type: DocumentType.TICKET,
          },
          {
            documentId: 'doc3',
            fileName: 'form.pdf',
            fileSize: 1024 * 1024,
            mimeType: 'application/pdf',
            type: DocumentType.TOUR_FORM,
            // Missing required description
          },
        ];

        const report = generateDocumentValidationReport(documents);

        expect(report.totalDocuments).toBe(3);
        expect(report.validDocuments).toBe(1);
        expect(report.invalidDocuments).toBe(2);
        expect(report.validationErrors).toHaveLength(2);
        expect(report.summary.documentTypeBreakdown[DocumentType.PASSPORT].valid).toBe(1);
        expect(report.summary.documentTypeBreakdown[DocumentType.TICKET].invalid).toBe(1);
        expect(report.summary.documentTypeBreakdown[DocumentType.TOUR_FORM].invalid).toBe(1);
      });

      it('should handle empty document list', () => {
        const report = generateDocumentValidationReport([]);

        expect(report.totalDocuments).toBe(0);
        expect(report.validDocuments).toBe(0);
        expect(report.invalidDocuments).toBe(0);
        expect(report.validationErrors).toHaveLength(0);
      });

      it('should count common errors correctly', () => {
        const documents = [
          {
            documentId: 'doc1',
            fileName: 'file1.exe',
            fileSize: 15 * 1024 * 1024,
            mimeType: 'application/exe',
            type: DocumentType.PASSPORT,
          },
          {
            documentId: 'doc2',
            fileName: 'file2.exe',
            fileSize: 15 * 1024 * 1024,
            mimeType: 'application/exe',
            type: DocumentType.TICKET,
          },
        ];

        const report = generateDocumentValidationReport(documents);

        expect(report.summary.commonErrors['Invalid file type']).toBe(2);
        expect(report.summary.commonErrors['File size exceeds maximum limit']).toBe(2);
      });
    });

    describe('getDocumentTypeValidationRules', () => {
      it('should return validation rules with examples for all document types', () => {
        const rules = getDocumentTypeValidationRules();

        Object.values(DocumentType).forEach(type => {
          expect(rules[type]).toBeDefined();
          expect(rules[type].allowedMimeTypes).toBeInstanceOf(Array);
          expect(rules[type].maxFileSize).toBeGreaterThan(0);
          expect(rules[type].description).toBeTruthy();
          expect(rules[type].examples).toBeInstanceOf(Array);
          expect(rules[type].examples.length).toBeGreaterThan(0);
        });
      });

      it('should include specific examples for each document type', () => {
        const rules = getDocumentTypeValidationRules();

        expect(rules[DocumentType.PASSPORT].examples).toContain('passport.pdf');
        expect(rules[DocumentType.TICKET].examples).toContain('flight_ticket.pdf');
        expect(rules[DocumentType.TOUR_FORM].examples).toContain('registration_form.pdf');
        expect(rules[DocumentType.OTHER].examples).toContain('insurance.pdf');
      });
    });
  });
});