import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '../../generated/prisma';
import { CustomTourEventService } from '../../services/custom-tour-event';
import { UserType } from '../../types/user';
import { TourEventStatus, RegistrationStatus } from '../../types/custom-tour-event';

// Mock Prisma Client
const mockPrisma = {
  customTourEvent: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  tourTemplate: {
    findUnique: vi.fn(),
  },
  touristRegistration: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn(),
} as unknown as PrismaClient;

describe('CustomTourEventService', () => {
  let customTourEventService: CustomTourEventService;

  beforeEach(() => {
    customTourEventService = new CustomTourEventService(mockPrisma);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('createCustomTourEvent', () => {
    const futureDate1 = new Date();
    futureDate1.setDate(futureDate1.getDate() + 30);
    const futureDate2 = new Date();
    futureDate2.setDate(futureDate2.getDate() + 45);
    
    const validCreateInput = {
      customTourName: 'Hajj 2024 Premium Package',
      startDate: futureDate1,
      endDate: futureDate2,
      packageType: 'Premium',
      place1Hotel: 'Makkah Hilton',
      place2Hotel: 'Madinah Marriott',
      numberOfAllowedTourists: 50,
      groupChatInfo: 'WhatsApp group will be created'
    };

    it('should create tour event with valid input (Provider Admin)', async () => {
      const mockTourEvent = {
        tourEventId: 'event123',
        providerId: 'provider123',
        ...validCreateInput,
        remainingTourists: 50,
        status: TourEventStatus.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date(),
        registrations: [],
        activities: []
      };

      mockPrisma.customTourEvent.create = vi.fn().mockResolvedValue(mockTourEvent);

      const result = await customTourEventService.createCustomTourEvent(
        validCreateInput,
        'user123',
        UserType.PROVIDER_ADMIN,
        'provider123'
      );

      expect(result).toEqual(mockTourEvent);
      expect(mockPrisma.customTourEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          providerId: 'provider123',
          customTourName: validCreateInput.customTourName,
          remainingTourists: validCreateInput.numberOfAllowedTourists,
          status: TourEventStatus.DRAFT
        }),
        include: expect.any(Object)
      });
    });

    it('should deny non-provider admin from creating tour events', async () => {
      await expect(customTourEventService.createCustomTourEvent(
        validCreateInput,
        'user123',
        UserType.TOURIST,
        'provider123'
      )).rejects.toThrow('Insufficient permissions to create tour events');
    });

    it('should validate template exists if provided', async () => {
      const inputWithTemplate = { ...validCreateInput, templateId: 'template123' };
      mockPrisma.tourTemplate.findUnique = vi.fn().mockResolvedValue(null);

      await expect(customTourEventService.createCustomTourEvent(
        inputWithTemplate,
        'user123',
        UserType.PROVIDER_ADMIN,
        'provider123'
      )).rejects.toThrow('Tour template not found');
    });

    it('should throw error for invalid input', async () => {
      const invalidInput = { ...validCreateInput, numberOfAllowedTourists: 0 };

      await expect(customTourEventService.createCustomTourEvent(
        invalidInput,
        'user123',
        UserType.PROVIDER_ADMIN,
        'provider123'
      )).rejects.toThrow('Validation error');
    });
  });

  describe('getTourEventById', () => {
    const mockTourEvent = {
      tourEventId: 'event123',
      providerId: 'provider123',
      customTourName: 'Test Event',
      status: TourEventStatus.ACTIVE,
      registrations: [
        {
          registrationId: 'reg123',
          touristUserId: 'tourist123',
          status: RegistrationStatus.APPROVED,
          tourist: {
            userId: 'tourist123',
            firstName: 'John',
            lastName: 'Doe',
            emailAddress: 'john@example.com'
          }
        }
      ],
      activities: [],
      template: null
    };

    it('should allow system admin to access any tour event', async () => {
      mockPrisma.customTourEvent.findUnique = vi.fn().mockResolvedValue(mockTourEvent);

      const result = await customTourEventService.getTourEventById(
        'event123',
        'admin123',
        UserType.SYSTEM_ADMIN
      );

      expect(result).toEqual(mockTourEvent);
    });

    it('should allow provider admin to access their own tour events', async () => {
      mockPrisma.customTourEvent.findUnique = vi.fn().mockResolvedValue(mockTourEvent);

      const result = await customTourEventService.getTourEventById(
        'event123',
        'providerAdmin123',
        UserType.PROVIDER_ADMIN,
        'provider123'
      );

      expect(result).toEqual(mockTourEvent);
    });

    it('should deny provider admin access to other provider events', async () => {
      mockPrisma.customTourEvent.findUnique = vi.fn().mockResolvedValue(mockTourEvent);

      await expect(customTourEventService.getTourEventById(
        'event123',
        'providerAdmin123',
        UserType.PROVIDER_ADMIN,
        'differentProvider'
      )).rejects.toThrow('Insufficient permissions');
    });

    it('should allow tourist to access events they are registered for', async () => {
      mockPrisma.customTourEvent.findUnique = vi.fn().mockResolvedValue(mockTourEvent);

      const result = await customTourEventService.getTourEventById(
        'event123',
        'tourist123',
        UserType.TOURIST
      );

      expect(result).toBeDefined();
      expect(result?.registrations).toHaveLength(1);
      expect(result?.registrations[0].touristUserId).toBe('tourist123');
    });

    it('should allow tourist to access active events', async () => {
      const eventWithoutRegistration = {
        ...mockTourEvent,
        registrations: []
      };
      mockPrisma.customTourEvent.findUnique = vi.fn().mockResolvedValue(eventWithoutRegistration);

      const result = await customTourEventService.getTourEventById(
        'event123',
        'tourist456',
        UserType.TOURIST
      );

      expect(result).toBeDefined();
      expect(result?.registrations).toHaveLength(0);
    });

    it('should return null for non-existent tour event', async () => {
      mockPrisma.customTourEvent.findUnique = vi.fn().mockResolvedValue(null);

      const result = await customTourEventService.getTourEventById(
        'nonexistent',
        'admin123',
        UserType.SYSTEM_ADMIN
      );

      expect(result).toBeNull();
    });
  });

  describe('registerTourist', () => {
    const futureDate1 = new Date();
    futureDate1.setDate(futureDate1.getDate() + 30);
    const futureDate2 = new Date();
    futureDate2.setDate(futureDate2.getDate() + 45);
    
    const mockTourEvent = {
      tourEventId: 'event123',
      status: TourEventStatus.ACTIVE,
      remainingTourists: 5,
      startDate: futureDate1,
      endDate: futureDate2,
      registrations: []
    };

    it('should register tourist for available tour event', async () => {
      const registrationInput = { tourEventId: 'event123' };
      const mockRegistration = {
        registrationId: 'reg123',
        tourEventId: 'event123',
        touristUserId: 'tourist123',
        status: RegistrationStatus.PENDING,
        tourist: {
          userId: 'tourist123',
          firstName: 'John',
          lastName: 'Doe',
          emailAddress: 'john@example.com'
        },
        tourEvent: {
          tourEventId: 'event123',
          customTourName: 'Test Event',
          startDate: new Date('2024-06-01'),
          endDate: new Date('2024-06-15')
        }
      };

      mockPrisma.customTourEvent.findUnique = vi.fn().mockResolvedValue(mockTourEvent);
      mockPrisma.touristRegistration.findMany = vi.fn().mockResolvedValue([]); // No overlapping registrations
      mockPrisma.touristRegistration.create = vi.fn().mockResolvedValue(mockRegistration);

      const result = await customTourEventService.registerTourist(
        registrationInput,
        'tourist123',
        UserType.TOURIST
      );

      expect(result).toEqual(mockRegistration);
      expect(mockPrisma.touristRegistration.create).toHaveBeenCalledWith({
        data: {
          tourEventId: 'event123',
          touristUserId: 'tourist123',
          status: RegistrationStatus.PENDING
        },
        include: expect.any(Object)
      });
    });

    it('should deny non-tourist from registering', async () => {
      const registrationInput = { tourEventId: 'event123' };

      await expect(customTourEventService.registerTourist(
        registrationInput,
        'admin123',
        UserType.SYSTEM_ADMIN
      )).rejects.toThrow('Only tourists can register for tour events');
    });

    it('should prevent registration for inactive tour events', async () => {
      const inactiveTourEvent = { ...mockTourEvent, status: TourEventStatus.DRAFT };
      mockPrisma.customTourEvent.findUnique = vi.fn().mockResolvedValue(inactiveTourEvent);

      await expect(customTourEventService.registerTourist(
        { tourEventId: 'event123' },
        'tourist123',
        UserType.TOURIST
      )).rejects.toThrow('Tour event is not available for registration');
    });

    it('should prevent duplicate registration', async () => {
      const eventWithExistingRegistration = {
        ...mockTourEvent,
        registrations: [{ touristUserId: 'tourist123' }]
      };
      mockPrisma.customTourEvent.findUnique = vi.fn().mockResolvedValue(eventWithExistingRegistration);

      await expect(customTourEventService.registerTourist(
        { tourEventId: 'event123' },
        'tourist123',
        UserType.TOURIST
      )).rejects.toThrow('You are already registered for this tour event');
    });

    it('should prevent registration when tour is full', async () => {
      const fullTourEvent = { ...mockTourEvent, remainingTourists: 0, registrations: [] };
      mockPrisma.customTourEvent.findUnique = vi.fn().mockResolvedValue(fullTourEvent);
      mockPrisma.touristRegistration.findMany = vi.fn().mockResolvedValue([]);

      await expect(customTourEventService.registerTourist(
        { tourEventId: 'event123' },
        'tourist123',
        UserType.TOURIST
      )).rejects.toThrow('Tour event is full');
    });
  });

  describe('processRegistration', () => {
    const mockRegistration = {
      registrationId: 'reg123',
      status: RegistrationStatus.PENDING,
      tourEvent: {
        tourEventId: 'event123',
        providerId: 'provider123',
        remainingTourists: 5
      },
      tourist: {
        userId: 'tourist123',
        firstName: 'John',
        lastName: 'Doe',
        emailAddress: 'john@example.com'
      }
    };

    it('should approve registration (Provider Admin)', async () => {
      const approvalInput = {
        registrationId: 'reg123',
        approved: true
      };

      const approvedRegistration = {
        ...mockRegistration,
        status: RegistrationStatus.APPROVED,
        approvedByUserId: 'providerAdmin123',
        approvedDate: new Date()
      };

      mockPrisma.touristRegistration.findUnique = vi.fn().mockResolvedValue(mockRegistration);
      mockPrisma.$transaction = vi.fn().mockImplementation(async (callback) => {
        return callback({
          touristRegistration: {
            update: vi.fn().mockResolvedValue(approvedRegistration)
          },
          customTourEvent: {
            update: vi.fn(),
            findUnique: vi.fn().mockResolvedValue({ remainingTourists: 4 })
          }
        });
      });

      const result = await customTourEventService.processRegistration(
        approvalInput,
        'providerAdmin123',
        UserType.PROVIDER_ADMIN,
        'provider123'
      );

      expect(result).toEqual(approvedRegistration);
    });

    it('should reject registration with reason (Provider Admin)', async () => {
      const rejectionInput = {
        registrationId: 'reg123',
        approved: false,
        rejectedReason: 'Tour is full'
      };

      const rejectedRegistration = {
        ...mockRegistration,
        status: RegistrationStatus.REJECTED,
        rejectedReason: 'Tour is full'
      };

      mockPrisma.touristRegistration.findUnique = vi.fn().mockResolvedValue(mockRegistration);
      mockPrisma.$transaction = vi.fn().mockImplementation(async (callback) => {
        return callback({
          touristRegistration: {
            update: vi.fn().mockResolvedValue(rejectedRegistration)
          }
        });
      });

      const result = await customTourEventService.processRegistration(
        rejectionInput,
        'providerAdmin123',
        UserType.PROVIDER_ADMIN,
        'provider123'
      );

      expect(result).toEqual(rejectedRegistration);
    });

    it('should deny non-provider admin from processing registrations', async () => {
      const approvalInput = {
        registrationId: 'reg123',
        approved: true
      };

      await expect(customTourEventService.processRegistration(
        approvalInput,
        'tourist123',
        UserType.TOURIST,
        'provider123'
      )).rejects.toThrow('Insufficient permissions to process registrations');
    });

    it('should prevent processing already processed registration', async () => {
      const processedRegistration = {
        ...mockRegistration,
        status: RegistrationStatus.APPROVED
      };

      mockPrisma.touristRegistration.findUnique = vi.fn().mockResolvedValue(processedRegistration);

      await expect(customTourEventService.processRegistration(
        { registrationId: 'reg123', approved: false, rejectedReason: 'Test' },
        'providerAdmin123',
        UserType.PROVIDER_ADMIN,
        'provider123'
      )).rejects.toThrow('Registration has already been processed');
    });
  });

  describe('updateTourEvent', () => {
    const mockTourEvent = {
      tourEventId: 'event123',
      providerId: 'provider123',
      customTourName: 'Original Event',
      numberOfAllowedTourists: 50,
      remainingTourists: 30,
      registrations: [
        { status: RegistrationStatus.APPROVED },
        { status: RegistrationStatus.APPROVED },
        { status: RegistrationStatus.PENDING }
      ]
    };

    it('should update tour event with valid input (Provider Admin)', async () => {
      const updateInput = { customTourName: 'Updated Event' };
      const updatedEvent = { ...mockTourEvent, customTourName: 'Updated Event' };

      mockPrisma.customTourEvent.findUnique = vi.fn().mockResolvedValue(mockTourEvent);
      mockPrisma.customTourEvent.update = vi.fn().mockResolvedValue(updatedEvent);

      const result = await customTourEventService.updateTourEvent(
        'event123',
        updateInput,
        'providerAdmin123',
        UserType.PROVIDER_ADMIN,
        'provider123'
      );

      expect(result).toEqual(updatedEvent);
    });

    it('should prevent capacity reduction below approved registrations', async () => {
      const updateInput = { numberOfAllowedTourists: 1 }; // Less than 2 approved registrations

      mockPrisma.customTourEvent.findUnique = vi.fn().mockResolvedValue(mockTourEvent);

      await expect(customTourEventService.updateTourEvent(
        'event123',
        updateInput,
        'providerAdmin123',
        UserType.PROVIDER_ADMIN,
        'provider123'
      )).rejects.toThrow('Cannot reduce capacity below the number of approved registrations');
    });
  });

  describe('cancelRegistration', () => {
    const mockRegistration = {
      registrationId: 'reg123',
      touristUserId: 'tourist123',
      status: RegistrationStatus.APPROVED,
      tourEvent: {
        tourEventId: 'event123',
        status: TourEventStatus.ACTIVE
      }
    };

    it('should cancel registration and update capacity', async () => {
      mockPrisma.touristRegistration.findUnique = vi.fn().mockResolvedValue(mockRegistration);
      mockPrisma.$transaction = vi.fn().mockImplementation(async (callback) => {
        return callback({
          touristRegistration: {
            update: vi.fn()
          },
          customTourEvent: {
            update: vi.fn()
          }
        });
      });

      await customTourEventService.cancelRegistration(
        'reg123',
        'tourist123',
        UserType.TOURIST
      );

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should prevent cancelling other user registrations', async () => {
      mockPrisma.touristRegistration.findUnique = vi.fn().mockResolvedValue(mockRegistration);

      await expect(customTourEventService.cancelRegistration(
        'reg123',
        'otherTourist',
        UserType.TOURIST
      )).rejects.toThrow('You can only cancel your own registrations');
    });

    it('should prevent cancelling already cancelled registration', async () => {
      const cancelledRegistration = {
        ...mockRegistration,
        status: RegistrationStatus.CANCELLED
      };
      mockPrisma.touristRegistration.findUnique = vi.fn().mockResolvedValue(cancelledRegistration);

      await expect(customTourEventService.cancelRegistration(
        'reg123',
        'tourist123',
        UserType.TOURIST
      )).rejects.toThrow('Registration is already cancelled');
    });
  });
});