import { PrismaClient } from '../generated/prisma';
import { 
  CreateCustomTourEventInput, 
  UpdateCustomTourEventInput, 
  CustomTourEvent,
  TouristRegistrationInput,
  RegistrationApprovalInput,
  TouristRegistration,
  TourEventStatus,
  RegistrationStatus
} from '../types/custom-tour-event';
import { UserType } from '../types/user';
import { 
  createCustomTourEventSchema, 
  updateCustomTourEventSchema, 
  tourEventIdSchema,
  touristRegistrationSchema,
  registrationApprovalSchema
} from '../validation/custom-tour-event';
import { tourEventNotificationService } from './tour-event-notifications';

export class CustomTourEventService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Validate and fix capacity inconsistencies for a tour event
   */
  private async validateAndFixCapacity(
    tourEventId: string,
    tx?: any
  ): Promise<{ currentCapacity: number; remainingCapacity: number; isConsistent: boolean }> {
    const prismaClient = tx || this.prisma;
    
    // Get tour event
    const tourEvent = await prismaClient.customTourEvent.findUnique({
      where: { tourEventId }
    });

    if (!tourEvent) {
      throw new Error('Tour event not found');
    }

    // Count actual approved registrations
    const approvedCount = await prismaClient.touristRegistration.count({
      where: {
        tourEventId,
        status: RegistrationStatus.APPROVED
      }
    });

    const expectedRemaining = tourEvent.numberOfAllowedTourists - approvedCount;
    const isConsistent = tourEvent.remainingTourists === expectedRemaining;

    // Fix inconsistency if found
    if (!isConsistent) {
      await prismaClient.customTourEvent.update({
        where: { tourEventId },
        data: { 
          remainingTourists: expectedRemaining,
          status: expectedRemaining <= 0 ? TourEventStatus.FULL : 
                  tourEvent.status === TourEventStatus.FULL && expectedRemaining > 0 ? TourEventStatus.ACTIVE :
                  tourEvent.status
        }
      });
    }

    return {
      currentCapacity: approvedCount,
      remainingCapacity: expectedRemaining,
      isConsistent
    };
  }

  /**
   * Get capacity information for a tour event
   */
  async getCapacityInfo(
    tourEventId: string,
    requestingUserId: string,
    requestingUserType: UserType,
    requestingUserProviderId?: string
  ): Promise<{
    totalCapacity: number;
    approvedRegistrations: number;
    pendingRegistrations: number;
    remainingCapacity: number;
    isFull: boolean;
  }> {
    // Validate access permissions
    const tourEvent = await this.getTourEventById(
      tourEventId,
      requestingUserId,
      requestingUserType,
      requestingUserProviderId
    );

    if (!tourEvent) {
      throw new Error('Tour event not found or access denied');
    }

    // Get registration counts
    const [approvedCount, pendingCount] = await Promise.all([
      this.prisma.touristRegistration.count({
        where: {
          tourEventId,
          status: RegistrationStatus.APPROVED
        }
      }),
      this.prisma.touristRegistration.count({
        where: {
          tourEventId,
          status: RegistrationStatus.PENDING
        }
      })
    ]);

    const remainingCapacity = tourEvent.numberOfAllowedTourists - approvedCount;

    return {
      totalCapacity: tourEvent.numberOfAllowedTourists,
      approvedRegistrations: approvedCount,
      pendingRegistrations: pendingCount,
      remainingCapacity: Math.max(0, remainingCapacity),
      isFull: remainingCapacity <= 0
    };
  }

  /**
   * Create a new custom tour event (Provider Admin only)
   */
  async createCustomTourEvent(
    input: CreateCustomTourEventInput, 
    requestingUserId: string,
    requestingUserType: UserType, 
    requestingUserProviderId: string
  ): Promise<CustomTourEvent> {
    // Only provider admin can create tour events
    if (requestingUserType !== UserType.PROVIDER_ADMIN) {
      throw new Error('Insufficient permissions to create tour events');
    }

    // Validate input
    const { error, value } = createCustomTourEventSchema.validate(input);
    if (error) {
      throw new Error(`Validation error: ${error.details.map(d => d.message).join(', ')}`);
    }

    // Validate template exists if provided
    if (value.templateId) {
      const template = await this.prisma.tourTemplate.findUnique({
        where: { templateId: value.templateId }
      });
      
      if (!template) {
        throw new Error('Tour template not found');
      }
    }

    // Create tour event
    const tourEvent = await this.prisma.customTourEvent.create({
      data: {
        providerId: requestingUserProviderId,
        templateId: value.templateId || null,
        customTourName: value.customTourName,
        startDate: value.startDate,
        endDate: value.endDate,
        packageType: value.packageType,
        place1Hotel: value.place1Hotel,
        place2Hotel: value.place2Hotel,
        numberOfAllowedTourists: value.numberOfAllowedTourists,
        remainingTourists: value.numberOfAllowedTourists, // Initially all spots are available
        groupChatInfo: value.groupChatInfo || null,
        status: TourEventStatus.DRAFT
      },
      include: {
        registrations: {
          include: {
            tourist: {
              select: {
                userId: true,
                firstName: true,
                lastName: true,
                emailAddress: true
              }
            }
          }
        },
        activities: true
      }
    });

    return tourEvent as CustomTourEvent;
  }

  /**
   * Get tour event by ID with role-based access control
   */
  async getTourEventById(
    tourEventId: string, 
    requestingUserId: string,
    requestingUserType: UserType, 
    requestingUserProviderId?: string
  ): Promise<CustomTourEvent | null> {
    // Validate tour event ID
    const { error } = tourEventIdSchema.validate(tourEventId);
    if (error) {
      throw new Error(`Invalid tour event ID: ${error.details[0].message}`);
    }

    const tourEvent = await this.prisma.customTourEvent.findUnique({
      where: { tourEventId },
      include: {
        registrations: {
          include: {
            tourist: {
              select: {
                userId: true,
                firstName: true,
                lastName: true,
                emailAddress: true
              }
            }
          }
        },
        activities: {
          orderBy: [
            { activityDate: 'asc' },
            { startTime: 'asc' }
          ]
        },
        template: {
          include: {
            sitesToVisit: {
              orderBy: { orderIndex: 'asc' }
            }
          }
        }
      }
    });

    if (!tourEvent) {
      return null;
    }

    // Role-based access control
    if (requestingUserType === UserType.SYSTEM_ADMIN) {
      // System admin can access any tour event
      return tourEvent as CustomTourEvent;
    } else if (requestingUserType === UserType.PROVIDER_ADMIN) {
      // Provider admin can access tour events from their company
      if (tourEvent.providerId === requestingUserProviderId) {
        return tourEvent as CustomTourEvent;
      }
    } else if (requestingUserType === UserType.TOURIST) {
      // Tourist can access tour events they are registered for or active events
      const isRegistered = tourEvent.registrations.some(
        reg => reg.touristUserId === requestingUserId
      );
      
      if (isRegistered || tourEvent.status === TourEventStatus.ACTIVE) {
        // Filter sensitive information for tourists
        return {
          ...tourEvent,
          registrations: tourEvent.registrations.filter(
            reg => reg.touristUserId === requestingUserId
          )
        } as CustomTourEvent;
      }
    }

    throw new Error('Insufficient permissions to access this tour event');
  }

  /**
   * Get tour events with filtering and role-based access
   */
  async getTourEvents(
    requestingUserId: string,
    requestingUserType: UserType,
    requestingUserProviderId?: string,
    status?: TourEventStatus,
    limit: number = 50,
    offset: number = 0
  ): Promise<CustomTourEvent[]> {
    let whereClause: any = {};

    // Apply role-based filtering
    if (requestingUserType === UserType.PROVIDER_ADMIN && requestingUserProviderId) {
      whereClause.providerId = requestingUserProviderId;
    } else if (requestingUserType === UserType.TOURIST) {
      // Tourists can see active events or events they're registered for
      whereClause = {
        OR: [
          { status: TourEventStatus.ACTIVE },
          {
            registrations: {
              some: {
                touristUserId: requestingUserId
              }
            }
          }
        ]
      };
    }
    // System admin can see all events (no additional filtering)

    // Apply status filter if provided
    if (status) {
      if (whereClause.OR) {
        // If we already have OR conditions, we need to combine them
        whereClause = {
          AND: [
            { status },
            { OR: whereClause.OR }
          ]
        };
      } else {
        whereClause.status = status;
      }
    }

    const tourEvents = await this.prisma.customTourEvent.findMany({
      where: whereClause,
      include: {
        registrations: {
          include: {
            tourist: {
              select: {
                userId: true,
                firstName: true,
                lastName: true,
                emailAddress: true
              }
            }
          }
        },
        activities: {
          orderBy: [
            { activityDate: 'asc' },
            { startTime: 'asc' }
          ]
        }
      },
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' }
    });

    // Filter sensitive information for tourists
    if (requestingUserType === UserType.TOURIST) {
      return tourEvents.map(event => ({
        ...event,
        registrations: event.registrations.filter(
          reg => reg.touristUserId === requestingUserId
        )
      })) as CustomTourEvent[];
    }

    return tourEvents as CustomTourEvent[];
  }

  /**
   * Update tour event (Provider Admin only, own events)
   */
  async updateTourEvent(
    tourEventId: string,
    input: UpdateCustomTourEventInput,
    requestingUserId: string,
    requestingUserType: UserType,
    requestingUserProviderId: string
  ): Promise<CustomTourEvent> {
    // Validate input
    const { error, value } = updateCustomTourEventSchema.validate(input);
    if (error) {
      throw new Error(`Validation error: ${error.details.map(d => d.message).join(', ')}`);
    }

    // Get existing tour event and check permissions
    const existingEvent = await this.getTourEventById(
      tourEventId, 
      requestingUserId, 
      requestingUserType, 
      requestingUserProviderId
    );
    
    if (!existingEvent) {
      throw new Error('Tour event not found');
    }

    // Only provider admin can update tour events
    if (requestingUserType !== UserType.PROVIDER_ADMIN) {
      throw new Error('Insufficient permissions to update tour events');
    }

    // Validate capacity changes
    if (value.numberOfAllowedTourists !== undefined && existingEvent.registrations) {
      const approvedRegistrations = existingEvent.registrations.filter(
        reg => reg.status === RegistrationStatus.APPROVED
      ).length;
      
      if (value.numberOfAllowedTourists < approvedRegistrations) {
        throw new Error('Cannot reduce capacity below the number of approved registrations');
      }
    }

    // Track changes for notifications
    const hasScheduleChanges = value.startDate !== undefined || value.endDate !== undefined;
    const hasCapacityChanges = value.numberOfAllowedTourists !== undefined;
    const hasGeneralChanges = value.customTourName !== undefined || 
                             value.packageType !== undefined || 
                             value.place1Hotel !== undefined || 
                             value.place2Hotel !== undefined ||
                             value.groupChatInfo !== undefined;
    const hasStatusChanges = value.status !== undefined && value.status !== existingEvent.status;

    // Update tour event
    const updatedEvent = await this.prisma.customTourEvent.update({
      where: { tourEventId },
      data: {
        customTourName: value.customTourName ?? existingEvent.customTourName,
        startDate: value.startDate ?? existingEvent.startDate,
        endDate: value.endDate ?? existingEvent.endDate,
        packageType: value.packageType ?? existingEvent.packageType,
        place1Hotel: value.place1Hotel ?? existingEvent.place1Hotel,
        place2Hotel: value.place2Hotel ?? existingEvent.place2Hotel,
        numberOfAllowedTourists: value.numberOfAllowedTourists ?? existingEvent.numberOfAllowedTourists,
        remainingTourists: value.numberOfAllowedTourists !== undefined 
          ? value.numberOfAllowedTourists - (existingEvent.registrations?.filter(
              reg => reg.status === RegistrationStatus.APPROVED
            ).length || 0)
          : existingEvent.remainingTourists,
        groupChatInfo: value.groupChatInfo ?? existingEvent.groupChatInfo,
        status: value.status ?? existingEvent.status
      },
      include: {
        registrations: {
          include: {
            tourist: {
              select: {
                userId: true,
                firstName: true,
                lastName: true,
                emailAddress: true
              }
            }
          }
        },
        activities: {
          orderBy: [
            { activityDate: 'asc' },
            { startTime: 'asc' }
          ]
        },
        provider: {
          select: {
            companyName: true
          }
        }
      }
    });

    // Send notifications for significant changes
    const approvedTourists = updatedEvent.registrations
      ?.filter(reg => reg.status === RegistrationStatus.APPROVED)
      ?.map(reg => ({
        userId: reg.tourist?.userId || '',
        firstName: reg.tourist?.firstName || ''
      })) || [];

    if (approvedTourists.length > 0) {
      const providerName = updatedEvent.provider?.companyName || 'Tour Provider';

      try {
        // Send schedule update notifications
        if (hasScheduleChanges) {
          await tourEventNotificationService.notifyTourScheduleUpdate(
            tourEventId,
            {
              customTourName: updatedEvent.customTourName,
              startDate: updatedEvent.startDate,
              endDate: updatedEvent.endDate,
              providerId: updatedEvent.providerId
            },
            approvedTourists,
            providerName
          );
        }

        // Send capacity update notifications
        if (hasCapacityChanges) {
          await tourEventNotificationService.notifyCapacityUpdate(
            tourEventId,
            {
              customTourName: updatedEvent.customTourName,
              numberOfAllowedTourists: updatedEvent.numberOfAllowedTourists,
              remainingTourists: updatedEvent.remainingTourists
            },
            approvedTourists,
            providerName
          );
        }

        // Send general update notifications
        if (hasGeneralChanges && !hasScheduleChanges && !hasCapacityChanges) {
          const updateMessage = this.buildUpdateMessage(value, existingEvent);
          await tourEventNotificationService.notifyTourEventUpdate(
            tourEventId,
            updateMessage,
            {
              customTourName: updatedEvent.customTourName,
              providerId: updatedEvent.providerId
            },
            approvedTourists,
            providerName
          );
        }

        // Send cancellation notifications
        if (hasStatusChanges && value.status === TourEventStatus.CANCELLED) {
          await tourEventNotificationService.notifyTourEventCancelled(
            tourEventId,
            {
              customTourName: updatedEvent.customTourName,
              startDate: updatedEvent.startDate,
              endDate: updatedEvent.endDate,
              providerId: updatedEvent.providerId
            },
            approvedTourists,
            'Tour has been cancelled by the provider',
            providerName
          );
        }
      } catch (notificationError) {
        // Log notification errors but don't fail the update
        console.error('Failed to send tour event update notifications:', notificationError);
      }
    }

    return updatedEvent as CustomTourEvent;
  }

  /**
   * Register tourist for tour event with enhanced capacity management
   */
  async registerTourist(
    input: TouristRegistrationInput,
    requestingUserId: string,
    requestingUserType: UserType,
    requestingUserProviderId?: string
  ): Promise<TouristRegistration> {
    // Only tourists can register for tours
    if (requestingUserType !== UserType.TOURIST) {
      throw new Error('Only tourists can register for tour events');
    }

    // Validate input
    const { error, value } = touristRegistrationSchema.validate(input);
    if (error) {
      throw new Error(`Validation error: ${error.details.map(d => d.message).join(', ')}`);
    }

    // Use transaction to ensure capacity consistency
    const registration = await this.prisma.$transaction(async (tx) => {
      // Get tour event with current capacity
      const tourEvent = await tx.customTourEvent.findUnique({
        where: { tourEventId: value.tourEventId },
        include: {
          registrations: {
            where: {
              touristUserId: requestingUserId
            }
          }
        }
      });

      if (!tourEvent) {
        throw new Error('Tour event not found');
      }

      // Check if tour event is active
      if (tourEvent.status !== TourEventStatus.ACTIVE) {
        throw new Error('Tour event is not available for registration');
      }

      // Check if tourist is already registered
      if (tourEvent.registrations.length > 0) {
        throw new Error('You are already registered for this tour event');
      }

      // Check for overlapping registrations (one active registration per time period)
      const overlappingRegistrations = await tx.touristRegistration.findMany({
        where: {
          touristUserId: requestingUserId,
          status: {
            in: [RegistrationStatus.PENDING, RegistrationStatus.APPROVED]
          },
          tourEvent: {
            OR: [
              {
                AND: [
                  { startDate: { lte: tourEvent.endDate } },
                  { endDate: { gte: tourEvent.startDate } }
                ]
              }
            ]
          }
        }
      });

      if (overlappingRegistrations.length > 0) {
        throw new Error('You have an active registration for an overlapping time period');
      }

      // Enhanced capacity validation - check both remainingTourists and actual count
      const currentApprovedCount = await tx.touristRegistration.count({
        where: {
          tourEventId: value.tourEventId,
          status: RegistrationStatus.APPROVED
        }
      });

      // Validate capacity consistency
      const expectedRemaining = tourEvent.numberOfAllowedTourists - currentApprovedCount;
      if (tourEvent.remainingTourists !== expectedRemaining) {
        // Fix capacity inconsistency
        await tx.customTourEvent.update({
          where: { tourEventId: value.tourEventId },
          data: { remainingTourists: expectedRemaining }
        });
      }

      // Check if there's capacity for new registration
      if (expectedRemaining <= 0) {
        throw new Error('Tour event is full');
      }

      // Create registration
      const newRegistration = await tx.touristRegistration.create({
        data: {
          tourEventId: value.tourEventId,
          touristUserId: requestingUserId,
          status: RegistrationStatus.PENDING
        },
        include: {
          tourist: {
            select: {
              userId: true,
              firstName: true,
              lastName: true,
              emailAddress: true
            }
          },
          tourEvent: {
            select: {
              tourEventId: true,
              customTourName: true,
              startDate: true,
              endDate: true
            }
          }
        }
      });

      return newRegistration;
    });

    return registration as TouristRegistration;
  }

  /**
   * Approve or reject tourist registration with enhanced capacity management
   */
  async processRegistration(
    input: RegistrationApprovalInput,
    requestingUserId: string,
    requestingUserType: UserType,
    requestingUserProviderId: string
  ): Promise<TouristRegistration> {
    // Only provider admin can process registrations
    if (requestingUserType !== UserType.PROVIDER_ADMIN) {
      throw new Error('Insufficient permissions to process registrations');
    }

    // Validate input
    const { error, value } = registrationApprovalSchema.validate(input);
    if (error) {
      throw new Error(`Validation error: ${error.details.map(d => d.message).join(', ')}`);
    }

    // Get registration with tour event
    const registration = await this.prisma.touristRegistration.findUnique({
      where: { registrationId: value.registrationId },
      include: {
        tourEvent: true,
        tourist: {
          select: {
            userId: true,
            firstName: true,
            lastName: true,
            emailAddress: true
          }
        }
      }
    });

    if (!registration) {
      throw new Error('Registration not found');
    }

    // Check if provider admin owns this tour event
    if (registration.tourEvent.providerId !== requestingUserProviderId) {
      throw new Error('Insufficient permissions to process this registration');
    }

    // Check if registration is still pending
    if (registration.status !== RegistrationStatus.PENDING) {
      throw new Error('Registration has already been processed');
    }

    // Update registration with enhanced capacity management
    const updatedRegistration = await this.prisma.$transaction(async (tx) => {
      // If approving, validate capacity first
      if (value.approved) {
        const capacityInfo = await this.validateAndFixCapacity(
          registration.tourEvent.tourEventId,
          tx
        );

        if (capacityInfo.remainingCapacity <= 0) {
          throw new Error('Tour event is full');
        }
      }

      // Update registration status
      const updated = await tx.touristRegistration.update({
        where: { registrationId: value.registrationId },
        data: {
          status: value.approved ? RegistrationStatus.APPROVED : RegistrationStatus.REJECTED,
          approvedByUserId: requestingUserId,
          approvedDate: new Date(),
          rejectedReason: value.approved ? null : value.rejectedReason
        },
        include: {
          tourist: {
            select: {
              userId: true,
              firstName: true,
              lastName: true,
              emailAddress: true
            }
          },
          tourEvent: {
            select: {
              tourEventId: true,
              customTourName: true,
              startDate: true,
              endDate: true
            }
          }
        }
      });

      // Update capacity if approved
      if (value.approved) {
        const newRemainingCapacity = registration.tourEvent.remainingTourists - 1;
        
        await tx.customTourEvent.update({
          where: { tourEventId: registration.tourEvent.tourEventId },
          data: {
            remainingTourists: newRemainingCapacity,
            status: newRemainingCapacity <= 0 ? TourEventStatus.FULL : registration.tourEvent.status
          }
        });
      }

      return updated;
    });

    return updatedRegistration as TouristRegistration;
  }

  /**
   * Cancel tourist registration with enhanced capacity management
   */
  async cancelRegistration(
    registrationId: string,
    requestingUserId: string,
    requestingUserType: UserType
  ): Promise<void> {
    // Get registration
    const registration = await this.prisma.touristRegistration.findUnique({
      where: { registrationId },
      include: {
        tourEvent: true
      }
    });

    if (!registration) {
      throw new Error('Registration not found');
    }

    // Check permissions - tourist can cancel their own registration
    if (requestingUserType === UserType.TOURIST && registration.touristUserId !== requestingUserId) {
      throw new Error('You can only cancel your own registrations');
    }

    // Check if registration can be cancelled
    if (registration.status === RegistrationStatus.CANCELLED) {
      throw new Error('Registration is already cancelled');
    }

    // Update registration and tour event capacity in transaction
    await this.prisma.$transaction(async (tx) => {
      // Cancel registration
      await tx.touristRegistration.update({
        where: { registrationId },
        data: {
          status: RegistrationStatus.CANCELLED
        }
      });

      // If registration was approved, update capacity
      if (registration.status === RegistrationStatus.APPROVED) {
        const newRemainingCapacity = registration.tourEvent.remainingTourists + 1;
        
        await tx.customTourEvent.update({
          where: { tourEventId: registration.tourEvent.tourEventId },
          data: {
            remainingTourists: newRemainingCapacity,
            // If event was full, change status back to active
            status: registration.tourEvent.status === TourEventStatus.FULL 
              ? TourEventStatus.ACTIVE 
              : registration.tourEvent.status
          }
        });
      }

      // Validate capacity consistency after cancellation
      await this.validateAndFixCapacity(registration.tourEvent.tourEventId, tx);
    });
  }

  /**
   * Get registrations for a tour event (Provider Admin only)
   */
  async getTourEventRegistrations(
    tourEventId: string,
    requestingUserId: string,
    requestingUserType: UserType,
    requestingUserProviderId: string,
    status?: RegistrationStatus
  ): Promise<TouristRegistration[]> {
    // Only provider admin can view registrations
    if (requestingUserType !== UserType.PROVIDER_ADMIN) {
      throw new Error('Insufficient permissions to view registrations');
    }

    // Verify tour event exists and belongs to provider
    const tourEvent = await this.getTourEventById(
      tourEventId, 
      requestingUserId, 
      requestingUserType, 
      requestingUserProviderId
    );
    
    if (!tourEvent) {
      throw new Error('Tour event not found');
    }

    const whereClause: any = { tourEventId };
    if (status) {
      whereClause.status = status;
    }

    const registrations = await this.prisma.touristRegistration.findMany({
      where: whereClause,
      include: {
        tourist: {
          select: {
            userId: true,
            firstName: true,
            lastName: true,
            emailAddress: true,
            phoneNumber: true,
            country: true
          }
        },
        approvedBy: {
          select: {
            userId: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: { registrationDate: 'desc' }
    });

    return registrations as TouristRegistration[];
  }

  /**
   * Build update message for general tour event changes
   */
  private buildUpdateMessage(
    updates: UpdateCustomTourEventInput,
    existingEvent: CustomTourEvent
  ): string {
    const changes: string[] = [];

    if (updates.customTourName && updates.customTourName !== existingEvent.customTourName) {
      changes.push(`Tour name changed to "${updates.customTourName}"`);
    }

    if (updates.packageType && updates.packageType !== existingEvent.packageType) {
      changes.push(`Package type updated to "${updates.packageType}"`);
    }

    if (updates.place1Hotel && updates.place1Hotel !== existingEvent.place1Hotel) {
      changes.push(`Primary hotel changed to "${updates.place1Hotel}"`);
    }

    if (updates.place2Hotel && updates.place2Hotel !== existingEvent.place2Hotel) {
      changes.push(`Secondary hotel changed to "${updates.place2Hotel}"`);
    }

    if (updates.groupChatInfo !== undefined && updates.groupChatInfo !== existingEvent.groupChatInfo) {
      if (updates.groupChatInfo) {
        changes.push(`Group chat information updated: "${updates.groupChatInfo}"`);
      } else {
        changes.push('Group chat information removed');
      }
    }

    if (changes.length === 0) {
      return 'Tour event details have been updated';
    }

    return `Your tour "${existingEvent.customTourName}" has been updated: ${changes.join(', ')}.`;
  }
}