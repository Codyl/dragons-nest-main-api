import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';
import { getConnectionToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Connection } from 'mongoose';

describe('AppService', () => {
  let service: AppService;
  let configService: jest.Mocked<ConfigService>;
  let connection: jest.Mocked<Connection>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppService,
        {
          provide: getConnectionToken(),
          useValue: {
            get readyState() {
              return 1;
            },
            name: 'test',
            host: 'localhost',
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AppService>(AppService);
    configService = module.get<jest.Mocked<ConfigService>>(ConfigService);
    connection = module.get<jest.Mocked<Connection>>(getConnectionToken());
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getHealth', () => {
    it('should return the health of the application', () => {
      configService.get.mockImplementation((key: string) => {
        const mockEnv: Record<string, string> = {
          APP_ENV: 'test',
          NODE_ENV: 'test',
        };
        return mockEnv[key];
      });
      const result = service.getHealth();
      expect(result).toMatchObject({
        database: 'connected',
        debug: {
          dbName: 'test',
          host: 'localhost',
          nodeEnv: 'test',
          appEnv: 'test',
        },
      });
    });

    it('should not return the debug object when APP_ENV is production', () => {
      configService.get.mockImplementation((key: string) => {
        const mockEnv = {
          APP_ENV: 'production',
        };
        return mockEnv[key];
      });
      const result = service.getHealth();
      expect(result).not.toHaveProperty('debug');
    });
  });

  it('should return the health of the application with a different database status', () => {
    jest.spyOn(connection, 'readyState', 'get').mockReturnValue(0);

    const result = service.getHealth();
    expect(result).toMatchObject({
      database: 'disconnected',
    });
  });
});
