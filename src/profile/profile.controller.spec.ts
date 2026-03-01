/* eslint-disable @typescript-eslint/unbound-method -- Jest assertions use mock method references */
import { Test, TestingModule } from '@nestjs/testing';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { PasskeyService } from '../passkey/passkey.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateAccountDto } from './dto/update-account.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { MfaPreferenceDto } from './dto/mfa-preference.dto';
import { LinkGoogleDto } from './dto/link-google.dto';
import { DeleteMeDto } from './dto/delete-me.dto';

describe('ProfileController', () => {
  let controller: ProfileController;
  let profileService: jest.Mocked<ProfileService>;
  let passkeyService: jest.Mocked<PasskeyService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProfileController],
      providers: [
        {
          provide: ProfileService,
          useValue: {
            getMe: jest.fn(),
            updateAccount: jest.fn(),
            setMfaPreference: jest.fn(),
            changePassword: jest.fn(),
            linkGoogle: jest.fn(),
            unlinkGoogle: jest.fn(),
            deleteMe: jest.fn(),
            getKnownDevices: jest.fn(),
          },
        },
        {
          provide: PasskeyService,
          useValue: {
            getRegistrationOptions: jest.fn(),
            verifyRegistration: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn().mockResolvedValue(true) })
      .compile();

    controller = module.get<ProfileController>(ProfileController);
    profileService = module.get<jest.Mocked<ProfileService>>(ProfileService);
    passkeyService = module.get<jest.Mocked<PasskeyService>>(PasskeyService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should get the profile of the user', async () => {
    const mockProfile = {
      email: 'test@example.com',
      sub: '123',
      given_name: 'John',
      family_name: 'Doe',
      loginMethods: [],
      hasPassword: true,
    };
    profileService.getMe.mockResolvedValue(mockProfile);
    const result = await controller.getMe('access-token');
    expect(result).toEqual({
      message: 'User retrieved successfully',
      data: mockProfile,
    });
    expect(profileService.getMe).toHaveBeenCalledWith('access-token');
  });

  it('should update the account of the user', async () => {
    const updateAccountDto: UpdateAccountDto = {
      email: 'test@example.com',
      family_name: 'Doe',
      given_name: 'John',
      phone_number: '1234567890',
    };
    profileService.updateAccount.mockResolvedValue(undefined as never);
    const result = await controller.updateAccount('123', updateAccountDto);
    expect(result).toEqual({
      message: 'User settings updated successfully',
      data: {},
    });
    expect(profileService.updateAccount).toHaveBeenCalledWith(
      '123',
      updateAccountDto,
    );
  });

  it('should set the MFA preference of the user', async () => {
    const mfaPreferenceDto: MfaPreferenceDto = {
      softwareTokenMfaEnabled: true,
      preferredMfa: 'SOFTWARE_TOKEN_MFA',
    };
    profileService.setMfaPreference.mockResolvedValue(undefined as never);
    const result = await controller.setMfaPreference('123', mfaPreferenceDto);
    expect(result).toEqual({
      message: 'MFA preferences updated successfully',
      data: {},
    });
    expect(profileService.setMfaPreference).toHaveBeenCalledWith(
      '123',
      mfaPreferenceDto,
    );
  });

  it('should change the password of the user', async () => {
    const changePasswordDto: ChangePasswordDto = {
      currentPassword: 'oldPass123',
      newPassword: 'newPass123',
    };
    profileService.changePassword.mockResolvedValue(undefined as never);
    const result = await controller.changePassword(
      '123',
      { sub: '123' },
      changePasswordDto,
    );
    expect(result).toEqual({
      message: 'Password changed successfully',
      data: {},
    });
    expect(profileService.changePassword).toHaveBeenCalledWith(
      '123',
      '123',
      changePasswordDto,
    );
  });

  it('should link the Google account of the user', async () => {
    const linkGoogleDto: LinkGoogleDto = {
      credential: 'google-credential-jwt',
    };
    profileService.linkGoogle.mockResolvedValue(undefined as never);
    const result = await controller.linkGoogle(
      '123',
      { sub: '123' },
      linkGoogleDto,
    );
    expect(result).toEqual({
      message: 'Google account linked successfully',
      data: {},
    });
    expect(profileService.linkGoogle).toHaveBeenCalledWith(
      '123',
      '123',
      'google-credential-jwt',
    );
  });

  it('should unlink the Google account of the user', async () => {
    profileService.unlinkGoogle.mockResolvedValue(undefined as never);
    const result = await controller.unlinkGoogle('123', { sub: '123' });
    expect(result).toEqual({
      message: 'Google account disconnected successfully',
      data: {},
    });
    expect(profileService.unlinkGoogle).toHaveBeenCalledWith('123', '123');
  });

  it('should delete the user', async () => {
    const deleteMeDto: DeleteMeDto = {
      password: 'password123',
    };
    profileService.deleteMe.mockResolvedValue(undefined as never);
    const result = await controller.deleteMe('123', deleteMeDto);
    expect(result).toEqual({
      message: 'User deleted successfully',
      data: {},
    });
    expect(profileService.deleteMe).toHaveBeenCalledWith('123', 'password123');
  });

  it('should get the known devices of the user', async () => {
    const mockDevices = [
      {
        DeviceKey: 'device-1',
        DeviceName: 'Chrome',
        DeviceLastIPUsed: '1.2.3.4',
      },
    ];
    profileService.getKnownDevices.mockResolvedValue(mockDevices);
    const result = await controller.getKnownDevices('123');
    expect(result).toEqual({
      message: 'Known devices retrieved successfully',
      data: mockDevices,
    });
    expect(profileService.getKnownDevices).toHaveBeenCalledWith('123');
  });

  describe('passkey endpoints', () => {
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
        { id: 'cred-id', response: {} },
      );
      expect(result).toEqual({
        message: 'Passkey registered successfully',
        data: { verified: true },
      });
      expect(passkeyService.verifyRegistration).toHaveBeenCalledWith(
        'user-123',
        { id: 'cred-id', response: {} },
      );
    });

    it('should verify passkey registration and return failure message', async () => {
      passkeyService.verifyRegistration.mockResolvedValue({
        verified: false,
      } as never);
      const result = await controller.passkeyRegisterVerify(
        { sub: 'user-123' },
        {},
      );
      expect(result).toEqual({
        message: 'Passkey verification failed',
        data: { verified: false },
      });
    });
  });

  describe('when user is not authenticated (missing sub)', () => {
    it('changePassword throws', async () => {
      await expect(
        controller.changePassword(
          'token',
          {},
          {
            currentPassword: 'old',
            newPassword: 'new',
          },
        ),
      ).rejects.toThrow('Not authenticated');
      expect(profileService.changePassword).not.toHaveBeenCalled();
    });

    it('linkGoogle throws', async () => {
      await expect(
        controller.linkGoogle('token', {}, { credential: 'jwt' }),
      ).rejects.toThrow('Not authenticated');
      expect(profileService.linkGoogle).not.toHaveBeenCalled();
    });

    it('unlinkGoogle throws', async () => {
      await expect(controller.unlinkGoogle('token', {})).rejects.toThrow(
        'Not authenticated',
      );
      expect(profileService.unlinkGoogle).not.toHaveBeenCalled();
    });

    it('passkeyRegisterOptions throws', async () => {
      await expect(
        controller.passkeyRegisterOptions('token', {}),
      ).rejects.toThrow('Not authenticated');
      expect(passkeyService.getRegistrationOptions).not.toHaveBeenCalled();
    });

    it('passkeyRegisterVerify throws', async () => {
      await expect(controller.passkeyRegisterVerify({}, {})).rejects.toThrow(
        'Not authenticated',
      );
      expect(passkeyService.verifyRegistration).not.toHaveBeenCalled();
    });
  });
});
