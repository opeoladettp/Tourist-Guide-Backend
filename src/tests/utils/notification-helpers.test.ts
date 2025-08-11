import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  sendTourScheduleUpdateNotification,
  sendRegistrationApprovedNotification,
  sendRegistrationRejectedNotification,
  sendTourUpdateNotification,
  sendDocumentUploadedNotification,
  sendBulkTourUpdateNotification,
  getNotificationStats,
  getUserInAppMessages,
  clearUserInAppMessages,
  getUserNotificationPreferences,
  updateUserNotificationPreferences
} from '../../utils/notification-helpers';
import { NotificationChannel, NotificationPriority } from '../../types/notification';
import NotificationManager from '../../services/notification-manager';

describe('Notification Helpers', () => {
  afterEach(() => {
    NotificationManager.stop();
  });

  describe('sendTourScheduleUpdateNotification', () => {
    it('should send tour schedule update notification', async () => {
      const tourData = {
        firstName: 'John',
        tourName: 'Amazing Tour',
        startDate: '2024-01-15',
        endDate: '2024-01-20',
        providerName: 'Travel Co'
      };

      const messageIds = await sendTourScheduleUpdateNotification('user-1', tourData);
      
      expect(messageIds.length).toBeGreaterThan(0);
      expect(typeof messageIds[0]).toBe('string');
    });

    it('should accept custom options', async () => {
      const tourData = {
        firstName: 'John',
        tourName: 'Amazing Tour',
        startDate: '2024-01-15',
        endDate: '2024-01-20',
        providerName: 'Travel Co'
      };

      const messageIds = await sendTourScheduleUpdateNotification('user-1', tourData, {
        channels: [NotificationChannel.EMAIL],
        priority: NotificationPriority.HIGH
      });
      
      expect(messageIds).toHaveLength(1);
    });
  });

  describe('sendRegistrationApprovedNotification', () => {
    it('should send registration approved notification', async () => {
      const tourData = {
        firstName: 'Jane',
        tourName: 'Great Tour',
        startDate: '2024-02-01',
        endDate: '2024-02-05',
        meetingPoint: 'Hotel Lobby',
        providerName: 'Travel Co'
      };

      const messageIds = await sendRegistrationApprovedNotification('user-2', tourData);
      
      expect(messageIds.length).toBeGreaterThan(0);
      expect(typeof messageIds[0]).toBe('string');
    });
  });

  describe('sendRegistrationRejectedNotification', () => {
    it('should send registration rejected notification', async () => {
      const tourData = {
        firstName: 'Bob',
        tourName: 'Full Tour',
        rejectionReason: 'Tour is fully booked',
        providerName: 'Travel Co'
      };

      const messageIds = await sendRegistrationRejectedNotification('user-3', tourData);
      
      expect(messageIds.length).toBeGreaterThan(0);
      expect(typeof messageIds[0]).toBe('string');
    });
  });

  describe('sendTourUpdateNotification', () => {
    it('should send general tour update notification', async () => {
      const tourData = {
        firstName: 'Alice',
        tourName: 'Updated Tour',
        updateMessage: 'The meeting time has been changed to 9:00 AM.',
        providerName: 'Travel Co'
      };

      const messageIds = await sendTourUpdateNotification('user-4', tourData);
      
      expect(messageIds.length).toBeGreaterThan(0);
      expect(typeof messageIds[0]).toBe('string');
    });
  });

  describe('sendDocumentUploadedNotification', () => {
    it('should send document uploaded notification', async () => {
      const documentData = {
        firstName: 'Charlie',
        documentName: 'passport.pdf',
        documentType: 'Passport',
        uploaderName: 'Admin User',
        providerName: 'Travel Co'
      };

      const messageIds = await sendDocumentUploadedNotification('user-5', documentData);
      
      expect(messageIds.length).toBeGreaterThan(0);
      expect(typeof messageIds[0]).toBe('string');
    });
  });

  describe('sendBulkTourUpdateNotification', () => {
    it('should send bulk notifications to multiple users', async () => {
      const userIds = ['user-1', 'user-2', 'user-3'];
      const tourData = {
        firstName: 'Tourist', // This will be the same for all users in this example
        tourName: 'Group Tour',
        updateMessage: 'Weather update: Please bring rain jackets.',
        providerName: 'Travel Co'
      };

      const results = await sendBulkTourUpdateNotification(userIds, tourData);
      
      expect(Object.keys(results)).toHaveLength(3);
      expect(results['user-1'].length).toBeGreaterThan(0);
      expect(results['user-2'].length).toBeGreaterThan(0);
      expect(results['user-3'].length).toBeGreaterThan(0);
    });
  });

  describe('getNotificationStats', () => {
    it('should return notification queue statistics', () => {
      const stats = getNotificationStats();
      
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

  describe('in-app message management', () => {
    it('should manage user in-app messages', async () => {
      // Send an in-app notification
      const tourData = {
        firstName: 'Test',
        tourName: 'Test Tour',
        updateMessage: 'Test message',
        providerName: 'Test Provider'
      };

      await sendTourUpdateNotification('user-test', tourData, {
        channels: [NotificationChannel.IN_APP]
      });

      // Get messages
      const messages = getUserInAppMessages('user-test');
      expect(messages.length).toBeGreaterThan(0);

      // Clear messages
      clearUserInAppMessages('user-test');
      
      const clearedMessages = getUserInAppMessages('user-test');
      expect(clearedMessages).toHaveLength(0);
    });
  });

  describe('notification preferences', () => {
    it('should get user notification preferences', async () => {
      const preferences = await getUserNotificationPreferences('user-prefs');
      
      expect(preferences).toBeDefined();
      expect(preferences.userId).toBe('user-prefs');
      expect(typeof preferences.emailEnabled).toBe('boolean');
      expect(typeof preferences.pushEnabled).toBe('boolean');
      expect(typeof preferences.smsEnabled).toBe('boolean');
    });

    it('should update user notification preferences', async () => {
      const updates = {
        emailEnabled: false,
        smsEnabled: true,
        tourUpdatesEnabled: false
      };

      const updatedPreferences = await updateUserNotificationPreferences('user-prefs', updates);
      
      expect(updatedPreferences.emailEnabled).toBe(false);
      expect(updatedPreferences.smsEnabled).toBe(true);
      expect(updatedPreferences.tourUpdatesEnabled).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle invalid template gracefully', async () => {
      // This should be handled by the underlying service
      const service = NotificationManager.getInstance();
      
      await expect(service.sendNotification({
        userId: 'user-1',
        templateId: 'non-existent-template',
        variables: {}
      })).rejects.toThrow('Template not found');
    });
  });
});