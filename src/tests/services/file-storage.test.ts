import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FileStorageService } from '../../services/file-storage';
import { S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Mock AWS SDK
vi.mock('@aws-sdk/client-s3');
vi.mock('@aws-sdk/s3-request-presigner');
vi.mock('../../config', () => ({
  config: {
    aws: {
      region: 'us-east-1',
      s3Bucket: 'test-bucket',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    },
  },
}));

describe('FileStorageService', () => {
  let fileStorageService: FileStorageService;
  let mockS3Client: any;
  let mockSend: any;

  beforeEach(() => {
    mockSend = vi.fn();
    mockS3Client = {
      send: mockSend,
    };
    
    (S3Client as any).mockImplementation(() => mockS3Client);
    fileStorageService = new FileStorageService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('uploadFile', () => {
    const validFileBuffer = Buffer.from('test file content');
    const validMetadata = {
      originalName: 'test.pdf',
      mimeType: 'application/pdf',
      size: validFileBuffer.length,
      userId: 'user123',
      documentType: 'Passport',
    };

    it('should upload file successfully', async () => {
      mockSend.mockResolvedValue({
        ETag: '"test-etag"',
      });

      const result = await fileStorageService.uploadFile(validFileBuffer, validMetadata);

      expect(result).toMatchObject({
        key: expect.stringMatching(/^documents\/user123\/Passport\/[a-f0-9-]+\.pdf$/),
        url: expect.stringContaining('test-bucket.s3.us-east-1.amazonaws.com'),
        size: validFileBuffer.length,
        etag: '"test-etag"',
      });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          constructor: expect.any(Function),
        })
      );
    });

    it('should reject files larger than 10MB', async () => {
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB
      
      await expect(
        fileStorageService.uploadFile(largeBuffer, validMetadata)
      ).rejects.toThrow('File size exceeds 10MB limit');
    });

    it('should reject invalid file types', async () => {
      const invalidMetadata = {
        ...validMetadata,
        mimeType: 'application/exe',
      };

      await expect(
        fileStorageService.uploadFile(validFileBuffer, invalidMetadata)
      ).rejects.toThrow('Invalid file type');
    });

    it('should handle S3 upload errors', async () => {
      mockSend.mockRejectedValue(new Error('S3 error'));

      await expect(
        fileStorageService.uploadFile(validFileBuffer, validMetadata)
      ).rejects.toThrow('File upload failed: S3 error');
    });

    it('should accept valid file types', async () => {
      const validTypes = [
        'application/pdf',
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];

      mockSend.mockResolvedValue({ ETag: '"test"' });

      for (const mimeType of validTypes) {
        const metadata = { ...validMetadata, mimeType };
        await expect(
          fileStorageService.uploadFile(validFileBuffer, metadata)
        ).resolves.toBeDefined();
      }
    });
  });

  describe('generatePresignedUrl', () => {
    it('should generate presigned URL successfully', async () => {
      const mockUrl = 'https://signed-url.com';
      (getSignedUrl as any).mockResolvedValue(mockUrl);

      const result = await fileStorageService.generatePresignedUrl('test-key');

      expect(result).toBe(mockUrl);
      expect(getSignedUrl).toHaveBeenCalledWith(
        mockS3Client,
        expect.any(Object),
        { expiresIn: 3600 }
      );
    });

    it('should use custom expiration time', async () => {
      const mockUrl = 'https://signed-url.com';
      (getSignedUrl as any).mockResolvedValue(mockUrl);

      await fileStorageService.generatePresignedUrl('test-key', 1800);

      expect(getSignedUrl).toHaveBeenCalledWith(
        mockS3Client,
        expect.any(Object),
        { expiresIn: 1800 }
      );
    });

    it('should handle presigned URL generation errors', async () => {
      (getSignedUrl as any).mockRejectedValue(new Error('URL generation failed'));

      await expect(
        fileStorageService.generatePresignedUrl('test-key')
      ).rejects.toThrow('Failed to generate presigned URL: URL generation failed');
    });
  });

  describe('deleteFile', () => {
    it('should delete file successfully', async () => {
      mockSend.mockResolvedValue({});

      await expect(
        fileStorageService.deleteFile('test-key')
      ).resolves.toBeUndefined();

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          constructor: expect.any(Function),
        })
      );
    });

    it('should handle deletion errors', async () => {
      mockSend.mockRejectedValue(new Error('Deletion failed'));

      await expect(
        fileStorageService.deleteFile('test-key')
      ).rejects.toThrow('File deletion failed: Deletion failed');
    });
  });

  describe('fileExists', () => {
    it('should return true if file exists', async () => {
      mockSend.mockResolvedValue({});

      const result = await fileStorageService.fileExists('test-key');

      expect(result).toBe(true);
    });

    it('should return false if file does not exist', async () => {
      mockSend.mockRejectedValue(new Error('Not found'));

      const result = await fileStorageService.fileExists('test-key');

      expect(result).toBe(false);
    });
  });

  describe('getFileMetadata', () => {
    it('should return file metadata successfully', async () => {
      const mockMetadata = {
        ContentLength: 1024,
        LastModified: new Date('2023-01-01'),
        ContentType: 'application/pdf',
        Metadata: { userId: 'user123' },
      };

      mockSend.mockResolvedValue(mockMetadata);

      const result = await fileStorageService.getFileMetadata('test-key');

      expect(result).toEqual({
        size: 1024,
        lastModified: new Date('2023-01-01'),
        contentType: 'application/pdf',
        metadata: { userId: 'user123' },
      });
    });

    it('should return null if file not found', async () => {
      mockSend.mockRejectedValue(new Error('Not found'));

      const result = await fileStorageService.getFileMetadata('test-key');

      expect(result).toBe(null);
    });

    it('should handle missing metadata fields', async () => {
      mockSend.mockResolvedValue({});

      const result = await fileStorageService.getFileMetadata('test-key');

      expect(result).toEqual({
        size: 0,
        lastModified: expect.any(Date),
        contentType: 'application/octet-stream',
        metadata: {},
      });
    });
  });

  describe('generateUploadPresignedUrl', () => {
    it('should generate upload presigned URL successfully', async () => {
      const mockUrl = 'https://upload-url.com';
      (getSignedUrl as any).mockResolvedValue(mockUrl);

      const result = await fileStorageService.generateUploadPresignedUrl(
        'user123',
        'Passport',
        'test.pdf',
        'application/pdf'
      );

      expect(result).toMatchObject({
        url: mockUrl,
        key: expect.stringMatching(/^documents\/user123\/Passport\/[a-f0-9-]+\.pdf$/),
        fields: {
          'Content-Type': 'application/pdf',
          'x-amz-server-side-encryption': 'AES256',
        },
      });
    });

    it('should reject invalid content types for upload URL', async () => {
      await expect(
        fileStorageService.generateUploadPresignedUrl(
          'user123',
          'Passport',
          'test.exe',
          'application/exe'
        )
      ).rejects.toThrow('Invalid file type');
    });

    it('should use custom expiration time for upload URL', async () => {
      const mockUrl = 'https://upload-url.com';
      (getSignedUrl as any).mockResolvedValue(mockUrl);

      await fileStorageService.generateUploadPresignedUrl(
        'user123',
        'Passport',
        'test.pdf',
        'application/pdf',
        600
      );

      expect(getSignedUrl).toHaveBeenCalledWith(
        mockS3Client,
        expect.any(Object),
        { expiresIn: 600 }
      );
    });
  });

  describe('validateUploadedFile', () => {
    it('should validate uploaded file successfully', async () => {
      mockSend.mockResolvedValue({
        ContentLength: 1024,
        LastModified: new Date(),
        ContentType: 'application/pdf',
        Metadata: {},
      });

      const result = await fileStorageService.validateUploadedFile('test-key', 1024);

      expect(result).toBe(true);
    });

    it('should return false if file not found', async () => {
      mockSend.mockRejectedValue(new Error('Not found'));

      const result = await fileStorageService.validateUploadedFile('test-key');

      expect(result).toBe(false);
    });

    it('should return false if file size mismatch', async () => {
      mockSend.mockResolvedValue({
        ContentLength: 1024,
        LastModified: new Date(),
        ContentType: 'application/pdf',
        Metadata: {},
      });

      const result = await fileStorageService.validateUploadedFile('test-key', 2048);

      expect(result).toBe(false);
    });

    it('should validate without expected size', async () => {
      mockSend.mockResolvedValue({
        ContentLength: 1024,
        LastModified: new Date(),
        ContentType: 'application/pdf',
        Metadata: {},
      });

      const result = await fileStorageService.validateUploadedFile('test-key');

      expect(result).toBe(true);
    });
  });
});