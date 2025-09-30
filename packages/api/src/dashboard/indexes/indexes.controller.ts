// src/dashboard/indexes/indexes.controller.ts
import { Controller, Post, Get, Body, Param, Query, UseGuards } from '@nestjs/common';
import { CurrencyConverterService, Currency, Relation, Index, ConversionOptions } from './currency-converter.service';
import { IndexesService } from './indexes.services';
import { AuthGuard } from '../../access/guards/auth.guard';
import { PermissionGuard } from '../../access/guards/permission.guard';
import { Public } from '../../access/decorators/public.decorator';
import { TokenAuthGuard } from '../../access/guards/token-auth.guard';
import { AuthToken } from '../../access/decorators/auth-token.decorator';
@Controller('indexes')
@UseGuards(TokenAuthGuard, AuthGuard, PermissionGuard) 
export class IndexesController {
    constructor(private readonly currencyConverter: CurrencyConverterService, private readonly indexesService: IndexesService) { }

    @Post('currencies')
    @AuthToken()
    async addCurrency(
        @Body() body: {
            currency: Omit<Currency, 'id'>;
            relations: Omit<Relation, 'id'>[];
        }
    ) {
        return await this.currencyConverter.addCurrency(body.currency, body.relations);
    };

    @Post('relations')
    @AuthToken()
    async addRelation(@Body() relation: Omit<Relation, 'id'>) {
        return await this.currencyConverter.addRelation(relation);
    }

    @Post('indexes')
    @AuthToken()
    async addIndex(@Body() index: Omit<Index, 'id'>) {
        return await this.currencyConverter.addIndex({
            ...index,
            date: new Date(index.date)
        });
    };

    @Public()
    @Post('convert')
    async convertCurrency(
        @Body() body: {
            value: number;
            from: { date: string; currencyId: number };
            to: { date: string; currencyId: number };
            constantCurrencyId: number;
            options?: ConversionOptions;
        }
    ) {
        const result = await this.currencyConverter.convertCurrency(
            body.value,
            { date: new Date(body.from.date), currencyId: body.from.currencyId },
            { date: new Date(body.to.date), currencyId: body.to.currencyId },
            body.constantCurrencyId,
            body.options
        );

        return {
            value: result,
            from: body.from,
            to: body.to,
            constantCurrencyId: body.constantCurrencyId
        };
    };

    @Public()
    @Get('path/:fromId/:toId')
    async getPath(
        @Param('fromId') fromId: string,
        @Param('toId') toId: string
    ) {
        const path = await this.currencyConverter.getPath(+fromId, +toId);
        return { path, exists: path !== null };
    };

    @Public()
    @Get('currencies')
    async getCurrencies() {
        // Add method to get all currencies
        return await this.currencyConverter.getAllCurrencies();
    };

    @Public()
    @Get('currencies/:id/relations')
    async getCurrencyRelations(@Param('id') id: string) {
        // Add method to get currency relations
        return await this.currencyConverter.getCurrencyRelations(+id);
    };

    @Public()
    @Get('historical')
    async getHistoricalIndexes(
        @Query('page') page: string = '1',
        @Query('pageSize') pageSize: string = '100',
        @Query('sortField') sortField: string = 'date',
        @Query('sortOrder') sortOrder: string = 'desc'
    ) {
        const pageNum = parseInt(page) || 1;
        const size = Math.min(parseInt(pageSize) || 100, 1000); // Max 1000 per page
        const offset = (pageNum - 1) * size;

        return await this.currencyConverter.getHistoricalIndexes({
            limit: size,
            offset: offset,
            sortField: sortField,
            sortOrder: sortOrder as 'asc' | 'desc'
        });
    };

    @Public()
    @Get('historical-by-dates')
    async getHistoricalIndexesByDates(
        @Query('page') page: string = '1',
        @Query('pageSize') pageSize: string = '25',
        @Query('sortOrder') sortOrder: string = 'desc'
    ) {
        const pageNum = parseInt(page) || 1;
        const size = Math.min(parseInt(pageSize) || 100, 100); // Max 100 dates per page
        const offset = (pageNum - 1) * size;

        return await this.currencyConverter.getHistoricalIndexesByDates({
            limit: size,
            offset: offset,
            sortOrder: sortOrder as 'asc' | 'desc'
        });
    };

    @Get('update-indexes')
    @AuthToken()
    async updateIndexes() {
        return await this.indexesService.updateIndexes();
    };
}