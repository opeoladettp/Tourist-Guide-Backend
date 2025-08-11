import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ActivityTypeService } from '../../services/activity-type';
import { UserType } from '../../types/user';

// Mock PrismaClient
const mockPrisma = {
  activityType: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  },
  activity: {
    findFirst: vi.fn(),
    count: vi.fn()
  }
};

describe('ActivityTypeService', () => {
  let activityTypeService: ActivityTypeService;

  beforeEach(() => {
    vi.clearAllMocks();
    activityTypeService = new ActivityTypeService(mockPrisma as any);
  });

  describe('createActivityType', () => {
    it('should create activity type as system admin', async () => {
      const input = {
        typeName: 'Test Activity',
        description: 'Test description',
        isDefault: true,
        isActive: true
      };

      const mockCreatedType = {
        activityTypeId: 'type-123',
        ...input,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.activityType.findUnique.mockResolvedValue(null);
      mockPrisma.activityType.create.mockResolvedValue(mockCreatedType);

      const result = await activityTypeService.createActivityType(
        input,
        'admin-123',
        UserType.SYSTEM_ADMIN
      );

      expect(mockPrisma.activityType.findUnique).toHaveBeenCalledWith({
        where: { typeName: input.typeName }
      });
      expect(mockPrisma.activityType.create).toHaveBeenCalledWith({
        data: {
          typeName: input.typeName,
          description: input.description,
          isDefault: input.isDefault,
          isActive: input.isActive
        }
      });
      expect(result).toEqual(mockCreatedType);
    });

    it('should throw error for non-system admin', async () => {
      const input = {
        typeName: 'Test Activity'
      };

      await expect(
        activityTypeService.createActivityType(
          input,
          'user-123',
          UserType.PROVIDER_ADMIN
        )
      ).rejects.toThrow('Only System Administrators can create activity types');
    });

    it('should throw error for duplicate type name', async () => {
      const input = {
        typeName: 'Existing Activity'
      };

      const existingType = {
        activityTypeId: 'existing-123',
        typeName: 'Existing Activity'
      };

      mockPrisma.activityType.findUnique.mockResolvedValue(existingType);

      await expect(
        activityTypeService.createActivityType(
          input,
          'admin-123',
          UserType.SYSTEM_ADMIN
        )
      ).rejects.toThrow('Activity type with this name already exists');
    });
  });

  describe('getActivityTypeById', () => {
    it('should get activity type by ID', async () => {
      const mockType = {
        activityTypeId: 'type-123',
        typeName: 'Test Activity',
        description: 'Test description',
        isDefault: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.activityType.findUnique.mockResolvedValue(mockType);

      const result = await activityTypeService.getActivityTypeById(
        'type-123',
        'user-123',
        UserType.PROVIDER_ADMIN
      );

      expect(mockPrisma.activityType.findUnique).toHaveBeenCalledWith({
        where: { activityTypeId: 'type-123' }
      });
      expect(result).toEqual(mockType);
    });

    it('should return null for non-existent type', async () => {
      mockPrisma.activityType.findUnique.mockResolvedValue(null);

      const result = await activityTypeService.getActivityTypeById(
        'non-existent',
        'user-123',
        UserType.PROVIDER_ADMIN
      );

      expect(result).toBeNull();
    });
  });

  describe('getActivityTypes', () => {
    it('should get all active activity types', async () => {
      const mockTypes = [
        {
          activityTypeId: 'type-1',
          typeName: 'Transportation',
          isDefault: true,
          isActive: true
        },
        {
          activityTypeId: 'type-2',
          typeName: 'Custom Activity',
          isDefault: false,
          isActive: true
        }
      ];

      mockPrisma.activityType.findMany.mockResolvedValue(mockTypes);

      const result = await activityTypeService.getActivityTypes(
        'user-123',
        UserType.PROVIDER_ADMIN,
        true
      );

      expect(mockPrisma.activityType.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: [
          { isDefault: 'desc' },
          { typeName: 'asc' }
        ]
      });
      expect(result).toEqual(mockTypes);
    });

    it('should get all activity types including inactive', async () => {
      const mockTypes = [
        {
          activityTypeId: 'type-1',
          typeName: 'Active Type',
          isActive: true
        },
        {
          activityTypeId: 'type-2',
          typeName: 'Inactive Type',
          isActive: false
        }
      ];

      mockPrisma.activityType.findMany.mockResolvedValue(mockTypes);

      const result = await activityTypeService.getActivityTypes(
        'user-123',
        UserType.PROVIDER_ADMIN,
        false
      );

      expect(mockPrisma.activityType.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: [
          { isDefault: 'desc' },
          { typeName: 'asc' }
        ]
      });
      expect(result).toEqual(mockTypes);
    });
  });

  describe('updateActivityType', () => {
    it('should update activity type as system admin', async () => {
      const existingType = {
        activityTypeId: 'type-123',
        typeName: 'Old Name',
        description: 'Old description',
        isDefault: true,
        isActive: true
      };

      const updateInput = {
        typeName: 'New Name',
        description: 'New description'
      };

      const updatedType = {
        ...existingType,
        ...updateInput,
        updatedAt: new Date()
      };

      mockPrisma.activityType.findUnique
        .mockResolvedValueOnce(existingType) // First call for existence check
        .mockResolvedValueOnce(null); // Second call for name conflict check
      mockPrisma.activityType.update.mockResolvedValue(updatedType);

      const result = await activityTypeService.updateActivityType(
        'type-123',
        updateInput,
        'admin-123',
        UserType.SYSTEM_ADMIN
      );

      expect(mockPrisma.activityType.update).toHaveBeenCalledWith({
        where: { activityTypeId: 'type-123' },
        data: {
          typeName: updateInput.typeName,
          description: updateInput.description,
          isDefault: existingType.isDefault,
          isActive: existingType.isActive
        }
      });
      expect(result).toEqual(updatedType);
    });

    it('should throw error for non-system admin', async () => {
      const updateInput = {
        typeName: 'New Name'
      };

      await expect(
        activityTypeService.updateActivityType(
          'type-123',
          updateInput,
          'user-123',
          UserType.PROVIDER_ADMIN
        )
      ).rejects.toThrow('Only System Administrators can update activity types');
    });

    it('should throw error for non-existent type', async () => {
      const updateInput = {
        typeName: 'New Name'
      };

      mockPrisma.activityType.findUnique.mockResolvedValue(null);

      await expect(
        activityTypeService.updateActivityType(
          'non-existent',
          updateInput,
          'admin-123',
          UserType.SYSTEM_ADMIN
        )
      ).rejects.toThrow('Activity type not found');
    });
  });

  describe('deleteActivityType', () => {
    it('should delete activity type when not in use', async () => {
      const existingType = {
        activityTypeId: 'type-123',
        typeName: 'Test Activity',
        isActive: true
      };

      mockPrisma.activityType.findUnique.mockResolvedValue(existingType);
      mockPrisma.activity.findFirst.mockResolvedValue(null);
      mockPrisma.activityType.delete.mockResolvedValue(existingType);

      await activityTypeService.deleteActivityType(
        'type-123',
        'admin-123',
        UserType.SYSTEM_ADMIN
      );

      expect(mockPrisma.activity.findFirst).toHaveBeenCalledWith({
        where: { activityType: existingType.typeName }
      });
      expect(mockPrisma.activityType.delete).toHaveBeenCalledWith({
        where: { activityTypeId: 'type-123' }
      });
    });

    it('should throw error when activity type is in use', async () => {
      const existingType = {
        activityTypeId: 'type-123',
        typeName: 'Test Activity',
        isActive: true
      };

      const activityUsingType = {
        activityId: 'activity-123',
        activityType: 'Test Activity'
      };

      mockPrisma.activityType.findUnique.mockResolvedValue(existingType);
      mockPrisma.activity.findFirst.mockResolvedValue(activityUsingType);

      await expect(
        activityTypeService.deleteActivityType(
          'type-123',
          'admin-123',
          UserType.SYSTEM_ADMIN
        )
      ).rejects.toThrow('Cannot delete activity type that is being used in activities');
    });

    it('should throw error for non-system admin', async () => {
      await expect(
        activityTypeService.deleteActivityType(
          'type-123',
          'user-123',
          UserType.PROVIDER_ADMIN
        )
      ).rejects.toThrow('Only System Administrators can delete activity types');
    });
  });

  describe('getDefaultActivityTypes', () => {
    it('should get default activity type names', async () => {
      const mockTypes = [
        { typeName: 'Transportation' },
        { typeName: 'Religious Visit' },
        { typeName: 'Sightseeing' }
      ];

      mockPrisma.activityType.findMany.mockResolvedValue(mockTypes);

      const result = await activityTypeService.getDefaultActivityTypes();

      expect(mockPrisma.activityType.findMany).toHaveBeenCalledWith({
        where: {
          isDefault: true,
          isActive: true
        },
        select: {
          typeName: true
        },
        orderBy: {
          typeName: 'asc'
        }
      });
      expect(result).toEqual(['Transportation', 'Religious Visit', 'Sightseeing']);
    });
  });

  describe('checkSchedulingConflicts', () => {
    it('should detect scheduling conflicts', async () => {
      const conflictingActivity = {
        activityId: 'activity-123',
        startTime: '10:30',
        endTime: '12:30'
      };

      mockPrisma.activity.findFirst.mockResolvedValue(conflictingActivity);

      const result = await activityTypeService.checkSchedulingConflicts(
        'tour-123',
        new Date('2024-06-01'),
        '10:00',
        '11:00'
      );

      expect(result).toBe(true);
    });

    it('should not detect conflicts when none exist', async () => {
      mockPrisma.activity.findFirst.mockResolvedValue(null);

      const result = await activityTypeService.checkSchedulingConflicts(
        'tour-123',
        new Date('2024-06-01'),
        '10:00',
        '11:00'
      );

      expect(result).toBe(false);
    });
  });

  describe('getActivityTypeStatistics', () => {
    it('should get activity type statistics for system admin', async () => {
      const mockTypes = [
        { typeName: 'Transportation', isDefault: true },
        { typeName: 'Custom Activity', isDefault: false }
      ];

      mockPrisma.activityType.findMany.mockResolvedValue(mockTypes);
      mockPrisma.activity.count
        .mockResolvedValueOnce(5) // Transportation count
        .mockResolvedValueOnce(2); // Custom Activity count

      const result = await activityTypeService.getActivityTypeStatistics(
        'admin-123',
        UserType.SYSTEM_ADMIN
      );

      expect(result).toEqual([
        { typeName: 'Transportation', count: 5, isDefault: true },
        { typeName: 'Custom Activity', count: 2, isDefault: false }
      ]);
    });

    it('should throw error for non-system admin', async () => {
      await expect(
        activityTypeService.getActivityTypeStatistics(
          'user-123',
          UserType.PROVIDER_ADMIN
        )
      ).rejects.toThrow('Only System Administrators can view activity type statistics');
    });
  });
});