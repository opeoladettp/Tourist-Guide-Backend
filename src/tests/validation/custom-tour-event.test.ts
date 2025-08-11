import { describe, it, expect } from 'vitest';
import { 
  createCustomTourEventSchema, 
  updateCustomTourEventSchema, 
  tourEventIdSchema,
  touristRegistrationSchema,
  registrationApprovalSchema
} from '../../validation/custom-tour-event';
import { TourEventStatus } from '../../types/custom-tour-event';

describe('Custom Tour Event Validation Schemas', () => {
  describe('createCustomTourEventSchema', () => {
    const futureDate1 = new Date();
    futureDate1.setDate(futureDate1.getDate() + 30); // 30 days from now
    const futureDate2 = new Date();
    futureDate2.setDate(futureDate2.getDate() + 45); // 45 days from now
    
    const validEventData = {
      customTourName: 'Hajj 2025 Premium Package',
      startDate: futureDate1,
      endDate: futureDate2,
      packageType: 'Premium',
      place1Hotel: 'Makkah Hilton',
      place2Hotel: 'Madinah Marriott',
      numberOfAllowedTourists: 50,
      groupChatInfo: 'WhatsApp group will be created'
    };

    it('should validate valid tour event data', () => {
      const { error, value } = createCustomTourEventSchema.validate(validEventData);
      expect(error).toBeUndefined();
      expect(value.customTourName).toBe(validEventData.customTourName);
    });

    it('should require customTourName', () => {
      const { error } = createCustomTourEventSchema.validate({ ...validEventData, customTourName: '' });
      expect(error?.details[0].message).toContain('not allowed to be empty');
    });

    it('should require startDate', () => {
      const { error } = createCustomTourEventSchema.validate({ ...validEventData, startDate: undefined });
      expect(error?.details[0].message).toContain('Start date is required');
    });

    it('should require endDate after startDate', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() + 20); // Before the start date (which is 30 days from now)
      
      const { error } = createCustomTourEventSchema.validate({
        ...validEventData,
        endDate: pastDate
      });
      expect(error?.details[0].message).toContain('End date must be after start date');
    });

    it('should require packageType', () => {
      const { error } = createCustomTourEventSchema.validate({ ...validEventData, packageType: '' });
      expect(error?.details[0].message).toContain('not allowed to be empty');
    });

    it('should require place1Hotel', () => {
      const { error } = createCustomTourEventSchema.validate({ ...validEventData, place1Hotel: '' });
      expect(error?.details[0].message).toContain('not allowed to be empty');
    });

    it('should require place2Hotel', () => {
      const { error } = createCustomTourEventSchema.validate({ ...validEventData, place2Hotel: '' });
      expect(error?.details[0].message).toContain('not allowed to be empty');
    });

    it('should require numberOfAllowedTourists', () => {
      const { error } = createCustomTourEventSchema.validate({ ...validEventData, numberOfAllowedTourists: undefined });
      expect(error?.details[0].message).toContain('Number of allowed tourists is required');
    });

    it('should validate numberOfAllowedTourists range', () => {
      const { error } = createCustomTourEventSchema.validate({ ...validEventData, numberOfAllowedTourists: 0 });
      expect(error?.details[0].message).toContain('Number of allowed tourists must be at least 1');
    });

    it('should validate numberOfAllowedTourists maximum', () => {
      const { error } = createCustomTourEventSchema.validate({ ...validEventData, numberOfAllowedTourists: 1001 });
      expect(error?.details[0].message).toContain('Number of allowed tourists cannot exceed 1000');
    });

    it('should allow optional templateId', () => {
      const dataWithTemplate = {
        ...validEventData,
        templateId: 'template123'
      };
      
      const { error } = createCustomTourEventSchema.validate(dataWithTemplate);
      expect(error).toBeUndefined();
    });

    it('should allow optional groupChatInfo', () => {
      const { error } = createCustomTourEventSchema.validate({ ...validEventData, groupChatInfo: undefined });
      expect(error).toBeUndefined();
    });

    it('should validate field length limits', () => {
      const longName = 'a'.repeat(201);
      const { error } = createCustomTourEventSchema.validate({
        ...validEventData,
        customTourName: longName
      });
      expect(error?.details[0].message).toContain('Custom tour name cannot exceed 200 characters');
    });
  });

  describe('updateCustomTourEventSchema', () => {
    it('should validate partial updates', () => {
      const updateData = {
        customTourName: 'Updated Tour Name',
        numberOfAllowedTourists: 75
      };
      
      const { error, value } = updateCustomTourEventSchema.validate(updateData);
      expect(error).toBeUndefined();
      expect(value).toEqual(updateData);
    });

    it('should allow empty update', () => {
      const { error } = updateCustomTourEventSchema.validate({});
      expect(error).toBeUndefined();
    });

    it('should validate status enum', () => {
      const { error } = updateCustomTourEventSchema.validate({ status: 'INVALID_STATUS' });
      expect(error?.details[0].message).toContain('Status must be one of');
    });

    it('should validate date relationship when both dates provided', () => {
      const futureDate1 = new Date();
      futureDate1.setDate(futureDate1.getDate() + 30);
      const futureDate2 = new Date();
      futureDate2.setDate(futureDate2.getDate() + 20); // Before start date
      
      const { error } = updateCustomTourEventSchema.validate({
        startDate: futureDate1,
        endDate: futureDate2
      });
      expect(error?.details[0].message).toContain('End date must be after start date');
    });

    it('should validate numberOfAllowedTourists range in updates', () => {
      const { error } = updateCustomTourEventSchema.validate({ numberOfAllowedTourists: 0 });
      expect(error?.details[0].message).toContain('Number of allowed tourists must be at least 1');
    });
  });

  describe('touristRegistrationSchema', () => {
    it('should validate valid registration data', () => {
      const registrationData = { tourEventId: 'event123' };
      const { error, value } = touristRegistrationSchema.validate(registrationData);
      expect(error).toBeUndefined();
      expect(value.tourEventId).toBe('event123');
    });

    it('should require tourEventId', () => {
      const { error } = touristRegistrationSchema.validate({ tourEventId: '' });
      expect(error?.details[0].message).toContain('Tour event ID cannot be empty');
    });

    it('should require tourEventId to be provided', () => {
      const { error } = touristRegistrationSchema.validate({});
      expect(error?.details[0].message).toContain('Tour event ID is required');
    });
  });

  describe('registrationApprovalSchema', () => {
    it('should validate approval data', () => {
      const approvalData = {
        registrationId: 'reg123',
        approved: true
      };
      
      const { error, value } = registrationApprovalSchema.validate(approvalData);
      expect(error).toBeUndefined();
      expect(value).toEqual(approvalData);
    });

    it('should validate rejection data with reason', () => {
      const rejectionData = {
        registrationId: 'reg123',
        approved: false,
        rejectedReason: 'Tour is full'
      };
      
      const { error, value } = registrationApprovalSchema.validate(rejectionData);
      expect(error).toBeUndefined();
      expect(value).toEqual(rejectionData);
    });

    it('should require registrationId', () => {
      const { error } = registrationApprovalSchema.validate({ approved: true });
      expect(error?.details[0].message).toContain('Registration ID is required');
    });

    it('should require approved status', () => {
      const { error } = registrationApprovalSchema.validate({ registrationId: 'reg123' });
      expect(error?.details[0].message).toContain('Approved status is required');
    });

    it('should require rejectedReason when rejecting', () => {
      const { error } = registrationApprovalSchema.validate({
        registrationId: 'reg123',
        approved: false
      });
      expect(error?.details[0].message).toContain('Rejected reason is required when rejecting registration');
    });

    it('should not require rejectedReason when approving', () => {
      const { error } = registrationApprovalSchema.validate({
        registrationId: 'reg123',
        approved: true
      });
      expect(error).toBeUndefined();
    });
  });

  describe('tourEventIdSchema', () => {
    it('should validate valid tour event ID', () => {
      const { error, value } = tourEventIdSchema.validate('event123');
      expect(error).toBeUndefined();
      expect(value).toBe('event123');
    });

    it('should require tour event ID', () => {
      const { error } = tourEventIdSchema.validate('');
      expect(error?.details[0].message).toContain('Tour event ID cannot be empty');
    });

    it('should require tour event ID to be provided', () => {
      const { error } = tourEventIdSchema.validate(undefined);
      expect(error?.details[0].message).toContain('Tour event ID is required');
    });
  });
});