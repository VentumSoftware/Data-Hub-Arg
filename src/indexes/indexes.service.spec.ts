import { Test, TestingModule } from '@nestjs/testing';
import { IndexesService } from './indexes.service';

describe('IndexesService', () => {
  let service: IndexesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [IndexesService],
    }).compile();

    service = module.get<IndexesService>(IndexesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
