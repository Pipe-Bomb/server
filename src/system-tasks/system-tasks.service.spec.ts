import { Test, TestingModule } from '@nestjs/testing';
import { SystemTasksService } from './system-tasks.service';

describe('SystemTasksService', () => {
  let service: SystemTasksService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SystemTasksService],
    }).compile();

    service = module.get<SystemTasksService>(SystemTasksService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
