# API Versioning and Migration Guide

## Overview

The Tourist Hub API follows semantic versioning principles and provides comprehensive migration guidance to ensure smooth transitions between API versions while maintaining backward compatibility.

## Versioning Strategy

### Version Format

The API uses semantic versioning (SemVer) with the format `MAJOR.MINOR.PATCH`:

- **MAJOR**: Incremented for breaking changes that require client modifications
- **MINOR**: Incremented for backward-compatible feature additions
- **PATCH**: Incremented for backward-compatible bug fixes

### Current Version

- **Current API Version**: v1.0.0
- **Supported Versions**: v1.x.x
- **Deprecated Versions**: None (initial release)

### Version Header

All API requests should include the API version in the header:

```http
Accept: application/vnd.touristhub.v1+json
```

Alternatively, version can be specified in the URL path:

```http
GET /api/v1/users
```

## Backward Compatibility Policy

### Compatibility Guarantees

Within the same major version, the API guarantees:

1. **Existing endpoints remain functional** - No removal of endpoints
2. **Request schemas remain valid** - No removal of required fields
3. **Response schemas remain consistent** - No removal of response fields
4. **Authentication mechanisms remain stable** - No changes to auth flows

### Non-Breaking Changes

The following changes are considered non-breaking and may be introduced in minor versions:

- Adding new optional request parameters
- Adding new response fields
- Adding new endpoints
- Adding new HTTP methods to existing endpoints
- Adding new error codes with descriptive messages
- Performance improvements
- Bug fixes that don't change behavior

### Breaking Changes

The following changes require a major version increment:

- Removing or renaming endpoints
- Removing or renaming request/response fields
- Changing field data types
- Changing authentication mechanisms
- Changing error response formats
- Modifying business logic that affects existing behavior

## Version Lifecycle

### Support Timeline

- **Active Support**: 24 months from release
- **Security Updates**: 12 months after active support ends
- **End of Life**: 36 months from initial release

### Deprecation Process

1. **Announcement**: 6 months advance notice via:
   - API documentation updates
   - Response headers (`Sunset` header)
   - Developer notifications
   - Changelog updates

2. **Warning Period**: 3 months with deprecation warnings:
   ```http
   Warning: 299 - "Deprecated API version. Please migrate to v2.0.0"
   Sunset: Wed, 01 Jan 2025 00:00:00 GMT
   ```

3. **End of Life**: Version becomes unavailable

## Migration Guide

### Pre-Migration Checklist

Before migrating to a new API version:

- [ ] Review the changelog for breaking changes
- [ ] Test your integration against the new version in staging
- [ ] Update client libraries and SDKs
- [ ] Plan rollback strategy
- [ ] Schedule migration during low-traffic periods

### Migration Process

#### Step 1: Review Changes

Check the version-specific migration guide:

```bash
# Get changelog for specific version
curl -H "Accept: application/vnd.touristhub.v2+json" \
     https://api.touristhub.com/changelog/v2.0.0
```

#### Step 2: Update Client Configuration

Update your client to use the new version:

```javascript
// JavaScript example
const client = new TouristHubClient({
  apiVersion: 'v2.0.0',
  baseURL: 'https://api.touristhub.com'
});
```

```python
# Python example
client = TouristHubClient(
    api_version='v2.0.0',
    base_url='https://api.touristhub.com'
)
```

#### Step 3: Test Integration

Run comprehensive tests against the new version:

```bash
# Run integration tests
npm run test:integration -- --api-version=v2.0.0
```

#### Step 4: Deploy Gradually

Use feature flags or gradual rollout:

```javascript
// Feature flag example
const apiVersion = featureFlag.isEnabled('api-v2') ? 'v2.0.0' : 'v1.0.0';
```

## Version-Specific Migration Guides

### Migrating to v2.0.0 (Future)

*This section will be populated when v2.0.0 is released*

#### Breaking Changes
- TBD

#### Migration Steps
- TBD

#### Code Examples
- TBD

## API Version Detection

### Runtime Version Detection

Clients can detect the API version at runtime:

```http
GET /api/version
```

Response:
```json
{
  "version": "1.0.0",
  "supportedVersions": ["1.0.0"],
  "deprecatedVersions": [],
  "sunset": null
}
```

### Version-Specific Documentation

Each API version maintains its own OpenAPI specification:

- **v1.0.0**: `/api/v1/docs` or `/docs/openapi-v1.json`
- **v2.0.0**: `/api/v2/docs` or `/docs/openapi-v2.json` (future)

## Error Handling for Version Issues

### Unsupported Version

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": {
    "code": "UNSUPPORTED_API_VERSION",
    "message": "API version 'v3.0.0' is not supported",
    "supportedVersions": ["v1.0.0", "v2.0.0"],
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Deprecated Version Warning

```http
HTTP/1.1 200 OK
Warning: 299 - "API version v1.0.0 is deprecated. Please migrate to v2.0.0"
Sunset: Wed, 01 Jan 2025 00:00:00 GMT
Content-Type: application/json
```

## Client Library Support

### Official SDKs

Official client libraries automatically handle version negotiation:

```javascript
// JavaScript SDK
import { TouristHubClient } from '@touristhub/client';

const client = new TouristHubClient({
  apiKey: 'your-api-key',
  version: '1.0.0' // Optional, defaults to latest stable
});
```

```python
# Python SDK
from touristhub_client import TouristHubClient

client = TouristHubClient(
    api_key='your-api-key',
    version='1.0.0'  # Optional, defaults to latest stable
)
```

### Version Pinning

Always pin to specific versions in production:

```json
{
  "dependencies": {
    "@touristhub/client": "1.0.0"
  }
}
```

## Testing Across Versions

### Multi-Version Testing

Test your integration against multiple API versions:

```yaml
# GitHub Actions example
strategy:
  matrix:
    api-version: ['1.0.0', '2.0.0']
steps:
  - name: Test API Integration
    run: npm test
    env:
      API_VERSION: ${{ matrix.api-version }}
```

### Compatibility Testing

Use contract testing to ensure compatibility:

```javascript
// Pact.js example
const { Pact } = require('@pact-foundation/pact');

const provider = new Pact({
  consumer: 'TouristApp',
  provider: 'TouristHubAPI',
  pactfileWriteMode: 'update'
});
```

## Monitoring and Analytics

### Version Usage Tracking

Monitor API version usage through analytics:

```http
GET /api/analytics/version-usage
Authorization: Bearer <admin-token>
```

Response:
```json
{
  "versionUsage": {
    "v1.0.0": {
      "requestCount": 150000,
      "percentage": 85.5,
      "uniqueClients": 45
    },
    "v2.0.0": {
      "requestCount": 25000,
      "percentage": 14.5,
      "uniqueClients": 12
    }
  },
  "period": "last-30-days"
}
```

### Migration Progress Tracking

Track migration progress for deprecated versions:

```javascript
// Client-side tracking
analytics.track('api_version_used', {
  version: '1.0.0',
  endpoint: '/api/users',
  deprecated: false
});
```

## Best Practices

### For API Consumers

1. **Always specify version explicitly** - Don't rely on defaults
2. **Monitor deprecation warnings** - Set up alerts for sunset headers
3. **Test early and often** - Test against new versions in staging
4. **Use semantic versioning** - Pin to specific versions in production
5. **Implement graceful degradation** - Handle version errors gracefully

### For API Providers

1. **Communicate changes early** - Provide advance notice of changes
2. **Maintain backward compatibility** - Within major versions
3. **Provide migration tools** - Scripts and utilities for common migrations
4. **Monitor usage patterns** - Track version adoption and usage
5. **Support multiple versions** - Maintain reasonable support windows

## Changelog Format

### Version Entry Template

```markdown
## [2.0.0] - 2024-06-01

### Breaking Changes
- Removed deprecated `oldField` from User model
- Changed authentication from API keys to OAuth 2.0

### Added
- New tour recommendation endpoint
- Enhanced search capabilities

### Changed
- Improved error message clarity
- Updated rate limiting policies

### Deprecated
- Legacy authentication methods (sunset: 2024-12-01)

### Fixed
- Fixed timezone handling in date fields
- Resolved pagination issues in large datasets

### Security
- Enhanced input validation
- Updated dependency versions
```

## Support and Resources

### Documentation
- [API Reference](./openapi-implementation-summary.md)
- [Client Examples](./api-client-examples/README.md)
- [Troubleshooting Guide](./api-client-examples/troubleshooting/common-issues.md)

### Support Channels
- GitHub Issues: For bug reports and feature requests
- Developer Forum: For integration questions
- Email Support: For urgent migration assistance

### Migration Assistance

For complex migrations, the Tourist Hub team provides:

- **Migration consultation** - Architecture review and planning
- **Custom tooling** - Migration scripts for large datasets
- **Extended support** - Temporary extended support for critical applications

---

*This document is maintained by the Tourist Hub API team and updated with each release.*