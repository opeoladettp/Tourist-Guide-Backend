import { PrismaClient } from '../generated/prisma';
import DatabaseService from '../services/database';

/**
 * Get the Prisma client instance
 */
export function getPrismaClient(): PrismaClient {
  return DatabaseService.getInstance().getClient();
}

/**
 * Execute a database transaction
 */
export async function executeTransaction<T>(
  callback: (prisma: PrismaClient) => Promise<T>
): Promise<T> {
  const dbService = DatabaseService.getInstance();
  return await dbService.executeTransaction(callback);
}

/**
 * Test database connection
 */
export async function testDatabaseConnection(): Promise<boolean> {
  const dbService = DatabaseService.getInstance();
  return await dbService.testConnection();
}

/**
 * Get database health status
 */
export async function getDatabaseHealth() {
  const dbService = DatabaseService.getInstance();
  return await dbService.healthCheck();
}

/**
 * Check if database is healthy
 */
export function isDatabaseHealthy(): boolean {
  const dbService = DatabaseService.getInstance();
  return dbService.isHealthy();
}

/**
 * Database error handler utility
 */
export function handleDatabaseError(error: any): {
  code: string;
  message: string;
  details?: any;
} {
  // Handle Prisma-specific errors
  if (error.code) {
    switch (error.code) {
      case 'P2002':
        return {
          code: 'UNIQUE_CONSTRAINT_VIOLATION',
          message: 'A record with this data already exists',
          details: error.meta
        };
      case 'P2025':
        return {
          code: 'RECORD_NOT_FOUND',
          message: 'The requested record was not found',
          details: error.meta
        };
      case 'P2003':
        return {
          code: 'FOREIGN_KEY_CONSTRAINT_VIOLATION',
          message: 'Foreign key constraint failed',
          details: error.meta
        };
      case 'P2014':
        return {
          code: 'INVALID_ID',
          message: 'The provided ID is invalid',
          details: error.meta
        };
      default:
        return {
          code: 'DATABASE_ERROR',
          message: error.message || 'A database error occurred',
          details: error.meta
        };
    }
  }

  // Handle general database connection errors
  if (error.message?.includes('connect')) {
    return {
      code: 'DATABASE_CONNECTION_ERROR',
      message: 'Unable to connect to the database',
      details: error.message
    };
  }

  // Default error handling
  return {
    code: 'DATABASE_ERROR',
    message: error.message || 'An unexpected database error occurred',
    details: error
  };
}