# Common Issues and Solutions

This guide covers the most frequently encountered issues when integrating with the Tourist Hub API, along with step-by-step solutions and prevention strategies.

## Authentication Issues

### Issue: "Invalid token" or 401 Unauthorized

**Symptoms:**
- Receiving 401 status code on authenticated requests
- Error message: "Authentication required" or "Invalid token"

**Common Causes:**
1. Token has expired
2. Token is malformed or corrupted
3. Token is not included in request headers
4. Using wrong authentication header format

**Solutions:**

```javascript
// ✅ Correct token usage
const response = await fetch('/api/users', {
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  }
});

// ❌ Common mistakes
// Missing 'Bearer ' prefix
'Authorization': accessToken

// Wrong header name
'Authentication': `Bearer ${accessToken}`

// Token in wrong place
body: JSON.stringify({ token: accessToken })
```

**Debugging Steps:**
1. Check if token exists and is not null/undefined
2. Verify token format (should be a JWT string)
3. Check token expiration using JWT decoder
4. Ensure proper header format

```javascript
// Debug token issues
const debugToken = (token) => {
  if (!token) {
    console.error('Token is missing');
    return false;
  }
  
  try {
    // Decode JWT payload (without verification)
    const payload = JSON.parse(atob(token.split('.')[1]));
    const now = Date.now() / 1000;
    
    console.log('Token payload:', payload);
    console.log('Token expires at:', new Date(payload.exp * 1000));
    console.log('Token is expired:', payload.exp < now);
    
    return payload.exp >= now;
  } catch (error) {
    console.error('Invalid token format:', error);
    return false;
  }
};
```

### Issue: Token refresh fails

**Symptoms:**
- 401 error when trying to refresh token
- Infinite redirect loops to login page

**Solutions:**

```javascript
// Implement proper refresh logic
const refreshToken = async () => {
  const refreshToken = localStorage.getItem('refreshToken');
  
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }
  
  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });
    
    if (!response.ok) {
      // Refresh token is invalid, redirect to login
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      window.location.href = '/login';
      throw new Error('Refresh token invalid');
    }
    
    const data = await response.json();
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    
    return data.accessToken;
  } catch (error) {
    console.error('Token refresh failed:', error);
    throw error;
  }
};
```

## CORS Issues

### Issue: CORS policy blocks requests

**Symptoms:**
- Error: "Access to fetch at '...' from origin '...' has been blocked by CORS policy"
- Network tab shows failed preflight requests

**Solutions:**

1. **Server-side CORS configuration** (if you control the API):
```javascript
// Express.js CORS setup
const cors = require('cors');

app.use(cors({
  origin: ['http://localhost:3000', 'https://yourdomain.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

2. **Client-side workarounds**:
```javascript
// Use proxy in development (package.json)
{
  "proxy": "http://localhost:3000"
}

// Or configure webpack dev server
module.exports = {
  devServer: {
    proxy: {
      '/api': 'http://localhost:3000'
    }
  }
};
```

## Data Validation Issues

### Issue: 400 Bad Request - Validation errors

**Symptoms:**
- 400 status code with validation error details
- Form submissions failing

**Common Validation Errors:**

```javascript
// Email validation
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Phone number validation
const validatePhoneNumber = (phone) => {
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  // Should be 10-15 digits
  return cleaned.length >= 10 && cleaned.length <= 15;
};

// Password validation
const validatePassword = (password) => {
  return password.length >= 8 && 
         /[A-Z]/.test(password) && 
         /[a-z]/.test(password) && 
         /\d/.test(password);
};

// Date validation
const validateDate = (dateString) => {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
};
```

**Form Validation Example:**

```javascript
const validateUserForm = (formData) => {
  const errors = {};
  
  if (!formData.firstName?.trim()) {
    errors.firstName = 'First name is required';
  }
  
  if (!validateEmail(formData.emailAddress)) {
    errors.emailAddress = 'Valid email address is required';
  }
  
  if (!validatePhoneNumber(formData.phoneNumber)) {
    errors.phoneNumber = 'Valid phone number is required';
  }
  
  if (!validatePassword(formData.password)) {
    errors.password = 'Password must be at least 8 characters with uppercase, lowercase, and number';
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};
```

## File Upload Issues

### Issue: File upload fails or times out

**Symptoms:**
- 413 Payload Too Large
- 408 Request Timeout
- Upload progress stalls

**Solutions:**

```javascript
// Proper file upload implementation
const uploadDocument = async (file, metadata) => {
  // Validate file size (e.g., 10MB limit)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new Error('File size exceeds 10MB limit');
  }
  
  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('File type not supported');
  }
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', metadata.type);
  formData.append('description', metadata.description);
  
  try {
    const response = await fetch('/api/documents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
        // Don't set Content-Type for FormData
      },
      body: formData
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Upload failed');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Upload failed:', error);
    throw error;
  }
};

// Upload with progress tracking
const uploadWithProgress = (file, metadata, onProgress) => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    
    formData.append('file', file);
    Object.keys(metadata).forEach(key => {
      formData.append(key, metadata[key]);
    });
    
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const percentComplete = (event.loaded / event.total) * 100;
        onProgress(percentComplete);
      }
    });
    
    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    });
    
    xhr.addEventListener('error', () => {
      reject(new Error('Upload failed'));
    });
    
    xhr.open('POST', '/api/documents');
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    xhr.send(formData);
  });
};
```

## Network and Connectivity Issues

### Issue: Intermittent network failures

**Symptoms:**
- Random request failures
- "Network error" messages
- Requests work sometimes but not others

**Solutions:**

```javascript
// Implement retry logic with exponential backoff
const retryRequest = async (requestFn, maxRetries = 3) => {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error;
      
      // Don't retry client errors (4xx)
      if (error.response?.status >= 400 && error.response?.status < 500) {
        throw error;
      }
      
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        console.log(`Request failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
};

// Usage
const fetchUsers = () => retryRequest(async () => {
  const response = await fetch('/api/users', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  
  return response.json();
});
```

### Issue: Offline handling

**Solutions:**

```javascript
// Detect online/offline status
const handleOnlineStatus = () => {
  const updateOnlineStatus = () => {
    if (navigator.onLine) {
      console.log('Back online');
      // Retry failed requests
      retryFailedRequests();
    } else {
      console.log('Gone offline');
      // Show offline message
      showOfflineMessage();
    }
  };
  
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
};

// Queue requests when offline
const requestQueue = [];

const queueRequest = (requestFn) => {
  if (navigator.onLine) {
    return requestFn();
  } else {
    return new Promise((resolve, reject) => {
      requestQueue.push({ requestFn, resolve, reject });
    });
  }
};

const retryFailedRequests = async () => {
  while (requestQueue.length > 0) {
    const { requestFn, resolve, reject } = requestQueue.shift();
    try {
      const result = await requestFn();
      resolve(result);
    } catch (error) {
      reject(error);
    }
  }
};
```

## Role-Based Access Issues

### Issue: 403 Forbidden errors

**Symptoms:**
- User can login but can't access certain resources
- "Insufficient permissions" errors

**Debugging Steps:**

```javascript
// Check user role and permissions
const checkUserPermissions = (user, requiredRole) => {
  console.log('Current user:', user);
  console.log('Required role:', requiredRole);
  console.log('User role:', user.userType);
  console.log('Provider ID:', user.providerId);
  
  const roleHierarchy = {
    'SystemAdmin': 3,
    'ProviderAdmin': 2,
    'Tourist': 1
  };
  
  const userLevel = roleHierarchy[user.userType] || 0;
  const requiredLevel = roleHierarchy[requiredRole] || 0;
  
  return userLevel >= requiredLevel;
};

// Role-based component rendering
const RoleBasedComponent = ({ user, requiredRole, children }) => {
  if (!checkUserPermissions(user, requiredRole)) {
    return <div>Access denied. Required role: {requiredRole}</div>;
  }
  
  return children;
};
```

## Performance Issues

### Issue: Slow API responses

**Symptoms:**
- Long loading times
- Timeouts
- Poor user experience

**Solutions:**

```javascript
// Implement request caching
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const cachedFetch = async (url, options = {}) => {
  const cacheKey = `${url}${JSON.stringify(options)}`;
  const cached = cache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  
  const response = await fetch(url, options);
  const data = await response.json();
  
  cache.set(cacheKey, {
    data,
    timestamp: Date.now()
  });
  
  return data;
};

// Implement request debouncing for search
const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), delay);
  };
};

const debouncedSearch = debounce(async (query) => {
  const results = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
  return results.json();
}, 300);

// Pagination for large datasets
const fetchPaginatedData = async (endpoint, page = 1, limit = 20) => {
  const response = await fetch(`${endpoint}?page=${page}&limit=${limit}`);
  return response.json();
};
```

## Debugging Tools and Techniques

### Browser Developer Tools

```javascript
// Enable detailed logging
const DEBUG = process.env.NODE_ENV === 'development';

const apiClient = {
  async request(url, options) {
    if (DEBUG) {
      console.group(`API Request: ${options.method || 'GET'} ${url}`);
      console.log('Options:', options);
      console.time('Request Duration');
    }
    
    try {
      const response = await fetch(url, options);
      
      if (DEBUG) {
        console.log('Response Status:', response.status);
        console.log('Response Headers:', [...response.headers.entries()]);
      }
      
      const data = await response.json();
      
      if (DEBUG) {
        console.log('Response Data:', data);
        console.timeEnd('Request Duration');
        console.groupEnd();
      }
      
      return data;
    } catch (error) {
      if (DEBUG) {
        console.error('Request Error:', error);
        console.timeEnd('Request Duration');
        console.groupEnd();
      }
      throw error;
    }
  }
};
```

### Network Monitoring

```javascript
// Monitor API performance
const performanceMonitor = {
  requests: [],
  
  logRequest(url, duration, status) {
    this.requests.push({
      url,
      duration,
      status,
      timestamp: Date.now()
    });
    
    // Keep only last 100 requests
    if (this.requests.length > 100) {
      this.requests.shift();
    }
  },
  
  getStats() {
    const successful = this.requests.filter(r => r.status < 400);
    const failed = this.requests.filter(r => r.status >= 400);
    
    return {
      total: this.requests.length,
      successful: successful.length,
      failed: failed.length,
      averageDuration: successful.reduce((sum, r) => sum + r.duration, 0) / successful.length,
      slowestRequest: Math.max(...successful.map(r => r.duration))
    };
  }
};
```

## Prevention Strategies

### 1. Input Validation

Always validate data on the client side before sending to the API:

```javascript
const validateBeforeSubmit = (data, schema) => {
  const errors = {};
  
  Object.keys(schema).forEach(field => {
    const rules = schema[field];
    const value = data[field];
    
    if (rules.required && !value) {
      errors[field] = `${field} is required`;
    }
    
    if (value && rules.type && typeof value !== rules.type) {
      errors[field] = `${field} must be a ${rules.type}`;
    }
    
    if (value && rules.minLength && value.length < rules.minLength) {
      errors[field] = `${field} must be at least ${rules.minLength} characters`;
    }
  });
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};
```

### 2. Error Boundaries

Implement error boundaries to catch and handle unexpected errors:

```javascript
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    // Log to error reporting service
    errorLogger.logError(error, { errorInfo });
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="error-fallback">
          <h2>Something went wrong</h2>
          <button onClick={() => this.setState({ hasError: false, error: null })}>
            Try again
          </button>
        </div>
      );
    }
    
    return this.props.children;
  }
}
```

### 3. Health Checks

Implement health checks to monitor API availability:

```javascript
const healthCheck = async () => {
  try {
    const response = await fetch('/api/health', { 
      method: 'GET',
      timeout: 5000 
    });
    
    return response.ok;
  } catch (error) {
    console.warn('Health check failed:', error);
    return false;
  }
};

// Check health periodically
setInterval(async () => {
  const isHealthy = await healthCheck();
  if (!isHealthy) {
    showMaintenanceMessage();
  }
}, 60000); // Check every minute
```

By following these troubleshooting guidelines and implementing prevention strategies, you can significantly reduce integration issues and provide a better user experience.