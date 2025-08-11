import Joi from 'joi';

// Email validation schema
const emailSchema = Joi.string()
  .email()
  .required()
  .messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email address is required'
  });

// Phone number validation schema
const phoneSchema = Joi.string()
  .pattern(/^\+?[\d\s\-\(\)]+$/)
  .min(10)
  .max(20)
  .required()
  .messages({
    'string.pattern.base': 'Please provide a valid phone number',
    'string.min': 'Phone number must be at least 10 characters',
    'string.max': 'Phone number cannot exceed 20 characters',
    'any.required': 'Phone number is required'
  });

// Create provider validation schema
export const createProviderSchema = Joi.object({
  companyName: Joi.string()
    .trim()
    .min(1)
    .max(200)
    .required()
    .messages({
      'string.min': 'Company name is required',
      'string.max': 'Company name cannot exceed 200 characters',
      'any.required': 'Company name is required'
    }),
    
  country: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .required()
    .messages({
      'string.min': 'Country must be at least 2 characters',
      'string.max': 'Country cannot exceed 100 characters',
      'any.required': 'Country is required'
    }),
    
  addressLine1: Joi.string()
    .trim()
    .min(1)
    .max(200)
    .required()
    .messages({
      'string.min': 'Address line 1 is required',
      'string.max': 'Address line 1 cannot exceed 200 characters',
      'any.required': 'Address line 1 is required'
    }),
    
  addressLine2: Joi.string()
    .trim()
    .max(200)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Address line 2 cannot exceed 200 characters'
    }),
    
  city: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .required()
    .messages({
      'string.min': 'City is required',
      'string.max': 'City cannot exceed 100 characters',
      'any.required': 'City is required'
    }),
    
  stateRegion: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .required()
    .messages({
      'string.min': 'State/Region is required',
      'string.max': 'State/Region cannot exceed 100 characters',
      'any.required': 'State/Region is required'
    }),
    
  companyDescription: Joi.string()
    .trim()
    .min(1)
    .max(1000)
    .required()
    .messages({
      'string.min': 'Company description is required',
      'string.max': 'Company description cannot exceed 1000 characters',
      'any.required': 'Company description is required'
    }),
    
  phoneNumber: phoneSchema,
  
  emailAddress: emailSchema,
  
  corpIdTaxId: Joi.string()
    .trim()
    .min(5)
    .max(50)
    .required()
    .messages({
      'string.min': 'Corporate ID/Tax ID must be at least 5 characters',
      'string.max': 'Corporate ID/Tax ID cannot exceed 50 characters',
      'any.required': 'Corporate ID/Tax ID is required'
    }),
    
  isIsolatedInstance: Joi.boolean()
    .optional()
    .default(true)
    .messages({
      'boolean.base': 'Isolated instance must be a boolean value'
    })
});

// Update provider validation schema
export const updateProviderSchema = Joi.object({
  companyName: Joi.string()
    .trim()
    .min(1)
    .max(200)
    .optional()
    .messages({
      'string.min': 'Company name cannot be empty',
      'string.max': 'Company name cannot exceed 200 characters'
    }),
    
  country: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .optional()
    .messages({
      'string.min': 'Country must be at least 2 characters',
      'string.max': 'Country cannot exceed 100 characters'
    }),
    
  addressLine1: Joi.string()
    .trim()
    .min(1)
    .max(200)
    .optional()
    .messages({
      'string.min': 'Address line 1 cannot be empty',
      'string.max': 'Address line 1 cannot exceed 200 characters'
    }),
    
  addressLine2: Joi.string()
    .trim()
    .max(200)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Address line 2 cannot exceed 200 characters'
    }),
    
  city: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .optional()
    .messages({
      'string.min': 'City cannot be empty',
      'string.max': 'City cannot exceed 100 characters'
    }),
    
  stateRegion: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .optional()
    .messages({
      'string.min': 'State/Region cannot be empty',
      'string.max': 'State/Region cannot exceed 100 characters'
    }),
    
  companyDescription: Joi.string()
    .trim()
    .min(1)
    .max(1000)
    .optional()
    .messages({
      'string.min': 'Company description cannot be empty',
      'string.max': 'Company description cannot exceed 1000 characters'
    }),
    
  phoneNumber: Joi.string()
    .pattern(/^\+?[\d\s\-\(\)]+$/)
    .min(10)
    .max(20)
    .optional()
    .messages({
      'string.pattern.base': 'Please provide a valid phone number',
      'string.min': 'Phone number must be at least 10 characters',
      'string.max': 'Phone number cannot exceed 20 characters'
    }),
    
  emailAddress: Joi.string()
    .email()
    .optional()
    .messages({
      'string.email': 'Please provide a valid email address'
    }),
    
  isIsolatedInstance: Joi.boolean()
    .optional()
    .messages({
      'boolean.base': 'Isolated instance must be a boolean value'
    })
});

// Provider ID validation schema
export const providerIdSchema = Joi.string()
  .trim()
  .required()
  .messages({
    'any.required': 'Provider ID is required',
    'string.empty': 'Provider ID cannot be empty'
  });

// Pagination validation schema for provider-scoped queries
export const providerPaginationSchema = Joi.object({
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .optional()
    .default(50)
    .messages({
      'number.base': 'Limit must be a number',
      'number.integer': 'Limit must be an integer',
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 100'
    }),
    
  offset: Joi.number()
    .integer()
    .min(0)
    .optional()
    .default(0)
    .messages({
      'number.base': 'Offset must be a number',
      'number.integer': 'Offset must be an integer',
      'number.min': 'Offset cannot be negative'
    })
});

// Provider isolation validation schema
export const providerIsolationSchema = Joi.object({
  providerId: providerIdSchema,
  isIsolatedInstance: Joi.boolean()
    .required()
    .messages({
      'boolean.base': 'Isolated instance must be a boolean value',
      'any.required': 'Isolated instance setting is required'
    })
});

// Provider access validation schema
export const providerAccessSchema = Joi.object({
  resourceProviderId: providerIdSchema,
  requestingUserProviderId: Joi.string()
    .trim()
    .optional()
    .messages({
      'string.empty': 'Requesting user provider ID cannot be empty'
    }),
  operation: Joi.string()
    .trim()
    .min(1)
    .max(50)
    .optional()
    .default('access')
    .messages({
      'string.min': 'Operation description is required',
      'string.max': 'Operation description cannot exceed 50 characters'
    })
});

// Batch provider isolation validation schema
export const batchProviderIsolationSchema = Joi.object({
  resources: Joi.array()
    .items(
      Joi.object({
        providerId: providerIdSchema
      }).unknown(true) // Allow additional properties
    )
    .min(0)
    .max(100)
    .required()
    .messages({
      'array.min': 'Resources array cannot be negative',
      'array.max': 'Cannot process more than 100 resources at once',
      'any.required': 'Resources array is required'
    }),
  requestingUserProviderId: Joi.string()
    .trim()
    .optional()
    .messages({
      'string.empty': 'Requesting user provider ID cannot be empty'
    })
});

// Provider-scoped query validation schema
export const providerScopedQuerySchema = Joi.object({
  baseQuery: Joi.object()
    .required()
    .messages({
      'any.required': 'Base query is required'
    }),
  requestingUserProviderId: Joi.string()
    .trim()
    .when('userType', {
      is: Joi.string().valid('PROVIDER_ADMIN', 'TOURIST'),
      then: Joi.required(),
      otherwise: Joi.optional()
    })
    .messages({
      'string.empty': 'Provider ID cannot be empty',
      'any.required': 'Provider ID is required for provider-scoped queries'
    }),
  userType: Joi.string()
    .valid('SYSTEM_ADMIN', 'PROVIDER_ADMIN', 'TOURIST')
    .required()
    .messages({
      'any.only': 'User type must be SYSTEM_ADMIN, PROVIDER_ADMIN, or TOURIST',
      'any.required': 'User type is required'
    })
});

// Audit trail validation schema
export const auditTrailSchema = Joi.object({
  operation: Joi.string()
    .trim()
    .min(1)
    .max(50)
    .required()
    .messages({
      'string.min': 'Operation is required',
      'string.max': 'Operation cannot exceed 50 characters',
      'any.required': 'Operation is required'
    }),
  resourceType: Joi.string()
    .trim()
    .min(1)
    .max(50)
    .required()
    .messages({
      'string.min': 'Resource type is required',
      'string.max': 'Resource type cannot exceed 50 characters',
      'any.required': 'Resource type is required'
    }),
  resourceId: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .required()
    .messages({
      'string.min': 'Resource ID is required',
      'string.max': 'Resource ID cannot exceed 100 characters',
      'any.required': 'Resource ID is required'
    }),
  requestingUserId: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .required()
    .messages({
      'string.min': 'Requesting user ID is required',
      'string.max': 'Requesting user ID cannot exceed 100 characters',
      'any.required': 'Requesting user ID is required'
    }),
  requestingUserProviderId: Joi.string()
    .trim()
    .optional()
    .messages({
      'string.empty': 'Requesting user provider ID cannot be empty'
    }),
  success: Joi.boolean()
    .optional()
    .default(true)
    .messages({
      'boolean.base': 'Success must be a boolean value'
    })
});