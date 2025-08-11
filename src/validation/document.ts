import Joi from 'joi';
import { DocumentType } from '../types/document';
import * as path from 'path';

// Create document validation schema
export const createDocumentSchema = Joi.object({
  userId: Joi.string()
    .trim()
    .required()
    .messages({
      'any.required': 'User ID is required',
      'string.empty': 'User ID cannot be empty'
    }),
    
  type: Joi.string()
    .valid(...Object.values(DocumentType))
    .required()
    .messages({
      'any.only': 'Document type must be one of: ' + Object.values(DocumentType).join(', '),
      'any.required': 'Document type is required'
    }),
    
  fileName: Joi.string()
    .trim()
    .min(1)
    .max(255)
    .required()
    .messages({
      'string.min': 'File name is required',
      'string.max': 'File name cannot exceed 255 characters',
      'any.required': 'File name is required'
    }),
    
  description: Joi.string()
    .trim()
    .max(500)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Description cannot exceed 500 characters'
    }),
    
  mimeType: Joi.string()
    .trim()
    .required()
    .messages({
      'any.required': 'MIME type is required',
      'string.empty': 'MIME type cannot be empty'
    }),
    
  fileBuffer: Joi.binary()
    .required()
    .messages({
      'any.required': 'File content is required'
    })
});

// Update document validation schema
export const updateDocumentSchema = Joi.object({
  description: Joi.string()
    .trim()
    .max(500)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Description cannot exceed 500 characters'
    })
});

// Document ID validation schema
export const documentIdSchema = Joi.string()
  .trim()
  .required()
  .messages({
    'any.required': 'Document ID is required',
    'string.empty': 'Document ID cannot be empty'
  });

// File type validation
export const allowedMimeTypes = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

export const maxFileSize = 10 * 1024 * 1024; // 10MB

// File extension mapping for MIME types
export const mimeTypeToExtension: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/jpg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
};

// Document type specific validation rules
export const documentTypeRules: Record<DocumentType, {
  allowedMimeTypes: string[];
  maxFileSize: number;
  requiredFields: string[];
  description: string;
}> = {
  [DocumentType.PASSPORT]: {
    allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
    maxFileSize: 5 * 1024 * 1024, // 5MB for passport images/scans
    requiredFields: ['fileName'],
    description: 'Passport document or scan'
  },
  [DocumentType.TICKET]: {
    allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
    maxFileSize: 3 * 1024 * 1024, // 3MB for tickets
    requiredFields: ['fileName'],
    description: 'Travel ticket or booking confirmation'
  },
  [DocumentType.TOUR_FORM]: {
    allowedMimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ],
    maxFileSize: 5 * 1024 * 1024, // 5MB for forms
    requiredFields: ['fileName', 'description'],
    description: 'Tour registration or information form'
  },
  [DocumentType.OTHER]: {
    allowedMimeTypes: allowedMimeTypes,
    maxFileSize: maxFileSize,
    requiredFields: ['fileName', 'description'],
    description: 'Other supporting documents'
  }
};

export function validateFileType(mimeType: string): boolean {
  return allowedMimeTypes.includes(mimeType.toLowerCase());
}

export function validateFileSize(fileSize: number): boolean {
  return fileSize <= maxFileSize;
}

export function validateDocumentTypeSpecific(
  documentType: DocumentType,
  mimeType: string,
  fileSize: number,
  fileName: string,
  description?: string
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const rules = documentTypeRules[documentType];

  // Check MIME type for document type
  if (!rules.allowedMimeTypes.includes(mimeType.toLowerCase())) {
    errors.push(
      `Invalid file type for ${documentType}. Allowed types: ${rules.allowedMimeTypes.join(', ')}`
    );
  }

  // Check file size for document type
  if (fileSize > rules.maxFileSize) {
    const maxSizeMB = Math.round(rules.maxFileSize / (1024 * 1024));
    errors.push(`File size exceeds ${maxSizeMB}MB limit for ${documentType}`);
  }

  // Check required fields
  if (rules.requiredFields.includes('description') && (!description || description.trim() === '')) {
    errors.push(`Description is required for ${documentType} documents`);
  }

  // Validate file extension matches MIME type
  const fileExtension = path.extname(fileName).toLowerCase();
  const expectedExtensions = mimeTypeToExtension[mimeType.toLowerCase()];
  if (expectedExtensions && !expectedExtensions.includes(fileExtension)) {
    errors.push(
      `File extension ${fileExtension} does not match MIME type ${mimeType}. Expected: ${expectedExtensions.join(' or ')}`
    );
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function validateFileName(fileName: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check file name length
  if (fileName.length > 255) {
    errors.push('File name cannot exceed 255 characters');
  }

  // Check for invalid characters
  const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
  if (invalidChars.test(fileName)) {
    errors.push('File name contains invalid characters');
  }

  // Check for reserved names (Windows)
  const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
  const nameWithoutExt = path.parse(fileName).name.toUpperCase();
  if (reservedNames.includes(nameWithoutExt)) {
    errors.push('File name uses a reserved system name');
  }

  // Check for file extension
  const extension = path.extname(fileName);
  if (!extension) {
    errors.push('File must have an extension');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function getDocumentTypeInfo(documentType: DocumentType) {
  return documentTypeRules[documentType];
}

export function getAllowedFileTypesForDocumentType(documentType: DocumentType): string[] {
  return documentTypeRules[documentType].allowedMimeTypes;
}

export function getMaxFileSizeForDocumentType(documentType: DocumentType): number {
  return documentTypeRules[documentType].maxFileSize;
}

// Advanced validation functions for metadata management

export function validateDocumentMetadata(metadata: {
  fileName: string;
  fileSize: number;
  mimeType: string;
  documentType: DocumentType;
  description?: string;
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate file name
  const fileNameValidation = validateFileName(metadata.fileName);
  if (!fileNameValidation.isValid) {
    errors.push(...fileNameValidation.errors);
  }

  // Validate file type
  if (!validateFileType(metadata.mimeType)) {
    errors.push('Invalid file type');
  }

  // Validate file size
  if (!validateFileSize(metadata.fileSize)) {
    errors.push('File size exceeds maximum limit');
  }

  // Validate document type specific rules
  const typeValidation = validateDocumentTypeSpecific(
    metadata.documentType,
    metadata.mimeType,
    metadata.fileSize,
    metadata.fileName,
    metadata.description
  );
  if (!typeValidation.isValid) {
    errors.push(...typeValidation.errors);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function validateSearchCriteria(criteria: {
  type?: string;
  fileName?: string;
  description?: string;
  mimeType?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: string;
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate document type if provided
  if (criteria.type && !Object.values(DocumentType).includes(criteria.type as DocumentType)) {
    errors.push(`Invalid document type. Must be one of: ${Object.values(DocumentType).join(', ')}`);
  }

  // Validate MIME type if provided
  if (criteria.mimeType && !validateFileType(criteria.mimeType)) {
    errors.push('Invalid MIME type');
  }

  // Validate date formats
  if (criteria.dateFrom) {
    const dateFrom = new Date(criteria.dateFrom);
    if (isNaN(dateFrom.getTime())) {
      errors.push('Invalid dateFrom format. Use ISO 8601 format');
    }
  }

  if (criteria.dateTo) {
    const dateTo = new Date(criteria.dateTo);
    if (isNaN(dateTo.getTime())) {
      errors.push('Invalid dateTo format. Use ISO 8601 format');
    }
  }

  // Validate date range
  if (criteria.dateFrom && criteria.dateTo) {
    const dateFrom = new Date(criteria.dateFrom);
    const dateTo = new Date(criteria.dateTo);
    if (dateFrom > dateTo) {
      errors.push('dateFrom cannot be later than dateTo');
    }
  }

  // Validate pagination parameters
  if (criteria.limit !== undefined) {
    if (criteria.limit < 1 || criteria.limit > 100) {
      errors.push('Limit must be between 1 and 100');
    }
  }

  if (criteria.offset !== undefined && criteria.offset < 0) {
    errors.push('Offset must be non-negative');
  }

  // Validate sort parameters
  const validSortFields = ['uploadDate', 'fileName', 'fileSize', 'type'];
  if (criteria.sortBy && !validSortFields.includes(criteria.sortBy)) {
    errors.push(`Invalid sortBy field. Must be one of: ${validSortFields.join(', ')}`);
  }

  const validSortOrders = ['asc', 'desc'];
  if (criteria.sortOrder && !validSortOrders.includes(criteria.sortOrder)) {
    errors.push(`Invalid sortOrder. Must be one of: ${validSortOrders.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function getDocumentTypeValidationRules(): Record<DocumentType, {
  allowedMimeTypes: string[];
  maxFileSize: number;
  requiredFields: string[];
  description: string;
  examples: string[];
}> {
  return {
    [DocumentType.PASSPORT]: {
      ...documentTypeRules[DocumentType.PASSPORT],
      examples: ['passport.pdf', 'passport_scan.jpg', 'passport_photo.png']
    },
    [DocumentType.TICKET]: {
      ...documentTypeRules[DocumentType.TICKET],
      examples: ['flight_ticket.pdf', 'boarding_pass.jpg', 'train_ticket.png']
    },
    [DocumentType.TOUR_FORM]: {
      ...documentTypeRules[DocumentType.TOUR_FORM],
      examples: ['registration_form.pdf', 'tour_application.docx', 'booking_form.doc']
    },
    [DocumentType.OTHER]: {
      ...documentTypeRules[DocumentType.OTHER],
      examples: ['insurance.pdf', 'medical_certificate.jpg', 'visa.png', 'id_card.pdf']
    }
  };
}

export function validateFileIntegrity(
  expectedMetadata: {
    fileName: string;
    fileSize: number;
    mimeType: string;
    checksum?: string;
  },
  actualMetadata: {
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    checksum?: string;
  }
): { isValid: boolean; issues: string[] } {
  const issues: string[] = [];

  // Check file size
  if (actualMetadata.fileSize !== undefined && actualMetadata.fileSize !== expectedMetadata.fileSize) {
    issues.push(`File size mismatch: expected ${expectedMetadata.fileSize}, found ${actualMetadata.fileSize}`);
  }

  // Check MIME type
  if (actualMetadata.mimeType !== undefined && actualMetadata.mimeType !== expectedMetadata.mimeType) {
    issues.push(`MIME type mismatch: expected ${expectedMetadata.mimeType}, found ${actualMetadata.mimeType}`);
  }

  // Check checksum if available
  if (expectedMetadata.checksum && actualMetadata.checksum && 
      actualMetadata.checksum !== expectedMetadata.checksum) {
    issues.push(`Checksum mismatch: file may be corrupted`);
  }

  // Check file name consistency
  if (actualMetadata.fileName !== undefined && actualMetadata.fileName !== expectedMetadata.fileName) {
    issues.push(`File name mismatch: expected ${expectedMetadata.fileName}, found ${actualMetadata.fileName}`);
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

export function generateDocumentValidationReport(
  documents: Array<{
    documentId: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    type: DocumentType;
    description?: string;
  }>
): {
  totalDocuments: number;
  validDocuments: number;
  invalidDocuments: number;
  validationErrors: Array<{
    documentId: string;
    fileName: string;
    errors: string[];
  }>;
  summary: {
    commonErrors: Record<string, number>;
    documentTypeBreakdown: Record<DocumentType, { valid: number; invalid: number }>;
  };
} {
  const validationErrors: Array<{
    documentId: string;
    fileName: string;
    errors: string[];
  }> = [];

  const commonErrors: Record<string, number> = {};
  const documentTypeBreakdown: Record<DocumentType, { valid: number; invalid: number }> = {
    [DocumentType.PASSPORT]: { valid: 0, invalid: 0 },
    [DocumentType.TICKET]: { valid: 0, invalid: 0 },
    [DocumentType.TOUR_FORM]: { valid: 0, invalid: 0 },
    [DocumentType.OTHER]: { valid: 0, invalid: 0 },
  };

  documents.forEach(doc => {
    const validation = validateDocumentMetadata({
      fileName: doc.fileName,
      fileSize: doc.fileSize,
      mimeType: doc.mimeType,
      documentType: doc.type,
      description: doc.description,
    });

    if (validation.isValid) {
      documentTypeBreakdown[doc.type].valid++;
    } else {
      documentTypeBreakdown[doc.type].invalid++;
      validationErrors.push({
        documentId: doc.documentId,
        fileName: doc.fileName,
        errors: validation.errors,
      });

      // Count common errors
      validation.errors.forEach(error => {
        commonErrors[error] = (commonErrors[error] || 0) + 1;
      });
    }
  });

  return {
    totalDocuments: documents.length,
    validDocuments: documents.length - validationErrors.length,
    invalidDocuments: validationErrors.length,
    validationErrors,
    summary: {
      commonErrors,
      documentTypeBreakdown,
    },
  };
}