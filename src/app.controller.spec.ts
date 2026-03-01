import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ServiceUnavailableException } from '@nestjs/common';

describe('AppController', () => {
  let appController: AppController;
  let appService: jest.Mocked<AppService>;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: {
            getHealth: jest.fn(),
          },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
    appService = app.get<jest.Mocked<AppService>>(AppService);
  });

  it('should be defined', () => {
    expect(appController).toBeDefined();
  });

  describe('getHealth', () => {
    it('should return the health of the application', () => {
      const mockData = {
        uptime: 100,
        timestamp: '2026-02-28T00:00:00.000Z',
        database: 'connected',
        debug: {
          dbName: 'test',
          host: 'localhost',
          nodeEnv: 'test',
          appEnv: 'test',
        },
      };
      appService.getHealth.mockReturnValue(mockData);
      const result = appController.getHealth();
      expect(result).toMatchObject({
        message: 'OK',
        data: mockData,
      });
    });

    it('should throw a ServiceUnavailableException if the database is disconnected', () => {
      appService.getHealth.mockImplementation(() => {
        throw new ServiceUnavailableException('Database is disconnected');
      });
      expect(() => appController.getHealth()).toThrow(
        ServiceUnavailableException,
      );
    });
  });
});
