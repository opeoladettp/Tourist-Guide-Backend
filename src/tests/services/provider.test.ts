import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '../../generated/prisma';
import { ProviderService } from '../../services/provider';
import { UserType } from '../../types/user';

// Mock Prisma Client
const mockPrisma = {
  provider: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  user: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  customTourEvent: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
  document: {
    findMany: vi.fn(),
  },
} as unknown as PrismaClient;

describe('ProviderService', () => {
  let providerService: ProviderService;

  beforeEach(() => {
    providerService = new ProviderService(mockPrisma);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('createProvider', () => {
    const validCreateInput = {
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

    it('should create provider with valid input (System Admin)', async () => {
      const mockProvider = {
        providerId: 'provider123',
        ...validCreateInput,
        isIsolatedInstance: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.provider.findUnique = vi.fn()
        .mockResolvedValueOnce(null) // No existing email
        .mockResolvedValueOnce(null); // No existing corp ID
      mockPrisma.provider.create = vi.fn().mockResolvedValue(mockProvider);

      const result = await providerService.createProvider(validCreateInput, UserType.SYSTEM_ADMIN);

      expect(result).toEqual(mockProvider);
      expect(mockPrisma.provider.create).toHaveBeenCalled();
    });

    it('should deny non-system admin from creating providers', async () => {
      await expect(providerService.createProvider(validCreateInput, UserType.PROVIDER_ADMIN))
        .rejects.toThrow('Insufficient permissions to create providers');
    });

    it('should throw error for duplicate email', async () => {
      mockPrisma.provider.findUnique = vi.fn().mockResolvedValue({ providerId: 'existing' });

      await expect(providerService.createProvider(validCreateInput, UserType.SYSTEM_ADMIN))
        .rejects.toThrow('Provider with this email address already exists');
    });

    it('should throw error for duplicate corporate ID', async () => {
      mockPrisma.provider.findUnique = vi.fn()
        .mockResolvedValueOnce(null) // No existing email
        .mockResolvedValueOnce({ providerId: 'existing' }); // Existing corp ID

      await expect(providerService.createProvider(validCreateInput, UserType.SYSTEM_ADMIN))
        .rejects.toThrow('Provider with this Corporate ID/Tax ID already exists');
    });

    it('should throw error for invalid input', async () => {
      const invalidInput = { ...validCreateInput, emailAddress: 'invalid-email' };

      await expect(providerService.createProvider(invalidInput, UserType.SYSTEM_ADMIN))
        .rejects.toThrow('Validation error');
    });
  });

  describe('getProviderById', () => {
    const mockProvider = {
      providerId: 'provider123',
      companyName: 'Test Company',
      emailAddress: 'test@company.com',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    it('should allow system admin to access any provider', async () => {
      mockPrisma.provider.findUnique = vi.fn().mockResolvedValue(mockProvider);

      const result = await providerService.getProviderById(
        'provider123',
        UserType.SYSTEM_ADMIN
      );

      expect(result).toEqual(mockProvider);
    });

    it('should allow provider admin to access their own provider', async () => {
      mockPrisma.provider.findUnique = vi.fn().mockResolvedValue(mockProvider);

      const result = await providerService.getProviderById(
        'provider123',
        UserType.PROVIDER_ADMIN,
        'provider123'
      );

      expect(result).toEqual(mockProvider);
    });

    it('should deny provider admin access to other providers', async () => {
      mockPrisma.provider.findUnique = vi.fn().mockResolvedValue(mockProvider);

      await expect(providerService.getProviderById(
        'provider123',
        UserType.PROVIDER_ADMIN,
        'differentProvider'
      )).rejects.toThrow('Insufficient permissions');
    });

    it('should deny tourist access to provider details', async () => {
      mockPrisma.provider.findUnique = vi.fn().mockResolvedValue(mockProvider);

      await expect(providerService.getProviderById(
        'provider123',
        UserType.TOURIST
      )).rejects.toThrow('Insufficient permissions');
    });

    it('should return null for non-existent provider', async () => {
      mockPrisma.provider.findUnique = vi.fn().mockResolvedValue(null);

      const result = await providerService.getProviderById(
        'nonexistent',
        UserType.SYSTEM_ADMIN
      );

      expect(result).toBeNull();
    });
  });

  describe('getProviders', () => {
    const mockProviders = [
      { providerId: 'provider1', companyName: 'Company 1' },
      { providerId: 'provider2', companyName: 'Company 2' }
    ];

    it('should allow system admin to get all providers', async () => {
      mockPrisma.provider.findMany = vi.fn().mockResolvedValue(mockProviders);

      const result = await providerService.getProviders(UserType.SYSTEM_ADMIN);

      expect(result).toEqual(mockProviders);
      expect(mockPrisma.provider.findMany).toHaveBeenCalledWith({
        take: 50,
        skip: 0,
        orderBy: { createdAt: 'desc' }
      });
    });

    it('should deny non-system admin access to provider list', async () => {
      await expect(providerService.getProviders(UserType.PROVIDER_ADMIN))
        .rejects.toThrow('Insufficient permissions to list providers');
    });
  });

  describe('updateProvider', () => {
    const mockProvider = {
      providerId: 'provider123',
      companyName: 'Test Company',
      emailAddress: 'test@company.com',
      country: 'US',
      addressLine1: '123 Main St',
      city: 'New York',
      stateRegion: 'NY',
      companyDescription: 'Test description',
      phoneNumber: '+1234567890',
      corpIdTaxId: 'TC123',
      isIsolatedInstance: true
    };

    it('should update provider with valid input', async () => {
      const updateInput = { companyName: 'Updated Company Name' };
      const updatedProvider = { ...mockProvider, companyName: 'Updated Company Name' };

      mockPrisma.provider.findUnique = vi.fn().mockResolvedValue(mockProvider);
      mockPrisma.provider.update = vi.fn().mockResolvedValue(updatedProvider);

      const result = await providerService.updateProvider(
        'provider123',
        updateInput,
        UserType.SYSTEM_ADMIN
      );

      expect(result).toEqual(updatedProvider);
      expect(mockPrisma.provider.update).toHaveBeenCalledWith({
        where: { providerId: 'provider123' },
        data: expect.objectContaining({ companyName: 'Updated Company Name' })
      });
    });

    it('should check email uniqueness when updating email', async () => {
      const updateInput = { emailAddress: 'new@company.com' };

      mockPrisma.provider.findUnique = vi.fn()
        .mockResolvedValueOnce(mockProvider) // Existing provider
        .mockResolvedValueOnce({ providerId: 'other' }); // Email already exists

      await expect(providerService.updateProvider(
        'provider123',
        updateInput,
        UserType.SYSTEM_ADMIN
      )).rejects.toThrow('Provider with this email address already exists');
    });
  });

  describe('getProviderUsers', () => {
    const mockUsers = [
      { userId: 'user1', firstName: 'John', lastName: 'Doe', providerId: 'provider123' },
      { userId: 'user2', firstName: 'Jane', lastName: 'Smith', providerId: 'provider123' }
    ];

    it('should allow system admin to get users from any provider', async () => {
      mockPrisma.provider.findUnique = vi.fn().mockResolvedValue({ providerId: 'provider123' });
      mockPrisma.user.findMany = vi.fn().mockResolvedValue(mockUsers);

      const result = await providerService.getProviderUsers(
        'provider123',
        UserType.SYSTEM_ADMIN
      );

      expect(result).toEqual(mockUsers);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: { providerId: 'provider123' },
        take: 50,
        skip: 0,
        orderBy: { createdAt: 'desc' },
        select: expect.objectContaining({
          userId: true,
          firstName: true,
          lastName: true,
          // passwordHash should be excluded
        })
      });
    });

    it('should allow provider admin to get users from their own provider', async () => {
      mockPrisma.provider.findUnique = vi.fn().mockResolvedValue({ providerId: 'provider123' });
      mockPrisma.user.findMany = vi.fn().mockResolvedValue(mockUsers);

      const result = await providerService.getProviderUsers(
        'provider123',
        UserType.PROVIDER_ADMIN,
        'provider123'
      );

      expect(result).toEqual(mockUsers);
    });

    it('should deny provider admin access to other provider users', async () => {
      await expect(providerService.getProviderUsers(
        'provider123',
        UserType.PROVIDER_ADMIN,
        'differentProvider'
      )).rejects.toThrow('Insufficient permissions to access users from this provider');
    });

    it('should deny tourist access to provider users', async () => {
      await expect(providerService.getProviderUsers(
        'provider123',
        UserType.TOURIST
      )).rejects.toThrow('Insufficient permissions to access provider users');
    });
  });

  describe('validateProviderAccess', () => {
    it('should allow system admin access to any provider', async () => {
      const result = await providerService.validateProviderAccess(
        'provider123',
        UserType.SYSTEM_ADMIN
      );
      expect(result).toBe(true);
    });

    it('should allow provider admin access to their own provider', async () => {
      const result = await providerService.validateProviderAccess(
        'provider123',
        UserType.PROVIDER_ADMIN,
        'provider123'
      );
      expect(result).toBe(true);
    });

    it('should deny provider admin access to other providers', async () => {
      const result = await providerService.validateProviderAccess(
        'provider123',
        UserType.PROVIDER_ADMIN,
        'differentProvider'
      );
      expect(result).toBe(false);
    });

    it('should allow tourist access to their own provider', async () => {
      const result = await providerService.validateProviderAccess(
        'provider123',
        UserType.TOURIST,
        'provider123'
      );
      expect(result).toBe(true);
    });
  });

  describe('getProviderStats', () => {
    it('should return provider statistics for system admin', async () => {
      mockPrisma.provider.findUnique = vi.fn().mockResolvedValue({ providerId: 'provider123' });
      mockPrisma.user.count = vi.fn()
        .mockResolvedValueOnce(10) // Total users
        .mockResolvedValueOnce(8);  // Active users
      mockPrisma.customTourEvent.count = vi.fn().mockResolvedValue(5); // Total tour events

      const result = await providerService.getProviderStats('provider123', UserType.SYSTEM_ADMIN);

      expect(result).toEqual({
        totalUsers: 10,
        activeUsers: 8,
        totalTourEvents: 5,
        activeTourEvents: 5
      });
    });

    it('should deny non-system admin access to provider statistics', async () => {
      await expect(providerService.getProviderStats('provider123', UserType.PROVIDER_ADMIN))
        .rejects.toThrow('Insufficient permissions to access provider statistics');
    });

    it('should throw error for non-existent provider', async () => {
      mockPrisma.provider.findUnique = vi.fn().mockResolvedValue(null);

      await expect(providerService.getProviderStats('nonexistent', UserType.SYSTEM_ADMIN))
        .rejects.toThrow('Provider not found');
    });
  });

  describe('getProviderTourEvents', () => {
    const mockTourEvents = [
      {
        tourEventId: 'event1',
        providerId: 'provider123',
        customTourName: 'Test Tour',
        template: { templateName: 'Template 1', type: 'Cultural' },
        registrations: []
      }
    ];

    it('should allow system admin to get tour events from any provider', async () => {
      mockPrisma.provider.findUnique = vi.fn().mockResolvedValue({ providerId: 'provider123' });
      mockPrisma.customTourEvent.findMany = vi.fn().mockResolvedValue(mockTourEvents);

      const result = await providerService.getProviderTourEvents(
        'provider123',
        UserType.SYSTEM_ADMIN
      );

      expect(result).toEqual(mockTourEvents);
      expect(mockPrisma.customTourEvent.findMany).toHaveBeenCalledWith({
        where: { providerId: 'provider123' },
        take: 50,
        skip: 0,
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object)
      });
    });

    it('should allow provider admin to get tour events from their own provider', async () => {
      mockPrisma.provider.findUnique = vi.fn().mockResolvedValue({ providerId: 'provider123' });
      mockPrisma.customTourEvent.findMany = vi.fn().mockResolvedValue(mockTourEvents);

      const result = await providerService.getProviderTourEvents(
        'provider123',
        UserType.PROVIDER_ADMIN,
        'provider123'
      );

      expect(result).toEqual(mockTourEvents);
    });

    it('should deny provider admin access to other provider tour events', async () => {
      await expect(providerService.getProviderTourEvents(
        'provider123',
        UserType.PROVIDER_ADMIN,
        'differentProvider'
      )).rejects.toThrow('Insufficient permissions to access tour events for this provider');
    });
  });

  describe('getProviderDocuments', () => {
    const mockDocuments = [
      {
        documentId: 'doc1',
        fileName: 'passport.pdf',
        type: 'PASSPORT',
        user: { userId: 'user1', firstName: 'John', lastName: 'Doe' }
      }
    ];

    it('should allow system admin to get documents from any provider', async () => {
      mockPrisma.provider.findUnique = vi.fn().mockResolvedValue({ providerId: 'provider123' });
      mockPrisma.document.findMany = vi.fn().mockResolvedValue(mockDocuments);

      const result = await providerService.getProviderDocuments(
        'provider123',
        UserType.SYSTEM_ADMIN
      );

      expect(result).toEqual(mockDocuments);
      expect(mockPrisma.document.findMany).toHaveBeenCalledWith({
        where: { user: { providerId: 'provider123' } },
        take: 50,
        skip: 0,
        orderBy: { uploadDate: 'desc' },
        include: expect.any(Object)
      });
    });

    it('should allow provider admin to get documents from their own provider', async () => {
      mockPrisma.provider.findUnique = vi.fn().mockResolvedValue({ providerId: 'provider123' });
      mockPrisma.document.findMany = vi.fn().mockResolvedValue(mockDocuments);

      const result = await providerService.getProviderDocuments(
        'provider123',
        UserType.PROVIDER_ADMIN,
        'provider123'
      );

      expect(result).toEqual(mockDocuments);
    });

    it('should deny provider admin access to other provider documents', async () => {
      await expect(providerService.getProviderDocuments(
        'provider123',
        UserType.PROVIDER_ADMIN,
        'differentProvider'
      )).rejects.toThrow('Insufficient permissions to access documents for this provider');
    });
  });

  describe('isProviderIsolated', () => {
    it('should return true for isolated provider', async () => {
      mockPrisma.provider.findUnique = vi.fn().mockResolvedValue({ isIsolatedInstance: true });

      const result = await providerService.isProviderIsolated('provider123');

      expect(result).toBe(true);
    });

    it('should return false for non-isolated provider', async () => {
      mockPrisma.provider.findUnique = vi.fn().mockResolvedValue({ isIsolatedInstance: false });

      const result = await providerService.isProviderIsolated('provider123');

      expect(result).toBe(false);
    });

    it('should return true by default for non-existent provider', async () => {
      mockPrisma.provider.findUnique = vi.fn().mockResolvedValue(null);

      const result = await providerService.isProviderIsolated('nonexistent');

      expect(result).toBe(true);
    });
  });

  describe('getIsolatedProviders', () => {
    const mockIsolatedProviders = [
      { providerId: 'provider1', isIsolatedInstance: true },
      { providerId: 'provider2', isIsolatedInstance: true }
    ];

    it('should allow system admin to get isolated providers', async () => {
      mockPrisma.provider.findMany = vi.fn().mockResolvedValue(mockIsolatedProviders);

      const result = await providerService.getIsolatedProviders(UserType.SYSTEM_ADMIN);

      expect(result).toEqual(mockIsolatedProviders);
      expect(mockPrisma.provider.findMany).toHaveBeenCalledWith({
        where: { isIsolatedInstance: true },
        orderBy: { createdAt: 'desc' }
      });
    });

    it('should deny non-system admin access to isolated providers list', async () => {
      await expect(providerService.getIsolatedProviders(UserType.PROVIDER_ADMIN))
        .rejects.toThrow('Insufficient permissions to list isolated providers');
    });
  });

  describe('enforceProviderIsolation', () => {
    const resourceData = { providerId: 'provider123', name: 'Test Resource' };

    it('should allow system admin to create resources for any provider', async () => {
      const result = await providerService.enforceProviderIsolation(
        resourceData,
        UserType.SYSTEM_ADMIN
      );

      expect(result).toEqual(resourceData);
    });

    it('should allow provider admin to create resources for their own provider', async () => {
      const result = await providerService.enforceProviderIsolation(
        resourceData,
        UserType.PROVIDER_ADMIN,
        'provider123'
      );

      expect(result).toEqual(resourceData);
    });

    it('should deny provider admin from creating resources for other providers', async () => {
      await expect(providerService.enforceProviderIsolation(
        resourceData,
        UserType.PROVIDER_ADMIN,
        'differentProvider'
      )).rejects.toThrow('Cannot create resources for other providers - data isolation violation');
    });

    it('should deny tourist from creating provider-scoped resources', async () => {
      await expect(providerService.enforceProviderIsolation(
        resourceData,
        UserType.TOURIST,
        'provider123'
      )).rejects.toThrow('Insufficient permissions to create provider-scoped resources');
    });
  });

  describe('validateBatchProviderIsolation', () => {
    const resources = [
      { providerId: 'provider123', name: 'Resource 1' },
      { providerId: 'provider123', name: 'Resource 2' }
    ];

    it('should allow system admin to access resources from any provider', async () => {
      const mixedResources = [
        { providerId: 'provider123', name: 'Resource 1' },
        { providerId: 'provider456', name: 'Resource 2' }
      ];

      const result = await providerService.validateBatchProviderIsolation(
        mixedResources,
        UserType.SYSTEM_ADMIN
      );

      expect(result).toEqual(mixedResources);
    });

    it('should allow provider admin to access resources from their own provider', async () => {
      const result = await providerService.validateBatchProviderIsolation(
        resources,
        UserType.PROVIDER_ADMIN,
        'provider123'
      );

      expect(result).toEqual(resources);
    });

    it('should deny provider admin access to mixed provider resources', async () => {
      const mixedResources = [
        { providerId: 'provider123', name: 'Resource 1' },
        { providerId: 'provider456', name: 'Resource 2' }
      ];

      await expect(providerService.validateBatchProviderIsolation(
        mixedResources,
        UserType.PROVIDER_ADMIN,
        'provider123'
      )).rejects.toThrow('Data isolation violation: 1 resources belong to other providers');
    });

    it('should handle empty resource arrays', async () => {
      const result = await providerService.validateBatchProviderIsolation(
        [],
        UserType.PROVIDER_ADMIN,
        'provider123'
      );

      expect(result).toEqual([]);
    });
  });

  describe('buildProviderScopedQuery', () => {
    const baseQuery = {
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' }
    };

    it('should not modify query for system admin', () => {
      const result = providerService.buildProviderScopedQuery(
        baseQuery,
        UserType.SYSTEM_ADMIN
      );

      expect(result).toEqual(baseQuery);
    });

    it('should add provider filter for provider admin', () => {
      const result = providerService.buildProviderScopedQuery(
        baseQuery,
        UserType.PROVIDER_ADMIN,
        'provider123'
      );

      expect(result).toEqual({
        ...baseQuery,
        where: {
          ...baseQuery.where,
          providerId: 'provider123'
        }
      });
    });

    it('should add provider filter for tourist', () => {
      const result = providerService.buildProviderScopedQuery(
        baseQuery,
        UserType.TOURIST,
        'provider123'
      );

      expect(result).toEqual({
        ...baseQuery,
        where: {
          ...baseQuery.where,
          providerId: 'provider123'
        }
      });
    });

    it('should throw error when provider ID is missing for provider admin', () => {
      expect(() => providerService.buildProviderScopedQuery(
        baseQuery,
        UserType.PROVIDER_ADMIN
      )).toThrow('Provider ID required for provider-scoped queries');
    });

    it('should throw error for invalid user type', () => {
      expect(() => providerService.buildProviderScopedQuery(
        baseQuery,
        'INVALID_TYPE' as UserType
      )).toThrow('Invalid user type for provider-scoped query');
    });
  });

  describe('auditProviderAccess', () => {
    it('should log audit entry for successful access', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await providerService.auditProviderAccess(
        'READ',
        'TourEvent',
        'event123',
        UserType.PROVIDER_ADMIN,
        'user123',
        'provider123',
        true
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[AUDIT_TRAIL]')
      );

      const logCall = consoleSpy.mock.calls[0][0];
      const auditData = JSON.parse(logCall.replace('[AUDIT_TRAIL] ', ''));
      
      expect(auditData).toMatchObject({
        operation: 'READ',
        resourceType: 'TourEvent',
        resourceId: 'event123',
        requestingUserType: UserType.PROVIDER_ADMIN,
        requestingUserId: 'user123',
        requestingUserProviderId: 'provider123',
        success: true,
        isolationLevel: 'PROVIDER_SCOPED'
      });

      consoleSpy.mockRestore();
    });

    it('should log audit entry for system admin with global isolation level', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await providerService.auditProviderAccess(
        'DELETE',
        'Provider',
        'provider123',
        UserType.SYSTEM_ADMIN,
        'admin123'
      );

      const logCall = consoleSpy.mock.calls[0][0];
      const auditData = JSON.parse(logCall.replace('[AUDIT_TRAIL] ', ''));
      
      expect(auditData.isolationLevel).toBe('GLOBAL');

      consoleSpy.mockRestore();
    });
  });

  describe('performDataIsolationHealthCheck', () => {
    it('should return comprehensive isolation health metrics', async () => {
      // Mock the database counts
      mockPrisma.provider.count = vi.fn()
        .mockResolvedValueOnce(8)  // Providers with isolation enabled
        .mockResolvedValueOnce(2); // Providers with isolation disabled

      mockPrisma.user.count = vi.fn().mockResolvedValue(1); // Users without provider
      mockPrisma.customTourEvent.count = vi.fn().mockResolvedValue(0); // Tour events without provider
      mockPrisma.document.count = vi.fn().mockResolvedValue(0); // Documents from users without provider

      const result = await providerService.performDataIsolationHealthCheck();

      expect(result).toEqual({
        providersWithIsolationEnabled: 8,
        providersWithIsolationDisabled: 2,
        usersWithoutProvider: 1,
        tourEventsWithoutProvider: 0,
        documentsFromUsersWithoutProvider: 0,
        isolationIntegrityScore: 90 // 100 - (1 violation * 10)
      });
    });

    it('should return perfect score when no isolation violations exist', async () => {
      mockPrisma.provider.count = vi.fn()
        .mockResolvedValueOnce(10) // Providers with isolation enabled
        .mockResolvedValueOnce(0);  // Providers with isolation disabled

      mockPrisma.user.count = vi.fn().mockResolvedValue(0);
      mockPrisma.customTourEvent.count = vi.fn().mockResolvedValue(0);
      mockPrisma.document.count = vi.fn().mockResolvedValue(0);

      const result = await providerService.performDataIsolationHealthCheck();

      expect(result.isolationIntegrityScore).toBe(100);
    });

    it('should handle case with no providers', async () => {
      mockPrisma.provider.count = vi.fn()
        .mockResolvedValueOnce(0) // Providers with isolation enabled
        .mockResolvedValueOnce(0); // Providers with isolation disabled

      mockPrisma.user.count = vi.fn().mockResolvedValue(0);
      mockPrisma.customTourEvent.count = vi.fn().mockResolvedValue(0);
      mockPrisma.document.count = vi.fn().mockResolvedValue(0);

      const result = await providerService.performDataIsolationHealthCheck();

      expect(result.isolationIntegrityScore).toBe(100);
    });
  });
});