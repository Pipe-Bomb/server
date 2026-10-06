import { Test, TestingModule } from '@nestjs/testing';
import { EventClientService } from './event-client.service';

describe('EventClientService', () => {
  let service: EventClientService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EventClientService],
    }).compile();

    service = module.get<EventClientService>(EventClientService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
