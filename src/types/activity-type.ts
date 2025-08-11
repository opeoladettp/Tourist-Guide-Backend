export interface ActivityType {
  activityTypeId: string;
  typeName: string;
  description?: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateActivityTypeInput {
  typeName: string;
  description?: string | null;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface UpdateActivityTypeInput {
  typeName?: string;
  description?: string | null;
  isDefault?: boolean;
  isActive?: boolean;
}