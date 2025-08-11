import { describe, it, expect, beforeEach, vi } from 'vitest';
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
  touristRegistration: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn(),
} as any;

describe('CustomTourEventService Registration Tests', () => {
  let service: CustomTourEventService;

  beforeEach(() => {
    service = new CustomTourEventService(mockPrisma);
    vi.clearAllMocks();
  });

  describe('registerTourist', () => {
    const mockTourEvent = {
      tourEventId: 'tour-1',
      providerId: 'provider-1',
      customTourName: 'Test Tour',
      startDate: new Date('2025-06-01'),
      endDate: new Date('2025-06-07'),
      status: TourEventStatus.ACTIVE,
      remainingTourists: 5,
      registrations: []
    };

    it('should successfully register tourist for tour event', async () => {
      const mockRegistration = {
        registrationId: 'reg-1',
        tourEventId: 'tour-1',
        touristUserId: 'tourist-1',
        status: RegistrationStatus.PENDING,
        registrationDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        tourist: {
          userId: 'tourist-1',
          firstName: 'John',
          lastName: 'Doe',
          emailAddress: 'john@test.com'
        },
        tourEvent: {
          tourEventId: 'tour-1',
          customTourName: 'Test Tour',
          startDate: new Date('2025-06-01'),
          endDate: new Date('2025-06-07')
        }
      };

      mockPrisma.customTourEvent.findUnique.mockResolvedValue(mockTourEvent);
      mockPrisma.touristRegistration.findMany.mockResolvedValue([]);
      mockPrisma.touristRegistration.create.mockResolvedValue(mockRegistration);

      const result = await service.registerTourist(
        { tourEventId: 'tour-1' },
        'tourist-1',
        UserType.TOURIST,
        'provider-1'
      );

      expect(result.registrationId).toBe('reg-1');
      expect(result.status).toBe(RegistrationStatus.PENDING);
      expect(mockPrisma.touristRegistration.create).toHaveBeenCalledWith({
        data: {
          tourEventId: 'tour-1',
          touristUserId: 'tourist-1',
          status: RegistrationStatus.PENDING
        },
        include: expect.any(Object)
      });
    });

    it('should prevent non-tourist from registering', async () => {
      await expect(
        service.registerTourist(
          { tourEventId: 'tour-1' },
          'admin-1',
          UserType.PROVIDER_ADMIN,
          'provider-1'
        )
      ).rejects.toThrow('Only tourists can register for tour events');
    });

    it('should prevent registration for non-existent tour event', async () => {
      mockPrisma.customTourEvent.findUnique.mockResolvedValue(null);

      await expect(
        service.registerTourist(
          { tourEventId: 'non-existent' },
          'tourist-1',
          UserType.TOURIST,
          'provider-1'
        )
      ).rejects.toThrow('Tour event not found');
    });

    it('should prevent registration for inactive tour event', async () => {
      const inactiveTourEvent = {
        ...mockTourEvent,
        status: TourEventStatus.DRAFT
      };

      mockPrisma.customTourEvent.findUnique.mockResolvedValue(inactiveTourEvent);

      await expect(
        service.registerTourist(
          { tourEventId: 'tour-1' },
          'tourist-1',
          UserType.TOURIST,
          'provider-1'
        )
      ).rejects.toThrow('Tour event is not available for registration');
    });

    it('should prevent duplicate registration', async () => {
      const tourEventWithRegistration = {
        ...mockTourEvent,
        registrations: [{ touristUserId: 'tourist-1' }]
      };

      mockPrisma.customTourEvent.findUnique.mockResolvedValue(tourEventWithRegistration);

      await expect(
        service.registerTourist(
          { tourEventId: 'tour-1' },
          'tourist-1',
          UserType.TOURIST,
          'provider-1'
        )
      ).rejects.toThrow('You are already registered for this tour event');
    });

    it('should prevent registration when tour is full', async () => {
      const fullTourEvent = {
        ...mockTourEvent,
        remainingTourists: 0
      };

      mockPrisma.customTourEvent.findUnique.mockResolvedValue(fullTourEvent);
      mockPrisma.touristRegistration.findMany.mockResolvedValue([]);

      await expect(
        service.registerTourist(
          { tourEventId: 'tour-1' },
          'tourist-1',
          UserType.TOURIST,
          'provider-1'
        )
      ).rejects.toThrow('Tour event is full');
    });

    it('should prevent overlapping registrations', async () => {
      mockPrisma.customTourEvent.findUnique.mockResolvedValue(mockTourEvent);
      // First call returns empty array for existing registrations on this specific tour
      // Second call returns overlapping registrations for the date range check
      mockPrisma.touristRegistration.findMany
        .mockResolvedValueOnce([]) // Existing registrations on this tour
        .mockResolvedValueOnce([{ // Overlapping registrations
          registrationId: 'reg-2',
          status: RegistrationStatus.APPROVED
        }]);

      await expect(
        service.registerTourist(
          { tourEventId: 'tour-1' },
          'tourist-1',
          UserType.TOURIST,
          'provider-1'
        )
      ).rejects.toThrow('You have an active registration for an overlapping time period');
    });
  });

  describe('processRegistration', () => {
    const mockRegistration = {
      registrationId: 'reg-1',
      tourEventId: 'tour-1',
      touristUserId: 'tourist-1',
      status: RegistrationStatus.PENDING,
      tourEvent: {
        tourEventId: 'tour-1',
        providerId: 'provider-1',
        remainingTourists: 5
      },
      tourist: {
        userId: 'tourist-1',
        firstName: 'John',
        lastName: 'Doe',
        emailAddress: 'john@test.com'
      }
    };

    it('should successfully approve registration', async () => {
      const approvedRegistration = {
        ...mockRegistration,
        status: RegistrationStatus.APPROVED,
        approvedByUserId: 'admin-1',
        approvedDate: new Date()
      };

      mockPrisma.touristRegistration.findUnique.mockResolvedValue(mockRegistration);
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          touristRegistration: {
            update: vi.fn().mockResolvedValue(approvedRegistration)
          },
          customTourEvent: {
            update: vi.fn(),
            findUnique: vi.fn().mockResolvedValue({ remainingTourists: 4 })
          }
        };
        return callback(mockTx);
      });

      const result = await service.processRegistration(
        {
          registrationId: 'reg-1',
          approved: true
        },
        'admin-1',
        UserType.PROVIDER_ADMIN,
        'provider-1'
      );

      expect(result.status).toBe(RegistrationStatus.APPROVED);
    });

    it('should successfully reject registration with reason', async () => {
      const rejectedRegistration = {
        ...mockRegistration,
        status: RegistrationStatus.REJECTED,
        approvedByUserId: 'admin-1',
        approvedDate: new Date(),
        rejectedReason: 'Tour is full'
      };

      mockPrisma.touristRegistration.findUnique.mockResolvedValue(mockRegistration);
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          touristRegistration: {
            update: vi.fn().mockResolvedValue(rejectedRegistration)
          },
          customTourEvent: {
            update: vi.fn()
          }
        };
        return callback(mockTx);
      });

      const result = await service.processRegistration(
        {
          registrationId: 'reg-1',
          approved: false,
          rejectedReason: 'Tour is full'
        },
        'admin-1',
        UserType.PROVIDER_ADMIN,
        'provider-1'
      );

      expect(result.status).toBe(RegistrationStatus.REJECTED);
      expect(result.rejectedReason).toBe('Tour is full');
    });

    it('should prevent non-provider-admin from processing registrations', async () => {
      await expect(
        service.processRegistration(
          {
            registrationId: 'reg-1',
            approved: true
          },
          'tourist-1',
          UserType.TOURIST,
          'provider-1'
        )
      ).rejects.toThrow('Insufficient permissions to process registrations');
    });

    it('should prevent processing non-existent registration', async () => {
      mockPrisma.touristRegistration.findUnique.mockResolvedValue(null);

      await expect(
        service.processRegistration(
          {
            registrationId: 'non-existent',
            approved: true
          },
          'admin-1',
          UserType.PROVIDER_ADMIN,
          'provider-1'
        )
      ).rejects.toThrow('Registration not found');
    });

    it('should prevent processing registration from different provider', async () => {
      const otherProviderRegistration = {
        ...mockRegistration,
        tourEvent: {
          ...mockRegistration.tourEvent,
          providerId: 'other-provider'
        }
      };

      mockPrisma.touristRegistration.findUnique.mockResolvedValue(otherProviderRegistration);

      await expect(
        service.processRegistration(
          {
            registrationId: 'reg-1',
            approved: true
          },
          'admin-1',
          UserType.PROVIDER_ADMIN,
          'provider-1'
        )
      ).rejects.toThrow('Insufficient permissions to process this registration');
    });

    it('should prevent processing already processed registration', async () => {
      const processedRegistration = {
        ...mockRegistration,
        status: RegistrationStatus.APPROVED
      };

      mockPrisma.touristRegistration.findUnique.mockResolvedValue(processedRegistration);

      await expect(
        service.processRegistration(
          {
            registrationId: 'reg-1',
            approved: false,
            rejectedReason: 'Test'
          },
          'admin-1',
          UserType.PROVIDER_ADMIN,
          'provider-1'
        )
      ).rejects.toThrow('Registration has already been processed');
    });
  });

  describe('getTourEventRegistrations', () => {
    it('should successfully get registrations for provider admin', async () => {
      const mockTourEvent = {
        tourEventId: 'tour-1',
        providerId: 'provider-1'
      };

      const mockRegistrations = [
        {
          registrationId: 'reg-1',
          tourEventId: 'tour-1',
          touristUserId: 'tourist-1',
          status: RegistrationStatus.PENDING,
          registrationDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          tourist: {
            userId: 'tourist-1',
            firstName: 'John',
            lastName: 'Doe',
            emailAddress: 'john@test.com',
            phoneNumber: '+1234567890',
            country: 'USA'
          },
          approvedBy: null
        }
      ];

      // Mock the getTourEventById method
      vi.spyOn(service, 'getTourEventById').mockResolvedValue(mockTourEvent as any);
      mockPrisma.touristRegistration.findMany.mockResolvedValue(mockRegistrations);

      const result = await service.getTourEventRegistrations(
        'tour-1',
        'admin-1',
        UserType.PROVIDER_ADMIN,
        'provider-1'
      );

      expect(result).toHaveLength(1);
      expect(result[0].registrationId).toBe('reg-1');
    });

    it('should prevent non-provider-admin from viewing registrations', async () => {
      await expect(
        service.getTourEventRegistrations(
          'tour-1',
          'tourist-1',
          UserType.TOURIST,
          'provider-1'
        )
      ).rejects.toThrow('Insufficient permissions to view registrations');
    });

    it('should filter registrations by status', async () => {
      const mockTourEvent = {
        tourEventId: 'tour-1',
        providerId: 'provider-1'
      };

      const mockRegistrations = [
        {
          registrationId: 'reg-1',
          status: RegistrationStatus.APPROVED
        }
      ];

      vi.spyOn(service, 'getTourEventById').mockResolvedValue(mockTourEvent as any);
      mockPrisma.touristRegistration.findMany.mockResolvedValue(mockRegistrations);

      await service.getTourEventRegistrations(
        'tour-1',
        'admin-1',
        UserType.PROVIDER_ADMIN,
        'provider-1',
        RegistrationStatus.APPROVED
      );

      expect(mockPrisma.touristRegistration.findMany).toHaveBeenCalledWith({
        where: {
          tourEventId: 'tour-1',
          status: RegistrationStatus.APPROVED
        },
        include: expect.any(Object),
        orderBy: { registrationDate: 'desc' }
      });
    });
  });
});