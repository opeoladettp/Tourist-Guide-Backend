import Joi from 'joi';

// Create activity type validation schema
export const createActivityTypeSchema = Joi.object({
  typeName: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .required()
    .messages({
      'string.min': 'Activity type name is required',
      'string.max': 'Activity type name cannot exceed 100 characters',
      'any.required': 'Activity type name is required'
    }),
    
  description: Joi.string()
    .trim()
    .max(500)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Description cannot exceed 500 characters'
    }),
    
  isDefault: Joi.boolean()
    .optional()
    .default(true)
    .messages({
      'boolean.base': 'isDefault must be a boolean value'
    }),
    
  isActive: Joi.boolean()
    .optional()
    .default(true)
    .messages({
      'boolean.base': 'isActive must be a boolean value'
    })
});

// Update activity type validation schema
export const updateActivityTypeSchema = Joi.object({
  typeName: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .optional()
    .messages({
      'string.min': 'Activity type name cannot be empty',
      'string.max': 'Activity type name cannot exceed 100 characters'
    }),
    
  description: Joi.string()
    .trim()
    .max(500)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Description cannot exceed 500 characters'
    }),
    
  isDefault: Joi.boolean()
    .optional()
    .messages({
      'boolean.base': 'isDefault must be a boolean value'
    }),
    
  isActive: Joi.boolean()
    .optional()
    .messages({
      'boolean.base': 'isActive must be a boolean value'
    })
});

// Activity type ID validation schema
export const activityTypeIdSchema = Joi.string()
  .trim()
  .required()
  .messages({
    'any.required': 'Activity type ID is required',
    'string.empty': 'Activity type ID cannot be empty'
  });