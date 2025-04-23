import { Controller, Get, Post, Body, Param, Patch, Delete } from '@nestjs/common';
import { IndexesService } from './indexes.service';

@Controller('indexes')
export class IndexesController {
  constructor(private readonly indexesService: IndexesService) {}

  @Get()
  findAll() {
    return this.indexesService.getAllIndexes();
  }

  @Get(':date')
  findOne(@Param('date') date: string) {
    return this.indexesService.getIndexesByDate(String(date));
  }

  @Post('/conversion')
  getConversion(@Body() data: { from: { currency: string, date: string }, to: { currency?: string , date: string }, amount: number }) {
    return this.indexesService.getConversion(data);
  }
  @Patch()
  update() {
    return this.indexesService.updateMissingIndexes();
  }
}
