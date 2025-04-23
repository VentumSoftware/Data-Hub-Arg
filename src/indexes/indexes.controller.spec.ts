import { Test, TestingModule } from '@nestjs/testing';
import { IndexesController } from './indexes.controller';

describe('IndexesController', () => {
  let controller: IndexesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IndexesController],
    }).compile();

    controller = module.get<IndexesController>(IndexesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
