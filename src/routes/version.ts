import { Router, Request, Response } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';

const router = Router();

interface VersionInfo {
  version: string;
  supportedVersions: string[];
  deprecatedVersions: string[];
  sunset: string | null;
  buildInfo?: {
    buildDate: string;
    gitCommit?: string;
    environment: string;
  };
}

/**
 * Get current API version information
 * @route GET /api/version
 * @returns {VersionInfo} Version information
 */
router.get('/', (req: Request, res: Response) => {
  try {
    // Read version from package.json
    const packageJsonPath = join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    
    const versionInfo: VersionInfo = {
      version: packageJson.version || '1.0.0',
      supportedVersions: ['1.0.0'], // Currently only v1 is supported
      deprecatedVersions: [], // No deprecated versions yet
      sunset: null, // No sunset date for current version
      buildInfo: {
        buildDate: new Date().toISOString(),
        gitCommit: process.env.GIT_COMMIT || undefined,
        environment: process.env.NODE_ENV || 'development'
      }
    };

    // Add cache headers for version info
    res.set({
      'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      'Content-Type': 'application/json'
    });

    res.json(versionInfo);
  } catch (error) {
    console.error('Error reading version information:', error);
    
    // Fallback version info
    const fallbackVersionInfo: VersionInfo = {
      version: '1.0.0',
      supportedVersions: ['1.0.0'],
      deprecatedVersions: [],
      sunset: null
    };

    res.json(fallbackVersionInfo);
  }
});

/**
 * Get changelog for specific version
 * @route GET /api/version/changelog/:version?
 * @param {string} version - Optional version to get changelog for
 * @returns {object} Changelog information
 */
router.get('/changelog/:version?', (req: Request, res: Response) => {
  const requestedVersion = req.params.version || '1.0.0';
  
  // For now, return a simple changelog structure
  // In a real implementation, this would parse the CHANGELOG.md file
  const changelog = {
    version: requestedVersion,
    releaseDate: '2024-01-15',
    changes: {
      added: [
        'Initial release of Tourist Hub API',
        'User management with role-based access control',
        'Provider management with data isolation',
        'Tour template and event management',
        'Document management system',
        'JWT-based authentication'
      ],
      changed: [],
      deprecated: [],
      removed: [],
      fixed: [],
      security: [
        'Role-based authorization middleware',
        'Password hashing with bcrypt',
        'JWT token validation'
      ]
    },
    migrationGuide: `/docs/api-versioning-and-migration.md#migrating-to-v${requestedVersion.replace(/\./g, '')}`
  };

  res.json(changelog);
});

/**
 * Check if a specific API version is supported
 * @route GET /api/version/check/:version
 * @param {string} version - Version to check
 * @returns {object} Support status
 */
router.get('/check/:version', (req: Request, res: Response) => {
  const requestedVersion = req.params.version;
  const supportedVersions = ['1.0.0'];
  const deprecatedVersions: string[] = [];
  
  const isSupported = supportedVersions.includes(requestedVersion);
  const isDeprecated = deprecatedVersions.includes(requestedVersion);
  
  const response = {
    version: requestedVersion,
    supported: isSupported,
    deprecated: isDeprecated,
    sunset: isDeprecated ? null : null, // Would contain sunset date if deprecated
    alternatives: isSupported ? [] : supportedVersions,
    message: isSupported 
      ? 'Version is supported'
      : `Version ${requestedVersion} is not supported. Supported versions: ${supportedVersions.join(', ')}`
  };

  const statusCode = isSupported ? 200 : 400;
  res.status(statusCode).json(response);
});

export default router;