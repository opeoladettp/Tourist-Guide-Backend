import { PrismaClient } from '../generated/prisma';
import { 
  CreateTourTemplateInput, 
  UpdateTourTemplateInput, 
  TourTemplate, 
  CreateSiteToVisitInput,
  UpdateSiteToVisitInput,
  SiteToVisit,
  SiteCategory
} from '../types/tour-template';
import { UserType } from '../types/user';
import { 
  createTourTemplateSchema, 
  updateTourTemplateSchema, 
  templateIdSchema,
  createSiteToVisitSchema,
  updateSiteToVisitSchema,
  siteIdSchema
} from '../validation/tour-template';

export class TourTemplateService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new tour template (System Admin only)
   */
  async createTourTemplate(input: CreateTourTemplateInput, requestingUserType: UserType): Promise<TourTemplate> {
    // Only system admin can create tour templates
    if (requestingUserType !== UserType.SYSTEM_ADMIN) {
      throw new Error('Insufficient permissions to create tour templates');
    }

    // Validate input
    const { error, value } = createTourTemplateSchema.validate(input);
    if (error) {
      throw new Error(`Validation error: ${error.details.map(d => d.message).join(', ')}`);
    }

    // Check if template name already exists for the same year
    const existingTemplate = await this.prisma.tourTemplate.findFirst({
      where: {
        templateName: value.templateName,
        year: value.year
      }
    });
    
    if (existingTemplate) {
      throw new Error('Tour template with this name already exists for the specified year');
    }

    // Create tour template with sites
    const tourTemplate = await this.prisma.tourTemplate.create({
      data: {
        templateName: value.templateName,
        type: value.type,
        year: value.year,
        startDate: value.startDate,
        endDate: value.endDate,
        detailedDescription: value.detailedDescription,
        sitesToVisit: value.sitesToVisit ? {
          create: value.sitesToVisit.map(site => ({
            siteName: site.siteName,
            description: site.description || null,
            location: site.location,
            visitDuration: site.visitDuration,
            estimatedCost: site.estimatedCost || null,
            category: site.category,
            isOptional: site.isOptional ?? false,
            orderIndex: site.orderIndex
          }))
        } : undefined
      },
      include: {
        sitesToVisit: {
          orderBy: { orderIndex: 'asc' }
        }
      }
    });

    return tourTemplate;
  }

  /**
   * Get tour template by ID (All authenticated users)
   */
  async getTourTemplateById(templateId: string): Promise<TourTemplate | null> {
    // Validate template ID
    const { error } = templateIdSchema.validate(templateId);
    if (error) {
      throw new Error(`Invalid template ID: ${error.details[0].message}`);
    }

    const tourTemplate = await this.prisma.tourTemplate.findUnique({
      where: { templateId },
      include: {
        sitesToVisit: {
          orderBy: { orderIndex: 'asc' }
        }
      }
    });

    return tourTemplate;
  }

  /**
   * Get all tour templates (All authenticated users)
   */
  async getTourTemplates(
    year?: number,
    type?: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<TourTemplate[]> {
    const whereClause: any = {};
    
    if (year) {
      whereClause.year = year;
    }
    
    if (type) {
      whereClause.type = {
        contains: type,
        mode: 'insensitive'
      };
    }

    const tourTemplates = await this.prisma.tourTemplate.findMany({
      where: whereClause,
      include: {
        sitesToVisit: {
          orderBy: { orderIndex: 'asc' }
        }
      },
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' }
    });

    return tourTemplates;
  }

  /**
   * Update tour template (System Admin only)
   */
  async updateTourTemplate(
    templateId: string, 
    input: UpdateTourTemplateInput, 
    requestingUserType: UserType
  ): Promise<TourTemplate> {
    // Only system admin can update tour templates
    if (requestingUserType !== UserType.SYSTEM_ADMIN) {
      throw new Error('Insufficient permissions to update tour templates');
    }

    // Validate input
    const { error, value } = updateTourTemplateSchema.validate(input);
    if (error) {
      throw new Error(`Validation error: ${error.details.map(d => d.message).join(', ')}`);
    }

    // Check if template exists
    const existingTemplate = await this.getTourTemplateById(templateId);
    if (!existingTemplate) {
      throw new Error('Tour template not found');
    }

    // Check for name uniqueness if name or year is being updated
    if ((value.templateName && value.templateName !== existingTemplate.templateName) || 
        (value.year && value.year !== existingTemplate.year)) {
      const duplicateTemplate = await this.prisma.tourTemplate.findFirst({
        where: {
          templateName: value.templateName ?? existingTemplate.templateName,
          year: value.year ?? existingTemplate.year,
          templateId: { not: templateId }
        }
      });
      
      if (duplicateTemplate) {
        throw new Error('Tour template with this name already exists for the specified year');
      }
    }

    // Update tour template
    const updatedTemplate = await this.prisma.tourTemplate.update({
      where: { templateId },
      data: {
        templateName: value.templateName ?? existingTemplate.templateName,
        type: value.type ?? existingTemplate.type,
        year: value.year ?? existingTemplate.year,
        startDate: value.startDate ?? existingTemplate.startDate,
        endDate: value.endDate ?? existingTemplate.endDate,
        detailedDescription: value.detailedDescription ?? existingTemplate.detailedDescription,
      },
      include: {
        sitesToVisit: {
          orderBy: { orderIndex: 'asc' }
        }
      }
    });

    return updatedTemplate;
  }

  /**
   * Delete tour template (System Admin only)
   */
  async deleteTourTemplate(templateId: string, requestingUserType: UserType): Promise<void> {
    // Only system admin can delete tour templates
    if (requestingUserType !== UserType.SYSTEM_ADMIN) {
      throw new Error('Insufficient permissions to delete tour templates');
    }

    // Check if template exists
    const existingTemplate = await this.getTourTemplateById(templateId);
    if (!existingTemplate) {
      throw new Error('Tour template not found');
    }

    // Check if template is being used by any tour events
    const tourEventsCount = await this.prisma.customTourEvent.count({
      where: { templateId }
    });

    if (tourEventsCount > 0) {
      throw new Error('Cannot delete tour template that is being used by tour events');
    }

    // Delete tour template (sites will be deleted automatically due to cascade)
    await this.prisma.tourTemplate.delete({
      where: { templateId }
    });
  }

  /**
   * Add site to tour template (System Admin only)
   */
  async addSiteToTemplate(
    templateId: string, 
    siteInput: CreateSiteToVisitInput, 
    requestingUserType: UserType
  ): Promise<SiteToVisit> {
    // Only system admin can modify tour templates
    if (requestingUserType !== UserType.SYSTEM_ADMIN) {
      throw new Error('Insufficient permissions to modify tour templates');
    }

    // Validate input
    const { error, value } = createSiteToVisitSchema.validate(siteInput);
    if (error) {
      throw new Error(`Validation error: ${error.details.map(d => d.message).join(', ')}`);
    }

    // Check if template exists
    const existingTemplate = await this.getTourTemplateById(templateId);
    if (!existingTemplate) {
      throw new Error('Tour template not found');
    }

    // Check for duplicate order index
    const existingSite = await this.prisma.siteToVisit.findFirst({
      where: {
        templateId,
        orderIndex: value.orderIndex
      }
    });

    if (existingSite) {
      throw new Error('A site with this order index already exists in the template');
    }

    // Create site
    const site = await this.prisma.siteToVisit.create({
      data: {
        templateId,
        siteName: value.siteName,
        description: value.description || null,
        location: value.location,
        visitDuration: value.visitDuration,
        estimatedCost: value.estimatedCost || null,
        category: value.category,
        isOptional: value.isOptional ?? false,
        orderIndex: value.orderIndex
      }
    });

    return site;
  }

  /**
   * Update site in tour template (System Admin only)
   */
  async updateSiteInTemplate(
    templateId: string,
    siteId: string,
    siteInput: UpdateSiteToVisitInput,
    requestingUserType: UserType
  ): Promise<SiteToVisit> {
    // Only system admin can modify tour templates
    if (requestingUserType !== UserType.SYSTEM_ADMIN) {
      throw new Error('Insufficient permissions to modify tour templates');
    }

    // Validate input
    const { error, value } = updateSiteToVisitSchema.validate(siteInput);
    if (error) {
      throw new Error(`Validation error: ${error.details.map(d => d.message).join(', ')}`);
    }

    // Validate site ID
    const siteIdValidation = siteIdSchema.validate(siteId);
    if (siteIdValidation.error) {
      throw new Error(`Invalid site ID: ${siteIdValidation.error.details[0].message}`);
    }

    // Check if template exists
    const existingTemplate = await this.getTourTemplateById(templateId);
    if (!existingTemplate) {
      throw new Error('Tour template not found');
    }

    // Check if site exists and belongs to the template
    const existingSite = await this.prisma.siteToVisit.findFirst({
      where: {
        siteId,
        templateId
      }
    });

    if (!existingSite) {
      throw new Error('Site not found in this template');
    }

    // Check for duplicate order index if being updated
    if (value.orderIndex !== undefined && value.orderIndex !== existingSite.orderIndex) {
      const duplicateSite = await this.prisma.siteToVisit.findFirst({
        where: {
          templateId,
          orderIndex: value.orderIndex,
          siteId: { not: siteId }
        }
      });

      if (duplicateSite) {
        throw new Error('A site with this order index already exists in the template');
      }
    }

    // Update site
    const updatedSite = await this.prisma.siteToVisit.update({
      where: { siteId },
      data: {
        siteName: value.siteName ?? existingSite.siteName,
        description: value.description ?? existingSite.description,
        location: value.location ?? existingSite.location,
        visitDuration: value.visitDuration ?? existingSite.visitDuration,
        estimatedCost: value.estimatedCost ?? existingSite.estimatedCost,
        category: value.category ?? existingSite.category,
        isOptional: value.isOptional ?? existingSite.isOptional,
        orderIndex: value.orderIndex ?? existingSite.orderIndex
      }
    });

    return updatedSite;
  }

  /**
   * Remove site from tour template (System Admin only)
   */
  async removeSiteFromTemplate(
    templateId: string,
    siteId: string,
    requestingUserType: UserType
  ): Promise<void> {
    // Only system admin can modify tour templates
    if (requestingUserType !== UserType.SYSTEM_ADMIN) {
      throw new Error('Insufficient permissions to modify tour templates');
    }

    // Validate site ID
    const siteIdValidation = siteIdSchema.validate(siteId);
    if (siteIdValidation.error) {
      throw new Error(`Invalid site ID: ${siteIdValidation.error.details[0].message}`);
    }

    // Check if template exists
    const existingTemplate = await this.getTourTemplateById(templateId);
    if (!existingTemplate) {
      throw new Error('Tour template not found');
    }

    // Check if site exists and belongs to the template
    const existingSite = await this.prisma.siteToVisit.findFirst({
      where: {
        siteId,
        templateId
      }
    });

    if (!existingSite) {
      throw new Error('Site not found in this template');
    }

    // Delete site
    await this.prisma.siteToVisit.delete({
      where: { siteId }
    });
  }

  /**
   * Get sites for a specific template
   */
  async getTemplateSites(templateId: string): Promise<SiteToVisit[]> {
    // Validate template ID
    const { error } = templateIdSchema.validate(templateId);
    if (error) {
      throw new Error(`Invalid template ID: ${error.details[0].message}`);
    }

    // Check if template exists
    const existingTemplate = await this.getTourTemplateById(templateId);
    if (!existingTemplate) {
      throw new Error('Tour template not found');
    }

    const sites = await this.prisma.siteToVisit.findMany({
      where: { templateId },
      orderBy: { orderIndex: 'asc' }
    });

    return sites;
  }

  /**
   * Reorder sites in a template (System Admin only)
   */
  async reorderTemplateSites(
    templateId: string,
    siteOrders: { siteId: string; orderIndex: number }[],
    requestingUserType: UserType
  ): Promise<SiteToVisit[]> {
    // Only system admin can modify tour templates
    if (requestingUserType !== UserType.SYSTEM_ADMIN) {
      throw new Error('Insufficient permissions to modify tour templates');
    }

    // Check if template exists
    const existingTemplate = await this.getTourTemplateById(templateId);
    if (!existingTemplate) {
      throw new Error('Tour template not found');
    }

    // Validate that all sites belong to the template
    const siteIds = siteOrders.map(so => so.siteId);
    const existingSites = await this.prisma.siteToVisit.findMany({
      where: {
        templateId,
        siteId: { in: siteIds }
      }
    });

    if (existingSites.length !== siteIds.length) {
      throw new Error('One or more sites do not belong to this template');
    }

    // Update order indices in a transaction
    const updatedSites = await this.prisma.$transaction(
      siteOrders.map(({ siteId, orderIndex }) =>
        this.prisma.siteToVisit.update({
          where: { siteId },
          data: { orderIndex }
        })
      )
    );

    return updatedSites.sort((a, b) => a.orderIndex - b.orderIndex);
  }

  /**
   * Create tour event utilities based on template
   * This provides helper functions for creating tour events from templates
   */
  async getTemplateForTourEventCreation(templateId: string): Promise<{
    template: TourTemplate;
    suggestedActivities: Array<{
      activityName: string;
      activityType: string;
      description: string;
      estimatedDuration: string;
      location: string;
      isOptional: boolean;
      orderIndex: number;
    }>;
  }> {
    // Get template with sites
    const template = await this.getTourTemplateById(templateId);
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
  ): Promise<{
    isCompatible: boolean;
    warnings: string[];
    recommendations: string[];
  }> {
    const template = await this.getTourTemplateById(templateId);
    if (!template) {
      throw new Error('Tour template not found');
    }

    const warnings: string[] = [];
    const recommendations: string[] = [];
    let isCompatible = true;

    // Check date compatibility
    const templateDuration = Math.ceil(
      (template.endDate.getTime() - template.startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const tourEventDuration = Math.ceil(
      (tourEventEndDate.getTime() - tourEventStartDate.getTime()) / (1000 * 60 * 60 * 24)
    );

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