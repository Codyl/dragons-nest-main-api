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

  it('should get the location of the user', async () => {
    const location = await service.getLocation('123');
    expect(location).toBeDefined();
  });

  it('should handle maxmind failure', async () => {
    const location = await service.getLocation('123');
    expect(location).toBeDefined();
  });

  it('should handle bad ip address', async () => {
    const location = await service.getLocation('123');
    expect(location).toBeDefined();
  });
});
