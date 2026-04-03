import { Test, TestingModule } from '@nestjs/testing';
import {
  HealthCheckService,
  HttpHealthIndicator,
  MongooseHealthIndicator,
} from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';

import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: { check: jest.fn() },
        },
        {
          provide: HttpHealthIndicator,
          useValue: { pingCheck: jest.fn() },
        },
        {
          provide: MongooseHealthIndicator,
          useValue: { pingCheck: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
            getOrThrow: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
