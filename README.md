# Data Hub Argentina

A full-stack application for managing Argentine economic indexes and currency exchange rates, built with NestJS, React, and PostgreSQL.

## Quick Start

Get the application running in 2 simple steps:

```bash
# 1. Clone the repository
git clone <repository-url>
cd data-hub-arg

# 2. Start all services (Docker required)
npm run dev
```

**That's it!** Docker Compose uses sensible defaults from `docker-compose.dev.yml`. No `.env` file needed for local development.

### Optional: Customize Configuration

To override default settings:

```bash
cp .env.example .env
# Edit .env with your custom values
```

## Environment Configuration

Docker Compose has sensible defaults built-in (see `devops/docker/docker-compose.dev.yml`). For custom configuration:

**Environment file hierarchy (highest to lowest priority):**
1. `.env.local` - Your personal overrides (gitignored)
2. `.env` - Project overrides (gitignored)
3. `.env.example` - Template/documentation (committed)
4. `devops/docker/docker-compose.dev.yml` defaults - Used if no `.env` exists

**For most users:** No configuration needed - just run `npm run dev`!

**To customize:** `cp .env.example .env` and edit values

## Development Commands

### Starting Services

```bash
npm run dev              # Start all services with hot-reload
npm run dev:logs         # View logs from all services
npm run dev:stop         # Stop all services
npm run dev:clean        # Stop and remove volumes (fresh start)
```

### Database Management

```bash
npm run db:migrate       # Push database schema changes
npm run db:seed          # Seed database with initial data
npm run db:reset         # Full reset (migrate + seed + audit)
npm run db:status        # Check database connection
```

### Testing & Building

```bash
npm run test             # Run all tests
npm run lint             # Lint all packages
npm run build            # Build for production
```

## Project Structure

```
data-hub-arg/
├── packages/
│   ├── api/             # NestJS backend
│   ├── web/             # React frontend (Vite)
│   ├── mobile/          # React Native app (Expo)
│   └── shared/          # Shared utilities
├── devops/
│   └── docker/          # Docker Compose configs (dev, staging, prod)
├── services/
│   ├── nginx/           # Reverse proxy configuration
│   └── message-publisher/ # CDC outbox publisher
└── scripts/             # Build and deployment scripts
```

## Access Points

When running locally:

- **Application**: http://localhost:8080
- **API Documentation**: http://localhost:8080/api/docs
- **Database**: localhost:5434
- **RabbitMQ Management**: http://localhost:15673
- **OpenSearch Dashboards**: http://localhost:5602

## Tech Stack

- **Backend**: NestJS, Drizzle ORM, PostgreSQL
- **Frontend**: React 18, Vite, Material-UI, Redux Toolkit
- **Mobile**: React Native, Expo
- **Infrastructure**: Docker, Nginx, RabbitMQ, OpenSearch
- **Database**: PostgreSQL with CDC (Change Data Capture)

## Key Features

- 🔐 **Session-based authentication** with optional Google OAuth
- 👥 **Role-based access control** (RBAC) with fine-grained permissions
- 💱 **Currency exchange tracking** for multiple Argentine dollar rates
- 📊 **Economic indexes** (CPI, CAC, UVA, etc.)
- 📝 **CDC & Event Sourcing** - All database changes tracked and published
- 🔍 **Centralized logging** with OpenSearch
- 🚀 **Hot Module Replacement** for both frontend and backend

## Sample Users

After seeding, you can login with these test accounts:

- **Superadmin**: admin@ventum.dev
- **Manager**: pm@ventum.dev
- **User**: employee@ventum.dev

(All sample users have placeholder passwords - check seed data for details)

## Troubleshooting

### Services not starting?

```bash
npm run dev:clean        # Clean slate
npm run dev:rebuild      # Rebuild from scratch
```

### Database issues?

```bash
npm run db:status        # Check connection
npm run db:reset         # Reset everything
```

### Port conflicts?

Edit `.env.local` and change the port numbers:
```
NGINX_HTTP_PORT=8081
POSTGRES_EXTERNAL_PORT=5435
```

## License

MIT
