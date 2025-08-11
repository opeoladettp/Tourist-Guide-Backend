import { NotificationPreference } from '../types/notification';

export class NotificationPreferenceService {
  private preferences: Map<string, NotificationPreference> = new Map();

  /**
   * Get user notification preferences
   */
  async getUserPreferences(userId: string): Promise<NotificationPreference> {
    let preferences = this.preferences.get(userId);
    
    if (!preferences) {
      // Create default preferences for new user
      preferences = this.createDefaultPreferences(userId);
      this.preferences.set(userId, preferences);
    }
    
    return preferences;
  }

  /**
   * Update user notification preferences
   */
  async updateUserPreferences(userId: string, updates: Partial<Omit<NotificationPreference, 'userId' | 'createdAt' | 'updatedAt'>>): Promise<NotificationPreference> {
    const currentPreferences = await this.getUserPreferences(userId);
    
    const updatedPreferences: NotificationPreference = {
      ...currentPreferences,
      ...updates,
      updatedAt: new Date()
    };
    
    this.preferences.set(userId, updatedPreferences);
    return updatedPreferences;
  }

  /**
   * Check if user has enabled a specific notification type
   */
  async isNotificationEnabled(userId: string, notificationType: 'email' | 'push' | 'sms' | 'tourUpdates' | 'registrationUpdates' | 'systemUpdates'): Promise<boolean> {
    const preferences = await this.getUserPreferences(userId);
    
    switch (notificationType) {
      case 'email':
        return preferences.emailEnabled;
      case 'push':
        return preferences.pushEnabled;
      case 'sms':
        return preferences.smsEnabled;
      case 'tourUpdates':
        return preferences.tourUpdatesEnabled;
      case 'registrationUpdates':
        return preferences.registrationUpdatesEnabled;
      case 'systemUpdates':
        return preferences.systemUpdatesEnabled;
      default:
        return false;
    }
  }

  /**
   * Get all users with specific notification preferences enabled
   */
  async getUsersWithPreference(preferenceType: 'email' | 'push' | 'sms' | 'tourUpdates' | 'registrationUpdates' | 'systemUpdates'): Promise<string[]> {
    const userIds: string[] = [];
    
    for (const [userId, preferences] of this.preferences.entries()) {
      const isEnabled = await this.isNotificationEnabled(userId, preferenceType);
      if (isEnabled) {
        userIds.push(userId);
      }
    }
    
    return userIds;
  }

  /**
   * Create default preferences for a new user
   */
  private createDefaultPreferences(userId: string): NotificationPreference {
    return {
      userId,
      emailEnabled: true,
      pushEnabled: true,
      smsEnabled: false,
      tourUpdatesEnabled: true,
      registrationUpdatesEnabled: true,
      systemUpdatesEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Delete user preferences
   */
  async deleteUserPreferences(userId: string): Promise<boolean> {
    return this.preferences.delete(userId);
  }

  /**
   * Get all preferences (for admin purposes)
   */
  async getAllPreferences(): Promise<NotificationPreference[]> {
    return Array.from(this.preferences.values());
  }

  /**
   * Bulk update preferences for multiple users
   */
  async bulkUpdatePreferences(updates: Array<{ userId: string; preferences: Partial<Omit<NotificationPreference, 'userId' | 'createdAt' | 'updatedAt'>> }>): Promise<NotificationPreference[]> {
    const results: NotificationPreference[] = [];
    
    for (const update of updates) {
      const updatedPreference = await this.updateUserPreferences(update.userId, update.preferences);
      results.push(updatedPreference);
    }
    
    return results;
  }

  /**
   * Reset preferences to default for a user
   */
  async resetToDefault(userId: string): Promise<NotificationPreference> {
    const defaultPreferences = this.createDefaultPreferences(userId);
    this.preferences.set(userId, defaultPreferences);
    return defaultPreferences;
  }
}