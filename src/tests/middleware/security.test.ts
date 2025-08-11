import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import {
  ipBlockingMiddleware,
  requestSanitizationMiddleware,
  enhancedSecurityHeadersMiddleware,
  authFailureTrackingMiddleware,
  requestSizeValidationMiddleware,
  IPSecurityTracker,
  SecurityEventLogger,
  RequestSanitizer
} from '../../middleware/security';

describe('Security Middleware', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe('enhancedSecurityHeadersMiddleware', () => {
    it('should add security headers to response', async () => {
      app.use(enhancedSecurityHeadersMiddleware);
      app.get('/test', (req, res) => res.json({ success: true }));

      const response = await request(app).get('/test');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(response.headers['content-security-policy']).toContain("default-src 'self'");
      expect(response.headers['permissions-policy']).toContain('geolocation=()');
      expect(response.headers['x-powered-by']).toBeUndefined();
    });

    it('should add request ID header', async () => {
      app.use(enhancedSecurityHeadersMiddleware);
      app.get('/test', (req, res) => res.json({ success: true }));

      const response = await request(app).get('/test');

      expect(response.headers['x-request-id']).toBeDefined();
    });
  });

  describe('requestSanitizationMiddleware', () => {
    it('should sanitize request body', async () => {
      app.use(requestSanitizationMiddleware);
      app.post('/test', (req, res) => res.json(req.body));

      const maliciousData = {
        name: '<script>alert("xss")</script>John',
        description: 'javascript:void(0)',
        nested: {
          value: '<img onerror="alert(1)" src="x">'
        }
      };

      const response = await request(app)
        .post('/test')
        .send(maliciousData);

      expect(response.body.name).toBe('John');
      expect(response.body.description).toBe('void(0)');
      expect(response.body.nested.value).toBe(''); // Should be empty after removing img with onerror
    });

    it('should handle arrays in request body', async () => {
      app.use(requestSanitizationMiddleware);
      app.post('/test', (req, res) => res.json(req.body));

      const data = {
        items: ['<script>alert(1)</script>item1', 'item2', '<img onerror="alert(1)">']
      };

      const response = await request(app)
        .post('/test')
        .send(data);

      expect(response.body.items[0]).toBe('item1');
      expect(response.body.items[1]).toBe('item2');
      expect(response.body.items[2]).toBe(''); // Should be empty after removing img with onerror
    });
  });

  describe('requestSizeValidationMiddleware', () => {
    it('should reject requests that are too large', async () => {
      app.use(requestSizeValidationMiddleware);
      app.post('/test', (req, res) => res.json({ success: true }));

      // Create a large payload
      const largeData = 'x'.repeat(11 * 1024 * 1024); // 11MB string
      
      const response = await request(app)
        .post('/test')
        .send({ data: largeData });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }, 10000); // Increase timeout to 10 seconds

    it('should allow requests within size limit', async () => {
      app.use(requestSizeValidationMiddleware);
      app.post('/test', (req, res) => res.json({ success: true }));

      const response = await request(app)
        .post('/test')
        .send({ data: 'test' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('authFailureTrackingMiddleware', () => {
    it('should track authentication failures', async () => {
      const logEventSpy = vi.spyOn(SecurityEventLogger, 'logEvent').mockImplementation(() => {});
      const recordFailedAttemptSpy = vi.spyOn(IPSecurityTracker, 'recordFailedAttempt').mockImplementation(() => {});

      app.use(authFailureTrackingMiddleware);
      app.post('/test', (req, res) => res.status(401).json({ error: 'Unauthorized' }));

      await request(app).post('/test');

      expect(logEventSpy).toHaveBeenCalledWith(
        'AUTHENTICATION_FAILURE',
        expect.any(Object),
        expect.objectContaining({
          statusCode: 401,
          endpoint: '/test'
        })
      );
      expect(recordFailedAttemptSpy).toHaveBeenCalled();

      logEventSpy.mockRestore();
      recordFailedAttemptSpy.mockRestore();
    });

    it('should track successful authentication', async () => {
      const recordSuccessfulAttemptSpy = vi.spyOn(IPSecurityTracker, 'recordSuccessfulAttempt').mockImplementation(() => {});

      app.use(authFailureTrackingMiddleware);
      app.post('/test', (req, res) => res.status(200).json({ success: true }));

      await request(app).post('/test');

      expect(recordSuccessfulAttemptSpy).toHaveBeenCalled();

      recordSuccessfulAttemptSpy.mockRestore();
    });
  });

  describe('ipBlockingMiddleware', () => {
    it('should block requests from blocked IPs', async () => {
      const isBlockedSpy = vi.spyOn(IPSecurityTracker, 'isBlocked').mockReturnValue(true);
      const logEventSpy = vi.spyOn(SecurityEventLogger, 'logEvent').mockImplementation(() => {});

      app.use(ipBlockingMiddleware);
      app.get('/test', (req, res) => res.json({ success: true }));

      const response = await request(app).get('/test');

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('RESOURCE_ACCESS_DENIED');
      expect(logEventSpy).toHaveBeenCalledWith('BLOCKED_IP_ACCESS_ATTEMPT', expect.any(Object), expect.any(Object));

      isBlockedSpy.mockRestore();
      logEventSpy.mockRestore();
    });

    it('should allow requests from non-blocked IPs', async () => {
      const isBlockedSpy = vi.spyOn(IPSecurityTracker, 'isBlocked').mockReturnValue(false);

      app.use(ipBlockingMiddleware);
      app.get('/test', (req, res) => res.json({ success: true }));

      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      isBlockedSpy.mockRestore();
    });
  });
});

describe('RequestSanitizer', () => {
  describe('sanitizeString', () => {
    it('should remove script tags', () => {
      const input = '<script>alert("xss")</script>Hello World';
      const result = RequestSanitizer.sanitizeString(input);
      expect(result).toBe('Hello World');
    });

    it('should remove javascript protocol', () => {
      const input = 'javascript:alert("xss")';
      const result = RequestSanitizer.sanitizeString(input);
      expect(result).toBe('alert("xss")');
    });

    it('should remove event handlers', () => {
      const input = '<img onerror="alert(1)" src="test.jpg">';
      const result = RequestSanitizer.sanitizeString(input);
      expect(result).toBe(''); // Should be empty after removing img with onerror
    });

    it('should handle non-string input', () => {
      const input = 123;
      const result = RequestSanitizer.sanitizeString(input as any);
      expect(result).toBe(123);
    });
  });

  describe('sanitizeObject', () => {
    it('should sanitize nested objects', () => {
      const input = {
        name: '<script>alert(1)</script>John',
        profile: {
          bio: 'javascript:void(0)',
          tags: ['<script>alert(1)</script>tag1', 'tag2']
        }
      };

      const result = RequestSanitizer.sanitizeObject(input);

      expect(result.name).toBe('John');
      expect(result.profile.bio).toBe('void(0)');
      expect(result.profile.tags[0]).toBe('tag1');
      expect(result.profile.tags[1]).toBe('tag2');
    });

    it('should handle null and undefined values', () => {
      expect(RequestSanitizer.sanitizeObject(null)).toBe(null);
      expect(RequestSanitizer.sanitizeObject(undefined)).toBe(undefined);
    });

    it('should handle primitive values', () => {
      expect(RequestSanitizer.sanitizeObject(123)).toBe(123);
      expect(RequestSanitizer.sanitizeObject(true)).toBe(true);
    });
  });
});

describe('IPSecurityTracker', () => {
  beforeEach(() => {
    // Clear the internal state
    (IPSecurityTracker as any).suspiciousIPs.clear();
  });

  describe('recordFailedAttempt', () => {
    it('should track failed attempts', () => {
      IPSecurityTracker.recordFailedAttempt('192.168.1.1');
      
      const suspiciousActivity = IPSecurityTracker.getSuspiciousActivity();
      expect(suspiciousActivity).toHaveLength(1);
      expect(suspiciousActivity[0].ip).toBe('192.168.1.1');
      expect(suspiciousActivity[0].failedAttempts).toBe(1);
    });

    it('should block IP after max failed attempts', () => {
      const ip = '192.168.1.1';
      
      // Record multiple failed attempts
      for (let i = 0; i < 5; i++) {
        IPSecurityTracker.recordFailedAttempt(ip);
      }
      
      expect(IPSecurityTracker.isBlocked(ip)).toBe(true);
      
      const blockedIPs = IPSecurityTracker.getBlockedIPs();
      expect(blockedIPs).toContain(ip);
    });
  });

  describe('recordSuccessfulAttempt', () => {
    it('should reset failed attempts on successful login', () => {
      const ip = '192.168.1.1';
      
      // Record failed attempts
      IPSecurityTracker.recordFailedAttempt(ip);
      IPSecurityTracker.recordFailedAttempt(ip);
      
      // Record successful attempt
      IPSecurityTracker.recordSuccessfulAttempt(ip);
      
      const suspiciousActivity = IPSecurityTracker.getSuspiciousActivity();
      expect(suspiciousActivity).toHaveLength(0);
    });

    it('should unblock IP on successful login', () => {
      const ip = '192.168.1.1';
      
      // Block the IP
      for (let i = 0; i < 5; i++) {
        IPSecurityTracker.recordFailedAttempt(ip);
      }
      expect(IPSecurityTracker.isBlocked(ip)).toBe(true);
      
      // Successful attempt should unblock
      IPSecurityTracker.recordSuccessfulAttempt(ip);
      expect(IPSecurityTracker.isBlocked(ip)).toBe(false);
    });
  });

  describe('isBlocked', () => {
    it('should return false for non-blocked IPs', () => {
      expect(IPSecurityTracker.isBlocked('192.168.1.1')).toBe(false);
    });

    it('should handle expired blocks', () => {
      const ip = '192.168.1.1';
      
      // Manually set a blocked IP with expired block time
      const suspiciousIPs = (IPSecurityTracker as any).suspiciousIPs;
      suspiciousIPs.set(ip, {
        failedAttempts: 5,
        lastAttempt: Date.now(),
        blocked: true,
        blockExpiry: Date.now() - 1000 // Expired 1 second ago
      });
      
      expect(IPSecurityTracker.isBlocked(ip)).toBe(false);
    });
  });
});

describe('SecurityEventLogger', () => {
  beforeEach(() => {
    // Clear events
    (SecurityEventLogger as any).events = [];
  });

  describe('logEvent', () => {
    it('should log security events', () => {
      const mockReq = {
        ip: '192.168.1.1',
        get: vi.fn().mockReturnValue('Mozilla/5.0'),
        user: { userId: 'user123' }
      } as any;

      SecurityEventLogger.logEvent('TEST_EVENT', mockReq, { extra: 'data' });

      const events = SecurityEventLogger.getRecentEvents(1);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('TEST_EVENT');
      expect(events[0].ip).toBe('192.168.1.1');
      expect(events[0].userId).toBe('user123');
      expect(events[0].details.extra).toBe('data');
    });

    it('should limit event history', () => {
      const mockReq = { ip: '192.168.1.1', get: vi.fn() } as any;

      // Add more than 1000 events
      for (let i = 0; i < 1100; i++) {
        SecurityEventLogger.logEvent(`EVENT_${i}`, mockReq);
      }

      const events = SecurityEventLogger.getRecentEvents();
      expect(events.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('getEventsByType', () => {
    it('should filter events by type', () => {
      const mockReq = { ip: '192.168.1.1', get: vi.fn() } as any;

      SecurityEventLogger.logEvent('TYPE_A', mockReq);
      SecurityEventLogger.logEvent('TYPE_B', mockReq);
      SecurityEventLogger.logEvent('TYPE_A', mockReq);

      const typeAEvents = SecurityEventLogger.getEventsByType('TYPE_A');
      expect(typeAEvents).toHaveLength(2);
      expect(typeAEvents.every(event => event.type === 'TYPE_A')).toBe(true);
    });
  });

  describe('getEventsByIP', () => {
    it('should filter events by IP address', () => {
      const mockReq1 = { ip: '192.168.1.1', get: vi.fn() } as any;
      const mockReq2 = { ip: '192.168.1.2', get: vi.fn() } as any;

      SecurityEventLogger.logEvent('EVENT', mockReq1);
      SecurityEventLogger.logEvent('EVENT', mockReq2);
      SecurityEventLogger.logEvent('EVENT', mockReq1);

      const ip1Events = SecurityEventLogger.getEventsByIP('192.168.1.1');
      expect(ip1Events).toHaveLength(2);
      expect(ip1Events.every(event => event.ip === '192.168.1.1')).toBe(true);
    });
  });
});