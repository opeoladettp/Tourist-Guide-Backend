import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config';
import * as crypto from 'crypto';
import * as path from 'path';

export interface FileUploadResult {
  key: string;
  url: string;
  size: number;
  etag?: string;
}

export interface FileMetadata {
  originalName: string;
  mimeType: string;
  size: number;
  userId: string;
  documentType: string;
}

export class FileStorageService {
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    this.s3Client = new S3Client({
      region: config.aws.region,
      credentials: {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey,
      },
    });
    this.bucketName = config.aws.s3Bucket;
  }

  /**
   * Upload file to S3 storage
   */
  async uploadFile(
    fileBuffer: Buffer,
    metadata: FileMetadata
  ): Promise<FileUploadResult> {
    try {
      // Validate file size (10MB limit)
      if (fileBuffer.length > 10 * 1024 * 1024) {
        throw new Error('File size exceeds 10MB limit');
      }

      // Validate file type
      if (!this.isValidFileType(metadata.mimeType)) {
        throw new Error('Invalid file type. Allowed: PDF, JPEG, PNG, GIF, DOC, DOCX');
      }

      // Generate unique file key
      const fileExtension = path.extname(metadata.originalName);
      const uniqueFileName = `${crypto.randomUUID()}${fileExtension}`;
      const key = `documents/${metadata.userId}/${metadata.documentType}/${uniqueFileName}`;

      // Prepare upload parameters
      const uploadParams = {
        Bucket: this.bucketName,
        Key: key,
        Body: fileBuffer,
        ContentType: metadata.mimeType,
        ContentLength: fileBuffer.length,
        Metadata: {
          originalName: metadata.originalName,
          userId: metadata.userId,
          documentType: metadata.documentType,
          uploadDate: new Date().toISOString(),
        },
        ServerSideEncryption: 'AES256' as const,
      };

      // Upload to S3
      const command = new PutObjectCommand(uploadParams);
      const result = await this.s3Client.send(command);

      return {
        key,
        url: `https://${this.bucketName}.s3.${config.aws.region}.amazonaws.com/${key}`,
        size: fileBuffer.length,
        etag: result.ETag,
      };
    } catch (error) {
      throw new Error(`File upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate presigned URL for secure file access
   */
  async generatePresignedUrl(
    key: string,
    expiresIn: number = 3600 // 1 hour default
  ): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn,
      });

      return signedUrl;
    } catch (error) {
      throw new Error(`Failed to generate presigned URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete file from S3 storage
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
    } catch (error) {
      throw new Error(`File deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if file exists in S3
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get file metadata from S3
   */
  async getFileMetadata(key: string): Promise<{
    size: number;
    lastModified: Date;
    contentType: string;
    metadata: Record<string, string>;
  } | null> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const result = await this.s3Client.send(command);

      return {
        size: result.ContentLength || 0,
        lastModified: result.LastModified || new Date(),
        contentType: result.ContentType || 'application/octet-stream',
        metadata: result.Metadata || {},
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Validate file type based on MIME type
   */
  private isValidFileType(mimeType: string): boolean {
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    return allowedTypes.includes(mimeType.toLowerCase());
  }

  /**
   * Generate upload presigned URL for direct client uploads
   */
  async generateUploadPresignedUrl(
    userId: string,
    documentType: string,
    fileName: string,
    contentType: string,
    expiresIn: number = 300 // 5 minutes default
  ): Promise<{ url: string; key: string; fields: Record<string, string> }> {
    try {
      // Validate file type
      if (!this.isValidFileType(contentType)) {
        throw new Error('Invalid file type');
      }

      // Generate unique file key
      const fileExtension = path.extname(fileName);
      const uniqueFileName = `${crypto.randomUUID()}${fileExtension}`;
      const key = `documents/${userId}/${documentType}/${uniqueFileName}`;

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        ContentType: contentType,
        Metadata: {
          originalName: fileName,
          userId,
          documentType,
          uploadDate: new Date().toISOString(),
        },
        ServerSideEncryption: 'AES256',
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn,
      });

      return {
        url: signedUrl,
        key,
        fields: {
          'Content-Type': contentType,
          'x-amz-server-side-encryption': 'AES256',
        },
      };
    } catch (error) {
      throw new Error(`Failed to generate upload URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate uploaded file after client upload
   */
  async validateUploadedFile(key: string, expectedSize?: number): Promise<boolean> {
    try {
      const metadata = await this.getFileMetadata(key);
      if (!metadata) {
        return false;
      }

      // Check if file size matches expected size (if provided)
      if (expectedSize && metadata.size !== expectedSize) {
        return false;
      }

      // Additional validation can be added here
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
export const fileStorageService = new FileStorageService();