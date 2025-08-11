# Tourist Hub API

Tourist Hub API backend for tour management and collaboration between tourists and tour providers.

## Features

- RESTful API with Express.js and TypeScript
- Role-based access control (SystemAdmin, ProviderAdmin, Tourist)
- Multi-tenant architecture with data isolation
- JWT authentication with refresh tokens
- Document management with file storage
- Tour template and custom event management

## Getting Started

### Prerequisites

- Node.js >= 16.0.0
- npm >= 8.0.0
- PostgreSQL database
- Redis (for caching and sessions)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

4. Update the `.env` file with your configuration

5. Set up the database:
   ```bash
   # Generate Prisma client
   npm run db:generate
   
   # Run database migrations (requires PostgreSQL to be running)
   npm run db:migrate
   ```

6. Test database connection:
   ```bash
   npx ts-node src/utils/test-db-connection.ts
   ```

### Development

Start the development server:
```bash
npm run dev
```

The server will start on `http://localhost:3000` with hot reloading enabled.

### Production

Build the project:
```bash
npm run build
```

Start the production server:
```bash
npm start
```

### Available Scripts

- `npm run dev` - Start development server with hot reloading
- `npm run build` - Build the project for production
- `npm start` - Start the production server
- `npm run type-check` - Run TypeScript type checking
- `npm run clean` - Clean the dist directory
- `npm run db:generate` - Generate Prisma client
- `npm run db:migrate` - Run database migrations
- `npm run db:push` - Push schema changes to database
- `npm run db:reset` - Reset database and run migrations
- `npm run db:studio` - Open Prisma Studio

### API Endpoints

#### Health Check
- `GET /health` - Server health status
- `GET /health/db` - Database health status
- `GET /health/full` - Comprehensive health check

#### API Base
- `GET /api` - API information and status

## Project Structure

```
src/
├── app.ts              # Express app configuration
├── server.ts           # Server entry point
├── config/             # Configuration files
├── routes/             # API route handlers
├── services/           # Business logic services
├── utils/              # Utility functions
├── generated/          # Generated Prisma client
└── types/              # TypeScript type definitions

prisma/
├── schema.prisma       # Database schema
├── migrations/         # Database migrations
└── seed.ts            # Database seeding script
```

## Environment Variables

See `.env.example` for all available environment variables and their descriptions.

## License

ISC