import { PrismaClient } from '../generated/prisma';
import { config } from '../config';

class DatabaseService {
  private static instance: DatabaseService;
  private prisma: PrismaClient;
  private isConnected: boolean = false;

  private constructor() {
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: config.database.url
        }
      },
      log: config.nodeEnv === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
      errorFormat: 'pretty'
    });

    // Handle graceful shutdown
    process.on('beforeExit', async () => {
      await this.disconnect();
    });

    process.on('SIGINT', async () => {
      await this.disconnect();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await this.disconnect();
      process.exit(0);
    });
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  public getClient(): PrismaClient {
    return this.prisma;
  }

  public async connect(): Promise<void> {
    try {
      await this.prisma.$connect();
      this.isConnected = true;
      console.log('✅ Database connected successfully');
    } catch (error) {
      this.isConnected = false;
      console.error('❌ Database connection failed:', error);
      throw new Error(`Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async disconnect(): Promise<void> {
    try {
      await this.prisma.$disconnect();
      this.isConnected = false;
      console.log('✅ Database disconnected successfully');
    } catch (error) {
      console.error('❌ Database disconnection failed:', error);
      throw new Error(`Database disconnection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    message: string;
    timestamp: string;
    responseTime: number;
    details?: any;
  }> {
    const startTime = Date.now();
    
    try {
      // Test database connection with a simple query
      await this.prisma.$queryRaw`SELECT 1 as test`;
      
      // Test table access by creating a health check record
      const healthRecord = await this.prisma.healthCheck.create({
        data: {
          status: 'healthy'
        }
      });
      
      // Clean up the test record
      await this.prisma.healthCheck.delete({
        where: {
          id: healthRecord.id
        }
      });
      
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'healthy',
        message: 'Database connection and operations are healthy',
        timestamp: new Date().toISOString(),
        responseTime
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error('Database health check failed:', error);
      
      return {
        status: 'unhealthy',
        message: 'Database connection is unhealthy',
        timestamp: new Date().toISOString(),
        responseTime,
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  public async getConnectionMetrics(): Promise<{
    isConnected: boolean;
    connectionCount?: number;
    activeQueries?: number;
    averageQueryTime?: number;
  }> {
    try {
      // Basic connection status
      const metrics = {
        isConnected: this.isConnected,
        connectionCount: undefined as number | undefined,
        activeQueries: undefined as number | undefined,
        averageQueryTime: undefined as number | undefined
      };

      // Try to get more detailed metrics if available
      if (this.isConnected) {
        // Test a simple query to verify connection
        const startTime = Date.now();
        await this.prisma.$queryRaw`SELECT 1`;
        metrics.averageQueryTime = Date.now() - startTime;
      }

      return metrics;
    } catch (error) {
      console.error('Failed to get connection metrics:', error);
      return {
        isConnected: false
      };
    }
  }

  public isHealthy(): boolean {
    return this.isConnected;
  }

  public async executeTransaction<T>(
    callback: (prisma: PrismaClient) => Promise<T>
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(async (prisma) => {
        return await callback(prisma as PrismaClient);
      });
    } catch (error) {
      console.error('Transaction failed:', error);
      throw new Error(`Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async testConnection(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1 as test`;
      return true;
    } catch (error) {
      console.error('Database connection test failed:', error);
      return false;
    }
  }
}

export default DatabaseService;