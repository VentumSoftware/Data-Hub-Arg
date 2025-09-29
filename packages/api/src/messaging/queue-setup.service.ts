// // packages/api/src/messaging/queue-setup.service.ts
// import { Injectable, OnModuleInit } from '@nestjs/common';
// import * as amqp from 'amqplib';
// import { Logger } from '@nestjs/common';

// @Injectable()
// export class QueueSetupService implements OnModuleInit {
//   private readonly logger = new Logger(QueueSetupService.name);
//   private isSetupComplete = false;

//   async onModuleInit() {
//     // No bloquear el inicio de la aplicación
//     this.setupQueuesWithRetry().catch(error => {
//       this.logger.error('Failed to setup queues after retries:', error);
//     });
//   }

//   async setupQueuesWithRetry(maxRetries = 5, retryDelay = 3000) {
//     for (let attempt = 1; attempt <= maxRetries; attempt++) {
//       try {
//         await this.setupQueues();
//         this.isSetupComplete = true;
//         this.logger.log('RabbitMQ queues setup completed successfully');
//         return;
//       } catch (error) {
//         this.logger.warn(`Queue setup attempt ${attempt}/${maxRetries} failed:`, error.message);
        
//         if (attempt === maxRetries) {
//           throw error;
//         }
        
//         await new Promise(resolve => setTimeout(resolve, retryDelay));
//       }
//     }
//   }

//   async setupQueues() {
//     let connection;
//     try {
//       // ✅ CORREGIDO: Usar la URL correcta de RabbitMQ
//       const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672';
//       this.logger.log(`Connecting to RabbitMQ: ${rabbitmqUrl.replace(/:[^:]*@/, ':***@')}`);
      
//       connection = await amqp.connect(rabbitmqUrl);
//       const channel = await connection.createChannel();

//       // Exchange principal
//       await channel.assertExchange('database.changes', 'topic', {
//         durable: true,
//         autoDelete: false,
//       });

//       // Cola para procesar cambios de la base de datos
//       const queueResult = await channel.assertQueue('database.changes.queue', {
//         durable: true,
//         arguments: {
//           'x-dead-letter-exchange': 'database.changes.dlx',
//         },
//       });

//       // Binding: todos los mensajes de database.changes van a la cola
//       await channel.bindQueue('database.changes.queue', 'database.changes', '#');

//       // Dead letter exchange para mensajes fallidos
//       await channel.assertExchange('database.changes.dlx', 'topic', {
//         durable: true,
//       });

//       await channel.assertQueue('database.changes.dlq', { durable: true });
//       await channel.bindQueue('database.changes.dlq', 'database.changes.dlx', '#');

//       await channel.close();
      
//       this.logger.log(`Queue setup completed: ${queueResult.queue} with ${queueResult.messageCount} messages`);

//     } catch (error) {
//       this.logger.error('Queue setup failed:', error);
//       throw error;
//     } finally {
//       if (connection) await connection.close();
//     }
//   }

//   isReady(): boolean {
//     return this.isSetupComplete;
//   }
// }