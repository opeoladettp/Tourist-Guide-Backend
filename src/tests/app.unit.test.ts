import { describe, it, expect } from 'vitest';

describe('App Unit Tests', () => {
  it('should verify app can be imported and provider routes are registered', async () => {
    // This test verifies that the app can be imported without errors
    // and that provider routes are properly registered
    try {
      const app = await import('../app');
      expect(app.default).toBeDefined();
      expect(typeof app.default).toBe('function');
      
      // Verify app has the expected structure
      expect(app.default._router).toBeDefined();
      
      // Check that routes are registered (app should have middleware stack)
      expect(app.default._router.stack).toBeDefined();
      expect(Array.isArray(app.default._router.stack)).toBe(true);
      
      // Should have multiple route handlers registered
      expect(app.default._router.stack.length).toBeGreaterThan(0);
      
    } catch (error) {
      // If there are import errors, fail the test with details
      throw new Error(`Failed to import app: ${error}`);
    }
  });

  it('should verify provider routes are accessible in the app', async () => {
    try {
      const app = await import('../app');
      
      // Check that the app has route handlers
      const routeStack = app.default._router.stack;
      
      // Look for provider routes (should have /api/providers path)
      const providerRoutes = routeStack.filter((layer: any) => 
        layer.regexp && layer.regexp.source.includes('providers')
      );
      
      expect(providerRoutes.length).toBeGreaterThan(0);
      
    } catch (error) {
      throw new Error(`Failed to verify provider routes in app: ${error}`);
    }
  });
});