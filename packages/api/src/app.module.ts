import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { ConfigModule } from '@nestjs/config';
import { AccessModule } from './access/access.module';
import { DatabaseService } from './database/database.service';
import { LoggerMiddleware } from './logger/logger.middleware';
import { LoggerController } from './logger/logger.controller';
import { HealthController } from './common/health/health.controller';
import { MetricsService } from './common/metrics/metrics.service';
import { IndexesModule } from './dashboard/indexes/indexes.module';
import { FsModule } from './fs/fs.module';
import { MessagingModule } from './messaging/message-consumer.module';
//import { QueueSetupService } from './messaging/queue-setup.service';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    AccessModule,
    DatabaseModule,
    //FsModule,
    IndexesModule,
    MessagingModule,
  ],
  controllers: [AppController, LoggerController, HealthController],
  providers: [AppService, DatabaseService, MetricsService],
})

export class AppModule implements NestModule {

  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
    // Authentication is now handled by AuthGuard instead of middleware
  }
}
