// services/message-publisher/src/queues/queue-manager.ts
import { EventEmitter } from 'events';
import { createLogger } from '../utils/logger';

export interface QueueConfig {
  type: 'rabbitmq';
  connectionString?: string;
  options?: any;
}

export interface PublishOptions {
  messageId?: string;
  correlationId?: string;
  priority?: string;
  delay?: number;
  headers?: Record<string, any>;
}

export interface QueueProvider {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  publish(topic: string, routingKey: string, payload: any, options?: PublishOptions): Promise<void>;
  isConnected(): boolean;
}

export class QueueManager extends EventEmitter {
  private provider: QueueProvider | null = null;
  private config: QueueConfig;
  private logger = createLogger('QueueManager');

  constructor() {
    super();
    this.config = this.loadQueueConfig();
  }

  private loadQueueConfig(): QueueConfig {
    return {
      type: 'rabbitmq',
      connectionString: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
      options: {
        heartbeat: 60,
        prefetch: 10,
      },
    };
  }

  async initialize(): Promise<void> {
    this.logger.info(`Initializing RabbitMQ queue provider`);
    
    const { RabbitMQProvider } = await import('./providers/rabbitmq-provider');
    this.provider = new RabbitMQProvider(this.config);

    await this.provider.connect();
    this.logger.info('RabbitMQ queue provider initialized successfully');
  }

  async publish(topic: string, routingKey: string, payload: any, options?: PublishOptions): Promise<void> {
    if (!this.provider || !this.provider.isConnected()) {
      throw new Error('Queue provider not initialized or disconnected');
    }

    try {
      this.logger.debug(`Publishing message to ${topic}/${routingKey}`);
      await this.provider.publish(topic, routingKey, payload, options);
      this.emit('message:published', { topic, routingKey, messageId: options?.messageId });
    } catch (error) {
      this.logger.error({ error }, `Failed to publish message to ${topic}/${routingKey}`);
      this.emit('message:failed', { topic, routingKey, error, messageId: options?.messageId });
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.provider) {
      await this.provider.disconnect();
      this.provider = null;
      this.logger.info('Queue provider disconnected');
    }
  }

  isConnected(): boolean {
    return this.provider?.isConnected() ?? false;
  }

  getProviderType(): string {
    return this.config.type;
  }
}