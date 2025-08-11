import app from './app';
import DatabaseService from './services/database';
import { SystemMetricsService } from './services/system-metrics';
import { MonitoringService } from './utils/monitoring';

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Initialize database connection
    const dbService = DatabaseService.getInstance();
    
    try {
      await dbService.connect();
      console.log('✅ Database connected successfully');
    } catch (error) {
      console.warn('⚠️  Database connection failed, server will start without database:', error instanceof Error ? error.message : 'Unknown error');
      console.warn('📝 Database health checks will show unhealthy status');
    }
    
    const server = app.listen(PORT, () => {
      console.log(`🚀 Tourist Hub API server is running on port ${PORT}`);
      console.log(`📍 Health check: http://localhost:${PORT}/health`);
      console.log(`📍 Database health: http://localhost:${PORT}/health/db`);
      console.log(`📍 Full health check: http://localhost:${PORT}/health/full`);
      console.log(`📍 System metrics: http://localhost:${PORT}/health/metrics/system`);
      console.log(`📍 API base: http://localhost:${PORT}/api`);
      
      // Start system metrics collection
      const systemMetrics = SystemMetricsService.getInstance();
      systemMetrics.startCollection(60000); // Collect every minute
      console.log('📊 System metrics collection started');
      
      // Start monitoring service metrics logging
      const metricsLoggingInterval = MonitoringService.startMetricsLogging(300000); // Log every 5 minutes
      console.log('📈 Performance metrics logging started');
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      console.log(`${signal} received, shutting down gracefully`);
      
      server.close(async () => {
        try {
          // Stop metrics collection
          const systemMetrics = SystemMetricsService.getInstance();
          systemMetrics.stopCollection();
          console.log('📊 System metrics collection stopped');
          
          if (dbService.isHealthy()) {
            await dbService.disconnect();
          }
          console.log('Process terminated');
          process.exit(0);
        } catch (error) {
          console.error('Error during shutdown:', error);
          process.exit(1);
        }
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    return server;
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

export default startServer;