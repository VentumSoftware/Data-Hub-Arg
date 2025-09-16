# indexes-app

Built with [Ventum Framework](https://github.com/your-org/ventum-framework) - A production-ready full-stack template.

## Quick Start

### Using npm scripts (cross-platform):
```bash
# Install dependencies and start
npm run start

# For production mode
npm run start:prod
```

### Or using platform-specific scripts:

**Linux/macOS:**
```bash
./start.sh
```

**Windows:**
```cmd
start.bat
```

## Access Points

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **Database**: localhost:5432

## Development

```bash
# Start development environment
npm run dev

# Start mobile app
npm run mobile:start

# Run tests
npm run test

# Build for production
npm run build

# Stop all services
npm run stop
```

## Mobile App

```bash
# Start Expo development server
npm run mobile:start

# Run on iOS simulator
npm run mobile:ios

# Run on Android emulator
npm run mobile:android

# Run in web browser
npm run mobile:web
```

## Project Structure

```
indexes-app/
├── packages/
│   ├── backend/          # NestJS API server
│   ├── frontend/         # React application
│   ├── mobile/           # React Native app
│   └── shared/           # Shared utilities
├── services/
│   ├── nginx/            # Nginx configurations
│   └── sftp/             # SFTP server config
├── scripts/              # Cross-platform scripts
├── docker-compose.yml    # Docker configuration
└── .env                  # Environment variables
```

## Configuration

All configuration is in `.env`. See `.env.example` for available options.

## License

MIT
