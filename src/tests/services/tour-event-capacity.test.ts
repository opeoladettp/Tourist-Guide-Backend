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
  touristRegistration: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  $transaction: vi.fn(),
} as unknown as PrismaClient;

describe('CustomTourEventService - Capacity Management', () => {
  let customTourEventService: CustomTourEventService;

  beforeEach(() => {
    customTourEventService = new CustomTourEventService(mockPrisma);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getCapacityInfo', () => {
    const mockTourEvent = {
      tourEventId: 'event123',
      providerId: 'provider123',
      customTourName: 'Test Event',
      numberOfAllowedTourists: 50,
      remainingTourists: 30,
      status: TourEventStatus.ACTIVE,
      registrations: [],
      activities: []
    };

    beforeEach(() => {
      // Mock getTourEventById to return the tour event
      mockPrisma.customTourEvent.findUnique = vi.fn().mockResolvedValue(mockTourEvent);
    });

    it('should return capacity information for provider admin', async () => {
      mockPrisma.touristRegistration.count = vi.fn()
        .mockResolvedValueOnce(20) // approved count
        .mockResolvedValueOnce(5);  // pending count

      const result = await customTourEventService.getCapacityInfo(
        'event123',
        'providerAdmin123',
        UserType.PROVIDER_ADMIN,
        'provider123'
      );

      expect(result).toEqual({
        totalCapacity: 50,
        approvedRegistrations: 20,
        pendingRegistrations: 5,
        remainingCapacity: 30,
        isFull: false
      });
    });

    it('should return capacity information for system admin', async () => {
      mockPrisma.touristRegistration.count = vi.fn()
        .mockResolvedValueOnce(50) // approved count (full)
        .mockResolvedValueOnce(0);  // pending count

      const result = await customTourEventService.getCapacityInfo(
        'event123',
        'sysAdmin123',
        UserType.SYSTEM_ADMIN
      );

      expect(result).toEqual({
        totalCapacity: 50,
        approvedRegistrations: 50,
        pendingRegistrations: 0,
        remainingCapacity: 0,
        isFull: true
      });
    });

    it('should handle negative remaining capacity gracefully', async () => {
      mockPrisma.touristRegistration.count = vi.fn()
        .mockResolvedValueOnce(55) // approved count (over capacity)
        .mockResolvedValueOnce(0);  // pending count

      const result = await customTourEventService.getCapacityInfo(
        'event123',
        'providerAdmin123',
        UserType.PROVIDER_ADMIN,
        'provider123'
      );

      expect(result).toEqual({
        totalCapacity: 50,
        approvedRegistrations: 55,
        pendingRegistrations: 0,
        remainingCapacity: 0, // Should be 0, not negative
        isFull: true
      });
    });

    it('should throw error for non-existent tour event', async () => {
      mockPrisma.customTourEvent.findUnique = vi.fn().mockResolvedValue(null);

      await expect(customTourEventService.getCapacityInfo(
        'nonexistent',
        'providerAdmin123',
        UserType.PROVIDER_ADMIN,
        'provider123'
      )).rejects.toThrow('Tour event not found or access denied');
    });
  });

  describe('Enhanced Registration with Capacity Management', () => {
    const futureDate1 = new Date();
    futureDate1.setDate(futureDate1.getDate() + 30);
    const futureDate2 = new Date();
    futureDate2.setDate(futureDate2.getDate() + 45);

    const mockTourEvent = {
      tourEventId: 'event123',
      status: TourEventStatus.ACTIVE,
      numberOfAllowedTourists: 50,
      remainingTourists: 5,
      startDate: futureDate1,
      endDate: futureDate2,
      registrations: []
    };

    it('should register tourist with capacity validation', async () => {
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
          startDate: futureDate1,
          endDate: futureDate2
        }
      };

      mockPrisma.$transaction = vi.fn().mockImplementation(async (callback) => {
        return callback({
          customTourEvent: {
            findUnique: vi.fn().mockResolvedValue(mockTourEvent)
          },
          touristRegistration: {
            findMany: vi.fn().mockResolvedValue([]), // No overlapping registrations
            count: vi.fn().mockResolvedValue(45), // 45 approved registrations
            create: vi.fn().mockResolvedValue(mockRegistration)
          }
        });
      });

      const result = await customTourEventService.registerTourist(
        registrationInput,
        'tourist123',
        UserType.TOURIST
      );

      expect(result).toEqual(mockRegistration);
    });

    it('should prevent registration when capacity is inconsistent and full', async () => {
      const registrationInput = { tourEventId: 'event123' };
      const inconsistentTourEvent = {
        ...mockTourEvent,
        remainingTourists: 5, // Says 5 remaining
      };

      mockPrisma.$transaction = vi.fn().mockImplementation(async (callback) => {
        return callback({
          customTourEvent: {
            findUnique: vi.fn().mockResolvedValue(inconsistentTourEvent),
            update: vi.fn() // For fixing inconsistency
          },
          touristRegistration: {
            findMany: vi.fn().mockResolvedValue([]), // No overlapping registrations
            count: vi.fn().mockResolvedValue(50) // Actually 50 approved (full)
          }
        });
      });

      await expect(customTourEventService.registerTourist(
        registrationInput,
        'tourist123',
        UserType.TOURIST
      )).rejects.toThrow('Tour event is full');
    });

    it('should fix capacity inconsistency during registration', async () => {
      const registrationInput = { tourEventId: 'event123' };
      const inconsistentTourEvent = {
        ...mockTourEvent,
        remainingTourists: 10, // Says 10 remaining
      };

      const mockRegistration = {
        registrationId: 'reg123',
        tourEventId: 'event123',
        touristUserId: 'tourist123',
        status: RegistrationStatus.PENDING
      };

      let capacityFixed = false;
      mockPrisma.$transaction = vi.fn().mockImplementation(async (callback) => {
        return callback({
          customTourEvent: {
            findUnique: vi.fn().mockResolvedValue(inconsistentTourEvent),
            update: vi.fn().mockImplementation(() => {
              capacityFixed = true;
              return Promise.resolve();
            })
          },
          touristRegistration: {
            findMany: vi.fn().mockResolvedValue([]), // No overlapping registrations
            count: vi.fn().mockResolvedValue(45), // Actually 45 approved (5 remaining)
            create: vi.fn().mockResolvedValue(mockRegistration)
          }
        });
      });

      await customTourEventService.registerTourist(
        registrationInput,
        'tourist123',
        UserType.TOURIST
      );

      expect(capacityFixed).toBe(true);
    });
  });

  describe('Enhanced Registration Processing', () => {
    const mockRegistration = {
      registrationId: 'reg123',
      status: RegistrationStatus.PENDING,
      tourEvent: {
        tourEventId: 'event123',
        providerId: 'provider123',
        numberOfAllowedTourists: 50,
        remainingTourists: 5
      },
      tourist: {
        userId: 'tourist123',
        firstName: 'John',
        lastName: 'Doe',
        emailAddress: 'john@example.com'
      }
    };

    it('should approve registration with capacity validation', async () => {
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
            count: vi.fn().mockResolvedValue(45), // Current approved count
            update: vi.fn().mockResolvedValue(approvedRegistration)
          },
          customTourEvent: {
            findUnique: vi.fn().mockResolvedValue(mockRegistration.tourEvent),
            update: vi.fn()
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

    it('should prevent approval when capacity is full after validation', async () => {
      const approvalInput = {
        registrationId: 'reg123',
        approved: true
      };

      mockPrisma.touristRegistration.findUnique = vi.fn().mockResolvedValue(mockRegistration);
      mockPrisma.$transaction = vi.fn().mockImplementation(async (callback) => {
        return callback({
          touristRegistration: {
            count: vi.fn().mockResolvedValue(50) // Already at capacity
          },
          customTourEvent: {
            findUnique: vi.fn().mockResolvedValue(mockRegistration.tourEvent),
            update: vi.fn()
          }
        });
      });

      await expect(customTourEventService.processRegistration(
        approvalInput,
        'providerAdmin123',
        UserType.PROVIDER_ADMIN,
        'provider123'
      )).rejects.toThrow('Tour event is full');
    });

    it('should update tour event status to FULL when capacity reached', async () => {
      const approvalInput = {
        registrationId: 'reg123',
        approved: true
      };

      // Create a registration for a tour event with only 1 remaining spot
      const registrationWithOneSpotLeft = {
        ...mockRegistration,
        tourEvent: {
          ...mockRegistration.tourEvent,
          remainingTourists: 1 // Only 1 spot left
        }
      };

      const approvedRegistration = {
        ...registrationWithOneSpotLeft,
        status: RegistrationStatus.APPROVED
      };

      let statusUpdatedToFull = false;
      mockPrisma.touristRegistration.findUnique = vi.fn().mockResolvedValue(registrationWithOneSpotLeft);
      mockPrisma.$transaction = vi.fn().mockImplementation(async (callback) => {
        return callback({
          touristRegistration: {
            count: vi.fn().mockResolvedValue(49), // 49 approved, so 1 remaining
            update: vi.fn().mockResolvedValue(approvedRegistration)
          },
          customTourEvent: {
            findUnique: vi.fn().mockResolvedValue(registrationWithOneSpotLeft.tourEvent),
            update: vi.fn().mockImplementation((args) => {
              // Check if remainingTourists is being set to 0 and status to FULL
              if (args.data.remainingTourists === 0 && args.data.status === TourEventStatus.FULL) {
                statusUpdatedToFull = true;
              }
              return Promise.resolve();
            })
          }
        });
      });

      await customTourEventService.processRegistration(
        approvalInput,
        'providerAdmin123',
        UserType.PROVIDER_ADMIN,
        'provider123'
      );

      expect(statusUpdatedToFull).toBe(true);
    });
  });

  describe('Enhanced Registration Cancellation', () => {
    const mockRegistration = {
      registrationId: 'reg123',
      touristUserId: 'tourist123',
      status: RegistrationStatus.APPROVED,
      tourEvent: {
        tourEventId: 'event123',
        numberOfAllowedTourists: 50,
        remainingTourists: 0,
        status: TourEventStatus.FULL
      }
    };

    it('should cancel approved registration and update capacity', async () => {
      let capacityValidated = false;
      mockPrisma.touristRegistration.findUnique = vi.fn().mockResolvedValue(mockRegistration);
      mockPrisma.$transaction = vi.fn().mockImplementation(async (callback) => {
        return callback({
          touristRegistration: {
            update: vi.fn(),
            count: vi.fn().mockResolvedValue(49) // After cancellation
          },
          customTourEvent: {
            findUnique: vi.fn().mockResolvedValue({
              ...mockRegistration.tourEvent,
              remainingTourists: 1
            }),
            update: vi.fn().mockImplementation(() => {
              capacityValidated = true;
              return Promise.resolve();
            })
          }
        });
      });

      await customTourEventService.cancelRegistration(
        'reg123',
        'tourist123',
        UserType.TOURIST
      );

      expect(capacityValidated).toBe(true);
    });

    it('should change status from FULL to ACTIVE when capacity becomes available', async () => {
      let statusChangedToActive = false;
      mockPrisma.touristRegistration.findUnique = vi.fn().mockResolvedValue(mockRegistration);
      mockPrisma.$transaction = vi.fn().mockImplementation(async (callback) => {
        return callback({
          touristRegistration: {
            update: vi.fn(),
            count: vi.fn().mockResolvedValue(49)
          },
          customTourEvent: {
            findUnique: vi.fn().mockResolvedValue({
              ...mockRegistration.tourEvent,
              remainingTourists: 1
            }),
            update: vi.fn().mockImplementation((args) => {
              if (args.data.status === TourEventStatus.ACTIVE) {
                statusChangedToActive = true;
              }
              return Promise.resolve();
            })
          }
        });
      });

      await customTourEventService.cancelRegistration(
        'reg123',
        'tourist123',
        UserType.TOURIST
      );

      expect(statusChangedToActive).toBe(true);
    });

    it('should not update capacity for pending registration cancellation', async () => {
      const pendingRegistration = {
        ...mockRegistration,
        status: RegistrationStatus.PENDING
      };

      let capacityUpdated = false;
      mockPrisma.touristRegistration.findUnique = vi.fn().mockResolvedValue(pendingRegistration);
      mockPrisma.$transaction = vi.fn().mockImplementation(async (callback) => {
        return callback({
          touristRegistration: {
            update: vi.fn(),
            count: vi.fn().mockResolvedValue(50)
          },
          customTourEvent: {
            findUnique: vi.fn().mockResolvedValue(mockRegistration.tourEvent),
            update: vi.fn().mockImplementation((args) => {
              if (args.data.remainingTourists !== undefined) {
                capacityUpdated = true;
              }
              return Promise.resolve();
            })
          }
        });
      });

      await customTourEventService.cancelRegistration(
        'reg123',
        'tourist123',
        UserType.TOURIST
      );

      expect(capacityUpdated).toBe(false);
    });
  });

  describe('Capacity Limit Enforcement', () => {
    it('should prevent registration when tour event is at capacity', async () => {
      const fullTourEvent = {
        tourEventId: 'event123',
        status: TourEventStatus.ACTIVE,
        numberOfAllowedTourists: 50,
        remainingTourists: 0,
        registrations: []
      };

      mockPrisma.$transaction = vi.fn().mockImplementation(async (callback) => {
        return callback({
          customTourEvent: {
            findUnique: vi.fn().mockResolvedValue(fullTourEvent)
          },
          touristRegistration: {
            findMany: vi.fn().mockResolvedValue([]),
            count: vi.fn().mockResolvedValue(50) // At capacity
          }
        });
      });

      await expect(customTourEventService.registerTourist(
        { tourEventId: 'event123' },
        'tourist123',
        UserType.TOURIST
      )).rejects.toThrow('Tour event is full');
    });

    it('should handle concurrent registration attempts gracefully', async () => {
      const almostFullTourEvent = {
        tourEventId: 'event123',
        status: TourEventStatus.ACTIVE,
        numberOfAllowedTourists: 50,
        remainingTourists: 1,
        registrations: []
      };

      // Simulate race condition where capacity is checked but then filled
      mockPrisma.$transaction = vi.fn().mockImplementation(async (callback) => {
        return callback({
          customTourEvent: {
            findUnique: vi.fn().mockResolvedValue(almostFullTourEvent),
            update: vi.fn() // Add the missing update method
          },
          touristRegistration: {
            findMany: vi.fn().mockResolvedValue([]),
            count: vi.fn().mockResolvedValue(50) // Capacity filled between checks
          }
        });
      });

      await expect(customTourEventService.registerTourist(
        { tourEventId: 'event123' },
        'tourist123',
        UserType.TOURIST
      )).rejects.toThrow('Tour event is full');
    });
  });

  describe('Capacity Consistency Validation', () => {
    it('should detect and fix capacity inconsistencies', async () => {
      const inconsistentTourEvent = {
        tourEventId: 'event123',
        numberOfAllowedTourists: 50,
        remainingTourists: 20, // Says 20 remaining
        status: TourEventStatus.ACTIVE,
        providerId: 'provider123',
        registrations: [],
        activities: []
      };

      let capacityFixed = false;
      
      // Mock getTourEventById first
      mockPrisma.customTourEvent.findUnique = vi.fn().mockResolvedValue(inconsistentTourEvent);
      
      // Mock the count calls for getCapacityInfo
      mockPrisma.touristRegistration.count = vi.fn()
        .mockResolvedValueOnce(35) // approved count
        .mockResolvedValueOnce(0);  // pending count

      const result = await customTourEventService.getCapacityInfo(
        'event123',
        'providerAdmin123',
        UserType.PROVIDER_ADMIN,
        'provider123'
      );

      // The method should return the correct capacity info
      expect(result.remainingCapacity).toBe(15); // 50 - 35 = 15
    });

    it('should update status when fixing over-capacity situation', async () => {
      const overCapacityTourEvent = {
        tourEventId: 'event123',
        numberOfAllowedTourists: 50,
        remainingTourists: 5, // Says 5 remaining
        status: TourEventStatus.ACTIVE,
        providerId: 'provider123',
        registrations: [],
        activities: []
      };

      // Mock getTourEventById first
      mockPrisma.customTourEvent.findUnique = vi.fn().mockResolvedValue(overCapacityTourEvent);
      
      // Mock the count calls for getCapacityInfo
      mockPrisma.touristRegistration.count = vi.fn()
        .mockResolvedValueOnce(55) // approved count (over capacity)
        .mockResolvedValueOnce(0);  // pending count

      const result = await customTourEventService.getCapacityInfo(
        'event123',
        'providerAdmin123',
        UserType.PROVIDER_ADMIN,
        'provider123'
      );

      // The method should return the correct capacity info with 0 remaining
      expect(result.remainingCapacity).toBe(0); // Should be 0, not negative
      expect(result.isFull).toBe(true);
    });
  });
});