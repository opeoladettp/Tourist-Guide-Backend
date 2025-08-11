import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '../../generated/prisma';
import { ActivityService } from '../../services/activity';
import { UserType } from '../../types/user';
import { CreateActivityInput, UpdateActivityInput } from '../../types/activity';

// Mock Prisma Client
const mockPrisma = {
  activity: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    createMany: vi.fn(),
  },
  customTourEvent: {
    findUnique: vi.fn(),
  },
} as unknown as PrismaClient;

describe('ActivityService', () => {
  let activityService: ActivityService;
  const testUserId = 'user123';
  const testProviderId = 'provider123';
  const testTourEventId = 'tour123';
  const testTouristId = 'tourist123';

  beforeEach(() => {
    activityService = new ActivityService(mockPrisma);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('createActivity', () => {
    it('should create activity successfully for provider admin', async () => {
      const input: CreateActivityInput = {
        tourEventId: testTourEventId,
        activityDate: new Date('2024-06-05'),
        startTime: '09:00',
        endTime: '12:00',
        activityName: 'Visit Kaaba',
        description: 'First visit to the holy Kaaba',
        location: 'Masjid al-Haram',
        activityType: 'Religious Visit',
        isOptional: false
      };

      const mockTourEvent = {
        tourEventId: testTourEventId,
        providerId: testProviderId,
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-06-15'),
        provider: { providerId: testProviderId }
      };

      const mockActivity = {
        activityId: 'activity123',
        ...input,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.customTourEvent.findUnique = vi.fn().mockResolvedValue(mockTourEvent);
      mockPrisma.activity.findMany = vi.fn().mockResolvedValue([]); // No existing activities
      mockPrisma.activity.create = vi.fn().mockResolvedValue(mockActivity);

      const activity = await activityService.createActivity(
        input,
        testUserId,
        UserType.PROVIDER_ADMIN,
        testProviderId
      );

      expect(activity).toBeDefined();
      expect(activity.activityName).toBe('Visit Kaaba');
      expect(activity.tourEventId).toBe(testTourEventId);
      expect(activity.startTime).toBe('09:00');
      expect(activity.endTime).toBe('12:00');
    });

    it('should throw error for invalid time order', async () => {
      const input: CreateActivityInput = {
        tourEventId: testTourEventId,
        activityDate: new Date('2024-06-05'),
        startTime: '12:00',
        endTime: '09:00', // End time before start time
        activityName: 'Invalid Activity',
        activityType: 'Other'
      };

      await expect(
        activityService.createActivity(input, testUserId, UserType.PROVIDER_ADMIN, testProviderId)
      ).rejects.toThrow('Start time must be before end time');
    });

    it('should throw error for tourist trying to create activity', async () => {
      const input: CreateActivityInput = {
        tourEventId: testTourEventId,
        activityDate: new Date('2024-06-05'),
        startTime: '09:00',
        endTime: '12:00',
        activityName: 'Tourist Activity',
        activityType: 'Other'
      };

      // Mock the tour event to exist so we can test the tourist permission check
      const mockTourEvent = {
        tourEventId: testTourEventId,
        providerId: testProviderId,
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-06-15'),
        provider: { providerId: testProviderId }
      };

      mockPrisma.customTourEvent.findUnique = vi.fn().mockResolvedValue(mockTourEvent);

      await expect(
        activityService.createActivity(input, testTouristId, UserType.TOURIST, testProviderId)
      ).rejects.toThrow('Tourists cannot create activities');
    });

    it('should throw error for activity outside tour event date range', async () => {
      const input: CreateActivityInput = {
        tourEventId: testTourEventId,
        activityDate: new Date('2024-05-01'), // Before tour start date
        startTime: '09:00',
        endTime: '12:00',
        activityName: 'Early Activity',
        activityType: 'Other'
      };

      const mockTourEvent = {
        tourEventId: testTourEventId,
        providerId: testProviderId,
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-06-15'),
        provider: { providerId: testProviderId }
      };

      mockPrisma.customTourEvent.findUnique = vi.fn().mockResolvedValue(mockTourEvent);
      mockPrisma.activity.findMany = vi.fn().mockResolvedValue([]);

      await expect(
        activityService.createActivity(input, testUserId, UserType.PROVIDER_ADMIN, testProviderId)
      ).rejects.toThrow('Activity date must be within tour event date range');
    });

    it('should throw error for conflicting activities', async () => {
      const conflictingInput: CreateActivityInput = {
        tourEventId: testTourEventId,
        activityDate: new Date('2024-06-05'),
        startTime: '10:00', // Overlaps with existing activity
        endTime: '13:00',
        activityName: 'Conflicting Activity',
        activityType: 'Other'
      };

      const mockTourEvent = {
        tourEventId: testTourEventId,
        providerId: testProviderId,
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-06-15'),
        provider: { providerId: testProviderId }
      };

      const existingActivities = [{
        activityDate: new Date('2024-06-05'),
        startTime: '09:00',
        endTime: '12:00'
      }];

      mockPrisma.customTourEvent.findUnique = vi.fn().mockResolvedValue(mockTourEvent);
      mockPrisma.activity.findMany = vi.fn().mockResolvedValue(existingActivities);

      await expect(
        activityService.createActivity(conflictingInput, testUserId, UserType.PROVIDER_ADMIN, testProviderId)
      ).rejects.toThrow('Activity conflicts with existing activity');
    });
  });

  describe('getActivityById', () => {
    const testActivityId = 'activity123';

    it('should return activity for provider admin', async () => {
      const mockActivity = {
        activityId: testActivityId,
        activityName: 'Test Activity',
        tourEvent: {
          providerId: testProviderId,
          provider: { providerId: testProviderId },
          registrations: []
        }
      };

      mockPrisma.activity.findUnique = vi.fn().mockResolvedValue(mockActivity);

      const activity = await activityService.getActivityById(
        testActivityId,
        testUserId,
        UserType.PROVIDER_ADMIN,
        testProviderId
      );

      expect(activity).toBeDefined();
      expect(activity!.activityName).toBe('Test Activity');
    });

    it('should return activity for registered tourist', async () => {
      const mockActivity = {
        activityId: testActivityId,
        activityName: 'Test Activity',
        tourEvent: {
          providerId: testProviderId,
          provider: { providerId: testProviderId },
          registrations: [{ touristUserId: testTouristId }]
        }
      };

      mockPrisma.activity.findUnique = vi.fn().mockResolvedValue(mockActivity);

      const activity = await activityService.getActivityById(
        testActivityId,
        testTouristId,
        UserType.TOURIST
      );

      expect(activity).toBeDefined();
      expect(activity!.activityName).toBe('Test Activity');
    });

    it('should throw error for unregistered tourist', async () => {
      const mockActivity = {
        activityId: testActivityId,
        activityName: 'Test Activity',
        tourEvent: {
          providerId: testProviderId,
          provider: { providerId: testProviderId },
          registrations: [] // No registrations
        }
      };

      mockPrisma.activity.findUnique = vi.fn().mockResolvedValue(mockActivity);

      await expect(
        activityService.getActivityById(testActivityId, 'unregisteredTourist', UserType.TOURIST)
      ).rejects.toThrow('Insufficient permissions');
    });
  });

  describe('getTourEventActivities', () => {
    it('should return all activities for tour event ordered by date and time', async () => {
      const mockTourEvent = {
        tourEventId: testTourEventId,
        providerId: testProviderId,
        provider: { providerId: testProviderId },
        registrations: []
      };

      const mockActivities = [
        { activityName: 'Morning Activity', activityDate: new Date('2024-06-05'), startTime: '09:00' },
        { activityName: 'Afternoon Activity', activityDate: new Date('2024-06-05'), startTime: '14:00' },
        { activityName: 'Next Day Activity', activityDate: new Date('2024-06-06'), startTime: '08:00' }
      ];

      mockPrisma.customTourEvent.findUnique = vi.fn().mockResolvedValue(mockTourEvent);
      mockPrisma.activity.findMany = vi.fn().mockResolvedValue(mockActivities);

      const activities = await activityService.getTourEventActivities(
        testTourEventId,
        testUserId,
        UserType.PROVIDER_ADMIN,
        testProviderId
      );

      expect(activities).toHaveLength(3);
      expect(activities[0].activityName).toBe('Morning Activity');
    });

    it('should return activities for registered tourist', async () => {
      const mockTourEvent = {
        tourEventId: testTourEventId,
        providerId: testProviderId,
        provider: { providerId: testProviderId },
        registrations: [{ touristUserId: testTouristId }]
      };

      const mockActivities = [{ activityName: 'Test Activity' }];

      mockPrisma.customTourEvent.findUnique = vi.fn().mockResolvedValue(mockTourEvent);
      mockPrisma.activity.findMany = vi.fn().mockResolvedValue(mockActivities);

      const activities = await activityService.getTourEventActivities(
        testTourEventId,
        testTouristId,
        UserType.TOURIST
      );

      expect(activities).toHaveLength(1);
    });
  });

  describe('updateActivity', () => {
    const testActivityId = 'activity123';

    it('should update activity successfully', async () => {
      const updateInput: UpdateActivityInput = {
        activityName: 'Updated Activity',
        description: 'Updated description',
        startTime: '10:00',
        endTime: '13:00'
      };

      const mockExistingActivity = {
        activityId: testActivityId,
        activityName: 'Original Activity',
        startTime: '09:00',
        endTime: '12:00',
        activityDate: new Date('2024-06-05'),
        tourEventId: testTourEventId,
        tourEvent: {
          providerId: testProviderId,
          provider: { providerId: testProviderId },
          registrations: []
        }
      };

      const mockUpdatedActivity = {
        ...mockExistingActivity,
        activityName: 'Updated Activity',
        description: 'Updated description',
        startTime: '10:00',
        endTime: '13:00'
      };

      mockPrisma.activity.findUnique = vi.fn().mockResolvedValue(mockExistingActivity);
      mockPrisma.activity.findMany = vi.fn().mockResolvedValue([]); // No conflicts
      mockPrisma.activity.update = vi.fn().mockResolvedValue(mockUpdatedActivity);

      const updatedActivity = await activityService.updateActivity(
        testActivityId,
        updateInput,
        testUserId,
        UserType.PROVIDER_ADMIN,
        testProviderId
      );

      expect(updatedActivity.activityName).toBe('Updated Activity');
      expect(updatedActivity.description).toBe('Updated description');
    });

    it('should throw error for tourist trying to update', async () => {
      const updateInput: UpdateActivityInput = {
        activityName: 'Tourist Update'
      };

      const mockActivity = {
        activityId: testActivityId,
        tourEvent: {
          providerId: testProviderId,
          registrations: []
        }
      };

      mockPrisma.activity.findUnique = vi.fn().mockResolvedValue(mockActivity);

      await expect(
        activityService.updateActivity(testActivityId, updateInput, testTouristId, UserType.TOURIST)
      ).rejects.toThrow('Insufficient permissions');
    });
  });

  describe('deleteActivity', () => {
    const testActivityId = 'activity123';

    it('should delete activity successfully', async () => {
      const mockActivity = {
        activityId: testActivityId,
        tourEvent: {
          providerId: testProviderId,
          provider: { providerId: testProviderId },
          registrations: []
        }
      };

      mockPrisma.activity.findUnique = vi.fn().mockResolvedValue(mockActivity);
      mockPrisma.activity.delete = vi.fn().mockResolvedValue(mockActivity);

      await activityService.deleteActivity(
        testActivityId,
        testUserId,
        UserType.PROVIDER_ADMIN,
        testProviderId
      );

      expect(mockPrisma.activity.delete).toHaveBeenCalledWith({
        where: { activityId: testActivityId }
      });
    });

    it('should throw error for tourist trying to delete', async () => {
      const mockActivity = {
        activityId: testActivityId,
        tourEvent: {
          providerId: testProviderId,
          registrations: []
        }
      };

      mockPrisma.activity.findUnique = vi.fn().mockResolvedValue(mockActivity);

      await expect(
        activityService.deleteActivity(testActivityId, testTouristId, UserType.TOURIST)
      ).rejects.toThrow('Insufficient permissions');
    });
  });

  describe('getDailySchedule', () => {
    it('should return daily schedule with calendar formatting', async () => {
      const mockTourEvent = {
        tourEventId: testTourEventId,
        providerId: testProviderId,
        provider: { providerId: testProviderId },
        registrations: []
      };

      const mockActivities = [
        { activityName: 'Morning Prayer', startTime: '09:00' },
        { activityName: 'Afternoon Tour', startTime: '14:00' }
      ];

      mockPrisma.customTourEvent.findUnique = vi.fn().mockResolvedValue(mockTourEvent);
      mockPrisma.activity.findMany = vi.fn().mockResolvedValue(mockActivities);

      const schedule = await activityService.getDailySchedule(
        testTourEventId,
        new Date('2024-06-05'),
        testUserId,
        UserType.PROVIDER_ADMIN,
        testProviderId,
        true
      );

      expect(schedule.activities).toHaveLength(2);
      expect(schedule.calendarDate).toBeDefined();
      expect(schedule.calendarDate.gregorian).toBeInstanceOf(Date);
      expect(schedule.calendarDate.islamic).toBeDefined();
    });
  });

  describe('bulkCreateActivities', () => {
    it('should throw error for conflicting activities in batch', async () => {
      const activities: CreateActivityInput[] = [
        {
          tourEventId: testTourEventId,
          activityDate: new Date('2024-06-05'),
          startTime: '09:00',
          endTime: '12:00',
          activityName: 'First Activity',
          activityType: 'Religious Visit'
        },
        {
          tourEventId: testTourEventId,
          activityDate: new Date('2024-06-05'),
          startTime: '10:00', // Conflicts with first activity
          endTime: '13:00',
          activityName: 'Conflicting Activity',
          activityType: 'Sightseeing'
        }
      ];

      await expect(
        activityService.bulkCreateActivities(activities, testUserId, UserType.PROVIDER_ADMIN, testProviderId)
      ).rejects.toThrow('Conflict between activities');
    });
  });

  describe('getDefaultActivityTypes', () => {
    it('should return default activity types', () => {
      const types = activityService.getDefaultActivityTypes();
      
      expect(types).toContain('Transportation');
      expect(types).toContain('Religious Visit');
      expect(types).toContain('Sightseeing');
      expect(types).toContain('Meal');
      expect(Array.isArray(types)).toBe(true);
    });
  });
});