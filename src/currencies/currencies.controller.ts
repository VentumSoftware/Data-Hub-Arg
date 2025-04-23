import { Controller, Get, Post, Body, Param, Patch, Delete } from '@nestjs/common';
import { CurrenciesService } from './currencies.service';

@Controller('currencies')
export class CurrenciesController {
  constructor(private readonly currenciesService: CurrenciesService) {}

  @Get()
  findAll() {
    return this.currenciesService.getAllCurrencies();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.currenciesService.getCurrencyById(Number(id));
  }

  @Post()
  create(@Body() data: { name: string; symbol: string }) {
    return this.currenciesService.create(data);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() data: { name?: string; symbol?: string }) {
    return this.currenciesService.update(Number(id), data);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.currenciesService.delete(Number(id));
  }
}
