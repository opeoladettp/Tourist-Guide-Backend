import { describe, it, expect } from 'vitest';
import { 
  createTourTemplateSchema, 
  updateTourTemplateSchema, 
  templateIdSchema,
  createSiteToVisitSchema,
  updateSiteToVisitSchema,
  siteIdSchema
} from '../../validation/tour-template';
import { SiteCategory } from '../../types/tour-template';

describe('Tour Template Validation Schemas', () => {
  describe('createTourTemplateSchema', () => {
    const validTemplateData = {
      templateName: 'Hajj 2024 Package',
      type: 'Religious',
      year: 2024,
      startDate: new Date('2024-06-01'),
      endDate: new Date('2024-06-15'),
      detailedDescription: 'A comprehensive Hajj package including all necessary arrangements for pilgrimage.',
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

    it('should validate valid tour template data', () => {
      const { error, value } = createTourTemplateSchema.validate(validTemplateData);
      expect(error).toBeUndefined();
      expect(value.templateName).toBe(validTemplateData.templateName);
    });

    it('should require templateName', () => {
      const { error } = createTourTemplateSchema.validate({ ...validTemplateData, templateName: '' });
      expect(error?.details[0].message).toContain('not allowed to be empty');
    });

    it('should require type', () => {
      const { error } = createTourTemplateSchema.validate({ ...validTemplateData, type: '' });
      expect(error?.details[0].message).toContain('not allowed to be empty');
    });

    it('should validate year range', () => {
      const { error } = createTourTemplateSchema.validate({ ...validTemplateData, year: 2019 });
      expect(error?.details[0].message).toContain('Year must be 2020 or later');
    });

    it('should require startDate', () => {
      const { error } = createTourTemplateSchema.validate({ ...validTemplateData, startDate: undefined });
      expect(error?.details[0].message).toContain('Start date is required');
    });

    it('should require endDate after startDate', () => {
      const { error } = createTourTemplateSchema.validate({
        ...validTemplateData,
        endDate: new Date('2024-05-30') // Before start date
      });
      expect(error?.details[0].message).toContain('End date must be after start date');
    });

    it('should require detailedDescription', () => {
      const { error } = createTourTemplateSchema.validate({ ...validTemplateData, detailedDescription: '' });
      expect(error?.details[0].message).toContain('not allowed to be empty');
    });

    it('should validate sitesToVisit array', () => {
      const invalidSite = {
        ...validTemplateData,
        sitesToVisit: [
          {
            siteName: '', // Invalid
            location: 'Mecca',
            visitDuration: '5 days',
            category: SiteCategory.RELIGIOUS,
            orderIndex: 1
          }
        ]
      };
      
      const { error } = createTourTemplateSchema.validate(invalidSite);
      expect(error?.details[0].message).toContain('not allowed to be empty');
    });

    it('should validate field length limits', () => {
      const longName = 'a'.repeat(201);
      const { error } = createTourTemplateSchema.validate({
        ...validTemplateData,
        templateName: longName
      });
      expect(error?.details[0].message).toContain('Template name cannot exceed 200 characters');
    });

    it('should validate description length limit', () => {
      const longDescription = 'a'.repeat(5001);
      const { error } = createTourTemplateSchema.validate({
        ...validTemplateData,
        detailedDescription: longDescription
      });
      expect(error?.details[0].message).toContain('Detailed description cannot exceed 5000 characters');
    });
  });

  describe('updateTourTemplateSchema', () => {
    it('should validate partial updates', () => {
      const updateData = {
        templateName: 'Updated Hajj Package',
        year: 2025
      };
      
      const { error, value } = updateTourTemplateSchema.validate(updateData);
      expect(error).toBeUndefined();
      expect(value).toEqual(updateData);
    });

    it('should allow empty update', () => {
      const { error } = updateTourTemplateSchema.validate({});
      expect(error).toBeUndefined();
    });

    it('should validate year range in updates', () => {
      const { error } = updateTourTemplateSchema.validate({ year: 2019 });
      expect(error?.details[0].message).toContain('Year must be 2020 or later');
    });

    it('should validate date relationship when both dates provided', () => {
      const { error } = updateTourTemplateSchema.validate({
        startDate: new Date('2024-06-15'),
        endDate: new Date('2024-06-01') // Before start date
      });
      expect(error?.details[0].message).toContain('End date must be after start date');
    });
  });

  describe('createSiteToVisitSchema', () => {
    const validSiteData = {
      siteName: 'Masjid al-Haram',
      description: 'The holiest mosque in Islam',
      location: 'Mecca, Saudi Arabia',
      visitDuration: '5 days',
      estimatedCost: 500.00,
      category: SiteCategory.RELIGIOUS,
      isOptional: false,
      orderIndex: 1
    };

    it('should validate valid site data', () => {
      const { error, value } = createSiteToVisitSchema.validate(validSiteData);
      expect(error).toBeUndefined();
      expect(value.siteName).toBe(validSiteData.siteName);
    });

    it('should require siteName', () => {
      const { error } = createSiteToVisitSchema.validate({ ...validSiteData, siteName: '' });
      expect(error?.details[0].message).toContain('not allowed to be empty');
    });

    it('should require location', () => {
      const { error } = createSiteToVisitSchema.validate({ ...validSiteData, location: '' });
      expect(error?.details[0].message).toContain('not allowed to be empty');
    });

    it('should require visitDuration', () => {
      const { error } = createSiteToVisitSchema.validate({ ...validSiteData, visitDuration: '' });
      expect(error?.details[0].message).toContain('not allowed to be empty');
    });

    it('should validate category enum', () => {
      const { error } = createSiteToVisitSchema.validate({ ...validSiteData, category: 'INVALID_CATEGORY' });
      expect(error?.details[0].message).toContain('Category must be one of');
    });

    it('should require orderIndex', () => {
      const { error } = createSiteToVisitSchema.validate({ ...validSiteData, orderIndex: undefined });
      expect(error?.details[0].message).toContain('Order index is required');
    });

    it('should validate orderIndex as non-negative integer', () => {
      const { error } = createSiteToVisitSchema.validate({ ...validSiteData, orderIndex: -1 });
      expect(error?.details[0].message).toContain('Order index cannot be negative');
    });

    it('should validate estimatedCost range', () => {
      const { error } = createSiteToVisitSchema.validate({ ...validSiteData, estimatedCost: -10 });
      expect(error?.details[0].message).toContain('Estimated cost cannot be negative');
    });

    it('should allow optional fields', () => {
      const minimalSite = {
        siteName: 'Test Site',
        location: 'Test Location',
        visitDuration: '2 hours',
        category: SiteCategory.OTHER,
        orderIndex: 1
      };
      
      const { error } = createSiteToVisitSchema.validate(minimalSite);
      expect(error).toBeUndefined();
    });
  });

  describe('updateSiteToVisitSchema', () => {
    it('should validate partial site updates', () => {
      const updateData = {
        siteName: 'Updated Site Name',
        estimatedCost: 750.00
      };
      
      const { error, value } = updateSiteToVisitSchema.validate(updateData);
      expect(error).toBeUndefined();
      expect(value).toEqual(updateData);
    });

    it('should allow empty update', () => {
      const { error } = updateSiteToVisitSchema.validate({});
      expect(error).toBeUndefined();
    });

    it('should validate category enum in updates', () => {
      const { error } = updateSiteToVisitSchema.validate({ category: 'INVALID_CATEGORY' });
      expect(error?.details[0].message).toContain('Category must be one of');
    });
  });

  describe('templateIdSchema', () => {
    it('should validate valid template ID', () => {
      const { error, value } = templateIdSchema.validate('template123');
      expect(error).toBeUndefined();
      expect(value).toBe('template123');
    });

    it('should require template ID', () => {
      const { error } = templateIdSchema.validate('');
      expect(error?.details[0].message).toContain('Template ID cannot be empty');
    });
  });

  describe('siteIdSchema', () => {
    it('should validate valid site ID', () => {
      const { error, value } = siteIdSchema.validate('site123');
      expect(error).toBeUndefined();
      expect(value).toBe('site123');
    });

    it('should require site ID', () => {
      const { error } = siteIdSchema.validate('');
      expect(error?.details[0].message).toContain('Site ID cannot be empty');
    });
  });
});