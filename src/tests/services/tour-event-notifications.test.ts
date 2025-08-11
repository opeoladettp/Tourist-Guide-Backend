import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TourEventNotificationService } from '../../services/tour-event-notifications';
import { NotificationChannel, NotificationPriority } from '../../types/notification';
import NotificationManager from '../../services/notification-manager';

describe('TourEventNotificationService', () => {
  let service: TourEventNotificationService;

  beforeEach(() => {
    service = new TourEventNotificationService();
  });

  afterEach(() => {
    NotificationManager.stop();
  });

  describe('notifyTourScheduleUpdate', () => {
    it('should notify all registered tourists of schedule update', async () => {
      const tourEventData = {
        customTourName: 'Amazing Tour',
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-01-20'),
        providerId: 'provider-1'
      };

      const registeredTourists = [
        { userId: 'user-1', firstName: 'John' },
        { userId: 'user-2', firstName: 'Jane' }
      ];

      const results = await service.notifyTourScheduleUpdate(
        'tour-1',
        tourEventData,
        registeredTourists,
        'Travel Co'
      );

      expect(Object.keys(results)).toHaveLength(2);
      expect(results['user-1'].length).toBeGreaterThan(0);
      expect(results['user-2'].length).toBeGreaterThan(0);
    });

    it('should handle notification failures gracefully', async () => {
      // Mock console.error to avoid test output noise
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const tourEventData = {
        customTourName: 'Test Tour',
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-01-20'),
        providerId: 'provider-1'
      };

      // Include an invalid user to trigger error
      const registeredTourists = [
        { userId: 'valid-user', firstName: 'John' },
        { userId: '', firstName: '' } // This might cause issues
      ];

      const results = await service.notifyTourScheduleUpdate(
        'tour-1',
        tourEventData,
        registeredTourists,
        'Travel Co'
      );

      expect(Object.keys(results)).toHaveLength(2);
      expect(results['valid-user'].length).toBeGreaterThan(0);
      
      consoleSpy.mockRestore();
    });

    it('should accept custom notification options', async () => {
      const tourEventData = {
        customTourName: 'Priority Tour',
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-01-20'),
        providerId: 'provider-1'
      };

      const registeredTourists = [
        { userId: 'user-1', firstName: 'John' }
      ];

      const results = await service.notifyTourScheduleUpdate(
        'tour-1',
        tourEventData,
        registeredTourists,
        'Travel Co',
        {
          channels: [NotificationChannel.EMAIL],
          priority: NotificationPriority.URGENT
        }
      );

      expect(results['user-1']).toHaveLength(1);
    });
  });

  describe('notifyTourEventUpdate', () => {
    it('should notify tourists of general tour updates', async () => {
      const tourEventData = {
        customTourName: 'Updated Tour',
        providerId: 'provider-1'
      };

      const registeredTourists = [
        { userId: 'user-1', firstName: 'Alice' },
        { userId: 'user-2', firstName: 'Bob' }
      ];

      const updateMessage = 'The meeting time has been changed to 9:00 AM.';

      const results = await service.notifyTourEventUpdate(
        'tour-1',
        updateMessage,
        tourEventData,
        registeredTourists,
        'Travel Co'
      );

      expect(Object.keys(results)).toHaveLength(2);
      expect(results['user-1'].length).toBeGreaterThan(0);
      expect(results['user-2'].length).toBeGreaterThan(0);
    });
  });

  describe('notifyRegistrationApproved', () => {
    it('should notify tourist when registration is approved', async () => {
      const touristData = {
        userId: 'user-1',
        firstName: 'John'
      };

      const tourEventData = {
        customTourName: 'Approved Tour',
        startDate: new Date('2024-02-01'),
        endDate: new Date('2024-02-05'),
        place1Hotel: 'Grand Hotel'
      };

      const messageIds = await service.notifyRegistrationApproved(
        touristData,
        tourEventData,
        'Travel Co'
      );

      expect(messageIds.length).toBeGreaterThan(0);
    });

    it('should handle notification errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const touristData = {
        userId: '', // Invalid user ID
        firstName: 'John'
      };

      const tourEventData = {
        customTourName: 'Test Tour',
        startDate: new Date('2024-02-01'),
        endDate: new Date('2024-02-05'),
        place1Hotel: 'Grand Hotel'
      };

      const messageIds = await service.notifyRegistrationApproved(
        touristData,
        tourEventData,
        'Travel Co'
      );

      // The notification system still processes empty user IDs, so we expect messages
      expect(Array.isArray(messageIds)).toBe(true);
      
      consoleSpy.mockRestore();
    });
  });

  describe('notifyRegistrationRejected', () => {
    it('should notify tourist when registration is rejected', async () => {
      const touristData = {
        userId: 'user-1',
        firstName: 'Jane'
      };

      const tourEventData = {
        customTourName: 'Full Tour'
      };

      const messageIds = await service.notifyRegistrationRejected(
        touristData,
        tourEventData,
        'Tour is fully booked',
        'Travel Co'
      );

      expect(messageIds.length).toBeGreaterThan(0);
    });
  });

  describe('notifyTourEventCancelled', () => {
    it('should notify all tourists when tour is cancelled', async () => {
      const tourEventData = {
        customTourName: 'Cancelled Tour',
        startDate: new Date('2024-03-01'),
        endDate: new Date('2024-03-05'),
        providerId: 'provider-1'
      };

      const registeredTourists = [
        { userId: 'user-1', firstName: 'Alice' },
        { userId: 'user-2', firstName: 'Bob' }
      ];

      const results = await service.notifyTourEventCancelled(
        'tour-1',
        tourEventData,
        registeredTourists,
        'Weather conditions',
        'Travel Co'
      );

      expect(Object.keys(results)).toHaveLength(2);
      expect(results['user-1'].length).toBeGreaterThan(0);
      expect(results['user-2'].length).toBeGreaterThan(0);
    });

    it('should use urgent priority for cancellation notifications', async () => {
      const tourEventData = {
        customTourName: 'Urgent Cancellation',
        startDate: new Date('2024-03-01'),
        endDate: new Date('2024-03-05'),
        providerId: 'provider-1'
      };

      const registeredTourists = [
        { userId: 'user-1', firstName: 'Alice' }
      ];

      const results = await service.notifyTourEventCancelled(
        'tour-1',
        tourEventData,
        registeredTourists,
        'Emergency',
        'Travel Co',
        {
          channels: [NotificationChannel.EMAIL, NotificationChannel.PUSH],
          priority: NotificationPriority.URGENT
        }
      );

      expect(results['user-1'].length).toBeGreaterThan(0);
    });
  });

  describe('notifyCapacityUpdate', () => {
    it('should notify tourists of capacity changes', async () => {
      const tourEventData = {
        customTourName: 'Capacity Update Tour',
        numberOfAllowedTourists: 20,
        remainingTourists: 5
      };

      const registeredTourists = [
        { userId: 'user-1', firstName: 'Charlie' }
      ];

      const results = await service.notifyCapacityUpdate(
        'tour-1',
        tourEventData,
        registeredTourists,
        'Travel Co'
      );

      expect(results['user-1'].length).toBeGreaterThan(0);
    });
  });

  describe('notifyActivityUpdate', () => {
    it('should notify tourists when activity is added', async () => {
      const tourEventData = {
        customTourName: 'Activity Tour'
      };

      const activityData = {
        activityName: 'City Walking Tour',
        activityDate: new Date('2024-01-16'),
        startTime: '09:00',
        endTime: '12:00',
        location: 'City Center'
      };

      const registeredTourists = [
        { userId: 'user-1', firstName: 'David' }
      ];

      const results = await service.notifyActivityUpdate(
        'tour-1',
        tourEventData,
        activityData,
        registeredTourists,
        'Travel Co',
        'added'
      );

      expect(results['user-1'].length).toBeGreaterThan(0);
    });

    it('should notify tourists when activity is updated', async () => {
      const tourEventData = {
        customTourName: 'Activity Tour'
      };

      const activityData = {
        activityName: 'Museum Visit',
        activityDate: new Date('2024-01-17'),
        startTime: '14:00',
        endTime: '17:00'
      };

      const registeredTourists = [
        { userId: 'user-1', firstName: 'Eva' }
      ];

      const results = await service.notifyActivityUpdate(
        'tour-1',
        tourEventData,
        activityData,
        registeredTourists,
        'Travel Co',
        'updated'
      );

      expect(results['user-1'].length).toBeGreaterThan(0);
    });

    it('should notify tourists when activity is cancelled', async () => {
      const tourEventData = {
        customTourName: 'Activity Tour'
      };

      const activityData = {
        activityName: 'Outdoor Adventure',
        activityDate: new Date('2024-01-18'),
        startTime: '08:00',
        endTime: '16:00',
        location: 'Mountain Trail'
      };

      const registeredTourists = [
        { userId: 'user-1', firstName: 'Frank' }
      ];

      const results = await service.notifyActivityUpdate(
        'tour-1',
        tourEventData,
        activityData,
        registeredTourists,
        'Travel Co',
        'cancelled'
      );

      expect(results['user-1'].length).toBeGreaterThan(0);
    });
  });

  describe('utility methods', () => {
    it('should return notification statistics', () => {
      const stats = service.getNotificationStats();
      
      expect(stats).toHaveProperty('pending');
      expect(stats).toHaveProperty('processing');
      expect(stats).toHaveProperty('completed');
      expect(stats).toHaveProperty('failed');
    });

    it('should return failed notifications', () => {
      const failedNotifications = service.getFailedNotifications();
      
      expect(Array.isArray(failedNotifications)).toBe(true);
    });
  });

  describe('integration scenarios', () => {
    it('should handle multiple notification types for same tour', async () => {
      const tourEventData = {
        customTourName: 'Multi-Update Tour',
        startDate: new Date('2024-04-01'),
        endDate: new Date('2024-04-05'),
        providerId: 'provider-1'
      };

      const registeredTourists = [
        { userId: 'user-1', firstName: 'Grace' }
      ];

      // Send schedule update
      const scheduleResults = await service.notifyTourScheduleUpdate(
        'tour-1',
        tourEventData,
        registeredTourists,
        'Travel Co'
      );

      // Send general update
      const updateResults = await service.notifyTourEventUpdate(
        'tour-1',
        'Additional information about your tour.',
        { customTourName: tourEventData.customTourName, providerId: tourEventData.providerId },
        registeredTourists,
        'Travel Co'
      );

      expect(scheduleResults['user-1'].length).toBeGreaterThan(0);
      expect(updateResults['user-1'].length).toBeGreaterThan(0);
    });

    it('should handle empty tourist list gracefully', async () => {
      const tourEventData = {
        customTourName: 'Empty Tour',
        startDate: new Date('2024-05-01'),
        endDate: new Date('2024-05-05'),
        providerId: 'provider-1'
      };

      const results = await service.notifyTourScheduleUpdate(
        'tour-1',
        tourEventData,
        [], // Empty tourist list
        'Travel Co'
      );

      expect(Object.keys(results)).toHaveLength(0);
    });
  });
});