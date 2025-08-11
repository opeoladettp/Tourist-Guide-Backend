import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BusinessRuleValidator, setPrismaClient } from '../../services/business-rules';
import { ErrorFactory } from '../../middleware/error-handler';

// Mock PrismaClient constructor
vi.mock('../../generated/prisma', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    customTourEvent: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn()
    },
    tourEventRegistration: {
      findMany: vi.fn()
    },
    user: {
      findUnique: vi.fn(),
      count: vi.fn()
    },
    activity: {
      findMany: vi.fn()
    },
    document: {
      findUnique: vi.fn()
    },
    tourTemplate: {
      findUnique: vi.fn()
    }
  }))
}));

// Import the mocked PrismaClient
const { PrismaClient } = await import('../../generated/prisma');
const mockPrisma = new PrismaClient() as any;

describe('BusinessRuleValidator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set the mocked prisma client
    setPrismaClient(mockPrisma);
  });

  describe('validateTourRegistration', () => {
    it('should validate successful tour registration', async () => {
      const tourEvent = {
        tourEventId: 'tour1',
        providerId: 'provider1',
        status: 'Active',
        remainingTourists: 5,
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-06-10'),
        registrations: []
      };

      mockPrisma.customTourEvent.findUnique.mockResolvedValue(tourEvent);
      mockPrisma.tourEventRegistration.findMany.mockResolvedValue([]);

      await expect(
        BusinessRuleValidator.validateTourRegistration('user1', 'tour1', 'provider1')
      ).resolves.not.toThrow();
    });

    it('should throw error if tour event not found', async () => {
      mockPrisma.customTourEvent.findUnique.mockResolvedValue(null);

      await expect(
        BusinessRuleValidator.validateTourRegistration('user1', 'tour1')
      ).rejects.toThrow('Tour event with ID \'tour1\' not found');
    });

    it('should throw error if tour event is not active', async () => {
      const tourEvent = {
        tourEventId: 'tour1',
        status: 'Cancelled',
        registrations: []
      };

      mockPrisma.customTourEvent.findUnique.mockResolvedValue(tourEvent);

      await expect(
        BusinessRuleValidator.validateTourRegistration('user1', 'tour1')
      ).rejects.toThrow('Cannot register for tour event that is not active');
    });

    it('should throw error if tour event is at capacity', async () => {
      const tourEvent = {
        tourEventId: 'tour1',
        status: 'Active',
        remainingTourists: 0,
        registrations: []
      };

      mockPrisma.customTourEvent.findUnique.mockResolvedValue(tourEvent);

      await expect(
        BusinessRuleValidator.validateTourRegistration('user1', 'tour1')
      ).rejects.toThrow('Tour event has reached maximum capacity');
    });

    it('should throw error if user already has active registration', async () => {
      const tourEvent = {
        tourEventId: 'tour1',
        status: 'Active',
        remainingTourists: 5,
        registrations: [{ status: 'Approved' }]
      };

      mockPrisma.customTourEvent.findUnique.mockResolvedValue(tourEvent);

      await expect(
        BusinessRuleValidator.validateTourRegistration('user1', 'tour1')
      ).rejects.toThrow('User already has an active registration for this tour event');
    });

    it('should throw error for data isolation violation', async () => {
      const tourEvent = {
        tourEventId: 'tour1',
        providerId: 'provider2',
        status: 'Active',
        remainingTourists: 5,
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-06-10'),
        registrations: []
      };

      mockPrisma.customTourEvent.findUnique.mockResolvedValue(tourEvent);
      mockPrisma.tourEventRegistration.findMany.mockResolvedValue([]);

      await expect(
        BusinessRuleValidator.validateTourRegistration('user1', 'tour1', 'provider1')
      ).rejects.toThrow('User cannot register for tour events from different providers');
    });
  });

  describe('validateOverlappingRegistrations', () => {
    it('should pass when no overlapping registrations exist', async () => {
      mockPrisma.tourEventRegistration.findMany.mockResolvedValue([]);

      await expect(
        BusinessRuleValidator.validateOverlappingRegistrations(
          'user1',
          new Date('2024-06-01'),
          new Date('2024-06-10')
        )
      ).resolves.not.toThrow();
    });

    it('should throw error when overlapping registration exists', async () => {
      const overlappingRegistration = {
        tourEvent: {
          customTourName: 'Existing Tour',
          startDate: new Date('2024-05-25'),
          endDate: new Date('2024-06-05')
        }
      };

      mockPrisma.tourEventRegistration.findMany.mockResolvedValue([overlappingRegistration]);

      await expect(
        BusinessRuleValidator.validateOverlappingRegistrations(
          'user1',
          new Date('2024-06-01'),
          new Date('2024-06-10')
        )
      ).rejects.toThrow('User already has a registration for "Existing Tour"');
    });
  });

  describe('validateProviderAccess', () => {
    it('should allow system admin access (no provider ID)', async () => {
      await expect(
        BusinessRuleValidator.validateProviderAccess(undefined, 'provider1', 'tour event')
      ).resolves.not.toThrow();
    });

    it('should allow access to same provider resources', async () => {
      await expect(
        BusinessRuleValidator.validateProviderAccess('provider1', 'provider1', 'tour event')
      ).resolves.not.toThrow();
    });

    it('should throw error for different provider access', async () => {
      await expect(
        BusinessRuleValidator.validateProviderAccess('provider1', 'provider2', 'tour event')
      ).rejects.toThrow('Cannot access tour event from different provider');
    });
  });

  describe('validateUserProviderAccess', () => {
    it('should allow system admin to access any user', async () => {
      const requestingUser = { userType: 'SystemAdmin', providerId: null };
      const targetUser = { providerId: 'provider1' };

      mockPrisma.user.findUnique
        .mockResolvedValueOnce(requestingUser)
        .mockResolvedValueOnce(targetUser);

      await expect(
        BusinessRuleValidator.validateUserProviderAccess('admin1', 'user1')
      ).resolves.not.toThrow();
    });

    it('should allow provider admin to access users from same provider', async () => {
      const requestingUser = { userType: 'ProviderAdmin', providerId: 'provider1' };
      const targetUser = { providerId: 'provider1' };

      mockPrisma.user.findUnique
        .mockResolvedValueOnce(requestingUser)
        .mockResolvedValueOnce(targetUser);

      await expect(
        BusinessRuleValidator.validateUserProviderAccess('admin1', 'user1')
      ).resolves.not.toThrow();
    });

    it('should throw error for provider admin accessing different provider user', async () => {
      const requestingUser = { userType: 'ProviderAdmin', providerId: 'provider1' };
      const targetUser = { providerId: 'provider2' };

      mockPrisma.user.findUnique
        .mockResolvedValueOnce(requestingUser)
        .mockResolvedValueOnce(targetUser);

      await expect(
        BusinessRuleValidator.validateUserProviderAccess('admin1', 'user1')
      ).rejects.toThrow('Cannot access user from different provider');
    });

    it('should allow tourist to access own profile', async () => {
      const requestingUser = { userType: 'Tourist', providerId: 'provider1' };
      const targetUser = { providerId: 'provider1' };

      mockPrisma.user.findUnique
        .mockResolvedValueOnce(requestingUser)
        .mockResolvedValueOnce(targetUser);

      await expect(
        BusinessRuleValidator.validateUserProviderAccess('user1', 'user1')
      ).resolves.not.toThrow();
    });

    it('should throw error for tourist accessing other user profile', async () => {
      const requestingUser = { userType: 'Tourist', providerId: 'provider1' };
      const targetUser = { providerId: 'provider1' };

      mockPrisma.user.findUnique
        .mockResolvedValueOnce(requestingUser)
        .mockResolvedValueOnce(targetUser);

      await expect(
        BusinessRuleValidator.validateUserProviderAccess('user1', 'user2')
      ).rejects.toThrow('Tourists can only access their own profile');
    });
  });

  describe('validateCapacityUpdate', () => {
    it('should allow capacity increase', async () => {
      const tourEvent = {
        tourEventId: 'tour1',
        registrations: [{ status: 'Approved' }, { status: 'Approved' }]
      };

      mockPrisma.customTourEvent.findUnique.mockResolvedValue(tourEvent);

      await expect(
        BusinessRuleValidator.validateCapacityUpdate('tour1', 5)
      ).resolves.not.toThrow();
    });

    it('should throw error when reducing capacity below approved registrations', async () => {
      const tourEvent = {
        tourEventId: 'tour1',
        registrations: [
          { status: 'Approved' },
          { status: 'Approved' },
          { status: 'Approved' }
        ]
      };

      mockPrisma.customTourEvent.findUnique.mockResolvedValue(tourEvent);

      await expect(
        BusinessRuleValidator.validateCapacityUpdate('tour1', 2)
      ).rejects.toThrow('Cannot reduce capacity to 2 as there are already 3 approved registrations');
    });
  });

  describe('validateActivityScheduling', () => {
    it('should allow non-conflicting activity scheduling', async () => {
      mockPrisma.activity.findMany.mockResolvedValue([]);

      await expect(
        BusinessRuleValidator.validateActivityScheduling(
          'tour1',
          new Date('2024-06-01'),
          '09:00',
          '11:00'
        )
      ).resolves.not.toThrow();
    });

    it('should throw error for conflicting activity scheduling', async () => {
      const conflictingActivity = {
        activityName: 'Existing Activity',
        startTime: '10:00',
        endTime: '12:00'
      };

      mockPrisma.activity.findMany.mockResolvedValue([conflictingActivity]);

      await expect(
        BusinessRuleValidator.validateActivityScheduling(
          'tour1',
          new Date('2024-06-01'),
          '09:00',
          '11:00'
        )
      ).rejects.toThrow('Activity scheduling conflict detected with "Existing Activity" (10:00 - 12:00)');
    });
  });

  describe('validateDocumentAccess', () => {
    it('should allow system admin to access any document', async () => {
      const document = {
        documentId: 'doc1',
        userId: 'user1',
        user: { userId: 'user1', providerId: 'provider1' }
      };
      const requestingUser = { userType: 'SystemAdmin', providerId: null };

      mockPrisma.document.findUnique.mockResolvedValue(document);
      mockPrisma.user.findUnique.mockResolvedValue(requestingUser);

      await expect(
        BusinessRuleValidator.validateDocumentAccess('admin1', 'doc1')
      ).resolves.not.toThrow();
    });

    it('should allow user to access own document', async () => {
      const document = {
        documentId: 'doc1',
        userId: 'user1',
        user: { userId: 'user1', providerId: 'provider1' }
      };
      const requestingUser = { userType: 'Tourist', providerId: 'provider1' };

      mockPrisma.document.findUnique.mockResolvedValue(document);
      mockPrisma.user.findUnique.mockResolvedValue(requestingUser);

      await expect(
        BusinessRuleValidator.validateDocumentAccess('user1', 'doc1')
      ).resolves.not.toThrow();
    });

    it('should throw error for user accessing other user document', async () => {
      const document = {
        documentId: 'doc1',
        userId: 'user2',
        user: { userId: 'user2', providerId: 'provider1' }
      };
      const requestingUser = { userType: 'Tourist', providerId: 'provider1' };

      mockPrisma.document.findUnique.mockResolvedValue(document);
      mockPrisma.user.findUnique.mockResolvedValue(requestingUser);

      await expect(
        BusinessRuleValidator.validateDocumentAccess('user1', 'doc1')
      ).rejects.toThrow('Cannot access document belonging to another user');
    });
  });

  describe('validateTourTemplateUsage', () => {
    it('should allow modification of unused template', async () => {
      const template = { templateId: 'template1', templateName: 'Test Template' };
      mockPrisma.tourTemplate.findUnique.mockResolvedValue(template);
      mockPrisma.customTourEvent.findMany.mockResolvedValue([]);

      await expect(
        BusinessRuleValidator.validateTourTemplateUsage('template1')
      ).resolves.not.toThrow();
    });

    it('should throw error for template in use', async () => {
      const template = { templateId: 'template1', templateName: 'Test Template' };
      const activeTourEvents = [
        { customTourName: 'Active Tour 1', status: 'Active' },
        { customTourName: 'Draft Tour 1', status: 'Draft' }
      ];

      mockPrisma.tourTemplate.findUnique.mockResolvedValue(template);
      mockPrisma.customTourEvent.findMany.mockResolvedValue(activeTourEvents);

      await expect(
        BusinessRuleValidator.validateTourTemplateUsage('template1')
      ).rejects.toThrow('Cannot modify or delete tour template "Test Template" as it is being used by active tour events: Active Tour 1, Draft Tour 1');
    });
  });

  describe('validateUserRoleChange', () => {
    it('should allow role change for non-system admin', async () => {
      const user = { userType: 'Tourist', providerId: 'provider1' };
      mockPrisma.user.findUnique.mockResolvedValue(user);

      await expect(
        BusinessRuleValidator.validateUserRoleChange('user1', 'ProviderAdmin', 'provider1')
      ).resolves.not.toThrow();
    });

    it('should throw error when changing last system admin role', async () => {
      const user = { userType: 'SystemAdmin', providerId: null };
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.user.count.mockResolvedValue(1);

      await expect(
        BusinessRuleValidator.validateUserRoleChange('admin1', 'ProviderAdmin', 'provider1')
      ).rejects.toThrow('Cannot change role of the last active system administrator');
    });

    it('should throw error for non-system admin without provider', async () => {
      const user = { userType: 'Tourist', providerId: 'provider1' };
      mockPrisma.user.findUnique.mockResolvedValue(user);

      await expect(
        BusinessRuleValidator.validateUserRoleChange('user1', 'ProviderAdmin')
      ).rejects.toThrow('Provider ID is required for ProviderAdmin and Tourist roles');
    });

    it('should throw error for system admin with provider', async () => {
      const user = { userType: 'Tourist', providerId: 'provider1' };
      mockPrisma.user.findUnique.mockResolvedValue(user);

      await expect(
        BusinessRuleValidator.validateUserRoleChange('user1', 'SystemAdmin', 'provider1')
      ).rejects.toThrow('System administrators cannot be assigned to a specific provider');
    });
  });

  describe('validateProviderDeletion', () => {
    it('should allow deletion of provider with no active users or events', async () => {
      mockPrisma.user.count.mockResolvedValue(0);
      mockPrisma.customTourEvent.count.mockResolvedValue(0);

      await expect(
        BusinessRuleValidator.validateProviderDeletion('provider1')
      ).resolves.not.toThrow();
    });

    it('should throw error for provider with active users', async () => {
      mockPrisma.user.count.mockResolvedValue(3);
      mockPrisma.customTourEvent.count.mockResolvedValue(0);

      await expect(
        BusinessRuleValidator.validateProviderDeletion('provider1')
      ).rejects.toThrow('Cannot delete provider with 3 active users');
    });

    it('should throw error for provider with active tour events', async () => {
      mockPrisma.user.count.mockResolvedValue(0);
      mockPrisma.customTourEvent.count.mockResolvedValue(2);

      await expect(
        BusinessRuleValidator.validateProviderDeletion('provider1')
      ).rejects.toThrow('Cannot delete provider with 2 active tour events');
    });
  });
});