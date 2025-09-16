# Quick Setup Guide - Monitoring System

This guide helps you get the monitoring system running in 5 minutes.

## 1. Start the Services

```bash
# Navigate to project root
cd ventum-framework

# Start all services (includes monitoring)
npm run start

# Wait for services to be healthy (30-60 seconds)
```

## 2. Verify Everything is Running

```bash
# Check all services are up
docker ps

# Should show:
# - app-opensearch
# - app-opensearch-dashboards  
# - app-api
# - app-web
# - app-postgres
# - app-rabbitmq

# Test OpenSearch
curl http://localhost:9200/_cluster/health
# Should return: {"cluster_name":"app-logs","status":"green"...}

# Test health endpoint
curl http://localhost:3000/api/health | jq '.status'
# Should return: "healthy"
```

## 3. Access OpenSearch Dashboards

1. Open http://localhost:5601
2. Click **"Explore on my own"** (skip tutorial)
3. Go to **Stack Management** → **Index Patterns**
4. Create index pattern: `logs-*` with time field `@timestamp`
5. Go to **Discover** to see logs

## 4. Initialize Frontend Monitoring

Add to your React app's main file (`src/main.tsx`):

```typescript
import { initializeMonitoring } from './utils/monitoring-setup';

// Initialize monitoring before your app
initializeMonitoring();

// Your existing app code...
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

## 5. Test Logging

### Frontend Test
```typescript
import { frontendLogger } from './utils/logger';

// Test logging
frontendLogger.info('Frontend monitoring test');
frontendLogger.error('Test error', new Error('This is a test'));
```

### Backend Test
```bash
# Make some API calls to generate logs
curl http://localhost:3000/api/health
curl http://localhost:3000/api/logs -X POST \
  -H "Content-Type: application/json" \
  -d '{"logs":[{"level":"info","message":"Test from curl","timestamp":"2024-01-15T10:30:00.000Z"}]}'
```

## 6. View Logs in Dashboard

1. Go back to http://localhost:5601
2. Click **Discover** in the left menu
3. Select the `logs-*` index pattern
4. You should see logs appearing from both frontend and backend

## That's It! 🎉

Your monitoring system is now running. See the [full guide](./MONITORING_GUIDE.md) for advanced usage.

## Quick Commands

```bash
# View logs
docker logs app-opensearch
docker logs app-api

# Check health
curl localhost:3000/api/health | jq

# Restart monitoring services
docker-compose restart opensearch opensearch-dashboards

# Clean restart
docker-compose down
docker-compose up -d
```

## Troubleshooting

**OpenSearch won't start:**
- Check available memory (needs ~512MB)
- Increase Docker memory limit if needed

**No logs appearing:**
- Check network connectivity: `curl localhost:9200`
- Verify index patterns exist
- Check for errors in browser console

**Dashboard not loading:**
- Wait for OpenSearch to be fully ready (green status)
- Check `docker logs app-opensearch-dashboards`

For more help, see [MONITORING_GUIDE.md](./MONITORING_GUIDE.md).