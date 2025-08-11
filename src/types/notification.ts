export interface NotificationTemplate {
  templateId: string;
  name: string;
  subject: string;
  body: string;
  type: NotificationType;
  variables: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationPreference {
  userId: string;
  emailEnabled: boolean;
  pushEnabled: boolean;
  smsEnabled: boolean;
  tourUpdatesEnabled: boolean;
  registrationUpdatesEnabled: boolean;
  systemUpdatesEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationMessage {
  messageId: string;
  userId: string;
  templateId: string;
  subject: string;
  body: string;
  type: NotificationType;
  channel: NotificationChannel;
  status: NotificationStatus;
  scheduledAt?: Date;
  sentAt?: Date;
  failedAt?: Date;
  retryCount: number;
  maxRetries: number;
  errorMessage?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface QueuedNotification {
  messageId: string;
  userId: string;
  templateId: string;
  variables: Record<string, any>;
  channel: NotificationChannel;
  priority: NotificationPriority;
  scheduledAt?: Date;
  metadata?: Record<string, any>;
}

export enum NotificationType {
  TOUR_UPDATE = 'TOUR_UPDATE',
  SCHEDULE_CHANGE = 'SCHEDULE_CHANGE',
  REGISTRATION_APPROVED = 'REGISTRATION_APPROVED',
  REGISTRATION_REJECTED = 'REGISTRATION_REJECTED',
  SYSTEM_ANNOUNCEMENT = 'SYSTEM_ANNOUNCEMENT',
  DOCUMENT_UPLOADED = 'DOCUMENT_UPLOADED'
}

export enum NotificationChannel {
  EMAIL = 'EMAIL',
  PUSH = 'PUSH',
  SMS = 'SMS',
  IN_APP = 'IN_APP'
}

export enum NotificationStatus {
  PENDING = 'PENDING',
  QUEUED = 'QUEUED',
  SENT = 'SENT',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

export enum NotificationPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}

export interface NotificationDeliveryResult {
  success: boolean;
  messageId: string;
  channel: NotificationChannel;
  sentAt?: Date;
  errorMessage?: string;
}

export interface NotificationQueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}