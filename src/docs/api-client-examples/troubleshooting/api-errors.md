# API Error Reference Guide

This comprehensive reference guide covers all error codes, status codes, and error scenarios in the Tourist Hub API, along with their meanings, causes, and recommended actions.

## Error Response Structure

All API errors follow this standardized format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "specific_field",
      "reason": "detailed_reason"
    },
    "timestamp": "2024-01-15T10:30:00Z",
    "path": "/api/endpoint"
  }
}
```

## HTTP Status Codes Reference

### 2xx Success Codes

| Code | Status | Description |
|------|--------|-------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created successfully |
| 204 | No Content | Request successful, no content returned |

### 4xx Client Error Codes

#### 400 Bad Request

**Common Error Codes:**

| Error Code | Description | Example |
|------------|-------------|---------|
| `VALIDATION_ERROR` | Request data validation failed | Invalid email format |
| `MISSING_REQUIRED_FIELD` | Required field not provided | Missing firstName |
| `INVALID_JSON` | Malformed JSON in request body | Syntax error in JSON |
| `INVALID_PARAMETER` | Invalid query parameter | Invalid date format |

**Example Response:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "emailAddress": "Invalid email format",
      "phoneNumber": "Phone number must be 10-15 digits"
    },
    "timestamp": "2024-01-15T10:30:00Z",
    "path": "/api/users"
  }
}
```

**Client Action:** Fix the request data and retry.

#### 401 Unauthorized

**Common Error Codes:**

| Error Code | Description | Action Required |
|------------|-------------|-----------------|
| `AUTHENTICATION_REQUIRED` | No authentication token provided | Include Authorization header |
| `TOKEN_EXPIRED` | Access token has expired | Refresh token or re-login |
| `INVALID_TOKEN` | Token is malformed or invalid | Re-login to get new token |
| `TOKEN_REVOKED` | Token has been revoked | Re-login required |

**Example Response:**
```json
{
  "error": {
    "code": "TOKEN_EXPIRED",
    "message": "Access token has expired",
    "details": {
      "expiredAt": "2024-01-15T09:30:00Z"
    },
    "timestamp": "2024-01-15T10:30:00Z",
    "path": "/api/users"
  }
}
```

**Client Action:** Refresh token or redirect to login.

#### 403 Forbidden

**Common Error Codes:**

| Error Code | Description | Details |
|------------|-------------|---------|
| `INSUFFICIENT_PERMISSIONS` | User lacks required permissions | Role-based access denied |
| `RESOURCE_ACCESS_DENIED` | Cannot access specific resource | Data isolation violation |
| `PROVIDER_SCOPE_VIOLATION` | Accessing outside provider scope | Cross-provider access attempt |

**Example Response:**
```json
{
  "error": {
    "code": "INSUFFICIENT_PERMISSIONS",
    "message": "Access denied",
    "details": {
      "requiredRole": "SystemAdmin",
      "userRole": "Tourist",
      "resource": "user_management"
    },
    "timestamp": "2024-01-15T10:30:00Z",
    "path": "/api/users"
  }
}
```

**Client Action:** Check user permissions or request access from administrator.

#### 404 Not Found

**Common Error Codes:**

| Error Code | Description | Common Causes |
|------------|-------------|---------------|
| `RESOURCE_NOT_FOUND` | Requested resource doesn't exist | Invalid ID, deleted resource |
| `ENDPOINT_NOT_FOUND` | API endpoint doesn't exist | Wrong URL, typo in path |
| `USER_NOT_FOUND` | User doesn't exist | Invalid user ID |
| `TOUR_EVENT_NOT_FOUND` | Tour event doesn't exist | Invalid tour event ID |

**Example Response:**
```json
{
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "User not found",
    "details": {
      "userId": "invalid-uuid-here"
    },
    "timestamp": "2024-01-15T10:30:00Z",
    "path": "/api/users/invalid-uuid-here"
  }
}
```

**Client Action:** Verify resource ID or check if resource was deleted.

#### 409 Conflict

**Common Error Codes:**

| Error Code | Description | Resolution |
|------------|-------------|------------|
| `RESOURCE_ALREADY_EXISTS` | Resource with same identifier exists | Use different identifier |
| `EMAIL_ALREADY_REGISTERED` | Email already in use | Use different email |
| `CONCURRENT_MODIFICATION` | Resource modified by another request | Refresh and retry |

**Example Response:**
```json
{
  "error": {
    "code": "EMAIL_ALREADY_REGISTERED",
    "message": "Email address is already registered",
    "details": {
      "emailAddress": "user@example.com"
    },
    "timestamp": "2024-01-15T10:30:00Z",
    "path": "/api/auth/register"
  }
}
```

**Client Action:** Use different values or handle existing resource.

#### 422 Unprocessable Entity

**Common Error Codes:**

| Error Code | Description | Examples |
|------------|-------------|----------|
| `BUSINESS_RULE_VIOLATION` | Business logic constraint violated | Registration limit exceeded |
| `INVALID_CREDENTIALS` | Login credentials are incorrect | Wrong password |
| `REGISTRATION_CONFLICT` | Cannot register due to conflict | Already registered for overlapping tour |
| `CAPACITY_EXCEEDED` | Tour capacity limit reached | No remaining spots |

**Example Response:**
```json
{
  "error": {
    "code": "REGISTRATION_CONFLICT",
    "message": "Cannot register for overlapping tour events",
    "details": {
      "conflictingTourId": "existing-tour-uuid",
      "conflictingDates": {
        "start": "2024-06-15",
        "end": "2024-06-25"
      }
    },
    "timestamp": "2024-01-15T10:30:00Z",
    "path": "/api/tour-events/new-tour-uuid/register"
  }
}
```

**Client Action:** Resolve business rule conflict before retrying.

#### 429 Too Many Requests

**Error Codes:**

| Error Code | Description | Action |
|------------|-------------|--------|
| `RATE_LIMIT_EXCEEDED` | Too many requests in time window | Wait and retry |
| `LOGIN_ATTEMPTS_EXCEEDED` | Too many failed login attempts | Wait before retrying |

**Example Response:**
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded",
    "details": {
      "limit": 100,
      "window": "3600",
      "retryAfter": 1800
    },
    "timestamp": "2024-01-15T10:30:00Z",
    "path": "/api/users"
  }
}
```

**Client Action:** Implement exponential backoff and retry after specified time.

### 5xx Server Error Codes

#### 500 Internal Server Error

**Common Error Codes:**

| Error Code | Description | Client Action |
|------------|-------------|---------------|
| `INTERNAL_SERVER_ERROR` | Unexpected server error | Retry with backoff |
| `DATABASE_ERROR` | Database operation failed | Retry later |
| `EXTERNAL_SERVICE_ERROR` | External service failure | Retry or use fallback |

**Example Response:**
```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An unexpected error occurred",
    "details": {
      "requestId": "req-12345-67890"
    },
    "timestamp": "2024-01-15T10:30:00Z",
    "path": "/api/users"
  }
}
```

**Client Action:** Retry with exponential backoff, report if persistent.

#### 502 Bad Gateway

**Error Codes:**

| Error Code | Description | Cause |
|------------|-------------|-------|
| `BAD_GATEWAY` | Gateway received invalid response | Upstream service issue |
| `SERVICE_UNAVAILABLE` | Dependent service unavailable | External service down |

**Client Action:** Retry with backoff, check service status.

#### 503 Service Unavailable

**Error Codes:**

| Error Code | Description | Reason |
|------------|-------------|--------|
| `SERVICE_UNAVAILABLE` | Service temporarily unavailable | Maintenance or overload |
| `MAINTENANCE_MODE` | System under maintenance | Scheduled maintenance |

**Example Response:**
```json
{
  "error": {
    "code": "MAINTENANCE_MODE",
    "message": "System is under maintenance",
    "details": {
      "estimatedDuration": "30 minutes",
      "maintenanceEnd": "2024-01-15T11:00:00Z"
    },
    "timestamp": "2024-01-15T10:30:00Z",
    "path": "/api/users"
  }
}
```

**Client Action:** Wait for maintenance to complete, show maintenance message.

## Error Handling Implementation

### Comprehensive Error Handler

```javascript
class ApiErrorHandler {
  static handle(error, context = {}) {
    const errorInfo = this.parseError(error);
    
    // Log error for debugging
    this.logError(errorInfo, context);
    
    // Handle based on error type
    switch (errorInfo.type) {
      case 'validation':
        return this.handleValidationError(errorInfo);
      case 'authentication':
        return this.handleAuthError(errorInfo);
      case 'authorization':
        return this.handleAuthzError(errorInfo);
      case 'business':
        return this.handleBusinessError(errorInfo);
      case 'server':
        return this.handleServerError(errorInfo);
      case 'network':
        return this.handleNetworkError(errorInfo);
      default:
        return this.handleUnknownError(errorInfo);
    }
  }
  
  static parseError(error) {
    if (error.response) {
      // HTTP error response
      const { status, data } = error.response;
      const errorData = data.error || {};
      
      return {
        type: this.categorizeHttpError(status, errorData.code),
        status,
        code: errorData.code,
        message: errorData.message,
        details: errorData.details,
        timestamp: errorData.timestamp,
        path: errorData.path,
        raw: error
      };
    } else if (error.request) {
      // Network error
      return {
        type: 'network',
        message: 'Network error occurred',
        details: { request: error.request },
        raw: error
      };
    } else {
      // Other error
      return {
        type: 'unknown',
        message: error.message || 'Unknown error occurred',
        raw: error
      };
    }
  }
  
  static categorizeHttpError(status, code) {
    if (status === 400) return 'validation';
    if (status === 401) return 'authentication';
    if (status === 403) return 'authorization';
    if (status === 404) return 'not_found';
    if (status === 409) return 'conflict';
    if (status === 422) return 'business';
    if (status === 429) return 'rate_limit';
    if (status >= 500) return 'server';
    return 'unknown';
  }
  
  static handleValidationError(errorInfo) {
    const userMessage = this.formatValidationMessage(errorInfo.details);
    
    return {
      ...errorInfo,
      userMessage,
      retryable: false,
      action: 'fix_input'
    };
  }
  
  static handleAuthError(errorInfo) {
    let action = 'login';
    let userMessage = 'Please log in to continue';
    
    if (errorInfo.code === 'TOKEN_EXPIRED') {
      action = 'refresh_token';
      userMessage = 'Your session has expired';
    }
    
    return {
      ...errorInfo,
      userMessage,
      retryable: false,
      action
    };
  }
  
  static handleBusinessError(errorInfo) {
    const userMessage = this.formatBusinessErrorMessage(errorInfo);
    
    return {
      ...errorInfo,
      userMessage,
      retryable: false,
      action: 'review_requirements'
    };
  }
  
  static handleServerError(errorInfo) {
    return {
      ...errorInfo,
      userMessage: 'A server error occurred. Please try again later.',
      retryable: true,
      retryDelay: this.calculateRetryDelay(errorInfo.status),
      action: 'retry'
    };
  }
  
  static formatValidationMessage(details) {
    if (!details || typeof details !== 'object') {
      return 'Please check your input and try again';
    }
    
    const messages = Object.entries(details).map(([field, message]) => {
      const fieldName = field.replace(/([A-Z])/g, ' $1').toLowerCase();
      return `${fieldName}: ${message}`;
    });
    
    return messages.join(', ');
  }
  
  static formatBusinessErrorMessage(errorInfo) {
    const messageMap = {
      'REGISTRATION_CONFLICT': 'You are already registered for a tour during this period',
      'CAPACITY_EXCEEDED': 'This tour is fully booked',
      'INVALID_CREDENTIALS': 'Invalid email or password',
      'EMAIL_ALREADY_REGISTERED': 'This email address is already registered'
    };
    
    return messageMap[errorInfo.code] || errorInfo.message || 'Business rule violation';
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
  
  static logError(errorInfo, context) {
    const logData = {
      ...errorInfo,
      context,
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date().toISOString()
    };
    
    if (errorInfo.type === 'server' || errorInfo.status >= 500) {
      console.error('Server Error:', logData);
    } else {
      console.warn('Client Error:', logData);
    }
    
    // Send to error tracking service
    this.sendToErrorTracking(logData);
  }
  
  static sendToErrorTracking(errorData) {
    // Implementation depends on your error tracking service
    // Examples: Sentry, LogRocket, Bugsnag, etc.
    
    try {
      // Example with fetch to custom endpoint
      fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorData)
      }).catch(err => {
        console.warn('Failed to send error to tracking service:', err);
      });
    } catch (error) {
      console.warn('Error tracking failed:', error);
    }
  }
}
```

### Error-Specific Handlers

#### Validation Error Handler

```javascript
const handleValidationErrors = (errors, formElement) => {
  // Clear previous errors
  formElement.querySelectorAll('.error-message').forEach(el => el.remove());
  
  // Display field-specific errors
  Object.entries(errors).forEach(([fieldName, message]) => {
    const field = formElement.querySelector(`[name="${fieldName}"]`);
    if (field) {
      const errorElement = document.createElement('div');
      errorElement.className = 'error-message';
      errorElement.textContent = message;
      
      field.classList.add('error');
      field.parentNode.appendChild(errorElement);
    }
  });
  
  // Focus first error field
  const firstErrorField = formElement.querySelector('.error');
  if (firstErrorField) {
    firstErrorField.focus();
  }
};
```

#### Authentication Error Handler

```javascript
const handleAuthenticationError = async (errorInfo) => {
  switch (errorInfo.code) {
    case 'TOKEN_EXPIRED':
      try {
        await refreshAccessToken();
        // Retry original request
        return { retry: true };
      } catch (refreshError) {
        // Refresh failed, redirect to login
        redirectToLogin('session_expired');
        return { retry: false };
      }
      
    case 'INVALID_TOKEN':
    case 'TOKEN_REVOKED':
      // Clear invalid tokens and redirect
      clearAuthTokens();
      redirectToLogin('invalid_session');
      return { retry: false };
      
    case 'AUTHENTICATION_REQUIRED':
      redirectToLogin('login_required');
      return { retry: false };
      
    default:
      showErrorMessage('Authentication error. Please log in again.');
      redirectToLogin('auth_error');
      return { retry: false };
  }
};
```

#### Business Rule Error Handler

```javascript
const handleBusinessRuleError = (errorInfo) => {
  const handlers = {
    'REGISTRATION_CONFLICT': (details) => {
      showModal({
        title: 'Registration Conflict',
        message: 'You are already registered for a tour during this period.',
        details: `Conflicting tour: ${details.conflictingTourId}`,
        actions: [
          { label: 'View Existing Registration', action: () => viewTour(details.conflictingTourId) },
          { label: 'Cancel', action: () => closeModal() }
        ]
      });
    },
    
    'CAPACITY_EXCEEDED': (details) => {
      showModal({
        title: 'Tour Full',
        message: 'This tour is fully booked.',
        actions: [
          { label: 'Join Waitlist', action: () => joinWaitlist(details.tourId) },
          { label: 'Browse Other Tours', action: () => browseTours() },
          { label: 'Close', action: () => closeModal() }
        ]
      });
    },
    
    'EMAIL_ALREADY_REGISTERED': (details) => {
      showModal({
        title: 'Email Already Registered',
        message: 'This email address is already registered.',
        actions: [
          { label: 'Sign In Instead', action: () => redirectToLogin() },
          { label: 'Reset Password', action: () => resetPassword(details.emailAddress) },
          { label: 'Use Different Email', action: () => closeModal() }
        ]
      });
    }
  };
  
  const handler = handlers[errorInfo.code];
  if (handler) {
    handler(errorInfo.details);
  } else {
    showErrorMessage(errorInfo.userMessage || 'Business rule violation');
  }
};
```

## Error Testing

### Unit Tests for Error Handling

```javascript
describe('ApiErrorHandler', () => {
  test('should handle validation errors correctly', () => {
    const mockError = {
      response: {
        status: 400,
        data: {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: {
              emailAddress: 'Invalid email format',
              phoneNumber: 'Phone number required'
            }
          }
        }
      }
    };
    
    const result = ApiErrorHandler.handle(mockError);
    
    expect(result.type).toBe('validation');
    expect(result.retryable).toBe(false);
    expect(result.userMessage).toContain('email address');
    expect(result.userMessage).toContain('phone number');
  });
  
  test('should handle authentication errors with retry logic', async () => {
    const mockError = {
      response: {
        status: 401,
        data: {
          error: {
            code: 'TOKEN_EXPIRED',
            message: 'Token expired'
          }
        }
      }
    };
    
    const result = ApiErrorHandler.handle(mockError);
    
    expect(result.type).toBe('authentication');
    expect(result.action).toBe('refresh_token');
  });
  
  test('should calculate appropriate retry delays', () => {
    expect(ApiErrorHandler.calculateRetryDelay(429)).toBe(60000);
    expect(ApiErrorHandler.calculateRetryDelay(502)).toBe(30000);
    expect(ApiErrorHandler.calculateRetryDelay(500)).toBe(5000);
  });
});
```

## Error Prevention Best Practices

### 1. Input Validation

```javascript
// Client-side validation before API calls
const validateUserInput = (userData) => {
  const errors = {};
  
  if (!userData.emailAddress || !isValidEmail(userData.emailAddress)) {
    errors.emailAddress = 'Valid email address is required';
  }
  
  if (!userData.password || userData.password.length < 8) {
    errors.password = 'Password must be at least 8 characters';
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};
```

### 2. Defensive Programming

```javascript
// Always check for required data before making requests
const createUser = async (userData) => {
  if (!userData) {
    throw new Error('User data is required');
  }
  
  const validation = validateUserInput(userData);
  if (!validation.isValid) {
    throw new ValidationError(validation.errors);
  }
  
  try {
    const response = await apiClient.post('/api/users', userData);
    return response.data;
  } catch (error) {
    const handledError = ApiErrorHandler.handle(error, { operation: 'createUser' });
    throw handledError;
  }
};
```

### 3. Error Boundaries

```javascript
// React Error Boundary for catching unexpected errors
class ApiErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error, errorInfo) {
    ApiErrorHandler.logError({
      type: 'boundary',
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack
    });
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Something went wrong</h2>
          <p>We're sorry, but something unexpected happened.</p>
          <button onClick={() => window.location.reload()}>
            Refresh Page
          </button>
        </div>
      );
    }
    
    return this.props.children;
  }
}
```

This comprehensive error reference should help you handle all error scenarios effectively in your Tourist Hub API integration.