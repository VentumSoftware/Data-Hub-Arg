import { Module } from '@nestjs/common';
import { FsService } from './fs.service';
import { FsController } from './fs.controller';
import { DatabaseModule } from '../database/database.module';
import { AccessModule } from '../access/access.module';
import { FsRepository } from './fs.repository';
import { AuthGuard } from '../access/guards/auth.guard';

@Module({
  imports: [DatabaseModule, AccessModule],
  controllers: [FsController],
  providers: [FsService, FsRepository, AuthGuard],
  exports: [FsService]
})
export class FsModule {}
