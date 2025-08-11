/**
 * Tourist Hub API - Basic JavaScript Client
 * 
 * This example demonstrates a basic API client implementation using Node.js
 * with automatic token management and error handling.
 */

const axios = require('axios');

class TouristHubClient {
  constructor(baseURL = 'http://localhost:3000') {
    this.baseURL = baseURL;
    this.accessToken = null;
    this.refreshToken = null;
    this.user = null;
    
    // Create axios instance with default configuration
    this.api = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // Add request interceptor to include auth token
    this.api.interceptors.request.use(
      (config) => {
        if (this.accessToken) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );
    
    // Add response interceptor for token refresh
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          
          try {
            await this.refreshAccessToken();
            originalRequest.headers.Authorization = `Bearer ${this.accessToken}`;
            return this.api(originalRequest);
          } catch (refreshError) {
            // Refresh failed, redirect to login
            this.logout();
            throw refreshError;
          }
        }
        
        return Promise.reject(error);
      }
    );
  }
  
  /**
   * Authenticate user and store tokens
   */
  async login(emailAddress, password) {
    try {
      const response = await this.api.post('/api/auth/login', {
        emailAddress,
        password
      });
      
      const { accessToken, refreshToken, user } = response.data;
      
      this.accessToken = accessToken;
      this.refreshToken = refreshToken;
      this.user = user;
      
      console.log(`Logged in as ${user.firstName} ${user.lastName} (${user.userType})`);
      return { accessToken, refreshToken, user };
    } catch (error) {
      console.error('Login failed:', error.response?.data || error.message);
      throw error;
    }
  }
  
  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken() {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }
    
    try {
      const response = await this.api.post('/api/auth/refresh', {
        refreshToken: this.refreshToken
      });
      
      const { accessToken, refreshToken } = response.data;
      
      this.accessToken = accessToken;
      this.refreshToken = refreshToken;
      
      return { accessToken, refreshToken };
    } catch (error) {
      console.error('Token refresh failed:', error.response?.data || error.message);
      throw error;
    }
  }
  
  /**
   * Logout and clear tokens
   */
  async logout() {
    try {
      if (this.refreshToken) {
        await this.api.post('/api/auth/logout', {
          refreshToken: this.refreshToken
        });
      }
    } catch (error) {
      console.error('Logout error:', error.response?.data || error.message);
    } finally {
      this.accessToken = null;
      this.refreshToken = null;
      this.user = null;
      console.log('Logged out successfully');
    }
  }
  
  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!this.accessToken;
  }
  
  /**
   * Get current user information
   */
  getCurrentUser() {
    return this.user;
  }
  
  /**
   * Generic GET request
   */
  async get(endpoint, params = {}) {
    try {
      const response = await this.api.get(endpoint, { params });
      return response.data;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }
  
  /**
   * Generic POST request
   */
  async post(endpoint, data = {}) {
    try {
      const response = await this.api.post(endpoint, data);
      return response.data;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }
  
  /**
   * Generic PUT request
   */
  async put(endpoint, data = {}) {
    try {
      const response = await this.api.put(endpoint, data);
      return response.data;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }
  
  /**
   * Generic DELETE request
   */
  async delete(endpoint) {
    try {
      const response = await this.api.delete(endpoint);
      return response.data;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }
  
  /**
   * Upload file (multipart/form-data)
   */
  async uploadFile(endpoint, file, additionalData = {}) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      // Add additional form data
      Object.keys(additionalData).forEach(key => {
        formData.append(key, additionalData[key]);
      });
      
      const response = await this.api.post(endpoint, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      return response.data;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }
  
  /**
   * Handle API errors with detailed logging
   */
  handleError(error) {
    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response;
      console.error(`API Error ${status}:`, data);
      
      if (data.error) {
        console.error(`Error Code: ${data.error.code}`);
        console.error(`Message: ${data.error.message}`);
        if (data.error.details) {
          console.error('Details:', data.error.details);
        }
      }
    } else if (error.request) {
      // Request was made but no response received
      console.error('Network Error: No response received');
    } else {
      // Something else happened
      console.error('Error:', error.message);
    }
  }
}

// Example usage
async function example() {
  const client = new TouristHubClient();
  
  try {
    // Login
    await client.login('user@example.com', 'password123');
    
    // Make authenticated requests
    const users = await client.get('/api/users');
    console.log('Users:', users);
    
    // Logout when done
    await client.logout();
  } catch (error) {
    console.error('Example failed:', error.message);
  }
}

module.exports = TouristHubClient;

// Run example if this file is executed directly
if (require.main === module) {
  example();
}