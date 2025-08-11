export enum TourEventStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  FULL = 'FULL',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export enum RegistrationStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED'
}

export interface TouristRegistration {
  registrationId: string;
  tourEventId: string;
  touristUserId: string;
  registrationDate: Date;
  status: RegistrationStatus;
  approvedByUserId?: string | null;
  approvedDate?: Date | null;
  rejectedReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Activity {
  activityId: string;
  tourEventId: string;
  activityDate: Date;
  startTime: string;
  endTime: string;
  activityName: string;
  description?: string | null;
  location?: string | null;
  activityType: string;
  isOptional: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomTourEvent {
  tourEventId: string;
  providerId: string;
  templateId?: string | null;
  customTourName: string;
  startDate: Date;
  endDate: Date;
  packageType: string;
  place1Hotel: string;
  place2Hotel: string;
  numberOfAllowedTourists: number;
  remainingTourists: number;
  groupChatInfo?: string | null;
  status: TourEventStatus;
  createdAt: Date;
  updatedAt: Date;
  registrations?: TouristRegistration[];
  activities?: Activity[];
}

export interface CreateCustomTourEventInput {
  templateId?: string;
  customTourName: string;
  startDate: Date;
  endDate: Date;
  packageType: string;
  place1Hotel: string;
  place2Hotel: string;
  numberOfAllowedTourists: number;
  groupChatInfo?: string;
}

export interface UpdateCustomTourEventInput {
  customTourName?: string;
  startDate?: Date;
  endDate?: Date;
  packageType?: string;
  place1Hotel?: string;
  place2Hotel?: string;
  numberOfAllowedTourists?: number;
  groupChatInfo?: string;
  status?: TourEventStatus;
}

export interface TouristRegistrationInput {
  tourEventId: string;
}

export interface RegistrationApprovalInput {
  registrationId: string;
  approved: boolean;
  rejectedReason?: string;
}

export interface CreateActivityInput {
  activityDate: Date;
  startTime: string;
  endTime: string;
  activityName: string;
  description?: string;
  location?: string;
  activityType: string;
  isOptional?: boolean;
}

export interface UpdateActivityInput {
  activityDate?: Date;
  startTime?: string;
  endTime?: string;
  activityName?: string;
  description?: string;
  location?: string;
  activityType?: string;
  isOptional?: boolean;
}