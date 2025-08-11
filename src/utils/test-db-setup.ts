import { PrismaClient } from '../generated/prisma';
import { config } from '../config';
import DatabaseService from '../services/database';

/**
 * Set up test database connection
 */
export async function setupTestDatabase(): Promise<PrismaClient> {
  const dbService = DatabaseService.getInstance();
  const prisma = dbService.getClient();
  
  // Clean up any existing test data
  await cleanupTestDatabase(prisma);
  
  return prisma;
}

/**
 * Clean up test database
 */
export async function cleanupTestDatabase(prisma: PrismaClient): Promise<void> {
  try {
    // Delete in reverse order of dependencies
    await prisma.refreshToken.deleteMany({});
    await prisma.document.deleteMany({});
    await prisma.activity.deleteMany({});
    await prisma.customTourEvent.deleteMany({});
    await prisma.tourTemplate.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.provider.deleteMany({});
  } catch (error) {
    console.warn('Warning during test cleanup:', error);
  }
}

/**
 * Test database setup without requiring actual database connection
 * This verifies that the configuration and service are properly set up
 */
async function testDatabaseSetup() {
  console.log('🔍 Testing database setup...');
  
  try {
    // Test configuration loading
    console.log('📋 Database configuration:');
    console.log(`  - URL: ${config.database.url ? '✅ Set' : '❌ Not set'}`);
    console.log(`  - Host: ${config.database.host}`);
    console.log(`  - Port: ${config.database.port}`);
    console.log(`  - Database: ${config.database.name}`);
    console.log(`  - User: ${config.database.user ? '✅ Set' : '❌ Not set'}`);
    
    // Test service instantiation
    const dbService = DatabaseService.getInstance();
    console.log('✅ Database service instantiated successfully');
    
    // Test singleton pattern
    const dbService2 = DatabaseService.getInstance();
    const isSingleton = dbService === dbService2;
    console.log(`🔄 Singleton pattern: ${isSingleton ? '✅ Working' : '❌ Failed'}`);
    
    // Test client access
    const client = dbService.getClient();
    console.log(`🔗 Prisma client: ${client ? '✅ Available' : '❌ Not available'}`);
    
    console.log('✅ Database setup test completed successfully');
    console.log('');
    console.log('📝 Next steps:');
    console.log('  1. Set up PostgreSQL database');
    console.log('  2. Update DATABASE_URL in .env file');
    console.log('  3. Run: npm run db:migrate');
    console.log('  4. Test connection: npx ts-node src/utils/test-db-connection.ts');
    
    return true;
  } catch (error) {
    console.error('❌ Database setup test failed:', error);
    return false;
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testDatabaseSetup()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

export default testDatabaseSetup;