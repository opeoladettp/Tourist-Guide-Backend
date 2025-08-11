import DatabaseService from '../services/database';

/**
 * Simple utility to test database connection
 * This can be run independently to verify database setup
 */
async function testDatabaseConnection() {
  console.log('🔍 Testing database connection...');
  
  try {
    const dbService = DatabaseService.getInstance();
    
    // Test connection
    await dbService.connect();
    console.log('✅ Database connection established');
    
    // Test health check
    const healthCheck = await dbService.healthCheck();
    console.log('🏥 Health check result:', healthCheck);
    
    // Test basic query
    const testConnection = await dbService.testConnection();
    console.log('🔗 Connection test result:', testConnection);
    
    // Disconnect
    await dbService.disconnect();
    console.log('✅ Database disconnected successfully');
    
    return true;
  } catch (error) {
    console.error('❌ Database connection test failed:', error);
    return false;
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testDatabaseConnection()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

export default testDatabaseConnection;