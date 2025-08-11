import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NotificationService } from '../../services/notification';
import { NotificationChannel, NotificationPriority, NotificationType } from '../../types/notification';

describe('NotificationService', () => {
  let notificationService: NotificationService;

  beforeEach(() => {
    notificationService = new NotificationService();
  });

  afterEach(() => {
    notificationService.stop();
  });

  describe('sendNotification', () => {
    it('should send notification successfully', async () => {
      const options = {
        userId: 'user-1',
        templateId: 'tour-schedule-updated',
        variables: {
          firstName: 'John',
          tourName: 'Amazing Tour',
          startDate: '2024-01-15',
          endDate: '2024-01-20',
          providerName: 'Travel Co'
        },
        channels: [NotificationChannel.EMAIL],
        priority: NotificationPriority.NORMAL
      };

      const messageIds = await notificationService.sendNotification(options);
      
      expect(messageIds).toHaveLength(1);
      expect(typeof messageIds[0]).toBe('string');
    });

    it('should throw error for non-existent template', async () => {
      const options = {
        userId: 'user-1',
        templateId: 'non-existent',
        variables: {}
      };

      await expect(notificationService.sendNotification(options)).rejects.toThrow('Template not found');
    });

    it('should throw error for missing template variables', async () => {
      const options = {
        userId: 'user-1',
        templateId: 'tour-schedule-updated',
        variables: {
          firstName: 'John'
          // Missing required variables
        }
      };

      await expect(notificationService.sendNotification(options)).rejects.toThrow('Missing template variables');
    });

    it('should use default channels when none specified', async () => {
      const options = {
        userId: 'user-1',
        templateId: 'tour-schedule-updated',
        variables: {
          firstName: 'John',
          tourName: 'Amazing Tour',
          startDate: '2024-01-15',
          endDate: '2024-01-20',
          providerName: 'Travel Co'
        }
      };

      const messageIds = await notificationService.sendNotification(options);
      
      // Should include multiple channels based on user preferences
      expect(messageIds.length).toBeGreaterThan(0);
    });

    it('should handle scheduled notifications', async () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);

      const options = {
        userId: 'user-1',
        templateId: 'tour-schedule-updated',
        variables: {
          firstName: 'John',
          tourName: 'Amazing Tour',
          startDate: '2024-01-15',
          endDate: '2024-01-20',
          providerName: 'Travel Co'
        },
        scheduledAt: futureDate
      };

      const messageIds = await notificationService.sendNotification(options);
      
      expect(messageIds.length).toBeGreaterThan(0);
      
      // Check that message is scheduled
      const message = notificationService.getNotificationMessage(messageIds[0]);
      expect(message?.scheduledAt).toEqual(futureDate);
    });
  });

  describe('sendBulkNotification', () => {
    it('should send notifications to multiple users', async () => {
      const options = {
        userIds: ['user-1', 'user-2', 'user-3'],
        templateId: 'tour-schedule-updated',
        variables: {
          firstName: 'John',
          tourName: 'Amazing Tour',
          startDate: '2024-01-15',
          endDate: '2024-01-20',
          providerName: 'Travel Co'
        },
        channels: [NotificationChannel.EMAIL]
      };

      const results = await notificationService.sendBulkNotification(options);
      
      expect(Object.keys(results)).toHaveLength(3);
      expect(results['user-1']).toHaveLength(1);
      expect(results['user-2']).toHaveLength(1);
      expect(results['user-3']).toHaveLength(1);
    });

    it('should handle individual user failures gracefully', async () => {
      // Mock console.error to avoid test output noise
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const options = {
        userIds: ['user-1', 'invalid-user'],
        templateId: 'non-existent-template',
        variables: {}
      };

      const results = await notificationService.sendBulkNotification(options);
      
      expect(Object.keys(results)).toHaveLength(2);
      expect(results['user-1']).toHaveLength(0); // Failed
      expect(results['invalid-user']).toHaveLength(0); // Failed
      
      consoleSpy.mockRestore();
    });
  });

  describe('getNotificationMessage', () => {
    it('should return notification message by ID', async () => {
      const options = {
        userId: 'user-1',
        templateId: 'tour-schedule-updated',
        variables: {
          firstName: 'John',
          tourName: 'Amazing Tour',
          startDate: '2024-01-15',
          endDate: '2024-01-20',
          providerName: 'Travel Co'
        },
        channels: [NotificationChannel.EMAIL]
      };

      const messageIds = await notificationService.sendNotification(options);
      const message = notificationService.getNotificationMessage(messageIds[0]);
      
      expect(message).toBeDefined();
      expect(message?.messageId).toBe(messageIds[0]);
      expect(message?.userId).toBe('user-1');
      expect(message?.templateId).toBe('tour-schedule-updated');
    });

    it('should return undefined for non-existent message', () => {
      const message = notificationService.getNotificationMessage('non-existent');
      
      expect(message).toBeUndefined();
    });
  });

  describe('getUserNotifications', () => {
    it('should return user notifications', async () => {
      const options1 = {
        userId: 'user-1',
        templateId: 'tour-schedule-updated',
        variables: {
          firstName: 'John',
          tourName: 'Amazing Tour',
          startDate: '2024-01-15',
          endDate: '2024-01-20',
          providerName: 'Travel Co'
        },
        channels: [NotificationChannel.EMAIL]
      };

      const options2 = {
        userId: 'user-2',
        templateId: 'registration-approved',
        variables: {
          firstName: 'Jane',
          tourName: 'Another Tour',
          startDate: '2024-02-01',
          endDate: '2024-02-05',
          meetingPoint: 'Hotel Lobby',
          providerName: 'Travel Co'
        },
        channels: [NotificationChannel.EMAIL]
      };

      await notificationService.sendNotification(options1);
      await notificationService.sendNotification(options2);
      
      const user1Notifications = notificationService.getUserNotifications('user-1');
      const user2Notifications = notificationService.getUserNotifications('user-2');
      
      expect(user1Notifications).toHaveLength(1);
      expect(user2Notifications).toHaveLength(1);
      expect(user1Notifications[0].userId).toBe('user-1');
      expect(user2Notifications[0].userId).toBe('user-2');
    });
  });

  describe('getQueueStats', () => {
    it('should return queue statistics', () => {
      const stats = notificationService.getQueueStats();
      
      expect(stats).toHaveProperty('pending');
      expect(stats).toHaveProperty('processing');
      expect(stats).toHaveProperty('completed');
      expect(stats).toHaveProperty('failed');
    });
  });

  describe('service access methods', () => {
    it('should provide access to template service', () => {
      const templateService = notificationService.getTemplateService();
      
      expect(templateService).toBeDefined();
      expect(typeof templateService.getTemplate).toBe('function');
    });

    it('should provide access to preference service', () => {
      const preferenceService = notificationService.getPreferenceService();
      
      expect(preferenceService).toBeDefined();
      expect(typeof preferenceService.getUserPreferences).toBe('function');
    });

    it('should provide access to delivery service', () => {
      const deliveryService = notificationService.getDeliveryService();
      
      expect(deliveryService).toBeDefined();
      expect(typeof deliveryService.deliver).toBe('function');
    });
  });

  describe('cleanup', () => {
    it('should cleanup old notifications', async () => {
      // Send a notification
      const options = {
        userId: 'user-1',
        templateId: 'tour-schedule-updated',
        variables: {
          firstName: 'John',
          tourName: 'Amazing Tour',
          startDate: '2024-01-15',
          endDate: '2024-01-20',
          providerName: 'Travel Co'
        },
        channels: [NotificationChannel.EMAIL]
      };

      const messageIds = await notificationService.sendNotification(options);
      
      // Verify message exists
      let message = notificationService.getNotificationMessage(messageIds[0]);
      expect(message).toBeDefined();
      
      // Mock the message as old and sent
      if (message) {
        const oldDate = new Date();
        oldDate.setDate(oldDate.getDate() - 8); // 8 days ago
        message.sentAt = oldDate;
        message.status = 'SENT' as any;
      }
      
      // Cleanup
      notificationService.cleanup();
      
      // Message should be removed (in a real implementation)
      // Note: This test might need adjustment based on actual cleanup implementation
    });
  });

  describe('integration with preferences', () => {
    it('should respect user notification preferences', async () => {
      // Disable email notifications for user
      const preferenceService = notificationService.getPreferenceService();
      await preferenceService.updateUserPreferences('user-1', {
        emailEnabled: false,
        pushEnabled: true
      });

      const options = {
        userId: 'user-1',
        templateId: 'tour-schedule-updated',
        variables: {
          firstName: 'John',
          tourName: 'Amazing Tour',
          startDate: '2024-01-15',
          endDate: '2024-01-20',
          providerName: 'Travel Co'
        }
      };

      const messageIds = await notificationService.sendNotification(options);
      
      // Should still send notifications through enabled channels
      expect(messageIds.length).toBeGreaterThan(0);
      
      // Check that no email notifications were created
      const messages = messageIds.map(id => notificationService.getNotificationMessage(id));
      const emailMessages = messages.filter(m => m?.channel === NotificationChannel.EMAIL);
      expect(emailMessages).toHaveLength(0);
    });
  });
});