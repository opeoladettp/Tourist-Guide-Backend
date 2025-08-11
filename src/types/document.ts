export enum DocumentType {
  PASSPORT = 'Passport',
  TICKET = 'Ticket',
  TOUR_FORM = 'TourForm',
  OTHER = 'Other'
}

export interface Document {
  documentId: string;
  userId: string;
  type: DocumentType;
  fileName: string;
  description?: string;
  uploadedByUserId: string;
  uploadDate: Date;
  fileStoragePath: string;
  fileSize: number;
  mimeType: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDocumentInput {
  userId: string;
  type: DocumentType;
  fileName: string;
  description?: string;
  fileBuffer: Buffer;
  mimeType: string;
}

export interface UpdateDocumentInput {
  description?: string;
}

export interface DocumentMetadata {
  documentId: string;
  originalFileName: string;
  fileSize: number;
  mimeType: string;
  uploadDate: Date;
  lastModified: Date;
  checksum?: string;
  tags?: string[];
  version: number;
  isActive: boolean;
}

export interface DocumentSearchCriteria {
  userId?: string;
  type?: DocumentType;
  fileName?: string;
  description?: string;
  mimeType?: string;
  uploadedByUserId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  tags?: string[];
  limit?: number;
  offset?: number;
  sortBy?: 'uploadDate' | 'fileName' | 'fileSize' | 'type';
  sortOrder?: 'asc' | 'desc';
}

export interface DocumentSearchResult {
  documents: Document[];
  total: number;
  hasMore: boolean;
}