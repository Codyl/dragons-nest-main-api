import { Test, TestingModule } from '@nestjs/testing';
import { MaxmindService } from './maxmind.service';

describe('MaxmindService', () => {
  let service: MaxmindService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MaxmindService],
    }).compile();

    service = module.get<MaxmindService>(MaxmindService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
