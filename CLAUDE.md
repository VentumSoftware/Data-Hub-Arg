# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **indexes-app**, a full-stack application built with the Ventum Framework. It's a monorepo with three main packages: backend (NestJS), frontend (React/Vite), and mobile (React Native/Expo). The application runs fully containerized in development with Docker Compose.

## Essential Commands

### Development
```bash
# Start all services (Docker containerized with hot-reload)
npm run dev

# View logs from all services
npm run dev:logs

# Stop all services
npm run dev:stop

# Clean restart (removes volumes)
npm run dev:clean && npm run dev

# Rebuild containers from scratch
npm run dev:rebuild

# Run locally without Docker (requires local PostgreSQL, etc.)
npm run dev:local
```

### Database Operations
```bash
# Push schema changes (Drizzle ORM)
cd packages/api && npm run migration:push

# Seed database
npm run db:seed

# Run full migration (push + seed + audit)
cd packages/api && npm run migration:full

# Setup CDC (Change Data Capture) system
cd packages/api && npm run cdc:setup

# Backup CDC data
cd packages/api && npm run cdc:backup
```

### Building & Testing
```bash
# Build all packages
npm run build

# Run tests for all packages
npm run test

# Lint all packages
npm run lint

# Individual package commands
npm run test --workspace=api
npm run test --workspace=web
npm run lint --workspace=api
```

### Mobile Development
```bash
# Start Expo development server
npm run mobile:start

# Run on specific platforms
npm run mobile:ios
npm run mobile:android
npm run mobile:web
```

### Production Deployment
```bash
# Start production services
npm run start:prod

# Deploy to environments
npm run deploy:dev
npm run deploy:staging
npm run deploy:prod
```

## Architecture

### Monorepo Structure
- **packages/api/** - NestJS backend with Drizzle ORM, PostgreSQL
- **packages/web/** - React frontend with Vite, Material-UI, Redux Toolkit
- **packages/mobile/** - React Native app with Expo
- **packages/shared/** - Shared utilities across packages
- **devops/docker/** - Docker Compose configurations (dev, staging, production)
- **services/** - Supporting services (nginx, message-publisher, sftp)
- **scripts/** - Cross-platform build and deployment scripts

### Backend Architecture (packages/api/)

**Core Modules:**
- `src/access/` - Authentication, authorization (guards, decorators, services)
  - Session-based auth with cookie-parser
  - Permission-based access control with custom guards
  - Role-based access control (RBAC)
  - Google OAuth integration
- `src/dashboard/indexes/` - Main business logic for indexes
- `src/database/` - Database service and query builder
- `src/fs/` - File system management module
- `src/messaging/` - RabbitMQ message consumer
- `src/logger/` - Custom logging with Winston and OpenSearch integration
- `src/common/` - Shared utilities, health checks, metrics

**Database (Drizzle ORM):**
- Schema defined in `drizzle/schema.ts`
- Migrations in `drizzle/migrations/`
- CDC (Change Data Capture) system for tracking all database changes
- Hybrid CDC-Outbox pattern for message publishing (config: `drizzle/config/cdc-outbox.yml`)
- Database seeding in `drizzle/seeds/`

**Key Concepts:**
- All database changes are tracked via CDC triggers
- Message publisher service reads CDC outbox and publishes to RabbitMQ
- Permission system uses decorators like `@RequirePermissions()` and guards
- Session store backed by PostgreSQL (not in-memory)

### Frontend Architecture (packages/web/)

**Tech Stack:**
- React 18 with TypeScript
- Vite for build tooling
- Material-UI (@mui) for components
- Redux Toolkit for state management (with redux-persist)
- React Router for navigation

**Structure:**
- `src/components/` - Reusable UI components
- `src/pages/` - Page components (dashboard, indexes, landing, signIn)
- `src/store/` - Redux store and slices
- `src/hooks/` - Custom React hooks
- `src/utils/` - Utility functions
- `src/theme.ts` & `src/ThemeContext.tsx` - Theme configuration

### Infrastructure & Services

**Docker Compose Services (devops/docker/docker-compose.dev.yml):**
- **postgres** - PostgreSQL 15 database (port 5434 external)
- **api** - NestJS backend with hot-reload
- **web** - Vite frontend with HMR
- **nginx** - Reverse proxy (port 8080 - ONLY external access point)
- **rabbitmq** - Message broker (management UI on port 15673)
- **message-publisher** - CDC outbox publisher service
- **sftp** - SFTP server (port 2223)
- **opensearch** - Log aggregation (port 9201)
- **opensearch-dashboards** - Log visualization (port 5602)

**Access Points:**
- Frontend: http://localhost:8080 (via nginx)
- API: http://localhost:8080/api (via nginx)
- Direct API: http://localhost:3000 (only from containers)
- Direct Web: http://localhost:5173 (only from containers)
- Database: localhost:5434

### Template Synchronization

This project syncs with the Ventum Framework template:
- Template repo: https://github.com/jbnogal-ventum/ventum-framework.git
- Config: `.template-config.json`
- Sync command: `npm run sync-template`
- Protected files/dirs won't be overwritten (see .template-config.json)

## Development Workflow

### Running a Single Test
```bash
# Backend
cd packages/api
npm run test -- <test-file-path>

# Frontend
cd packages/web
npm run test -- <test-file-path>
```

### Database Workflow
1. Modify schema in `packages/api/drizzle/schema.ts`
2. Push changes: `cd packages/api && npm run migration:push`
3. Seed if needed: `npm run db:seed`
4. For production migrations, use the generated SQL in `drizzle/migrations/`

### Adding New Features
1. Backend: Create module in `src/<feature-name>/`
2. Add module to `src/app.module.ts`
3. Define permissions in permission registry if needed
4. Frontend: Add page/component and route
5. Update Redux store if state management needed

### CDC Outbox Configuration
- Config file: `packages/api/drizzle/config/cdc-outbox.yml`
- All CDC tables publish by default
- Custom routing and topics per table
- Message publisher runs as separate service
- Priority levels: critical, high, normal, low

### Permission System
- Permissions defined in `src/common/permissions/permission-registry.ts`
- Use `@RequirePermissions('permission.name')` decorator on controllers
- Guards check user permissions against database
- Scope-based permissions supported (e.g., per-group access)

## Environment Configuration

Docker Compose has built-in defaults in `devops/docker/docker-compose.dev.yml`. Environment file hierarchy:
1. `.env.local` - Personal overrides (gitignored)
2. `.env` - Project overrides (gitignored)
3. `docker-compose.dev.yml` defaults - Used if no `.env` exists

**For development**: Just `npm run dev` - no `.env` file needed!

**To customize**: `cp .env.example .env` and edit values

## Important Notes

- **All external access goes through nginx** - don't expose services directly
- **Hot reload is enabled** - file changes auto-reload in Docker
- **PostgreSQL CDC tracks all changes** - use for audit trails and event sourcing
- **Session management** - sessions stored in PostgreSQL, not Redis
- **Ports are configurable** - defaults avoid conflicts (check devops/docker/docker-compose.dev.yml)
- **Mobile app** - separate Expo-based React Native app in packages/mobile/
- **Drizzle ORM** - use `npm run migration:push` to sync schema changes
- **Message broker** - RabbitMQ for async operations and event publishing
- **Logs** - centralized in OpenSearch, viewable in OpenSearch Dashboards

## Common Issues

### Database Connection Issues
Ensure PostgreSQL is healthy: `docker compose -f docker-compose.dev.yml ps`
Check logs: `npm run dev:logs | grep postgres`

### Port Conflicts
Modify ports in `.env` file (external ports are commented in docker-compose.dev.yml)

### Hot Reload Not Working
1. Ensure volumes are mounted correctly
2. Try `npm run dev:rebuild`
3. On Windows, enable Docker file sharing for project directory

### Migration Issues
1. Check CDC system is set up: `cd packages/api && npm run cdc:verify`
2. Reset database: `npm run dev:clean && npm run dev`
3. Manually run migrations: `cd packages/api && npm run migration:push`
