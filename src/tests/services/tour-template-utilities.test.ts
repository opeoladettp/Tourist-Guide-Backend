import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '../../generated/prisma';
import { TourTemplateUtilitiesService } from '../../services/tour-template-utilities';
import { TourTemplateService } from '../../services/tour-template';
import { SiteCategory } from '../../types/tour-template';

// Mock Prisma Client
const mockPrisma = {
  tourTemplate: {
    findUnique: vi.fn(),
  },
} as unknown as PrismaClient;

// Mock TourTemplateService
vi.mock('../../services/tour-template');

describe('TourTemplateUtilitiesService', () => {
  let tourTemplateUtilitiesService: TourTemplateUtilitiesService;
  let mockTourTemplateService: vi.Mocked<TourTemplateService>;

  beforeEach(() => {
    // Create a new instance for each test
    tourTemplateUtilitiesService = new TourTemplateUtilitiesService(mockPrisma);
    // Get the mocked service instance
    mockTourTemplateService = vi.mocked(new TourTemplateService(mockPrisma));
    // Replace the service instance in the utilities service
    (tourTemplateUtilitiesService as any).tourTemplateService = mockTourTemplateService;
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
    createdAt: new Date(),
    updatedAt: new Date(),
    sitesToVisit: [
      {
        siteId: 'site1',
        templateId: 'template123',
        siteName: 'Historical Site',
        description: 'A historical landmark',
        location: 'City Center',
        visitDuration: '2 hours',
        estimatedCost: 25.50,
        category: SiteCategory.HISTORICAL,
        isOptional: false,
        orderIndex: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        siteId: 'site2',
        templateId: 'template123',
        siteName: 'Cultural Museum',
        description: 'Local cultural museum',
        location: 'Museum District',
        visitDuration: '3 hours',
        estimatedCost: 15.00,
        category: SiteCategory.CULTURAL,
        isOptional: true,
        orderIndex: 2,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]
  };

  describe('getTemplateForTourEventCreation', () => {
    it('should return template with suggested activities', async () => {
      mockTourTemplateService.getTourTemplateById.mockResolvedValue(mockTemplate);

      const result = await tourTemplateUtilitiesService.getTemplateForTourEventCreation('template123');

      expect(result.template).toEqual(mockTemplate);
      expect(result.suggestedActivities).toHaveLength(2);
      expect(result.suggestedActivities[0]).toEqual({
        activityName: 'Visit Historical Site',
        activityType: 'Sightseeing',
        description: 'A historical landmark',
        estimatedDuration: '2 hours',
        location: 'City Center',
        isOptional: false,
        orderIndex: 1
      });
      expect(result.suggestedActivities[1]).toEqual({
        activityName: 'Visit Cultural Museum',
        activityType: 'Cultural Activity',
        description: 'Local cultural museum',
        estimatedDuration: '3 hours',
        location: 'Museum District',
        isOptional: true,
        orderIndex: 2
      });
    });

    it('should handle template with no sites', async () => {
      const templateWithoutSites = { ...mockTemplate, sitesToVisit: [] };
      mockTourTemplateService.getTourTemplateById.mockResolvedValue(templateWithoutSites);

      const result = await tourTemplateUtilitiesService.getTemplateForTourEventCreation('template123');

      expect(result.template).toEqual(templateWithoutSites);
      expect(result.suggestedActivities).toHaveLength(0);
    });

    it('should generate default description when site has no description', async () => {
      const templateWithoutDescription = {
        ...mockTemplate,
        sitesToVisit: [{
          ...mockTemplate.sitesToVisit![0],
          description: null
        }]
      };
      mockTourTemplateService.getTourTemplateById.mockResolvedValue(templateWithoutDescription);

      const result = await tourTemplateUtilitiesService.getTemplateForTourEventCreation('template123');

      expect(result.suggestedActivities[0].description).toBe('Visit to Historical Site at City Center');
    });

    it('should throw error for non-existent template', async () => {
      mockTourTemplateService.getTourTemplateById.mockResolvedValue(null);

      await expect(tourTemplateUtilitiesService.getTemplateForTourEventCreation('nonexistent'))
        .rejects.toThrow('Tour template not found');
    });
  });

  describe('validateTemplateForTourEvent', () => {
    it('should validate compatible template and tour event dates', async () => {
      mockTourTemplateService.getTourTemplateById.mockResolvedValue(mockTemplate);

      const result = await tourTemplateUtilitiesService.validateTemplateForTourEvent(
        'template123',
        new Date('2024-06-01'),
        new Date('2024-06-15')
      );

      expect(result.isCompatible).toBe(true);
      expect(result.warnings).toHaveLength(0);
      expect(result.recommendations).toHaveLength(0);
    });

    it('should warn when tour event is shorter than template', async () => {
      mockTourTemplateService.getTourTemplateById.mockResolvedValue(mockTemplate);

      const result = await tourTemplateUtilitiesService.validateTemplateForTourEvent(
        'template123',
        new Date('2024-06-01'),
        new Date('2024-06-10') // 5 days shorter
      );

      expect(result.warnings).toContain(
        'Tour event duration (10 days) is shorter than template duration (15 days)'
      );
      expect(result.recommendations).toContain(
        'Consider extending tour event duration or marking some sites as optional'
      );
    });

    it('should recommend additional activities for extended tour events', async () => {
      mockTourTemplateService.getTourTemplateById.mockResolvedValue(mockTemplate);

      const result = await tourTemplateUtilitiesService.validateTemplateForTourEvent(
        'template123',
        new Date('2024-06-01'),
        new Date('2024-06-25') // 10 days longer
      );

      expect(result.recommendations).toContain(
        'Consider adding additional activities to fill the extended duration'
      );
    });

    it('should warn when template has no sites', async () => {
      const templateWithoutSites = { ...mockTemplate, sitesToVisit: [] };
      mockTourTemplateService.getTourTemplateById.mockResolvedValue(templateWithoutSites);

      const result = await tourTemplateUtilitiesService.validateTemplateForTourEvent(
        'template123',
        new Date('2024-06-01'),
        new Date('2024-06-15')
      );

      expect(result.warnings).toContain('Template has no sites to visit defined');
      expect(result.recommendations).toContain(
        'Add sites to the template or create custom activities for the tour event'
      );
    });

    it('should recommend required sites when all sites are optional', async () => {
      const templateWithOptionalSites = {
        ...mockTemplate,
        sitesToVisit: mockTemplate.sitesToVisit!.map(site => ({ ...site, isOptional: true }))
      };
      mockTourTemplateService.getTourTemplateById.mockResolvedValue(templateWithOptionalSites);

      const result = await tourTemplateUtilitiesService.validateTemplateForTourEvent(
        'template123',
        new Date('2024-06-01'),
        new Date('2024-06-15')
      );

      expect(result.recommendations).toContain(
        'Consider marking some sites as required to ensure core experience'
      );
    });

    it('should warn about year mismatch', async () => {
      mockTourTemplateService.getTourTemplateById.mockResolvedValue(mockTemplate);

      const result = await tourTemplateUtilitiesService.validateTemplateForTourEvent(
        'template123',
        new Date('2025-06-01'), // Different year
        new Date('2025-06-15')
      );

      expect(result.warnings).toContain(
        'Template is designed for year 2024 but tour event is in 2025'
      );
      expect(result.recommendations).toContain(
        'Review template content for year-specific information'
      );
    });

    it('should throw error for non-existent template', async () => {
      mockTourTemplateService.getTourTemplateById.mockResolvedValue(null);

      await expect(tourTemplateUtilitiesService.validateTemplateForTourEvent(
        'nonexistent',
        new Date('2024-06-01'),
        new Date('2024-06-15')
      )).rejects.toThrow('Tour template not found');
    });
  });

  describe('generateActivityScheduleFromTemplate', () => {
    it('should generate activity schedule from template sites', async () => {
      mockTourTemplateService.getTourTemplateById.mockResolvedValue(mockTemplate);

      const result = await tourTemplateUtilitiesService.generateActivityScheduleFromTemplate(
        'template123',
        new Date('2024-06-01'),
        new Date('2024-06-03') // 3 days
      );

      expect(result).toHaveLength(2); // 2 sites distributed across days
      expect(result[0].activityDate).toEqual(new Date('2024-06-01'));
      expect(result[0].activities).toHaveLength(1);
      expect(result[1].activityDate).toEqual(new Date('2024-06-02'));
      expect(result[1].activities).toHaveLength(1);
    });

    it('should return empty schedule for template with no sites', async () => {
      const templateWithoutSites = { ...mockTemplate, sitesToVisit: [] };
      mockTourTemplateService.getTourTemplateById.mockResolvedValue(templateWithoutSites);

      const result = await tourTemplateUtilitiesService.generateActivityScheduleFromTemplate(
        'template123',
        new Date('2024-06-01'),
        new Date('2024-06-03')
      );

      expect(result).toHaveLength(0);
    });

    it('should distribute multiple sites across single day when tour is short', async () => {
      mockTourTemplateService.getTourTemplateById.mockResolvedValue(mockTemplate);

      const result = await tourTemplateUtilitiesService.generateActivityScheduleFromTemplate(
        'template123',
        new Date('2024-06-01'),
        new Date('2024-06-01') // Same day
      );

      expect(result).toHaveLength(1);
      expect(result[0].activities).toHaveLength(2); // Both sites on same day
    });

    it('should throw error for non-existent template', async () => {
      mockTourTemplateService.getTourTemplateById.mockResolvedValue(null);

      await expect(tourTemplateUtilitiesService.generateActivityScheduleFromTemplate(
        'nonexistent',
        new Date('2024-06-01'),
        new Date('2024-06-03')
      )).rejects.toThrow('Tour template not found');
    });
  });

  describe('calculateEstimatedCosts', () => {
    it('should calculate estimated costs from template sites', async () => {
      mockTourTemplateService.getTourTemplateById.mockResolvedValue(mockTemplate);

      const result = await tourTemplateUtilitiesService.calculateEstimatedCosts('template123');

      expect(result.totalEstimatedCost).toBe(40.50); // 25.50 + 15.00
      expect(result.requiredSitesCost).toBe(25.50); // Only first site is required
      expect(result.optionalSitesCost).toBe(15.00); // Second site is optional
      expect(result.costBreakdown).toHaveLength(2);
      expect(result.costBreakdown[0]).toEqual({
        siteName: 'Historical Site',
        cost: 25.50,
        isOptional: false
      });
      expect(result.costBreakdown[1]).toEqual({
        siteName: 'Cultural Museum',
        cost: 15.00,
        isOptional: true
      });
    });

    it('should handle sites with no estimated cost', async () => {
      const templateWithNoCosts = {
        ...mockTemplate,
        sitesToVisit: mockTemplate.sitesToVisit!.map(site => ({ ...site, estimatedCost: null }))
      };
      mockTourTemplateService.getTourTemplateById.mockResolvedValue(templateWithNoCosts);

      const result = await tourTemplateUtilitiesService.calculateEstimatedCosts('template123');

      expect(result.totalEstimatedCost).toBe(0);
      expect(result.requiredSitesCost).toBe(0);
      expect(result.optionalSitesCost).toBe(0);
      expect(result.costBreakdown[0].cost).toBe(0);
      expect(result.costBreakdown[1].cost).toBe(0);
    });

    it('should handle template with no sites', async () => {
      const templateWithoutSites = { ...mockTemplate, sitesToVisit: [] };
      mockTourTemplateService.getTourTemplateById.mockResolvedValue(templateWithoutSites);

      const result = await tourTemplateUtilitiesService.calculateEstimatedCosts('template123');

      expect(result.totalEstimatedCost).toBe(0);
      expect(result.requiredSitesCost).toBe(0);
      expect(result.optionalSitesCost).toBe(0);
      expect(result.costBreakdown).toHaveLength(0);
    });

    it('should throw error for non-existent template', async () => {
      mockTourTemplateService.getTourTemplateById.mockResolvedValue(null);

      await expect(tourTemplateUtilitiesService.calculateEstimatedCosts('nonexistent'))
        .rejects.toThrow('Tour template not found');
    });
  });

  describe('getTemplateStatistics', () => {
    it('should return template statistics', async () => {
      mockTourTemplateService.getTourTemplateById.mockResolvedValue(mockTemplate);

      const result = await tourTemplateUtilitiesService.getTemplateStatistics('template123');

      expect(result.totalSites).toBe(2);
      expect(result.requiredSites).toBe(1);
      expect(result.optionalSites).toBe(1);
      expect(result.sitesByCategory[SiteCategory.HISTORICAL]).toBe(1);
      expect(result.sitesByCategory[SiteCategory.CULTURAL]).toBe(1);
      expect(result.sitesByCategory[SiteCategory.RELIGIOUS]).toBe(0);
      expect(result.templateDurationDays).toBe(15); // June 1-15
      expect(['2 hours', '3 hours']).toContain(result.averageVisitDuration);
    });

    it('should handle template with no sites', async () => {
      const templateWithoutSites = { ...mockTemplate, sitesToVisit: [] };
      mockTourTemplateService.getTourTemplateById.mockResolvedValue(templateWithoutSites);

      const result = await tourTemplateUtilitiesService.getTemplateStatistics('template123');

      expect(result.totalSites).toBe(0);
      expect(result.requiredSites).toBe(0);
      expect(result.optionalSites).toBe(0);
      expect(result.averageVisitDuration).toBe('N/A');
      Object.values(SiteCategory).forEach(category => {
        expect(result.sitesByCategory[category]).toBe(0);
      });
    });

    it('should calculate template duration correctly', async () => {
      const templateWithDifferentDates = {
        ...mockTemplate,
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-06-08') // 8 days
      };
      mockTourTemplateService.getTourTemplateById.mockResolvedValue(templateWithDifferentDates);

      const result = await tourTemplateUtilitiesService.getTemplateStatistics('template123');

      expect(result.templateDurationDays).toBe(8);
    });

    it('should throw error for non-existent template', async () => {
      mockTourTemplateService.getTourTemplateById.mockResolvedValue(null);

      await expect(tourTemplateUtilitiesService.getTemplateStatistics('nonexistent'))
        .rejects.toThrow('Tour template not found');
    });
  });

  describe('mapSiteCategoryToActivityType', () => {
    it('should map site categories to appropriate activity types', async () => {
      mockTourTemplateService.getTourTemplateById.mockResolvedValue({
        ...mockTemplate,
        sitesToVisit: [
          { ...mockTemplate.sitesToVisit![0], category: SiteCategory.HISTORICAL },
          { ...mockTemplate.sitesToVisit![0], category: SiteCategory.RELIGIOUS },
          { ...mockTemplate.sitesToVisit![0], category: SiteCategory.CULTURAL },
          { ...mockTemplate.sitesToVisit![0], category: SiteCategory.NATURAL },
          { ...mockTemplate.sitesToVisit![0], category: SiteCategory.ENTERTAINMENT },
          { ...mockTemplate.sitesToVisit![0], category: SiteCategory.SHOPPING },
          { ...mockTemplate.sitesToVisit![0], category: SiteCategory.RESTAURANT },
          { ...mockTemplate.sitesToVisit![0], category: SiteCategory.ACCOMMODATION },
          { ...mockTemplate.sitesToVisit![0], category: SiteCategory.TRANSPORTATION },
          { ...mockTemplate.sitesToVisit![0], category: SiteCategory.OTHER }
        ]
      });

      const result = await tourTemplateUtilitiesService.getTemplateForTourEventCreation('template123');

      expect(result.suggestedActivities[0].activityType).toBe('Sightseeing');
      expect(result.suggestedActivities[1].activityType).toBe('Cultural Visit');
      expect(result.suggestedActivities[2].activityType).toBe('Cultural Activity');
      expect(result.suggestedActivities[3].activityType).toBe('Nature Activity');
      expect(result.suggestedActivities[4].activityType).toBe('Entertainment');
      expect(result.suggestedActivities[5].activityType).toBe('Shopping');
      expect(result.suggestedActivities[6].activityType).toBe('Dining');
      expect(result.suggestedActivities[7].activityType).toBe('Check-in/Check-out');
      expect(result.suggestedActivities[8].activityType).toBe('Transportation');
      expect(result.suggestedActivities[9].activityType).toBe('Other Activity');
    });
  });
});