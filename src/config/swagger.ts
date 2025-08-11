const swaggerJSDoc = require('swagger-jsdoc');

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Tourist Hub API',
    version: '1.0.0',
    description: `
      Tourist Hub API backend for tour management and collaboration between tourists and tour providers.
      
      ## Authentication
      
      This API uses JWT (JSON Web Token) authentication. To access protected endpoints:
      
      1. Obtain a token by calling POST /api/auth/login with valid credentials
      2. Include the token in the Authorization header: \`Bearer <your-token>\`
      3. Refresh tokens using POST /api/auth/refresh when needed
      
      ## User Roles
      
      The system supports three user roles with different access levels:
      
      - **SystemAdmin**: Full system access, can manage all users, providers, and tour templates
      - **ProviderAdmin**: Manages company-specific operations, tour events, and company users
      - **Tourist**: Manages personal profile, documents, and tour registrations
      
      ## Data Isolation
      
      Provider data is logically isolated - ProviderAdmins can only access data related to their company,
      while SystemAdmins have access to all data across providers.
    `,
    contact: {
      name: 'Tourist Hub API Support',
      email: 'support@touristhub.com'
    },
    license: {
      name: 'ISC',
      url: 'https://opensource.org/licenses/ISC'
    }
  },
  servers: [
    {
      url: process.env.API_BASE_URL || 'http://localhost:3000',
      description: 'Development server'
    },
    {
      url: 'https://api.touristhub.com',
      description: 'Production server'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token obtained from /api/auth/login'
      }
    },
    schemas: {
      // Error response schema
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                description: 'Error code identifier'
              },
              message: {
                type: 'string',
                description: 'Human-readable error message'
              },
              details: {
                type: 'object',
                description: 'Additional error details'
              },
              timestamp: {
                type: 'string',
                format: 'date-time',
                description: 'Error timestamp'
              },
              path: {
                type: 'string',
                description: 'API path where error occurred'
              }
            },
            required: ['code', 'message', 'timestamp', 'path']
          }
        }
      },
      
      // User schemas
      User: {
        type: 'object',
        properties: {
          userId: {
            type: 'string',
            format: 'uuid',
            description: 'Unique user identifier'
          },
          firstName: {
            type: 'string',
            description: 'User first name'
          },
          middleName: {
            type: 'string',
            nullable: true,
            description: 'User middle name (optional)'
          },
          lastName: {
            type: 'string',
            description: 'User last name'
          },
          emailAddress: {
            type: 'string',
            format: 'email',
            description: 'User email address'
          },
          phoneNumber: {
            type: 'string',
            description: 'User phone number'
          },
          country: {
            type: 'string',
            description: 'User country'
          },
          userType: {
            type: 'string',
            enum: ['SystemAdmin', 'ProviderAdmin', 'Tourist'],
            description: 'User role type'
          },
          status: {
            type: 'string',
            enum: ['Active', 'Inactive'],
            description: 'User account status'
          },
          passportNumber: {
            type: 'string',
            nullable: true,
            description: 'Passport number (for tourists)'
          },
          dateOfBirth: {
            type: 'string',
            format: 'date',
            nullable: true,
            description: 'Date of birth'
          },
          gender: {
            type: 'string',
            nullable: true,
            description: 'User gender'
          },
          providerId: {
            type: 'string',
            format: 'uuid',
            nullable: true,
            description: 'Associated provider ID (for ProviderAdmin and Tourist)'
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Account creation timestamp'
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Last update timestamp'
          }
        },
        required: ['userId', 'firstName', 'lastName', 'emailAddress', 'phoneNumber', 'country', 'userType', 'status']
      },
      
      CreateUserRequest: {
        type: 'object',
        properties: {
          firstName: { type: 'string' },
          middleName: { type: 'string', nullable: true },
          lastName: { type: 'string' },
          emailAddress: { type: 'string', format: 'email' },
          phoneNumber: { type: 'string' },
          country: { type: 'string' },
          password: { type: 'string', minLength: 8 },
          userType: { type: 'string', enum: ['SystemAdmin', 'ProviderAdmin', 'Tourist'] },
          passportNumber: { type: 'string', nullable: true },
          dateOfBirth: { type: 'string', format: 'date', nullable: true },
          gender: { type: 'string', nullable: true },
          providerId: { type: 'string', format: 'uuid', nullable: true }
        },
        required: ['firstName', 'lastName', 'emailAddress', 'phoneNumber', 'country', 'password', 'userType']
      },
      
      // Provider schemas
      Provider: {
        type: 'object',
        properties: {
          providerId: {
            type: 'string',
            format: 'uuid',
            description: 'Unique provider identifier'
          },
          companyName: {
            type: 'string',
            description: 'Company name'
          },
          country: {
            type: 'string',
            description: 'Company country'
          },
          addressLine1: {
            type: 'string',
            description: 'Primary address line'
          },
          addressLine2: {
            type: 'string',
            nullable: true,
            description: 'Secondary address line'
          },
          city: {
            type: 'string',
            description: 'City'
          },
          stateRegion: {
            type: 'string',
            description: 'State or region'
          },
          companyDescription: {
            type: 'string',
            description: 'Company description'
          },
          phoneNumber: {
            type: 'string',
            description: 'Company phone number'
          },
          emailAddress: {
            type: 'string',
            format: 'email',
            description: 'Company email address'
          },
          corpIdTaxId: {
            type: 'string',
            description: 'Corporate ID or Tax ID'
          },
          isIsolatedInstance: {
            type: 'boolean',
            description: 'Whether this provider has data isolation'
          },
          createdAt: {
            type: 'string',
            format: 'date-time'
          },
          updatedAt: {
            type: 'string',
            format: 'date-time'
          }
        },
        required: ['providerId', 'companyName', 'country', 'addressLine1', 'city', 'stateRegion', 'companyDescription', 'phoneNumber', 'emailAddress', 'corpIdTaxId']
      },
      
      // Authentication schemas
      LoginRequest: {
        type: 'object',
        properties: {
          emailAddress: {
            type: 'string',
            format: 'email',
            description: 'User email address'
          },
          password: {
            type: 'string',
            description: 'User password'
          }
        },
        required: ['emailAddress', 'password']
      },
      
      LoginResponse: {
        type: 'object',
        properties: {
          accessToken: {
            type: 'string',
            description: 'JWT access token'
          },
          refreshToken: {
            type: 'string',
            description: 'JWT refresh token'
          },
          user: {
            $ref: '#/components/schemas/User'
          }
        },
        required: ['accessToken', 'refreshToken', 'user']
      },
      
      RefreshTokenRequest: {
        type: 'object',
        properties: {
          refreshToken: {
            type: 'string',
            description: 'Valid refresh token'
          }
        },
        required: ['refreshToken']
      },
      
      // Tour Template schemas
      TourTemplate: {
        type: 'object',
        properties: {
          templateId: {
            type: 'string',
            format: 'uuid',
            description: 'Unique template identifier'
          },
          templateName: {
            type: 'string',
            description: 'Template name'
          },
          type: {
            type: 'string',
            description: 'Tour type'
          },
          year: {
            type: 'integer',
            description: 'Tour year'
          },
          startDate: {
            type: 'string',
            format: 'date',
            description: 'Tour start date'
          },
          endDate: {
            type: 'string',
            format: 'date',
            description: 'Tour end date'
          },
          detailedDescription: {
            type: 'string',
            description: 'Detailed tour description'
          },
          sitesToVisit: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/SiteToVisit'
            },
            description: 'List of sites to visit'
          },
          createdAt: {
            type: 'string',
            format: 'date-time'
          },
          updatedAt: {
            type: 'string',
            format: 'date-time'
          }
        },
        required: ['templateId', 'templateName', 'type', 'year', 'startDate', 'endDate', 'detailedDescription']
      },
      
      SiteToVisit: {
        type: 'object',
        properties: {
          siteId: {
            type: 'string',
            format: 'uuid'
          },
          siteName: {
            type: 'string',
            description: 'Name of the site'
          },
          siteDescription: {
            type: 'string',
            description: 'Description of the site'
          },
          visitDate: {
            type: 'string',
            format: 'date',
            description: 'Planned visit date'
          },
          duration: {
            type: 'string',
            description: 'Expected duration of visit'
          },
          location: {
            type: 'string',
            description: 'Site location'
          }
        },
        required: ['siteId', 'siteName', 'visitDate']
      },
      
      // Tour Event schemas
      CustomTourEvent: {
        type: 'object',
        properties: {
          tourEventId: {
            type: 'string',
            format: 'uuid',
            description: 'Unique tour event identifier'
          },
          providerId: {
            type: 'string',
            format: 'uuid',
            description: 'Provider who created this event'
          },
          templateId: {
            type: 'string',
            format: 'uuid',
            description: 'Base template for this event'
          },
          customTourName: {
            type: 'string',
            description: 'Custom name for this tour event'
          },
          startDate: {
            type: 'string',
            format: 'date',
            description: 'Tour start date'
          },
          endDate: {
            type: 'string',
            format: 'date',
            description: 'Tour end date'
          },
          packageType: {
            type: 'string',
            description: 'Package type (e.g., Premium, Standard, Budget)'
          },
          place1Hotel: {
            type: 'string',
            description: 'Primary hotel accommodation'
          },
          place2Hotel: {
            type: 'string',
            description: 'Secondary hotel accommodation'
          },
          numberOfAllowedTourists: {
            type: 'integer',
            minimum: 1,
            description: 'Maximum number of tourists allowed'
          },
          remainingTourists: {
            type: 'integer',
            minimum: 0,
            description: 'Number of remaining spots available'
          },
          groupChatInfo: {
            type: 'string',
            nullable: true,
            description: 'Group chat information'
          },
          status: {
            type: 'string',
            enum: ['Draft', 'Active', 'Full', 'Completed', 'Cancelled'],
            description: 'Current status of the tour event'
          },
          registeredTourists: {
            type: 'array',
            items: {
              type: 'string',
              format: 'uuid'
            },
            description: 'List of registered tourist user IDs'
          },
          createdAt: {
            type: 'string',
            format: 'date-time'
          },
          updatedAt: {
            type: 'string',
            format: 'date-time'
          }
        },
        required: ['tourEventId', 'providerId', 'templateId', 'customTourName', 'startDate', 'endDate', 'packageType', 'numberOfAllowedTourists', 'status']
      },
      
      CreateTourEventRequest: {
        type: 'object',
        properties: {
          templateId: {
            type: 'string',
            format: 'uuid',
            description: 'Base template ID'
          },
          customTourName: {
            type: 'string',
            description: 'Custom name for the tour'
          },
          startDate: {
            type: 'string',
            format: 'date',
            description: 'Tour start date'
          },
          endDate: {
            type: 'string',
            format: 'date',
            description: 'Tour end date'
          },
          packageType: {
            type: 'string',
            description: 'Package type'
          },
          place1Hotel: {
            type: 'string',
            description: 'Primary hotel'
          },
          place2Hotel: {
            type: 'string',
            description: 'Secondary hotel'
          },
          numberOfAllowedTourists: {
            type: 'integer',
            minimum: 1,
            description: 'Maximum tourists allowed'
          },
          groupChatInfo: {
            type: 'string',
            nullable: true,
            description: 'Group chat information'
          }
        },
        required: ['templateId', 'customTourName', 'startDate', 'endDate', 'packageType', 'place1Hotel', 'place2Hotel', 'numberOfAllowedTourists']
      },
      
      // Document schemas
      Document: {
        type: 'object',
        properties: {
          documentId: {
            type: 'string',
            format: 'uuid',
            description: 'Unique document identifier'
          },
          userId: {
            type: 'string',
            format: 'uuid',
            description: 'Owner of the document'
          },
          type: {
            type: 'string',
            enum: ['Passport', 'Ticket', 'TourForm', 'Other'],
            description: 'Document type'
          },
          fileName: {
            type: 'string',
            description: 'Original file name'
          },
          description: {
            type: 'string',
            nullable: true,
            description: 'Document description'
          },
          uploadedByUserId: {
            type: 'string',
            format: 'uuid',
            description: 'User who uploaded the document'
          },
          uploadDate: {
            type: 'string',
            format: 'date-time',
            description: 'Upload timestamp'
          },
          fileSize: {
            type: 'integer',
            description: 'File size in bytes'
          },
          mimeType: {
            type: 'string',
            description: 'MIME type of the file'
          },
          createdAt: {
            type: 'string',
            format: 'date-time'
          },
          updatedAt: {
            type: 'string',
            format: 'date-time'
          }
        },
        required: ['documentId', 'userId', 'type', 'fileName', 'uploadedByUserId', 'uploadDate', 'fileSize', 'mimeType']
      },
      
      // Activity schemas
      Activity: {
        type: 'object',
        properties: {
          activityId: {
            type: 'string',
            format: 'uuid',
            description: 'Unique activity identifier'
          },
          tourEventId: {
            type: 'string',
            format: 'uuid',
            description: 'Associated tour event'
          },
          activityDate: {
            type: 'string',
            format: 'date',
            description: 'Activity date (Gregorian)'
          },
          islamicDate: {
            type: 'string',
            nullable: true,
            description: 'Activity date (Islamic calendar)'
          },
          activityType: {
            type: 'string',
            description: 'Type of activity'
          },
          description: {
            type: 'string',
            description: 'Activity description'
          },
          startTime: {
            type: 'string',
            format: 'time',
            description: 'Activity start time'
          },
          endTime: {
            type: 'string',
            format: 'time',
            description: 'Activity end time'
          },
          location: {
            type: 'string',
            description: 'Activity location'
          },
          webLink: {
            type: 'string',
            format: 'uri',
            nullable: true,
            description: 'Related web link'
          },
          createdAt: {
            type: 'string',
            format: 'date-time'
          },
          updatedAt: {
            type: 'string',
            format: 'date-time'
          }
        },
        required: ['activityId', 'tourEventId', 'activityDate', 'activityType', 'description', 'startTime', 'endTime', 'location']
      }
    }
  },
  security: [
    {
      bearerAuth: []
    }
  ]
};

const options = {
  definition: swaggerDefinition,
  apis: [
    './src/routes/*.ts',
    './src/routes/**/*.ts'
  ]
};

export const swaggerSpec = swaggerJSDoc(options);
export default swaggerSpec;