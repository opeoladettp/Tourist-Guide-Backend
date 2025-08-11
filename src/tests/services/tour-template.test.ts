import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '../../generated/prisma';
import { TourTemplateService } from '../../services/tour-template';
import { UserType } from '../../types/user';
import { SiteCategory } from '../../types/tour-template';

// Mock Prisma Client
const mockPrisma = {
  tourTemplate: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  siteToVisit: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  customTourEvent: {
    count: vi.fn(),
  },
  $transaction: vi.fn(),
} as unknown as PrismaClient;

describe('TourTemplateService', () => {
  let tourTemplateService: TourTemplateService;

  beforeEach(() => {
    tourTemplateService = new TourTemplateService(mockPrisma);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('createTourTemplate', () => {
    const validCreateInput = {
      templateName: 'Hajj 2024 Package',
      type: 'Religious',
      year: 2024,
      startDate: new Date('2024-06-01'),
      endDate: new Date('2024-06-15'),
      detailedDescription: 'A comprehensive Hajj package including all necessary arrangements.',
      sitesToVisit: [
        {
          siteName: 'Masjid al-Haram',
          description: 'The holiest mosque in Islam',
          location: 'Mecca, Saudi Arabia',
          visitDuration: '5 days',
          estimatedCost: 500.00,
          category: SiteCategory.RELIGIOUS,
          isOptional: false,
          orderIndex: 1
        }
      ]
    };

    it('should create tour template with valid input (System Admin)', async () => {
      const mockTemplate = {
        templateId: 'template123',
        ...validCreateInput,
        createdAt: new Date(),
        updatedAt: new Date(),
        sitesToVisit: [
          {
            siteId: 'site123',
            templateId: 'template123',
            ...validCreateInput.sitesToVisit[0],
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ]
      };

      mockPrisma.tourTemplate.findFirst = vi.fn().mockResolvedValue(null); // No existing template
      mockPrisma.tourTemplate.create = vi.fn().mockResolvedValue(mockTemplate);

      const result = await tourTemplateService.createTourTemplate(validCreateInput, UserType.SYSTEM_ADMIN);

      expect(result).toEqual(mockTemplate);
      expect(mockPrisma.tourTemplate.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          templateName: validCreateInput.templateName,
          sitesToVisit: {
            create: expect.arrayContaining([
              expect.objectContaining({
                siteName: validCreateInput.sitesToVisit[0].siteName
              })
            ])
          }
        }),
        include: {
          sitesToVisit: {
            orderBy: { orderIndex: 'asc' }
          }
        }
      });
    });

    it('should deny non-system admin from creating templates', async () => {
      await expect(tourTemplateService.createTourTemplate(validCreateInput, UserType.PROVIDER_ADMIN))
        .rejects.toThrow('Insufficient permissions to create tour templates');
    });

    it('should throw error for duplicate template name in same year', async () => {
      mockPrisma.tourTemplate.findFirst = vi.fn().mockResolvedValue({ templateId: 'existing' });

      await expect(tourTemplateService.createTourTemplate(validCreateInput, UserType.SYSTEM_ADMIN))
        .rejects.toThrow('Tour template with this name already exists for the specified year');
    });

    it('should throw error for invalid input', async () => {
      const invalidInput = { ...validCreateInput, year: 2019 };

      await expect(tourTemplateService.createTourTemplate(invalidInput, UserType.SYSTEM_ADMIN))
        .rejects.toThrow('Validation error');
    });
  });

  describe('getTourTemplateById', () => {
    const mockTemplate = {
      templateId: 'template123',
      templateName: 'Test Template',
      type: 'Religious',
      year: 2024,
      startDate: new Date('2024-06-01'),
      endDate: new Date('2024-06-15'),
      detailedDescription: 'Test description',
      createdAt: new Date(),
      updatedAt: new Date(),
      sitesToVisit: []
    };

    it('should return template by ID', async () => {
      mockPrisma.tourTemplate.findUnique = vi.fn().mockResolvedValue(mockTemplate);

      const result = await tourTemplateService.getTourTemplateById('template123');

      expect(result).toEqual(mockTemplate);
      expect(mockPrisma.tourTemplate.findUnique).toHaveBeenCalledWith({
        where: { templateId: 'template123' },
        include: {
          sitesToVisit: {
            orderBy: { orderIndex: 'asc' }
          }
        }
      });
    });

    it('should return null for non-existent template', async () => {
      mockPrisma.tourTemplate.findUnique = vi.fn().mockResolvedValue(null);

      const result = await tourTemplateService.getTourTemplateById('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw error for invalid template ID', async () => {
      await expect(tourTemplateService.getTourTemplateById(''))
        .rejects.toThrow('Invalid template ID');
    });
  });

  describe('getTourTemplates', () => {
    const mockTemplates = [
      {
        templateId: 'template1',
        templateName: 'Template 1',
        type: 'Religious',
        year: 2024,
        sitesToVisit: []
      },
      {
        templateId: 'template2',
        templateName: 'Template 2',
        type: 'Cultural',
        year: 2024,
        sitesToVisit: []
      }
    ];

    it('should return all templates without filters', async () => {
      mockPrisma.tourTemplate.findMany = vi.fn().mockResolvedValue(mockTemplates);

      const result = await tourTemplateService.getTourTemplates();

      expect(result).toEqual(mockTemplates);
      expect(mockPrisma.tourTemplate.findMany).toHaveBeenCalledWith({
        where: {},
        include: {
          sitesToVisit: {
            orderBy: { orderIndex: 'asc' }
          }
        },
        take: 50,
        skip: 0,
        orderBy: { createdAt: 'desc' }
      });
    });

    it('should filter templates by year', async () => {
      mockPrisma.tourTemplate.findMany = vi.fn().mockResolvedValue(mockTemplates);

      await tourTemplateService.getTourTemplates(2024);

      expect(mockPrisma.tourTemplate.findMany).toHaveBeenCalledWith({
        where: { year: 2024 },
        include: expect.any(Object),
        take: 50,
        skip: 0,
        orderBy: { createdAt: 'desc' }
      });
    });

    it('should filter templates by type', async () => {
      mockPrisma.tourTemplate.findMany = vi.fn().mockResolvedValue(mockTemplates);

      await tourTemplateService.getTourTemplates(undefined, 'Religious');

      expect(mockPrisma.tourTemplate.findMany).toHaveBeenCalledWith({
        where: {
          type: {
            contains: 'Religious',
            mode: 'insensitive'
          }
        },
        include: expect.any(Object),
        take: 50,
        skip: 0,
        orderBy: { createdAt: 'desc' }
      });
    });
  });

  describe('updateTourTemplate', () => {
    const mockTemplate = {
      templateId: 'template123',
      templateName: 'Original Template',
      type: 'Religious',
      year: 2024,
      startDate: new Date('2024-06-01'),
      endDate: new Date('2024-06-15'),
      detailedDescription: 'Original description',
      sitesToVisit: []
    };

    it('should update template with valid input (System Admin)', async () => {
      const updateInput = { templateName: 'Updated Template' };
      const updatedTemplate = { ...mockTemplate, templateName: 'Updated Template' };

      mockPrisma.tourTemplate.findUnique = vi.fn().mockResolvedValue(mockTemplate);
      mockPrisma.tourTemplate.update = vi.fn().mockResolvedValue(updatedTemplate);

      const result = await tourTemplateService.updateTourTemplate(
        'template123',
        updateInput,
        UserType.SYSTEM_ADMIN
      );

      expect(result).toEqual(updatedTemplate);
      expect(mockPrisma.tourTemplate.update).toHaveBeenCalledWith({
        where: { templateId: 'template123' },
        data: expect.objectContaining({ templateName: 'Updated Template' }),
        include: {
          sitesToVisit: {
            orderBy: { orderIndex: 'asc' }
          }
        }
      });
    });

    it('should deny non-system admin from updating templates', async () => {
      await expect(tourTemplateService.updateTourTemplate(
        'template123',
        { templateName: 'Updated' },
        UserType.PROVIDER_ADMIN
      )).rejects.toThrow('Insufficient permissions to update tour templates');
    });

    it('should check for duplicate name when updating', async () => {
      const updateInput = { templateName: 'Duplicate Name' };

      mockPrisma.tourTemplate.findUnique = vi.fn().mockResolvedValue(mockTemplate);
      mockPrisma.tourTemplate.findFirst = vi.fn().mockResolvedValue({ templateId: 'other' });

      await expect(tourTemplateService.updateTourTemplate(
        'template123',
        updateInput,
        UserType.SYSTEM_ADMIN
      )).rejects.toThrow('Tour template with this name already exists for the specified year');
    });
  });

  describe('deleteTourTemplate', () => {
    const mockTemplate = {
      templateId: 'template123',
      templateName: 'Test Template',
      sitesToVisit: []
    };

    it('should delete template (System Admin)', async () => {
      mockPrisma.tourTemplate.findUnique = vi.fn().mockResolvedValue(mockTemplate);
      mockPrisma.customTourEvent.count = vi.fn().mockResolvedValue(0);
      mockPrisma.tourTemplate.delete = vi.fn().mockResolvedValue(mockTemplate);

      await tourTemplateService.deleteTourTemplate('template123', UserType.SYSTEM_ADMIN);

      expect(mockPrisma.tourTemplate.delete).toHaveBeenCalledWith({
        where: { templateId: 'template123' }
      });
    });

    it('should deny non-system admin from deleting templates', async () => {
      await expect(tourTemplateService.deleteTourTemplate('template123', UserType.PROVIDER_ADMIN))
        .rejects.toThrow('Insufficient permissions to delete tour templates');
    });

    it('should prevent deletion if template is used by tour events', async () => {
      mockPrisma.tourTemplate.findUnique = vi.fn().mockResolvedValue(mockTemplate);
      mockPrisma.customTourEvent.count = vi.fn().mockResolvedValue(2); // Template is used

      await expect(tourTemplateService.deleteTourTemplate('template123', UserType.SYSTEM_ADMIN))
        .rejects.toThrow('Cannot delete tour template that is being used by tour events');
    });
  });

  describe('addSiteToTemplate', () => {
    const mockTemplate = {
      templateId: 'template123',
      templateName: 'Test Template',
      sitesToVisit: []
    };

    const validSiteInput = {
      siteName: 'New Site',
      location: 'Test Location',
      visitDuration: '2 hours',
      category: SiteCategory.CULTURAL,
      orderIndex: 1
    };

    it('should add site to template (System Admin)', async () => {
      const mockSite = {
        siteId: 'site123',
        templateId: 'template123',
        ...validSiteInput,
        createdAt: new Date(),
        updatedAt: new Date()
      };

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
        data: expect.objectContaining({
          templateId: 'template123',
          siteName: validSiteInput.siteName
        })
      });
    });

    it('should deny non-system admin from adding sites', async () => {
      await expect(tourTemplateService.addSiteToTemplate(
        'template123',
        validSiteInput,
        UserType.PROVIDER_ADMIN
      )).rejects.toThrow('Insufficient permissions to modify tour templates');
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
  });

  describe('updateSiteInTemplate', () => {
    const mockTemplate = {
      templateId: 'template123',
      templateName: 'Test Template',
      sitesToVisit: []
    };

    const mockSite = {
      siteId: 'site123',
      templateId: 'template123',
      siteName: 'Original Site',
      location: 'Original Location',
      visitDuration: '1 hour',
      category: SiteCategory.CULTURAL,
      orderIndex: 1
    };

    it('should update site in template (System Admin)', async () => {
      const updateInput = { siteName: 'Updated Site' };
      const updatedSite = { ...mockSite, siteName: 'Updated Site' };

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
        data: expect.objectContaining({ siteName: 'Updated Site' })
      });
    });

    it('should deny non-system admin from updating sites', async () => {
      await expect(tourTemplateService.updateSiteInTemplate(
        'template123',
        'site123',
        { siteName: 'Updated' },
        UserType.PROVIDER_ADMIN
      )).rejects.toThrow('Insufficient permissions to modify tour templates');
    });
  });

  describe('removeSiteFromTemplate', () => {
    const mockTemplate = {
      templateId: 'template123',
      templateName: 'Test Template',
      sitesToVisit: []
    };

    const mockSite = {
      siteId: 'site123',
      templateId: 'template123',
      siteName: 'Test Site'
    };

    it('should remove site from template (System Admin)', async () => {
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
  });

  describe('reorderTemplateSites', () => {
    const mockTemplate = {
      templateId: 'template123',
      templateName: 'Test Template',
      sitesToVisit: []
    };

    const mockSites = [
      { siteId: 'site1', templateId: 'template123', orderIndex: 1 },
      { siteId: 'site2', templateId: 'template123', orderIndex: 2 }
    ];

    it('should reorder sites in template (System Admin)', async () => {
      const siteOrders = [
        { siteId: 'site1', orderIndex: 2 },
        { siteId: 'site2', orderIndex: 1 }
      ];

      const reorderedSites = [
        { siteId: 'site2', orderIndex: 1 },
        { siteId: 'site1', orderIndex: 2 }
      ];

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
        [],
        UserType.PROVIDER_ADMIN
      )).rejects.toThrow('Insufficient permissions to modify tour templates');
    });
  });
});