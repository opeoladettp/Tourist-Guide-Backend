import { Router, Request, Response } from 'express';
import { swaggerSpec } from '../config/swagger';

const router = Router();

/**
 * @swagger
 * /api/docs:
 *   get:
 *     tags:
 *       - Documentation
 *     summary: API documentation overview
 *     description: Get information about available API documentation endpoints
 *     responses:
 *       200:
 *         description: Documentation information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 endpoints:
 *                   type: object
 *                   properties:
 *                     interactive:
 *                       type: string
 *                       description: Interactive Swagger UI documentation
 *                     openapi_json:
 *                       type: string
 *                       description: OpenAPI specification in JSON format
 *                     openapi_yaml:
 *                       type: string
 *                       description: OpenAPI specification in YAML format
 *                     examples:
 *                       type: string
 *                       description: API usage examples and integration guides
 *                 version:
 *                   type: string
 *                 title:
 *                   type: string
 */
router.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    message: 'Tourist Hub API Documentation',
    endpoints: {
      interactive: `${req.protocol}://${req.get('host')}/api-docs`,
      openapi_json: `${req.protocol}://${req.get('host')}/api-docs/swagger.json`,
      openapi_yaml: `${req.protocol}://${req.get('host')}/api-docs/swagger.yaml`,
      examples: `${req.protocol}://${req.get('host')}/api/docs/examples`,
      integration_guide: `${req.protocol}://${req.get('host')}/api/docs/integration`
    },
    version: (swaggerSpec as any).info?.version || '1.0.0',
    title: (swaggerSpec as any).info?.title || 'Tourist Hub API',
    timestamp: new Date().toISOString()
  });
});

/**
 * @swagger
 * /api/docs/examples:
 *   get:
 *     tags:
 *       - Documentation
 *     summary: API usage examples
 *     description: Get comprehensive examples of API usage for different scenarios
 *     responses:
 *       200:
 *         description: API examples retrieved successfully
 */
router.get('/examples', (req: Request, res: Response) => {
  const examples = {
    authentication: {
      description: 'Authentication flow examples',
      examples: {
        login: {
          description: 'User login example',
          request: {
            method: 'POST',
            url: '/api/auth/login',
            headers: {
              'Content-Type': 'application/json'
            },
            body: {
              email: 'user@example.com',
              password: 'securePassword123'
            }
          },
          response: {
            status: 200,
            body: {
              message: 'Authentication successful',
              data: {
                user: {
                  userId: '123e4567-e89b-12d3-a456-426614174000',
                  firstName: 'John',
                  lastName: 'Doe',
                  emailAddress: 'user@example.com',
                  userType: 'Tourist'
                },
                tokens: {
                  accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                  refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                  expiresIn: '15m'
                }
              }
            }
          }
        },
        authenticated_request: {
          description: 'Making authenticated requests',
          request: {
            method: 'GET',
            url: '/api/auth/me',
            headers: {
              'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
              'Content-Type': 'application/json'
            }
          }
        }
      }
    },
    user_management: {
      description: 'User management examples for different roles',
      examples: {
        system_admin_create_user: {
          description: 'SystemAdmin creating a new ProviderAdmin user',
          request: {
            method: 'POST',
            url: '/api/users',
            headers: {
              'Authorization': 'Bearer <system_admin_token>',
              'Content-Type': 'application/json'
            },
            body: {
              firstName: 'Jane',
              lastName: 'Smith',
              emailAddress: 'jane.smith@provider.com',
              phoneNumber: '+1234567890',
              country: 'United States',
              password: 'securePassword123',
              userType: 'ProviderAdmin',
              providerId: '456e7890-e89b-12d3-a456-426614174001'
            }
          }
        },
        tourist_registration: {
          description: 'Tourist self-registration',
          request: {
            method: 'POST',
            url: '/api/auth/register',
            headers: {
              'Content-Type': 'application/json'
            },
            body: {
              firstName: 'Alice',
              lastName: 'Johnson',
              emailAddress: 'alice.johnson@email.com',
              phoneNumber: '+1987654321',
              country: 'Canada',
              password: 'mySecurePassword456',
              passportNumber: 'A12345678',
              dateOfBirth: '1990-05-15',
              gender: 'Female'
            }
          }
        }
      }
    },
    tour_management: {
      description: 'Tour event management examples',
      examples: {
        create_tour_event: {
          description: 'ProviderAdmin creating a new tour event',
          request: {
            method: 'POST',
            url: '/api/tour-events',
            headers: {
              'Authorization': 'Bearer <provider_admin_token>',
              'Content-Type': 'application/json'
            },
            body: {
              templateId: '789e0123-e89b-12d3-a456-426614174002',
              customTourName: 'Summer Adventure Tour 2024',
              startDate: '2024-07-01',
              endDate: '2024-07-10',
              packageType: 'Premium',
              place1Hotel: 'Grand Hotel Downtown',
              place2Hotel: 'Mountain View Resort',
              numberOfAllowedTourists: 25
            }
          }
        },
        tourist_registration: {
          description: 'Tourist registering for a tour event',
          request: {
            method: 'POST',
            url: '/api/tour-events/789e0123-e89b-12d3-a456-426614174002/register',
            headers: {
              'Authorization': 'Bearer <tourist_token>',
              'Content-Type': 'application/json'
            }
          }
        }
      }
    },
    error_handling: {
      description: 'Common error response examples',
      examples: {
        validation_error: {
          status: 400,
          body: {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request data',
              details: ['Email is required', 'Password must be at least 8 characters'],
              timestamp: '2024-01-01T12:00:00.000Z',
              path: '/api/auth/login'
            }
          }
        },
        authentication_error: {
          status: 401,
          body: {
            error: {
              code: 'AUTHENTICATION_FAILED',
              message: 'Invalid credentials',
              timestamp: '2024-01-01T12:00:00.000Z',
              path: '/api/auth/login'
            }
          }
        },
        authorization_error: {
          status: 403,
          body: {
            error: {
              code: 'INSUFFICIENT_PERMISSIONS',
              message: 'You do not have permission to access this resource',
              timestamp: '2024-01-01T12:00:00.000Z',
              path: '/api/users'
            }
          }
        }
      }
    }
  };

  res.status(200).json({
    message: 'Tourist Hub API Usage Examples',
    examples,
    timestamp: new Date().toISOString()
  });
});

/**
 * @swagger
 * /api/docs/integration:
 *   get:
 *     tags:
 *       - Documentation
 *     summary: Integration guide
 *     description: Get comprehensive integration guide for different client types
 *     responses:
 *       200:
 *         description: Integration guide retrieved successfully
 */
router.get('/integration', (req: Request, res: Response) => {
  const integrationGuide = {
    overview: {
      description: 'Tourist Hub API Integration Guide',
      base_url: process.env.API_BASE_URL || 'http://localhost:3000',
      version: '1.0.0',
      authentication: 'JWT Bearer Token'
    },
    getting_started: {
      steps: [
        {
          step: 1,
          title: 'Register or Login',
          description: 'Obtain authentication tokens by registering a new account or logging in',
          endpoints: ['/api/auth/register', '/api/auth/login']
        },
        {
          step: 2,
          title: 'Include Authorization Header',
          description: 'Include the access token in the Authorization header for all protected endpoints',
          format: 'Authorization: Bearer <your-access-token>'
        },
        {
          step: 3,
          title: 'Handle Token Refresh',
          description: 'Refresh your access token when it expires using the refresh token',
          endpoint: '/api/auth/refresh'
        },
        {
          step: 4,
          title: 'Make API Calls',
          description: 'Use the appropriate endpoints based on your user role and requirements'
        }
      ]
    },
    client_libraries: {
      javascript: {
        description: 'JavaScript/Node.js integration example',
        example: `
// Install axios for HTTP requests
// npm install axios

const axios = require('axios');

class TouristHubClient {
  constructor(baseURL = 'http://localhost:3000') {
    this.baseURL = baseURL;
    this.accessToken = null;
    this.refreshToken = null;
  }

  async login(email, password) {
    try {
      const response = await axios.post(\`\${this.baseURL}/api/auth/login\`, {
        email,
        password
      });
      
      this.accessToken = response.data.data.tokens.accessToken;
      this.refreshToken = response.data.data.tokens.refreshToken;
      
      return response.data;
    } catch (error) {
      throw new Error(\`Login failed: \${error.response?.data?.error?.message}\`);
    }
  }

  async makeAuthenticatedRequest(method, endpoint, data = null) {
    try {
      const config = {
        method,
        url: \`\${this.baseURL}\${endpoint}\`,
        headers: {
          'Authorization': \`Bearer \${this.accessToken}\`,
          'Content-Type': 'application/json'
        }
      };

      if (data) {
        config.data = data;
      }

      const response = await axios(config);
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        // Try to refresh token
        await this.refreshAccessToken();
        // Retry the request
        return this.makeAuthenticatedRequest(method, endpoint, data);
      }
      throw error;
    }
  }

  async refreshAccessToken() {
    const response = await axios.post(\`\${this.baseURL}/api/auth/refresh\`, {
      refreshToken: this.refreshToken
    });
    
    this.accessToken = response.data.data.tokens.accessToken;
    this.refreshToken = response.data.data.tokens.refreshToken;
  }
}

// Usage example
const client = new TouristHubClient();
await client.login('user@example.com', 'password');
const userInfo = await client.makeAuthenticatedRequest('GET', '/api/auth/me');
        `
      },
      python: {
        description: 'Python integration example',
        example: `
import requests
import json

class TouristHubClient:
    def __init__(self, base_url='http://localhost:3000'):
        self.base_url = base_url
        self.access_token = None
        self.refresh_token = None

    def login(self, email, password):
        response = requests.post(f'{self.base_url}/api/auth/login', json={
            'email': email,
            'password': password
        })
        
        if response.status_code == 200:
            data = response.json()
            self.access_token = data['data']['tokens']['accessToken']
            self.refresh_token = data['data']['tokens']['refreshToken']
            return data
        else:
            raise Exception(f"Login failed: {response.json()['error']['message']}")

    def make_authenticated_request(self, method, endpoint, data=None):
        headers = {
            'Authorization': f'Bearer {self.access_token}',
            'Content-Type': 'application/json'
        }
        
        response = requests.request(
            method, 
            f'{self.base_url}{endpoint}', 
            headers=headers, 
            json=data
        )
        
        if response.status_code == 401:
            self.refresh_access_token()
            # Retry the request
            return self.make_authenticated_request(method, endpoint, data)
        
        return response.json()

    def refresh_access_token(self):
        response = requests.post(f'{self.base_url}/api/auth/refresh', json={
            'refreshToken': self.refresh_token
        })
        
        data = response.json()
        self.access_token = data['data']['tokens']['accessToken']
        self.refresh_token = data['data']['tokens']['refreshToken']

# Usage example
client = TouristHubClient()
client.login('user@example.com', 'password')
user_info = client.make_authenticated_request('GET', '/api/auth/me')
        `
      }
    },
    common_workflows: {
      tourist_workflow: {
        description: 'Typical workflow for a tourist user',
        steps: [
          'Register account via /api/auth/register',
          'Upload required documents via /api/documents',
          'Browse available tour events via /api/tour-events',
          'Register for a tour event via /api/tour-events/{id}/register',
          'View tour schedule via /api/tour-events/{id}/schedule',
          'Download tour calendar and forms'
        ]
      },
      provider_admin_workflow: {
        description: 'Typical workflow for a provider administrator',
        steps: [
          'Login via /api/auth/login',
          'Create tour events based on templates via /api/tour-events',
          'Manage daily schedules via /api/tour-events/{id}/activities',
          'Review tourist registrations via /api/tour-events/{id}/registrations',
          'Approve/reject registrations',
          'Upload documents for tourists via /api/documents'
        ]
      }
    },
    troubleshooting: {
      common_issues: [
        {
          issue: 'Authentication Failed',
          cause: 'Invalid credentials or inactive account',
          solution: 'Verify email/password combination and account status'
        },
        {
          issue: 'Token Expired',
          cause: 'Access token has expired (15 minute lifetime)',
          solution: 'Use refresh token to obtain new access token via /api/auth/refresh'
        },
        {
          issue: 'Insufficient Permissions',
          cause: 'User role does not have access to requested resource',
          solution: 'Check user role and ensure proper authorization for the endpoint'
        },
        {
          issue: 'Validation Error',
          cause: 'Request data does not meet validation requirements',
          solution: 'Review API documentation for required fields and formats'
        },
        {
          issue: 'Data Isolation Violation',
          cause: 'Attempting to access data outside of user\'s provider scope',
          solution: 'Ensure requests only target resources within user\'s provider'
        }
      ]
    }
  };

  res.status(200).json({
    message: 'Tourist Hub API Integration Guide',
    guide: integrationGuide,
    timestamp: new Date().toISOString()
  });
});

export default router;