import { v4 as uuidv4 } from 'uuid';
import { 
  NotificationMessage, 
  NotificationStatus, 
  NotificationType, 
  NotificationChannel, 
  NotificationPriority,
  QueuedNotification 
} from '../types/notification';
import { NotificationQueue } from './notification-queue';
import { NotificationTemplateService } from './notification-template';
import { NotificationPreferenceService } from './notification-preference';
import { NotificationDeliveryService } from './notification-delivery';

export interface SendNotificationOptions {
  userId: string;
  templateId: string;
  variables: Record<string, any>;
  channels?: NotificationChannel[];
  priority?: NotificationPriority;
  scheduledAt?: Date;
  metadata?: Record<string, any>;
}

export class NotificationService {
  private queue: NotificationQueue;
  private templateService: NotificationTemplateService;
  private preferenceService: NotificationPreferenceService;
  private deliveryService: NotificationDeliveryService;
  private messages: Map<string, NotificationMessage> = new Map();

  constructor() {
    this.queue = new NotificationQueue({
      maxConcurrency: 5,
      retryDelay: 5000,
      maxRetries: 3,
      processingTimeout: 30000
    });
    
    this.templateService = new NotificationTemplateService();
    this.preferenceService = new NotificationPreferenceService();
    this.deliveryService = new NotificationDeliveryService();
    
    this.setupQueueHandlers();
  }

  /**
   * Send notification to user
   */
  async sendNotification(options: SendNotificationOptions): Promise<string[]> {
    const { userId, templateId, variables, channels, priority = NotificationPriority.NORMAL, scheduledAt, metadata } = options;
    
    // Get template
    const template = this.templateService.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Validate template variables
    const validation = this.templateService.validateTemplateVariables(templateId, variables);
    if (!validation.valid) {
      throw new Error(`Missing template variables: ${validation.missingVariables.join(', ')}`);
    }

    // Get user preferences
    const preferences = await this.preferenceService.getUserPreferences(userId);
    
    // Determine channels to use
    const targetChannels = channels || await this.getEnabledChannels(userId, template.type);
    const enabledChannels = await this.filterEnabledChannels(targetChannels, preferences);
    
    if (enabledChannels.length === 0) {
      throw new Error('No enabled notification channels for user');
    }

    // Create notifications for each channel
    const messageIds: string[] = [];
    
    for (const channel of enabledChannels) {
      const messageId = uuidv4();
      messageIds.push(messageId);
      
      // Create notification message record
      const message: NotificationMessage = {
        messageId,
        userId,
        templateId,
        subject: '', // Will be filled when processed
        body: '', // Will be filled when processed
        type: template.type,
        channel,
        status: NotificationStatus.QUEUED,
        scheduledAt,
        retryCount: 0,
        maxRetries: 3,
        metadata,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      this.messages.set(messageId, message);
      
      // Queue for processing
      const queuedNotification: QueuedNotification = {
        messageId,
        userId,
        templateId,
        variables,
        channel,
        priority,
        scheduledAt,
        metadata
      };
      
      await this.queue.enqueue(queuedNotification);
    }
    
    return messageIds;
  }

  /**
   * Send notification to multiple users
   */
  async sendBulkNotification(options: Omit<SendNotificationOptions, 'userId'> & { userIds: string[] }): Promise<Record<string, string[]>> {
    const { userIds, ...notificationOptions } = options;
    const results: Record<string, string[]> = {};
    
    for (const userId of userIds) {
      try {
        const messageIds = await this.sendNotification({ ...notificationOptions, userId });
        results[userId] = messageIds;
      } catch (error) {
        console.error(`Failed to send notification to user ${userId}:`, error);
        results[userId] = [];
      }
    }
    
    return results;
  }

  /**
   * Get notification message by ID
   */
  getNotificationMessage(messageId: string): NotificationMessage | undefined {
    return this.messages.get(messageId);
  }

  /**
   * Get user notifications
   */
  getUserNotifications(userId: string): NotificationMessage[] {
    return Array.from(this.messages.values()).filter(message => message.userId === userId);
  }

  /**
   * Get queue statistics
   */
  getQueueStats() {
    return this.queue.getStats();
  }

  /**
   * Get failed notifications
   */
  getFailedNotifications() {
    return this.queue.getFailedNotifications();
  }

  /**
   * Setup queue event handlers
   */
  private setupQueueHandlers(): void {
    this.queue.on('process', async (notification: QueuedNotification, callback) => {
      try {
        const result = await this.processNotification(notification);
        callback({ success: result.success, error: result.errorMessage });
      } catch (error) {
        callback({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    this.queue.on('completed', (notification: QueuedNotification) => {
      const message = this.messages.get(notification.messageId);
      if (message) {
        message.status = NotificationStatus.SENT;
        message.sentAt = new Date();
        message.updatedAt = new Date();
      }
    });

    this.queue.on('failed', (notification: QueuedNotification, error: Error) => {
      const message = this.messages.get(notification.messageId);
      if (message) {
        message.status = NotificationStatus.FAILED;
        message.failedAt = new Date();
        message.errorMessage = error.message;
        message.updatedAt = new Date();
      }
    });

    this.queue.on('retrying', (notification: QueuedNotification) => {
      const message = this.messages.get(notification.messageId);
      if (message) {
        message.retryCount = (notification.metadata?.retryCount || 0);
        message.updatedAt = new Date();
      }
    });
  }

  /**
   * Process individual notification
   */
  private async processNotification(notification: QueuedNotification) {
    // Render template
    const rendered = this.templateService.renderTemplate(notification.templateId, notification.variables);
    if (!rendered) {
      throw new Error(`Failed to render template: ${notification.templateId}`);
    }

    // Update message with rendered content
    const message = this.messages.get(notification.messageId);
    if (message) {
      message.subject = rendered.subject;
      message.body = rendered.body;
      message.status = NotificationStatus.PENDING;
      message.updatedAt = new Date();
    }

    // Deliver notification
    return await this.deliveryService.deliver(notification, rendered.subject, rendered.body);
  }

  /**
   * Get enabled channels for user and notification type
   */
  private async getEnabledChannels(userId: string, notificationType: NotificationType): Promise<NotificationChannel[]> {
    const preferences = await this.preferenceService.getUserPreferences(userId);
    const channels: NotificationChannel[] = [];
    
    // Check if user wants this type of notification
    let typeEnabled = false;
    switch (notificationType) {
      case NotificationType.TOUR_UPDATE:
      case NotificationType.SCHEDULE_CHANGE:
        typeEnabled = preferences.tourUpdatesEnabled;
        break;
      case NotificationType.REGISTRATION_APPROVED:
      case NotificationType.REGISTRATION_REJECTED:
        typeEnabled = preferences.registrationUpdatesEnabled;
        break;
      case NotificationType.SYSTEM_ANNOUNCEMENT:
        typeEnabled = preferences.systemUpdatesEnabled;
        break;
      default:
        typeEnabled = true;
    }
    
    if (!typeEnabled) {
      return channels;
    }
    
    // Add enabled channels
    if (preferences.emailEnabled) channels.push(NotificationChannel.EMAIL);
    if (preferences.pushEnabled) channels.push(NotificationChannel.PUSH);
    if (preferences.smsEnabled) channels.push(NotificationChannel.SMS);
    
    // Always include in-app notifications
    channels.push(NotificationChannel.IN_APP);
    
    return channels;
  }

  /**
   * Filter channels based on user preferences
   */
  private async filterEnabledChannels(channels: NotificationChannel[], preferences: any): Promise<NotificationChannel[]> {
    return channels.filter(channel => {
      switch (channel) {
        case NotificationChannel.EMAIL:
          return preferences.emailEnabled;
        case NotificationChannel.PUSH:
          return preferences.pushEnabled;
        case NotificationChannel.SMS:
          return preferences.smsEnabled;
        case NotificationChannel.IN_APP:
          return true; // Always enabled
        default:
          return false;
      }
    });
  }

  /**
   * Get template service (for external access)
   */
  getTemplateService(): NotificationTemplateService {
    return this.templateService;
  }

  /**
   * Get preference service (for external access)
   */
  getPreferenceService(): NotificationPreferenceService {
    return this.preferenceService;
  }

  /**
   * Get delivery service (for external access)
   */
  getDeliveryService(): NotificationDeliveryService {
    return this.deliveryService;
  }

  /**
   * Stop the notification service
   */
  stop(): void {
    this.queue.stop();
  }

  /**
   * Cleanup old notifications
   */
  cleanup(): void {
    this.queue.cleanup();
    
    // Remove old completed messages (older than 7 days)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);
    
    for (const [messageId, message] of this.messages.entries()) {
      if (message.status === NotificationStatus.SENT && message.sentAt && message.sentAt < cutoffDate) {
        this.messages.delete(messageId);
      }
    }
  }
}