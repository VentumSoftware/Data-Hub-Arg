# Docker Development Setup

This project is configured to run fully containerized in development for consistency across all environments.

## Quick Start

```bash
# First time setup
npm install
cp .env.example .env

# Start all services (containerized)
npm run dev

# View logs
npm run dev:logs

# Stop services
npm run dev:stop
```

## Available Commands

### Primary Development Commands
- `npm run dev` - Start all services in Docker containers with hot-reload
- `npm run dev:stop` - Stop all containers
- `npm run dev:logs` - View logs from all services
- `npm run dev:clean` - Stop containers and remove volumes (fresh start)
- `npm run dev:rebuild` - Rebuild containers from scratch

### Service-Specific Commands
- `npm run dev:api` - View API logs only
- `npm run dev:web` - View Web app logs only
- `npm run dev:monitoring` - Start with monitoring tools (OpenSearch Dashboards)

### Local Development (without Docker)
- `npm run dev:local` - Run services locally (requires local PostgreSQL, etc.)

## Services & Ports

When running `npm run dev`, the following services are available:

- **Web App**: http://localhost:5173
- **API**: http://localhost:3000
- **PostgreSQL**: localhost:5432
- **RabbitMQ Management**: http://localhost:15672 (guest/guest)
- **OpenSearch**: http://localhost:9200
- **OpenSearch Dashboards**: http://localhost:5601 (with `dev:monitoring`)
- **SFTP**: localhost:2222

## Hot Reload

Both the API and Web services are configured with hot-reload:
- API changes will automatically restart the NestJS server
- Web changes will trigger Vite's HMR (Hot Module Replacement)

## Database Management

```bash
# Run migrations
docker compose -f docker-compose.dev.yml exec api npm run db:migrate

# Seed database
docker compose -f docker-compose.dev.yml exec api npm run db:seed

# Reset database
npm run dev:clean
npm run dev
```

## Troubleshooting

### Containers not starting?
```bash
npm run dev:clean
npm run dev:rebuild
```

### Port conflicts?
Check if ports are already in use and modify `.env` file accordingly:
- `API_PORT`
- `WEB_PORT`
- `POSTGRES_PORT`
- etc.

### File changes not detected?
The containers use volume mounts for hot-reload. If you're on Windows or having issues:
1. Ensure Docker Desktop has file sharing enabled for your project directory
2. Try restarting Docker Desktop
3. Use `npm run dev:rebuild` to rebuild containers

## Production Deployment

For production deployment, use:
```bash
npm run start:prod
```

This uses the optimized production Docker configuration in `devops/docker/docker-compose.yml`.