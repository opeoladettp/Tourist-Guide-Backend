import { NotificationService } from './notification';

/**
 * Global notification service manager
 * Provides a singleton instance of the notification service
 */
class NotificationManager {
  private static instance: NotificationService | null = null;

  /**
   * Get the singleton notification service instance
   */
  static getInstance(): NotificationService {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationService();
    }
    return NotificationManager.instance;
  }

  /**
   * Stop the notification service
   */
  static stop(): void {
    if (NotificationManager.instance) {
      NotificationManager.instance.stop();
      NotificationManager.instance = null;
    }
  }

  /**
   * Cleanup old notifications
   */
  static cleanup(): void {
    if (NotificationManager.instance) {
      NotificationManager.instance.cleanup();
    }
  }
}

export default NotificationManager;