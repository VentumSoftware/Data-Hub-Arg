import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { CurrencyConverterService } from './currency-converter.service';
import { IndexesController } from './indexes.controller';
import { IndexesService } from './indexes.services';
import { IndexesRepository } from './indexes.repository';
import { IndexesCronService } from './indexes.cron.service'; // ← Nuevo servicio

@Module({
    imports: [DatabaseModule],
    controllers: [IndexesController],
    providers: [
        CurrencyConverterService,
        IndexesService,
        IndexesRepository,
        IndexesCronService 
    ],
    exports: [CurrencyConverterService],
})
export class IndexesModule { }