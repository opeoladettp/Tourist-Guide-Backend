import { describe, it, expect } from 'vitest';
import { Router } from 'express';

describe('Provider Routes Unit Tests', () => {
  it('should verify provider routes file exists and exports a router', async () => {
    // Import the provider routes
    const providerRoutes = await import('../../routes/providers');
    
    // Verify it exports a router
    expect(providerRoutes.default).toBeDefined();
    expect(typeof providerRoutes.default).toBe('function');
    
    // Verify it has router properties (Express Router)
    expect(providerRoutes.default.stack).toBeDefined();
  });

  it('should verify provider routes are properly structured', async () => {
    const providerRoutes = await import('../../routes/providers');
    const router = providerRoutes.default;
    
    // Check that routes are registered
    expect(router.stack).toBeDefined();
    expect(Array.isArray(router.stack)).toBe(true);
    
    // Should have at least 5 routes (GET, POST, GET/:id, PUT/:id, DELETE/:id)
    expect(router.stack.length).toBeGreaterThanOrEqual(5);
  });

  it('should verify route methods are correctly configured', async () => {
    const providerRoutes = await import('../../routes/providers');
    const router = providerRoutes.default;
    
    // Extract route information
    const routes = router.stack.map((layer: any) => ({
      path: layer.route?.path,
      methods: layer.route ? Object.keys(layer.route.methods) : []
    }));
    
    // Check for expected routes
    const expectedRoutes = [
      { path: '/', methods: ['get'] },
      { path: '/', methods: ['post'] },
      { path: '/:id', methods: ['get'] },
      { path: '/:id', methods: ['put'] },
      { path: '/:id', methods: ['delete'] }
    ];
    
    expectedRoutes.forEach(expectedRoute => {
      const matchingRoute = routes.find(route => 
        route.path === expectedRoute.path && 
        expectedRoute.methods.every(method => route.methods.includes(method))
      );
      expect(matchingRoute).toBeDefined();
    });
  });
});