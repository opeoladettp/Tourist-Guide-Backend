import { describe, it, expect } from 'vitest';
import { 
  createProviderSchema, 
  updateProviderSchema, 
  providerIdSchema,
  providerPaginationSchema,
  providerIsolationSchema,
  providerAccessSchema,
  batchProviderIsolationSchema,
  providerScopedQuerySchema,
  auditTrailSchema
} from '../../validation/provider';

describe('Provider Validation Schemas', () => {
  describe('createProviderSchema', () => {
    const validProviderData = {
      companyName: 'Test Travel Company',
      country: 'United States',
      addressLine1: '123 Main Street',
      city: 'New York',
      stateRegion: 'NY',
      companyDescription: 'A leading travel company providing excellent tour services.',
      phoneNumber: '+1234567890',
      emailAddress: 'info@testtravelcompany.com',
      corpIdTaxId: 'TC123456789'
    };

    it('should validate valid provider data', () => {
      const { error, value } = createProviderSchema.validate(validProviderData);
      expect(error).toBeUndefined();
      expect(value.companyName).toBe(validProviderData.companyName);
      expect(value.isIsolatedInstance).toBe(true); // Default value
    });

    it('should require companyName', () => {
      const { error } = createProviderSchema.validate({ ...validProviderData, companyName: '' });
      expect(error?.details[0].message).toContain('not allowed to be empty');
    });

    it('should require country', () => {
      const { error } = createProviderSchema.validate({ ...validProviderData, country: '' });
      expect(error?.details[0].message).toContain('not allowed to be empty');
    });

    it('should require addressLine1', () => {
      const { error } = createProviderSchema.validate({ ...validProviderData, addressLine1: '' });
      expect(error?.details[0].message).toContain('not allowed to be empty');
    });

    it('should require city', () => {
      const { error } = createProviderSchema.validate({ ...validProviderData, city: '' });
      expect(error?.details[0].message).toContain('not allowed to be empty');
    });

    it('should require stateRegion', () => {
      const { error } = createProviderSchema.validate({ ...validProviderData, stateRegion: '' });
      expect(error?.details[0].message).toContain('not allowed to be empty');
    });

    it('should require companyDescription', () => {
      const { error } = createProviderSchema.validate({ ...validProviderData, companyDescription: '' });
      expect(error?.details[0].message).toContain('not allowed to be empty');
    });

    it('should validate email format', () => {
      const { error } = createProviderSchema.validate({ ...validProviderData, emailAddress: 'invalid-email' });
      expect(error?.details[0].message).toContain('valid email address');
    });

    it('should validate phone number format', () => {
      const { error } = createProviderSchema.validate({ ...validProviderData, phoneNumber: '123' });
      expect(error?.details[0].message).toContain('Phone number must be at least 10 characters');
    });

    it('should require corpIdTaxId', () => {
      const { error } = createProviderSchema.validate({ ...validProviderData, corpIdTaxId: '' });
      expect(error?.details[0].message).toContain('not allowed to be empty');
    });

    it('should validate corpIdTaxId minimum length', () => {
      const { error } = createProviderSchema.validate({ ...validProviderData, corpIdTaxId: '1234' });
      expect(error?.details[0].message).toContain('Corporate ID/Tax ID must be at least 5 characters');
    });

    it('should allow optional addressLine2', () => {
      const dataWithAddressLine2 = {
        ...validProviderData,
        addressLine2: 'Suite 100'
      };
      
      const { error } = createProviderSchema.validate(dataWithAddressLine2);
      expect(error).toBeUndefined();
    });

    it('should validate isIsolatedInstance boolean', () => {
      const { error } = createProviderSchema.validate({
        ...validProviderData,
        isIsolatedInstance: 'not-boolean'
      });
      expect(error?.details[0].message).toContain('Isolated instance must be a boolean value');
    });

    it('should validate field length limits', () => {
      const longString = 'a'.repeat(201);
      const { error } = createProviderSchema.validate({
        ...validProviderData,
        companyName: longString
      });
      expect(error?.details[0].message).toContain('Company name cannot exceed 200 characters');
    });

    it('should validate company description length limit', () => {
      const longDescription = 'a'.repeat(1001);
      const { error } = createProviderSchema.validate({
        ...validProviderData,
        companyDescription: longDescription
      });
      expect(error?.details[0].message).toContain('Company description cannot exceed 1000 characters');
    });
  });

  describe('updateProviderSchema', () => {
    it('should validate partial updates', () => {
      const updateData = {
        companyName: 'Updated Company Name',
        phoneNumber: '+9876543210'
      };
      
      const { error, value } = updateProviderSchema.validate(updateData);
      expect(error).toBeUndefined();
      expect(value).toEqual(updateData);
    });

    it('should allow empty update', () => {
      const { error } = updateProviderSchema.validate({});
      expect(error).toBeUndefined();
    });

    it('should validate email format in updates', () => {
      const { error } = updateProviderSchema.validate({ emailAddress: 'invalid-email' });
      expect(error?.details[0].message).toContain('valid email address');
    });

    it('should validate phone number format in updates', () => {
      const { error } = updateProviderSchema.validate({ phoneNumber: '123' });
      expect(error?.details[0].message).toContain('Phone number must be at least 10 characters');
    });

    it('should validate boolean isIsolatedInstance', () => {
      const { error } = updateProviderSchema.validate({ isIsolatedInstance: 'not-boolean' });
      expect(error?.details[0].message).toContain('Isolated instance must be a boolean value');
    });

    it('should validate field length limits in updates', () => {
      const longString = 'a'.repeat(201);
      const { error } = updateProviderSchema.validate({ companyName: longString });
      expect(error?.details[0].message).toContain('Company name cannot exceed 200 characters');
    });
  });

  describe('providerIdSchema', () => {
    it('should validate valid provider ID', () => {
      const { error, value } = providerIdSchema.validate('provider123');
      expect(error).toBeUndefined();
      expect(value).toBe('provider123');
    });

    it('should require provider ID', () => {
      const { error } = providerIdSchema.validate('');
      expect(error?.details[0].message).toContain('Provider ID cannot be empty');
    });

    it('should require provider ID to be provided', () => {
      const { error } = providerIdSchema.validate(undefined);
      expect(error?.details[0].message).toContain('Provider ID is required');
    });
  });

  describe('providerPaginationSchema', () => {
    it('should validate valid pagination parameters', () => {
      const { error, value } = providerPaginationSchema.validate({ limit: 25, offset: 10 });
      expect(error).toBeUndefined();
      expect(value.limit).toBe(25);
      expect(value.offset).toBe(10);
    });

    it('should use default values when not provided', () => {
      const { error, value } = providerPaginationSchema.validate({});
      expect(error).toBeUndefined();
      expect(value.limit).toBe(50);
      expect(value.offset).toBe(0);
    });

    it('should validate limit range', () => {
      const { error } = providerPaginationSchema.validate({ limit: 101 });
      expect(error?.details[0].message).toContain('Limit cannot exceed 100');
    });

    it('should validate minimum limit', () => {
      const { error } = providerPaginationSchema.validate({ limit: 0 });
      expect(error?.details[0].message).toContain('Limit must be at least 1');
    });

    it('should validate minimum offset', () => {
      const { error } = providerPaginationSchema.validate({ offset: -1 });
      expect(error?.details[0].message).toContain('Offset cannot be negative');
    });

    it('should require integer values', () => {
      const { error } = providerPaginationSchema.validate({ limit: 25.5 });
      expect(error?.details[0].message).toContain('Limit must be an integer');
    });
  });

  describe('providerIsolationSchema', () => {
    it('should validate valid isolation settings', () => {
      const isolationData = {
        providerId: 'provider123',
        isIsolatedInstance: true
      };
      
      const { error, value } = providerIsolationSchema.validate(isolationData);
      expect(error).toBeUndefined();
      expect(value).toEqual(isolationData);
    });

    it('should require providerId', () => {
      const { error } = providerIsolationSchema.validate({ isIsolatedInstance: true });
      expect(error?.details[0].message).toContain('Provider ID is required');
    });

    it('should require isIsolatedInstance', () => {
      const { error } = providerIsolationSchema.validate({ providerId: 'provider123' });
      expect(error?.details[0].message).toContain('Isolated instance setting is required');
    });

    it('should validate boolean isIsolatedInstance', () => {
      const { error } = providerIsolationSchema.validate({
        providerId: 'provider123',
        isIsolatedInstance: 'not-boolean'
      });
      expect(error?.details[0].message).toContain('Isolated instance must be a boolean value');
    });
  });

  describe('providerAccessSchema', () => {
    it('should validate valid access parameters', () => {
      const accessData = {
        resourceProviderId: 'provider123',
        requestingUserProviderId: 'provider456',
        operation: 'read'
      };
      
      const { error, value } = providerAccessSchema.validate(accessData);
      expect(error).toBeUndefined();
      expect(value).toEqual(accessData);
    });

    it('should use default operation when not provided', () => {
      const accessData = {
        resourceProviderId: 'provider123',
        requestingUserProviderId: 'provider456'
      };
      
      const { error, value } = providerAccessSchema.validate(accessData);
      expect(error).toBeUndefined();
      expect(value.operation).toBe('access');
    });

    it('should require resourceProviderId', () => {
      const { error } = providerAccessSchema.validate({
        requestingUserProviderId: 'provider456'
      });
      expect(error?.details[0].message).toContain('Provider ID is required');
    });

    it('should allow optional requestingUserProviderId', () => {
      const { error } = providerAccessSchema.validate({
        resourceProviderId: 'provider123'
      });
      expect(error).toBeUndefined();
    });

    it('should validate operation length', () => {
      const longOperation = 'a'.repeat(51);
      const { error } = providerAccessSchema.validate({
        resourceProviderId: 'provider123',
        operation: longOperation
      });
      expect(error?.details[0].message).toContain('Operation description cannot exceed 50 characters');
    });
  });

  describe('batchProviderIsolationSchema', () => {
    it('should validate valid batch resources', () => {
      const batchData = {
        resources: [
          { providerId: 'provider123', name: 'Resource 1' },
          { providerId: 'provider123', name: 'Resource 2' }
        ],
        requestingUserProviderId: 'provider123'
      };
      
      const { error, value } = batchProviderIsolationSchema.validate(batchData);
      expect(error).toBeUndefined();
      expect(value).toEqual(batchData);
    });

    it('should allow empty resources array', () => {
      const { error } = batchProviderIsolationSchema.validate({ resources: [] });
      expect(error).toBeUndefined();
    });

    it('should require resources array', () => {
      const { error } = batchProviderIsolationSchema.validate({});
      expect(error?.details[0].message).toContain('Resources array is required');
    });

    it('should validate maximum resources limit', () => {
      const resources = Array(101).fill({ providerId: 'provider123' });
      const { error } = batchProviderIsolationSchema.validate({ resources });
      expect(error?.details[0].message).toContain('Cannot process more than 100 resources at once');
    });

    it('should allow optional requestingUserProviderId', () => {
      const { error } = batchProviderIsolationSchema.validate({
        resources: [{ providerId: 'provider123' }]
      });
      expect(error).toBeUndefined();
    });
  });

  describe('providerScopedQuerySchema', () => {
    it('should validate valid scoped query parameters', () => {
      const queryData = {
        baseQuery: { where: { status: 'ACTIVE' } },
        userType: 'PROVIDER_ADMIN',
        requestingUserProviderId: 'provider123'
      };
      
      const { error, value } = providerScopedQuerySchema.validate(queryData);
      expect(error).toBeUndefined();
      expect(value).toEqual(queryData);
    });

    it('should require baseQuery', () => {
      const { error } = providerScopedQuerySchema.validate({
        userType: 'SYSTEM_ADMIN'
      });
      expect(error?.details[0].message).toContain('Base query is required');
    });

    it('should require userType', () => {
      const { error } = providerScopedQuerySchema.validate({
        baseQuery: { where: {} }
      });
      expect(error?.details[0].message).toContain('User type is required');
    });

    it('should validate userType values', () => {
      const { error } = providerScopedQuerySchema.validate({
        baseQuery: { where: {} },
        userType: 'INVALID_TYPE'
      });
      expect(error?.details[0].message).toContain('User type must be SYSTEM_ADMIN, PROVIDER_ADMIN, or TOURIST');
    });

    it('should require providerId for PROVIDER_ADMIN', () => {
      const { error } = providerScopedQuerySchema.validate({
        baseQuery: { where: {} },
        userType: 'PROVIDER_ADMIN'
      });
      expect(error?.details[0].message).toContain('Provider ID is required for provider-scoped queries');
    });

    it('should not require providerId for SYSTEM_ADMIN', () => {
      const { error } = providerScopedQuerySchema.validate({
        baseQuery: { where: {} },
        userType: 'SYSTEM_ADMIN'
      });
      expect(error).toBeUndefined();
    });
  });

  describe('auditTrailSchema', () => {
    it('should validate valid audit trail data', () => {
      const auditData = {
        operation: 'READ',
        resourceType: 'TourEvent',
        resourceId: 'event123',
        requestingUserId: 'user123',
        requestingUserProviderId: 'provider123',
        success: true
      };
      
      const { error, value } = auditTrailSchema.validate(auditData);
      expect(error).toBeUndefined();
      expect(value).toEqual(auditData);
    });

    it('should use default success value', () => {
      const auditData = {
        operation: 'READ',
        resourceType: 'TourEvent',
        resourceId: 'event123',
        requestingUserId: 'user123'
      };
      
      const { error, value } = auditTrailSchema.validate(auditData);
      expect(error).toBeUndefined();
      expect(value.success).toBe(true);
    });

    it('should require operation', () => {
      const { error } = auditTrailSchema.validate({
        resourceType: 'TourEvent',
        resourceId: 'event123',
        requestingUserId: 'user123'
      });
      expect(error?.details[0].message).toContain('Operation is required');
    });

    it('should require resourceType', () => {
      const { error } = auditTrailSchema.validate({
        operation: 'READ',
        resourceId: 'event123',
        requestingUserId: 'user123'
      });
      expect(error?.details[0].message).toContain('Resource type is required');
    });

    it('should require resourceId', () => {
      const { error } = auditTrailSchema.validate({
        operation: 'READ',
        resourceType: 'TourEvent',
        requestingUserId: 'user123'
      });
      expect(error?.details[0].message).toContain('Resource ID is required');
    });

    it('should require requestingUserId', () => {
      const { error } = auditTrailSchema.validate({
        operation: 'READ',
        resourceType: 'TourEvent',
        resourceId: 'event123'
      });
      expect(error?.details[0].message).toContain('Requesting user ID is required');
    });

    it('should validate field length limits', () => {
      const longString = 'a'.repeat(101);
      const { error } = auditTrailSchema.validate({
        operation: 'READ',
        resourceType: 'TourEvent',
        resourceId: longString,
        requestingUserId: 'user123'
      });
      expect(error?.details[0].message).toContain('Resource ID cannot exceed 100 characters');
    });

    it('should allow optional requestingUserProviderId', () => {
      const { error } = auditTrailSchema.validate({
        operation: 'READ',
        resourceType: 'TourEvent',
        resourceId: 'event123',
        requestingUserId: 'user123'
      });
      expect(error).toBeUndefined();
    });
  });
});