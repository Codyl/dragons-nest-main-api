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
  const cognitoService = {
    forgotPassword: jest.fn(),
    confirmForgotPassword: jest.fn(),
    adminGetUser: jest.fn(),
    authenticateWithSrp: jest.fn(),
  };
  const usersService = {
    updateByCognitoSub: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: CognitoService,
          useValue: cognitoService,
        },
        {
          provide: UsersService,
          useValue: usersService,
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

  it('should issue account recovery code via forgot password', async () => {
    await service.issueAccountRecoveryCode('user@example.com');
    expect(cognitoService.forgotPassword).toHaveBeenCalledWith(
      'user@example.com',
    );
  });

  it('should resolve recovery code with account_recovery flow', async () => {
    const resolver = {
      resolve: jest.fn().mockResolvedValue('resolved-code'),
    };
    (
      service as unknown as { verificationCodeResolver: typeof resolver }
    ).verificationCodeResolver = resolver;
    const serviceWithConfirmForgotPassword = service as unknown as {
      confirmForgotPassword: (
        username: string,
        code: string,
        password: string,
      ) => Promise<{ AuthenticationResult?: Record<string, never> }>;
    };
    const confirmSpy = jest
      .spyOn(serviceWithConfirmForgotPassword, 'confirmForgotPassword')
      .mockResolvedValue({ AuthenticationResult: {} });

    await service.verifyAccountRecoveryCode(
      'user@example.com',
      'raw-code',
      'SecurePassword123!',
    );

    expect(resolver.resolve).toHaveBeenCalledWith(
      'raw-code',
      'account_recovery',
    );
    expect(confirmSpy).toHaveBeenCalledWith(
      'user@example.com',
      'resolved-code',
      'SecurePassword123!',
    );
  });
});
