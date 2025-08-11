import { PrismaClient } from '../generated/prisma';
import { TourTemplate, SiteToVisit, SiteCategory } from '../types/tour-template';
import { TourTemplateService } from './tour-template';

export interface SuggestedActivity {
  activityName: string;
  activityType: string;
  description: string;
  estimatedDuration: string;
  location: string;
  isOptional: boolean;
  orderIndex: number;
}

export interface TemplateCompatibilityResult {
  isCompatible: boolean;
  warnings: string[];
  recommendations: string[];
}

export interface TemplateForTourEventCreation {
  template: TourTemplate;
  suggestedActivities: SuggestedActivity[];
}

/**
 * Service for template-based tour event creation utilities
 */
export class TourTemplateUtilitiesService {
  private tourTemplateService: TourTemplateService;

  constructor(private prisma: PrismaClient) {
    this.tourTemplateService = new TourTemplateService(prisma);
  }

  /**
   * Get template with suggested activities for tour event creation
   */
  async getTemplateForTourEventCreation(templateId: string): Promise<TemplateForTourEventCreation> {
    // Get template with sites
    const template = await this.tourTemplateService.getTourTemplateById(templateId);
    if (!template) {
      throw new Error('Tour template not found');
    }

    // Convert sites to suggested activities for tour events
    const suggestedActivities = template.sitesToVisit?.map(site => ({
      activityName: `Visit ${site.siteName}`,
      activityType: this.mapSiteCategoryToActivityType(site.category),
      description: site.description || `Visit to ${site.siteName} at ${site.location}`,
      estimatedDuration: site.visitDuration,
      location: site.location,
      isOptional: site.isOptional,
      orderIndex: site.orderIndex
    })) || [];

    return {
      template,
      suggestedActivities
    };
  }

  /**
   * Validate template compatibility for tour event creation
   */
  async validateTemplateForTourEvent(
    templateId: string,
    tourEventStartDate: Date,
    tourEventEndDate: Date
  ): Promise<TemplateCompatibilityResult> {
    const template = await this.tourTemplateService.getTourTemplateById(templateId);
    if (!template) {
      throw new Error('Tour template not found');
    }

    const warnings: string[] = [];
    const recommendations: string[] = [];
    let isCompatible = true;

    // Check date compatibility (add 1 to include both start and end dates)
    const templateDuration = Math.ceil(
      (template.endDate.getTime() - template.startDate.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;
    const tourEventDuration = Math.ceil(
      (tourEventEndDate.getTime() - tourEventStartDate.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;

    if (tourEventDuration < templateDuration) {
      warnings.push(
        `Tour event duration (${tourEventDuration} days) is shorter than template duration (${templateDuration} days)`
      );
      recommendations.push('Consider extending tour event duration or marking some sites as optional');
    }

    if (tourEventDuration > templateDuration + 7) {
      recommendations.push('Consider adding additional activities to fill the extended duration');
    }

    // Check if template has sites
    if (!template.sitesToVisit || template.sitesToVisit.length === 0) {
      warnings.push('Template has no sites to visit defined');
      recommendations.push('Add sites to the template or create custom activities for the tour event');
    }

    // Check for required vs optional sites
    const requiredSites = template.sitesToVisit?.filter(site => !site.isOptional) || [];
    const optionalSites = template.sitesToVisit?.filter(site => site.isOptional) || [];

    if (requiredSites.length === 0 && optionalSites.length > 0) {
      recommendations.push('Consider marking some sites as required to ensure core experience');
    }

    // Check year compatibility
    const tourEventYear = tourEventStartDate.getFullYear();
    if (template.year !== tourEventYear) {
      warnings.push(
        `Template is designed for year ${template.year} but tour event is in ${tourEventYear}`
      );
      recommendations.push('Review template content for year-specific information');
    }

    return {
      isCompatible,
      warnings,
      recommendations
    };
  }

  /**
   * Generate activity schedule from template sites
   */
  async generateActivityScheduleFromTemplate(
    templateId: string,
    tourEventStartDate: Date,
    tourEventEndDate: Date
  ): Promise<Array<{
    activityDate: Date;
    activities: SuggestedActivity[];
  }>> {
    const template = await this.tourTemplateService.getTourTemplateById(templateId);
    if (!template) {
      throw new Error('Tour template not found');
    }

    const sites = template.sitesToVisit || [];
    if (sites.length === 0) {
      return [];
    }

    // Calculate available days (add 1 to include both start and end dates)
    const tourDays = Math.ceil(
      (tourEventEndDate.getTime() - tourEventStartDate.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;

    // Distribute sites across available days
    const schedule: Array<{ activityDate: Date; activities: SuggestedActivity[] }> = [];
    const sitesPerDay = Math.ceil(sites.length / tourDays);

    for (let day = 0; day < tourDays; day++) {
      const currentDate = new Date(tourEventStartDate);
      currentDate.setDate(currentDate.getDate() + day);

      const startIndex = day * sitesPerDay;
      const endIndex = Math.min(startIndex + sitesPerDay, sites.length);
      const daySites = sites.slice(startIndex, endIndex);

      const dayActivities = daySites.map(site => ({
        activityName: `Visit ${site.siteName}`,
        activityType: this.mapSiteCategoryToActivityType(site.category),
        description: site.description || `Visit to ${site.siteName} at ${site.location}`,
        estimatedDuration: site.visitDuration,
        location: site.location,
        isOptional: site.isOptional,
        orderIndex: site.orderIndex
      }));

      if (dayActivities.length > 0) {
        schedule.push({
          activityDate: currentDate,
          activities: dayActivities
        });
      }
    }

    return schedule;
  }

  /**
   * Calculate estimated costs from template sites
   */
  async calculateEstimatedCosts(templateId: string): Promise<{
    totalEstimatedCost: number;
    requiredSitesCost: number;
    optionalSitesCost: number;
    costBreakdown: Array<{
      siteName: string;
      cost: number;
      isOptional: boolean;
    }>;
  }> {
    const template = await this.tourTemplateService.getTourTemplateById(templateId);
    if (!template) {
      throw new Error('Tour template not found');
    }

    const sites = template.sitesToVisit || [];
    let totalEstimatedCost = 0;
    let requiredSitesCost = 0;
    let optionalSitesCost = 0;

    const costBreakdown = sites.map(site => {
      const cost = site.estimatedCost ? Number(site.estimatedCost) : 0;
      totalEstimatedCost += cost;

      if (site.isOptional) {
        optionalSitesCost += cost;
      } else {
        requiredSitesCost += cost;
      }

      return {
        siteName: site.siteName,
        cost,
        isOptional: site.isOptional
      };
    });

    return {
      totalEstimatedCost,
      requiredSitesCost,
      optionalSitesCost,
      costBreakdown
    };
  }

  /**
   * Get template statistics for analysis
   */
  async getTemplateStatistics(templateId: string): Promise<{
    totalSites: number;
    requiredSites: number;
    optionalSites: number;
    sitesByCategory: Record<SiteCategory, number>;
    averageVisitDuration: string;
    templateDurationDays: number;
  }> {
    const template = await this.tourTemplateService.getTourTemplateById(templateId);
    if (!template) {
      throw new Error('Tour template not found');
    }

    const sites = template.sitesToVisit || [];
    const totalSites = sites.length;
    const requiredSites = sites.filter(site => !site.isOptional).length;
    const optionalSites = sites.filter(site => site.isOptional).length;

    // Count sites by category
    const sitesByCategory = Object.values(SiteCategory).reduce((acc, category) => {
      acc[category] = sites.filter(site => site.category === category).length;
      return acc;
    }, {} as Record<SiteCategory, number>);

    // Calculate template duration (add 1 to include both start and end dates)
    const templateDurationDays = Math.ceil(
      (template.endDate.getTime() - template.startDate.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;

    // Calculate average visit duration (simplified - just return most common duration)
    const durations = sites.map(site => site.visitDuration);
    const durationCounts = durations.reduce((acc, duration) => {
      acc[duration] = (acc[duration] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const durationKeys = Object.keys(durationCounts);
    const averageVisitDuration = durationKeys.length > 0 
      ? durationKeys.reduce((a, b) => durationCounts[a] > durationCounts[b] ? a : b)
      : 'N/A';

    return {
      totalSites,
      requiredSites,
      optionalSites,
      sitesByCategory,
      averageVisitDuration,
      templateDurationDays
    };
  }

  /**
   * Helper method to map site categories to activity types
   */
  private mapSiteCategoryToActivityType(category: SiteCategory): string {
    const categoryMap: Record<SiteCategory, string> = {
      [SiteCategory.HISTORICAL]: 'Sightseeing',
      [SiteCategory.RELIGIOUS]: 'Cultural Visit',
      [SiteCategory.CULTURAL]: 'Cultural Activity',
      [SiteCategory.NATURAL]: 'Nature Activity',
      [SiteCategory.ENTERTAINMENT]: 'Entertainment',
      [SiteCategory.SHOPPING]: 'Shopping',
      [SiteCategory.RESTAURANT]: 'Dining',
      [SiteCategory.ACCOMMODATION]: 'Check-in/Check-out',
      [SiteCategory.TRANSPORTATION]: 'Transportation',
      [SiteCategory.OTHER]: 'Other Activity'
    };

    return categoryMap[category] || 'Other Activity';
  }
}