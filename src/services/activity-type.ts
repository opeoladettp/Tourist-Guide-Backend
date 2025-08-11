import { PrismaClient } from '../generated/prisma';
import { CreateActivityTypeInput, UpdateActivityTypeInput, ActivityType } from '../types/activity-type';
import { UserType } from '../types/user';
import { 
  createActivityTypeSchema, 
  updateActivityTypeSchema, 
  activityTypeIdSchema 
} from '../validation/activity-type';

export class ActivityTypeService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new activity type (System Admin only)
   */
  async createActivityType(
    input: CreateActivityTypeInput,
    requestingUserId: string,
    requestingUserType: UserType
  ): Promise<ActivityType> {
    // Only system admin can create activity types
    if (requestingUserType !== UserType.SYSTEM_ADMIN) {
      throw new Error('Only System Administrators can create activity types');
    }

    // Validate input
    const { error, value } = createActivityTypeSchema.validate(input);
    if (error) {
      throw new Error(`Validation error: ${error.details.map(d => d.message).join(', ')}`);
    }

    // Check if activity type name already exists
    const existingType = await this.prisma.activityType.findUnique({
      where: { typeName: value.typeName }
    });

    if (existingType) {
      throw new Error('Activity type with this name already exists');
    }

    // Create activity type
    const activityType = await this.prisma.activityType.create({
      data: {
        typeName: value.typeName,
        description: value.description || null,
        isDefault: value.isDefault ?? true,
        isActive: value.isActive ?? true
      }
    });

    return activityType;
  }

  /**
   * Get activity type by ID
   */
  async getActivityTypeById(
    activityTypeId: string,
    requestingUserId: string,
    requestingUserType: UserType
  ): Promise<ActivityType | null> {
    // Validate activity type ID
    const { error } = activityTypeIdSchema.validate(activityTypeId);
    if (error) {
      throw new Error(`Invalid activity type ID: ${error.details[0].message}`);
    }

    const activityType = await this.prisma.activityType.findUnique({
      where: { activityTypeId }
    });

    return activityType;
  }

  /**
   * Get all activity types
   */
  async getActivityTypes(
    requestingUserId: string,
    requestingUserType: UserType,
    activeOnly: boolean = true
  ): Promise<ActivityType[]> {
    const whereClause: any = {};
    
    if (activeOnly) {
      whereClause.isActive = true;
    }

    const activityTypes = await this.prisma.activityType.findMany({
      where: whereClause,
      orderBy: [
        { isDefault: 'desc' }, // Default types first
        { typeName: 'asc' }
      ]
    });

    return activityTypes;
  }

  /**
   * Update activity type (System Admin only)
   */
  async updateActivityType(
    activityTypeId: string,
    input: UpdateActivityTypeInput,
    requestingUserId: string,
    requestingUserType: UserType
  ): Promise<ActivityType> {
    // Only system admin can update activity types
    if (requestingUserType !== UserType.SYSTEM_ADMIN) {
      throw new Error('Only System Administrators can update activity types');
    }

    // Validate input
    const { error, value } = updateActivityTypeSchema.validate(input);
    if (error) {
      throw new Error(`Validation error: ${error.details.map(d => d.message).join(', ')}`);
    }

    // Check if activity type exists
    const existingType = await this.getActivityTypeById(
      activityTypeId,
      requestingUserId,
      requestingUserType
    );

    if (!existingType) {
      throw new Error('Activity type not found');
    }

    // Check if new name conflicts with existing types (if name is being updated)
    if (value.typeName && value.typeName !== existingType.typeName) {
      const conflictingType = await this.prisma.activityType.findUnique({
        where: { typeName: value.typeName }
      });

      if (conflictingType) {
        throw new Error('Activity type with this name already exists');
      }
    }

    // Update activity type
    const updatedActivityType = await this.prisma.activityType.update({
      where: { activityTypeId },
      data: {
        typeName: value.typeName ?? existingType.typeName,
        description: value.description !== undefined ? value.description : existingType.description,
        isDefault: value.isDefault ?? existingType.isDefault,
        isActive: value.isActive ?? existingType.isActive
      }
    });

    return updatedActivityType;
  }

  /**
   * Delete activity type (System Admin only)
   */
  async deleteActivityType(
    activityTypeId: string,
    requestingUserId: string,
    requestingUserType: UserType
  ): Promise<void> {
    // Only system admin can delete activity types
    if (requestingUserType !== UserType.SYSTEM_ADMIN) {
      throw new Error('Only System Administrators can delete activity types');
    }

    // Check if activity type exists
    const existingType = await this.getActivityTypeById(
      activityTypeId,
      requestingUserId,
      requestingUserType
    );

    if (!existingType) {
      throw new Error('Activity type not found');
    }

    // Check if activity type is being used in any activities
    const activitiesUsingType = await this.prisma.activity.findFirst({
      where: { activityType: existingType.typeName }
    });

    if (activitiesUsingType) {
      throw new Error('Cannot delete activity type that is being used in activities. Consider deactivating it instead.');
    }

    // Delete activity type
    await this.prisma.activityType.delete({
      where: { activityTypeId }
    });
  }

  /**
   * Get default activity types
   */
  async getDefaultActivityTypes(): Promise<string[]> {
    const defaultTypes = await this.prisma.activityType.findMany({
      where: {
        isDefault: true,
        isActive: true
      },
      select: {
        typeName: true
      },
      orderBy: {
        typeName: 'asc'
      }
    });

    return defaultTypes.map(type => type.typeName);
  }

  /**
   * Check for activity scheduling conflicts
   */
  async checkSchedulingConflicts(
    tourEventId: string,
    activityDate: Date,
    startTime: string,
    endTime: string,
    excludeActivityId?: string
  ): Promise<boolean> {
    const whereClause: any = {
      tourEventId,
      activityDate,
      OR: [
        {
          AND: [
            { startTime: { lte: startTime } },
            { endTime: { gt: startTime } }
          ]
        },
        {
          AND: [
            { startTime: { lt: endTime } },
            { endTime: { gte: endTime } }
          ]
        },
        {
          AND: [
            { startTime: { gte: startTime } },
            { endTime: { lte: endTime } }
          ]
        }
      ]
    };

    if (excludeActivityId) {
      whereClause.activityId = { not: excludeActivityId };
    }

    const conflictingActivity = await this.prisma.activity.findFirst({
      where: whereClause
    });

    return !!conflictingActivity;
  }

  /**
   * Get activity statistics
   */
  async getActivityTypeStatistics(
    requestingUserId: string,
    requestingUserType: UserType
  ): Promise<{ typeName: string; count: number; isDefault: boolean }[]> {
    // Only system admin can view statistics
    if (requestingUserType !== UserType.SYSTEM_ADMIN) {
      throw new Error('Only System Administrators can view activity type statistics');
    }

    const statistics = await this.prisma.activityType.findMany({
      select: {
        typeName: true,
        isDefault: true
      }
    });

    // Get activity counts for each type
    const statisticsWithCounts = await Promise.all(
      statistics.map(async (stat) => {
        const count = await this.prisma.activity.count({
          where: { activityType: stat.typeName }
        });

        return {
          typeName: stat.typeName,
          count,
          isDefault: stat.isDefault
        };
      })
    );

    return statisticsWithCounts.sort((a, b) => b.count - a.count);
  }
}