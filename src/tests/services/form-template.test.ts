import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FormTemplateService } from '../../services/form-template';
import { FileStorageService } from '../../services/file-storage';

// Mock file storage service
const mockFileStorage = {
  fileExists: vi.fn(),
  getFileMetadata: vi.fn(),
  generatePresignedUrl: vi.fn(),
  getFileContent: vi.fn(),
} as any;

describe('FormTemplateService', () => {
  let formTemplateService: FormTemplateService;

  beforeEach(() => {
    vi.clearAllMocks();
    formTemplateService = new FormTemplateService(mockFileStorage);
  });

  describe('getAllForms', () => {
    it('should return all active form templates', async () => {
      const forms = await formTemplateService.getAllForms();

      expect(forms).toBeInstanceOf(Array);
      expect(forms.length).toBeGreaterThan(0);
      
      forms.forEach(form => {
        expect(form).toMatchObject({
          id: expect.any(String),
          name: expect.any(String),
          description: expect.any(String),
          fileName: expect.any(String),
          version: expect.any(String),
          category: expect.any(String),
          fileSize: expect.any(Number),
          mimeType: expect.any(String),
          lastUpdated: expect.any(Date),
          isActive: true,
        });
      });
    });

    it('should only return active forms', async () => {
      const forms = await formTemplateService.getAllForms();
      
      forms.forEach(form => {
        expect(form.isActive).toBe(true);
      });
    });
  });

  describe('getFormsByCategory', () => {
    it('should return forms filtered by category', async () => {
      const registrationForms = await formTemplateService.getFormsByCategory('registration');
      const medicalForms = await formTemplateService.getFormsByCategory('medical');

      expect(registrationForms).toBeInstanceOf(Array);
      expect(medicalForms).toBeInstanceOf(Array);

      registrationForms.forEach(form => {
        expect(form.category).toBe('registration');
        expect(form.isActive).toBe(true);
      });

      medicalForms.forEach(form => {
        expect(form.category).toBe('medical');
        expect(form.isActive).toBe(true);
      });
    });

    it('should return empty array for non-existent category', async () => {
      const forms = await formTemplateService.getFormsByCategory('non-existent' as any);
      expect(forms).toEqual([]);
    });
  });

  describe('getFormById', () => {
    it('should return form by ID', async () => {
      const form = await formTemplateService.getFormById('tourist-registration-v1');

      expect(form).toBeDefined();
      expect(form?.id).toBe('tourist-registration-v1');
      expect(form?.name).toBe('Tourist Registration Form');
      expect(form?.isActive).toBe(true);
    });

    it('should return null for non-existent form ID', async () => {
      const form = await formTemplateService.getFormById('non-existent-form');
      expect(form).toBeNull();
    });
  });

  describe('generateFormDownloadUrl', () => {
    it('should generate download URL for valid form', async () => {
      const downloadInfo = await formTemplateService.generateFormDownloadUrl('tourist-registration-v1');

      expect(downloadInfo).toBeDefined();
      expect(downloadInfo?.downloadUrl).toContain('tourist-registration-v1');
      expect(downloadInfo?.fileName).toBe('tourist-registration-form-v1.pdf');
      expect(downloadInfo?.mimeType).toBe('application/pdf');
      expect(downloadInfo?.fileSize).toBeGreaterThan(0);
      expect(downloadInfo?.expiresAt).toBeInstanceOf(Date);
    });

    it('should return null for non-existent form', async () => {
      const downloadInfo = await formTemplateService.generateFormDownloadUrl('non-existent-form');
      expect(downloadInfo).toBeNull();
    });

    it('should use custom expiration time', async () => {
      const customExpiresIn = 1800; // 30 minutes
      const downloadInfo = await formTemplateService.generateFormDownloadUrl(
        'tourist-registration-v1',
        customExpiresIn
      );

      expect(downloadInfo).toBeDefined();
      
      const expectedExpiryTime = Date.now() + customExpiresIn * 1000;
      const actualExpiryTime = downloadInfo!.expiresAt.getTime();
      
      // Allow 1 second tolerance for timing differences
      expect(Math.abs(actualExpiryTime - expectedExpiryTime)).toBeLessThan(1000);
    });
  });

  describe('validateDownloadSignature', () => {
    it('should validate correct signature', async () => {
      // Generate a download URL first to get the signature format
      const downloadInfo = await formTemplateService.generateFormDownloadUrl('tourist-registration-v1');
      const url = new URL(downloadInfo!.downloadUrl);
      const expires = url.searchParams.get('expires')!;
      const signature = url.searchParams.get('signature')!;

      const isValid = formTemplateService.validateDownloadSignature(
        'tourist-registration-v1',
        expires,
        signature
      );

      expect(isValid).toBe(true);
    });

    it('should reject expired signatures', async () => {
      const expiredTime = (Date.now() - 1000).toString(); // 1 second ago
      const signature = 'valid-signature';

      const isValid = formTemplateService.validateDownloadSignature(
        'tourist-registration-v1',
        expiredTime,
        signature
      );

      expect(isValid).toBe(false);
    });

    it('should reject invalid form IDs', async () => {
      const futureTime = (Date.now() + 3600000).toString(); // 1 hour from now
      const signature = 'valid-signature';

      const isValid = formTemplateService.validateDownloadSignature(
        'non-existent-form',
        futureTime,
        signature
      );

      expect(isValid).toBe(false);
    });
  });

  describe('getFormContent', () => {
    it('should return form content for valid form', async () => {
      const content = await formTemplateService.getFormContent('tourist-registration-v1');

      expect(content).toBeInstanceOf(Buffer);
      expect(content?.length).toBeGreaterThan(0);
      
      // Check if it's a PDF (starts with %PDF)
      const pdfHeader = content?.toString('ascii', 0, 4);
      expect(pdfHeader).toBe('%PDF');
    });

    it('should return null for non-existent form', async () => {
      const content = await formTemplateService.getFormContent('non-existent-form');
      expect(content).toBeNull();
    });
  });

  describe('searchForms', () => {
    it('should find forms by name', async () => {
      const results = await formTemplateService.searchForms('registration');

      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBeGreaterThan(0);
      
      results.forEach(form => {
        expect(
          form.name.toLowerCase().includes('registration') ||
          form.description.toLowerCase().includes('registration')
        ).toBe(true);
      });
    });

    it('should find forms by description', async () => {
      const results = await formTemplateService.searchForms('medical');

      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBeGreaterThan(0);
      
      results.forEach(form => {
        expect(
          form.name.toLowerCase().includes('medical') ||
          form.description.toLowerCase().includes('medical')
        ).toBe(true);
      });
    });

    it('should return empty array for no matches', async () => {
      const results = await formTemplateService.searchForms('nonexistentterm');
      expect(results).toEqual([]);
    });

    it('should be case insensitive', async () => {
      const lowerResults = await formTemplateService.searchForms('tourist');
      const upperResults = await formTemplateService.searchForms('TOURIST');
      const mixedResults = await formTemplateService.searchForms('Tourist');

      expect(lowerResults).toEqual(upperResults);
      expect(upperResults).toEqual(mixedResults);
    });
  });

  describe('getFormStatistics', () => {
    it('should return form statistics', async () => {
      const stats = await formTemplateService.getFormStatistics();

      expect(stats).toMatchObject({
        totalForms: expect.any(Number),
        formsByCategory: {
          registration: expect.any(Number),
          medical: expect.any(Number),
          insurance: expect.any(Number),
          travel: expect.any(Number),
          other: expect.any(Number),
        },
        totalSize: expect.any(Number),
        averageSize: expect.any(Number),
      });

      expect(stats.totalForms).toBeGreaterThan(0);
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(stats.averageSize).toBeGreaterThan(0);

      // Check that category counts add up to total
      const categorySum = Object.values(stats.formsByCategory).reduce((sum, count) => sum + count, 0);
      expect(categorySum).toBe(stats.totalForms);
    });
  });
});