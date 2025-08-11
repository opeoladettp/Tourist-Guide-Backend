import Joi from 'joi';
import { UserType, UserStatus } from '../types/user';

// Password validation schema
const passwordSchema = Joi.string()
  .min(8)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/)
  .required()
  .messages({
    'string.min': 'Password must be at least 8 characters long',
    'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    'any.required': 'Password is required'
  });

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

// Create user validation schema
export const createUserSchema = Joi.object({
  firstName: Joi.string()
    .trim()
    .min(1)
    .max(50)
    .required()
    .messages({
      'string.min': 'First name is required',
      'string.max': 'First name cannot exceed 50 characters',
      'any.required': 'First name is required'
    }),
    
  middleName: Joi.string()
    .trim()
    .max(50)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Middle name cannot exceed 50 characters'
    }),
    
  lastName: Joi.string()
    .trim()
    .min(1)
    .max(50)
    .required()
    .messages({
      'string.min': 'Last name is required',
      'string.max': 'Last name cannot exceed 50 characters',
      'any.required': 'Last name is required'
    }),
    
  emailAddress: emailSchema,
  
  phoneNumber: phoneSchema,
  
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
    
  password: passwordSchema,
  
  userType: Joi.string()
    .valid(...Object.values(UserType))
    .required()
    .messages({
      'any.only': 'User type must be one of: SYSTEM_ADMIN, PROVIDER_ADMIN, TOURIST',
      'any.required': 'User type is required'
    }),
    
  passportNumber: Joi.string()
    .trim()
    .min(6)
    .max(20)
    .optional()
    .messages({
      'string.min': 'Passport number must be at least 6 characters',
      'string.max': 'Passport number cannot exceed 20 characters'
    }),
    
  dateOfBirth: Joi.date()
    .max('now')
    .optional()
    .messages({
      'date.max': 'Date of birth cannot be in the future'
    }),
    
  gender: Joi.string()
    .trim()
    .valid('Male', 'Female', 'Other', 'Prefer not to say')
    .optional()
    .messages({
      'any.only': 'Gender must be one of: Male, Female, Other, Prefer not to say'
    }),
    
  providerId: Joi.string()
    .trim()
    .optional()
    .when('userType', {
      is: Joi.valid(UserType.PROVIDER_ADMIN, UserType.TOURIST),
      then: Joi.required(),
      otherwise: Joi.forbidden()
    })
    .messages({
      'any.required': 'Provider ID is required for Provider Admin and Tourist users',
      'any.unknown': 'Provider ID is not allowed for System Admin users'
    })
});

// Update user validation schema
export const updateUserSchema = Joi.object({
  firstName: Joi.string()
    .trim()
    .min(1)
    .max(50)
    .optional()
    .messages({
      'string.min': 'First name cannot be empty',
      'string.max': 'First name cannot exceed 50 characters'
    }),
    
  middleName: Joi.string()
    .trim()
    .max(50)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Middle name cannot exceed 50 characters'
    }),
    
  lastName: Joi.string()
    .trim()
    .min(1)
    .max(50)
    .optional()
    .messages({
      'string.min': 'Last name cannot be empty',
      'string.max': 'Last name cannot exceed 50 characters'
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
    
  country: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .optional()
    .messages({
      'string.min': 'Country must be at least 2 characters',
      'string.max': 'Country cannot exceed 100 characters'
    }),
    
  passportNumber: Joi.string()
    .trim()
    .min(6)
    .max(20)
    .optional()
    .messages({
      'string.min': 'Passport number must be at least 6 characters',
      'string.max': 'Passport number cannot exceed 20 characters'
    }),
    
  dateOfBirth: Joi.date()
    .max('now')
    .optional()
    .messages({
      'date.max': 'Date of birth cannot be in the future'
    }),
    
  gender: Joi.string()
    .trim()
    .valid('Male', 'Female', 'Other', 'Prefer not to say')
    .optional()
    .messages({
      'any.only': 'Gender must be one of: Male, Female, Other, Prefer not to say'
    }),
    
  status: Joi.string()
    .valid(...Object.values(UserStatus))
    .optional()
    .messages({
      'any.only': 'Status must be one of: ACTIVE, INACTIVE'
    })
});

// User ID validation schema
export const userIdSchema = Joi.string()
  .trim()
  .required()
  .messages({
    'any.required': 'User ID is required',
    'string.empty': 'User ID cannot be empty'
  });