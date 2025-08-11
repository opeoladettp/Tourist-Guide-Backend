import NotificationManager from '../services/notification-manager';
import { NotificationChannel, NotificationPriority } from '../types/notification';

/**
 * Helper functions for common notification scenarios
 */

/**
 * Send tour schedule update notification
 */
export async function sendTourScheduleUpdateNotification(
  userId: string,
  tourData: {
    firstName: string;
    tourName: string;
    startDate: string;
    endDate: string;
    providerName: string;
  },
  options?: {
    channels?: NotificationChannel[];
    priority?: NotificationPriority;
  }
): Promise<string[]> {
  const notificationService = NotificationManager.getInstance();
  
  return await notificationService.sendNotification({
    userId,
    templateId: 'tour-schedule-updated',
    variables: tourData,
    channels: options?.channels,
    priority: options?.priority || NotificationPriority.NORMAL
  });
}

/**
 * Send registration approval notification
 */
export async function sendRegistrationApprovedNotification(
  userId: string,
  tourData: {
    firstName: string;
    tourName: string;
    startDate: string;
    endDate: string;
    meetingPoint: string;
    providerName: string;
  },
  options?: {
    channels?: NotificationChannel[];
    priority?: NotificationPriority;
  }
): Promise<string[]> {
  const notificationService = NotificationManager.getInstance();
  
  return await notificationService.sendNotification({
    userId,
    templateId: 'registration-approved',
    variables: tourData,
    channels: options?.channels,
    priority: options?.priority || NotificationPriority.HIGH
  });
}

/**
 * Send registration rejection notification
 */
export async function sendRegistrationRejectedNotification(
  userId: string,
  tourData: {
    firstName: string;
    tourName: string;
    rejectionReason: string;
    providerName: string;
  },
  options?: {
    channels?: NotificationChannel[];
    priority?: NotificationPriority;
  }
): Promise<string[]> {
  const notificationService = NotificationManager.getInstance();
  
  return await notificationService.sendNotification({
    userId,
    templateId: 'registration-rejected',
    variables: tourData,
    channels: options?.channels,
    priority: options?.priority || NotificationPriority.HIGH
  });
}

/**
 * Send general tour update notification
 */
export async function sendTourUpdateNotification(
  userId: string,
  tourData: {
    firstName: string;
    tourName: string;
    updateMessage: string;
    providerName: string;
  },
  options?: {
    channels?: NotificationChannel[];
    priority?: NotificationPriority;
  }
): Promise<string[]> {
  const notificationService = NotificationManager.getInstance();
  
  return await notificationService.sendNotification({
    userId,
    templateId: 'tour-update-general',
    variables: tourData,
    channels: options?.channels,
    priority: options?.priority || NotificationPriority.NORMAL
  });
}

/**
 * Send document uploaded notification
 */
export async function sendDocumentUploadedNotification(
  userId: string,
  documentData: {
    firstName: string;
    documentName: string;
    documentType: string;
    uploaderName: string;
    providerName: string;
  },
  options?: {
    channels?: NotificationChannel[];
    priority?: NotificationPriority;
  }
): Promise<string[]> {
  const notificationService = NotificationManager.getInstance();
  
  return await notificationService.sendNotification({
    userId,
    templateId: 'document-uploaded',
    variables: documentData,
    channels: options?.channels,
    priority: options?.priority || NotificationPriority.LOW
  });
}

/**
 * Send bulk notifications to multiple users
 */
export async function sendBulkTourUpdateNotification(
  userIds: string[],
  tourData: {
    firstName: string;
    tourName: string;
    updateMessage: string;
    providerName: string;
  },
  options?: {
    channels?: NotificationChannel[];
    priority?: NotificationPriority;
  }
): Promise<Record<string, string[]>> {
  const notificationService = NotificationManager.getInstance();
  
  return await notificationService.sendBulkNotification({
    userIds,
    templateId: 'tour-update-general',
    variables: tourData,
    channels: options?.channels,
    priority: options?.priority || NotificationPriority.NORMAL
  });
}

/**
 * Get notification statistics
 */
export function getNotificationStats() {
  const notificationService = NotificationManager.getInstance();
  return notificationService.getQueueStats();
}

/**
 * Get user's in-app messages
 */
export function getUserInAppMessages(userId: string) {
  const notificationService = NotificationManager.getInstance();
  return notificationService.getDeliveryService().getUserInAppMessages(userId);
}

/**
 * Clear user's in-app messages
 */
export function clearUserInAppMessages(userId: string) {
  const notificationService = NotificationManager.getInstance();
  return notificationService.getDeliveryService().clearUserInAppMessages(userId);
}

/**
 * Get user notification preferences
 */
export async function getUserNotificationPreferences(userId: string) {
  const notificationService = NotificationManager.getInstance();
  return await notificationService.getPreferenceService().getUserPreferences(userId);
}

/**
 * Update user notification preferences
 */
export async function updateUserNotificationPreferences(
  userId: string,
  preferences: {
    emailEnabled?: boolean;
    pushEnabled?: boolean;
    smsEnabled?: boolean;
    tourUpdatesEnabled?: boolean;
    registrationUpdatesEnabled?: boolean;
    systemUpdatesEnabled?: boolean;
  }
) {
  const notificationService = NotificationManager.getInstance();
  return await notificationService.getPreferenceService().updateUserPreferences(userId, preferences);
}