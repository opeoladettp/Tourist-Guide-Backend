import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '../../generated/prisma';
import { TourTemplateService } from '../../services/tour-template';
import { UserType } from '../../types/user';
import { SiteCategory } from '../../types/tour-template';

// Mock Prisma Client
const mockPrisma = {
  tourTemplate: {
    findUnique: vi.fn(),
  },
  siteToVisit: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  $transaction: vi.fn(),
} as unknown as PrismaClient;

describe('TourTemplateService - Site Management', () => {
  let tourTemplateService: TourTemplateService;

  beforeEach(() => {
    tourTemplateService = new TourTemplateService(mockPrisma);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  const mockTemplate = {
    templateId: 'template123',
    templateName: 'Test Template',
    type: 'Cultural',
    year: 2024,
    startDate: new Date('2024-06-01'),
    endDate: new Date('2024-06-15'),
    detailedDescription: 'Test description',
    sitesToVisit: []
  };

  const validSiteInput = {
    siteName: 'Test Site',
    description: 'A test site description',
    location: 'Test Location',
    visitDuration: '2 hours',
    estimatedCost: 25.50,
    category: SiteCategory.CULTURAL,
    isOptional: false,
    orderIndex: 1
  };

  const mockSite = {
    siteId: 'site123',
    templateId: 'template123',
    ...validSiteInput,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  describe('addSiteToTemplate', () => {
    it('should add site to template successfully (System Admin)', async () => {
      mockPrisma.tourTemplate.findUnique = vi.fn().mockResolvedValue(mockTemplate);
      mockPrisma.siteToVisit.findFirst = vi.fn().mockResolvedValue(null); // No duplicate order
      mockPrisma.siteToVisit.create = vi.fn().mockResolvedValue(mockSite);

      const result = await tourTemplateService.addSiteToTemplate(
        'template123',
        validSiteInput,
        UserType.SYSTEM_ADMIN
      );

      expect(result).toEqual(mockSite);
      expect(mockPrisma.siteToVisit.create).toHaveBeenCalledWith({
        data: {
          templateId: 'template123',
          siteName: validSiteInput.siteName,
          description: validSiteInput.description,
          location: validSiteInput.location,
          visitDuration: validSiteInput.visitDuration,
          estimatedCost: validSiteInput.estimatedCost,
          category: validSiteInput.category,
          isOptional: validSiteInput.isOptional,
          orderIndex: validSiteInput.orderIndex
        }
      });
    });

    it('should handle optional fields correctly', async () => {
      const siteInputWithoutOptionals = {
        siteName: 'Test Site',
        location: 'Test Location',
        visitDuration: '2 hours',
        category: SiteCategory.CULTURAL,
        orderIndex: 1
      };

      const expectedSite = {
        siteId: 'site123',
        templateId: 'template123',
        siteName: 'Test Site',
        description: null,
        location: 'Test Location',
        visitDuration: '2 hours',
        estimatedCost: null,
        category: SiteCategory.CULTURAL,
        isOptional: false,
        orderIndex: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.tourTemplate.findUnique = vi.fn().mockResolvedValue(mockTemplate);
      mockPrisma.siteToVisit.findFirst = vi.fn().mockResolvedValue(null);
      mockPrisma.siteToVisit.create = vi.fn().mockResolvedValue(expectedSite);

      const result = await tourTemplateService.addSiteToTemplate(
        'template123',
        siteInputWithoutOptionals,
        UserType.SYSTEM_ADMIN
      );

      expect(result).toEqual(expectedSite);
      expect(mockPrisma.siteToVisit.create).toHaveBeenCalledWith({
        data: {
          templateId: 'template123',
          siteName: 'Test Site',
          description: null,
          location: 'Test Location',
          visitDuration: '2 hours',
          estimatedCost: null,
          category: SiteCategory.CULTURAL,
          isOptional: false,
          orderIndex: 1
        }
      });
    });

    it('should deny non-system admin from adding sites', async () => {
      await expect(tourTemplateService.addSiteToTemplate(
        'template123',
        validSiteInput,
        UserType.PROVIDER_ADMIN
      )).rejects.toThrow('Insufficient permissions to modify tour templates');

      await expect(tourTemplateService.addSiteToTemplate(
        'template123',
        validSiteInput,
        UserType.TOURIST
      )).rejects.toThrow('Insufficient permissions to modify tour templates');
    });

    it('should throw error for non-existent template', async () => {
      mockPrisma.tourTemplate.findUnique = vi.fn().mockResolvedValue(null);

      await expect(tourTemplateService.addSiteToTemplate(
        'template123',
        validSiteInput,
        UserType.SYSTEM_ADMIN
      )).rejects.toThrow('Tour template not found');
    });

    it('should prevent duplicate order index', async () => {
      mockPrisma.tourTemplate.findUnique = vi.fn().mockResolvedValue(mockTemplate);
      mockPrisma.siteToVisit.findFirst = vi.fn().mockResolvedValue({ siteId: 'existing' });

      await expect(tourTemplateService.addSiteToTemplate(
        'template123',
        validSiteInput,
        UserType.SYSTEM_ADMIN
      )).rejects.toThrow('A site with this order index already exists in the template');
    });

    it('should validate site input', async () => {
      const invalidSiteInput = {
        siteName: '', // Invalid: empty name
        location: 'Test Location',
        visitDuration: '2 hours',
        category: SiteCategory.CULTURAL,
        orderIndex: 1
      };

      await expect(tourTemplateService.addSiteToTemplate(
        'template123',
        invalidSiteInput,
        UserType.SYSTEM_ADMIN
      )).rejects.toThrow('Validation error');
    });
  });

  describe('updateSiteInTemplate', () => {
    it('should update site successfully (System Admin)', async () => {
      const updateInput = {
        siteName: 'Updated Site Name',
        description: 'Updated description'
      };

      const updatedSite = {
        ...mockSite,
        siteName: 'Updated Site Name',
        description: 'Updated description'
      };

      mockPrisma.tourTemplate.findUnique = vi.fn().mockResolvedValue(mockTemplate);
      mockPrisma.siteToVisit.findFirst = vi.fn().mockResolvedValue(mockSite);
      mockPrisma.siteToVisit.update = vi.fn().mockResolvedValue(updatedSite);

      const result = await tourTemplateService.updateSiteInTemplate(
        'template123',
        'site123',
        updateInput,
        UserType.SYSTEM_ADMIN
      );

      expect(result).toEqual(updatedSite);
      expect(mockPrisma.siteToVisit.update).toHaveBeenCalledWith({
        where: { siteId: 'site123' },
        data: {
          siteName: 'Updated Site Name',
          description: 'Updated description',
          location: mockSite.location,
          visitDuration: mockSite.visitDuration,
          estimatedCost: mockSite.estimatedCost,
          category: mockSite.category,
          isOptional: mockSite.isOptional,
          orderIndex: mockSite.orderIndex
        }
      });
    });

    it('should handle partial updates', async () => {
      const updateInput = { siteName: 'Updated Site Name' };
      const updatedSite = { ...mockSite, siteName: 'Updated Site Name' };

      mockPrisma.tourTemplate.findUnique = vi.fn().mockResolvedValue(mockTemplate);
      mockPrisma.siteToVisit.findFirst = vi.fn().mockResolvedValue(mockSite);
      mockPrisma.siteToVisit.update = vi.fn().mockResolvedValue(updatedSite);

      const result = await tourTemplateService.updateSiteInTemplate(
        'template123',
        'site123',
        updateInput,
        UserType.SYSTEM_ADMIN
      );

      expect(result).toEqual(updatedSite);
    });

    it('should deny non-system admin from updating sites', async () => {
      await expect(tourTemplateService.updateSiteInTemplate(
        'template123',
        'site123',
        { siteName: 'Updated' },
        UserType.PROVIDER_ADMIN
      )).rejects.toThrow('Insufficient permissions to modify tour templates');
    });

    it('should throw error for non-existent template', async () => {
      mockPrisma.tourTemplate.findUnique = vi.fn().mockResolvedValue(null);

      await expect(tourTemplateService.updateSiteInTemplate(
        'template123',
        'site123',
        { siteName: 'Updated' },
        UserType.SYSTEM_ADMIN
      )).rejects.toThrow('Tour template not found');
    });

    it('should throw error for non-existent site', async () => {
      mockPrisma.tourTemplate.findUnique = vi.fn().mockResolvedValue(mockTemplate);
      mockPrisma.siteToVisit.findFirst = vi.fn().mockResolvedValue(null);

      await expect(tourTemplateService.updateSiteInTemplate(
        'template123',
        'site123',
        { siteName: 'Updated' },
        UserType.SYSTEM_ADMIN
      )).rejects.toThrow('Site not found in this template');
    });

    it('should prevent duplicate order index when updating', async () => {
      const updateInput = { orderIndex: 2 };

      mockPrisma.tourTemplate.findUnique = vi.fn().mockResolvedValue(mockTemplate);
      mockPrisma.siteToVisit.findFirst = vi.fn()
        .mockResolvedValueOnce(mockSite) // First call for site existence
        .mockResolvedValueOnce({ siteId: 'other-site' }); // Second call for duplicate check

      await expect(tourTemplateService.updateSiteInTemplate(
        'template123',
        'site123',
        updateInput,
        UserType.SYSTEM_ADMIN
      )).rejects.toThrow('A site with this order index already exists in the template');
    });

    it('should allow updating to same order index', async () => {
      const updateInput = { orderIndex: 1 }; // Same as current
      const updatedSite = { ...mockSite };

      mockPrisma.tourTemplate.findUnique = vi.fn().mockResolvedValue(mockTemplate);
      mockPrisma.siteToVisit.findFirst = vi.fn().mockResolvedValue(mockSite);
      mockPrisma.siteToVisit.update = vi.fn().mockResolvedValue(updatedSite);

      const result = await tourTemplateService.updateSiteInTemplate(
        'template123',
        'site123',
        updateInput,
        UserType.SYSTEM_ADMIN
      );

      expect(result).toEqual(updatedSite);
    });

    it('should validate update input', async () => {
      const invalidUpdateInput = { siteName: '' }; // Invalid: empty name

      await expect(tourTemplateService.updateSiteInTemplate(
        'template123',
        'site123',
        invalidUpdateInput,
        UserType.SYSTEM_ADMIN
      )).rejects.toThrow('Validation error');
    });

    it('should validate site ID', async () => {
      await expect(tourTemplateService.updateSiteInTemplate(
        'template123',
        '', // Invalid: empty site ID
        { siteName: 'Updated' },
        UserType.SYSTEM_ADMIN
      )).rejects.toThrow('Invalid site ID');
    });
  });

  describe('removeSiteFromTemplate', () => {
    it('should remove site successfully (System Admin)', async () => {
      mockPrisma.tourTemplate.findUnique = vi.fn().mockResolvedValue(mockTemplate);
      mockPrisma.siteToVisit.findFirst = vi.fn().mockResolvedValue(mockSite);
      mockPrisma.siteToVisit.delete = vi.fn().mockResolvedValue(mockSite);

      await tourTemplateService.removeSiteFromTemplate('template123', 'site123', UserType.SYSTEM_ADMIN);

      expect(mockPrisma.siteToVisit.delete).toHaveBeenCalledWith({
        where: { siteId: 'site123' }
      });
    });

    it('should deny non-system admin from removing sites', async () => {
      await expect(tourTemplateService.removeSiteFromTemplate(
        'template123',
        'site123',
        UserType.PROVIDER_ADMIN
      )).rejects.toThrow('Insufficient permissions to modify tour templates');
    });

    it('should throw error for non-existent template', async () => {
      mockPrisma.tourTemplate.findUnique = vi.fn().mockResolvedValue(null);

      await expect(tourTemplateService.removeSiteFromTemplate(
        'template123',
        'site123',
        UserType.SYSTEM_ADMIN
      )).rejects.toThrow('Tour template not found');
    });

    it('should throw error for non-existent site', async () => {
      mockPrisma.tourTemplate.findUnique = vi.fn().mockResolvedValue(mockTemplate);
      mockPrisma.siteToVisit.findFirst = vi.fn().mockResolvedValue(null);

      await expect(tourTemplateService.removeSiteFromTemplate(
        'template123',
        'site123',
        UserType.SYSTEM_ADMIN
      )).rejects.toThrow('Site not found in this template');
    });

    it('should validate site ID', async () => {
      await expect(tourTemplateService.removeSiteFromTemplate(
        'template123',
        '', // Invalid: empty site ID
        UserType.SYSTEM_ADMIN
      )).rejects.toThrow('Invalid site ID');
    });
  });

  describe('getTemplateSites', () => {
    const mockSites = [
      {
        siteId: 'site1',
        templateId: 'template123',
        siteName: 'Site 1',
        orderIndex: 1
      },
      {
        siteId: 'site2',
        templateId: 'template123',
        siteName: 'Site 2',
        orderIndex: 2
      }
    ];

    it('should return sites for template', async () => {
      mockPrisma.tourTemplate.findUnique = vi.fn().mockResolvedValue(mockTemplate);
      mockPrisma.siteToVisit.findMany = vi.fn().mockResolvedValue(mockSites);

      const result = await tourTemplateService.getTemplateSites('template123');

      expect(result).toEqual(mockSites);
      expect(mockPrisma.siteToVisit.findMany).toHaveBeenCalledWith({
        where: { templateId: 'template123' },
        orderBy: { orderIndex: 'asc' }
      });
    });

    it('should throw error for non-existent template', async () => {
      mockPrisma.tourTemplate.findUnique = vi.fn().mockResolvedValue(null);

      await expect(tourTemplateService.getTemplateSites('template123'))
        .rejects.toThrow('Tour template not found');
    });

    it('should validate template ID', async () => {
      await expect(tourTemplateService.getTemplateSites(''))
        .rejects.toThrow('Invalid template ID');
    });
  });

  describe('reorderTemplateSites', () => {
    const mockSites = [
      { siteId: 'site1', templateId: 'template123', orderIndex: 1 },
      { siteId: 'site2', templateId: 'template123', orderIndex: 2 }
    ];

    const siteOrders = [
      { siteId: 'site1', orderIndex: 2 },
      { siteId: 'site2', orderIndex: 1 }
    ];

    const reorderedSites = [
      { siteId: 'site2', orderIndex: 1 },
      { siteId: 'site1', orderIndex: 2 }
    ];

    it('should reorder sites successfully (System Admin)', async () => {
      mockPrisma.tourTemplate.findUnique = vi.fn().mockResolvedValue(mockTemplate);
      mockPrisma.siteToVisit.findMany = vi.fn().mockResolvedValue(mockSites);
      mockPrisma.$transaction = vi.fn().mockResolvedValue(reorderedSites);

      const result = await tourTemplateService.reorderTemplateSites(
        'template123',
        siteOrders,
        UserType.SYSTEM_ADMIN
      );

      expect(result).toEqual(reorderedSites);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should deny non-system admin from reordering sites', async () => {
      await expect(tourTemplateService.reorderTemplateSites(
        'template123',
        siteOrders,
        UserType.PROVIDER_ADMIN
      )).rejects.toThrow('Insufficient permissions to modify tour templates');
    });

    it('should throw error for non-existent template', async () => {
      mockPrisma.tourTemplate.findUnique = vi.fn().mockResolvedValue(null);

      await expect(tourTemplateService.reorderTemplateSites(
        'template123',
        siteOrders,
        UserType.SYSTEM_ADMIN
      )).rejects.toThrow('Tour template not found');
    });

    it('should throw error when sites do not belong to template', async () => {
      mockPrisma.tourTemplate.findUnique = vi.fn().mockResolvedValue(mockTemplate);
      mockPrisma.siteToVisit.findMany = vi.fn().mockResolvedValue([mockSites[0]]); // Only one site found

      await expect(tourTemplateService.reorderTemplateSites(
        'template123',
        siteOrders,
        UserType.SYSTEM_ADMIN
      )).rejects.toThrow('One or more sites do not belong to this template');
    });

    it('should handle empty site orders', async () => {
      mockPrisma.tourTemplate.findUnique = vi.fn().mockResolvedValue(mockTemplate);
      mockPrisma.siteToVisit.findMany = vi.fn().mockResolvedValue([]);
      mockPrisma.$transaction = vi.fn().mockResolvedValue([]);

      const result = await tourTemplateService.reorderTemplateSites(
        'template123',
        [],
        UserType.SYSTEM_ADMIN
      );

      expect(result).toEqual([]);
    });
  });
});