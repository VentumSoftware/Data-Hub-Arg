import { Module } from '@nestjs/common';
import { CurrenciesModule } from './currencies/currencies.module';
import { IndexesModule } from './indexes/indexes.module';
@Module({
  imports: [CurrenciesModule, IndexesModule],
})
export class AppModule {}