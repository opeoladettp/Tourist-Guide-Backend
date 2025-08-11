import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import NotificationManager from '../../services/notification-manager';
import { NotificationChannel, NotificationPriority } from '../../types/notification';

describe('NotificationManager', () => {
  afterEach(() => {
    NotificationManager.stop();
  });

  describe('getInstance', () => {
    it('should return a notification service instance', () => {
      const service = NotificationManager.getInstance();
      
      expect(service).toBeDefined();
      expect(typeof service.sendNotification).toBe('function');
      expect(typeof service.getQueueStats).toBe('function');
    });

    it('should return the same instance on multiple calls (singleton)', () => {
      const service1 = NotificationManager.getInstance();
      const service2 = NotificationManager.getInstance();
      
      expect(service1).toBe(service2);
    });
  });

  describe('stop', () => {
    it('should stop the notification service', () => {
      const service = NotificationManager.getInstance();
      
      // Verify service is running
      expect(service).toBeDefined();
      
      // Stop the service
      NotificationManager.stop();
      
      // Getting instance again should create a new one
      const newService = NotificationManager.getInstance();
      expect(newService).toBeDefined();
      expect(newService).not.toBe(service);
    });
  });

  describe('cleanup', () => {
    it('should cleanup notifications when service exists', async () => {
      const service = NotificationManager.getInstance();
      
      // Send a notification to create some data
      await service.sendNotification({
        userId: 'user-1',
        templateId: 'tour-schedule-updated',
        variables: {
          firstName: 'John',
          tourName: 'Test Tour',
          startDate: '2024-01-15',
          endDate: '2024-01-20',
          providerName: 'Test Provider'
        },
        channels: [NotificationChannel.EMAIL]
      });
      
      // Cleanup should not throw
      expect(() => {
        NotificationManager.cleanup();
      }).not.toThrow();
    });

    it('should handle cleanup when no service exists', () => {
      // Cleanup without creating service should not throw
      expect(() => {
        NotificationManager.cleanup();
      }).not.toThrow();
    });
  });

  describe('integration', () => {
    it('should allow sending notifications through manager', async () => {
      const service = NotificationManager.getInstance();
      
      const messageIds = await service.sendNotification({
        userId: 'user-1',
        templateId: 'tour-schedule-updated',
        variables: {
          firstName: 'John',
          tourName: 'Test Tour',
          startDate: '2024-01-15',
          endDate: '2024-01-20',
          providerName: 'Test Provider'
        },
        channels: [NotificationChannel.EMAIL],
        priority: NotificationPriority.NORMAL
      });
      
      expect(messageIds).toHaveLength(1);
      expect(typeof messageIds[0]).toBe('string');
      
      // Verify message was created
      const message = service.getNotificationMessage(messageIds[0]);
      expect(message).toBeDefined();
      expect(message?.userId).toBe('user-1');
    });
  });
});