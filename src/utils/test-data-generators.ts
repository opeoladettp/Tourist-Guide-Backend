import { UserType, UserStatus } from '../types/user';
import { TourEventStatus, RegistrationStatus } from '../types/custom-tour-event';
import { DocumentType } from '../types/document';
import { NotificationChannel, NotificationPriority } from '../types/notification';

/**
 * Test data generators for creating mock data in unit tests
 */

export interface TestUser {
  userId: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  emailAddress: string;
  phoneNumber: string;
  country: string;
  passwordHash: string;
  userType: UserType;
  status: UserStatus;
  passportNumber?: string;
  dateOfBirth?: Date;
  gender?: string;
  providerId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestProvider {
  providerId: string;
  companyName: string;
  country: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  stateRegion: string;
  companyDescription: string;
  phoneNumber: string;
  emailAddress: string;
  corpIdTaxId: string;
  isIsolatedInstance: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestTourTemplate {
  templateId: string;
  templateName: string;
  type: string;
  year: number;
  startDate: Date;
  endDate: Date;
  detailedDescription: string;
  sitesToVisit: any[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TestCustomTourEvent {
  tourEventId: string;
  providerId: string;
  templateId?: string;
  customTourName: string;
  startDate: Date;
  endDate: Date;
  packageType: string;
  place1Hotel: string;
  place2Hotel: string;
  numberOfAllowedTourists: number;
  remainingTourists: number;
  groupChatInfo?: string;
  status: TourEventStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestDocument {
  documentId: string;
  userId: string;
  type: DocumentType;
  fileName: string;
  description?: string;
  uploadedByUserId: string;
  uploadDate: Date;
  fileStoragePath: string;
  fileSize: number;
  mimeType: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestActivity {
  activityId: string;
  tourEventId: string;
  activityTypeId?: string;
  activityName: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  webLink?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestNotification {
  notificationId: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  channels: NotificationChannel[];
  priority: NotificationPriority;
  scheduledFor?: Date;
  sentAt?: Date;
  status: 'pending' | 'sent' | 'failed';
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Generate test user data
 */
export function generateTestUser(overrides: Partial<TestUser> = {}): TestUser {
  const baseUser: TestUser = {
    userId: `user-${Math.random().toString(36).substr(2, 9)}`,
    firstName: 'John',
    middleName: 'Michael',
    lastName: 'Doe',
    emailAddress: `john.doe.${Math.random().toString(36).substr(2, 5)}@example.com`,
    phoneNumber: '+1234567890',
    country: 'United States',
    passwordHash: '$2b$10$hashedpassword',
    userType: UserType.TOURIST,
    status: UserStatus.ACTIVE,
    passportNumber: 'P123456789',
    dateOfBirth: new Date('1990-01-01'),
    gender: 'Male',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  return { ...baseUser, ...overrides };
}

/**
 * Generate test system admin user
 */
export function generateTestSystemAdmin(overrides: Partial<TestUser> = {}): TestUser {
  return generateTestUser({
    userType: UserType.SYSTEM_ADMIN,
    firstName: 'Admin',
    lastName: 'User',
    emailAddress: `admin.${Math.random().toString(36).substr(2, 5)}@system.com`,
    providerId: undefined,
    passportNumber: undefined,
    dateOfBirth: undefined,
    gender: undefined,
    ...overrides
  });
}

/**
 * Generate test provider admin user
 */
export function generateTestProviderAdmin(providerId: string, overrides: Partial<TestUser> = {}): TestUser {
  return generateTestUser({
    userType: UserType.PROVIDER_ADMIN,
    firstName: 'Provider',
    lastName: 'Admin',
    emailAddress: `provider.admin.${Math.random().toString(36).substr(2, 5)}@company.com`,
    providerId,
    passportNumber: undefined,
    dateOfBirth: undefined,
    gender: undefined,
    ...overrides
  });
}

/**
 * Generate test tourist user
 */
export function generateTestTourist(providerId?: string, overrides: Partial<TestUser> = {}): TestUser {
  return generateTestUser({
    userType: UserType.TOURIST,
    providerId,
    ...overrides
  });
}

/**
 * Generate test provider data
 */
export function generateTestProvider(overrides: Partial<TestProvider> = {}): TestProvider {
  const baseProvider: TestProvider = {
    providerId: `provider-${Math.random().toString(36).substr(2, 9)}`,
    companyName: `Travel Company ${Math.random().toString(36).substr(2, 5)}`,
    country: 'United States',
    addressLine1: '123 Main Street',
    addressLine2: 'Suite 100',
    city: 'New York',
    stateRegion: 'NY',
    companyDescription: 'A leading travel company providing exceptional tour experiences.',
    phoneNumber: '+1234567890',
    emailAddress: `contact@company${Math.random().toString(36).substr(2, 5)}.com`,
    corpIdTaxId: `TAX${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
    isIsolatedInstance: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  return { ...baseProvider, ...overrides };
}

/**
 * Generate test tour template data
 */
export function generateTestTourTemplate(overrides: Partial<TestTourTemplate> = {}): TestTourTemplate {
  const baseTemplate: TestTourTemplate = {
    templateId: `template-${Math.random().toString(36).substr(2, 9)}`,
    templateName: `Amazing Tour ${Math.random().toString(36).substr(2, 5)}`,
    type: 'Cultural',
    year: new Date().getFullYear(),
    startDate: new Date('2024-06-01'),
    endDate: new Date('2024-06-07'),
    detailedDescription: 'An amazing cultural tour experience with visits to historical sites.',
    sitesToVisit: [
      {
        siteId: 'site-1',
        siteName: 'Historical Museum',
        description: 'A world-class museum with ancient artifacts',
        visitDuration: 120,
        location: 'Downtown'
      },
      {
        siteId: 'site-2',
        siteName: 'Cultural Center',
        description: 'Experience local culture and traditions',
        visitDuration: 90,
        location: 'City Center'
      }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  return { ...baseTemplate, ...overrides };
}

/**
 * Generate test custom tour event data
 */
export function generateTestCustomTourEvent(providerId: string, overrides: Partial<TestCustomTourEvent> = {}): TestCustomTourEvent {
  const baseEvent: TestCustomTourEvent = {
    tourEventId: `event-${Math.random().toString(36).substr(2, 9)}`,
    providerId,
    templateId: `template-${Math.random().toString(36).substr(2, 9)}`,
    customTourName: `Custom Tour ${Math.random().toString(36).substr(2, 5)}`,
    startDate: new Date('2024-07-01'),
    endDate: new Date('2024-07-07'),
    packageType: 'Premium',
    place1Hotel: 'Grand Hotel',
    place2Hotel: 'Luxury Resort',
    numberOfAllowedTourists: 20,
    remainingTourists: 15,
    groupChatInfo: 'WhatsApp group will be created',
    status: TourEventStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  return { ...baseEvent, ...overrides };
}

/**
 * Generate test document data
 */
export function generateTestDocument(userId: string, overrides: Partial<TestDocument> = {}): TestDocument {
  const baseDocument: TestDocument = {
    documentId: `doc-${Math.random().toString(36).substr(2, 9)}`,
    userId,
    type: DocumentType.PASSPORT,
    fileName: `passport_${Math.random().toString(36).substr(2, 5)}.pdf`,
    description: 'Passport document for travel',
    uploadedByUserId: userId,
    uploadDate: new Date(),
    fileStoragePath: `/documents/${userId}/passport_${Math.random().toString(36).substr(2, 5)}.pdf`,
    fileSize: 1024000,
    mimeType: 'application/pdf',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  return { ...baseDocument, ...overrides };
}

/**
 * Generate test activity data
 */
export function generateTestActivity(tourEventId: string, overrides: Partial<TestActivity> = {}): TestActivity {
  const baseActivity: TestActivity = {
    activityId: `activity-${Math.random().toString(36).substr(2, 9)}`,
    tourEventId,
    activityTypeId: `type-${Math.random().toString(36).substr(2, 9)}`,
    activityName: `Tour Activity ${Math.random().toString(36).substr(2, 5)}`,
    description: 'An exciting tour activity',
    startTime: new Date('2024-07-01T09:00:00Z'),
    endTime: new Date('2024-07-01T12:00:00Z'),
    location: 'Tourist Destination',
    webLink: 'https://example.com/activity',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  return { ...baseActivity, ...overrides };
}

/**
 * Generate test notification data
 */
export function generateTestNotification(userId: string, overrides: Partial<TestNotification> = {}): TestNotification {
  const baseNotification: TestNotification = {
    notificationId: `notif-${Math.random().toString(36).substr(2, 9)}`,
    userId,
    type: 'tour_update',
    title: 'Tour Update',
    message: 'Your tour has been updated with new information.',
    channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
    priority: NotificationPriority.NORMAL,
    status: 'pending',
    metadata: {
      tourEventId: `event-${Math.random().toString(36).substr(2, 9)}`,
      updateType: 'schedule_change'
    },
    createdAt: new Date(),
    updatedAt: new Date()
  };

  return { ...baseNotification, ...overrides };
}

/**
 * Generate test registration data
 */
export function generateTestRegistration(userId: string, tourEventId: string, overrides: any = {}) {
  return {
    registrationId: `reg-${Math.random().toString(36).substr(2, 9)}`,
    userId,
    tourEventId,
    status: RegistrationStatus.PENDING,
    registrationDate: new Date(),
    approvalDate: null,
    rejectionReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

/**
 * Generate multiple test users
 */
export function generateTestUsers(count: number, overrides: Partial<TestUser> = {}): TestUser[] {
  return Array.from({ length: count }, (_, index) => 
    generateTestUser({
      firstName: `User${index + 1}`,
      emailAddress: `user${index + 1}@example.com`,
      ...overrides
    })
  );
}

/**
 * Generate multiple test providers
 */
export function generateTestProviders(count: number, overrides: Partial<TestProvider> = {}): TestProvider[] {
  return Array.from({ length: count }, (_, index) => 
    generateTestProvider({
      companyName: `Company ${index + 1}`,
      emailAddress: `contact@company${index + 1}.com`,
      ...overrides
    })
  );
}

/**
 * Generate multiple test tour events
 */
export function generateTestTourEvents(count: number, providerId: string, overrides: Partial<TestCustomTourEvent> = {}): TestCustomTourEvent[] {
  return Array.from({ length: count }, (_, index) => 
    generateTestCustomTourEvent(providerId, {
      customTourName: `Tour Event ${index + 1}`,
      ...overrides
    })
  );
}

/**
 * Generate test data for a complete scenario (provider with users and events)
 */
export function generateTestScenario() {
  const provider = generateTestProvider();
  const systemAdmin = generateTestSystemAdmin();
  const providerAdmin = generateTestProviderAdmin(provider.providerId);
  const tourists = generateTestUsers(3, { 
    userType: UserType.TOURIST, 
    providerId: provider.providerId 
  });
  const tourTemplate = generateTestTourTemplate();
  const tourEvents = generateTestTourEvents(2, provider.providerId, {
    templateId: tourTemplate.templateId
  });
  const documents = tourists.map(tourist => 
    generateTestDocument(tourist.userId)
  );

  return {
    provider,
    systemAdmin,
    providerAdmin,
    tourists,
    tourTemplate,
    tourEvents,
    documents
  };
}

/**
 * Create mock Prisma client with test data
 */
export function createMockPrismaClient(testData: any = {}) {
  return {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn()
    },
    provider: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn()
    },
    tourTemplate: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn()
    },
    customTourEvent: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn()
    },
    document: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn()
    },
    activity: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn()
    },
    touristRegistration: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn()
    },
    refreshToken: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn()
    },
    healthCheck: {
      create: vi.fn(),
      delete: vi.fn()
    },
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
    ...testData
  };
}

// Import vi for the mock function
import { vi } from 'vitest';