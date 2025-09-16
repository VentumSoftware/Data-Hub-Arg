# Monitoring and Logging System Guide

## Overview

The Ventum Framework includes a comprehensive monitoring and logging system built with **OpenSearch** and **OpenSearch Dashboards** - fully open source alternatives to Elasticsearch and Kibana.

## Architecture

```
Frontend → Backend API → OpenSearch → OpenSearch Dashboards
    ↓           ↓
 Browser     Server
 Logs        Logs
```

### Components

1. **Frontend Logging**: Browser-based error tracking and user analytics
2. **Backend Logging**: Server-side application logs with structured JSON
3. **OpenSearch**: Search and analytics engine for log storage
4. **OpenSearch Dashboards**: Visualization and monitoring dashboards
5. **Health Monitoring**: Application health checks and metrics
6. **Performance Monitoring**: API response times and system metrics

## Services

| Service | URL | Description |
|---------|-----|-------------|
| OpenSearch | http://localhost:9200 | Search engine and log storage |
| OpenSearch Dashboards | http://localhost:5601 | Visualization and dashboards |
| Health Check | http://localhost:3000/api/health | Application health status |
| Log Endpoint | http://localhost:3000/api/logs | Frontend log ingestion |

## Getting Started

### 1. Start the Monitoring Stack

```bash
# Start all services including monitoring
npm run start

# Or start monitoring services only
docker-compose up opensearch opensearch-dashboards
```

### 2. Verify Services

```bash
# Check OpenSearch health
curl http://localhost:9200/_cluster/health

# Check application health
curl http://localhost:3000/api/health

# Access OpenSearch Dashboards
open http://localhost:5601
```

### 3. Initialize Frontend Monitoring

In your React application, initialize monitoring:

```typescript
// src/main.tsx
import { initializeMonitoring } from './utils/monitoring-setup';

// Initialize monitoring systems
initializeMonitoring();

// Your app initialization...
```

## Frontend Logging

### Automatic Logging

The system automatically logs:

- **Unhandled JavaScript errors**
- **Unhandled promise rejections**  
- **Page navigation events**
- **API call responses** (configurable)
- **Performance metrics**

### Manual Logging

```typescript
import { useLogger } from './hooks/useLogger';

function MyComponent() {
  const logger = useLogger({ component: 'MyComponent' });

  const handleSubmit = async (data) => {
    try {
      logger.logUserAction('form_submit', { formType: 'contact' });
      
      const response = await api.submit(data);
      
      logger.logInfo('Form submitted successfully', {
        responseId: response.id
      });
    } catch (error) {
      logger.logError('Form submission failed', error, {
        formData: data
      });
    }
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

### Available Logging Methods

```typescript
// Basic logging
logger.logInfo(message, context?)
logger.logWarn(message, context?)
logger.logError(message, error?, context?)
logger.logDebug(message, context?)

// Specialized logging
logger.logUserAction(action, details?, context?)
logger.logPageView(page, context?)
logger.logApiCall(method, url, duration, status, context?)
logger.logPerformance(metric, value, context?)
```

## Backend Logging

### Automatic Logging

The system automatically logs:

- **HTTP requests/responses** with timing
- **Database operations** (via integration)
- **Authentication events**
- **Permission checks**
- **CDC events** from database changes
- **Message publishing** to RabbitMQ
- **System metrics** (memory, CPU usage)

### Manual Logging

```typescript
import { appLogger } from '../logger/winston.logger';

// Basic logging
appLogger.info('User logged in', {
  userId: user.id,
  operation: 'user_login',
  component: 'auth_service'
});

appLogger.error('Database connection failed', error, {
  operation: 'db_connect',
  database: 'main'
});

// Specialized logging
appLogger.logUserAction('profile_update', userId, {
  changedFields: ['email', 'name']
});

appLogger.logPermissionCheck('users.read', userId, granted, {
  resource: 'user_list'
});
```

## Health Monitoring

### Health Check Endpoints

```bash
# Comprehensive health check
GET /api/health
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600000,
  "services": {
    "database": { "status": "healthy", "responseTime": 5 },
    "opensearch": { "status": "healthy", "responseTime": 12 },
    "rabbitmq": { "status": "healthy" },
    "logging": { "status": "healthy" }
  },
  "system": {
    "memory": { "heapUsed": 45.2, "heapTotal": 100.0 },
    "cpu": 12.5,
    "uptime": 3600
  }
}

# Kubernetes readiness probe
GET /api/health/ready

# Kubernetes liveness probe  
GET /api/health/live
```

### Application Metrics

The system automatically collects:

- **HTTP request metrics**: Count, duration, status codes
- **Database query metrics**: Query count, duration, errors
- **System metrics**: Memory usage, CPU, uptime
- **Business metrics**: User actions, auth events
- **Message metrics**: Publishing success/failure rates

## OpenSearch Dashboards

### Access

Open http://localhost:5601 to access OpenSearch Dashboards.

### Index Patterns

The system creates these index patterns:

- `logs-*`: Application logs from frontend and backend
- `metrics-*`: Application metrics and performance data

### Default Dashboards

1. **Application Overview**: System health and key metrics
2. **Error Tracking**: Error logs and failure rates  
3. **Performance Monitoring**: Response times and throughput
4. **User Activity**: User actions and behavior

### Creating Custom Dashboards

1. Go to **Dashboard** → **Create new dashboard**
2. Add visualizations for your specific needs:
   - **Log frequency** over time
   - **Error rates** by component
   - **API response times** by endpoint
   - **User activity** patterns

### Useful Queries

```javascript
// Find all errors in the last hour
{
  "query": {
    "bool": {
      "must": [
        { "match": { "level": "error" } },
        { "range": { "@timestamp": { "gte": "now-1h" } } }
      ]
    }
  }
}

// API calls with high response time
{
  "query": {
    "bool": {
      "must": [
        { "match": { "operation": "http_request" } },
        { "range": { "duration": { "gte": 1000 } } }
      ]
    }
  }
}

// User actions by component
{
  "query": {
    "bool": {
      "must": [
        { "match": { "operation": "user_action" } }
      ]
    }
  },
  "aggs": {
    "by_component": {
      "terms": { "field": "component" }
    }
  }
}
```

## Configuration

### Environment Variables

```bash
# .env
OPENSEARCH_URL=http://opensearch:9200
OPENSEARCH_PORT=9200
OPENSEARCH_DASHBOARDS_PORT=5601
LOG_LEVEL=info
LOG_REQUESTS=false  # Set to true for request logging in development
```

### Log Levels

- `error`: Error conditions
- `warn`: Warning conditions  
- `info`: Informational messages (default)
- `debug`: Debug-level messages

### Retention Policy

By default:
- **Logs**: Kept for 30 days
- **Metrics**: Kept for 90 days
- **System logs**: Rotated at 5MB, keep 5 files

Configure in `services/opensearch/opensearch.yml`.

## Production Considerations

### Security

```bash
# For production, enable OpenSearch security
# In services/opensearch/opensearch.yml:
plugins.security.disabled: false

# Set up authentication and SSL
plugins.security.ssl.http.enabled: true
plugins.security.ssl.transport.enabled: true
```

### Performance

```bash
# Increase memory for production
OPENSEARCH_JAVA_OPTS=-Xms1g -Xmx1g

# Enable multiple nodes
discovery.type: multi-node
cluster.initial_master_nodes: ["node1", "node2", "node3"]
```

### Monitoring

Set up alerts for:
- **High error rates** (>5% in 5 minutes)
- **Slow API responses** (>2 seconds average)
- **OpenSearch cluster health** (yellow/red status)
- **High memory usage** (>90% for 5 minutes)

## Troubleshooting

### OpenSearch Issues

```bash
# Check OpenSearch logs
docker logs app-opensearch

# Check cluster health
curl "localhost:9200/_cluster/health?pretty"

# Check indices
curl "localhost:9200/_cat/indices?v"
```

### Dashboard Issues  

```bash
# Check OpenSearch Dashboards logs
docker logs app-opensearch-dashboards

# Reset dashboards (if needed)
docker exec app-opensearch-dashboards \
  curl -X DELETE "http://opensearch:9200/.opensearch_dashboards*"
```

### Application Logging Issues

```bash
# Test log endpoint
curl -X POST localhost:3000/api/logs \
  -H "Content-Type: application/json" \
  -d '{"logs":[{"level":"info","message":"test","timestamp":"2024-01-15T10:30:00.000Z"}]}'

# Check backend logs
docker logs app-api

# Verify OpenSearch connection
curl localhost:3000/api/health | jq '.services.opensearch'
```

### Common Issues

1. **No logs appearing**: Check network connectivity between services
2. **High memory usage**: Reduce log retention or increase OpenSearch memory
3. **Slow queries**: Add more specific filters or increase OpenSearch resources
4. **Missing data**: Check log shipping and index patterns

## Best Practices

### Logging

1. **Use structured logging** with consistent field names
2. **Include correlation IDs** for request tracing
3. **Log at appropriate levels** (don't log sensitive data)
4. **Include relevant context** (user ID, operation, component)
5. **Use sampling** for high-volume debug logs

### Monitoring

1. **Set up alerts** for critical metrics
2. **Monitor business KPIs** alongside technical metrics
3. **Create focused dashboards** for different roles
4. **Regular cleanup** of old indices
5. **Monitor the monitoring system** itself

### Performance

1. **Batch log shipments** from frontend
2. **Use appropriate index patterns**
3. **Optimize OpenSearch queries**
4. **Monitor resource usage**
5. **Scale horizontally** when needed

## Integration Examples

### Custom Metrics

```typescript
// Backend - custom business metric
import { MetricsService } from '../common/metrics/metrics.service';

@Injectable()
export class OrderService {
  constructor(private readonly metrics: MetricsService) {}

  async createOrder(order: Order) {
    const startTime = Date.now();
    
    try {
      const result = await this.processOrder(order);
      
      // Record successful order
      this.metrics.incrementCounter('orders_created_total', {
        region: order.region,
        product_type: order.type
      });
      
      return result;
    } catch (error) {
      // Record failed order
      this.metrics.incrementCounter('orders_failed_total', {
        region: order.region,
        error_type: error.constructor.name
      });
      throw error;
    } finally {
      // Record processing time
      this.metrics.recordHistogram('order_processing_duration_ms', 
        Date.now() - startTime, 
        { region: order.region }
      );
    }
  }
}
```

### Error Boundary Integration

```typescript
// Frontend - React Error Boundary
import { logErrorBoundary } from '../utils/monitoring-setup';

class ErrorBoundary extends React.Component {
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logErrorBoundary(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorPage />;
    }
    return this.props.children;
  }
}
```

This monitoring system provides comprehensive observability for your application with minimal setup and maintenance overhead.