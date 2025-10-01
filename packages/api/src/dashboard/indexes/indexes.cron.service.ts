import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IndexesService } from './indexes.services';

@Injectable()
export class IndexesCronService {
    private readonly logger = new Logger(IndexesCronService.name);

    constructor(private readonly indexesService: IndexesService) { }

    //Se ejecuta al iniciar la aplicación
    async onApplicationBootstrap() {
        this.logger.log('Ejecutando updateIndexes al iniciar la aplicación...');
        try {
            await this.indexesService.updateIndexes();
            this.logger.log('updateIndexes ejecutado exitosamente al iniciar');
        } catch (error) {
            this.logger.error('Error ejecutando updateIndexes al iniciar:', error);
        }
    }

    // Se ejecuta todos los días a las 4:00 AM
    // Expresiones predefinidas útiles:
    // CronExpression.EVERY_DAY_AT_4AM     // 4:00 AM daily
    // CronExpression.EVERY_DAY_AT_MIDNIGHT // 12:00 AM
    // CronExpression.EVERY_HOUR           // Cada hora
    // CronExpression.EVERY_MINUTE         // Cada minuto (para testing)
    @Cron(CronExpression.EVERY_DAY_AT_4AM)
    async handleCron() {
        this.logger.log('Ejecutando updateIndexes programado (4:00 AM)...');
        try {
            await this.indexesService.updateIndexes();
            this.logger.log('updateIndexes programado ejecutado exitosamente');
        } catch (error) {
            this.logger.error('Error ejecutando updateIndexes programado:', error);
        }
    }
}