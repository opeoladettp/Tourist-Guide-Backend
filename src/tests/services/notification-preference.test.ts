import { describe, it, expect, beforeEach } from 'vitest';
import { NotificationPreferenceService } from '../../services/notification-preference';

describe('NotificationPreferenceService', () => {
  let preferenceService: NotificationPreferenceService;

  beforeEach(() => {
    preferenceService = new NotificationPreferenceService();
  });

  describe('getUserPreferences', () => {
    it('should create default preferences for new user', async () => {
      const preferences = await preferenceService.getUserPreferences('user-1');
      
      expect(preferences).toBeDefined();
      expect(preferences.userId).toBe('user-1');
      expect(preferences.emailEnabled).toBe(true);
      expect(preferences.pushEnabled).toBe(true);
      expect(preferences.smsEnabled).toBe(false);
      expect(preferences.tourUpdatesEnabled).toBe(true);
      expect(preferences.registrationUpdatesEnabled).toBe(true);
      expect(preferences.systemUpdatesEnabled).toBe(true);
      expect(preferences.createdAt).toBeInstanceOf(Date);
      expect(preferences.updatedAt).toBeInstanceOf(Date);
    });

    it('should return existing preferences for known user', async () => {
      // First call creates preferences
      const firstCall = await preferenceService.getUserPreferences('user-1');
      
      // Second call should return same preferences
      const secondCall = await preferenceService.getUserPreferences('user-1');
      
      expect(secondCall.userId).toBe(firstCall.userId);
      expect(secondCall.createdAt).toEqual(firstCall.createdAt);
    });
  });

  describe('updateUserPreferences', () => {
    it('should update user preferences', async () => {
      const updates = {
        emailEnabled: false,
        smsEnabled: true,
        tourUpdatesEnabled: false
      };

      const updated = await preferenceService.updateUserPreferences('user-1', updates);
      
      expect(updated.emailEnabled).toBe(false);
      expect(updated.smsEnabled).toBe(true);
      expect(updated.tourUpdatesEnabled).toBe(false);
      expect(updated.pushEnabled).toBe(true); // Should remain unchanged
      expect(updated.updatedAt).toBeInstanceOf(Date);
    });

    it('should preserve unchanged preferences', async () => {
      // Get initial preferences
      const initial = await preferenceService.getUserPreferences('user-1');
      
      // Update only one field
      const updated = await preferenceService.updateUserPreferences('user-1', {
        emailEnabled: false
      });
      
      expect(updated.emailEnabled).toBe(false);
      expect(updated.pushEnabled).toBe(initial.pushEnabled);
      expect(updated.smsEnabled).toBe(initial.smsEnabled);
      expect(updated.tourUpdatesEnabled).toBe(initial.tourUpdatesEnabled);
    });
  });

  describe('isNotificationEnabled', () => {
    it('should check email notification status', async () => {
      const enabled = await preferenceService.isNotificationEnabled('user-1', 'email');
      expect(enabled).toBe(true); // Default is true
      
      await preferenceService.updateUserPreferences('user-1', { emailEnabled: false });
      
      const disabled = await preferenceService.isNotificationEnabled('user-1', 'email');
      expect(disabled).toBe(false);
    });

    it('should check push notification status', async () => {
      const enabled = await preferenceService.isNotificationEnabled('user-1', 'push');
      expect(enabled).toBe(true); // Default is true
    });

    it('should check SMS notification status', async () => {
      const enabled = await preferenceService.isNotificationEnabled('user-1', 'sms');
      expect(enabled).toBe(false); // Default is false
    });

    it('should check tour updates status', async () => {
      const enabled = await preferenceService.isNotificationEnabled('user-1', 'tourUpdates');
      expect(enabled).toBe(true); // Default is true
    });

    it('should check registration updates status', async () => {
      const enabled = await preferenceService.isNotificationEnabled('user-1', 'registrationUpdates');
      expect(enabled).toBe(true); // Default is true
    });

    it('should check system updates status', async () => {
      const enabled = await preferenceService.isNotificationEnabled('user-1', 'systemUpdates');
      expect(enabled).toBe(true); // Default is true
    });

    it('should return false for invalid notification type', async () => {
      const enabled = await preferenceService.isNotificationEnabled('user-1', 'invalid' as any);
      expect(enabled).toBe(false);
    });
  });

  describe('getUsersWithPreference', () => {
    it('should return users with email enabled', async () => {
      // Create users with different preferences
      await preferenceService.getUserPreferences('user-1'); // Default: email enabled
      await preferenceService.updateUserPreferences('user-2', { emailEnabled: false });
      await preferenceService.getUserPreferences('user-3'); // Default: email enabled
      
      const usersWithEmail = await preferenceService.getUsersWithPreference('email');
      
      expect(usersWithEmail).toContain('user-1');
      expect(usersWithEmail).toContain('user-3');
      expect(usersWithEmail).not.toContain('user-2');
    });

    it('should return users with SMS enabled', async () => {
      // Create users with different SMS preferences
      await preferenceService.updateUserPreferences('user-1', { smsEnabled: true });
      await preferenceService.getUserPreferences('user-2'); // Default: SMS disabled
      
      const usersWithSMS = await preferenceService.getUsersWithPreference('sms');
      
      expect(usersWithSMS).toContain('user-1');
      expect(usersWithSMS).not.toContain('user-2');
    });
  });

  describe('deleteUserPreferences', () => {
    it('should delete user preferences', async () => {
      // Create preferences
      await preferenceService.getUserPreferences('user-1');
      
      // Delete preferences
      const deleted = await preferenceService.deleteUserPreferences('user-1');
      expect(deleted).toBe(true);
      
      // Getting preferences again should create new defaults
      const newPreferences = await preferenceService.getUserPreferences('user-1');
      expect(newPreferences.createdAt).toBeInstanceOf(Date);
    });

    it('should return false for non-existent user', async () => {
      const deleted = await preferenceService.deleteUserPreferences('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('getAllPreferences', () => {
    it('should return all user preferences', async () => {
      // Create preferences for multiple users
      await preferenceService.getUserPreferences('user-1');
      await preferenceService.getUserPreferences('user-2');
      await preferenceService.getUserPreferences('user-3');
      
      const allPreferences = await preferenceService.getAllPreferences();
      
      expect(allPreferences).toHaveLength(3);
      expect(allPreferences.some(p => p.userId === 'user-1')).toBe(true);
      expect(allPreferences.some(p => p.userId === 'user-2')).toBe(true);
      expect(allPreferences.some(p => p.userId === 'user-3')).toBe(true);
    });
  });

  describe('bulkUpdatePreferences', () => {
    it('should update preferences for multiple users', async () => {
      const updates = [
        { userId: 'user-1', preferences: { emailEnabled: false } },
        { userId: 'user-2', preferences: { smsEnabled: true } },
        { userId: 'user-3', preferences: { tourUpdatesEnabled: false } }
      ];

      const results = await preferenceService.bulkUpdatePreferences(updates);
      
      expect(results).toHaveLength(3);
      expect(results[0].emailEnabled).toBe(false);
      expect(results[1].smsEnabled).toBe(true);
      expect(results[2].tourUpdatesEnabled).toBe(false);
    });
  });

  describe('resetToDefault', () => {
    it('should reset user preferences to default', async () => {
      // Create and modify preferences
      await preferenceService.updateUserPreferences('user-1', {
        emailEnabled: false,
        smsEnabled: true,
        tourUpdatesEnabled: false
      });
      
      // Reset to default
      const reset = await preferenceService.resetToDefault('user-1');
      
      expect(reset.emailEnabled).toBe(true);
      expect(reset.smsEnabled).toBe(false);
      expect(reset.tourUpdatesEnabled).toBe(true);
      expect(reset.registrationUpdatesEnabled).toBe(true);
      expect(reset.systemUpdatesEnabled).toBe(true);
    });
  });
});