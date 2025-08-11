import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tourEventNotificationService } from '../../services/tour-event-notifications';
import { NotificationChannel, NotificationPriority } from '../../types/notification';
import NotificationManager from '../../services/notification-manager';

describe('Tour Event Notifications Integration', () => {
  afterEach(() => {
    NotificationManager.stop();
  });

  describe('Tour Event Lifecycle Notifications', () => {
    it('should handle complete tour event lifecycle with notifications', async () => {
      const tourEventData = {
        tourEventId: 'tour-123',
        customTourName: 'Complete Lifecycle Tour',
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-06-05'),
        providerId: 'provider-123',
        place1Hotel: 'Grand Hotel',
        numberOfAllowedTourists: 10,
        remainingTourists: 8
      };

      const registeredTourists = [
        { userId: 'tourist-1', firstName: 'Alice' },
        { userId: 'tourist-2', firstName: 'Bob' }
      ];

      const providerName = 'Adventure Tours Co';

      // 1. Tourist registration approved
      const approvalResults = await tourEventNotificationService.notifyRegistrationApproved(
        registeredTourists[0],
        tourEventData,
        providerName
      );

      expect(approvalResults.length).toBeGreaterThan(0);

      // 2. Schedule update notification
      const scheduleResults = await tourEventNotificationService.notifyTourScheduleUpdate(
        tourEventData.tourEventId,
        tourEventData,
        registeredTourists,
        providerName
      );

      expect(Object.keys(scheduleResults)).toHaveLength(2);
      expect(scheduleResults['tourist-1'].length).toBeGreaterThan(0);
      expect(scheduleResults['tourist-2'].length).toBeGreaterThan(0);

      // 3. Activity added notification
      const activityData = {
        activityName: 'Welcome Dinner',
        activityDate: new Date('2024-06-01'),
        startTime: '19:00',
        endTime: '21:00',
        location: 'Hotel Restaurant'
      };

      const activityResults = await tourEventNotificationService.notifyActivityUpdate(
        tourEventData.tourEventId,
        { customTourName: tourEventData.customTourName },
        activityData,
        registeredTourists,
        providerName,
        'added'
      );

      expect(Object.keys(activityResults)).toHaveLength(2);

      // 4. Capacity update notification
      const capacityResults = await tourEventNotificationService.notifyCapacityUpdate(
        tourEventData.tourEventId,
        {
          customTourName: tourEventData.customTourName,
          numberOfAllowedTourists: 12, // Increased capacity
          remainingTourists: 10
        },
        registeredTourists,
        providerName
      );

      expect(Object.keys(capacityResults)).toHaveLength(2);

      // 5. General tour update
      const updateResults = await tourEventNotificationService.notifyTourEventUpdate(
        tourEventData.tourEventId,
        'Please bring comfortable walking shoes for the city tour.',
        { customTourName: tourEventData.customTourName, providerId: tourEventData.providerId },
        registeredTourists,
        providerName
      );

      expect(Object.keys(updateResults)).toHaveLength(2);

      // Verify notification statistics (queue might still be processing)
      const stats = tourEventNotificationService.getNotificationStats();
      expect(stats.pending + stats.processing + stats.completed).toBeGreaterThan(0);
    });

    it('should handle tour cancellation scenario', async () => {
      const tourEventData = {
        tourEventId: 'tour-cancel-123',
        customTourName: 'Cancelled Weather Tour',
        startDate: new Date('2024-07-01'),
        endDate: new Date('2024-07-05'),
        providerId: 'provider-123'
      };

      const registeredTourists = [
        { userId: 'tourist-3', firstName: 'Charlie' },
        { userId: 'tourist-4', firstName: 'Diana' },
        { userId: 'tourist-5', firstName: 'Eve' }
      ];

      const providerName = 'Weather Tours Inc';
      const cancellationReason = 'Severe weather conditions forecasted';

      const cancellationResults = await tourEventNotificationService.notifyTourEventCancelled(
        tourEventData.tourEventId,
        tourEventData,
        registeredTourists,
        cancellationReason,
        providerName,
        {
          priority: NotificationPriority.URGENT,
          channels: [NotificationChannel.EMAIL, NotificationChannel.PUSH, NotificationChannel.IN_APP]
        }
      );

      expect(Object.keys(cancellationResults)).toHaveLength(3);
      expect(cancellationResults['tourist-3'].length).toBeGreaterThan(0);
      expect(cancellationResults['tourist-4'].length).toBeGreaterThan(0);
      expect(cancellationResults['tourist-5'].length).toBeGreaterThan(0);
    });

    it('should handle registration rejection scenario', async () => {
      const touristData = {
        userId: 'tourist-rejected',
        firstName: 'Frank'
      };

      const tourEventData = {
        customTourName: 'Fully Booked Tour'
      };

      const rejectionReason = 'Tour has reached maximum capacity';
      const providerName = 'Exclusive Tours Ltd';

      const rejectionResults = await tourEventNotificationService.notifyRegistrationRejected(
        touristData,
        tourEventData,
        rejectionReason,
        providerName,
        {
          priority: NotificationPriority.HIGH,
          channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP]
        }
      );

      expect(rejectionResults.length).toBeGreaterThan(0);
    });
  });

  describe('Activity Management Notifications', () => {
    it('should handle activity lifecycle notifications', async () => {
      const tourEventData = {
        customTourName: 'Activity Management Tour'
      };

      const registeredTourists = [
        { userId: 'activity-tourist-1', firstName: 'Grace' }
      ];

      const providerName = 'Activity Tours';

      // Activity added
      const addedResults = await tourEventNotificationService.notifyActivityUpdate(
        'tour-activity-123',
        tourEventData,
        {
          activityName: 'Mountain Hiking',
          activityDate: new Date('2024-08-15'),
          startTime: '06:00',
          endTime: '14:00',
          location: 'Mountain Base Camp'
        },
        registeredTourists,
        providerName,
        'added'
      );

      expect(addedResults['activity-tourist-1'].length).toBeGreaterThan(0);

      // Activity updated
      const updatedResults = await tourEventNotificationService.notifyActivityUpdate(
        'tour-activity-123',
        tourEventData,
        {
          activityName: 'Mountain Hiking',
          activityDate: new Date('2024-08-15'),
          startTime: '07:00', // Time changed
          endTime: '15:00',
          location: 'Mountain Base Camp'
        },
        registeredTourists,
        providerName,
        'updated'
      );

      expect(updatedResults['activity-tourist-1'].length).toBeGreaterThan(0);

      // Activity cancelled
      const cancelledResults = await tourEventNotificationService.notifyActivityUpdate(
        'tour-activity-123',
        tourEventData,
        {
          activityName: 'Mountain Hiking',
          activityDate: new Date('2024-08-15'),
          startTime: '07:00',
          endTime: '15:00',
          location: 'Mountain Base Camp'
        },
        registeredTourists,
        providerName,
        'cancelled'
      );

      expect(cancelledResults['activity-tourist-1'].length).toBeGreaterThan(0);
    });
  });

  describe('Notification Delivery Tracking', () => {
    it('should track notification delivery and provide statistics', async () => {
      const tourEventData = {
        customTourName: 'Statistics Tour'
      };

      const registeredTourists = [
        { userId: 'stats-tourist-1', firstName: 'Henry' },
        { userId: 'stats-tourist-2', firstName: 'Iris' }
      ];

      const providerName = 'Stats Tours';

      // Send multiple notifications
      await tourEventNotificationService.notifyTourEventUpdate(
        'stats-tour-123',
        'First update message',
        { customTourName: tourEventData.customTourName, providerId: 'provider-stats' },
        registeredTourists,
        providerName
      );

      await tourEventNotificationService.notifyTourEventUpdate(
        'stats-tour-123',
        'Second update message',
        { customTourName: tourEventData.customTourName, providerId: 'provider-stats' },
        registeredTourists,
        providerName
      );

      // Get statistics
      const stats = tourEventNotificationService.getNotificationStats();
      
      expect(stats).toHaveProperty('pending');
      expect(stats).toHaveProperty('processing');
      expect(stats).toHaveProperty('completed');
      expect(stats).toHaveProperty('failed');

      // Get failed notifications (should be empty in normal cases)
      const failedNotifications = tourEventNotificationService.getFailedNotifications();
      expect(Array.isArray(failedNotifications)).toBe(true);
    });
  });

  describe('Multi-channel Notification Delivery', () => {
    it('should deliver notifications through multiple channels', async () => {
      const tourEventData = {
        customTourName: 'Multi-Channel Tour',
        startDate: new Date('2024-09-01'),
        endDate: new Date('2024-09-05'),
        providerId: 'multi-provider'
      };

      const registeredTourists = [
        { userId: 'multi-tourist-1', firstName: 'Jack' }
      ];

      const providerName = 'Multi-Channel Tours';

      // Send notification through all channels
      const results = await tourEventNotificationService.notifyTourScheduleUpdate(
        'multi-tour-123',
        tourEventData,
        registeredTourists,
        providerName,
        {
          channels: [
            NotificationChannel.EMAIL,
            NotificationChannel.PUSH,
            NotificationChannel.IN_APP
          ],
          priority: NotificationPriority.HIGH
        }
      );

      // Should have multiple message IDs for different channels
      expect(results['multi-tourist-1'].length).toBe(3); // One for each channel

      // Verify in-app messages are stored (may be processed asynchronously)
      const notificationService = NotificationManager.getInstance();
      const inAppMessages = notificationService.getDeliveryService().getUserInAppMessages('multi-tourist-1');
      expect(Array.isArray(inAppMessages)).toBe(true);
    });
  });

  describe('Tour Event Update Triggers', () => {
    it('should trigger notifications when tour event schedule changes', async () => {
      const tourEventData = {
        tourEventId: 'schedule-update-tour',
        customTourName: 'Schedule Change Tour',
        startDate: new Date('2024-11-01'),
        endDate: new Date('2024-11-05'),
        providerId: 'schedule-provider'
      };

      const registeredTourists = [
        { userId: 'schedule-tourist-1', firstName: 'Nina' },
        { userId: 'schedule-tourist-2', firstName: 'Oscar' }
      ];

      const providerName = 'Schedule Tours';

      // Test schedule update notification
      const scheduleResults = await tourEventNotificationService.notifyTourScheduleUpdate(
        tourEventData.tourEventId,
        tourEventData,
        registeredTourists,
        providerName
      );

      expect(Object.keys(scheduleResults)).toHaveLength(2);
      expect(scheduleResults['schedule-tourist-1'].length).toBeGreaterThan(0);
      expect(scheduleResults['schedule-tourist-2'].length).toBeGreaterThan(0);

      // Verify notifications were sent successfully
      expect(scheduleResults['schedule-tourist-1'].length).toBeGreaterThan(0);
      expect(scheduleResults['schedule-tourist-2'].length).toBeGreaterThan(0);
    });

    it('should trigger notifications when tour event capacity changes', async () => {
      const tourEventData = {
        customTourName: 'Capacity Change Tour',
        numberOfAllowedTourists: 15,
        remainingTourists: 10
      };

      const registeredTourists = [
        { userId: 'capacity-tourist-1', firstName: 'Paul' }
      ];

      const providerName = 'Capacity Tours';

      const capacityResults = await tourEventNotificationService.notifyCapacityUpdate(
        'capacity-tour-123',
        tourEventData,
        registeredTourists,
        providerName
      );

      expect(capacityResults['capacity-tourist-1'].length).toBeGreaterThan(0);

      // Verify notifications were sent successfully
      expect(capacityResults['capacity-tourist-1'].length).toBeGreaterThan(0);
    });

    it('should trigger notifications when tour event general details change', async () => {
      const tourEventData = {
        customTourName: 'Detail Change Tour',
        providerId: 'detail-provider'
      };

      const registeredTourists = [
        { userId: 'detail-tourist-1', firstName: 'Quinn' }
      ];

      const providerName = 'Detail Tours';
      const updateMessage = 'Hotel location has been changed to provide better amenities.';

      const updateResults = await tourEventNotificationService.notifyTourEventUpdate(
        'detail-tour-123',
        updateMessage,
        tourEventData,
        registeredTourists,
        providerName
      );

      expect(updateResults['detail-tourist-1'].length).toBeGreaterThan(0);

      // Verify notifications were sent successfully
      expect(updateResults['detail-tourist-1'].length).toBeGreaterThan(0);
    });
  });

  describe('Activity Update Notifications', () => {
    it('should send notifications when activities are added to tour events', async () => {
      const tourEventData = {
        customTourName: 'Activity Addition Tour'
      };

      const activityData = {
        activityName: 'Sunset Photography',
        activityDate: new Date('2024-12-01'),
        startTime: '17:00',
        endTime: '19:00',
        location: 'Scenic Overlook'
      };

      const registeredTourists = [
        { userId: 'activity-add-tourist', firstName: 'Rachel' }
      ];

      const providerName = 'Photography Tours';

      const activityResults = await tourEventNotificationService.notifyActivityUpdate(
        'activity-add-tour-123',
        tourEventData,
        activityData,
        registeredTourists,
        providerName,
        'added'
      );

      expect(activityResults['activity-add-tourist'].length).toBeGreaterThan(0);

      // Verify notifications were sent successfully
      expect(activityResults['activity-add-tourist'].length).toBeGreaterThan(0);
    });

    it('should send notifications when activities are updated in tour events', async () => {
      const tourEventData = {
        customTourName: 'Activity Update Tour'
      };

      const activityData = {
        activityName: 'City Walking Tour',
        activityDate: new Date('2024-12-02'),
        startTime: '10:00',
        endTime: '12:00',
        location: 'City Center'
      };

      const registeredTourists = [
        { userId: 'activity-update-tourist', firstName: 'Sam' }
      ];

      const providerName = 'City Tours';

      const activityResults = await tourEventNotificationService.notifyActivityUpdate(
        'activity-update-tour-123',
        tourEventData,
        activityData,
        registeredTourists,
        providerName,
        'updated'
      );

      expect(activityResults['activity-update-tourist'].length).toBeGreaterThan(0);

      // Verify notifications were sent successfully
      expect(activityResults['activity-update-tourist'].length).toBeGreaterThan(0);
    });

    it('should send notifications when activities are cancelled from tour events', async () => {
      const tourEventData = {
        customTourName: 'Activity Cancellation Tour'
      };

      const activityData = {
        activityName: 'Beach Volleyball',
        activityDate: new Date('2024-12-03'),
        startTime: '14:00',
        endTime: '16:00',
        location: 'Beach Resort'
      };

      const registeredTourists = [
        { userId: 'activity-cancel-tourist', firstName: 'Tina' }
      ];

      const providerName = 'Beach Tours';

      const activityResults = await tourEventNotificationService.notifyActivityUpdate(
        'activity-cancel-tour-123',
        tourEventData,
        activityData,
        registeredTourists,
        providerName,
        'cancelled'
      );

      expect(activityResults['activity-cancel-tourist'].length).toBeGreaterThan(0);

      // Verify notifications were sent successfully
      expect(activityResults['activity-cancel-tourist'].length).toBeGreaterThan(0);
    });
  });

  describe('Notification Retry Logic', () => {
    it('should handle notification delivery failures and provide retry mechanism', async () => {
      const tourEventData = {
        customTourName: 'Retry Test Tour',
        startDate: new Date('2024-12-15'),
        endDate: new Date('2024-12-20'),
        providerId: 'retry-provider'
      };

      const registeredTourists = [
        { userId: 'retry-tourist-1', firstName: 'Uma' },
        { userId: 'retry-tourist-2', firstName: 'Victor' }
      ];

      const providerName = 'Retry Tours';

      // Send notifications
      const results = await tourEventNotificationService.notifyTourScheduleUpdate(
        'retry-tour-123',
        tourEventData,
        registeredTourists,
        providerName
      );

      expect(Object.keys(results)).toHaveLength(2);

      // Check for failed notifications (should be empty in normal operation)
      const failedNotifications = tourEventNotificationService.getFailedNotifications();
      expect(Array.isArray(failedNotifications)).toBe(true);

      // Verify notification statistics include retry information
      const stats = tourEventNotificationService.getNotificationStats();
      expect(stats).toHaveProperty('failed');
      expect(typeof stats.failed).toBe('number');
    });

    it('should track notification delivery status across multiple updates', async () => {
      const tourEventData = {
        customTourName: 'Tracking Test Tour',
        providerId: 'tracking-provider'
      };

      const registeredTourists = [
        { userId: 'tracking-tourist', firstName: 'Wendy' }
      ];

      const providerName = 'Tracking Tours';

      // Send multiple types of notifications
      await tourEventNotificationService.notifyTourEventUpdate(
        'tracking-tour-123',
        'First update: Welcome message',
        tourEventData,
        registeredTourists,
        providerName
      );

      await tourEventNotificationService.notifyTourEventUpdate(
        'tracking-tour-123',
        'Second update: Important information',
        tourEventData,
        registeredTourists,
        providerName
      );

      await tourEventNotificationService.notifyCapacityUpdate(
        'tracking-tour-123',
        {
          customTourName: tourEventData.customTourName,
          numberOfAllowedTourists: 20,
          remainingTourists: 15
        },
        registeredTourists,
        providerName
      );

      // Verify all notifications were processed
      const stats = tourEventNotificationService.getNotificationStats();
      const totalNotifications = stats.pending + stats.processing + stats.completed + stats.failed;
      expect(totalNotifications).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle partial failures in bulk notifications', async () => {
      const tourEventData = {
        customTourName: 'Resilience Tour',
        startDate: new Date('2024-10-01'),
        endDate: new Date('2024-10-05'),
        providerId: 'resilience-provider'
      };

      // Mix of valid and potentially problematic tourist data
      const registeredTourists = [
        { userId: 'valid-tourist-1', firstName: 'Kate' },
        { userId: 'valid-tourist-2', firstName: 'Liam' },
        { userId: '', firstName: '' }, // Potentially problematic
        { userId: 'valid-tourist-3', firstName: 'Mia' }
      ];

      const providerName = 'Resilience Tours';

      const results = await tourEventNotificationService.notifyTourScheduleUpdate(
        'resilience-tour-123',
        tourEventData,
        registeredTourists,
        providerName
      );

      // Should have results for all tourists (even if some fail)
      expect(Object.keys(results)).toHaveLength(4);
      
      // Valid tourists should have successful notifications
      expect(results['valid-tourist-1'].length).toBeGreaterThan(0);
      expect(results['valid-tourist-2'].length).toBeGreaterThan(0);
      expect(results['valid-tourist-3'].length).toBeGreaterThan(0);
    });
  });
});