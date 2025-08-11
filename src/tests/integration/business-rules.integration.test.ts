import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '../../generated/prisma';
import { BusinessRuleValidator } from '../../services/business-rules';
import { setupTestDatabase, cleanupTestDatabase } from '../../utils/test-db-setup';

const prisma = new PrismaClient();

describe('Business Rules Integration Tests', () => {
  beforeEach(async () => {
    await setupTestDatabase();
  });

  afterEach(async () => {
    await cleanupTestDatabase();
  });

  describe('Tour Registration Business Rules', () => {
    it('should enforce overlapping registration prevention', async () => {
      // Create test data
      const provider = await prisma.provider.create({
        data: {
          companyName: 'Test Provider',
          country: 'Test Country',
          addressLine1: 'Test Address',
          city: 'Test City',
          stateRegion: 'Test State',
          companyDescription: 'Test Description',
          phoneNumber: '+1234567890',
          emailAddress: 'test@provider.com',
          corpIdTaxId: 'TEST123',
          isIsolatedInstance: false
        }
      });

      const user = await prisma.user.create({
        data: {
          firstName: 'Test',
          lastName: 'User',
          emailAddress: 'test@user.com',
          phoneNumber: '+1234567890',
          country: 'Test Country',
          passwordHash: 'hashedpassword',
          userType: 'Tourist',
          status: 'Active',
          providerId: provider.providerId
        }
      });

      const template = await prisma.tourTemplate.create({
        data: {
          templateName: 'Test Template',
          type: 'Cultural',
          year: 2024,
          startDate: new Date('2024-06-01'),
          endDate: new Date('2024-06-10'),
          detailedDescription: 'Test template description',
          sitesToVisit: []
        }
      });

      // Create first tour event
      const tourEvent1 = await prisma.customTourEvent.create({
        data: {
          providerId: provider.providerId,
          templateId: template.templateId,
          customTourName: 'First Tour',
          startDate: new Date('2024-06-01'),
          endDate: new Date('2024-06-10'),
          packageType: 'Standard',
          place1Hotel: 'Hotel 1',
          place2Hotel: 'Hotel 2',
          numberOfAllowedTourists: 10,
          remainingTourists: 10,
          status: 'Active',
          dailySchedule: []
        }
      });

      // Create second overlapping tour event
      const tourEvent2 = await prisma.customTourEvent.create({
        data: {
          providerId: provider.providerId,
          templateId: template.templateId,
          customTourName: 'Second Tour',
          startDate: new Date('2024-06-05'),
          endDate: new Date('2024-06-15'),
          packageType: 'Standard',
          place1Hotel: 'Hotel 1',
          place2Hotel: 'Hotel 2',
          numberOfAllowedTourists: 10,
          remainingTourists: 10,
          status: 'Active',
          dailySchedule: []
        }
      });

      // Create registration for first tour
      await prisma.tourEventRegistration.create({
        data: {
          userId: user.userId,
          tourEventId: tourEvent1.tourEventId,
          status: 'Approved',
          registrationDate: new Date()
        }
      });

      // Attempt to register for overlapping tour should fail
      await expect(
        BusinessRuleValidator.validateTourRegistration(
          user.userId,
          tourEvent2.tourEventId,
          provider.providerId
        )
      ).rejects.toThrow(/User already has a registration for "First Tour"/);
    });

    it('should enforce capacity limits', async () => {
      // Create test data with capacity of 1
      const provider = await prisma.provider.create({
        data: {
          companyName: 'Test Provider',
          country: 'Test Country',
          addressLine1: 'Test Address',
          city: 'Test City',
          stateRegion: 'Test State',
          companyDescription: 'Test Description',
          phoneNumber: '+1234567890',
          emailAddress: 'test@provider.com',
          corpIdTaxId: 'TEST123',
          isIsolatedInstance: false
        }
      });

      const template = await prisma.tourTemplate.create({
        data: {
          templateName: 'Test Template',
          type: 'Cultural',
          year: 2024,
          startDate: new Date('2024-06-01'),
          endDate: new Date('2024-06-10'),
          detailedDescription: 'Test template description',
          sitesToVisit: []
        }
      });

      const tourEvent = await prisma.customTourEvent.create({
        data: {
          providerId: provider.providerId,
          templateId: template.templateId,
          customTourName: 'Full Tour',
          startDate: new Date('2024-06-01'),
          endDate: new Date('2024-06-10'),
          packageType: 'Standard',
          place1Hotel: 'Hotel 1',
          place2Hotel: 'Hotel 2',
          numberOfAllowedTourists: 1,
          remainingTourists: 0, // Already at capacity
          status: 'Active',
          dailySchedule: []
        }
      });

      const user = await prisma.user.create({
        data: {
          firstName: 'Test',
          lastName: 'User',
          emailAddress: 'test@user.com',
          phoneNumber: '+1234567890',
          country: 'Test Country',
          passwordHash: 'hashedpassword',
          userType: 'Tourist',
          status: 'Active',
          providerId: provider.providerId
        }
      });

      // Attempt to register for full tour should fail
      await expect(
        BusinessRuleValidator.validateTourRegistration(
          user.userId,
          tourEvent.tourEventId,
          provider.providerId
        )
      ).rejects.toThrow('Tour event has reached maximum capacity');
    });

    it('should enforce data isolation between providers', async () => {
      // Create two providers
      const provider1 = await prisma.provider.create({
        data: {
          companyName: 'Provider 1',
          country: 'Test Country',
          addressLine1: 'Test Address',
          city: 'Test City',
          stateRegion: 'Test State',
          companyDescription: 'Test Description',
          phoneNumber: '+1234567890',
          emailAddress: 'test1@provider.com',
          corpIdTaxId: 'TEST123',
          isIsolatedInstance: false
        }
      });

      const provider2 = await prisma.provider.create({
        data: {
          companyName: 'Provider 2',
          country: 'Test Country',
          addressLine1: 'Test Address',
          city: 'Test City',
          stateRegion: 'Test State',
          companyDescription: 'Test Description',
          phoneNumber: '+1234567890',
          emailAddress: 'test2@provider.com',
          corpIdTaxId: 'TEST456',
          isIsolatedInstance: false
        }
      });

      const user = await prisma.user.create({
        data: {
          firstName: 'Test',
          lastName: 'User',
          emailAddress: 'test@user.com',
          phoneNumber: '+1234567890',
          country: 'Test Country',
          passwordHash: 'hashedpassword',
          userType: 'Tourist',
          status: 'Active',
          providerId: provider1.providerId
        }
      });

      const template = await prisma.tourTemplate.create({
        data: {
          templateName: 'Test Template',
          type: 'Cultural',
          year: 2024,
          startDate: new Date('2024-06-01'),
          endDate: new Date('2024-06-10'),
          detailedDescription: 'Test template description',
          sitesToVisit: []
        }
      });

      const tourEvent = await prisma.customTourEvent.create({
        data: {
          providerId: provider2.providerId, // Different provider
          templateId: template.templateId,
          customTourName: 'Cross Provider Tour',
          startDate: new Date('2024-06-01'),
          endDate: new Date('2024-06-10'),
          packageType: 'Standard',
          place1Hotel: 'Hotel 1',
          place2Hotel: 'Hotel 2',
          numberOfAllowedTourists: 10,
          remainingTourists: 10,
          status: 'Active',
          dailySchedule: []
        }
      });

      // User from provider1 trying to register for provider2's tour should fail
      await expect(
        BusinessRuleValidator.validateTourRegistration(
          user.userId,
          tourEvent.tourEventId,
          provider1.providerId
        )
      ).rejects.toThrow('User cannot register for tour events from different providers');
    });
  });

  describe('Activity Scheduling Business Rules', () => {
    it('should prevent conflicting activity schedules', async () => {
      const provider = await prisma.provider.create({
        data: {
          companyName: 'Test Provider',
          country: 'Test Country',
          addressLine1: 'Test Address',
          city: 'Test City',
          stateRegion: 'Test State',
          companyDescription: 'Test Description',
          phoneNumber: '+1234567890',
          emailAddress: 'test@provider.com',
          corpIdTaxId: 'TEST123',
          isIsolatedInstance: false
        }
      });

      const template = await prisma.tourTemplate.create({
        data: {
          templateName: 'Test Template',
          type: 'Cultural',
          year: 2024,
          startDate: new Date('2024-06-01'),
          endDate: new Date('2024-06-10'),
          detailedDescription: 'Test template description',
          sitesToVisit: []
        }
      });

      const tourEvent = await prisma.customTourEvent.create({
        data: {
          providerId: provider.providerId,
          templateId: template.templateId,
          customTourName: 'Test Tour',
          startDate: new Date('2024-06-01'),
          endDate: new Date('2024-06-10'),
          packageType: 'Standard',
          place1Hotel: 'Hotel 1',
          place2Hotel: 'Hotel 2',
          numberOfAllowedTourists: 10,
          remainingTourists: 10,
          status: 'Active',
          dailySchedule: []
        }
      });

      const activityType = await prisma.activityType.create({
        data: {
          typeName: 'Sightseeing',
          description: 'Visit tourist attractions'
        }
      });

      // Create existing activity
      await prisma.activity.create({
        data: {
          tourEventId: tourEvent.tourEventId,
          activityTypeId: activityType.activityTypeId,
          activityName: 'Existing Activity',
          activityDate: new Date('2024-06-01'),
          startTime: '10:00',
          endTime: '12:00',
          description: 'Existing activity description'
        }
      });

      // Attempt to create conflicting activity should fail
      await expect(
        BusinessRuleValidator.validateActivityScheduling(
          tourEvent.tourEventId,
          new Date('2024-06-01'),
          '11:00',
          '13:00'
        )
      ).rejects.toThrow(/Activity scheduling conflict detected with "Existing Activity"/);
    });
  });

  describe('Document Access Business Rules', () => {
    it('should enforce document access permissions', async () => {
      const provider1 = await prisma.provider.create({
        data: {
          companyName: 'Provider 1',
          country: 'Test Country',
          addressLine1: 'Test Address',
          city: 'Test City',
          stateRegion: 'Test State',
          companyDescription: 'Test Description',
          phoneNumber: '+1234567890',
          emailAddress: 'test1@provider.com',
          corpIdTaxId: 'TEST123',
          isIsolatedInstance: false
        }
      });

      const provider2 = await prisma.provider.create({
        data: {
          companyName: 'Provider 2',
          country: 'Test Country',
          addressLine1: 'Test Address',
          city: 'Test City',
          stateRegion: 'Test State',
          companyDescription: 'Test Description',
          phoneNumber: '+1234567890',
          emailAddress: 'test2@provider.com',
          corpIdTaxId: 'TEST456',
          isIsolatedInstance: false
        }
      });

      const user1 = await prisma.user.create({
        data: {
          firstName: 'User',
          lastName: 'One',
          emailAddress: 'user1@test.com',
          phoneNumber: '+1234567890',
          country: 'Test Country',
          passwordHash: 'hashedpassword',
          userType: 'Tourist',
          status: 'Active',
          providerId: provider1.providerId
        }
      });

      const user2 = await prisma.user.create({
        data: {
          firstName: 'User',
          lastName: 'Two',
          emailAddress: 'user2@test.com',
          phoneNumber: '+1234567890',
          country: 'Test Country',
          passwordHash: 'hashedpassword',
          userType: 'Tourist',
          status: 'Active',
          providerId: provider2.providerId
        }
      });

      const document = await prisma.document.create({
        data: {
          userId: user1.userId,
          type: 'Passport',
          fileName: 'passport.pdf',
          description: 'User passport',
          uploadedByUserId: user1.userId,
          uploadDate: new Date(),
          fileStoragePath: '/documents/passport.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf'
        }
      });

      // User2 trying to access User1's document should fail
      await expect(
        BusinessRuleValidator.validateDocumentAccess(user2.userId, document.documentId)
      ).rejects.toThrow('Cannot access document belonging to another user');
    });
  });

  describe('User Role Change Business Rules', () => {
    it('should prevent changing last system admin role', async () => {
      // Create only one system admin
      const systemAdmin = await prisma.user.create({
        data: {
          firstName: 'System',
          lastName: 'Admin',
          emailAddress: 'admin@system.com',
          phoneNumber: '+1234567890',
          country: 'Test Country',
          passwordHash: 'hashedpassword',
          userType: 'SystemAdmin',
          status: 'Active'
        }
      });

      const provider = await prisma.provider.create({
        data: {
          companyName: 'Test Provider',
          country: 'Test Country',
          addressLine1: 'Test Address',
          city: 'Test City',
          stateRegion: 'Test State',
          companyDescription: 'Test Description',
          phoneNumber: '+1234567890',
          emailAddress: 'test@provider.com',
          corpIdTaxId: 'TEST123',
          isIsolatedInstance: false
        }
      });

      // Attempt to change the only system admin's role should fail
      await expect(
        BusinessRuleValidator.validateUserRoleChange(
          systemAdmin.userId,
          'ProviderAdmin',
          provider.providerId
        )
      ).rejects.toThrow('Cannot change role of the last active system administrator');
    });
  });

  describe('Provider Deletion Business Rules', () => {
    it('should prevent deletion of provider with active users', async () => {
      const provider = await prisma.provider.create({
        data: {
          companyName: 'Test Provider',
          country: 'Test Country',
          addressLine1: 'Test Address',
          city: 'Test City',
          stateRegion: 'Test State',
          companyDescription: 'Test Description',
          phoneNumber: '+1234567890',
          emailAddress: 'test@provider.com',
          corpIdTaxId: 'TEST123',
          isIsolatedInstance: false
        }
      });

      // Create active user
      await prisma.user.create({
        data: {
          firstName: 'Active',
          lastName: 'User',
          emailAddress: 'active@user.com',
          phoneNumber: '+1234567890',
          country: 'Test Country',
          passwordHash: 'hashedpassword',
          userType: 'Tourist',
          status: 'Active',
          providerId: provider.providerId
        }
      });

      // Attempt to delete provider with active users should fail
      await expect(
        BusinessRuleValidator.validateProviderDeletion(provider.providerId)
      ).rejects.toThrow('Cannot delete provider with 1 active users');
    });

    it('should prevent deletion of provider with active tour events', async () => {
      const provider = await prisma.provider.create({
        data: {
          companyName: 'Test Provider',
          country: 'Test Country',
          addressLine1: 'Test Address',
          city: 'Test City',
          stateRegion: 'Test State',
          companyDescription: 'Test Description',
          phoneNumber: '+1234567890',
          emailAddress: 'test@provider.com',
          corpIdTaxId: 'TEST123',
          isIsolatedInstance: false
        }
      });

      const template = await prisma.tourTemplate.create({
        data: {
          templateName: 'Test Template',
          type: 'Cultural',
          year: 2024,
          startDate: new Date('2024-06-01'),
          endDate: new Date('2024-06-10'),
          detailedDescription: 'Test template description',
          sitesToVisit: []
        }
      });

      // Create active tour event
      await prisma.customTourEvent.create({
        data: {
          providerId: provider.providerId,
          templateId: template.templateId,
          customTourName: 'Active Tour',
          startDate: new Date('2024-06-01'),
          endDate: new Date('2024-06-10'),
          packageType: 'Standard',
          place1Hotel: 'Hotel 1',
          place2Hotel: 'Hotel 2',
          numberOfAllowedTourists: 10,
          remainingTourists: 10,
          status: 'Active',
          dailySchedule: []
        }
      });

      // Attempt to delete provider with active tour events should fail
      await expect(
        BusinessRuleValidator.validateProviderDeletion(provider.providerId)
      ).rejects.toThrow('Cannot delete provider with 1 active tour events');
    });
  });
});