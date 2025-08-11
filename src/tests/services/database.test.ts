import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import DatabaseService from '../../services/database';
import { PrismaClient } from '../../generated/prisma';

// Mock the PrismaClient
vi.mock('../../generated/prisma', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
    healthCheck: {
      create: vi.fn(),
      delete: vi.fn()
    }
  }))
}));

// Mock the config
vi.mock('../../config', () => ({
  config: {
    database: {
      url: 'postgresql://test:test@localhost:5432/test'
    },
    nodeEnv: 'test'
  }
}));

describe('DatabaseService', () => {
  let databaseService: DatabaseService;
  let mockPrisma: any;

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
    
    // Get a fresh instance
    databaseService = DatabaseService.getInstance();
    mockPrisma = databaseService.getClient();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = DatabaseService.getInstance();
      const instance2 = DatabaseService.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('getClient', () => {
    it('should return Prisma client instance', () => {
      const client = databaseService.getClient();
      
      expect(client).toBeDefined();
      expect(client).toBeTruthy();
    });
  });

  describe('connect', () => {
    it('should connect to database successfully', async () => {
      mockPrisma.$connect.mockResolvedValue(undefined);
      
      await expect(databaseService.connect()).resolves.toBeUndefined();
      expect(mockPrisma.$connect).toHaveBeenCalledOnce();
    });

    it('should throw error when connection fails', async () => {
      const connectionError = new Error('Connection failed');
      mockPrisma.$connect.mockRejectedValue(connectionError);
      
      await expect(databaseService.connect()).rejects.toThrow('Database connection failed: Connection failed');
      expect(mockPrisma.$connect).toHaveBeenCalledOnce();
    });

    it('should handle unknown error types', async () => {
      mockPrisma.$connect.mockRejectedValue('Unknown error');
      
      await expect(databaseService.connect()).rejects.toThrow('Database connection failed: Unknown error');
    });
  });

  describe('disconnect', () => {
    it('should disconnect from database successfully', async () => {
      mockPrisma.$disconnect.mockResolvedValue(undefined);
      
      await expect(databaseService.disconnect()).resolves.toBeUndefined();
      expect(mockPrisma.$disconnect).toHaveBeenCalledOnce();
    });

    it('should throw error when disconnection fails', async () => {
      const disconnectionError = new Error('Disconnection failed');
      mockPrisma.$disconnect.mockRejectedValue(disconnectionError);
      
      await expect(databaseService.disconnect()).rejects.toThrow('Database disconnection failed: Disconnection failed');
      expect(mockPrisma.$disconnect).toHaveBeenCalledOnce();
    });

    it('should handle unknown error types', async () => {
      mockPrisma.$disconnect.mockRejectedValue('Unknown error');
      
      await expect(databaseService.disconnect()).rejects.toThrow('Database disconnection failed: Unknown error');
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when database is accessible', async () => {
      const mockHealthRecord = { id: 'health-123' };
      
      mockPrisma.$queryRaw.mockResolvedValue([{ test: 1 }]);
      mockPrisma.healthCheck.create.mockResolvedValue(mockHealthRecord);
      mockPrisma.healthCheck.delete.mockResolvedValue(mockHealthRecord);
      
      const result = await databaseService.healthCheck();
      
      expect(result.status).toBe('healthy');
      expect(result.message).toBe('Database connection and operations are healthy');
      expect(result.timestamp).toBeDefined();
      expect(result.details).toBeUndefined();
      
      expect(mockPrisma.$queryRaw).toHaveBeenCalledWith(['SELECT 1 as test']);
      expect(mockPrisma.healthCheck.create).toHaveBeenCalledWith({
        data: { status: 'healthy' }
      });
      expect(mockPrisma.healthCheck.delete).toHaveBeenCalledWith({
        where: { id: mockHealthRecord.id }
      });
    });

    it('should return unhealthy status when database query fails', async () => {
      const queryError = new Error('Query failed');
      mockPrisma.$queryRaw.mockRejectedValue(queryError);
      
      const result = await databaseService.healthCheck();
      
      expect(result.status).toBe('unhealthy');
      expect(result.message).toBe('Database connection is unhealthy');
      expect(result.timestamp).toBeDefined();
      expect(result.details).toBe('Query failed');
      
      expect(mockPrisma.$queryRaw).toHaveBeenCalledWith(['SELECT 1 as test']);
      expect(mockPrisma.healthCheck.create).not.toHaveBeenCalled();
    });

    it('should return unhealthy status when health record creation fails', async () => {
      const createError = new Error('Create failed');
      
      mockPrisma.$queryRaw.mockResolvedValue([{ test: 1 }]);
      mockPrisma.healthCheck.create.mockRejectedValue(createError);
      
      const result = await databaseService.healthCheck();
      
      expect(result.status).toBe('unhealthy');
      expect(result.message).toBe('Database connection is unhealthy');
      expect(result.details).toBe('Create failed');
    });

    it('should return unhealthy status when health record deletion fails', async () => {
      const mockHealthRecord = { id: 'health-123' };
      const deleteError = new Error('Delete failed');
      
      mockPrisma.$queryRaw.mockResolvedValue([{ test: 1 }]);
      mockPrisma.healthCheck.create.mockResolvedValue(mockHealthRecord);
      mockPrisma.healthCheck.delete.mockRejectedValue(deleteError);
      
      const result = await databaseService.healthCheck();
      
      expect(result.status).toBe('unhealthy');
      expect(result.message).toBe('Database connection is unhealthy');
      expect(result.details).toBe('Delete failed');
    });

    it('should handle unknown error types', async () => {
      mockPrisma.$queryRaw.mockRejectedValue('Unknown error');
      
      const result = await databaseService.healthCheck();
      
      expect(result.status).toBe('unhealthy');
      expect(result.details).toBe('Unknown error');
    });
  });

  describe('isHealthy', () => {
    it('should return connection status', () => {
      // Initially false since we haven't called connect
      expect(databaseService.isHealthy()).toBe(false);
    });
  });

  describe('executeTransaction', () => {
    it('should execute transaction successfully', async () => {
      const mockCallback = vi.fn().mockResolvedValue('transaction result');
      const mockTransactionPrisma = { mock: 'transaction prisma' };
      
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return await callback(mockTransactionPrisma);
      });
      
      const result = await databaseService.executeTransaction(mockCallback);
      
      expect(result).toBe('transaction result');
      expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
      expect(mockCallback).toHaveBeenCalledWith(mockTransactionPrisma);
    });

    it('should throw error when transaction fails', async () => {
      const mockCallback = vi.fn();
      const transactionError = new Error('Transaction failed');
      
      mockPrisma.$transaction.mockRejectedValue(transactionError);
      
      await expect(databaseService.executeTransaction(mockCallback)).rejects.toThrow('Transaction failed: Transaction failed');
      expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
    });

    it('should handle unknown error types in transaction', async () => {
      const mockCallback = vi.fn();
      
      mockPrisma.$transaction.mockRejectedValue('Unknown transaction error');
      
      await expect(databaseService.executeTransaction(mockCallback)).rejects.toThrow('Transaction failed: Unknown error');
    });
  });

  describe('testConnection', () => {
    it('should return true when connection test succeeds', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ test: 1 }]);
      
      const result = await databaseService.testConnection();
      
      expect(result).toBe(true);
      expect(mockPrisma.$queryRaw).toHaveBeenCalledWith(['SELECT 1 as test']);
    });

    it('should return false when connection test fails', async () => {
      const queryError = new Error('Connection test failed');
      mockPrisma.$queryRaw.mockRejectedValue(queryError);
      
      const result = await databaseService.testConnection();
      
      expect(result).toBe(false);
      expect(mockPrisma.$queryRaw).toHaveBeenCalledWith(['SELECT 1 as test']);
    });
  });

  describe('process event handlers', () => {
    it('should set up process event handlers', () => {
      // This test verifies that the event handlers are set up
      // We can't easily test the actual handlers without affecting the process
      expect(process.listenerCount('beforeExit')).toBeGreaterThan(0);
      expect(process.listenerCount('SIGINT')).toBeGreaterThan(0);
      expect(process.listenerCount('SIGTERM')).toBeGreaterThan(0);
    });
  });
});