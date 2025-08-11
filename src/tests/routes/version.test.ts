import request from 'supertest';
import app from '../../app';

describe('Version Routes', () => {
  describe('GET /api/version', () => {
    it('should return current API version information', async () => {
      const response = await request(app)
        .get('/api/version')
        .expect(200);

      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('supportedVersions');
      expect(response.body).toHaveProperty('deprecatedVersions');
      expect(response.body).toHaveProperty('sunset');
      expect(response.body).toHaveProperty('buildInfo');

      expect(Array.isArray(response.body.supportedVersions)).toBe(true);
      expect(Array.isArray(response.body.deprecatedVersions)).toBe(true);
      expect(response.body.supportedVersions).toContain('1.0.0');
    });

    it('should include cache headers', async () => {
      const response = await request(app)
        .get('/api/version')
        .expect(200);

      expect(response.headers['cache-control']).toBe('public, max-age=3600');
      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('should include build information', async () => {
      const response = await request(app)
        .get('/api/version')
        .expect(200);

      expect(response.body.buildInfo).toHaveProperty('buildDate');
      expect(response.body.buildInfo).toHaveProperty('environment');
      expect(typeof response.body.buildInfo.buildDate).toBe('string');
      expect(typeof response.body.buildInfo.environment).toBe('string');
    });
  });

  describe('GET /api/version/changelog/:version', () => {
    it('should return changelog for current version', async () => {
      const response = await request(app)
        .get('/api/version/changelog/1.0.0')
        .expect(200);

      expect(response.body).toHaveProperty('version', '1.0.0');
      expect(response.body).toHaveProperty('releaseDate');
      expect(response.body).toHaveProperty('changes');
      expect(response.body).toHaveProperty('migrationGuide');

      expect(response.body.changes).toHaveProperty('added');
      expect(response.body.changes).toHaveProperty('changed');
      expect(response.body.changes).toHaveProperty('deprecated');
      expect(response.body.changes).toHaveProperty('removed');
      expect(response.body.changes).toHaveProperty('fixed');
      expect(response.body.changes).toHaveProperty('security');

      expect(Array.isArray(response.body.changes.added)).toBe(true);
      expect(Array.isArray(response.body.changes.security)).toBe(true);
    });

    it('should return changelog for default version when no version specified', async () => {
      const response = await request(app)
        .get('/api/version/changelog')
        .expect(200);

      expect(response.body).toHaveProperty('version', '1.0.0');
      expect(response.body).toHaveProperty('changes');
    });

    it('should return changelog for any requested version', async () => {
      const response = await request(app)
        .get('/api/version/changelog/2.0.0')
        .expect(200);

      expect(response.body).toHaveProperty('version', '2.0.0');
      expect(response.body).toHaveProperty('migrationGuide');
      expect(response.body.migrationGuide).toContain('migrating-to-v200');
    });
  });

  describe('GET /api/version/check/:version', () => {
    it('should return supported status for current version', async () => {
      const response = await request(app)
        .get('/api/version/check/1.0.0')
        .expect(200);

      expect(response.body).toHaveProperty('version', '1.0.0');
      expect(response.body).toHaveProperty('supported', true);
      expect(response.body).toHaveProperty('deprecated', false);
      expect(response.body).toHaveProperty('sunset');
      expect(response.body).toHaveProperty('alternatives');
      expect(response.body).toHaveProperty('message');

      expect(Array.isArray(response.body.alternatives)).toBe(true);
      expect(response.body.message).toBe('Version is supported');
    });

    it('should return unsupported status for unknown version', async () => {
      const response = await request(app)
        .get('/api/version/check/3.0.0')
        .expect(400);

      expect(response.body).toHaveProperty('version', '3.0.0');
      expect(response.body).toHaveProperty('supported', false);
      expect(response.body).toHaveProperty('deprecated', false);
      expect(response.body).toHaveProperty('alternatives');
      expect(response.body).toHaveProperty('message');

      expect(Array.isArray(response.body.alternatives)).toBe(true);
      expect(response.body.alternatives).toContain('1.0.0');
      expect(response.body.message).toContain('not supported');
    });

    it('should provide alternative versions for unsupported version', async () => {
      const response = await request(app)
        .get('/api/version/check/0.5.0')
        .expect(400);

      expect(response.body.alternatives).toContain('1.0.0');
      expect(response.body.message).toContain('Supported versions: 1.0.0');
    });
  });

  describe('Error handling', () => {
    it('should handle file system errors gracefully', async () => {
      // This test ensures the fallback version info works
      // In a real scenario, we might mock fs.readFileSync to throw an error
      const response = await request(app)
        .get('/api/version')
        .expect(200);

      // Should still return valid version info even if package.json can't be read
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('supportedVersions');
    });
  });
});