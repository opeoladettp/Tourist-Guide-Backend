import NotificationManager from './notification-manager';
import { NotificationChannel, NotificationPriority } from '../types/notification';
import { 
  sendTourScheduleUpdateNotification,
  sendTourUpdateNotification,
  sendRegistrationApprovedNotification,
  sendRegistrationRejectedNotification
} from '../utils/notification-helpers';

/**
 * Service for handling tour event related notifications
 */
export class TourEventNotificationService {
  
  /**
   * Notify tourists when tour event schedule is updated
   */
  async notifyTourScheduleUpdate(
    tourEventId: string,
    tourEventData: {
      customTourName: string;
      startDate: Date;
      endDate: Date;
      providerId: string;
    },
    registeredTourists: Array<{
      userId: string;
      firstName: string;
    }>,
    providerName: string,
    options?: {
      channels?: NotificationChannel[];
      priority?: NotificationPriority;
    }
  ): Promise<Record<string, string[]>> {
    const results: Record<string, string[]> = {};
    
    for (const tourist of registeredTourists) {
      try {
        const messageIds = await sendTourScheduleUpdateNotification(
          tourist.userId,
          {
            firstName: tourist.firstName,
            tourName: tourEventData.customTourName,
            startDate: tourEventData.startDate.toISOString().split('T')[0],
            endDate: tourEventData.endDate.toISOString().split('T')[0],
            providerName
          },
          {
            channels: options?.channels,
            priority: options?.priority || NotificationPriority.HIGH
          }
        );
        results[tourist.userId] = messageIds;
      } catch (error) {
        console.error(`Failed to send schedule update notification to user ${tourist.userId}:`, error);
        results[tourist.userId] = [];
      }
    }
    
    return results;
  }

  /**
   * Notify tourists when tour event details are updated
   */
  async notifyTourEventUpdate(
    tourEventId: string,
    updateMessage: string,
    tourEventData: {
      customTourName: string;
      providerId: string;
    },
    registeredTourists: Array<{
      userId: string;
      firstName: string;
    }>,
    providerName: string,
    options?: {
      channels?: NotificationChannel[];
      priority?: NotificationPriority;
    }
  ): Promise<Record<string, string[]>> {
    const results: Record<string, string[]> = {};
    
    for (const tourist of registeredTourists) {
      try {
        const messageIds = await sendTourUpdateNotification(
          tourist.userId,
          {
            firstName: tourist.firstName,
            tourName: tourEventData.customTourName,
            updateMessage,
            providerName
          },
          {
            channels: options?.channels,
            priority: options?.priority || NotificationPriority.NORMAL
          }
        );
        results[tourist.userId] = messageIds;
      } catch (error) {
        console.error(`Failed to send tour update notification to user ${tourist.userId}:`, error);
        results[tourist.userId] = [];
      }
    }
    
    return results;
  }

  /**
   * Notify tourist when their registration is approved
   */
  async notifyRegistrationApproved(
    touristData: {
      userId: string;
      firstName: string;
    },
    tourEventData: {
      customTourName: string;
      startDate: Date;
      endDate: Date;
      place1Hotel: string; // Use as meeting point
    },
    providerName: string,
    options?: {
      channels?: NotificationChannel[];
      priority?: NotificationPriority;
    }
  ): Promise<string[]> {
    try {
      return await sendRegistrationApprovedNotification(
        touristData.userId,
        {
          firstName: touristData.firstName,
          tourName: tourEventData.customTourName,
          startDate: tourEventData.startDate.toISOString().split('T')[0],
          endDate: tourEventData.endDate.toISOString().split('T')[0],
          meetingPoint: tourEventData.place1Hotel,
          providerName
        },
        {
          channels: options?.channels,
          priority: options?.priority || NotificationPriority.HIGH
        }
      );
    } catch (error) {
      console.error(`Failed to send registration approved notification to user ${touristData.userId}:`, error);
      return [];
    }
  }

  /**
   * Notify tourist when their registration is rejected
   */
  async notifyRegistrationRejected(
    touristData: {
      userId: string;
      firstName: string;
    },
    tourEventData: {
      customTourName: string;
    },
    rejectionReason: string,
    providerName: string,
    options?: {
      channels?: NotificationChannel[];
      priority?: NotificationPriority;
    }
  ): Promise<string[]> {
    try {
      return await sendRegistrationRejectedNotification(
        touristData.userId,
        {
          firstName: touristData.firstName,
          tourName: tourEventData.customTourName,
          rejectionReason,
          providerName
        },
        {
          channels: options?.channels,
          priority: options?.priority || NotificationPriority.HIGH
        }
      );
    } catch (error) {
      console.error(`Failed to send registration rejected notification to user ${touristData.userId}:`, error);
      return [];
    }
  }

  /**
   * Notify tourists when tour event is cancelled
   */
  async notifyTourEventCancelled(
    tourEventId: string,
    tourEventData: {
      customTourName: string;
      startDate: Date;
      endDate: Date;
    },
    registeredTourists: Array<{
      userId: string;
      firstName: string;
    }>,
    cancellationReason: string,
    providerName: string,
    options?: {
      channels?: NotificationChannel[];
      priority?: NotificationPriority;
    }
  ): Promise<Record<string, string[]>> {
    const updateMessage = `Unfortunately, your tour "${tourEventData.customTourName}" scheduled from ${tourEventData.startDate.toISOString().split('T')[0]} to ${tourEventData.endDate.toISOString().split('T')[0]} has been cancelled. Reason: ${cancellationReason}. We apologize for any inconvenience caused.`;
    
    return await this.notifyTourEventUpdate(
      tourEventId,
      updateMessage,
      {
        customTourName: tourEventData.customTourName,
        providerId: tourEventData.providerId || ''
      },
      registeredTourists,
      providerName,
      {
        channels: options?.channels,
        priority: options?.priority || NotificationPriority.URGENT
      }
    );
  }

  /**
   * Notify tourists when tour event capacity changes
   */
  async notifyCapacityUpdate(
    tourEventId: string,
    tourEventData: {
      customTourName: string;
      numberOfAllowedTourists: number;
      remainingTourists: number;
    },
    registeredTourists: Array<{
      userId: string;
      firstName: string;
    }>,
    providerName: string,
    options?: {
      channels?: NotificationChannel[];
      priority?: NotificationPriority;
    }
  ): Promise<Record<string, string[]>> {
    const updateMessage = `The capacity for your tour "${tourEventData.customTourName}" has been updated. Total capacity: ${tourEventData.numberOfAllowedTourists} tourists, Remaining spots: ${tourEventData.remainingTourists}.`;
    
    return await this.notifyTourEventUpdate(
      tourEventId,
      updateMessage,
      {
        customTourName: tourEventData.customTourName,
        providerId: ''
      },
      registeredTourists,
      providerName,
      {
        channels: options?.channels,
        priority: options?.priority || NotificationPriority.LOW
      }
    );
  }

  /**
   * Notify tourists when activities are added/updated in their tour
   */
  async notifyActivityUpdate(
    tourEventId: string,
    tourEventData: {
      customTourName: string;
    },
    activityData: {
      activityName: string;
      activityDate: Date;
      startTime: string;
      endTime: string;
      location?: string;
    },
    registeredTourists: Array<{
      userId: string;
      firstName: string;
    }>,
    providerName: string,
    updateType: 'added' | 'updated' | 'cancelled',
    options?: {
      channels?: NotificationChannel[];
      priority?: NotificationPriority;
    }
  ): Promise<Record<string, string[]>> {
    const actionText = updateType === 'added' ? 'added to' : updateType === 'updated' ? 'updated in' : 'cancelled from';
    const locationText = activityData.location ? ` at ${activityData.location}` : '';
    
    const updateMessage = `Activity "${activityData.activityName}" has been ${actionText} your tour "${tourEventData.customTourName}". Scheduled for ${activityData.activityDate.toISOString().split('T')[0]} from ${activityData.startTime} to ${activityData.endTime}${locationText}.`;
    
    return await this.notifyTourEventUpdate(
      tourEventId,
      updateMessage,
      {
        customTourName: tourEventData.customTourName,
        providerId: ''
      },
      registeredTourists,
      providerName,
      {
        channels: options?.channels,
        priority: options?.priority || NotificationPriority.NORMAL
      }
    );
  }

  /**
   * Get notification delivery statistics for a tour event
   */
  getNotificationStats() {
    const notificationService = NotificationManager.getInstance();
    return notificationService.getQueueStats();
  }

  /**
   * Get failed notifications for retry
   */
  getFailedNotifications() {
    const notificationService = NotificationManager.getInstance();
    return notificationService.getFailedNotifications();
  }
}

// Export singleton instance
export const tourEventNotificationService = new TourEventNotificationService();