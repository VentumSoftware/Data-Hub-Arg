// packages/api/src/messaging/message-consumer.ts
import * as amqp from 'amqplib';
import { EventEmitter } from 'events';
import { Logger } from 'pino';
import { logger } from '../utils/logger';

export interface ConsumedMessage {
  id: string;
  topic: string;
  routingKey: string;
  payload: any;
  headers: Record<string, any>;
  timestamp: string;
  correlationId?: string;
  messageId?: string;
  deliveryInfo: {
    deliveryTag: number;
    redelivered: boolean;
    exchange: string;
    routingKey: string;
  };
}

export interface MessageProcessingResult {
  success: boolean;
  shouldRetry?: boolean;
  error?: Error;
  metadata?: Record<string, any>;
}

export class MessageConsumer extends EventEmitter {
  private connection: any = null; // amqplib type issue
  private channel: amqp.Channel | null = null;
  private connected = false;
  private consuming = false;
  private logger: Logger;
  private consumerTags: string[] = [];

  constructor(private config: {
    connectionString: string;
    prefetch?: number;
    maxRetries?: number;
    retryDelayMs?: number;
  }) {
    super();
    this.logger = logger.child({ component: 'MessageConsumer' });
  }

  async connect(): Promise<void> {
    if (this.connected) return;

    try {
      this.connection = await amqp.connect(this.config.connectionString);
      this.channel = await this.connection.createChannel();

      // CRITICAL: Set prefetch to 1 for proper load balancing
      // This ensures each consumer only gets 1 unacked message at a time
      await this.channel.prefetch(this.config.prefetch || 1);

      // Setup connection event handlers
      this.connection.on('error', (error) => {
        this.connected = false;
        this.consuming = false;
        this.logger.error(error, 'RabbitMQ connection error');
        this.emit('error', error);
      });

      this.connection.on('close', () => {
        this.connected = false;
        this.consuming = false;
        this.logger.warn('RabbitMQ connection closed - unacked messages will be redelivered');
        this.emit('disconnected');
      });

      this.connected = true;
      this.logger.info('Connected to RabbitMQ with manual ACK mode');
      
    } catch (error) {
      this.logger.error(error, 'Failed to connect to RabbitMQ');
      throw error;
    }
  }

async consume(queueName: string): Promise<void> {
  if (!this.connected || !this.channel) {
    throw new Error('Must connect before consuming');
  }

  try {
    // ✅ PRIMERO: Crear el exchange si no existe
    await this.channel.assertExchange('database.changes', 'topic', {
      durable: true,
      autoDelete: false,
    });

    // ✅ SEGUNDO: Crear la cola si no existe
    await this.channel.assertQueue(queueName, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': `${queueName}.dlx`,
      },
    });

    // ✅ TERCERO: Crear el binding con el exchange
    await this.channel.bindQueue(queueName, 'database.changes', '#');

    // ✅ CUARTO: Crear DLQ si no existe
    const dlqExchange = `${queueName}.dlx`;
    const dlqName = `${queueName}.dlq`;
    
    await this.channel.assertExchange(dlqExchange, 'topic', { durable: true });
    await this.channel.assertQueue(dlqName, { durable: true });
    await this.channel.bindQueue(dlqName, dlqExchange, '#');

    // ✅ QUINTO: Ahora sí consumir
    const consumerResult = await this.channel.consume(
      queueName,
      (msg) => this.handleMessageWithACK(msg),
      { 
        noAck: false
      }
    );

    if (consumerResult) {
      this.consumerTags.push(consumerResult.consumerTag);
      this.logger.info(`Started consuming from queue: ${queueName} with manual ACK`);
    }

  } catch (error) {
    this.logger.error(error, `Failed to start consuming from ${queueName}`);
    throw error;
  }
}

  /**
   * DETAILED ACK IMPLEMENTATION
   * This is the core of reliable message processing
   */
  private async handleMessageWithACK(msg: amqp.ConsumeMessage | null): Promise<void> {
    if (!msg || !this.channel) return;

    const startTime = Date.now();
    const deliveryTag = msg.fields.deliveryTag;
    const retryCount = (msg.properties.headers?.['x-retry-count'] as number) || 0;
    const maxRetries = this.config.maxRetries || 3;

    this.logger.debug({
      deliveryTag,
      routingKey: msg.fields.routingKey,
      redelivered: msg.fields.redelivered,
      retryCount,
      messageId: msg.properties.messageId,
    }, 'Received message');

    try {
      // Parse and prepare message
      const messageContent = JSON.parse(msg.content.toString());
      const consumedMessage: ConsumedMessage = {
        id: messageContent.id,
        topic: messageContent.topic,
        routingKey: msg.fields.routingKey,
        payload: messageContent.payload,
        headers: msg.properties.headers || {},
        timestamp: messageContent.timestamp,
        correlationId: msg.properties.correlationId,
        messageId: msg.properties.messageId,
        deliveryInfo: {
          deliveryTag,
          redelivered: msg.fields.redelivered,
          exchange: msg.fields.exchange,
          routingKey: msg.fields.routingKey,
        },
      };

      // Process message and get result
      const result = await this.processMessage(consumedMessage);
      const processingTime = Date.now() - startTime;

      // DECISION TREE FOR ACK/NACK
      if (result.success) {
        // ✅ SUCCESS: ACK the message (remove from queue permanently)
        this.channel.ack(msg);
        
        this.logger.info({
          messageId: consumedMessage.id,
          deliveryTag,
          processingTimeMs: processingTime,
        }, 'Message ACKed successfully');

        this.emit('message:acked', { message: consumedMessage, processingTime });

      } else if (result.shouldRetry && retryCount < maxRetries) {
        // 🔄 RETRY: NACK with requeue for retry
        await this.handleRetry(msg, result.error, retryCount);

      } else {
        // ❌ PERMANENT FAILURE: NACK without requeue (send to DLQ or discard)
        this.channel.nack(msg, false, false); // false, false = don't requeue, single message
        
        this.logger.error({
          messageId: consumedMessage.id,
          deliveryTag,
          retryCount,
          maxRetries,
          error: result.error?.message,
        }, 'Message NACKed permanently');

        this.emit('message:failed', { 
          message: consumedMessage, 
          error: result.error,
          retryCount,
          finalFailure: true 
        });
      }

    } catch (parseError) {
      // PARSING ERROR: Usually permanent, NACK without requeue
      this.logger.error({
        deliveryTag,
        error: parseError instanceof Error ? parseError.message : parseError,
      }, 'Message parsing failed');
      
      this.channel.nack(msg, false, false); // Don't requeue malformed messages
      this.emit('message:parse_error', { deliveryTag, error: parseError });
    }
  }

  /**
   * RETRY MECHANISM WITH EXPONENTIAL BACKOFF
   */
  private async handleRetry(
    msg: amqp.ConsumeMessage, 
    error: Error | undefined, 
    currentRetryCount: number
  ): Promise<void> {
    if (!this.channel) return;

    const nextRetryCount = currentRetryCount + 1;
    const delay = Math.min(
      (this.config.retryDelayMs || 1000) * Math.pow(2, currentRetryCount), 
      60000 // Max 60 seconds
    );

    this.logger.warn({
      messageId: msg.properties.messageId,
      currentRetry: currentRetryCount,
      nextRetry: nextRetryCount,
      delayMs: delay,
      error: error?.message,
    }, 'Message will be retried');

    try {
      // OPTION 1: Use RabbitMQ delayed message plugin (if available)
      if (this.hasDelayedMessagePlugin()) {
        await this.channel.publish(
          msg.fields.exchange,
          msg.fields.routingKey,
          msg.content,
          {
            ...msg.properties,
            headers: {
              ...msg.properties.headers,
              'x-retry-count': nextRetryCount,
              'x-delay': delay, // Requires rabbitmq-delayed-message-exchange plugin
              'x-original-error': error?.message,
            },
          }
        );
        
        // ACK original message since we've republished it
        this.channel.ack(msg);

      } else {
        // OPTION 2: NACK with requeue (simpler but less control)
        // The message goes back to the queue immediately
        this.channel.nack(msg, false, true); // true = requeue
      }

      this.emit('message:retry_scheduled', {
        messageId: msg.properties.messageId,
        retryCount: nextRetryCount,
        delay,
      });

    } catch (retryError) {
      this.logger.error({
        messageId: msg.properties.messageId,
        retryError: retryError instanceof Error ? retryError.message : retryError,
      }, 'Failed to schedule retry');
      
      // Fallback: NACK without requeue
      this.channel.nack(msg, false, false);
    }
  }

  /**
   * BULK ACK/NACK OPERATIONS
   * For high-throughput scenarios where you process messages in batches
   */
  async ackMultiple(deliveryTag: number): Promise<void> {
    if (!this.channel) return;
    
    // ACK this message and all previous unacked messages
    this.channel.ack({ fields: { deliveryTag } } as any, true);
    
    this.logger.debug({ upToDeliveryTag: deliveryTag }, 'Bulk ACK performed');
  }

  async nackMultiple(deliveryTag: number, requeue: boolean = false): Promise<void> {
    if (!this.channel) return;
    
    // NACK this message and all previous unacked messages  
    this.channel.nack({ fields: { deliveryTag } } as any, true, requeue);
    
    this.logger.warn({ upToDeliveryTag: deliveryTag, requeue }, 'Bulk NACK performed');
  }

  /**
   * GRACEFUL SHUTDOWN WITH PENDING MESSAGE HANDLING
   */
  async gracefulShutdown(): Promise<void> {
    this.logger.info('Starting graceful shutdown...');
    
    // Stop accepting new messages
    for (const tag of this.consumerTags) {
      if (this.channel) {
        await this.channel.cancel(tag);
      }
    }
    
    this.logger.info('Stopped accepting new messages, waiting for in-flight messages...');
    
    // Wait for processing to complete (you'd implement this based on your needs)
    await this.waitForInflightMessages();
    
    // Close connections
    if (this.channel) await this.channel.close();
    if (this.connection && this.connection.close) await this.connection.close();
    
    this.logger.info('Graceful shutdown completed');
  }

  private async processMessage(message: ConsumedMessage): Promise<MessageProcessingResult> {
    try {
      // Your business logic here
      // This is where you'd handle different message types
      
      // Simulate processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Example: emit to registered handlers
      const handled = await new Promise<boolean>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Message processing timeout'));
        }, 30000);

        this.emit('message', message, (success: boolean, error?: Error) => {
          clearTimeout(timeout);
          if (success) {
            resolve(true);
          } else {
            reject(error || new Error('Handler reported failure'));
          }
        });
      });

      return { success: handled };

    } catch (error) {
      const err = error as Error;
      
      // Determine if error is retryable
      const isRetryable = this.isRetryableError(err);
      
      return {
        success: false,
        shouldRetry: isRetryable,
        error: err,
      };
    }
  }

  private isRetryableError(error: Error): boolean {
    // Define which errors should trigger retries
    const retryableErrors = [
      'ECONNREFUSED',
      'TIMEOUT',
      'DATABASE_CONNECTION_ERROR',
      'TEMPORARY_SERVICE_UNAVAILABLE',
    ];

    return retryableErrors.some(errorType => 
      error.message.includes(errorType) || error.name === errorType
    );
  }

  private hasDelayedMessagePlugin(): boolean {
    // Check if RabbitMQ has the delayed message plugin installed
    // This would need to be configured or detected at runtime
    return false; // For now, assume not available
  }

  private async waitForInflightMessages(): Promise<void> {
    // Implementation depends on how you track in-flight messages
    // For example, you could use a counter or Promise tracking
    return new Promise(resolve => setTimeout(resolve, 1000));
  }

  async disconnect(): Promise<void> {
    await this.gracefulShutdown();
  }
}