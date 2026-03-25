import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

import { CognitoService } from 'src/cognito/cognito.service';
import { UsersService } from 'src/users/users.service';

import { AuthService } from './auth.service';
import {
  DefaultVerificationCodeResolver,
  VERIFICATION_CODE_RESOLVER,
} from './verification-code.resolver';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: CognitoService,
          useValue: {},
        },
        {
          provide: UsersService,
          useValue: {},
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
            getOrThrow: jest.fn(),
          },
        },
        {
          provide: VERIFICATION_CODE_RESOLVER,
          useClass: DefaultVerificationCodeResolver,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
