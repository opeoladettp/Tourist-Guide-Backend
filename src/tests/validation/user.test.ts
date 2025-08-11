import { describe, it, expect } from 'vitest';
import { createUserSchema, updateUserSchema, userIdSchema } from '../../validation/user';
import { UserType, UserStatus } from '../../types/user';

describe('User Validation Schemas', () => {
  describe('createUserSchema', () => {
    const validUserData = {
      firstName: 'John',
      lastName: 'Doe',
      emailAddress: 'john.doe@example.com',
      phoneNumber: '+1234567890',
      country: 'United States',
      password: 'TestPassword123!',
      userType: UserType.TOURIST,
      providerId: 'provider123'
    };

    it('should validate valid user data', () => {
      const { error, value } = createUserSchema.validate(validUserData);
      expect(error).toBeUndefined();
      expect(value).toEqual(validUserData);
    });

    it('should require firstName', () => {
      const { error } = createUserSchema.validate({ ...validUserData, firstName: '' });
      expect(error?.details[0].message).toContain('not allowed to be empty');
    });

    it('should require lastName', () => {
      const { error } = createUserSchema.validate({ ...validUserData, lastName: '' });
      expect(error?.details[0].message).toContain('not allowed to be empty');
    });

    it('should validate email format', () => {
      const { error } = createUserSchema.validate({ ...validUserData, emailAddress: 'invalid-email' });
      expect(error?.details[0].message).toContain('valid email address');
    });

    it('should validate phone number format', () => {
      const { error } = createUserSchema.validate({ ...validUserData, phoneNumber: '123' });
      expect(error?.details[0].message).toContain('Phone number must be at least 10 characters');
    });

    it('should validate password strength', () => {
      const { error } = createUserSchema.validate({ ...validUserData, password: 'weak' });
      expect(error?.details[0].message).toContain('Password must be at least 8 characters long');
    });

    it('should validate userType enum', () => {
      const { error } = createUserSchema.validate({ ...validUserData, userType: 'INVALID_TYPE' });
      expect(error?.details[0].message).toContain('User type must be one of');
    });

    it('should require providerId for PROVIDER_ADMIN', () => {
      const { error } = createUserSchema.validate({
        ...validUserData,
        userType: UserType.PROVIDER_ADMIN,
        providerId: undefined
      });
      expect(error?.details[0].message).toContain('Provider ID is required');
    });

    it('should forbid providerId for SYSTEM_ADMIN', () => {
      const { error } = createUserSchema.validate({
        ...validUserData,
        userType: UserType.SYSTEM_ADMIN,
        providerId: 'provider123'
      });
      expect(error?.details[0].message).toContain('Provider ID is not allowed');
    });

    it('should validate optional fields', () => {
      const dataWithOptionals = {
        ...validUserData,
        middleName: 'Middle',
        passportNumber: 'AB123456',
        dateOfBirth: new Date('1990-01-01'),
        gender: 'Male'
      };
      
      const { error } = createUserSchema.validate(dataWithOptionals);
      expect(error).toBeUndefined();
    });

    it('should reject future date of birth', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      
      const { error } = createUserSchema.validate({
        ...validUserData,
        dateOfBirth: futureDate
      });
      expect(error?.details[0].message).toContain('Date of birth cannot be in the future');
    });

    it('should validate gender options', () => {
      const { error } = createUserSchema.validate({
        ...validUserData,
        gender: 'Invalid Gender'
      });
      expect(error?.details[0].message).toContain('Gender must be one of');
    });
  });

  describe('updateUserSchema', () => {
    it('should validate partial updates', () => {
      const updateData = {
        firstName: 'Jane',
        phoneNumber: '+9876543210'
      };
      
      const { error, value } = updateUserSchema.validate(updateData);
      expect(error).toBeUndefined();
      expect(value).toEqual(updateData);
    });

    it('should validate status enum', () => {
      const { error } = updateUserSchema.validate({ status: 'INVALID_STATUS' });
      expect(error?.details[0].message).toContain('Status must be one of');
    });

    it('should allow empty update', () => {
      const { error } = updateUserSchema.validate({});
      expect(error).toBeUndefined();
    });

    it('should validate phone number format in updates', () => {
      const { error } = updateUserSchema.validate({ phoneNumber: '123' });
      expect(error?.details[0].message).toContain('Phone number must be at least 10 characters');
    });

    it('should validate passport number length', () => {
      const { error } = updateUserSchema.validate({ passportNumber: '12345' });
      expect(error?.details[0].message).toContain('Passport number must be at least 6 characters');
    });
  });

  describe('userIdSchema', () => {
    it('should validate valid user ID', () => {
      const { error, value } = userIdSchema.validate('user123');
      expect(error).toBeUndefined();
      expect(value).toBe('user123');
    });

    it('should require user ID', () => {
      const { error } = userIdSchema.validate('');
      expect(error?.details[0].message).toContain('User ID cannot be empty');
    });

    it('should require user ID to be provided', () => {
      const { error } = userIdSchema.validate(undefined);
      expect(error?.details[0].message).toContain('User ID is required');
    });
  });
});