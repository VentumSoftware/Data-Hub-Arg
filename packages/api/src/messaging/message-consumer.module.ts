// packages/api/src/messaging/message-consumer.module.ts
import { Module } from '@nestjs/common';
import { MessageConsumerService } from './message-consumer.service';
import { DatabaseModule } from '../database/database.module'; // Tu módulo de DB

@Module({
  imports: [DatabaseModule],
  providers: [MessageConsumerService],
  exports: [MessageConsumerService],
})
export class MessagingModule {}