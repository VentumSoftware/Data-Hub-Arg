// packages/api/src/messaging/message-consumer.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { MessageConsumer } from './message-consumer';
import { DatabaseService } from '../database/database.service';
import { Logger } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';

@Injectable()
export class MessageConsumerService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(MessageConsumerService.name);
    private consumer: MessageConsumer;
    private isConnected = false;

    constructor(private readonly databaseService: DatabaseService) {

        this.consumer = new MessageConsumer({
            connectionString: process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672',
            prefetch: 5,
            maxRetries: 3,
            retryDelayMs: 1000,
        });

        // Registrar handlers para diferentes tipos de mensajes
        this.setupMessageHandlers();
    }

    async onModuleInit() {
        await this.startConsumer();
    }

    async onModuleDestroy() {
        await this.stopConsumer();
    }

    private setupMessageHandlers() {
        // Handler para mensajes de cambios en la base de datos
        this.consumer.on('message', async (message, callback) => {
            try {
                await this.handleDatabaseChangeMessage(message);
                callback(true); // ✅ Éxito
            } catch (error) {
                this.logger.error(`Failed to process message ${message.id}:`, error);
                callback(false, error); // ❌ Error
            }
        });

        // Eventos de logging
        this.consumer.on('message:acked', (data) => {
            this.logger.log(`Message ${data.message.id} processed successfully`);
        });

        this.consumer.on('message:failed', (data) => {
            this.logger.error(`Message ${data.message.id} failed permanently after ${data.retryCount} retries`);
        });
    }

    private async handleDatabaseChangeMessage(message: any) {
        // ✅ DEBUG: Ver la estructura completa del mensaje
        this.logger.debug('Received message structure:', {
            id: message.id,
            topic: message.topic,
            routingKey: message.routingKey,
            payloadKeys: Object.keys(message.payload || {})
        });

        const { table, operation, data } = message.payload;

        
        // ✅ DEBUG: Ver los detalles del payload
        this.logger.debug('Message payload details:', {
            table,
            operation,
            dataId: data?.id,
            dataKeys: Object.keys(data || {})
        });
        if (!table) {
            this.logger.error('Message missing table information:', message);
            throw new Error('Message missing table information');
        }

        if (!data?.id) {
            this.logger.error('Message missing record ID:', message);
            throw new Error('Message missing record ID');
        }
        this.logger.debug(`Processing ${operation} on table ${table}`);
        // Aquí va tu lógica de negocio
        switch (table) {
            case 'users':
                //await this.handleUserChange(operation, data);
                break;
            case 'roles':
                //await this.handleRoleChange(operation, data);
                break;
            // Agrega más casos según tus tablas
            default:
                this.logger.warn(`No handler for table: ${table}`);
        }

        // ✅ Marcar como acknowledged en la base de datos
        await this.markMessageAsAcknowledged(message);
    }

    // packages/api/src/messaging/message-consumer.service.ts
    private async markMessageAsAcknowledged(message: any) {
        const { table, data } = message.payload;
        const recordId = data.id;

        try {
            // ✅ CORREGIDO: Verificar que la tabla y el ID existen
            if (!table || !recordId) {
                throw new Error(`Invalid message: table=${table}, recordId=${recordId}`);
            }

            const cdcTableName = `_cdc_${table}`;

            // ✅ CORREGIDO: Usar el nombre de tabla completo
            const result = (await this.databaseService.db.execute(
                sql`UPDATE ${sql.identifier(cdcTableName)} SET _cdc_acknowledge = true WHERE id = ${recordId}`
            )).rows[0];

            this.logger.debug(`Marked CDC record ${recordId} from ${cdcTableName} as acknowledged`);
            console.log({result});
        } catch (error) {
            this.logger.error(`Failed to mark message as acknowledged for table ${table}:`, error);

            // ✅ Mejor logging para debugging
            this.logger.debug('Message details:', {
                table,
                recordId,
                dataKeys: Object.keys(data || {})
            });

            throw error;
        }
    }

    private async handleUserChange(operation: string, data: any) {
        this.logger.log(`User ${operation}: ${data.email}`);

        // Ejemplo: enviar notificación, actualizar caché, etc.
        if (operation === 'INSERT') {
            //Error que aparece acá: Property 'notificationService' does not exist on type 'MessageConsumerService'.
            // await this.notificationService.sendWelcomeEmail(data.email);
        }
    }

    private async handleRoleChange(operation: string, data: any) {
        this.logger.log(`Role ${operation}: ${data.name}`);

        // Lógica específica para cambios en roles
    }

    async startConsumer() {
        try {
            await this.consumer.connect();

            // Suscribirse a las colas de interés
            await this.consumer.consume('database.changes.queue');

            this.isConnected = true;
            this.logger.log('Message Consumer started successfully');
        } catch (error) {
            this.logger.error('Failed to start Message Consumer:', error);
            throw error;
        }
    }

    async stopConsumer() {
        if (this.isConnected) {
            await this.consumer.gracefulShutdown();
            this.isConnected = false;
            this.logger.log('Message Consumer stopped');
        }
    }

    isRunning(): boolean {
        return this.isConnected;
    }
}