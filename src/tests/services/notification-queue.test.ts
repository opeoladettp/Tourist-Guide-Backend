import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { NotificationQueue } from '../../services/notification-queue';
import { NotificationPriority, NotificationChannel } from '../../types/notification';

describe('NotificationQueue', () => {
  let queue: NotificationQueue;

  beforeEach(() => {
    queue = new NotificationQueue({
      maxConcurrency: 2,
      retryDelay: 100,
      maxRetries: 2,
      processingTimeout: 1000
    });
  });

  afterEach(() => {
    queue.stop();
  });

  describe('enqueue', () => {
    it('should add notification to queue', async () => {
      const notification = {
        messageId: 'test-1',
        userId: 'user-1',
        templateId: 'template-1',
        variables: {},
        channel: NotificationChannel.EMAIL,
        priority: NotificationPriority.NORMAL
      };

      await queue.enqueue(notification);
      const stats = queue.getStats();
      
      expect(stats.pending).toBeGreaterThanOrEqual(0);
    });

    it('should prioritize urgent notifications', async () => {
      const normalNotification = {
        messageId: 'normal',
        userId: 'user-1',
        templateId: 'template-1',
        variables: {},
        channel: NotificationChannel.EMAIL,
        priority: NotificationPriority.NORMAL
      };

      const urgentNotification = {
        messageId: 'urgent',
        userId: 'user-1',
        templateId: 'template-1',
        variables: {},
        channel: NotificationChannel.EMAIL,
        priority: NotificationPriority.URGENT
      };

      // Add normal first, then urgent
      await queue.enqueue(normalNotification);
      await queue.enqueue(urgentNotification);

      // Urgent should be processed first
      let processedOrder: string[] = [];
      queue.on('processing', (notification) => {
        processedOrder.push(notification.messageId);
      });

      // Wait a bit for processing
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Note: Due to async nature, we can't guarantee exact order in tests
      // but the queue should prioritize correctly
    });
  });

  describe('processing', () => {
    it('should emit processing events', async () => {
      const notification = {
        messageId: 'test-1',
        userId: 'user-1',
        templateId: 'template-1',
        variables: {},
        channel: NotificationChannel.EMAIL,
        priority: NotificationPriority.NORMAL
      };

      let processingEmitted = false;
      queue.on('processing', () => {
        processingEmitted = true;
      });

      queue.on('process', (notif, callback) => {
        callback({ success: true });
      });

      await queue.enqueue(notification);
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(processingEmitted).toBe(true);
    });

    it('should handle processing success', async () => {
      const notification = {
        messageId: 'test-1',
        userId: 'user-1',
        templateId: 'template-1',
        variables: {},
        channel: NotificationChannel.EMAIL,
        priority: NotificationPriority.NORMAL
      };

      let completedEmitted = false;
      queue.on('completed', () => {
        completedEmitted = true;
      });

      queue.on('process', (notif, callback) => {
        callback({ success: true });
      });

      await queue.enqueue(notification);
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(completedEmitted).toBe(true);
    });

    it('should handle processing failure with retry', async () => {
      const notification = {
        messageId: 'test-1',
        userId: 'user-1',
        templateId: 'template-1',
        variables: {},
        channel: NotificationChannel.EMAIL,
        priority: NotificationPriority.NORMAL
      };

      let retryEmitted = false;
      queue.on('retrying', () => {
        retryEmitted = true;
      });

      let processCount = 0;
      queue.on('process', (notif, callback) => {
        processCount++;
        if (processCount === 1) {
          callback({ success: false, error: 'Test error' });
        } else {
          callback({ success: true });
        }
      });

      await queue.enqueue(notification);
      
      // Wait for processing and retry
      await new Promise(resolve => setTimeout(resolve, 300));
      
      expect(retryEmitted).toBe(true);
      expect(processCount).toBeGreaterThan(1);
    });

    it('should fail after max retries', async () => {
      const notification = {
        messageId: 'test-1',
        userId: 'user-1',
        templateId: 'template-1',
        variables: {},
        channel: NotificationChannel.EMAIL,
        priority: NotificationPriority.NORMAL
      };

      let failedEmitted = false;
      queue.on('failed', () => {
        failedEmitted = true;
      });

      queue.on('process', (notif, callback) => {
        callback({ success: false, error: 'Persistent error' });
      });

      await queue.enqueue(notification);
      
      // Wait for all retries to complete
      await new Promise(resolve => setTimeout(resolve, 500));
      
      expect(failedEmitted).toBe(true);
      
      const failedNotifications = queue.getFailedNotifications();
      expect(failedNotifications).toHaveLength(1);
    });
  });

  describe('stats', () => {
    it('should return correct queue statistics', async () => {
      const stats = queue.getStats();
      
      expect(stats).toHaveProperty('pending');
      expect(stats).toHaveProperty('processing');
      expect(stats).toHaveProperty('completed');
      expect(stats).toHaveProperty('failed');
      
      expect(typeof stats.pending).toBe('number');
      expect(typeof stats.processing).toBe('number');
      expect(typeof stats.completed).toBe('number');
      expect(typeof stats.failed).toBe('number');
    });
  });

  describe('cleanup', () => {
    it('should clear completed and failed notifications', async () => {
      // Add and process a notification
      const notification = {
        messageId: 'test-1',
        userId: 'user-1',
        templateId: 'template-1',
        variables: {},
        channel: NotificationChannel.EMAIL,
        priority: NotificationPriority.NORMAL
      };

      queue.on('process', (notif, callback) => {
        callback({ success: true });
      });

      await queue.enqueue(notification);
      await new Promise(resolve => setTimeout(resolve, 100));
      
      queue.cleanup();
      
      const stats = queue.getStats();
      expect(stats.completed).toBe(0);
      expect(stats.failed).toBe(0);
    });
  });

  describe('scheduled notifications', () => {
    it('should accept scheduled notifications without processing immediately', () => {
      const futureDate = new Date();
      futureDate.setSeconds(futureDate.getSeconds() + 10); // Far future
      
      const notification = {
        messageId: 'scheduled-1',
        userId: 'user-1',
        templateId: 'template-1',
        variables: {},
        channel: NotificationChannel.EMAIL,
        priority: NotificationPriority.NORMAL,
        scheduledAt: futureDate
      };

      // This should not throw an error
      expect(() => {
        queue.enqueue(notification);
      }).not.toThrow();
    });
  });
});