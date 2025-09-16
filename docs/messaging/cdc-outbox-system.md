# CDC-Outbox Messaging System

A unified Change Data Capture (CDC) and Outbox pattern implementation for reliable event-driven architecture with at-least-once delivery guarantees.

## Overview

This system combines CDC audit logging with message publishing using a unified table approach. Instead of separate CDC and outbox tables, each CDC table serves dual purposes:
1. **Audit Trail**: Track all database changes for compliance
2. **Message Outbox**: Queue messages for reliable publishing to RabbitMQ

## Architecture

```
Database Changes → CDC Triggers → Unified CDC-Outbox Tables → Message Publisher → RabbitMQ → API Consumer
```

### Components

1. **CDC-Outbox Tables**: Enhanced CDC tables with message publishing fields
2. **Database Triggers**: Automatically populate outbox fields on data changes
3. **Message Publisher Service**: Separate Node.js service that polls CDC tables
4. **RabbitMQ**: Message broker with exchanges, queues, and routing
5. **API Consumer**: Message consumer integrated into the main API

## Database Schema

### CDC Table Structure
Each CDC table (prefixed with `_cdc_`) contains:

**Audit Fields (existing)**:
- `operation`: INSERT/UPDATE/DELETE
- `old_data`, `new_data`: Before/after values
- `editedBy`, `editedAt`, `editedSession`: Audit metadata

**Outbox Fields (added)**:
- `message_id`: Unique message identifier
- `topic`: RabbitMQ exchange name
- `routing_key`: Message routing key
- `message_status`: pending/processing/published/failed/dead
- `message_priority`: low/normal/high/critical
- `retry_count`, `max_retries`: Retry logic
- `correlation_id`: Message tracing
- `published_at`, `failed_at`: Timestamps

### Example CDC Table
```sql
-- _cdc_users table
CREATE TABLE _cdc_users (
  -- CDC audit fields
  id SERIAL PRIMARY KEY,
  operation cdc_operation NOT NULL,
  table_name VARCHAR(255) NOT NULL,
  old_data JSONB,
  new_data JSONB,
  editedBy INTEGER,
  editedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  editedSession VARCHAR(255),
  
  -- Outbox message fields
  message_id UUID DEFAULT gen_random_uuid(),
  topic VARCHAR(255),
  routing_key VARCHAR(255),
  message_status message_status DEFAULT 'pending',
  message_priority message_priority DEFAULT 'normal',
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  correlation_id VARCHAR(255),
  published_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE
);
```

## Configuration

### cdc-outbox.yml
The system uses a hybrid configuration approach:

```yaml
cdc_outbox:
  config:
    enabled: true
    publish_all_cdc_by_default: true  # Auto-publish all CDC tables
    default_topic: "database.changes"
    default_routing_pattern: "{table_name}.{operation}"
    
  # Opt-out specific tables
  disabled_tables:
    - sessions  # Too noisy
    
  # Custom configurations for specific tables
  table_overrides:
    users:
      topic: "user.lifecycle"
      routing:
        INSERT: "user.created"
        UPDATE: "user.updated"
        DELETE: "user.deleted"
      priority: high
      exclude_fields: ["password", "salt"]  # Security
```

### Publisher Configuration
```yaml
publisher:
  poll_interval_seconds: 5
  batch_size: 50
  max_concurrent_batches: 3
  retry_backoff_base_seconds: 30
  retry_backoff_multiplier: 2
```

## Message Publisher Service

### Architecture
- **Separate Node.js service** (not part of main API)
- **Polls CDC tables** for pending messages
- **Publishes to RabbitMQ** with retry logic
- **Handles failures** with dead letter queues

### Key Features
- **Concurrent processing** of multiple CDC tables
- **Priority-based message ordering**
- **Exponential backoff retry** with configurable limits
- **Dead letter queue** for poison messages
- **Maintenance jobs** for cleanup and statistics

### Docker Integration
```yaml
# docker-compose.yml
message-publisher:
  build: ./services/message-publisher
  environment:
    DATABASE_URL: postgresql://user:pass@postgres:5432/db
    RABBITMQ_URL: amqp://rabbitmq:5672
  depends_on:
    - postgres
    - rabbitmq
```

## Message Consumer (API Integration)

### Manual ACK Implementation
The consumer uses **manual acknowledgment mode** for reliable processing:

```typescript
// SUCCESS: Message processed successfully
channel.ack(msg); // ✅ Remove from queue

// RETRYABLE ERROR: Temporary failure
channel.nack(msg, false, true); // 🔄 Requeue for retry

// PERMANENT ERROR: Business logic failure  
channel.nack(msg, false, false); // ❌ Discard (send to DLQ)
```

### Error Classification
```typescript
private isRetryableError(error: Error): boolean {
  const retryableErrors = [
    'ECONNREFUSED',          // Network connectivity
    'TIMEOUT',               // Service timeouts
    'DATABASE_CONNECTION_ERROR', // DB issues
    'RATE_LIMIT_EXCEEDED',   // Temporary throttling
  ];
  return retryableErrors.some(type => error.message.includes(type));
}
```

### Message Processing Flow
```typescript
async handleMessage(message: ConsumedMessage): Promise<void> {
  try {
    // Route based on message type
    switch (message.routingKey) {
      case 'user.created':
        await this.onUserCreated(message.payload);
        return true; // ✅ ACK
        
      case 'user.permission.granted':
        await this.invalidatePermissionCache(message.payload.userId);
        return true; // ✅ ACK
    }
  } catch (error) {
    if (this.isRetryableError(error)) {
      throw error; // 🔄 Will be retried
    } else {
      logger.error('Non-retryable error', error);
      return true; // ✅ ACK to prevent poison message
    }
  }
}
```

## Example Usage

### 1. User Event Handler
```typescript
import { MessageConsumer, ConsumedMessage } from '../messaging/message-consumer';

export class UserEventHandler {
  private consumer: MessageConsumer;

  constructor() {
    this.consumer = new MessageConsumer({
      connectionString: process.env.RABBITMQ_URL!,
      prefetch: 1,        // Fair distribution
      maxRetries: 3,      // Retry failed messages
      retryDelayMs: 1000, // Exponential backoff
    });

    this.consumer.on('message', this.handleMessage.bind(this));
  }

  async start(): Promise<void> {
    await this.consumer.connect();
    await this.consumer.consume('user.lifecycle.events');
    await this.consumer.consume('access.control.events');
  }

  private async handleMessage(
    message: ConsumedMessage, 
    callback: (success: boolean, error?: Error) => void
  ): Promise<void> {
    try {
      const { routingKey, payload } = message;
      
      switch (routingKey) {
        case 'user.created':
          await this.onUserCreated(payload.data);
          callback(true); // ✅ ACK
          break;
          
        case 'user.permission.granted':
          await this.invalidateUserPermissionCache(payload.data.userId);
          callback(true); // ✅ ACK
          break;
          
        default:
          callback(true); // ✅ ACK unknown messages
      }
    } catch (error) {
      callback(false, error as Error); // ❌ NACK with retry
    }
  }

  private async onUserCreated(userData: any): Promise<void> {
    // Business logic: send welcome email, create preferences, etc.
    console.log('User created:', userData.id);
    
    // Simulate retryable failure (10% chance)
    if (Math.random() < 0.1) {
      throw new Error('TEMPORARY_SERVICE_UNAVAILABLE');
    }
  }

  private async invalidateUserPermissionCache(userId: string): Promise<void> {
    // Clear permission cache when permissions change
    console.log('Invalidating permission cache for user:', userId);
  }
}
```

### 2. Integration in API
```typescript
// src/main.ts
import { UserEventHandler } from './messaging/user-event-handler';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Start message consumption
  if (process.env.RABBITMQ_URL) {
    const userEventHandler = new UserEventHandler();
    await userEventHandler.start();
    console.log('🔄 Message consumer started');
    
    // Graceful shutdown
    process.on('SIGTERM', async () => {
      await userEventHandler.stop();
    });
  }

  await app.listen(3000);
}
```

## Message Flow Examples

### 1. User Registration Flow
```
1. User registers → INSERT into users table
2. CDC trigger → Creates record in _cdc_users with:
   - message_status: 'pending'
   - topic: 'user.lifecycle'  
   - routing_key: 'user.created'
3. Publisher service → Polls _cdc_users, finds pending message
4. Publisher → Publishes to RabbitMQ exchange 'user.lifecycle'
5. API consumer → Receives message, processes welcome email
6. Success → ACK message, publisher marks as 'published'
```

### 2. Permission Change Flow
```
1. Admin grants permission → INSERT into permissionsUsersMap
2. CDC trigger → Creates record with:
   - topic: 'access.control'
   - routing_key: 'user.permission.granted'
   - priority: 'critical'
3. Publisher → Processes high-priority message first
4. API consumer → Invalidates user's permission cache
5. Success → ACK, user sees new permissions immediately
```

## Monitoring & Operations

### Message States
- **pending**: New message, ready for publishing
- **processing**: Currently being published
- **published**: Successfully delivered and ACKed
- **failed**: Temporary failure, will retry
- **dead**: Permanently failed after max retries

### Maintenance
```sql
-- Check message statistics
SELECT * FROM get_cdc_outbox_stats();

-- Clean up old published messages (runs daily via cron)
SELECT cleanup_published_cdc_messages(7); -- 7 days
```

### Dead Letter Queue Handling
Failed messages are sent to `{topic}.dlq` exchanges for manual inspection:
- `user.lifecycle.dlq`
- `access.control.dlq`

## Benefits

### 1. Reliability
- **Transactional outbox**: Messages written in same transaction as data
- **At-least-once delivery**: Messages guaranteed to be delivered
- **Automatic retries**: Temporary failures are retried with backoff
- **DLQ handling**: Poison messages don't break the system

### 2. Performance  
- **Asynchronous processing**: No impact on main application
- **Batch processing**: Publisher processes messages in batches
- **Priority handling**: Critical messages processed first

### 3. Observability
- **Message tracking**: Every message has correlation ID
- **Audit trail**: Complete history of all changes
- **Metrics**: Processing time, failure rates, queue depths

### 4. Security
- **Field filtering**: Sensitive data excluded from messages
- **Access control**: Only authorized services can consume
- **Encryption**: Messages encrypted in transit

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/db

# RabbitMQ  
RABBITMQ_URL=amqp://localhost:5672
RABBITMQ_USER=guest
RABBITMQ_PASSWORD=guest

# Message Publisher
MESSAGE_PUBLISHER_LOG_LEVEL=info
CDC_OUTBOX_CONFIG_PATH=/path/to/cdc-outbox.yml

# Consumer Settings
CONSUMER_PREFETCH=1
CONSUMER_MAX_RETRIES=3
CONSUMER_RETRY_DELAY_MS=1000
```

## Deployment

### Docker Compose
```bash
# Start all services
docker-compose up -d

# Check message publisher logs
docker logs app-message-publisher

# Access RabbitMQ management UI
http://localhost:15672 (guest/guest)

# Monitor message queues
docker exec -it app-rabbitmq rabbitmqctl list_queues
```

### Production Considerations
1. **Resource limits**: Set appropriate CPU/memory limits
2. **Connection pooling**: Configure database connection pools
3. **Message retention**: Set appropriate TTL for messages
4. **Monitoring**: Set up alerts for queue depths and failures
5. **Security**: Use proper authentication and TLS
6. **Backup**: Regular backups of message state

## Troubleshooting

### Common Issues
1. **Messages stuck in pending**: Check publisher service logs
2. **High retry count**: Look for database connectivity issues
3. **Growing DLQ**: Investigate poison messages
4. **Consumer errors**: Check message format and handlers

### Debugging Commands
```bash
# Check CDC table message status
SELECT message_status, COUNT(*) FROM _cdc_users GROUP BY message_status;

# Find failed messages
SELECT * FROM _cdc_users WHERE message_status = 'failed' ORDER BY failed_at DESC;

# Monitor RabbitMQ queues
rabbitmqctl list_queues name messages consumers
```