import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import {
  validate,
  validateMultiple,
  commonSchemas,
  conditionalValidation,
  roleBasedValidation,
  sanitizers,
  customJoi,
  formatValidationErrors,
  validateWithCustomErrors
} from '../../middleware/validation';
import { ErrorFactory } from '../../middleware/error-handler';

describe('validate middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      query: {},
      headers: {}
    };
    res = {};
    next = vi.fn();
  });

  describe('body validation', () => {
    it('should validate request body successfully', () => {
      const schema = Joi.object({
        name: Joi.string().required(),
        age: Joi.number().required()
      });

      req.body = { name: 'John', age: 25 };
      const middleware = validate(schema, 'body');

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.body).toEqual({ name: 'John', age: 25 });
    });

    it('should call next with error for invalid body', () => {
      const schema = Joi.object({
        name: Joi.string().required(),
        age: Joi.number().required()
      });

      req.body = { name: 'John' }; // missing age
      const middleware = validate(schema, 'body');

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should strip unknown fields when stripUnknown is true', () => {
      const schema = Joi.object({
        name: Joi.string().required()
      });

      req.body = { name: 'John', unknown: 'field' };
      const middleware = validate(schema, 'body', { stripUnknown: true });

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.body).toEqual({ name: 'John' });
    });

    it('should allow unknown fields when allowUnknown is true', () => {
      const schema = Joi.object({
        name: Joi.string().required()
      });

      req.body = { name: 'John', unknown: 'field' };
      const middleware = validate(schema, 'body', { allowUnknown: true, stripUnknown: false });

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.body).toEqual({ name: 'John', unknown: 'field' });
    });
  });

  describe('params validation', () => {
    it('should validate request params successfully', () => {
      const schema = Joi.object({
        id: Joi.string().uuid().required()
      });

      req.params = { id: '123e4567-e89b-12d3-a456-426614174000' };
      const middleware = validate(schema, 'params');

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should call next with error for invalid params', () => {
      const schema = Joi.object({
        id: Joi.string().uuid().required()
      });

      req.params = { id: 'invalid-uuid' };
      const middleware = validate(schema, 'params');

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('query validation', () => {
    it('should validate request query successfully', () => {
      const schema = Joi.object({
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(100).default(20)
      });

      req.query = { page: '2', limit: '10' };
      const middleware = validate(schema, 'query');

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.query).toEqual({ page: 2, limit: 10 });
    });
  });

  describe('headers validation', () => {
    it('should validate request headers successfully', () => {
      const schema = Joi.object({
        'content-type': Joi.string().required(),
        authorization: Joi.string().optional()
      }).unknown(true);

      req.headers = { 'content-type': 'application/json' };
      const middleware = validate(schema, 'headers');

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith();
      // Headers should not be replaced
      expect(req.headers).toEqual({ 'content-type': 'application/json' });
    });
  });

  it('should handle invalid validation target', () => {
    const schema = Joi.object({});
    const middleware = validate(schema, 'invalid' as any);

    middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe('validateMultiple middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      body: { name: 'John' },
      params: { id: '123e4567-e89b-12d3-a456-426614174000' },
      query: { page: '1' }
    };
    res = {};
    next = vi.fn();
  });

  it('should validate multiple targets successfully', () => {
    const validations = [
      {
        schema: Joi.object({ name: Joi.string().required() }),
        target: 'body' as const
      },
      {
        schema: Joi.object({ id: Joi.string().uuid().required() }),
        target: 'params' as const
      },
      {
        schema: Joi.object({ page: Joi.number().integer().min(1).default(1) }),
        target: 'query' as const
      }
    ];

    const middleware = validateMultiple(validations);
    middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ name: 'John' });
    expect(req.params).toEqual({ id: '123e4567-e89b-12d3-a456-426614174000' });
    expect(req.query).toEqual({ page: 1 });
  });

  it('should call next with error if any validation fails', () => {
    const validations = [
      {
        schema: Joi.object({ name: Joi.string().required() }),
        target: 'body' as const
      },
      {
        schema: Joi.object({ id: Joi.string().uuid().required() }),
        target: 'params' as const
      }
    ];

    req.params = { id: 'invalid-uuid' };
    const middleware = validateMultiple(validations);
    middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe('commonSchemas', () => {
  it('should validate pagination schema', () => {
    const data = { page: 2, limit: 50, sortBy: 'name', sortOrder: 'desc' };
    const { error, value } = commonSchemas.pagination.validate(data);

    expect(error).toBeUndefined();
    expect(value).toEqual(data);
  });

  it('should apply defaults for pagination schema', () => {
    const data = {};
    const { error, value } = commonSchemas.pagination.validate(data);

    expect(error).toBeUndefined();
    expect(value).toEqual({ page: 1, limit: 20, sortOrder: 'asc' });
  });

  it('should validate ID parameter schema', () => {
    const data = { id: 'test-id' };
    const { error, value } = commonSchemas.idParam.validate(data);

    expect(error).toBeUndefined();
    expect(value).toEqual(data);
  });

  it('should validate UUID parameter schema', () => {
    const data = { id: '123e4567-e89b-12d3-a456-426614174000' };
    const { error, value } = commonSchemas.uuidParam.validate(data);

    expect(error).toBeUndefined();
    expect(value).toEqual(data);
  });

  it('should validate search schema', () => {
    const data = { q: 'search term', fields: ['name', 'email'] };
    const { error, value } = commonSchemas.search.validate(data);

    expect(error).toBeUndefined();
    expect(value).toEqual(data);
  });

  it('should validate date range schema', () => {
    const data = {
      startDate: '2023-01-01T00:00:00.000Z',
      endDate: '2023-12-31T23:59:59.999Z'
    };
    const { error, value } = commonSchemas.dateRange.validate(data);

    expect(error).toBeUndefined();
    expect(value.startDate).toBeInstanceOf(Date);
    expect(value.endDate).toBeInstanceOf(Date);
  });

  it('should reject invalid date range', () => {
    const data = {
      startDate: '2023-12-31T23:59:59.999Z',
      endDate: '2023-01-01T00:00:00.000Z'
    };
    const { error } = commonSchemas.dateRange.validate(data);

    expect(error).toBeDefined();
  });
});

describe('conditionalValidation middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      body: { name: 'John' },
      method: 'POST'
    };
    res = {};
    next = vi.fn();
  });

  it('should validate when condition is true', () => {
    const schema = Joi.object({ name: Joi.string().required() });
    const condition = (req: Request) => req.method === 'POST';
    const middleware = conditionalValidation(condition, schema);

    middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('should skip validation when condition is false', () => {
    const schema = Joi.object({ name: Joi.string().required() });
    const condition = (req: Request) => req.method === 'GET';
    const middleware = conditionalValidation(condition, schema);

    req.body = {}; // Invalid data that would normally fail validation
    middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith();
  });
});

describe('roleBasedValidation middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      body: { name: 'John' }
    };
    res = {};
    next = vi.fn();
  });

  it('should validate with correct role schema', () => {
    const roleSchemas = {
      admin: Joi.object({ name: Joi.string().required() }),
      user: Joi.object({ name: Joi.string().min(2).required() })
    };

    (req as any).user = { userType: 'admin' };
    const middleware = roleBasedValidation(roleSchemas);

    middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('should call next with error if no user', () => {
    const roleSchemas = {
      admin: Joi.object({ name: Joi.string().required() })
    };

    const middleware = roleBasedValidation(roleSchemas);
    middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it('should call next with error if no schema for role', () => {
    const roleSchemas = {
      admin: Joi.object({ name: Joi.string().required() })
    };

    (req as any).user = { userType: 'unknown' };
    const middleware = roleBasedValidation(roleSchemas);

    middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe('sanitizers', () => {
  it('should clean HTML tags from string', () => {
    const input = '<script>alert("xss")</script>Hello World';
    const result = sanitizers.cleanString(input);
    expect(result).toBe('alert("xss")Hello World');
  });

  it('should normalize email address', () => {
    const input = '  TEST@EXAMPLE.COM  ';
    const result = sanitizers.normalizeEmail(input);
    expect(result).toBe('test@example.com');
  });

  it('should normalize phone number', () => {
    const input = '+1 (555) 123-4567';
    const result = sanitizers.normalizePhone(input);
    expect(result).toBe('+15551234567');
  });

  it('should normalize whitespace', () => {
    const input = '  Hello    World  ';
    const result = sanitizers.normalizeWhitespace(input);
    expect(result).toBe('Hello World');
  });
});

describe('customJoi', () => {
  it('should validate clean HTML strings', () => {
    const schema = customJoi.string().cleanHtml();
    
    const { error: validError } = schema.validate('Clean text');
    expect(validError).toBeUndefined();

    const { error: invalidError } = schema.validate('<script>alert("xss")</script>');
    expect(invalidError).toBeDefined();
    expect(invalidError?.message).toContain('must not contain HTML tags');
  });
});

describe('formatValidationErrors', () => {
  it('should format Joi validation errors correctly', () => {
    const schema = Joi.object({
      email: Joi.string().email().required(),
      age: Joi.number().min(18).required()
    });

    const { error } = schema.validate({ email: 'invalid', age: 15 }, { abortEarly: false });
    const formatted = formatValidationErrors(error!);

    expect(formatted).toHaveLength(2);
    expect(formatted[0]).toEqual({
      field: 'email',
      message: expect.stringContaining('valid email'),
      value: 'invalid'
    });
    expect(formatted[1]).toEqual({
      field: 'age',
      message: expect.stringContaining('greater than or equal to 18'),
      value: 15
    });
  });
});

describe('validateWithCustomErrors middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      body: {}
    };
    res = {};
    next = vi.fn();
  });

  it('should validate successfully and pass through', () => {
    const schema = Joi.object({
      name: Joi.string().required()
    });

    req.body = { name: 'John' };
    const middleware = validateWithCustomErrors(schema);

    middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ name: 'John' });
  });

  it('should call next with formatted error for validation failure', () => {
    const schema = Joi.object({
      email: Joi.string().email().required(),
      age: Joi.number().min(18).required()
    });

    req.body = { email: 'invalid', age: 15 };
    const middleware = validateWithCustomErrors(schema);

    middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    
    const calledError = (next as any).mock.calls[0][0];
    expect(calledError.details).toHaveProperty('target', 'body');
    expect(calledError.details).toHaveProperty('errors');
    expect(calledError.details).toHaveProperty('invalidFields');
    expect(calledError.details.errors).toHaveLength(2);
  });
});