/* eslint-disable @typescript-eslint/unbound-method -- Jest assertions use mock method references */
import { Test, TestingModule } from '@nestjs/testing';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { UpdateAccountDto } from './dto/update-account.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreatePasswordDto } from './dto/create-password.dto';
import { MfaPreferenceDto } from './dto/mfa-preference.dto';
import { LinkGoogleDto } from './dto/link-google.dto';
import { DeleteMeDto } from './dto/delete-me.dto';
import { AccountType } from 'src/users/enums/account-type.enum';
import { State } from 'src/users/enums/state.enum';

describe('ProfileController', () => {
  let controller: ProfileController;
  let profileService: jest.Mocked<ProfileService>;

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
            createPassword: jest.fn(),
            linkGoogle: jest.fn(),
            unlinkGoogle: jest.fn(),
            deleteMe: jest.fn(),
            getKnownDevices: jest.fn(),
            recordFirstLoginAt: jest.fn(),
            saveAccountSetup: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: jest.fn().mockResolvedValue(true) })
      .compile();

    controller = module.get<ProfileController>(ProfileController);
    profileService = module.get<jest.Mocked<ProfileService>>(ProfileService);
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
      hasPasskey: false,
      passkeyCount: 0,
    };
    profileService.getMe.mockResolvedValue(mockProfile);
    const result = await controller.getMe('access-token', {
      sub: '123',
    });
    expect(result).toEqual({
      message: 'User retrieved successfully',
      data: mockProfile,
    });
    expect(profileService.getMe).toHaveBeenCalledWith('access-token', {
      sub: '123',
    });
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

  it('should create an initial password for OAuth-only users', async () => {
    const createPasswordDto: CreatePasswordDto = {
      newPassword: 'newPass123',
    };
    profileService.createPassword.mockResolvedValue(undefined as never);
    const result = await controller.createPassword(
      '123',
      { sub: '123' },
      createPasswordDto,
    );
    expect(result).toEqual({
      message: 'Password created successfully',
      data: {},
    });
    expect(profileService.createPassword).toHaveBeenCalledWith(
      '123',
      '123',
      createPasswordDto,
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
    expect(profileService.deleteMe).toHaveBeenCalledWith('123', deleteMeDto);
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

  it('should record first login', async () => {
    profileService.recordFirstLoginAt.mockResolvedValue({
      firstLoggedInAt: '2025-01-01T00:00:00.000Z',
    });
    const result = await controller.recordFirstLogin({ sub: 'sub-1' });
    expect(result).toEqual({
      message: 'First login recorded',
      data: { firstLoggedInAt: '2025-01-01T00:00:00.000Z' },
    });
    expect(profileService.recordFirstLoginAt).toHaveBeenCalledWith('sub-1');
  });

  it('should save account setup', async () => {
    const dto = {
      accountType: AccountType.Student,
      onboardingExpectedBand: 'teen13to17' as const,
      teenAgeConfirmed: true,
      teenPermissionConfirmed: true,
      name: 'Alex',
      avatar: '🐉',
      state: State.California,
      zipCode: '90210',
      phoneNumber: '+15555550100',
      interests: ['reading'],
      shortTermGoal: '',
      longTermGoal: '',
      learningStyles: [] as string[],
    };
    profileService.saveAccountSetup.mockResolvedValue({
      onboardingCompletedAt: '2025-06-01T12:00:00.000Z',
    });
    const result = await controller.saveAccountSetup(
      'token',
      { sub: 'sub-1' },
      dto,
    );
    expect(result).toEqual({
      message: 'Account setup saved',
      data: { onboardingCompletedAt: '2025-06-01T12:00:00.000Z' },
    });
    expect(profileService.saveAccountSetup).toHaveBeenCalledWith(
      'token',
      'sub-1',
      dto,
    );
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

    it('createPassword throws', async () => {
      await expect(
        controller.createPassword('token', {}, { newPassword: 'newPass123' }),
      ).rejects.toThrow('Not authenticated');
      expect(profileService.createPassword).not.toHaveBeenCalled();
    });

    it('recordFirstLogin throws', async () => {
      await expect(controller.recordFirstLogin({})).rejects.toThrow(
        'Not authenticated',
      );
      expect(profileService.recordFirstLoginAt).not.toHaveBeenCalled();
    });

    it('saveAccountSetup throws', async () => {
      await expect(
        controller.saveAccountSetup(
          'token',
          {},
          {
            accountType: AccountType.Student,
            onboardingExpectedBand: 'under13',
            under13ChildConfirmed: true,
            under13GuardianPermissionConfirmed: true,
            name: 'A',
            avatar: '🐉',
            state: State.California,
            zipCode: '90210',
            phoneNumber: '+15555550100',
            interests: ['reading'],
            shortTermGoal: '',
            longTermGoal: '',
            learningStyles: [],
          },
        ),
      ).rejects.toThrow('Not authenticated');
      expect(profileService.saveAccountSetup).not.toHaveBeenCalled();
    });
  });
});
