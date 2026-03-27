import { Test, TestingModule } from '@nestjs/testing';
import {
  HttpException,
  HttpStatus,
  InternalServerErrorException,
} from '@nestjs/common';
import { MaxmindService } from './maxmind.service';

describe('MaxmindService', () => {
  let service: MaxmindService;
  const cityMock = jest.fn();

  beforeEach(async () => {
    cityMock.mockReset();
    cityMock.mockResolvedValue({
      city: {},
      subdivisions: [],
      country: {},
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaxmindService,
        {
          provide: 'MAXMIND_CLIENT',
          useValue: {
            city: cityMock,
          },
        },
      ],
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

  it('returns 429 when MaxMind quota is exceeded', async () => {
    cityMock.mockRejectedValueOnce(
      new Error('OUT_OF_QUERIES: MaxMind account query limit reached'),
    );

    await expect(service.getLocation('123')).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    } as unknown as HttpException);
  });

  it('throws InternalServerErrorException for non-quota errors', async () => {
    cityMock.mockRejectedValueOnce(new Error('socket hang up'));

    await expect(service.getLocation('123')).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });
});
