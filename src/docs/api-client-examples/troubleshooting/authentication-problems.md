# Authentication Troubleshooting Guide

This guide provides detailed troubleshooting steps for authentication-related issues in the Tourist Hub API, including common problems, diagnostic techniques, and solutions.

## Quick Diagnosis Checklist

Before diving into detailed troubleshooting, run through this quick checklist:

- [ ] Is the API server running and accessible?
- [ ] Are you using the correct API base URL?
- [ ] Is the request including the Authorization header?
- [ ] Is the token format correct (Bearer <token>)?
- [ ] Has the token expired?
- [ ] Do you have the correct user role for the requested resource?

## Common Authentication Problems

### 1. Login Failures

#### Problem: Invalid Credentials (422 Unprocessable Entity)

**Error Response:**
```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password",
    "timestamp": "2024-01-15T10:30:00Z",
    "path": "/api/auth/login"
  }
}
```

**Diagnostic Steps:**

```javascript
// Test login with debug information
const debugLogin = async (email, password) => {
  console.log('Attempting login with:', { email, passwordLength: password.length });
  
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        emailAddress: email,
        password: password
      })
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', [...response.headers.entries()]);
    
    const data = await response.json();
    console.log('Response data:', data);
    
    if (!response.ok) {
      throw new Error(`Login failed: ${data.error?.message}`);
    }
    
    return data;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};
```

**Common Causes & Solutions:**

1. **Incorrect email format**
   ```javascript
   // ❌ Wrong
   const email = "user@domain";
   
   // ✅ Correct
   const email = "user@domain.com";
   ```

2. **Password encoding issues**
   ```javascript
   // Check for hidden characters or encoding issues
   const cleanPassword = password.trim();
   console.log('Password bytes:', new TextEncoder().encode(cleanPassword));
   ```

3. **Case sensitivity**
   ```javascript
   // Email should be lowercase
   const normalizedEmail = email.toLowerCase().trim();
   ```

#### Problem: Account Locked or Inactive

**Error Response:**
```json
{
  "error": {
    "code": "ACCOUNT_INACTIVE",
    "message": "Account is inactive",
    "timestamp": "2024-01-15T10:30:00Z",
    "path": "/api/auth/login"
  }
}
```

**Solution:**
Contact system administrator to activate the account or check account status.

### 2. Token-Related Issues

#### Problem: Token Expired (401 Unauthorized)

**Error Response:**
```json
{
  "error": {
    "code": "TOKEN_EXPIRED",
    "message": "Access token has expired",
    "timestamp": "2024-01-15T10:30:00Z",
    "path": "/api/users"
  }
}
```

**Diagnostic Tool:**

```javascript
const analyzeToken = (token) => {
  if (!token) {
    return { valid: false, error: 'Token is null or undefined' };
  }
  
  try {
    // Split JWT token
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'Invalid JWT format' };
    }
    
    // Decode header and payload
    const header = JSON.parse(atob(parts[0]));
    const payload = JSON.parse(atob(parts[1]));
    
    const now = Math.floor(Date.now() / 1000);
    const isExpired = payload.exp < now;
    const timeUntilExpiry = payload.exp - now;
    
    return {
      valid: !isExpired,
      header,
      payload,
      isExpired,
      timeUntilExpiry,
      expiresAt: new Date(payload.exp * 1000),
      issuedAt: new Date(payload.iat * 1000)
    };
  } catch (error) {
    return { valid: false, error: `Token decode error: ${error.message}` };
  }
};

// Usage
const tokenInfo = analyzeToken(localStorage.getItem('accessToken'));
console.log('Token analysis:', tokenInfo);
```

**Automatic Token Refresh Implementation:**

```javascript
class TokenManager {
  constructor() {
    this.accessToken = localStorage.getItem('accessToken');
    this.refreshToken = localStorage.getItem('refreshToken');
    this.refreshPromise = null;
  }
  
  async getValidToken() {
    const tokenInfo = analyzeToken(this.accessToken);
    
    // If token expires in less than 5 minutes, refresh it
    if (!tokenInfo.valid || tokenInfo.timeUntilExpiry < 300) {
      console.log('Token expired or expiring soon, refreshing...');
      await this.refreshAccessToken();
    }
    
    return this.accessToken;
  }
  
  async refreshAccessToken() {
    // Prevent multiple simultaneous refresh attempts
    if (this.refreshPromise) {
      return this.refreshPromise;
    }
    
    this.refreshPromise = this.performRefresh();
    
    try {
      await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }
  
  async performRefresh() {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }
    
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          refreshToken: this.refreshToken
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Refresh failed: ${errorData.error?.message}`);
      }
      
      const data = await response.json();
      
      this.accessToken = data.accessToken;
      this.refreshToken = data.refreshToken;
      
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      
      console.log('Token refreshed successfully');
    } catch (error) {
      console.error('Token refresh failed:', error);
      this.clearTokens();
      throw error;
    }
  }
  
  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }
}
```

#### Problem: Malformed Authorization Header

**Common Mistakes:**

```javascript
// ❌ Wrong - Missing 'Bearer ' prefix
headers: {
  'Authorization': token
}

// ❌ Wrong - Incorrect header name
headers: {
  'Authentication': `Bearer ${token}`
}

// ❌ Wrong - Token in request body
body: JSON.stringify({
  token: token,
  // ... other data
})

// ✅ Correct
headers: {
  'Authorization': `Bearer ${token}`
}
```

**Header Validation Function:**

```javascript
const validateAuthHeader = (headers) => {
  const authHeader = headers['Authorization'] || headers['authorization'];
  
  if (!authHeader) {
    return { valid: false, error: 'Authorization header missing' };
  }
  
  if (!authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Authorization header must start with "Bearer "' };
  }
  
  const token = authHeader.substring(7);
  if (!token) {
    return { valid: false, error: 'Token is empty' };
  }
  
  return { valid: true, token };
};
```

### 3. Role-Based Access Issues

#### Problem: Insufficient Permissions (403 Forbidden)

**Error Response:**
```json
{
  "error": {
    "code": "INSUFFICIENT_PERMISSIONS",
    "message": "Access denied",
    "details": {
      "requiredRole": "SystemAdmin",
      "userRole": "Tourist"
    },
    "timestamp": "2024-01-15T10:30:00Z",
    "path": "/api/users"
  }
}
```

**Role Checking Utility:**

```javascript
const checkUserAccess = (user, requiredRole, resourceOwnerId = null) => {
  console.log('Access check:', {
    user: user,
    requiredRole: requiredRole,
    resourceOwnerId: resourceOwnerId
  });
  
  // Role hierarchy
  const roleHierarchy = {
    'SystemAdmin': 3,
    'ProviderAdmin': 2,
    'Tourist': 1
  };
  
  const userLevel = roleHierarchy[user.userType] || 0;
  const requiredLevel = roleHierarchy[requiredRole] || 0;
  
  // Check role hierarchy
  if (userLevel >= requiredLevel) {
    return { allowed: true, reason: 'Role hierarchy satisfied' };
  }
  
  // Check resource ownership for same-level access
  if (resourceOwnerId && user.userId === resourceOwnerId) {
    return { allowed: true, reason: 'Resource owner access' };
  }
  
  // Check provider-scoped access
  if (user.userType === 'ProviderAdmin' && user.providerId) {
    // ProviderAdmin can access resources within their provider
    return { allowed: true, reason: 'Provider-scoped access' };
  }
  
  return { 
    allowed: false, 
    reason: `Insufficient permissions: ${user.userType} cannot access ${requiredRole} resource` 
  };
};
```

**Client-Side Role Validation:**

```javascript
const RoleGuard = ({ user, requiredRole, children, fallback }) => {
  const accessCheck = checkUserAccess(user, requiredRole);
  
  if (!accessCheck.allowed) {
    console.warn('Access denied:', accessCheck.reason);
    return fallback || <div>Access denied</div>;
  }
  
  return children;
};

// Usage
<RoleGuard 
  user={currentUser} 
  requiredRole="SystemAdmin"
  fallback={<div>You need admin privileges to view this content</div>}
>
  <AdminPanel />
</RoleGuard>
```

### 4. Session Management Issues

#### Problem: Session Timeout

**Implementation:**

```javascript
class SessionManager {
  constructor(timeoutMinutes = 30) {
    this.timeoutDuration = timeoutMinutes * 60 * 1000;
    this.warningDuration = 5 * 60 * 1000; // 5 minutes warning
    this.timeoutId = null;
    this.warningId = null;
    this.lastActivity = Date.now();
    
    this.setupActivityListeners();
    this.resetTimeout();
  }
  
  setupActivityListeners() {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    events.forEach(event => {
      document.addEventListener(event, () => {
        this.updateActivity();
      }, { passive: true });
    });
  }
  
  updateActivity() {
    this.lastActivity = Date.now();
    this.resetTimeout();
  }
  
  resetTimeout() {
    // Clear existing timeouts
    if (this.timeoutId) clearTimeout(this.timeoutId);
    if (this.warningId) clearTimeout(this.warningId);
    
    // Set warning timeout
    this.warningId = setTimeout(() => {
      this.showSessionWarning();
    }, this.timeoutDuration - this.warningDuration);
    
    // Set session timeout
    this.timeoutId = setTimeout(() => {
      this.handleSessionTimeout();
    }, this.timeoutDuration);
  }
  
  showSessionWarning() {
    const remainingTime = Math.ceil(this.warningDuration / 1000);
    
    if (confirm(`Your session will expire in ${remainingTime} seconds. Continue?`)) {
      this.updateActivity();
    }
  }
  
  handleSessionTimeout() {
    alert('Your session has expired. Please log in again.');
    this.logout();
  }
  
  logout() {
    // Clear tokens and redirect to login
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    window.location.href = '/login?reason=session_expired';
  }
}
```

### 5. Cross-Origin Issues

#### Problem: CORS Errors in Browser

**Error Message:**
```
Access to fetch at 'http://localhost:3000/api/auth/login' from origin 'http://localhost:3001' 
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

**Client-Side Solutions:**

1. **Development Proxy Setup (React):**
```json
// package.json
{
  "name": "my-app",
  "proxy": "http://localhost:3000",
  "dependencies": {
    // ...
  }
}
```

2. **Webpack Dev Server Proxy:**
```javascript
// webpack.config.js
module.exports = {
  devServer: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      }
    }
  }
};
```

3. **Environment-Based URL Configuration:**
```javascript
const API_BASE_URL = process.env.NODE_ENV === 'development' 
  ? '/api'  // Use proxy in development
  : 'https://api.touristhub.com';  // Direct API in production
```

### 6. Debugging Tools and Techniques

#### Network Request Interceptor

```javascript
// Intercept all fetch requests for debugging
const originalFetch = window.fetch;

window.fetch = async (...args) => {
  const [url, options = {}] = args;
  
  console.group(`🌐 API Request: ${options.method || 'GET'} ${url}`);
  console.log('Request options:', options);
  
  // Log authentication header
  if (options.headers?.Authorization) {
    const token = options.headers.Authorization.replace('Bearer ', '');
    const tokenInfo = analyzeToken(token);
    console.log('Token info:', tokenInfo);
  }
  
  const startTime = performance.now();
  
  try {
    const response = await originalFetch(...args);
    const endTime = performance.now();
    
    console.log(`✅ Response: ${response.status} (${Math.round(endTime - startTime)}ms)`);
    
    // Log response headers
    console.log('Response headers:', [...response.headers.entries()]);
    
    // Clone response to read body without consuming it
    const clonedResponse = response.clone();
    try {
      const responseData = await clonedResponse.json();
      console.log('Response data:', responseData);
    } catch (e) {
      console.log('Response body (non-JSON):', await clonedResponse.text());
    }
    
    console.groupEnd();
    return response;
  } catch (error) {
    const endTime = performance.now();
    console.error(`❌ Request failed (${Math.round(endTime - startTime)}ms):`, error);
    console.groupEnd();
    throw error;
  }
};
```

#### Authentication State Monitor

```javascript
const AuthMonitor = {
  init() {
    this.checkAuthState();
    setInterval(() => this.checkAuthState(), 30000); // Check every 30 seconds
  },
  
  checkAuthState() {
    const token = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');
    
    console.log('🔐 Auth State Check:', {
      hasAccessToken: !!token,
      hasRefreshToken: !!refreshToken,
      tokenInfo: token ? analyzeToken(token) : null
    });
    
    if (token) {
      const tokenInfo = analyzeToken(token);
      if (!tokenInfo.valid) {
        console.warn('⚠️ Invalid or expired token detected');
        this.handleInvalidToken();
      } else if (tokenInfo.timeUntilExpiry < 300) {
        console.warn('⏰ Token expires soon, consider refreshing');
      }
    }
  },
  
  handleInvalidToken() {
    // Attempt to refresh or redirect to login
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      console.log('🔄 Attempting token refresh...');
      // Trigger refresh logic
    } else {
      console.log('🚪 No refresh token, redirecting to login');
      window.location.href = '/login';
    }
  }
};

// Initialize auth monitoring
AuthMonitor.init();
```

## Testing Authentication

### Unit Tests for Authentication Logic

```javascript
describe('Authentication', () => {
  beforeEach(() => {
    localStorage.clear();
    fetch.resetMocks();
  });
  
  test('should handle successful login', async () => {
    const mockResponse = {
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      user: { userId: '1', userType: 'Tourist' }
    };
    
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });
    
    const result = await login('test@example.com', 'password');
    
    expect(result.user.userId).toBe('1');
    expect(localStorage.getItem('accessToken')).toBe('mock-access-token');
  });
  
  test('should handle login failure', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' }
      })
    });
    
    await expect(login('test@example.com', 'wrong-password'))
      .rejects.toThrow('Invalid credentials');
  });
  
  test('should refresh token when expired', async () => {
    // Mock expired token
    const expiredToken = createMockToken({ exp: Math.floor(Date.now() / 1000) - 3600 });
    localStorage.setItem('accessToken', expiredToken);
    localStorage.setItem('refreshToken', 'refresh-token');
    
    // Mock refresh response
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token'
      })
    });
    
    const tokenManager = new TokenManager();
    const validToken = await tokenManager.getValidToken();
    
    expect(validToken).toBe('new-access-token');
    expect(localStorage.getItem('accessToken')).toBe('new-access-token');
  });
});
```

By following this comprehensive troubleshooting guide, you should be able to identify and resolve most authentication-related issues with the Tourist Hub API.