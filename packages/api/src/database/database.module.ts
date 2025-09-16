// src/database/database.module.ts
import { Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { ConfigModule } from '@nestjs/config';
@Module({
  providers: [DatabaseService, ConfigModule],
  exports: [DatabaseService],
})
export class DatabaseModule {}
