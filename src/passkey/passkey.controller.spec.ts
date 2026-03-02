/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { PasskeyController } from './passkey.controller';
import { PasskeyService } from './passkey.service';
import { PasskeyVerifyRegistrationDto } from 'src/passkey/dto/passkey-verify-registration.dto';

describe('PasskeyController', () => {
  let controller: PasskeyController;
  let passkeyService: jest.Mocked<PasskeyService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PasskeyController],
      providers: [
        {
          provide: PasskeyService,
          useValue: {
            getRegistrationOptions: jest.fn(),
            verifyRegistration: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<PasskeyController>(PasskeyController);
    passkeyService = module.get<jest.Mocked<PasskeyService>>(PasskeyService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('passkey endpoints', () => {
    const validPasskeyDto: PasskeyVerifyRegistrationDto = {
      id: 'cred-id',
      rawId: 'raw-cred-id',
      type: 'public-key',
      response: {
        clientDataJSON: 'client-data-json',
        attestationObject: 'attestation-object',
      },
    };

    it('should return passkey registration options', async () => {
      const mockOptions = { challenge: 'challenge', rp: { name: 'Test' } };
      passkeyService.getRegistrationOptions.mockResolvedValue(
        mockOptions as never,
      );
      const result = await controller.passkeyRegisterOptions('token', {
        sub: 'user-123',
      });
      expect(result).toEqual({
        message: 'Registration options',
        data: mockOptions,
      });
      expect(passkeyService.getRegistrationOptions).toHaveBeenCalledWith(
        'token',
        'user-123',
      );
    });

    it('should verify passkey registration and return success message', async () => {
      passkeyService.verifyRegistration.mockResolvedValue({
        verified: true,
      } as never);
      const result = await controller.passkeyRegisterVerify(
        { sub: 'user-123' },
        validPasskeyDto,
      );
      expect(result).toEqual({
        message: 'Passkey registered successfully',
        data: { verified: true },
      });
      expect(passkeyService.verifyRegistration).toHaveBeenCalledWith(
        'user-123',
        validPasskeyDto,
      );
    });

    it('should verify passkey registration and return failure message', async () => {
      passkeyService.verifyRegistration.mockResolvedValue({
        verified: false,
      } as never);
      const result = await controller.passkeyRegisterVerify(
        { sub: 'user-123' },
        validPasskeyDto,
      );
      expect(result).toEqual({
        message: 'Passkey verification failed',
        data: { verified: false },
      });
    });

    it('passkeyRegisterOptions throws', async () => {
      await expect(
        controller.passkeyRegisterOptions('token', {}),
      ).rejects.toThrow('Not authenticated');
      expect(passkeyService.getRegistrationOptions).not.toHaveBeenCalled();
    });

    it('passkeyRegisterVerify throws', async () => {
      await expect(
        controller.passkeyRegisterVerify(
          {},
          {} as PasskeyVerifyRegistrationDto,
        ),
      ).rejects.toThrow('Not authenticated');
      expect(passkeyService.verifyRegistration).not.toHaveBeenCalled();
    });
  });
});
