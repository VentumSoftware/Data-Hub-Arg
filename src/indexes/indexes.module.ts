import { Module } from '@nestjs/common';
import { IndexesService } from './indexes.service';
import { IndexesController } from './indexes.controller';
import { IndexesCacheService } from './indexes-cache.service';
@Module({
  controllers: [IndexesController],
  providers: [IndexesService, IndexesCacheService],
  exports: [IndexesService, IndexesCacheService],
})
export class IndexesModule {}
