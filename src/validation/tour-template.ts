import Joi from 'joi';
import { SiteCategory } from '../types/tour-template';

// Site to visit validation schema
const siteToVisitSchema = Joi.object({
  siteName: Joi.string()
    .trim()
    .min(1)
    .max(200)
    .required()
    .messages({
      'string.min': 'Site name is required',
      'string.max': 'Site name cannot exceed 200 characters',
      'any.required': 'Site name is required'
    }),
    
  description: Joi.string()
    .trim()
    .max(1000)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Site description cannot exceed 1000 characters'
    }),
    
  location: Joi.string()
    .trim()
    .min(1)
    .max(200)
    .required()
    .messages({
      'string.min': 'Location is required',
      'string.max': 'Location cannot exceed 200 characters',
      'any.required': 'Location is required'
    }),
    
  visitDuration: Joi.string()
    .trim()
    .min(1)
    .max(50)
    .required()
    .messages({
      'string.min': 'Visit duration is required',
      'string.max': 'Visit duration cannot exceed 50 characters',
      'any.required': 'Visit duration is required'
    }),
    
  estimatedCost: Joi.number()
    .min(0)
    .max(999999.99)
    .optional()
    .messages({
      'number.min': 'Estimated cost cannot be negative',
      'number.max': 'Estimated cost cannot exceed 999,999.99'
    }),
    
  category: Joi.string()
    .valid(...Object.values(SiteCategory))
    .required()
    .messages({
      'any.only': 'Category must be one of: ' + Object.values(SiteCategory).join(', '),
      'any.required': 'Category is required'
    }),
    
  isOptional: Joi.boolean()
    .optional()
    .default(false)
    .messages({
      'boolean.base': 'Is optional must be a boolean value'
    }),
    
  orderIndex: Joi.number()
    .integer()
    .min(0)
    .required()
    .messages({
      'number.base': 'Order index must be a number',
      'number.integer': 'Order index must be an integer',
      'number.min': 'Order index cannot be negative',
      'any.required': 'Order index is required'
    })
});

// Create tour template validation schema
export const createTourTemplateSchema = Joi.object({
  templateName: Joi.string()
    .trim()
    .min(1)
    .max(200)
    .required()
    .messages({
      'string.min': 'Template name is required',
      'string.max': 'Template name cannot exceed 200 characters',
      'any.required': 'Template name is required'
    }),
    
  type: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .required()
    .messages({
      'string.min': 'Type is required',
      'string.max': 'Type cannot exceed 100 characters',
      'any.required': 'Type is required'
    }),
    
  year: Joi.number()
    .integer()
    .min(2020)
    .max(2100)
    .required()
    .messages({
      'number.base': 'Year must be a number',
      'number.integer': 'Year must be an integer',
      'number.min': 'Year must be 2020 or later',
      'number.max': 'Year cannot exceed 2100',
      'any.required': 'Year is required'
    }),
    
  startDate: Joi.date()
    .required()
    .messages({
      'date.base': 'Start date must be a valid date',
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
    
  detailedDescription: Joi.string()
    .trim()
    .min(1)
    .max(5000)
    .required()
    .messages({
      'string.min': 'Detailed description is required',
      'string.max': 'Detailed description cannot exceed 5000 characters',
      'any.required': 'Detailed description is required'
    }),
    
  sitesToVisit: Joi.array()
    .items(siteToVisitSchema)
    .optional()
    .messages({
      'array.base': 'Sites to visit must be an array'
    })
});

// Update tour template validation schema
export const updateTourTemplateSchema = Joi.object({
  templateName: Joi.string()
    .trim()
    .min(1)
    .max(200)
    .optional()
    .messages({
      'string.min': 'Template name cannot be empty',
      'string.max': 'Template name cannot exceed 200 characters'
    }),
    
  type: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .optional()
    .messages({
      'string.min': 'Type cannot be empty',
      'string.max': 'Type cannot exceed 100 characters'
    }),
    
  year: Joi.number()
    .integer()
    .min(2020)
    .max(2100)
    .optional()
    .messages({
      'number.base': 'Year must be a number',
      'number.integer': 'Year must be an integer',
      'number.min': 'Year must be 2020 or later',
      'number.max': 'Year cannot exceed 2100'
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
    
  detailedDescription: Joi.string()
    .trim()
    .min(1)
    .max(5000)
    .optional()
    .messages({
      'string.min': 'Detailed description cannot be empty',
      'string.max': 'Detailed description cannot exceed 5000 characters'
    })
});

// Site to visit validation schemas for updates
export const createSiteToVisitSchema = siteToVisitSchema;

export const updateSiteToVisitSchema = Joi.object({
  siteName: Joi.string()
    .trim()
    .min(1)
    .max(200)
    .optional()
    .messages({
      'string.min': 'Site name cannot be empty',
      'string.max': 'Site name cannot exceed 200 characters'
    }),
    
  description: Joi.string()
    .trim()
    .max(1000)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Site description cannot exceed 1000 characters'
    }),
    
  location: Joi.string()
    .trim()
    .min(1)
    .max(200)
    .optional()
    .messages({
      'string.min': 'Location cannot be empty',
      'string.max': 'Location cannot exceed 200 characters'
    }),
    
  visitDuration: Joi.string()
    .trim()
    .min(1)
    .max(50)
    .optional()
    .messages({
      'string.min': 'Visit duration cannot be empty',
      'string.max': 'Visit duration cannot exceed 50 characters'
    }),
    
  estimatedCost: Joi.number()
    .min(0)
    .max(999999.99)
    .optional()
    .messages({
      'number.min': 'Estimated cost cannot be negative',
      'number.max': 'Estimated cost cannot exceed 999,999.99'
    }),
    
  category: Joi.string()
    .valid(...Object.values(SiteCategory))
    .optional()
    .messages({
      'any.only': 'Category must be one of: ' + Object.values(SiteCategory).join(', ')
    }),
    
  isOptional: Joi.boolean()
    .optional()
    .messages({
      'boolean.base': 'Is optional must be a boolean value'
    }),
    
  orderIndex: Joi.number()
    .integer()
    .min(0)
    .optional()
    .messages({
      'number.base': 'Order index must be a number',
      'number.integer': 'Order index must be an integer',
      'number.min': 'Order index cannot be negative'
    })
});

// Template ID validation schema
export const templateIdSchema = Joi.string()
  .trim()
  .required()
  .messages({
    'any.required': 'Template ID is required',
    'string.empty': 'Template ID cannot be empty'
  });

// Site ID validation schema
export const siteIdSchema = Joi.string()
  .trim()
  .required()
  .messages({
    'any.required': 'Site ID is required',
    'string.empty': 'Site ID cannot be empty'
  });