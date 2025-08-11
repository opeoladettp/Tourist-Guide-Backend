import Joi from 'joi';
import { TourEventStatus, RegistrationStatus } from '../types/custom-tour-event';

// Create custom tour event validation schema
export const createCustomTourEventSchema = Joi.object({
  templateId: Joi.string()
    .trim()
    .optional()
    .messages({
      'string.empty': 'Template ID cannot be empty'
    }),
    
  customTourName: Joi.string()
    .trim()
    .min(1)
    .max(200)
    .required()
    .messages({
      'string.min': 'Custom tour name is required',
      'string.max': 'Custom tour name cannot exceed 200 characters',
      'any.required': 'Custom tour name is required'
    }),
    
  startDate: Joi.date()
    .min('now')
    .required()
    .messages({
      'date.base': 'Start date must be a valid date',
      'date.min': 'Start date cannot be in the past',
      'any.required': 'Start date is required'
    }),
    
  endDate: Joi.date()
    .greater(Joi.ref('startDate'))
    .required()
    .messages({
      'date.base': 'End date must be a valid date',
      'date.greater': 'End date must be after start date',
      'any.required': 'End date is required'
    }),
    
  packageType: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .required()
    .messages({
      'string.min': 'Package type is required',
      'string.max': 'Package type cannot exceed 100 characters',
      'any.required': 'Package type is required'
    }),
    
  place1Hotel: Joi.string()
    .trim()
    .min(1)
    .max(200)
    .required()
    .messages({
      'string.min': 'Place 1 hotel is required',
      'string.max': 'Place 1 hotel cannot exceed 200 characters',
      'any.required': 'Place 1 hotel is required'
    }),
    
  place2Hotel: Joi.string()
    .trim()
    .min(1)
    .max(200)
    .required()
    .messages({
      'string.min': 'Place 2 hotel is required',
      'string.max': 'Place 2 hotel cannot exceed 200 characters',
      'any.required': 'Place 2 hotel is required'
    }),
    
  numberOfAllowedTourists: Joi.number()
    .integer()
    .min(1)
    .max(1000)
    .required()
    .messages({
      'number.base': 'Number of allowed tourists must be a number',
      'number.integer': 'Number of allowed tourists must be an integer',
      'number.min': 'Number of allowed tourists must be at least 1',
      'number.max': 'Number of allowed tourists cannot exceed 1000',
      'any.required': 'Number of allowed tourists is required'
    }),
    
  groupChatInfo: Joi.string()
    .trim()
    .max(500)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Group chat info cannot exceed 500 characters'
    })
});

// Update custom tour event validation schema
export const updateCustomTourEventSchema = Joi.object({
  customTourName: Joi.string()
    .trim()
    .min(1)
    .max(200)
    .optional()
    .messages({
      'string.min': 'Custom tour name cannot be empty',
      'string.max': 'Custom tour name cannot exceed 200 characters'
    }),
    
  startDate: Joi.date()
    .optional()
    .messages({
      'date.base': 'Start date must be a valid date'
    }),
    
  endDate: Joi.date()
    .when('startDate', {
      is: Joi.exist(),
      then: Joi.date().greater(Joi.ref('startDate')),
      otherwise: Joi.date()
    })
    .optional()
    .messages({
      'date.base': 'End date must be a valid date',
      'date.greater': 'End date must be after start date'
    }),
    
  packageType: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .optional()
    .messages({
      'string.min': 'Package type cannot be empty',
      'string.max': 'Package type cannot exceed 100 characters'
    }),
    
  place1Hotel: Joi.string()
    .trim()
    .min(1)
    .max(200)
    .optional()
    .messages({
      'string.min': 'Place 1 hotel cannot be empty',
      'string.max': 'Place 1 hotel cannot exceed 200 characters'
    }),
    
  place2Hotel: Joi.string()
    .trim()
    .min(1)
    .max(200)
    .optional()
    .messages({
      'string.min': 'Place 2 hotel cannot be empty',
      'string.max': 'Place 2 hotel cannot exceed 200 characters'
    }),
    
  numberOfAllowedTourists: Joi.number()
    .integer()
    .min(1)
    .max(1000)
    .optional()
    .messages({
      'number.base': 'Number of allowed tourists must be a number',
      'number.integer': 'Number of allowed tourists must be an integer',
      'number.min': 'Number of allowed tourists must be at least 1',
      'number.max': 'Number of allowed tourists cannot exceed 1000'
    }),
    
  groupChatInfo: Joi.string()
    .trim()
    .max(500)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Group chat info cannot exceed 500 characters'
    }),
    
  status: Joi.string()
    .valid(...Object.values(TourEventStatus))
    .optional()
    .messages({
      'any.only': 'Status must be one of: ' + Object.values(TourEventStatus).join(', ')
    })
});

// Tourist registration validation schema
export const touristRegistrationSchema = Joi.object({
  tourEventId: Joi.string()
    .trim()
    .required()
    .messages({
      'any.required': 'Tour event ID is required',
      'string.empty': 'Tour event ID cannot be empty'
    })
});

// Registration approval validation schema
export const registrationApprovalSchema = Joi.object({
  registrationId: Joi.string()
    .trim()
    .required()
    .messages({
      'any.required': 'Registration ID is required',
      'string.empty': 'Registration ID cannot be empty'
    }),
    
  approved: Joi.boolean()
    .required()
    .messages({
      'boolean.base': 'Approved must be a boolean value',
      'any.required': 'Approved status is required'
    }),
    
  rejectedReason: Joi.string()
    .trim()
    .max(500)
    .when('approved', {
      is: false,
      then: Joi.required(),
      otherwise: Joi.optional()
    })
    .messages({
      'string.max': 'Rejected reason cannot exceed 500 characters',
      'any.required': 'Rejected reason is required when rejecting registration'
    })
});

// Create activity validation schema
export const createActivitySchema = Joi.object({
  activityDate: Joi.date()
    .required()
    .messages({
      'date.base': 'Activity date must be a valid date',
      'any.required': 'Activity date is required'
    }),
    
  startTime: Joi.string()
    .trim()
    .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .required()
    .messages({
      'string.pattern.base': 'Start time must be in HH:MM format (24-hour)',
      'any.required': 'Start time is required'
    }),
    
  endTime: Joi.string()
    .trim()
    .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .required()
    .messages({
      'string.pattern.base': 'End time must be in HH:MM format (24-hour)',
      'any.required': 'End time is required'
    }),
    
  activityName: Joi.string()
    .trim()
    .min(1)
    .max(200)
    .required()
    .messages({
      'string.min': 'Activity name is required',
      'string.max': 'Activity name cannot exceed 200 characters',
      'any.required': 'Activity name is required'
    }),
    
  description: Joi.string()
    .trim()
    .max(1000)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Description cannot exceed 1000 characters'
    }),
    
  location: Joi.string()
    .trim()
    .max(200)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Location cannot exceed 200 characters'
    }),
    
  activityType: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .required()
    .messages({
      'string.min': 'Activity type is required',
      'string.max': 'Activity type cannot exceed 100 characters',
      'any.required': 'Activity type is required'
    }),
    
  isOptional: Joi.boolean()
    .optional()
    .default(false)
    .messages({
      'boolean.base': 'Is optional must be a boolean value'
    })
});

// Update activity validation schema
export const updateActivitySchema = Joi.object({
  activityDate: Joi.date()
    .optional()
    .messages({
      'date.base': 'Activity date must be a valid date'
    }),
    
  startTime: Joi.string()
    .trim()
    .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .optional()
    .messages({
      'string.pattern.base': 'Start time must be in HH:MM format (24-hour)'
    }),
    
  endTime: Joi.string()
    .trim()
    .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .optional()
    .messages({
      'string.pattern.base': 'End time must be in HH:MM format (24-hour)'
    }),
    
  activityName: Joi.string()
    .trim()
    .min(1)
    .max(200)
    .optional()
    .messages({
      'string.min': 'Activity name cannot be empty',
      'string.max': 'Activity name cannot exceed 200 characters'
    }),
    
  description: Joi.string()
    .trim()
    .max(1000)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Description cannot exceed 1000 characters'
    }),
    
  location: Joi.string()
    .trim()
    .max(200)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Location cannot exceed 200 characters'
    }),
    
  activityType: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .optional()
    .messages({
      'string.min': 'Activity type cannot be empty',
      'string.max': 'Activity type cannot exceed 100 characters'
    }),
    
  isOptional: Joi.boolean()
    .optional()
    .messages({
      'boolean.base': 'Is optional must be a boolean value'
    })
});

// Tour event ID validation schema
export const tourEventIdSchema = Joi.string()
  .trim()
  .required()
  .messages({
    'any.required': 'Tour event ID is required',
    'string.empty': 'Tour event ID cannot be empty'
  });

// Registration ID validation schema
export const registrationIdSchema = Joi.string()
  .trim()
  .required()
  .messages({
    'any.required': 'Registration ID is required',
    'string.empty': 'Registration ID cannot be empty'
  });

// Activity ID validation schema
export const activityIdSchema = Joi.string()
  .trim()
  .required()
  .messages({
    'any.required': 'Activity ID is required',
    'string.empty': 'Activity ID cannot be empty'
  });