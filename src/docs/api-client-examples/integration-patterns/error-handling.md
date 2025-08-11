# Error Handling Strategies

This guide covers comprehensive error handling strategies for the Tourist Hub API, including error types, response formats, retry logic, and user experience considerations.

## Error Response Format

The Tourist Hub API uses a standardized error response format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": {
      "field": "emailAddress",
      "reason": "Invalid email format"
    },
    "timestamp": "2024-01-15T10:30:00Z",
    "path": "/api/users"
  }
}
```

## HTTP Status Codes

### 4xx Client Errors

| Status | Code | Description | Action |
|--------|------|-------------|---------|
| 400 | `VALIDATION_ERROR` | Invalid request data | Fix request and retry |
| 401 | `AUTHENTICATION_REQUIRED` | Missing or invalid token | Refresh token or login |
| 403 | `INSUFFICIENT_PERMISSIONS` | Access denied | Check user role/permissions |
| 404 | `RESOURCE_NOT_FOUND` | Resource doesn't exist | Verify resource ID |
| 409 | `RESOURCE_CONFLICT` | Resource already exists | Use different identifier |
| 422 | `BUSINESS_RULE_VIOLATION` | Business logic error | Review business rules |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests | Implement backoff |

### 5xx Server Errors

| Status | Code | Description | Action |
|--------|------|-------------|---------|
| 500 | `INTERNAL_SERVER_ERROR` | Server error | Retry with backoff |
| 502 | `BAD_GATEWAY` | Gateway error | Retry with backoff |
| 503 | `SERVICE_UNAVAILABLE` | Service down | Retry later |
| 504 | `GATEWAY_TIMEOUT` | Request timeout | Retry with longer timeout |

## Error Handling Implementation

### 1. Basic Error Handler

```javascript
class ApiErrorHandler {
  static handle(error) {
    if (error.response) {
      // Server responded with error status
      return this.handleHttpError(error.response);
    } else if (error.request) {
      // Request was made but no response received
      return this.handleNetworkError(error.request);
    } else {
      // Something else happened
      return this.handleUnknownError(error);
    }
  }
  
  static handleHttpError(response) {
    const { status, data } = response;
    const errorInfo = data.error || {};
    
    switch (status) {
      case 400:
        return this.handleValidationError(errorInfo);
      case 401:
        return this.handleAuthenticationError(errorInfo);
      case 403:
        return this.handleAuthorizationError(errorInfo);
      case 404:
        return this.handleNotFoundError(errorInfo);
      case 409:
        return this.handleConflictError(errorInfo);
      case 422:
        return this.handleBusinessRuleError(errorInfo);
      case 429:
        return this.handleRateLimitError(errorInfo);
      case 500:
      case 502:
      case 503:
      case 504:
        return this.handleServerError(errorInfo, status);
      default:
        return this.handleUnknownHttpError(errorInfo, status);
    }
  }
  
  static handleValidationError(errorInfo) {
    return {
      type: 'validation',
      message: 'Please check your input and try again',
      details: errorInfo.details,
      userMessage: this.formatValidationMessage(errorInfo.details),
      retryable: false
    };
  }
  
  static handleAuthenticationError(errorInfo) {
    return {
      type: 'authentication',
      message: 'Authentication required',
      userMessage: 'Please log in to continue',
      retryable: false,
      action: 'login'
    };
  }
  
  static handleAuthorizationError(errorInfo) {
    return {
      type: 'authorization',
      message: 'Access denied',
      userMessage: 'You do not have permission to perform this action',
      retryable: false
    };
  }
  
  static handleServerError(errorInfo, status) {
    return {
      type: 'server',
      message: 'Server error occurred',
      userMessage: 'Something went wrong. Please try again later.',
      retryable: true,
      retryAfter: this.calculateRetryDelay(status)
    };
  }
  
  static formatValidationMessage(details) {
    if (!details) return 'Invalid input provided';
    
    if (details.field && details.reason) {
      return `${details.field}: ${details.reason}`;
    }
    
    return 'Please check your input and try again';
  }
  
  static calculateRetryDelay(status) {
    switch (status) {
      case 429: return 60000; // 1 minute for rate limiting
      case 502:
      case 503: return 30000; // 30 seconds for service issues
      case 504: return 10000; // 10 seconds for timeouts
      default: return 5000;   // 5 seconds for other server errors
    }
  }
}
```

### 2. Retry Logic with Exponential Backoff

```javascript
class RetryableApiClient {
  constructor(baseURL, options = {}) {
    this.baseURL = baseURL;
    this.maxRetries = options.maxRetries || 3;
    this.baseDelay = options.baseDelay || 1000;
    this.maxDelay = options.maxDelay || 30000;
  }
  
  async makeRequest(url, options = {}, retryCount = 0) {
    try {
      const response = await fetch(`${this.baseURL}${url}`, options);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error('HTTP Error');
        error.response = { status: response.status, data: errorData };
        throw error;
      }
      
      return response;
    } catch (error) {
      const errorInfo = ApiErrorHandler.handle(error);
      
      // Check if error is retryable and we haven't exceeded max retries
      if (errorInfo.retryable && retryCount < this.maxRetries) {
        const delay = this.calculateDelay(retryCount, errorInfo.retryAfter);
        
        console.log(`Retrying request in ${delay}ms (attempt ${retryCount + 1}/${this.maxRetries})`);
        
        await this.sleep(delay);
        return this.makeRequest(url, options, retryCount + 1);
      }
      
      // Re-throw error with additional context
      error.errorInfo = errorInfo;
      error.retryCount = retryCount;
      throw error;
    }
  }
  
  calculateDelay(retryCount, retryAfter) {
    if (retryAfter) {
      return retryAfter;
    }
    
    // Exponential backoff with jitter
    const exponentialDelay = this.baseDelay * Math.pow(2, retryCount);
    const jitter = Math.random() * 0.1 * exponentialDelay;
    
    return Math.min(exponentialDelay + jitter, this.maxDelay);
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### 3. Circuit Breaker Pattern

```javascript
class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000;
    this.monitoringPeriod = options.monitoringPeriod || 10000;
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
  }
  
  async execute(operation) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime >= this.resetTimeout) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  onSuccess() {
    this.failureCount = 0;
    
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= 3) {
        this.state = 'CLOSED';
      }
    }
  }
  
  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }
  
  getState() {
    return this.state;
  }
}
```

### 4. User-Friendly Error Display

```javascript
class ErrorDisplayManager {
  constructor() {
    this.errorContainer = document.getElementById('error-container');
  }
  
  displayError(error) {
    const errorInfo = error.errorInfo || ApiErrorHandler.handle(error);
    
    const errorElement = this.createErrorElement(errorInfo);
    this.showError(errorElement);
    
    // Auto-hide non-critical errors
    if (errorInfo.type !== 'server') {
      setTimeout(() => this.hideError(errorElement), 5000);
    }
  }
  
  createErrorElement(errorInfo) {
    const element = document.createElement('div');
    element.className = `error-message error-${errorInfo.type}`;
    
    element.innerHTML = `
      <div class="error-content">
        <div class="error-icon">${this.getErrorIcon(errorInfo.type)}</div>
        <div class="error-text">
          <div class="error-title">${this.getErrorTitle(errorInfo.type)}</div>
          <div class="error-message">${errorInfo.userMessage}</div>
        </div>
        <button class="error-close" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
      ${errorInfo.action ? this.createActionButton(errorInfo.action) : ''}
    `;
    
    return element;
  }
  
  getErrorIcon(type) {
    const icons = {
      validation: '⚠️',
      authentication: '🔒',
      authorization: '🚫',
      server: '❌',
      network: '📡'
    };
    return icons[type] || '❓';
  }
  
  getErrorTitle(type) {
    const titles = {
      validation: 'Invalid Input',
      authentication: 'Authentication Required',
      authorization: 'Access Denied',
      server: 'Server Error',
      network: 'Connection Error'
    };
    return titles[type] || 'Error';
  }
  
  createActionButton(action) {
    const buttons = {
      login: '<button class="error-action" onclick="redirectToLogin()">Log In</button>',
      retry: '<button class="error-action" onclick="retryLastAction()">Retry</button>',
      refresh: '<button class="error-action" onclick="location.reload()">Refresh Page</button>'
    };
    return buttons[action] || '';
  }
  
  showError(errorElement) {
    this.errorContainer.appendChild(errorElement);
    
    // Animate in
    setTimeout(() => {
      errorElement.classList.add('show');
    }, 10);
  }
  
  hideError(errorElement) {
    errorElement.classList.add('hide');
    setTimeout(() => {
      if (errorElement.parentNode) {
        errorElement.parentNode.removeChild(errorElement);
      }
    }, 300);
  }
  
  clearAllErrors() {
    this.errorContainer.innerHTML = '';
  }
}
```

### 5. Logging and Monitoring

```javascript
class ErrorLogger {
  constructor(options = {}) {
    this.endpoint = options.endpoint || '/api/errors';
    this.batchSize = options.batchSize || 10;
    this.flushInterval = options.flushInterval || 30000;
    this.errorQueue = [];
    
    // Start periodic flush
    setInterval(() => this.flush(), this.flushInterval);
  }
  
  logError(error, context = {}) {
    const errorLog = {
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
      url: window.location.href,
      userAgent: navigator.userAgent,
      userId: context.userId,
      sessionId: context.sessionId,
      errorInfo: error.errorInfo,
      retryCount: error.retryCount,
      context: context
    };
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error logged:', errorLog);
    }
    
    // Add to queue for batch sending
    this.errorQueue.push(errorLog);
    
    // Flush immediately for critical errors
    if (this.isCriticalError(error)) {
      this.flush();
    } else if (this.errorQueue.length >= this.batchSize) {
      this.flush();
    }
  }
  
  isCriticalError(error) {
    return error.errorInfo?.type === 'server' || 
           error.message.includes('TypeError') ||
           error.message.includes('ReferenceError');
  }
  
  async flush() {
    if (this.errorQueue.length === 0) return;
    
    const errors = this.errorQueue.splice(0);
    
    try {
      await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ errors })
      });
    } catch (error) {
      // Failed to send error logs, put them back in queue
      this.errorQueue.unshift(...errors);
      console.error('Failed to send error logs:', error);
    }
  }
}
```

## Error Handling Patterns by Use Case

### 1. Form Validation Errors

```javascript
const handleFormSubmission = async (formData) => {
  try {
    const response = await apiClient.post('/api/users', formData);
    showSuccessMessage('User created successfully');
    return response.data;
  } catch (error) {
    if (error.response?.status === 400) {
      const validationErrors = error.response.data.error.details;
      displayValidationErrors(validationErrors);
    } else {
      showGenericError('Failed to create user. Please try again.');
    }
    throw error;
  }
};

const displayValidationErrors = (errors) => {
  // Clear previous errors
  document.querySelectorAll('.field-error').forEach(el => el.remove());
  
  // Display field-specific errors
  Object.keys(errors).forEach(field => {
    const fieldElement = document.querySelector(`[name="${field}"]`);
    if (fieldElement) {
      const errorElement = document.createElement('div');
      errorElement.className = 'field-error';
      errorElement.textContent = errors[field];
      fieldElement.parentNode.appendChild(errorElement);
    }
  });
};
```

### 2. Authentication Errors

```javascript
const handleAuthenticationError = (error) => {
  if (error.response?.status === 401) {
    // Clear stored tokens
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    
    // Redirect to login
    window.location.href = '/login?reason=session_expired';
  } else if (error.response?.status === 403) {
    showErrorMessage('You do not have permission to access this resource');
  }
};
```

### 3. Network Errors

```javascript
const handleNetworkError = (error) => {
  if (!navigator.onLine) {
    showOfflineMessage();
    return;
  }
  
  showErrorMessage('Connection error. Please check your internet connection and try again.');
  
  // Retry logic for critical operations
  if (error.config?.critical) {
    setTimeout(() => {
      retryRequest(error.config);
    }, 5000);
  }
};
```

## Testing Error Handling

```javascript
describe('Error Handling', () => {
  test('should handle validation errors correctly', async () => {
    const mockError = {
      response: {
        status: 400,
        data: {
          error: {
            code: 'VALIDATION_ERROR',
            details: { email: 'Invalid email format' }
          }
        }
      }
    };
    
    const errorInfo = ApiErrorHandler.handle(mockError);
    
    expect(errorInfo.type).toBe('validation');
    expect(errorInfo.retryable).toBe(false);
    expect(errorInfo.details).toEqual({ email: 'Invalid email format' });
  });
  
  test('should implement retry logic for server errors', async () => {
    const mockFetch = jest.fn()
      .mockRejectedValueOnce(new Error('Server Error'))
      .mockResolvedValueOnce({ ok: true, json: () => ({ success: true }) });
    
    global.fetch = mockFetch;
    
    const client = new RetryableApiClient('http://localhost:3000');
    const result = await client.makeRequest('/api/test');
    
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result).toBeDefined();
  });
});
```

## Best Practices

### 1. Error Categorization

- **User Errors**: Show helpful messages and guidance
- **System Errors**: Log for debugging, show generic message to user
- **Network Errors**: Provide retry options and offline handling

### 2. Progressive Error Disclosure

- Show simple error message initially
- Provide "Show Details" option for technical users
- Include error codes for support purposes

### 3. Graceful Degradation

- Provide fallback functionality when possible
- Cache data for offline scenarios
- Show partial results when some operations fail

### 4. Error Recovery

- Implement automatic retry for transient errors
- Provide manual retry options for users
- Clear error states when operations succeed

By implementing these error handling strategies, you'll create a robust application that provides excellent user experience even when things go wrong.