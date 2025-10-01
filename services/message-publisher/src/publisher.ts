import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import PQueue from 'p-queue';
import pRetry from 'p-retry';
import * as cron from 'node-cron';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as YAML from 'yaml';
import { createLogger } from './utils/logger';
import { QueueManager } from './queues/queue-manager';

interface CDCOutboxConfig {
  cdc_outbox: {
    config: {
      enabled: boolean;
      publish_all_cdc_by_default: boolean;
      default_topic: string;
      default_routing_pattern: string;
      default_priority: string;
      default_max_retries: number;
      batch_size: number;
    };
    disabled_tables: string[];
    table_overrides: Record<string, any>;
    publisher: {
      poll_interval_seconds: number;
      batch_size: number;
      max_concurrent_batches: number;
      retry_backoff_base_seconds: number;
      retry_backoff_multiplier: number;
    };
  };
}

interface CDCMessage {
  id: number | string;
 // table_name: string;
 _cdc_operation: string;
 _cdc_acknowledge: boolean;
 _cdc_timestamp: Date;
 is_deleted: boolean;
//   message_id: string;
//   topic: string;
//   routing_key: string;
//   old_data: any;
//   new_data: any;
//  // message_priority: string;
//   retry_count: number;
//   max_retries: number;
//   correlation_id: string;

  editedBy?: number;
  editedAt?: Date;
  editedSession?: string;
  [key: string]: any;
}

export class CDCOutboxPublisher {
  private pool: Pool;
  private db: any;
  private config: CDCOutboxConfig;
  private queueManager: QueueManager;
  private processingQueue: PQueue;
  private isRunning: boolean = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private cronJobs: cron.ScheduledTask[] = [];
  private logger = createLogger('CDCOutboxPublisher');
  private cdcTableCache: string[] = [];

  constructor() {
    // Load configuration
    this.config = this.loadConfiguration();
    
    // Setup database connection
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
    });
    
    this.db = drizzle(this.pool);
    
    // Setup queue manager (handles multiple queue types)
    this.queueManager = new QueueManager();
    
    // Setup processing queue with concurrency control
    this.processingQueue = new PQueue({
      concurrency: this.config.cdc_outbox.publisher.max_concurrent_batches,
      interval: 1000,
      intervalCap: this.config.cdc_outbox.publisher.batch_size,
    });
  }

  private loadConfiguration(): CDCOutboxConfig {
    try {
      const configPath = process.env.CDC_OUTBOX_CONFIG_PATH || 
        join(__dirname, '../../../packages/api/drizzle/config/cdc-outbox.yml');
      const configYaml = readFileSync(configPath, 'utf8');
      return YAML.parse(configYaml) as CDCOutboxConfig;
    } catch (error) {
      this.logger.warn({ error }, 'Failed to load config file, using defaults');
      // Return default configuration
      return {
        cdc_outbox: {
          config: {
            enabled: true,
            publish_all_cdc_by_default: true,
            default_topic: 'database.changes',
            default_routing_pattern: '{table_name}.{operation}',
            default_priority: 'normal',
            default_max_retries: 3,
            batch_size: 100,
          },
          disabled_tables: ['sessions'],
          table_overrides: {},
          publisher: {
            poll_interval_seconds: 5,
            batch_size: 50,
            max_concurrent_batches: 3,
            retry_backoff_base_seconds: 30,
            retry_backoff_multiplier: 2,
          },
        },
      };
    }
  }

  async start() {
    if (this.isRunning) {
      this.logger.warn('Publisher already running');
      return;
    }

    this.logger.info('Starting CDC-Outbox Publisher...');
    
    // Initialize queue connections
    await this.queueManager.initialize();
    
    // Discover CDC tables
    await this.discoverCDCTables();
    
    // Start polling for messages
    this.startPolling();
    
    // Setup maintenance cron jobs
    this.setupMaintenanceJobs();
    
    this.isRunning = true;
    this.logger.info('CDC-Outbox Publisher started');
  }

  async stop() {
    this.logger.info('Stopping CDC-Outbox Publisher...');
    
    this.isRunning = false;
    
    // Stop polling
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    
    // Stop cron jobs
    this.cronJobs.forEach(job => job.stop());
    this.cronJobs = [];
    
    // Wait for processing to complete
    await this.processingQueue.onIdle();
    
    // Close connections
    await this.queueManager.close();
    await this.pool.end();
    
    this.logger.info('CDC-Outbox Publisher stopped');
  }

  private async discoverCDCTables() {
    const result = await this.db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '_cdc_%'
    `);
    
    this.cdcTableCache = result.rows.map((row: any) => row.table_name);
    this.logger.info({ tables: this.cdcTableCache }, `Discovered ${this.cdcTableCache.length} CDC tables`);
  }

  private startPolling() {
    const intervalMs = this.config.cdc_outbox.publisher.poll_interval_seconds * 1000;
    
    // Initial poll
    this.pollMessages();
    
    // Setup interval
    this.pollInterval = setInterval(() => {
      if (this.isRunning) {
        this.pollMessages();
      }
    }, intervalMs);
    
    this.logger.info(`Started polling every ${this.config.cdc_outbox.publisher.poll_interval_seconds} seconds`);
  }

  private async pollMessages() {
    try {
      // Process each CDC table
      const pollPromises = this.cdcTableCache.map(tableName => 
        this.processingQueue.add(() => this.processTableMessages(tableName))
      );
      
      await Promise.allSettled(pollPromises);
    } catch (error) {
      this.logger.error({ error }, 'Error in poll cycle');
    }
  }

  private async processTableMessages(tableName: string) {
    const baseTableName = tableName.substring(5); // Remove _cdc_ prefix
    
    // Check if table is disabled
    if (this.config.cdc_outbox.disabled_tables.includes(baseTableName)) {
      return;
    }
    
    try {
      //console.log('Before fetchPendingMessages', tableName);
      // Fetch pending messages
      const messages = await this.fetchPendingMessages(tableName);
      //console.log('After fetchPendingMessages', messages, tableName);
      if (messages.length === 0) {
        return;
      }
      
      this.logger.debug(`Processing ${messages.length} messages from ${tableName}`);
      
      // Process each message
      for (const message of messages) {
        //console.log('Publisher.ts processTableMessages: message', message);
        await this.processMessage(tableName, message);
      }
      
    } catch (error) {
      this.logger.error({ error }, `Error processing table ${tableName}`);
    }
  }

  private async fetchPendingMessages(tableName: string): Promise<CDCMessage[]> {
    const query = sql`
      SELECT * FROM ${sql.identifier(tableName)}
      WHERE _cdc_acknowledge = false
      ORDER BY _cdc_timestamp ASC
      LIMIT ${this.config.cdc_outbox.publisher.batch_size}
      FOR UPDATE SKIP LOCKED
    `;
    
    const result = await this.db.execute(query);
    return result.rows as CDCMessage[];
  }

  private async processMessage(tableName: string, message: CDCMessage) {
  const baseTableName = tableName.substring(5);
  
  try {
    // Generar metadatos de mensajería dinámicamente
    const topic = this.config.cdc_outbox.config.default_topic;
    const routingKey = `${baseTableName}.${message._cdc_operation}`;
    const messageId = `cdc_${tableName}_${message._cdc_id}_${Date.now()}`;
    
    const payload = this.prepareMessagePayload(tableName, message);
    
    // Publicar a RabbitMQ
    await this.queueManager.publish(topic, routingKey, payload, {
      messageId: messageId,
      priority: 'normal',
    });
    
    
    this.logger.debug(`Published ${baseTableName}.${message._cdc_operation} message ${messageId}`);
    
  } catch (error) {
    this.logger.error({ error }, `Failed to process message from ${tableName}`);
  }
}

private prepareMessagePayload(tableName: string, message: CDCMessage): any {
  const baseTableName = tableName.substring(5); // quita '_cdc_'
  //console.log('prepareMessagePayload Publisher.ts: message', message.id);
  // Crear copia sin campos técnicos de CDC
  const { _cdc_operation, _cdc_acknowledge, _cdc_timestamp, is_deleted, ...rowData } = message;
  
  return {
    id: message.id,
    source: 'cdc-outbox',
    type: `${baseTableName}.${_cdc_operation}`,
    timestamp: new Date().toISOString(),
    table: baseTableName,
    operation: _cdc_operation,
    data: rowData,  // Todos los datos de la fila original
    metadata: {
      editedBy: message.editedBy,
      editedAt: message.editedAt,
      editedSession: message.editedSession,
    },
  };
}

  private filterSensitiveFields(data: any, excludeFields: string[] = []): any {
    if (!data || excludeFields.length === 0) {
      return data;
    }
    
    const filtered = { ...data };
    excludeFields.forEach(field => {
      delete filtered[field];
    });
    
    return filtered;
  }

  // private async updateMessageStatus(
  //   tableName: string,
  //   messageId: number,
  //   status: string,
  //   additionalFields: Record<string, any> = {}
  // ) {
  //   const updates = Object.entries({
  //     _cdc_acknowledge: status,
  //     ...additionalFields,
  //   })
  //     .map(([key, value]) => `${key} = ${this.formatValue(value)}`)
  //     .join(', ');
    
  //   await this.db.execute(sql`
  //     UPDATE ${sql.identifier(tableName)}
  //     SET ${sql.raw(updates)}
  //     WHERE id = ${messageId}
  //   `);
  // }

  private formatValue(value: any): string {
    if (value === null) return 'NULL';
    if (value instanceof Date) return `'${value.toISOString()}'`;
    if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
    return value.toString();
  }

  private setupMaintenanceJobs() {
    // Cleanup published messages daily at 2 AM
    const cleanupJob = cron.schedule('0 2 * * *', async () => {
      this.logger.info('Running message cleanup...');
      try {
        const result = await this.db.execute(sql`
          SELECT cleanup_published_cdc_messages(7) as deleted_count
        `);
        this.logger.info(`Cleaned up ${result.rows[0].deleted_count} messages`);
      } catch (error) {
        this.logger.error({ error }, 'Cleanup job failed');
      }
    });
    
    this.cronJobs.push(cleanupJob);
    
    // Stats reporting every hour
    const statsJob = cron.schedule('0 * * * *', async () => {
      try {
        const stats = await this.db.execute(sql`
          SELECT * FROM get_cdc_outbox_stats()
        `);
        this.logger.info({ stats: stats.rows }, 'CDC-Outbox Statistics');
      } catch (error) {
        this.logger.error({ error }, 'Stats job failed');
      }
    });
    
    this.cronJobs.push(statsJob);
    
    this.logger.info('Maintenance jobs scheduled');
  }
}