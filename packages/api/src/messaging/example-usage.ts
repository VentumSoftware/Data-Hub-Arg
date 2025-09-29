/**
 * SIMPLE EXAMPLE: Message Consumer Usage
 * See docs/messaging/cdc-outbox-system.md for detailed documentation
 */
// packages/api/src/messaging/example-usage.ts
import { MessageConsumer, ConsumedMessage } from './message-consumer';
import { logger } from '../utils/logger';

export class SimpleEventHandler {
  private consumer: MessageConsumer;
  private logger = logger.child({ component: 'SimpleEventHandler' });

  constructor() {
    this.consumer = new MessageConsumer({
      connectionString: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
      prefetch: 1,
      maxRetries: 3,
      retryDelayMs: 1000,
    });

    this.consumer.on('message', this.handleMessage.bind(this));
  }

  async start(): Promise<void> {
    await this.consumer.connect();
    await this.consumer.consume('user.lifecycle.events');
    await this.consumer.consume('access.control.events');
    this.logger.info('Started consuming events');
  }

  private async handleMessage(
    message: ConsumedMessage, 
    callback: (success: boolean, error?: Error) => void
  ): Promise<void> {
    try {
      this.logger.info({
        routingKey: message.routingKey,
        messageId: message.id,
      }, 'Processing message');

      // Simple routing based on message type
      switch (message.routingKey) {
        case 'user.created':
          await this.onUserCreated(message.payload.data);
          break;
        case 'user.permission.granted':
          await this.onPermissionGranted(message.payload.data);
          break;
        default:
          this.logger.debug({ routingKey: message.routingKey }, 'Unhandled message type');
      }

      callback(true); // ✅ ACK

    } catch (error) {
      this.logger.error({
        error: (error as Error).message,
        routingKey: message.routingKey,
      }, 'Message processing failed');
      callback(false, error as Error); // ❌ NACK with retry
    }
  }

  private async onUserCreated(userData: any): Promise<void> {
    this.logger.info({ userId: userData.id }, 'User created event received');
    // Business logic: send welcome email, setup defaults, etc.
  }

  private async onPermissionGranted(data: any): Promise<void> {
    this.logger.info({ userId: data.userId }, 'Permission granted event received');
    // Business logic: invalidate permission cache, notify user, etc.
  }

  async stop(): Promise<void> {
    await this.consumer.disconnect();
  }
}