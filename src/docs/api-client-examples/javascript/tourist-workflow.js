/**
 * Tourist Hub API - Tourist Workflow Examples
 * 
 * This example demonstrates common workflows for Tourist users,
 * including profile management, tour registration, and document handling.
 */

const TouristHubClient = require('./basic-client');
const fs = require('fs');
const path = require('path');

class TouristWorkflow {
  constructor(baseURL) {
    this.client = new TouristHubClient(baseURL);
  }
  
  /**
   * Complete tourist registration and setup workflow
   */
  async registerAndSetupProfile(registrationData) {
    try {
      console.log('🚀 Starting tourist registration workflow...');
      
      // 1. Register new tourist account
      console.log('📝 Registering new account...');
      const registrationResponse = await this.client.post('/api/auth/register', {
        ...registrationData,
        userType: 'Tourist'
      });
      console.log('✅ Registration successful');
      
      // 2. Login with new credentials
      console.log('🔐 Logging in...');
      await this.client.login(registrationData.emailAddress, registrationData.password);
      
      // 3. Update profile with additional information
      console.log('👤 Updating profile...');
      const profileUpdate = {
        passportNumber: registrationData.passportNumber,
        dateOfBirth: registrationData.dateOfBirth,
        gender: registrationData.gender
      };
      
      const updatedUser = await this.client.put(`/api/users/${this.client.user.userId}`, profileUpdate);
      console.log('✅ Profile updated successfully');
      
      return updatedUser;
    } catch (error) {
      console.error('❌ Registration workflow failed:', error.message);
      throw error;
    }
  }
  
  /**
   * Browse and search available tour templates
   */
  async browseTourTemplates(filters = {}) {
    try {
      console.log('🔍 Browsing tour templates...');
      
      const templates = await this.client.get('/api/tour-templates', filters);
      
      console.log(`📋 Found ${templates.length} tour templates:`);
      templates.forEach(template => {
        console.log(`  • ${template.templateName} (${template.type})`);
        console.log(`    📅 ${template.startDate} to ${template.endDate}`);
        console.log(`    📍 ${template.sitesToVisit?.length || 0} sites to visit`);
        console.log('');
      });
      
      return templates;
    } catch (error) {
      console.error('❌ Failed to browse templates:', error.message);
      throw error;
    }
  }
  
  /**
   * View available tour events based on templates
   */
  async viewAvailableTourEvents(filters = {}) {
    try {
      console.log('🎯 Viewing available tour events...');
      
      const events = await this.client.get('/api/tour-events', filters);
      
      console.log(`🎪 Found ${events.length} available tour events:`);
      events.forEach(event => {
        console.log(`  • ${event.customTourName}`);
        console.log(`    📅 ${event.startDate} to ${event.endDate}`);
        console.log(`    👥 ${event.remainingTourists}/${event.numberOfAllowedTourists} spots available`);
        console.log(`    🏨 Hotels: ${event.place1Hotel}, ${event.place2Hotel}`);
        console.log(`    📊 Status: ${event.status}`);
        console.log('');
      });
      
      return events;
    } catch (error) {
      console.error('❌ Failed to view tour events:', error.message);
      throw error;
    }
  }
  
  /**
   * Register for a tour event
   */
  async registerForTour(tourEventId) {
    try {
      console.log(`📝 Registering for tour event: ${tourEventId}`);
      
      // First, get tour event details
      const tourEvent = await this.client.get(`/api/tour-events/${tourEventId}`);
      console.log(`🎪 Tour: ${tourEvent.customTourName}`);
      
      // Check availability
      if (tourEvent.remainingTourists <= 0) {
        throw new Error('Tour is fully booked');
      }
      
      if (tourEvent.status !== 'Active') {
        throw new Error(`Tour is not available for registration (Status: ${tourEvent.status})`);
      }
      
      // Register for the tour
      const registration = await this.client.post(`/api/tour-events/${tourEventId}/register`);
      
      console.log('✅ Registration successful!');
      console.log(`📋 Registration Status: ${registration.status}`);
      
      if (registration.status === 'Pending') {
        console.log('⏳ Your registration is pending approval from the provider');
      }
      
      return registration;
    } catch (error) {
      console.error('❌ Tour registration failed:', error.message);
      throw error;
    }
  }
  
  /**
   * View tour schedule and activities
   */
  async viewTourSchedule(tourEventId) {
    try {
      console.log(`📅 Viewing schedule for tour: ${tourEventId}`);
      
      const schedule = await this.client.get(`/api/tour-events/${tourEventId}/schedule`);
      
      console.log('📋 Tour Schedule:');
      schedule.forEach(activity => {
        console.log(`  📅 ${activity.activityDate} (${activity.islamicDate || 'N/A'})`);
        console.log(`    🕐 ${activity.startTime} - ${activity.endTime}`);
        console.log(`    🎯 ${activity.activityType}: ${activity.description}`);
        console.log(`    📍 Location: ${activity.location}`);
        if (activity.webLink) {
          console.log(`    🔗 Link: ${activity.webLink}`);
        }
        console.log('');
      });
      
      return schedule;
    } catch (error) {
      console.error('❌ Failed to view schedule:', error.message);
      throw error;
    }
  }
  
  /**
   * Upload document (passport, ticket, etc.)
   */
  async uploadDocument(filePath, documentType, description = '') {
    try {
      console.log(`📄 Uploading ${documentType} document...`);
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }
      
      // Create file object (in browser, this would be a File object)
      const fileBuffer = fs.readFileSync(filePath);
      const fileName = path.basename(filePath);
      
      // In a real browser environment, you would use:
      // const file = document.getElementById('fileInput').files[0];
      
      const uploadData = {
        type: documentType,
        description: description
      };
      
      // Note: This is a simplified example. In practice, you'd need to handle
      // file uploads differently in Node.js vs browser environments
      const document = await this.client.uploadFile('/api/documents', {
        buffer: fileBuffer,
        originalname: fileName,
        mimetype: this.getMimeType(fileName)
      }, uploadData);
      
      console.log('✅ Document uploaded successfully');
      console.log(`📄 Document ID: ${document.documentId}`);
      console.log(`📁 File: ${document.fileName}`);
      
      return document;
    } catch (error) {
      console.error('❌ Document upload failed:', error.message);
      throw error;
    }
  }
  
  /**
   * View uploaded documents
   */
  async viewMyDocuments() {
    try {
      console.log('📂 Viewing my documents...');
      
      const documents = await this.client.get('/api/documents');
      
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
      console.error('❌ Failed to view documents:', error.message);
      throw error;
    }
  }
  
  /**
   * Download blank tour forms
   */
  async downloadBlankForms() {
    try {
      console.log('📋 Downloading blank tour forms...');
      
      const response = await this.client.api.get('/api/documents/forms/blank', {
        responseType: 'blob'
      });
      
      // In a browser environment, you would create a download link
      // const url = window.URL.createObjectURL(new Blob([response.data]));
      // const link = document.createElement('a');
      // link.href = url;
      // link.download = 'tour-forms.pdf';
      // link.click();
      
      console.log('✅ Blank forms downloaded successfully');
      return response.data;
    } catch (error) {
      console.error('❌ Failed to download forms:', error.message);
      throw error;
    }
  }
  
  /**
   * View my tour registrations
   */
  async viewMyRegistrations() {
    try {
      console.log('📋 Viewing my tour registrations...');
      
      // Get tour events where I'm registered
      const events = await this.client.get('/api/tour-events');
      const myRegistrations = events.filter(event => 
        event.registeredTourists?.includes(this.client.user.userId)
      );
      
      console.log(`🎪 Found ${myRegistrations.length} registrations:`);
      myRegistrations.forEach(event => {
        console.log(`  • ${event.customTourName}`);
        console.log(`    📅 ${event.startDate} to ${event.endDate}`);
        console.log(`    📊 Status: ${event.status}`);
        console.log('');
      });
      
      return myRegistrations;
    } catch (error) {
      console.error('❌ Failed to view registrations:', error.message);
      throw error;
    }
  }
  
  /**
   * Update profile information
   */
  async updateProfile(updates) {
    try {
      console.log('👤 Updating profile...');
      
      const updatedUser = await this.client.put(`/api/users/${this.client.user.userId}`, updates);
      
      console.log('✅ Profile updated successfully');
      console.log(`👤 Name: ${updatedUser.firstName} ${updatedUser.lastName}`);
      console.log(`📧 Email: ${updatedUser.emailAddress}`);
      console.log(`📱 Phone: ${updatedUser.phoneNumber}`);
      
      return updatedUser;
    } catch (error) {
      console.error('❌ Profile update failed:', error.message);
      throw error;
    }
  }
  
  // Helper methods
  getMimeType(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }
  
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Example usage
async function touristExample() {
  const workflow = new TouristWorkflow();
  
  try {
    // Example: Complete tourist workflow
    console.log('=== Tourist Workflow Example ===\n');
    
    // Login (assuming account already exists)
    await workflow.client.login('tourist@example.com', 'password123');
    
    // Browse available tours
    await workflow.browseTourTemplates();
    
    // View available tour events
    const events = await workflow.viewAvailableTourEvents();
    
    if (events.length > 0) {
      // Register for first available tour
      await workflow.registerForTour(events[0].tourEventId);
      
      // View tour schedule
      await workflow.viewTourSchedule(events[0].tourEventId);
    }
    
    // View my documents
    await workflow.viewMyDocuments();
    
    // View my registrations
    await workflow.viewMyRegistrations();
    
    // Logout
    await workflow.client.logout();
    
  } catch (error) {
    console.error('Tourist workflow example failed:', error.message);
  }
}

module.exports = TouristWorkflow;

// Run example if this file is executed directly
if (require.main === module) {
  touristExample();
}