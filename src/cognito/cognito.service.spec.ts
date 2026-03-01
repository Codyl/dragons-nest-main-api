import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CognitoService } from './cognito.service';

describe('CognitoService', () => {
  let service: CognitoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CognitoService,
        {
          provide: 'COGNITO_CLIENT',
          useValue: {},
        },
        {
          provide: 'ACCESS_TOKEN_VERIFIER',
          useValue: { verify: jest.fn() },
        },
        {
          provide: 'ID_TOKEN_VERIFIER',
          useValue: { verify: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const map: Record<string, string> = {
                COGNITO_CLIENT_ID: 'test-client-id',
                COGNITO_USER_POOL_ID: 'test-pool-id',
              };
              return map[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<CognitoService>(CognitoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
