
import { DatabaseService } from '../../database/database.service';
import { Injectable, Logger } from '@nestjs/common';
import { } from '../../../drizzle/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { mailer, extractDoubleKeys, handleReplacementOfStaticFields, handleReplacementOfDinamicFields, replaceAll } from '../../../lib';
import { ConfigService } from '@nestjs/config';
import { env } from 'process';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IndexesRepository } from './indexes.repository';
@Injectable()
export class IndexesService {
    private readonly logger = new Logger(IndexesService.name);
    constructor(private readonly db: DatabaseService,
        private readonly configService: ConfigService,
        private readonly indexesRepository: IndexesRepository
    ) { }

    // async onApplicationBootstrap() {
    //     this.logger.log('Ejecutando updateIndexes al iniciar la aplicación...');
    //     await this.updateIndexes();
    //     this.logger.log('¡updateIndexes ejecutado exitosamente al iniciar!');
    // };

    async updateIndexes() {
        this.logger.log('Ejecutando updateIndexes...');
        let res = await this.indexesRepository.updateIndexes();
        return res;
    }

}
