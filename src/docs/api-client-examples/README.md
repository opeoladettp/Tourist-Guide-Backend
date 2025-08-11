# Tourist Hub API - Client Examples and Integration Guide

This directory contains comprehensive examples and guides for integrating with the Tourist Hub API. The examples demonstrate common integration patterns, authentication flows, and best practices for different user roles.

## Directory Structure

```
api-client-examples/
├── README.md                           # This file
├── javascript/                         # JavaScript/Node.js examples
│   ├── basic-client.js                # Basic API client implementation
│   ├── tourist-workflow.js            # Tourist user workflow examples
│   ├── provider-admin-workflow.js     # Provider admin workflow examples
│   └── system-admin-workflow.js       # System admin workflow examples
├── python/                            # Python examples
│   ├── basic_client.py                # Basic API client implementation
│   ├── tourist_workflow.py            # Tourist user workflow examples
│   └── provider_admin_workflow.py     # Provider admin workflow examples
├── curl/                              # cURL command examples
│   ├── authentication.sh              # Authentication examples
│   ├── user-management.sh             # User management examples
│   └── tour-management.sh             # Tour management examples
├── integration-patterns/              # Common integration patterns
│   ├── authentication-flow.md         # Authentication best practices
│   ├── error-handling.md              # Error handling strategies
│   ├── data-synchronization.md        # Data sync patterns
│   └── webhook-integration.md         # Webhook integration guide
└── troubleshooting/                   # Troubleshooting guides
    ├── common-issues.md               # Common issues and solutions
    ├── authentication-problems.md     # Authentication troubleshooting
    └── api-errors.md                  # API error reference
```

## Quick Start

1. **Choose your preferred language/tool** from the examples directory
2. **Review the authentication flow** in `integration-patterns/authentication-flow.md`
3. **Follow the workflow examples** for your user role
4. **Refer to troubleshooting guides** if you encounter issues

## API Base URL

- **Development**: `http://localhost:3000`
- **Production**: `https://api.touristhub.com`

## Authentication Overview

All API endpoints (except registration and health checks) require JWT authentication:

1. Obtain tokens via `POST /api/auth/login`
2. Include access token in Authorization header: `Bearer <token>`
3. Refresh tokens when they expire using `POST /api/auth/refresh`

## User Roles and Permissions

- **SystemAdmin**: Full system access, manages all users, providers, and templates
- **ProviderAdmin**: Manages company-specific operations and users
- **Tourist**: Manages personal profile, documents, and tour registrations

## Getting Help

- Review the [OpenAPI documentation](http://localhost:3000/api-docs) for detailed endpoint specifications
- Check the [troubleshooting guides](./troubleshooting/) for common issues
- Refer to the [integration patterns](./integration-patterns/) for best practices