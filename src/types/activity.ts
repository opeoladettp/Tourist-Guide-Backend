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

export interface CreateActivityInput {
  tourEventId: string;
  activityDate: Date;
  startTime: string;
  endTime: string;
  activityName: string;
  description?: string | null;
  location?: string | null;
  activityType: string;
  isOptional?: boolean;
}

export interface UpdateActivityInput {
  activityDate?: Date;
  startTime?: string;
  endTime?: string;
  activityName?: string;
  description?: string | null;
  location?: string | null;
  activityType?: string;
  isOptional?: boolean;
}