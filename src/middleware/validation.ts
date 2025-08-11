import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ErrorFactory } from './error-handler';

// Validation target types
export type ValidationTarget = 'body' | 'params' | 'query' | 'headers';

// Validation options
export interface ValidationOptions {
  abortEarly?: boolean;
  allowUnknown?: boolean;
  stripUnknown?: boolean;
}

// Default validation options
const defaultOptions: ValidationOptions = {
  abortEarly: false,
  allowUnknown: false,
  stripUnknown: false
};

// Validation middleware factory
export function validate(
  schema: Joi.ObjectSchema,
  target: ValidationTarget = 'body',
  options: ValidationOptions = {}
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const validationOptions = { ...defaultOptions, ...options };
    
    // Get the data to validate based on target
    let dataToValidate: any;
    switch (target) {
      case 'body':
        dataToValidate = req.body;
        break;
      case 'params':
        dataToValidate = req.params;
        break;
      case 'query':
        dataToValidate = req.query;
        break;
      case 'headers':
        dataToValidate = req.headers;
        break;
      default:
        return next(ErrorFactory.internalServerError('Invalid validation target'));
    }

    // Validate the data
    const { error, value } = schema.validate(dataToValidate, validationOptions);

    if (error) {
      return next(error);
    }

    // Replace the original data with validated/sanitized data
    switch (target) {
      case 'body':
        req.body = value;
        break;
      case 'params':
        req.params = value;
        break;
      case 'query':
        req.query = value;
        break;
      case 'headers':
        // Don't replace headers as it might break other middleware
        break;
    }

    next();
  };
}

// Multi-target validation middleware factory
export function validateMultiple(validations: Array<{
  schema: Joi.ObjectSchema;
  target: ValidationTarget;
  options?: ValidationOptions;
}>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: string[] = [];
    const validatedData: Record<ValidationTarget, any> = {} as any;

    // Validate each target
    for (const validation of validations) {
      const { schema, target, options: validationOptions = {} } = validation;
      const mergedOptions = { ...defaultOptions, ...validationOptions };

      let dataToValidate: any;
      switch (target) {
        case 'body':
          dataToValidate = req.body;
          break;
        case 'params':
          dataToValidate = req.params;
          break;
        case 'query':
          dataToValidate = req.query;
          break;
        case 'headers':
          dataToValidate = req.headers;
          break;
      }

      const { error, value } = schema.validate(dataToValidate, mergedOptions);

      if (error) {
        errors.push(`${target}: ${error.message}`);
      } else {
        validatedData[target] = value;
      }
    }

    // If there are validation errors, return them
    if (errors.length > 0) {
      return next(ErrorFactory.validationError(
        'Multiple validation errors occurred',
        { validationErrors: errors }
      ));
    }

    // Replace original data with validated data
    Object.keys(validatedData).forEach(targetKey => {
      const target = targetKey as ValidationTarget;
      switch (target) {
        case 'body':
          req.body = validatedData[target];
          break;
        case 'params':
          req.params = validatedData[target];
          break;
        case 'query':
          req.query = validatedData[target];
          break;
        // Don't replace headers
      }
    });

    next();
  };
}

// Common validation schemas
export const commonSchemas = {
  // Pagination schema
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string().optional(),
    sortOrder: Joi.string().valid('asc', 'desc').default('asc')
  }),

  // ID parameter schema
  idParam: Joi.object({
    id: Joi.string().trim().min(1).required()
  }),

  // UUID parameter schema
  uuidParam: Joi.object({
    id: Joi.string().uuid().required()
  }),

  // Search query schema
  search: Joi.object({
    q: Joi.string().trim().min(1).max(100).optional(),
    fields: Joi.array().items(Joi.string()).optional()
  }),

  // Date range schema
  dateRange: Joi.object({
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).optional()
  }),

  // File upload validation
  fileUpload: Joi.object({
    fieldname: Joi.string().required(),
    originalname: Joi.string().required(),
    encoding: Joi.string().required(),
    mimetype: Joi.string().required(),
    size: Joi.number().integer().min(1).required(),
    buffer: Joi.binary().required()
  })
};

// Conditional validation helper
export function conditionalValidation(
  condition: (req: Request) => boolean,
  schema: Joi.ObjectSchema,
  target: ValidationTarget = 'body',
  options: ValidationOptions = {}
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (condition(req)) {
      return validate(schema, target, options)(req, res, next);
    }
    next();
  };
}

// Role-based validation helper
export function roleBasedValidation(
  roleSchemas: Record<string, Joi.ObjectSchema>,
  target: ValidationTarget = 'body',
  options: ValidationOptions = {}
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userRole = (req as any).user?.userType;
    
    if (!userRole) {
      return next(ErrorFactory.authenticationRequired());
    }

    const schema = roleSchemas[userRole];
    if (!schema) {
      return next(ErrorFactory.insufficientPermissions(
        `No validation schema defined for role: ${userRole}`
      ));
    }

    return validate(schema, target, options)(req, res, next);
  };
}

// Sanitization helpers
export const sanitizers = {
  // Remove HTML tags and trim whitespace
  cleanString: (value: string): string => {
    return value.replace(/<[^>]*>/g, '').trim();
  },

  // Normalize email address
  normalizeEmail: (email: string): string => {
    return email.toLowerCase().trim();
  },

  // Normalize phone number
  normalizePhone: (phone: string): string => {
    return phone.replace(/\s+/g, '').replace(/[^\d+]/g, '');
  },

  // Remove extra whitespace
  normalizeWhitespace: (value: string): string => {
    return value.replace(/\s+/g, ' ').trim();
  }
};

// Custom Joi extensions for common patterns
export const customJoi = Joi.extend({
  type: 'string',
  base: Joi.string(),
  messages: {
    'string.cleanHtml': '{{#label}} must not contain HTML tags'
  },
  rules: {
    cleanHtml: {
      method() {
        return this.$_addRule({ name: 'cleanHtml' });
      },
      validate(value, helpers) {
        const cleaned = sanitizers.cleanString(value);
        if (cleaned !== value) {
          return helpers.error('string.cleanHtml');
        }
        return cleaned;
      }
    }
  }
});

// Validation error formatter
export function formatValidationErrors(error: Joi.ValidationError): Array<{
  field: string;
  message: string;
  value?: any;
}> {
  return error.details.map(detail => ({
    field: detail.path.join('.'),
    message: detail.message.replace(/"/g, ''),
    value: detail.context?.value
  }));
}

// Validation middleware with custom error formatting
export function validateWithCustomErrors(
  schema: Joi.ObjectSchema,
  target: ValidationTarget = 'body',
  options: ValidationOptions = {}
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const validationOptions = { ...defaultOptions, ...options };
    
    let dataToValidate: any;
    switch (target) {
      case 'body':
        dataToValidate = req.body;
        break;
      case 'params':
        dataToValidate = req.params;
        break;
      case 'query':
        dataToValidate = req.query;
        break;
      case 'headers':
        dataToValidate = req.headers;
        break;
      default:
        return next(ErrorFactory.internalServerError('Invalid validation target'));
    }

    const { error, value } = schema.validate(dataToValidate, validationOptions);

    if (error) {
      const formattedErrors = formatValidationErrors(error);
      return next(ErrorFactory.validationError(
        'Request validation failed',
        {
          target,
          errors: formattedErrors,
          invalidFields: formattedErrors.map(e => e.field)
        }
      ));
    }

    // Replace the original data with validated/sanitized data
    switch (target) {
      case 'body':
        req.body = value;
        break;
      case 'params':
        req.params = value;
        break;
      case 'query':
        req.query = value;
        break;
    }

    next();
  };
}