import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  const authService = {
    confirmForgotPassword: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn(() => 'development'),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should verify account recovery code', async () => {
    authService.confirmForgotPassword.mockResolvedValue({
      AuthenticationResult: {},
    });
    const res = {
      cookie: jest.fn(),
    };
    const result = await controller.verifyAccountRecoveryCode(
      {
        username: 'user@example.com',
        code: '123456',
        password: 'SecurePassword123!',
      },
      res as never,
    );

    expect(authService.confirmForgotPassword).toHaveBeenCalledWith(
      'user@example.com',
      '123456',
      'SecurePassword123!',
    );
    expect(result.message).toBe('Account recovered successfully');
  });
});
