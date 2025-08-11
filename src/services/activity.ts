import { PrismaClient } from '../generated/prisma';
import { CreateActivityInput, UpdateActivityInput, Activity } from '../types/activity';
import { UserType } from '../types/user';
import { 
  createActivitySchema, 
  updateActivitySchema, 
  activityIdSchema,
  validateTimeOrder,
  checkActivityConflict,
  defaultActivityTypes
} from '../validation/activity';
import { formatCalendarDate } from '../utils/calendar';
import { tourEventNotificationService } from './tour-event-notifications';
import { RegistrationStatus } from '../types/custom-tour-event';

export class ActivityService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new activity for a tour event
   */
  async createActivity(
    input: CreateActivityInput,
    requestingUserId: string,
    requestingUserType: UserType,
    requestingUserProviderId?: string
  ): Promise<Activity> {
    // Validate input
    const { error, value } = createActivitySchema.validate(input);
    if (error) {
      throw new Error(`Validation error: ${error.details.map(d => d.message).join(', ')}`);
    }

    // Validate time order
    if (!validateTimeOrder(value.startTime, value.endTime)) {
      throw new Error('Start time must be before end time');
    }

    // Check if tour event exists and user has permission
    const tourEvent = await this.prisma.customTourEvent.findUnique({
      where: { tourEventId: value.tourEventId },
      include: { provider: true }
    });

    if (!tourEvent) {
      throw new Error('Tour event not found');
    }

    // Permission check - only provider admin of the tour event or system admin can create activities
    if (requestingUserType === UserType.TOURIST) {
      throw new Error('Tourists cannot create activities');
    }

    if (requestingUserType === UserType.PROVIDER_ADMIN) {
      if (tourEvent.providerId !== requestingUserProviderId) {
        throw new Error('Insufficient permissions to create activities for this tour event');
      }
    }

    // Check for activity conflicts
    const existingActivities = await this.prisma.activity.findMany({
      where: { tourEventId: value.tourEventId },
      select: { activityDate: true, startTime: true, endTime: true }
    });

    if (checkActivityConflict(value, existingActivities)) {
      throw new Error('Activity conflicts with existing activity on the same date and time');
    }

    // Validate activity date is within tour event date range
    if (value.activityDate < tourEvent.startDate || value.activityDate > tourEvent.endDate) {
      throw new Error('Activity date must be within tour event date range');
    }

    // Create activity
    const activity = await this.prisma.activity.create({
      data: {
        tourEventId: value.tourEventId,
        activityDate: value.activityDate,
        startTime: value.startTime,
        endTime: value.endTime,
        activityName: value.activityName,
        description: value.description || null,
        location: value.location || null,
        activityType: value.activityType,
        isOptional: value.isOptional ?? false
      }
    });

    // Send notifications to registered tourists
    try {
      await this.notifyActivityChange(
        value.tourEventId,
        {
          activityName: value.activityName,
          activityDate: value.activityDate,
          startTime: value.startTime,
          endTime: value.endTime,
          location: value.location
        },
        'added'
      );
    } catch (notificationError) {
      // Log notification errors but don't fail the activity creation
      console.error('Failed to send activity creation notifications:', notificationError);
    }

    return activity;
  }

  /**
   * Get activity by ID with role-based access control
   */
  async getActivityById(
    activityId: string,
    requestingUserId: string,
    requestingUserType: UserType,
    requestingUserProviderId?: string
  ): Promise<Activity | null> {
    // Validate activity ID
    const { error } = activityIdSchema.validate(activityId);
    if (error) {
      throw new Error(`Invalid activity ID: ${error.details[0].message}`);
    }

    const activity = await this.prisma.activity.findUnique({
      where: { activityId },
      include: {
        tourEvent: {
          include: {
            provider: true,
            registrations: {
              where: { status: 'APPROVED' },
              select: { touristUserId: true }
            }
          }
        }
      }
    });

    if (!activity) {
      return null;
    }

    // Role-based access control
    if (requestingUserType === UserType.SYSTEM_ADMIN) {
      // System admin can access any activity
      return activity;
    } else if (requestingUserType === UserType.PROVIDER_ADMIN) {
      // Provider admin can access activities of their tour events
      if (activity.tourEvent.providerId === requestingUserProviderId) {
        return activity;
      }
    } else if (requestingUserType === UserType.TOURIST) {
      // Tourist can access activities of tour events they are registered for
      const isRegistered = activity.tourEvent.registrations.some(
        reg => reg.touristUserId === requestingUserId
      );
      if (isRegistered) {
        return activity;
      }
    }

    throw new Error('Insufficient permissions to access this activity');
  }

  /**
   * Get activities for a tour event
   */
  async getTourEventActivities(
    tourEventId: string,
    requestingUserId: string,
    requestingUserType: UserType,
    requestingUserProviderId?: string
  ): Promise<Activity[]> {
    // Check if tour event exists and user has permission
    const tourEvent = await this.prisma.customTourEvent.findUnique({
      where: { tourEventId },
      include: {
        provider: true,
        registrations: {
          where: { status: 'APPROVED' },
          select: { touristUserId: true }
        }
      }
    });

    if (!tourEvent) {
      throw new Error('Tour event not found');
    }

    // Permission check
    let hasAccess = false;
    if (requestingUserType === UserType.SYSTEM_ADMIN) {
      hasAccess = true;
    } else if (requestingUserType === UserType.PROVIDER_ADMIN) {
      hasAccess = tourEvent.providerId === requestingUserProviderId;
    } else if (requestingUserType === UserType.TOURIST) {
      hasAccess = tourEvent.registrations.some(reg => reg.touristUserId === requestingUserId);
    }

    if (!hasAccess) {
      throw new Error('Insufficient permissions to access activities for this tour event');
    }

    const activities = await this.prisma.activity.findMany({
      where: { tourEventId },
      orderBy: [
        { activityDate: 'asc' },
        { startTime: 'asc' }
      ]
    });

    return activities;
  }

  /**
   * Update activity
   */
  async updateActivity(
    activityId: string,
    input: UpdateActivityInput,
    requestingUserId: string,
    requestingUserType: UserType,
    requestingUserProviderId?: string
  ): Promise<Activity> {
    // Validate input
    const { error, value } = updateActivitySchema.validate(input);
    if (error) {
      throw new Error(`Validation error: ${error.details.map(d => d.message).join(', ')}`);
    }

    // Get existing activity and check permissions
    const existingActivity = await this.getActivityById(
      activityId,
      requestingUserId,
      requestingUserType,
      requestingUserProviderId
    );

    if (!existingActivity) {
      throw new Error('Activity not found');
    }

    // Only provider admin or system admin can update activities
    if (requestingUserType === UserType.TOURIST) {
      throw new Error('Tourists cannot update activities');
    }

    // Validate time order if both times are being updated
    const newStartTime = value.startTime ?? existingActivity.startTime;
    const newEndTime = value.endTime ?? existingActivity.endTime;
    
    if (!validateTimeOrder(newStartTime, newEndTime)) {
      throw new Error('Start time must be before end time');
    }

    // Check for conflicts if date or time is being updated
    if (value.activityDate || value.startTime || value.endTime) {
      const newActivityData = {
        activityDate: value.activityDate ?? existingActivity.activityDate,
        startTime: newStartTime,
        endTime: newEndTime
      };

      const existingActivities = await this.prisma.activity.findMany({
        where: { 
          tourEventId: existingActivity.tourEventId,
          activityId: { not: activityId } // Exclude current activity
        },
        select: { activityDate: true, startTime: true, endTime: true }
      });

      if (checkActivityConflict(newActivityData, existingActivities)) {
        throw new Error('Updated activity conflicts with existing activity on the same date and time');
      }
    }

    // Validate activity date is within tour event date range if being updated
    if (value.activityDate) {
      const tourEvent = await this.prisma.customTourEvent.findUnique({
        where: { tourEventId: existingActivity.tourEventId }
      });

      if (tourEvent && (value.activityDate < tourEvent.startDate || value.activityDate > tourEvent.endDate)) {
        throw new Error('Activity date must be within tour event date range');
      }
    }

    // Update activity
    const updatedActivity = await this.prisma.activity.update({
      where: { activityId },
      data: {
        activityDate: value.activityDate ?? existingActivity.activityDate,
        startTime: value.startTime ?? existingActivity.startTime,
        endTime: value.endTime ?? existingActivity.endTime,
        activityName: value.activityName ?? existingActivity.activityName,
        description: value.description !== undefined ? value.description : existingActivity.description,
        location: value.location !== undefined ? value.location : existingActivity.location,
        activityType: value.activityType ?? existingActivity.activityType,
        isOptional: value.isOptional ?? existingActivity.isOptional
      }
    });

    // Send notifications to registered tourists
    try {
      await this.notifyActivityChange(
        existingActivity.tourEventId,
        {
          activityName: updatedActivity.activityName,
          activityDate: updatedActivity.activityDate,
          startTime: updatedActivity.startTime,
          endTime: updatedActivity.endTime,
          location: updatedActivity.location
        },
        'updated'
      );
    } catch (notificationError) {
      // Log notification errors but don't fail the activity update
      console.error('Failed to send activity update notifications:', notificationError);
    }

    return updatedActivity;
  }

  /**
   * Delete activity
   */
  async deleteActivity(
    activityId: string,
    requestingUserId: string,
    requestingUserType: UserType,
    requestingUserProviderId?: string
  ): Promise<void> {
    // Get existing activity and check permissions
    const existingActivity = await this.getActivityById(
      activityId,
      requestingUserId,
      requestingUserType,
      requestingUserProviderId
    );

    if (!existingActivity) {
      throw new Error('Activity not found');
    }

    // Only provider admin or system admin can delete activities
    if (requestingUserType === UserType.TOURIST) {
      throw new Error('Tourists cannot delete activities');
    }

    // Send notifications before deleting
    try {
      await this.notifyActivityChange(
        existingActivity.tourEventId,
        {
          activityName: existingActivity.activityName,
          activityDate: existingActivity.activityDate,
          startTime: existingActivity.startTime,
          endTime: existingActivity.endTime,
          location: existingActivity.location
        },
        'cancelled'
      );
    } catch (notificationError) {
      // Log notification errors but don't fail the activity deletion
      console.error('Failed to send activity deletion notifications:', notificationError);
    }

    // Delete activity
    await this.prisma.activity.delete({
      where: { activityId }
    });
  }

  /**
   * Get activities by date range
   */
  async getActivitiesByDateRange(
    tourEventId: string,
    startDate: Date,
    endDate: Date,
    requestingUserId: string,
    requestingUserType: UserType,
    requestingUserProviderId?: string
  ): Promise<Activity[]> {
    // First check permissions for the tour event
    await this.getTourEventActivities(tourEventId, requestingUserId, requestingUserType, requestingUserProviderId);

    const activities = await this.prisma.activity.findMany({
      where: {
        tourEventId,
        activityDate: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: [
        { activityDate: 'asc' },
        { startTime: 'asc' }
      ]
    });

    return activities;
  }

  /**
   * Get daily schedule with calendar formatting
   */
  async getDailySchedule(
    tourEventId: string,
    date: Date,
    requestingUserId: string,
    requestingUserType: UserType,
    requestingUserProviderId?: string,
    includeIslamic: boolean = true
  ): Promise<{
    date: Date;
    calendarDate: any;
    activities: Activity[];
  }> {
    // Get activities for the specific date
    const activities = await this.getActivitiesByDateRange(
      tourEventId,
      date,
      date,
      requestingUserId,
      requestingUserType,
      requestingUserProviderId
    );

    // Format calendar date
    const calendarDate = formatCalendarDate(date, includeIslamic);

    return {
      date,
      calendarDate,
      activities
    };
  }

  /**
   * Get default activity types
   */
  getDefaultActivityTypes(): string[] {
    return [...defaultActivityTypes];
  }

  /**
   * Bulk create activities for a tour event
   */
  async bulkCreateActivities(
    activities: CreateActivityInput[],
    requestingUserId: string,
    requestingUserType: UserType,
    requestingUserProviderId?: string
  ): Promise<Activity[]> {
    // Validate all activities first
    for (const activity of activities) {
      const { error } = createActivitySchema.validate(activity);
      if (error) {
        throw new Error(`Validation error for activity "${activity.activityName}": ${error.details.map(d => d.message).join(', ')}`);
      }

      if (!validateTimeOrder(activity.startTime, activity.endTime)) {
        throw new Error(`Invalid time order for activity "${activity.activityName}": start time must be before end time`);
      }
    }

    // Check for conflicts within the batch
    for (let i = 0; i < activities.length; i++) {
      for (let j = i + 1; j < activities.length; j++) {
        if (checkActivityConflict(activities[i], [activities[j]])) {
          throw new Error(`Conflict between activities "${activities[i].activityName}" and "${activities[j].activityName}"`);
        }
      }
    }

    // Create activities one by one to ensure proper validation and permission checks
    const createdActivities: Activity[] = [];
    for (const activity of activities) {
      const created = await this.createActivity(
        activity,
        requestingUserId,
        requestingUserType,
        requestingUserProviderId
      );
      createdActivities.push(created);
    }

    return createdActivities;
  }

  /**
   * Send notifications to registered tourists about activity changes
   */
  private async notifyActivityChange(
    tourEventId: string,
    activityData: {
      activityName: string;
      activityDate: Date;
      startTime: string;
      endTime: string;
      location?: string | null;
    },
    updateType: 'added' | 'updated' | 'cancelled'
  ): Promise<void> {
    // Get tour event with registered tourists and provider info
    const tourEvent = await this.prisma.customTourEvent.findUnique({
      where: { tourEventId },
      include: {
        registrations: {
          where: {
            status: RegistrationStatus.APPROVED
          },
          include: {
            tourist: {
              select: {
                userId: true,
                firstName: true
              }
            }
          }
        },
        provider: {
          select: {
            companyName: true
          }
        }
      }
    });

    if (!tourEvent || !tourEvent.registrations || tourEvent.registrations.length === 0) {
      return; // No registered tourists to notify
    }

    const approvedTourists = tourEvent.registrations.map(reg => ({
      userId: reg.tourist.userId,
      firstName: reg.tourist.firstName
    }));

    const providerName = tourEvent.provider?.companyName || 'Tour Provider';

    // Send activity update notifications
    await tourEventNotificationService.notifyActivityUpdate(
      tourEventId,
      {
        customTourName: tourEvent.customTourName
      },
      {
        activityName: activityData.activityName,
        activityDate: activityData.activityDate,
        startTime: activityData.startTime,
        endTime: activityData.endTime,
        location: activityData.location || undefined
      },
      approvedTourists,
      providerName,
      updateType
    );
  }
}