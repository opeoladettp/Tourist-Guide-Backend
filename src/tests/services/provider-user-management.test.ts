import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProviderService } from '../../services/provider';
import { UserService } from '../../services/user';
import { UserType } from '../../types/user';

// Mock PrismaClient
const mockPrisma = {
  provider: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  customTourEvent: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  document: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
} as any;

describe('Provider User Management Service Tests', () => {
  let providerService: ProviderService;
  let userService: UserService;

  beforeEach(() => {
    vi.clearAllMocks();
    providerService = new ProviderService(mockPrisma);
    userService = new UserService(mockPrisma);
  });

  describe('ProviderService.getProviderUsers', () => {
    const mockProvider = {
      providerId: 'provider-1',
      companyName: 'Test Provider',
      country: 'Test Country',
      addressLine1: '123 Test St',
      city: 'Test City',
      stateRegion: 'Test State',
      companyDescription: 'Test Description',
      phoneNumber: '+1234567890',
      emailAddress: 'test@provider.com',
      corpIdTaxId: 'TEST123',
      isIsolatedInstance: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockUsers = [
      {
        userId: 'user-1',
        firstName: 'John',
        middleName: null,
        lastName: 'Doe',
        emailAddress: 'john@test.com',
        phoneNumber: '+1234567890',
        country: 'Test Country',
        userType: UserType.TOURIST,
        status: 'ACTIVE',
        passportNumber: 'P123456',
        dateOfBirth: new Date('1990-01-01'),
        gender: 'Male',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        userId: 'user-2',
        firstName: 'Jane',
        middleName: null,
        lastName: 'Smith',
        emailAddress: 'jane@test.com',
        phoneNumber: '+1234567891',
        country: 'Test Country',
        userType: UserType.PROVIDER_ADMIN,
        status: 'ACTIVE',
        passportNumber: 'P123457',
        dateOfBirth: new Date('1985-05-15'),
        gender: 'Female',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    it('should allow system admin to get users from any provider', async () => {
      mockPrisma.provider.findUnique.mockResolvedValue(mockProvider);
      mockPrisma.user.findMany.mockResolvedValue(mockUsers);

      const result = await providerService.getProviderUsers(
        'provider-1',
        UserType.SYSTEM_ADMIN,
        undefined,
        50,
        0
      );

      expect(result).toEqual(mockUsers);
      expect(mockPrisma.provider.findUnique).toHaveBeenCalledWith({
        where: { providerId: 'provider-1' }
      });
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: { providerId: 'provider-1' },
        take: 50,
        skip: 0,
        orderBy: { createdAt: 'desc' },
        select: expect.objectContaining({
          userId: true,
          firstName: true,
          lastName: true,
          emailAddress: true,
          // passwordHash should be excluded
        })
      });
    });

    it('should allow provider admin to get users from their own provider', async () => {
      mockPrisma.provider.findUnique.mockResolvedValue(mockProvider);
      mockPrisma.user.findMany.mockResolvedValue(mockUsers);

      const result = await providerService.getProviderUsers(
        'provider-1',
        UserType.PROVIDER_ADMIN,
        'provider-1',
        50,
        0
      );

      expect(result).toEqual(mockUsers);
      expect(mockPrisma.provider.findUnique).toHaveBeenCalledWith({
        where: { providerId: 'provider-1' }
      });
    });

    it('should deny provider admin access to users from other providers', async () => {
      await expect(
        providerService.getProviderUsers(
          'provider-1',
          UserType.PROVIDER_ADMIN,
          'provider-2',
          50,
          0
        )
      ).rejects.toThrow('Insufficient permissions to access users from this provider');

      expect(mockPrisma.provider.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
    });

    it('should deny tourist access to provider user lists', async () => {
      await expect(
        providerService.getProviderUsers(
          'provider-1',
          UserType.TOURIST,
          'provider-1',
          50,
          0
        )
      ).rejects.toThrow('Insufficient permissions to access provider users');

      expect(mockPrisma.provider.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
    });

    it('should return error for non-existent provider', async () => {
      mockPrisma.provider.findUnique.mockResolvedValue(null);

      await expect(
        providerService.getProviderUsers(
          'non-existent-provider',
          UserType.SYSTEM_ADMIN,
          undefined,
          50,
          0
        )
      ).rejects.toThrow('Provider not found');

      expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
    });

    it('should handle invalid provider ID by returning provider not found', async () => {
      mockPrisma.provider.findUnique.mockResolvedValue(null);

      await expect(
        providerService.getProviderUsers(
          'invalid-provider-id',
          UserType.SYSTEM_ADMIN,
          undefined,
          50,
          0
        )
      ).rejects.toThrow('Provider not found');

      expect(mockPrisma.provider.findUnique).toHaveBeenCalledWith({
        where: { providerId: 'invalid-provider-id' }
      });
    });

    it('should handle pagination parameters', async () => {
      mockPrisma.provider.findUnique.mockResolvedValue(mockProvider);
      mockPrisma.user.findMany.mockResolvedValue([mockUsers[0]]);

      const result = await providerService.getProviderUsers(
        'provider-1',
        UserType.SYSTEM_ADMIN,
        undefined,
        1,
        1
      );

      expect(result).toEqual([mockUsers[0]]);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: { providerId: 'provider-1' },
        take: 1,
        skip: 1,
        orderBy: { createdAt: 'desc' },
        select: expect.any(Object)
      });
    });

    it('should exclude passwordHash from results for security', async () => {
      mockPrisma.provider.findUnique.mockResolvedValue(mockProvider);
      mockPrisma.user.findMany.mockResolvedValue(mockUsers);

      await providerService.getProviderUsers(
        'provider-1',
        UserType.SYSTEM_ADMIN,
        undefined,
        50,
        0
      );

      const selectClause = mockPrisma.user.findMany.mock.calls[0][0].select;
      expect(selectClause.passwordHash).toBeUndefined();
      expect(selectClause.userId).toBe(true);
      expect(selectClause.firstName).toBe(true);
      expect(selectClause.emailAddress).toBe(true);
    });
  });

  describe('UserService Provider Admin Capabilities', () => {
    const mockUser = {
      userId: 'user-1',
      firstName: 'John',
      middleName: null,
      lastName: 'Doe',
      emailAddress: 'john@test.com',
      phoneNumber: '+1234567890',
      country: 'Test Country',
      passwordHash: 'hashed-password',
      userType: UserType.TOURIST,
      status: 'ACTIVE',
      passportNumber: 'P123456',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'Male',
      providerId: 'provider-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockProvider = {
      providerId: 'provider-1',
      companyName: 'Test Provider',
      country: 'Test Country',
      addressLine1: '123 Test St',
      city: 'Test City',
      stateRegion: 'Test State',
      companyDescription: 'Test Description',
      phoneNumber: '+1234567890',
      emailAddress: 'test@provider.com',
      corpIdTaxId: 'TEST123',
      isIsolatedInstance: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    describe('associateUserWithProvider', () => {
      it('should allow system admin to associate user with any provider', async () => {
        mockPrisma.provider.findUnique.mockResolvedValue(mockProvider);
        mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, providerId: null });
        mockPrisma.user.update.mockResolvedValue({ ...mockUser, providerId: 'provider-1' });

        const result = await userService.associateUserWithProvider(
          'user-1',
          'provider-1',
          'admin-1',
          UserType.SYSTEM_ADMIN,
          undefined
        );

        expect(result.providerId).toBe('provider-1');
        expect(mockPrisma.user.update).toHaveBeenCalledWith({
          where: { userId: 'user-1' },
          data: { providerId: 'provider-1' }
        });
      });

      it('should allow provider admin to associate user with their own provider', async () => {
        mockPrisma.provider.findUnique.mockResolvedValue(mockProvider);
        mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, providerId: null });
        mockPrisma.user.update.mockResolvedValue({ ...mockUser, providerId: 'provider-1' });

        const result = await userService.associateUserWithProvider(
          'user-1',
          'provider-1',
          'provider-admin-1',
          UserType.PROVIDER_ADMIN,
          'provider-1'
        );

        expect(result.providerId).toBe('provider-1');
      });

      it('should deny provider admin from associating user with other providers', async () => {
        await expect(
          userService.associateUserWithProvider(
            'user-1',
            'provider-2',
            'provider-admin-1',
            UserType.PROVIDER_ADMIN,
            'provider-1'
          )
        ).rejects.toThrow('Provider admin can only associate users with their own provider');

        expect(mockPrisma.user.update).not.toHaveBeenCalled();
      });

      it('should deny tourist from associating users with providers', async () => {
        await expect(
          userService.associateUserWithProvider(
            'user-1',
            'provider-1',
            'tourist-1',
            UserType.TOURIST,
            'provider-1'
          )
        ).rejects.toThrow('Insufficient permissions to associate users with providers');

        expect(mockPrisma.user.update).not.toHaveBeenCalled();
      });

      it('should return error for non-existent provider', async () => {
        mockPrisma.provider.findUnique.mockResolvedValue(null);

        await expect(
          userService.associateUserWithProvider(
            'user-1',
            'non-existent-provider',
            'admin-1',
            UserType.SYSTEM_ADMIN,
            undefined
          )
        ).rejects.toThrow('Provider not found');

        expect(mockPrisma.user.update).not.toHaveBeenCalled();
      });

      it('should return error for non-existent user', async () => {
        mockPrisma.provider.findUnique.mockResolvedValue(mockProvider);
        mockPrisma.user.findUnique.mockResolvedValue(null);

        await expect(
          userService.associateUserWithProvider(
            'non-existent-user',
            'provider-1',
            'admin-1',
            UserType.SYSTEM_ADMIN,
            undefined
          )
        ).rejects.toThrow('User not found');

        expect(mockPrisma.user.update).not.toHaveBeenCalled();
      });

      it('should prevent associating user already associated with another provider', async () => {
        mockPrisma.provider.findUnique.mockResolvedValue(mockProvider);
        mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, providerId: 'provider-2' });

        await expect(
          userService.associateUserWithProvider(
            'user-1',
            'provider-1',
            'admin-1',
            UserType.SYSTEM_ADMIN,
            undefined
          )
        ).rejects.toThrow('User is already associated with another provider');

        expect(mockPrisma.user.update).not.toHaveBeenCalled();
      });
    });

    describe('removeUserFromProvider', () => {
      it('should allow system admin to remove user from any provider', async () => {
        mockPrisma.user.findUnique.mockResolvedValue(mockUser);
        mockPrisma.user.update.mockResolvedValue({ ...mockUser, providerId: null });

        const result = await userService.removeUserFromProvider(
          'user-1',
          'admin-1',
          UserType.SYSTEM_ADMIN,
          undefined
        );

        expect(result.providerId).toBeNull();
        expect(mockPrisma.user.update).toHaveBeenCalledWith({
          where: { userId: 'user-1' },
          data: { providerId: null }
        });
      });

      it('should allow provider admin to remove user from their own provider', async () => {
        mockPrisma.user.findUnique.mockResolvedValue(mockUser);
        mockPrisma.user.update.mockResolvedValue({ ...mockUser, providerId: null });

        const result = await userService.removeUserFromProvider(
          'user-1',
          'provider-admin-1',
          UserType.PROVIDER_ADMIN,
          'provider-1'
        );

        expect(result.providerId).toBeNull();
      });

      it('should deny provider admin from removing user from other providers', async () => {
        mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, providerId: 'provider-2' });

        await expect(
          userService.removeUserFromProvider(
            'user-1',
            'provider-admin-1',
            UserType.PROVIDER_ADMIN,
            'provider-1'
          )
        ).rejects.toThrow('Provider admin can only remove users from their own provider');

        expect(mockPrisma.user.update).not.toHaveBeenCalled();
      });

      it('should prevent provider admin from removing themselves', async () => {
        mockPrisma.user.findUnique.mockResolvedValue({
          ...mockUser,
          userId: 'provider-admin-1',
          userType: UserType.PROVIDER_ADMIN
        });

        await expect(
          userService.removeUserFromProvider(
            'provider-admin-1',
            'provider-admin-1',
            UserType.PROVIDER_ADMIN,
            'provider-1'
          )
        ).rejects.toThrow('Provider admin cannot remove themselves from the provider');

        expect(mockPrisma.user.update).not.toHaveBeenCalled();
      });

      it('should deny tourist from removing users from providers', async () => {
        await expect(
          userService.removeUserFromProvider(
            'user-1',
            'tourist-1',
            UserType.TOURIST,
            'provider-1'
          )
        ).rejects.toThrow('Insufficient permissions to remove users from providers');

        expect(mockPrisma.user.update).not.toHaveBeenCalled();
      });
    });

    describe('getProviderUserStats', () => {
      it('should allow system admin to get stats for any provider', async () => {
        mockPrisma.provider.findUnique.mockResolvedValue(mockProvider);
        mockPrisma.user.count
          .mockResolvedValueOnce(10) // totalUsers
          .mockResolvedValueOnce(8)  // activeUsers
          .mockResolvedValueOnce(2)  // inactiveUsers
          .mockResolvedValueOnce(7)  // touristUsers
          .mockResolvedValueOnce(1); // providerAdminUsers

        const result = await userService.getProviderUserStats(
          'provider-1',
          UserType.SYSTEM_ADMIN,
          undefined
        );

        expect(result).toEqual({
          totalUsers: 10,
          activeUsers: 8,
          inactiveUsers: 2,
          touristUsers: 7,
          providerAdminUsers: 1
        });
      });

      it('should allow provider admin to get stats for their own provider', async () => {
        mockPrisma.provider.findUnique.mockResolvedValue(mockProvider);
        mockPrisma.user.count
          .mockResolvedValueOnce(5)  // totalUsers
          .mockResolvedValueOnce(4)  // activeUsers
          .mockResolvedValueOnce(1)  // inactiveUsers
          .mockResolvedValueOnce(4)  // touristUsers
          .mockResolvedValueOnce(1); // providerAdminUsers

        const result = await userService.getProviderUserStats(
          'provider-1',
          UserType.PROVIDER_ADMIN,
          'provider-1'
        );

        expect(result).toEqual({
          totalUsers: 5,
          activeUsers: 4,
          inactiveUsers: 1,
          touristUsers: 4,
          providerAdminUsers: 1
        });
      });

      it('should deny provider admin access to stats for other providers', async () => {
        await expect(
          userService.getProviderUserStats(
            'provider-2',
            UserType.PROVIDER_ADMIN,
            'provider-1'
          )
        ).rejects.toThrow('Provider admin can only access statistics for their own provider');

        expect(mockPrisma.user.count).not.toHaveBeenCalled();
      });

      it('should deny tourist access to provider stats', async () => {
        await expect(
          userService.getProviderUserStats(
            'provider-1',
            UserType.TOURIST,
            'provider-1'
          )
        ).rejects.toThrow('Insufficient permissions to access user statistics');

        expect(mockPrisma.user.count).not.toHaveBeenCalled();
      });
    });
  });

  describe('Data Isolation Validation', () => {
    it('should validate provider access correctly', async () => {
      // System admin should have access to all providers
      const systemAdminAccess = await providerService.validateProviderAccess(
        'any-provider',
        UserType.SYSTEM_ADMIN,
        undefined
      );
      expect(systemAdminAccess).toBe(true);

      // Provider admin should have access to their own provider
      const providerAdminOwnAccess = await providerService.validateProviderAccess(
        'provider-1',
        UserType.PROVIDER_ADMIN,
        'provider-1'
      );
      expect(providerAdminOwnAccess).toBe(true);

      // Provider admin should not have access to other providers
      const providerAdminOtherAccess = await providerService.validateProviderAccess(
        'provider-2',
        UserType.PROVIDER_ADMIN,
        'provider-1'
      );
      expect(providerAdminOtherAccess).toBe(false);

      // Tourist should have access to their own provider
      const touristOwnAccess = await providerService.validateProviderAccess(
        'provider-1',
        UserType.TOURIST,
        'provider-1'
      );
      expect(touristOwnAccess).toBe(true);

      // Tourist should not have access to other providers
      const touristOtherAccess = await providerService.validateProviderAccess(
        'provider-2',
        UserType.TOURIST,
        'provider-1'
      );
      expect(touristOtherAccess).toBe(false);
    });

    it('should build provider-scoped queries correctly', async () => {
      const baseQuery = { where: { status: 'ACTIVE' } };

      // System admin should see all data
      const systemAdminQuery = providerService.buildProviderScopedQuery(
        baseQuery,
        UserType.SYSTEM_ADMIN,
        undefined
      );
      expect(systemAdminQuery).toEqual(baseQuery);

      // Provider admin should see only their provider's data
      const providerAdminQuery = providerService.buildProviderScopedQuery(
        baseQuery,
        UserType.PROVIDER_ADMIN,
        'provider-1'
      );
      expect(providerAdminQuery).toEqual({
        where: {
          status: 'ACTIVE',
          providerId: 'provider-1'
        }
      });

      // Tourist should see only their provider's data
      const touristQuery = providerService.buildProviderScopedQuery(
        baseQuery,
        UserType.TOURIST,
        'provider-1'
      );
      expect(touristQuery).toEqual({
        where: {
          status: 'ACTIVE',
          providerId: 'provider-1'
        }
      });
    });

    it('should enforce provider isolation for resource creation', async () => {
      const resourceData = { providerId: 'provider-1', name: 'Test Resource' };

      // System admin can create resources for any provider
      const systemAdminResult = await providerService.enforceProviderIsolation(
        resourceData,
        UserType.SYSTEM_ADMIN,
        undefined
      );
      expect(systemAdminResult).toEqual(resourceData);

      // Provider admin can create resources for their own provider
      const providerAdminResult = await providerService.enforceProviderIsolation(
        resourceData,
        UserType.PROVIDER_ADMIN,
        'provider-1'
      );
      expect(providerAdminResult).toEqual(resourceData);

      // Provider admin cannot create resources for other providers
      await expect(
        providerService.enforceProviderIsolation(
          { ...resourceData, providerId: 'provider-2' },
          UserType.PROVIDER_ADMIN,
          'provider-1'
        )
      ).rejects.toThrow('Cannot create resources for other providers - data isolation violation');

      // Tourist cannot create provider-scoped resources
      await expect(
        providerService.enforceProviderIsolation(
          resourceData,
          UserType.TOURIST,
          'provider-1'
        )
      ).rejects.toThrow('Insufficient permissions to create provider-scoped resources');
    });
  });
});