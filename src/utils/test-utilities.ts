import { PrismaClient } from '../generated/prisma';
import { vi } from 'vitest';
import { 
  generateTestUser, 
  generateTestProvider, 
  generateTestTourTemplate,
  generateTestCustomTourEvent,
  generateTestDocument,
  generateTestActivity,
  createMockPrismaClient,
  TestUser,
  TestProvider,
  TestTourTemplate,
  TestCustomTourEvent
} from './test-data-generators';

/**
 * Test utilities for setting up and managing test environments
 */

/**
 * Mock console methods to reduce test output noise
 */
export function mockConsole() {
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info
  };

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  return originalConsole;
}

/**
 * Create a mock Prisma client with common test data setup
 */
export function setupMockPrismaClient(customMocks: any = {}) {
  const mockPrisma = createMockPrismaClient(customMocks);
  
  // Setup default successful responses
  mockPrisma.user.create.mockImplementation((data) => Promise.resolve({
    userId: 'mock-user-id',
    ...data.data,
    createdAt: new Date(),
    updatedAt: new Date()
  }));

  mockPrisma.provider.create.mockImplementation((data) => Promise.resolve({
    providerId: 'mock-provider-id',
    ...data.data,
    createdAt: new Date(),
    updatedAt: new Date()
  }));

  mockPrisma.tourTemplate.create.mockImplementation((data) => Promise.resolve({
    templateId: 'mock-template-id',
    ...data.data,
    createdAt: new Date(),
    updatedAt: new Date()
  }));

  mockPrisma.customTourEvent.create.mockImplementation((data) => Promise.resolve({
    tourEventId: 'mock-event-id',
    ...data.data,
    createdAt: new Date(),
    updatedAt: new Date()
  }));

  mockPrisma.document.create.mockImplementation((data) => Promise.resolve({
    documentId: 'mock-document-id',
    ...data.data,
    createdAt: new Date(),
    updatedAt: new Date()
  }));

  mockPrisma.activity.create.mockImplementation((data) => Promise.resolve({
    activityId: 'mock-activity-id',
    ...data.data,
    createdAt: new Date(),
    updatedAt: new Date()
  }));

  return mockPrisma;
}

/**
 * Setup test environment with common test data
 */
export function setupTestEnvironment() {
  const testProvider = generateTestProvider();
  const testSystemAdmin = generateTestUser({ userType: 'SystemAdmin' as any });
  const testProviderAdmin = generateTestUser({ 
    userType: 'ProviderAdmin' as any, 
    providerId: testProvider.providerId 
  });
  const testTourist = generateTestUser({ 
    userType: 'Tourist' as any, 
    providerId: testProvider.providerId 
  });
  const testTourTemplate = generateTestTourTemplate();
  const testTourEvent = generateTestCustomTourEvent(testProvider.providerId, {
    templateId: testTourTemplate.templateId
  });

  return {
    testProvider,
    testSystemAdmin,
    testProviderAdmin,
    testTourist,
    testTourTemplate,
    testTourEvent
  };
}

/**
 * Create test JWT tokens for different user types
 */
export function createTestTokens(config: any) {
  const jwt = require('jsonwebtoken');
  
  const createToken = (user: TestUser) => {
    return jwt.sign(
      {
        sub: user.userId,
        email: user.emailAddress,
        role: user.userType,
        providerId: user.providerId
      },
      config.jwt.secret,
      { expiresIn: '1h' }
    );
  };

  return { createToken };
}

/**
 * Setup test database with clean state
 */
export async function setupTestDatabase(prisma: PrismaClient) {
  try {
    // Clean up in reverse dependency order
    await prisma.refreshToken.deleteMany({});
    await prisma.document.deleteMany({});
    await prisma.activity.deleteMany({});
    await prisma.touristRegistration.deleteMany({});
    await prisma.customTourEvent.deleteMany({});
    await prisma.tourTemplate.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.provider.deleteMany({});
    await prisma.activityType.deleteMany({});
    await prisma.healthCheck.deleteMany({});
  } catch (error) {
    console.warn('Warning during test database cleanup:', error);
  }
}

/**
 * Teardown test database
 */
export async function teardownTestDatabase(prisma: PrismaClient) {
  try {
    await setupTestDatabase(prisma); // Same cleanup process
    await prisma.$disconnect();
  } catch (error) {
    console.warn('Warning during test database teardown:', error);
  }
}

/**
 * Create test data in database
 */
export async function createTestData(prisma: PrismaClient) {
  const testData = setupTestEnvironment();
  
  // Create provider first
  const provider = await prisma.provider.create({
    data: {
      providerId: testData.testProvider.providerId,
      companyName: testData.testProvider.companyName,
      country: testData.testProvider.country,
      addressLine1: testData.testProvider.addressLine1,
      city: testData.testProvider.city,
      stateRegion: testData.testProvider.stateRegion,
      companyDescription: testData.testProvider.companyDescription,
      phoneNumber: testData.testProvider.phoneNumber,
      emailAddress: testData.testProvider.emailAddress,
      corpIdTaxId: testData.testProvider.corpIdTaxId,
      isIsolatedInstance: testData.testProvider.isIsolatedInstance
    }
  });

  // Create users
  const systemAdmin = await prisma.user.create({
    data: {
      userId: testData.testSystemAdmin.userId,
      firstName: testData.testSystemAdmin.firstName,
      lastName: testData.testSystemAdmin.lastName,
      emailAddress: testData.testSystemAdmin.emailAddress,
      phoneNumber: testData.testSystemAdmin.phoneNumber,
      country: testData.testSystemAdmin.country,
      passwordHash: testData.testSystemAdmin.passwordHash,
      userType: testData.testSystemAdmin.userType,
      status: testData.testSystemAdmin.status
    }
  });

  const providerAdmin = await prisma.user.create({
    data: {
      userId: testData.testProviderAdmin.userId,
      firstName: testData.testProviderAdmin.firstName,
      lastName: testData.testProviderAdmin.lastName,
      emailAddress: testData.testProviderAdmin.emailAddress,
      phoneNumber: testData.testProviderAdmin.phoneNumber,
      country: testData.testProviderAdmin.country,
      passwordHash: testData.testProviderAdmin.passwordHash,
      userType: testData.testProviderAdmin.userType,
      status: testData.testProviderAdmin.status,
      providerId: provider.providerId
    }
  });

  const tourist = await prisma.user.create({
    data: {
      userId: testData.testTourist.userId,
      firstName: testData.testTourist.firstName,
      lastName: testData.testTourist.lastName,
      emailAddress: testData.testTourist.emailAddress,
      phoneNumber: testData.testTourist.phoneNumber,
      country: testData.testTourist.country,
      passwordHash: testData.testTourist.passwordHash,
      userType: testData.testTourist.userType,
      status: testData.testTourist.status,
      providerId: provider.providerId,
      passportNumber: testData.testTourist.passportNumber,
      dateOfBirth: testData.testTourist.dateOfBirth,
      gender: testData.testTourist.gender
    }
  });

  // Create tour template
  const tourTemplate = await prisma.tourTemplate.create({
    data: {
      templateId: testData.testTourTemplate.templateId,
      templateName: testData.testTourTemplate.templateName,
      type: testData.testTourTemplate.type,
      year: testData.testTourTemplate.year,
      startDate: testData.testTourTemplate.startDate,
      endDate: testData.testTourTemplate.endDate,
      detailedDescription: testData.testTourTemplate.detailedDescription,
      sitesToVisit: testData.testTourTemplate.sitesToVisit
    }
  });

  // Create tour event
  const tourEvent = await prisma.customTourEvent.create({
    data: {
      tourEventId: testData.testTourEvent.tourEventId,
      providerId: provider.providerId,
      templateId: tourTemplate.templateId,
      customTourName: testData.testTourEvent.customTourName,
      startDate: testData.testTourEvent.startDate,
      endDate: testData.testTourEvent.endDate,
      packageType: testData.testTourEvent.packageType,
      place1Hotel: testData.testTourEvent.place1Hotel,
      place2Hotel: testData.testTourEvent.place2Hotel,
      numberOfAllowedTourists: testData.testTourEvent.numberOfAllowedTourists,
      remainingTourists: testData.testTourEvent.remainingTourists,
      groupChatInfo: testData.testTourEvent.groupChatInfo,
      status: testData.testTourEvent.status
    }
  });

  return {
    provider,
    systemAdmin,
    providerAdmin,
    tourist,
    tourTemplate,
    tourEvent
  };
}

/**
 * Assert error message contains expected text
 */
export function expectErrorMessage(error: any, expectedMessage: string) {
  expect(error).toBeInstanceOf(Error);
  expect(error.message).toContain(expectedMessage);
}

/**
 * Assert validation error with specific field
 */
export function expectValidationError(error: any, field: string) {
  expect(error).toBeInstanceOf(Error);
  expect(error.message).toContain('Validation error');
  expect(error.message).toContain(field);
}

/**
 * Create mock request object for testing middleware
 */
export function createMockRequest(overrides: any = {}) {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    user: null,
    ...overrides
  };
}

/**
 * Create mock response object for testing middleware
 */
export function createMockResponse() {
  const res: any = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    cookie: vi.fn().mockReturnThis(),
    clearCookie: vi.fn().mockReturnThis()
  };
  return res;
}

/**
 * Create mock next function for testing middleware
 */
export function createMockNext() {
  return vi.fn();
}

/**
 * Wait for async operations to complete
 */
export function waitForAsync(ms: number = 0) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Test helper for checking if a function throws an error
 */
export async function expectToThrow(fn: () => Promise<any>, expectedError?: string) {
  try {
    await fn();
    throw new Error('Expected function to throw an error');
  } catch (error) {
    if (expectedError) {
      expect(error.message).toContain(expectedError);
    }
    return error;
  }
}

/**
 * Test helper for checking if a function resolves successfully
 */
export async function expectToResolve(fn: () => Promise<any>) {
  try {
    const result = await fn();
    return result;
  } catch (error) {
    throw new Error(`Expected function to resolve but it threw: ${error.message}`);
  }
}

/**
 * Mock file upload for testing document endpoints
 */
export function createMockFile(overrides: any = {}) {
  return {
    fieldname: 'file',
    originalname: 'test-document.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    buffer: Buffer.from('mock file content'),
    size: 1024,
    ...overrides
  };
}

/**
 * Mock multer file upload middleware
 */
export function mockMulterUpload() {
  return {
    single: vi.fn().mockImplementation((fieldName) => {
      return (req: any, res: any, next: any) => {
        req.file = createMockFile();
        next();
      };
    }),
    array: vi.fn().mockImplementation((fieldName) => {
      return (req: any, res: any, next: any) => {
        req.files = [createMockFile()];
        next();
      };
    })
  };
}

// Import necessary modules
import { beforeEach, afterEach, expect } from 'vitest';