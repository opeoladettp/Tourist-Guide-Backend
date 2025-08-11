/**
 * Tourist Hub API - System Admin Workflow Examples
 * 
 * This example demonstrates common workflows for System Admin users,
 * including user management, provider management, and tour template management.
 */

const TouristHubClient = require('./basic-client');

class SystemAdminWorkflow {
  constructor(baseURL) {
    this.client = new TouristHubClient(baseURL);
  }
  
  /**
   * Create a new provider company
   */
  async createProvider(providerData) {
    try {
      console.log('🏢 Creating new provider...');
      
      const provider = await this.client.post('/api/providers', providerData);
      
      console.log('✅ Provider created successfully!');
      console.log(`🏢 Company: ${provider.companyName}`);
      console.log(`🌍 Location: ${provider.city}, ${provider.country}`);
      console.log(`📧 Email: ${provider.emailAddress}`);
      console.log(`🆔 Provider ID: ${provider.providerId}`);
      
      return provider;
    } catch (error) {
      console.error('❌ Failed to create provider:', error.message);
      throw error;
    }
  }
  
  /**
   * View all providers in the system
   */
  async viewAllProviders() {
    try {
      console.log('🏢 Viewing all providers...');
      
      const providers = await this.client.get('/api/providers');
      
      console.log(`📋 Found ${providers.length} providers:`);
      providers.forEach(provider => {
        console.log(`  • ${provider.companyName}`);
        console.log(`    🌍 ${provider.city}, ${provider.country}`);
        console.log(`    📧 ${provider.emailAddress}`);
        console.log(`    📱 ${provider.phoneNumber}`);
        console.log(`    🔒 Isolated: ${provider.isIsolatedInstance ? 'Yes' : 'No'}`);
        console.log(`    🆔 ID: ${provider.providerId}`);
        console.log('');
      });
      
      return providers;
    } catch (error) {
      console.error('❌ Failed to view providers:', error.message);
      throw error;
    }
  }
  
  /**
   * Create a new user (any role)
   */
  async createUser(userData) {
    try {
      console.log(`👤 Creating new ${userData.userType} user...`);
      
      const user = await this.client.post('/api/users', userData);
      
      console.log('✅ User created successfully!');
      console.log(`👤 Name: ${user.firstName} ${user.lastName}`);
      console.log(`📧 Email: ${user.emailAddress}`);
      console.log(`🎭 Role: ${user.userType}`);
      console.log(`🆔 User ID: ${user.userId}`);
      
      if (user.providerId) {
        console.log(`🏢 Provider: ${user.providerId}`);
      }
      
      return user;
    } catch (error) {
      console.error('❌ Failed to create user:', error.message);
      throw error;
    }
  }
  
  /**
   * View all users in the system
   */
  async viewAllUsers(filters = {}) {
    try {
      console.log('👥 Viewing all users...');
      
      const users = await this.client.get('/api/users', filters);
      
      console.log(`📋 Found ${users.length} users:`);
      
      // Group users by role
      const usersByRole = users.reduce((acc, user) => {
        if (!acc[user.userType]) acc[user.userType] = [];
        acc[user.userType].push(user);
        return acc;
      }, {});
      
      Object.keys(usersByRole).forEach(role => {
        console.log(`\n🎭 ${role} (${usersByRole[role].length}):`);
        usersByRole[role].forEach(user => {
          console.log(`  • ${user.firstName} ${user.lastName}`);
          console.log(`    📧 ${user.emailAddress}`);
          console.log(`    📱 ${user.phoneNumber}`);
          console.log(`    📊 Status: ${user.status}`);
          if (user.providerId) {
            console.log(`    🏢 Provider: ${user.providerId}`);
          }
          console.log('');
        });
      });
      
      return users;
    } catch (error) {
      console.error('❌ Failed to view users:', error.message);
      throw error;
    }
  }
  
  /**
   * Create a new tour template
   */
  async createTourTemplate(templateData) {
    try {
      console.log('📋 Creating new tour template...');
      
      const template = await this.client.post('/api/tour-templates', templateData);
      
      console.log('✅ Tour template created successfully!');
      console.log(`📋 Template: ${template.templateName}`);
      console.log(`🎯 Type: ${template.type}`);
      console.log(`📅 Duration: ${template.startDate} to ${template.endDate}`);
      console.log(`📍 Sites: ${template.sitesToVisit?.length || 0} locations`);
      console.log(`🆔 Template ID: ${template.templateId}`);
      
      return template;
    } catch (error) {
      console.error('❌ Failed to create tour template:', error.message);
      throw error;
    }
  }
  
  /**
   * View all tour templates
   */
  async viewAllTourTemplates() {
    try {
      console.log('📋 Viewing all tour templates...');
      
      const templates = await this.client.get('/api/tour-templates');
      
      console.log(`📋 Found ${templates.length} tour templates:`);
      templates.forEach(template => {
        console.log(`  • ${template.templateName} (${template.type})`);
        console.log(`    📅 ${template.startDate} to ${template.endDate}`);
        console.log(`    📍 ${template.sitesToVisit?.length || 0} sites to visit`);
        console.log(`    🆔 ID: ${template.templateId}`);
        console.log('');
      });
      
      return templates;
    } catch (error) {
      console.error('❌ Failed to view tour templates:', error.message);
      throw error;
    }
  }
  
  /**
   * Update tour template
   */
  async updateTourTemplate(templateId, updates) {
    try {
      console.log(`✏️ Updating tour template: ${templateId}`);
      
      const updatedTemplate = await this.client.put(`/api/tour-templates/${templateId}`, updates);
      
      console.log('✅ Tour template updated successfully');
      console.log(`📋 Template: ${updatedTemplate.templateName}`);
      console.log(`🎯 Type: ${updatedTemplate.type}`);
      
      return updatedTemplate;
    } catch (error) {
      console.error('❌ Failed to update tour template:', error.message);
      throw error;
    }
  }
  
  /**
   * Create default activity types
   */
  async createActivityTypes(activityTypes) {
    try {
      console.log('🎯 Creating default activity types...');
      
      const createdTypes = [];
      
      for (const activityType of activityTypes) {
        console.log(`  📝 Creating: ${activityType.name}`);
        
        const created = await this.client.post('/api/activity-types', activityType);
        createdTypes.push(created);
        
        console.log(`    ✅ Created: ${created.name}`);
      }
      
      console.log(`✅ Created ${createdTypes.length} activity types`);
      return createdTypes;
    } catch (error) {
      console.error('❌ Failed to create activity types:', error.message);
      throw error;
    }
  }
  
  /**
   * View system-wide statistics
   */
  async viewSystemStatistics() {
    try {
      console.log('📊 Generating system statistics...');
      
      // Get all data
      const [users, providers, templates, events] = await Promise.all([
        this.client.get('/api/users'),
        this.client.get('/api/providers'),
        this.client.get('/api/tour-templates'),
        this.client.get('/api/tour-events')
      ]);
      
      // Calculate statistics
      const stats = {
        users: {
          total: users.length,
          systemAdmins: users.filter(u => u.userType === 'SystemAdmin').length,
          providerAdmins: users.filter(u => u.userType === 'ProviderAdmin').length,
          tourists: users.filter(u => u.userType === 'Tourist').length,
          active: users.filter(u => u.status === 'Active').length,
          inactive: users.filter(u => u.status === 'Inactive').length
        },
        providers: {
          total: providers.length,
          isolated: providers.filter(p => p.isIsolatedInstance).length
        },
        templates: {
          total: templates.length,
          byType: templates.reduce((acc, t) => {
            acc[t.type] = (acc[t.type] || 0) + 1;
            return acc;
          }, {})
        },
        events: {
          total: events.length,
          byStatus: events.reduce((acc, e) => {
            acc[e.status] = (acc[e.status] || 0) + 1;
            return acc;
          }, {}),
          totalCapacity: events.reduce((sum, e) => sum + e.numberOfAllowedTourists, 0),
          totalRegistrations: events.reduce((sum, e) => sum + (e.numberOfAllowedTourists - e.remainingTourists), 0)
        }
      };
      
      console.log('📊 System Statistics:');
      console.log('\n👥 Users:');
      console.log(`  Total: ${stats.users.total}`);
      console.log(`  System Admins: ${stats.users.systemAdmins}`);
      console.log(`  Provider Admins: ${stats.users.providerAdmins}`);
      console.log(`  Tourists: ${stats.users.tourists}`);
      console.log(`  Active: ${stats.users.active}`);
      console.log(`  Inactive: ${stats.users.inactive}`);
      
      console.log('\n🏢 Providers:');
      console.log(`  Total: ${stats.providers.total}`);
      console.log(`  Isolated Instances: ${stats.providers.isolated}`);
      
      console.log('\n📋 Tour Templates:');
      console.log(`  Total: ${stats.templates.total}`);
      Object.keys(stats.templates.byType).forEach(type => {
        console.log(`  ${type}: ${stats.templates.byType[type]}`);
      });
      
      console.log('\n🎪 Tour Events:');
      console.log(`  Total: ${stats.events.total}`);
      Object.keys(stats.events.byStatus).forEach(status => {
        console.log(`  ${status}: ${stats.events.byStatus[status]}`);
      });
      console.log(`  Total Capacity: ${stats.events.totalCapacity}`);
      console.log(`  Total Registrations: ${stats.events.totalRegistrations}`);
      console.log(`  Overall Occupancy: ${((stats.events.totalRegistrations / stats.events.totalCapacity) * 100).toFixed(1)}%`);
      
      return stats;
    } catch (error) {
      console.error('❌ Failed to generate statistics:', error.message);
      throw error;
    }
  }
  
  /**
   * Manage user status (activate/deactivate)
   */
  async manageUserStatus(userId, status, reason = '') {
    try {
      console.log(`${status === 'Active' ? '✅' : '❌'} ${status === 'Active' ? 'Activating' : 'Deactivating'} user: ${userId}`);
      
      const updatedUser = await this.client.put(`/api/users/${userId}`, {
        status: status
      });
      
      console.log(`✅ User status updated to: ${status}`);
      console.log(`👤 User: ${updatedUser.firstName} ${updatedUser.lastName}`);
      if (reason) {
        console.log(`📝 Reason: ${reason}`);
      }
      
      return updatedUser;
    } catch (error) {
      console.error('❌ Failed to update user status:', error.message);
      throw error;
    }
  }
  
  /**
   * Delete provider (with confirmation)
   */
  async deleteProvider(providerId, confirmation = false) {
    try {
      if (!confirmation) {
        console.log('⚠️ Provider deletion requires confirmation');
        console.log('Call this method with confirmation=true to proceed');
        return false;
      }
      
      console.log(`🗑️ Deleting provider: ${providerId}`);
      
      // First check if provider has active tour events
      const events = await this.client.get('/api/tour-events');
      const providerEvents = events.filter(e => e.providerId === providerId);
      
      if (providerEvents.length > 0) {
        console.log(`⚠️ Provider has ${providerEvents.length} active tour events`);
        console.log('Cannot delete provider with active events');
        return false;
      }
      
      await this.client.delete(`/api/providers/${providerId}`);
      
      console.log('✅ Provider deleted successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to delete provider:', error.message);
      throw error;
    }
  }
  
  /**
   * Bulk user operations
   */
  async bulkUserOperation(userIds, operation, data = {}) {
    try {
      console.log(`🔄 Performing bulk ${operation} on ${userIds.length} users...`);
      
      const results = [];
      
      for (const userId of userIds) {
        try {
          let result;
          
          switch (operation) {
            case 'activate':
              result = await this.manageUserStatus(userId, 'Active', data.reason);
              break;
            case 'deactivate':
              result = await this.manageUserStatus(userId, 'Inactive', data.reason);
              break;
            case 'update':
              result = await this.client.put(`/api/users/${userId}`, data);
              break;
            default:
              throw new Error(`Unknown operation: ${operation}`);
          }
          
          results.push({ userId, success: true, result });
        } catch (error) {
          results.push({ userId, success: false, error: error.message });
        }
      }
      
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      console.log(`✅ Bulk operation completed: ${successful} successful, ${failed} failed`);
      
      return results;
    } catch (error) {
      console.error('❌ Bulk operation failed:', error.message);
      throw error;
    }
  }
}

// Example usage
async function systemAdminExample() {
  const workflow = new SystemAdminWorkflow();
  
  try {
    console.log('=== System Admin Workflow Example ===\n');
    
    // Login as system admin
    await workflow.client.login('admin@touristhub.com', 'admin123');
    
    // View system statistics
    await workflow.viewSystemStatistics();
    
    // View all providers
    await workflow.viewAllProviders();
    
    // View all users
    await workflow.viewAllUsers();
    
    // View all tour templates
    await workflow.viewAllTourTemplates();
    
    // Create sample provider
    const sampleProvider = {
      companyName: 'Premium Tours Ltd',
      country: 'Saudi Arabia',
      addressLine1: '123 King Fahd Road',
      city: 'Riyadh',
      stateRegion: 'Riyadh Province',
      companyDescription: 'Premium tour services for religious and cultural tours',
      phoneNumber: '+966-11-123-4567',
      emailAddress: 'info@premiumtours.sa',
      corpIdTaxId: 'CR-12345678',
      isIsolatedInstance: true
    };
    
    // Uncomment to create provider
    // const newProvider = await workflow.createProvider(sampleProvider);
    
    // Create sample activity types
    const sampleActivityTypes = [
      {
        name: 'Religious',
        description: 'Religious activities and ceremonies',
        defaultDuration: 120
      },
      {
        name: 'Transportation',
        description: 'Travel and transportation activities',
        defaultDuration: 60
      },
      {
        name: 'Accommodation',
        description: 'Hotel check-in/out and accommodation',
        defaultDuration: 30
      }
    ];
    
    // Uncomment to create activity types
    // await workflow.createActivityTypes(sampleActivityTypes);
    
    // Logout
    await workflow.client.logout();
    
  } catch (error) {
    console.error('System admin workflow example failed:', error.message);
  }
}

module.exports = SystemAdminWorkflow;

// Run example if this file is executed directly
if (require.main === module) {
  systemAdminExample();
}