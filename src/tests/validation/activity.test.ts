import { describe, it, expect } from 'vitest';
import { 
  createActivitySchema, 
  updateActivitySchema, 
  activityIdSchema,
  validateTimeOrder,
  checkActivityConflict,
  defaultActivityTypes
} from '../../validation/activity';

describe('Activity Validation', () => {
  describe('createActivitySchema', () => {
    it('should validate valid activity input', () => {
      const validInput = {
        tourEventId: 'tour123',
        activityDate: new Date('2024-06-05'),
        startTime: '09:00',
        endTime: '12:00',
        activityName: 'Visit Kaaba',
        description: 'First visit to the holy Kaaba',
        location: 'Masjid al-Haram',
        activityType: 'Religious Visit',
        isOptional: false
      };

      const { error, value } = createActivitySchema.validate(validInput);
      
      expect(error).toBeUndefined();
      expect(value.activityName).toBe('Visit Kaaba');
      expect(value.isOptional).toBe(false);
    });

    it('should set default value for isOptional', () => {
      const inputWithoutOptional = {
        tourEventId: 'tour123',
        activityDate: new Date('2024-06-05'),
        startTime: '09:00',
        endTime: '12:00',
        activityName: 'Visit Kaaba',
        activityType: 'Religious Visit'
      };

      const { error, value } = createActivitySchema.validate(inputWithoutOptional);
      
      expect(error).toBeUndefined();
      expect(value.isOptional).toBe(false);
    });

    it('should reject missing required fields', () => {
      const invalidInput = {
        tourEventId: 'tour123',
        // Missing activityDate, startTime, endTime, activityName, activityType
      };

      const { error } = createActivitySchema.validate(invalidInput);
      
      expect(error).toBeDefined();
      expect(error!.details.length).toBeGreaterThan(0); // Has validation errors
    });

    it('should reject invalid time format', () => {
      const invalidInput = {
        tourEventId: 'tour123',
        activityDate: new Date('2024-06-05'),
        startTime: '25:00', // Invalid hour
        endTime: '12:60', // Invalid minute
        activityName: 'Invalid Time Activity',
        activityType: 'Other'
      };

      const { error } = createActivitySchema.validate(invalidInput);
      
      expect(error).toBeDefined();
      expect(error!.details.some(d => d.message.includes('HH:MM format'))).toBe(true);
    });

    it('should reject activity name that is too long', () => {
      const invalidInput = {
        tourEventId: 'tour123',
        activityDate: new Date('2024-06-05'),
        startTime: '09:00',
        endTime: '12:00',
        activityName: 'A'.repeat(201), // Exceeds 200 character limit
        activityType: 'Other'
      };

      const { error } = createActivitySchema.validate(invalidInput);
      
      expect(error).toBeDefined();
      expect(error!.details[0].message).toContain('cannot exceed 200 characters');
    });

    it('should reject description that is too long', () => {
      const invalidInput = {
        tourEventId: 'tour123',
        activityDate: new Date('2024-06-05'),
        startTime: '09:00',
        endTime: '12:00',
        activityName: 'Valid Activity',
        description: 'A'.repeat(1001), // Exceeds 1000 character limit
        activityType: 'Other'
      };

      const { error } = createActivitySchema.validate(invalidInput);
      
      expect(error).toBeDefined();
      expect(error!.details[0].message).toContain('cannot exceed 1000 characters');
    });

    it('should accept valid time formats', () => {
      const validTimes = ['00:00', '09:30', '12:45', '23:59'];
      
      for (const time of validTimes) {
        const input = {
          tourEventId: 'tour123',
          activityDate: new Date('2024-06-05'),
          startTime: time,
          endTime: '23:59',
          activityName: 'Time Test',
          activityType: 'Other'
        };

        const { error } = createActivitySchema.validate(input);
        expect(error).toBeUndefined();
      }
    });
  });

  describe('updateActivitySchema', () => {
    it('should validate partial update input', () => {
      const validUpdate = {
        activityName: 'Updated Activity',
        description: 'Updated description'
      };

      const { error, value } = updateActivitySchema.validate(validUpdate);
      
      expect(error).toBeUndefined();
      expect(value.activityName).toBe('Updated Activity');
    });

    it('should allow empty update', () => {
      const emptyUpdate = {};

      const { error } = updateActivitySchema.validate(emptyUpdate);
      
      expect(error).toBeUndefined();
    });

    it('should reject invalid time format in update', () => {
      const invalidUpdate = {
        startTime: '25:00'
      };

      const { error } = updateActivitySchema.validate(invalidUpdate);
      
      expect(error).toBeDefined();
      expect(error!.details[0].message).toContain('HH:MM format');
    });
  });

  describe('activityIdSchema', () => {
    it('should validate valid activity ID', () => {
      const validId = 'activity123';

      const { error, value } = activityIdSchema.validate(validId);
      
      expect(error).toBeUndefined();
      expect(value).toBe('activity123');
    });

    it('should reject empty activity ID', () => {
      const { error } = activityIdSchema.validate('');
      
      expect(error).toBeDefined();
      expect(error!.details[0].message).toContain('cannot be empty');
    });

    it('should reject missing activity ID', () => {
      const { error } = activityIdSchema.validate(undefined);
      
      expect(error).toBeDefined();
      expect(error!.details[0].message).toContain('required');
    });
  });

  describe('validateTimeOrder', () => {
    it('should return true for valid time order', () => {
      expect(validateTimeOrder('09:00', '12:00')).toBe(true);
      expect(validateTimeOrder('00:00', '23:59')).toBe(true);
      expect(validateTimeOrder('12:30', '12:31')).toBe(true);
    });

    it('should return false for invalid time order', () => {
      expect(validateTimeOrder('12:00', '09:00')).toBe(false);
      expect(validateTimeOrder('23:59', '00:00')).toBe(false);
      expect(validateTimeOrder('12:30', '12:30')).toBe(false); // Same time
    });
  });

  describe('checkActivityConflict', () => {
    const existingActivities = [
      {
        activityDate: new Date('2024-06-05'),
        startTime: '09:00',
        endTime: '12:00'
      },
      {
        activityDate: new Date('2024-06-05'),
        startTime: '14:00',
        endTime: '17:00'
      },
      {
        activityDate: new Date('2024-06-06'),
        startTime: '10:00',
        endTime: '13:00'
      }
    ];

    it('should detect overlapping activities on same date', () => {
      const conflictingActivity = {
        activityDate: new Date('2024-06-05'),
        startTime: '10:00', // Overlaps with 09:00-12:00
        endTime: '13:00'
      };

      expect(checkActivityConflict(conflictingActivity, existingActivities)).toBe(true);
    });

    it('should detect activities that start before existing ends', () => {
      const conflictingActivity = {
        activityDate: new Date('2024-06-05'),
        startTime: '11:30', // Starts before 12:00
        endTime: '13:00'
      };

      expect(checkActivityConflict(conflictingActivity, existingActivities)).toBe(true);
    });

    it('should detect activities that end after existing starts', () => {
      const conflictingActivity = {
        activityDate: new Date('2024-06-05'),
        startTime: '08:00',
        endTime: '10:00' // Ends after 09:00
      };

      expect(checkActivityConflict(conflictingActivity, existingActivities)).toBe(true);
    });

    it('should allow non-overlapping activities on same date', () => {
      const nonConflictingActivity = {
        activityDate: new Date('2024-06-05'),
        startTime: '12:00', // Starts exactly when previous ends
        endTime: '14:00' // Ends exactly when next starts
      };

      expect(checkActivityConflict(nonConflictingActivity, existingActivities)).toBe(false);
    });

    it('should allow activities on different dates', () => {
      const differentDateActivity = {
        activityDate: new Date('2024-06-07'),
        startTime: '09:00',
        endTime: '12:00'
      };

      expect(checkActivityConflict(differentDateActivity, existingActivities)).toBe(false);
    });

    it('should handle empty existing activities array', () => {
      const newActivity = {
        activityDate: new Date('2024-06-05'),
        startTime: '09:00',
        endTime: '12:00'
      };

      expect(checkActivityConflict(newActivity, [])).toBe(false);
    });

    it('should handle activities that touch but do not overlap', () => {
      const touchingActivity = {
        activityDate: new Date('2024-06-05'),
        startTime: '12:00', // Starts exactly when first activity ends
        endTime: '13:00'
      };

      expect(checkActivityConflict(touchingActivity, existingActivities)).toBe(false);
    });
  });

  describe('defaultActivityTypes', () => {
    it('should contain expected activity types', () => {
      expect(defaultActivityTypes).toContain('Transportation');
      expect(defaultActivityTypes).toContain('Religious Visit');
      expect(defaultActivityTypes).toContain('Sightseeing');
      expect(defaultActivityTypes).toContain('Meal');
      expect(defaultActivityTypes).toContain('Cultural Experience');
      expect(defaultActivityTypes).toContain('Free Time');
      expect(defaultActivityTypes).toContain('Other');
    });

    it('should be an array of strings', () => {
      expect(Array.isArray(defaultActivityTypes)).toBe(true);
      expect(defaultActivityTypes.every(type => typeof type === 'string')).toBe(true);
    });

    it('should have reasonable number of types', () => {
      expect(defaultActivityTypes.length).toBeGreaterThan(5);
      expect(defaultActivityTypes.length).toBeLessThan(20);
    });
  });
});