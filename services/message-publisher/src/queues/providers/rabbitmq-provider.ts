// services/message-publisher/src/queues/providers/rabbitmq-provider.ts
import * as amqp from 'amqplib';
import { Connection, Channel } from 'amqplib';
import { QueueProvider, QueueConfig, PublishOptions } from '../queue-manager';
import { createLogger } from '../../utils/logger';

export class RabbitMQProvider implements QueueProvider {
  private connection: Connection | null = null;
  private channel: Channel | null = null;
  private connected = false;
  private logger = createLogger('RabbitMQProvider');

  constructor(private config: QueueConfig) { }

  async connect(): Promise<void> {
    if (this.connected) {
      console.log('🔍 [DEBUG] Already connected to RabbitMQ');
      return;
    }

    try {
      console.log('🔌 [DEBUG] Connecting to RabbitMQ:', {
        url: this.config.connectionString,
        options: this.config.options
      });

      const conn = await amqp.connect(this.config.connectionString!, this.config.options);
      this.connection = conn as any as Connection;
      console.log('✅ [DEBUG] RabbitMQ connection established');

      this.channel = await (this.connection as any).createChannel();
      console.log('✅ [DEBUG] RabbitMQ channel created');

      // Verificar que el channel esté funcionando
      await this.channel.assertQueue('test_queue', { durable: false, autoDelete: true });
      console.log('✅ [DEBUG] Test queue assertion successful');

      // Setup connection event handlers
      this.connection.on('error', (error) => {
        this.connected = false;
        console.error('❌ [DEBUG] RabbitMQ connection error:', error);
        this.logger.error({ error }, 'RabbitMQ connection error');
      });

      this.connection.on('close', () => {
        this.connected = false;
        console.log('🔌 [DEBUG] RabbitMQ connection closed');
        this.logger.warn('RabbitMQ connection closed');
      });

      // Setup default exchanges
      await this.setupExchanges();

      this.connected = true;
      console.log('✅ [DEBUG] RabbitMQ provider fully initialized');
      this.logger.info('Connected to RabbitMQ');

    } catch (error) {
      console.error('❌ [DEBUG] Failed to connect to RabbitMQ:', error);
      this.logger.error({ error }, 'Failed to connect to RabbitMQ');
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.channel) {
      await this.channel.close();
      this.channel = null;
    }

    if (this.connection) {
      await (this.connection as any).close();
      this.connection = null;
    }

    this.connected = false;
    this.logger.info('Disconnected from RabbitMQ');
  }

  // async publish(topic: string, routingKey: string, payload: any, options?: PublishOptions): Promise<void> {
  //   if (!this.connected || !this.channel) {
  //     throw new Error('RabbitMQ not connected');
  //   }

  //   const message = {
  //     id: options?.messageId || this.generateMessageId(),
  //     topic,
  //     routingKey,
  //     payload,
  //     timestamp: new Date().toISOString(),
  //     correlationId: options?.correlationId,
  //     priority: this.mapPriority(options?.priority),
  //   };

  //   const publishOptions: amqp.Options.Publish = {
  //     messageId: message.id,
  //     correlationId: message.correlationId,
  //     timestamp: Date.now(),
  //     persistent: true, // Make messages durable
  //     priority: message.priority,
  //     headers: {
  //       ...options?.headers,
  //       source: 'cdc-outbox-publisher',
  //       version: '1.0',
  //     },
  //   };

  //   // Handle delayed messages
  //   if (options?.delay && options.delay > 0) {
  //     publishOptions.headers!['x-delay'] = options.delay;
  //   }

  //   try {
  //     const exchangeName = this.getExchangeName(topic);

  //     const published = this.channel.publish(
  //       exchangeName,
  //       routingKey,
  //       Buffer.from(JSON.stringify(message)),
  //       publishOptions
  //     );

  //     if (!published) {
  //       throw new Error('Message could not be published (channel buffer full)');
  //     }

  //     this.logger.debug(`Published message to exchange ${exchangeName} with routing key ${routingKey}`);
  //   } catch (error) {
  //     this.logger.error({ error }, `Failed to publish to RabbitMQ exchange ${topic}`);
  //     throw error;
  //   }
  // }
  async publish(topic: string, routingKey: string, payload: any, options?: PublishOptions): Promise<void> {
    console.log('🔍 [DEBUG] RabbitMQProvider.publish called with:', {
      topic,
      routingKey,
      payloadKeys: Object.keys(payload),
      options
    });

    if (!this.connected || !this.channel) {
      console.error('❌ [DEBUG] RabbitMQ not connected');
      throw new Error('RabbitMQ not connected');
    }

    const message = {
      id: options?.messageId || this.generateMessageId(),
      topic,
      routingKey,
      payload,
      timestamp: new Date().toISOString(),
      correlationId: options?.correlationId,
      priority: this.mapPriority(options?.priority),
    };

    console.log('📦 [DEBUG] Message prepared:', JSON.stringify(message, null, 2));

    const publishOptions: amqp.Options.Publish = {
      messageId: message.id,
      correlationId: message.correlationId,
      timestamp: Date.now(),
      persistent: true,
      priority: message.priority,
      headers: {
        ...options?.headers,
        source: 'cdc-outbox-publisher',
        version: '1.0',
      },
    };

    try {
      const exchangeName = this.getExchangeName(topic);
      console.log('📡 [DEBUG] Publishing to exchange:', exchangeName);

      const published = this.channel.publish(
        exchangeName,
        routingKey,
        Buffer.from(JSON.stringify(message)),
        publishOptions
      );

      console.log('✅ [DEBUG] Channel.publish returned:', published);

      if (!published) {
        console.error('❌ [DEBUG] Message not published - channel buffer full');
        throw new Error('Message could not be published (channel buffer full)');
      }

      this.logger.debug(`Published message to exchange ${exchangeName} with routing key ${routingKey}`);
      console.log('🎉 [DEBUG] Message published successfully!');

    } catch (error) {
      console.error('❌ [DEBUG] Error in channel.publish:', error);
      this.logger.error({ error }, `Failed to publish to RabbitMQ exchange ${topic}`);
      throw error;
    }
  };
  
  isConnected(): boolean {
    return this.connected;
  }

  private async setupExchanges(): Promise<void> {
    if (!this.channel) return;

    const exchanges = [
      'database.changes',
      'user.lifecycle',
      'access.control',
      'access.management',
      'user.groups',
      'filesystem.events',
      'content.events',
      'system.logs'
    ];

    for (const exchange of exchanges) {
      await this.channel.assertExchange(exchange, 'topic', {
        durable: true,
        autoDelete: false,
      });

      // Create corresponding DLQ exchange
      await this.channel.assertExchange(`${exchange}.dlq`, 'topic', {
        durable: true,
        autoDelete: false,
      });
    }

    this.logger.info(`Created ${exchanges.length} exchanges with DLQs`);
  }

  private getExchangeName(topic: string): string {
    return topic;
  }

  private mapPriority(priority?: string): number {
    const priorityMap: Record<string, number> = {
      'low': 1,
      'normal': 5,
      'high': 8,
      'critical': 10,
    };
    return priorityMap[priority || 'normal'] || 5;
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}