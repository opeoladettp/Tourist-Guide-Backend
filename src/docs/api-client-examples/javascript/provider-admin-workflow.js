/**
 * Tourist Hub API - Provider Admin Workflow Examples
 * 
 * This example demonstrates common workflows for Provider Admin users,
 * including tour event management, tourist registration handling, and schedule management.
 */

const TouristHubClient = require('./basic-client');

class ProviderAdminWorkflow {
  constructor(baseURL) {
    this.client = new TouristHubClient(baseURL);
  }
  
  /**
   * Create a new custom tour event based on a template
   */
  async createTourEvent(tourEventData) {
    try {
      console.log('🎪 Creating new tour event...');
      
      // First, verify the template exists
      const template = await this.client.get(`/api/tour-templates/${tourEventData.templateId}`);
      console.log(`📋 Using template: ${template.templateName}`);
      
      // Create the tour event
      const tourEvent = await this.client.post('/api/tour-events', tourEventData);
      
      console.log('✅ Tour event created successfully!');
      console.log(`🎪 Event: ${tourEvent.customTourName}`);
      console.log(`📅 Dates: ${tourEvent.startDate} to ${tourEvent.endDate}`);
      console.log(`👥 Capacity: ${tourEvent.numberOfAllowedTourists} tourists`);
      console.log(`🏨 Hotels: ${tourEvent.place1Hotel}, ${tourEvent.place2Hotel}`);
      
      return tourEvent;
    } catch (error) {
      console.error('❌ Failed to create tour event:', error.message);
      throw error;
    }
  }
  
  /**
   * View and manage tour events for this provider
   */
  async viewMyTourEvents() {
    try {
      console.log('🎪 Viewing my tour events...');
      
      const events = await this.client.get('/api/tour-events');
      
      console.log(`📋 Found ${events.length} tour events:`);
      events.forEach(event => {
        console.log(`  • ${event.customTourName} (${event.status})`);
        console.log(`    📅 ${event.startDate} to ${event.endDate}`);
        console.log(`    👥 ${event.numberOfAllowedTourists - event.remainingTourists}/${event.numberOfAllowedTourists} registered`);
        console.log(`    🆔 ID: ${event.tourEventId}`);
        console.log('');
      });
      
      return events;
    } catch (error) {
      console.error('❌ Failed to view tour events:', error.message);
      throw error;
    }
  }
  
  /**
   * Update tour event details
   */
  async updateTourEvent(tourEventId, updates) {
    try {
      console.log(`✏️ Updating tour event: ${tourEventId}`);
      
      const updatedEvent = await this.client.put(`/api/tour-events/${tourEventId}`, updates);
      
      console.log('✅ Tour event updated successfully');
      console.log(`🎪 Event: ${updatedEvent.customTourName}`);
      console.log(`📊 Status: ${updatedEvent.status}`);
      
      return updatedEvent;
    } catch (error) {
      console.error('❌ Failed to update tour event:', error.message);
      throw error;
    }
  }
  
  /**
   * View tourist registrations for a tour event
   */
  async viewTourRegistrations(tourEventId) {
    try {
      console.log(`👥 Viewing registrations for tour: ${tourEventId}`);
      
      const registrations = await this.client.get(`/api/tour-events/${tourEventId}/registrations`);
      
      console.log(`📋 Found ${registrations.length} registrations:`);
      registrations.forEach(registration => {
        console.log(`  • ${registration.user.firstName} ${registration.user.lastName}`);
        console.log(`    📧 ${registration.user.emailAddress}`);
        console.log(`    📱 ${registration.user.phoneNumber}`);
        console.log(`    📊 Status: ${registration.status}`);
        console.log(`    📅 Registered: ${new Date(registration.registrationDate).toLocaleDateString()}`);
        console.log('');
      });
      
      return registrations;
    } catch (error) {
      console.error('❌ Failed to view registrations:', error.message);
      throw error;
    }
  }
  
  /**
   * Approve or reject tourist registration
   */
  async handleRegistration(tourEventId, userId, action, notes = '') {
    try {
      console.log(`${action === 'approve' ? '✅' : '❌'} ${action}ing registration for user: ${userId}`);
      
      const result = await this.client.put(`/api/tour-events/${tourEventId}/registrations/${userId}`, {
        status: action === 'approve' ? 'Approved' : 'Rejected',
        notes: notes
      });
      
      console.log(`✅ Registration ${action}ed successfully`);
      if (notes) {
        console.log(`📝 Notes: ${notes}`);
      }
      
      return result;
    } catch (error) {
      console.error(`❌ Failed to ${action} registration:`, error.message);
      throw error;
    }
  }
  
  /**
   * Create daily schedule activities for a tour event
   */
  async createTourSchedule(tourEventId, activities) {
    try {
      console.log(`📅 Creating schedule for tour: ${tourEventId}`);
      
      const createdActivities = [];
      
      for (const activity of activities) {
        console.log(`  📝 Adding activity: ${activity.description}`);
        
        const createdActivity = await this.client.post(`/api/tour-events/${tourEventId}/activities`, activity);
        createdActivities.push(createdActivity);
        
        console.log(`    ✅ Added: ${activity.activityType} on ${activity.activityDate}`);
      }
      
      console.log(`✅ Schedule created with ${createdActivities.length} activities`);
      return createdActivities;
    } catch (error) {
      console.error('❌ Failed to create schedule:', error.message);
      throw error;
    }
  }
  
  /**
   * Update an existing activity in the schedule
   */
  async updateActivity(tourEventId, activityId, updates) {
    try {
      console.log(`✏️ Updating activity: ${activityId}`);
      
      const updatedActivity = await this.client.put(`/api/tour-events/${tourEventId}/activities/${activityId}`, updates);
      
      console.log('✅ Activity updated successfully');
      console.log(`📝 ${updatedActivity.activityType}: ${updatedActivity.description}`);
      console.log(`📅 ${updatedActivity.activityDate} ${updatedActivity.startTime}-${updatedActivity.endTime}`);
      
      return updatedActivity;
    } catch (error) {
      console.error('❌ Failed to update activity:', error.message);
      throw error;
    }
  }
  
  /**
   * View and manage company users
   */
  async viewCompanyUsers() {
    try {
      console.log('👥 Viewing company users...');
      
      const provider = await this.client.get(`/api/providers/${this.client.user.providerId}`);
      const users = await this.client.get(`/api/providers/${this.client.user.providerId}/users`);
      
      console.log(`🏢 Company: ${provider.companyName}`);
      console.log(`👥 Found ${users.length} users:`);
      
      users.forEach(user => {
        console.log(`  • ${user.firstName} ${user.lastName} (${user.userType})`);
        console.log(`    📧 ${user.emailAddress}`);
        console.log(`    📱 ${user.phoneNumber}`);
        console.log(`    📊 Status: ${user.status}`);
        console.log('');
      });
      
      return users;
    } catch (error) {
      console.error('❌ Failed to view company users:', error.message);
      throw error;
    }
  }
  
  /**
   * View tourist documents (for registered tourists)
   */
  async viewTouristDocuments(userId) {
    try {
      console.log(`📂 Viewing documents for user: ${userId}`);
      
      const documents = await this.client.get(`/api/users/${userId}/documents`);
      
      console.log(`📋 Found ${documents.length} documents:`);
      documents.forEach(doc => {
        console.log(`  📄 ${doc.fileName} (${doc.type})`);
        console.log(`    📝 ${doc.description || 'No description'}`);
        console.log(`    📅 Uploaded: ${new Date(doc.uploadDate).toLocaleDateString()}`);
        console.log(`    💾 Size: ${this.formatFileSize(doc.fileSize)}`);
        console.log('');
      });
      
      return documents;
    } catch (error) {
      console.error('❌ Failed to view tourist documents:', error.message);
      throw error;
    }
  }
  
  /**
   * Generate tour event report
   */
  async generateTourReport(tourEventId) {
    try {
      console.log(`📊 Generating report for tour: ${tourEventId}`);
      
      // Get tour event details
      const tourEvent = await this.client.get(`/api/tour-events/${tourEventId}`);
      
      // Get registrations
      const registrations = await this.client.get(`/api/tour-events/${tourEventId}/registrations`);
      
      // Get schedule
      const schedule = await this.client.get(`/api/tour-events/${tourEventId}/schedule`);
      
      const report = {
        tourEvent,
        registrations,
        schedule,
        summary: {
          totalRegistrations: registrations.length,
          approvedRegistrations: registrations.filter(r => r.status === 'Approved').length,
          pendingRegistrations: registrations.filter(r => r.status === 'Pending').length,
          rejectedRegistrations: registrations.filter(r => r.status === 'Rejected').length,
          totalActivities: schedule.length,
          occupancyRate: ((registrations.filter(r => r.status === 'Approved').length / tourEvent.numberOfAllowedTourists) * 100).toFixed(1)
        }
      };
      
      console.log('📊 Tour Event Report:');
      console.log(`🎪 Event: ${report.tourEvent.customTourName}`);
      console.log(`📅 Dates: ${report.tourEvent.startDate} to ${report.tourEvent.endDate}`);
      console.log(`👥 Registrations: ${report.summary.totalRegistrations} total`);
      console.log(`  ✅ Approved: ${report.summary.approvedRegistrations}`);
      console.log(`  ⏳ Pending: ${report.summary.pendingRegistrations}`);
      console.log(`  ❌ Rejected: ${report.summary.rejectedRegistrations}`);
      console.log(`📈 Occupancy Rate: ${report.summary.occupancyRate}%`);
      console.log(`📅 Activities: ${report.summary.totalActivities} scheduled`);
      
      return report;
    } catch (error) {
      console.error('❌ Failed to generate report:', error.message);
      throw error;
    }
  }
  
  /**
   * Bulk approve registrations
   */
  async bulkApproveRegistrations(tourEventId, userIds, notes = '') {
    try {
      console.log(`✅ Bulk approving ${userIds.length} registrations...`);
      
      const results = [];
      
      for (const userId of userIds) {
        try {
          const result = await this.handleRegistration(tourEventId, userId, 'approve', notes);
          results.push({ userId, success: true, result });
        } catch (error) {
          results.push({ userId, success: false, error: error.message });
        }
      }
      
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      console.log(`✅ Bulk approval completed: ${successful} successful, ${failed} failed`);
      
      return results;
    } catch (error) {
      console.error('❌ Bulk approval failed:', error.message);
      throw error;
    }
  }
  
  // Helper methods
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Example usage
async function providerAdminExample() {
  const workflow = new ProviderAdminWorkflow();
  
  try {
    console.log('=== Provider Admin Workflow Example ===\n');
    
    // Login as provider admin
    await workflow.client.login('provider@example.com', 'password123');
    
    // View existing tour events
    const events = await workflow.viewMyTourEvents();
    
    // Create a new tour event
    const newTourData = {
      templateId: 'template-uuid-here',
      customTourName: 'Premium Hajj Package 2024',
      startDate: '2024-06-15',
      endDate: '2024-06-25',
      packageType: 'Premium',
      place1Hotel: 'Makkah Hilton',
      place2Hotel: 'Madinah Marriott',
      numberOfAllowedTourists: 50,
      groupChatInfo: 'WhatsApp group will be created'
    };
    
    // Uncomment to create new tour event
    // const newEvent = await workflow.createTourEvent(newTourData);
    
    if (events.length > 0) {
      const eventId = events[0].tourEventId;
      
      // View registrations for first event
      const registrations = await workflow.viewTourRegistrations(eventId);
      
      // Create sample schedule
      const sampleActivities = [
        {
          activityDate: '2024-06-15',
          activityType: 'Arrival',
          description: 'Airport pickup and hotel check-in',
          startTime: '14:00',
          endTime: '18:00',
          location: 'Jeddah Airport / Makkah Hotel'
        },
        {
          activityDate: '2024-06-16',
          activityType: 'Religious',
          description: 'First Umrah performance',
          startTime: '05:00',
          endTime: '12:00',
          location: 'Masjid al-Haram'
        }
      ];
      
      // Uncomment to create schedule
      // await workflow.createTourSchedule(eventId, sampleActivities);
      
      // Generate report
      await workflow.generateTourReport(eventId);
    }
    
    // View company users
    await workflow.viewCompanyUsers();
    
    // Logout
    await workflow.client.logout();
    
  } catch (error) {
    console.error('Provider admin workflow example failed:', error.message);
  }
}

module.exports = ProviderAdminWorkflow;

// Run example if this file is executed directly
if (require.main === module) {
  providerAdminExample();
}