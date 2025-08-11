import { 
  NotificationChannel, 
  NotificationDeliveryResult, 
  QueuedNotification 
} from '../types/notification';

export interface DeliveryProvider {
  send(notification: QueuedNotification, subject: string, body: string): Promise<NotificationDeliveryResult>;
}

export class EmailDeliveryProvider implements DeliveryProvider {
  async send(notification: QueuedNotification, subject: string, body: string): Promise<NotificationDeliveryResult> {
    try {
      // Simulate email sending - in production, integrate with actual email service
      console.log(`Sending email to user ${notification.userId}:`);
      console.log(`Subject: ${subject}`);
      console.log(`Body: ${body}`);
      
      // Simulate network delay
      await this.delay(100);
      
      // Simulate occasional failures for testing
      if (Math.random() < 0.05) { // 5% failure rate
        throw new Error('Email service temporarily unavailable');
      }
      
      return {
        success: true,
        messageId: notification.messageId,
        channel: NotificationChannel.EMAIL,
        sentAt: new Date()
      };
    } catch (error) {
      return {
        success: false,
        messageId: notification.messageId,
        channel: NotificationChannel.EMAIL,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export class PushDeliveryProvider implements DeliveryProvider {
  async send(notification: QueuedNotification, subject: string, body: string): Promise<NotificationDeliveryResult> {
    try {
      // Simulate push notification sending
      console.log(`Sending push notification to user ${notification.userId}:`);
      console.log(`Title: ${subject}`);
      console.log(`Message: ${body}`);
      
      await this.delay(50);
      
      // Simulate occasional failures
      if (Math.random() < 0.03) { // 3% failure rate
        throw new Error('Push service unavailable');
      }
      
      return {
        success: true,
        messageId: notification.messageId,
        channel: NotificationChannel.PUSH,
        sentAt: new Date()
      };
    } catch (error) {
      return {
        success: false,
        messageId: notification.messageId,
        channel: NotificationChannel.PUSH,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export class SMSDeliveryProvider implements DeliveryProvider {
  async send(notification: QueuedNotification, subject: string, body: string): Promise<NotificationDeliveryResult> {
    try {
      // Simulate SMS sending
      console.log(`Sending SMS to user ${notification.userId}:`);
      console.log(`Message: ${body}`);
      
      await this.delay(200);
      
      // Simulate occasional failures
      if (Math.random() < 0.02) { // 2% failure rate
        throw new Error('SMS gateway error');
      }
      
      return {
        success: true,
        messageId: notification.messageId,
        channel: NotificationChannel.SMS,
        sentAt: new Date()
      };
    } catch (error) {
      return {
        success: false,
        messageId: notification.messageId,
        channel: NotificationChannel.SMS,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export class InAppDeliveryProvider implements DeliveryProvider {
  private inAppMessages: Map<string, Array<{ subject: string; body: string; timestamp: Date }>> = new Map();

  async send(notification: QueuedNotification, subject: string, body: string): Promise<NotificationDeliveryResult> {
    try {
      // Store in-app notification
      const userMessages = this.inAppMessages.get(notification.userId) || [];
      userMessages.push({
        subject,
        body,
        timestamp: new Date()
      });
      this.inAppMessages.set(notification.userId, userMessages);
      
      console.log(`In-app notification stored for user ${notification.userId}`);
      
      return {
        success: true,
        messageId: notification.messageId,
        channel: NotificationChannel.IN_APP,
        sentAt: new Date()
      };
    } catch (error) {
      return {
        success: false,
        messageId: notification.messageId,
        channel: NotificationChannel.IN_APP,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get in-app messages for a user
   */
  getUserMessages(userId: string): Array<{ subject: string; body: string; timestamp: Date }> {
    return this.inAppMessages.get(userId) || [];
  }

  /**
   * Clear messages for a user
   */
  clearUserMessages(userId: string): void {
    this.inAppMessages.delete(userId);
  }
}

export class NotificationDeliveryService {
  private providers: Map<NotificationChannel, DeliveryProvider> = new Map();

  constructor() {
    this.providers.set(NotificationChannel.EMAIL, new EmailDeliveryProvider());
    this.providers.set(NotificationChannel.PUSH, new PushDeliveryProvider());
    this.providers.set(NotificationChannel.SMS, new SMSDeliveryProvider());
    this.providers.set(NotificationChannel.IN_APP, new InAppDeliveryProvider());
  }

  /**
   * Deliver notification through specified channel
   */
  async deliver(notification: QueuedNotification, subject: string, body: string): Promise<NotificationDeliveryResult> {
    const provider = this.providers.get(notification.channel);
    
    if (!provider) {
      return {
        success: false,
        messageId: notification.messageId,
        channel: notification.channel,
        errorMessage: `No delivery provider configured for channel: ${notification.channel}`
      };
    }

    return await provider.send(notification, subject, body);
  }

  /**
   * Register custom delivery provider
   */
  registerProvider(channel: NotificationChannel, provider: DeliveryProvider): void {
    this.providers.set(channel, provider);
  }

  /**
   * Get available channels
   */
  getAvailableChannels(): NotificationChannel[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get in-app messages for a user (convenience method)
   */
  getUserInAppMessages(userId: string): Array<{ subject: string; body: string; timestamp: Date }> {
    const provider = this.providers.get(NotificationChannel.IN_APP) as InAppDeliveryProvider;
    return provider ? provider.getUserMessages(userId) : [];
  }

  /**
   * Clear in-app messages for a user (convenience method)
   */
  clearUserInAppMessages(userId: string): void {
    const provider = this.providers.get(NotificationChannel.IN_APP) as InAppDeliveryProvider;
    if (provider) {
      provider.clearUserMessages(userId);
    }
  }
}