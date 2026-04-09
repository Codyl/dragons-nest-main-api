import { Test, TestingModule } from '@nestjs/testing';
import {
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ProfileService } from './profile.service';
import { CognitoService, GetUserResult } from 'src/cognito/cognito.service';
import { MaxmindService } from 'src/maxmind/maxmind.service';
import { GoogleService } from 'src/google/google.service';
import { UsersService, UserDoc } from 'src/users/users.service';
import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';
import { MAXMIND_KEY } from 'src/env.constants';
import { UpdateAccountDto } from './dto/update-account.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreatePasswordDto } from './dto/create-password.dto';
import { AccountType } from 'src/users/enums/account-type.enum';
import { AgeBandAtRegistration } from 'src/users/enums/age-band-at-registration.enum';
import { OnboardingExpectedBand } from 'src/users/enums/onboarding-expected-band.enum';
import { State } from 'src/users/enums/state.enum';

/* eslint-disable @typescript-eslint/unbound-method */
describe('ProfileService', () => {
  let service: ProfileService;
  let cognitoService: jest.Mocked<CognitoService>;
  let usersService: jest.Mocked<UsersService>;
  let maxmindService: jest.Mocked<MaxmindService>;
  let googleService: jest.Mocked<GoogleService>;
  let configService: jest.Mocked<ConfigService>;
  let configGet: jest.Mock;

  beforeEach(async () => {
    configGet = jest.fn();
    const configServiceImpl = {
      get: configGet,
      getOrThrow: jest.fn((key: string) => {
        const v = configGet(key);
        if (v !== undefined && v !== null) {
          return v;
        }

        if (key === MAXMIND_KEY) {
          return '';
        }

        throw new Error(`Missing configuration key: ${key}`);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        {
          provide: CognitoService,
          useValue: {
            getUser: jest.fn<Promise<GetUserResult | undefined>, [string]>(),
            updateUserAttributes: jest.fn(),
            setUserMFAPreferenceWithSettings: jest.fn(),
            changePassword: jest.fn(),
            adminSetUserPassword: jest.fn(),
            authenticateWithSrp: jest.fn(),
            respondToSoftwareTokenMFAChallenge: jest.fn(),
            deleteUser: jest.fn(),
            adminLinkProviderForUser: jest.fn(),
            adminDisableProviderForUser: jest.fn(),
            listDevices: jest.fn(),
            updateDeviceStatus: jest.fn(),
            forgetDevice: jest.fn(),
            listWebAuthnCredentials: jest
              .fn()
              .mockResolvedValue({ Credentials: [] }),
          },
        },
        {
          provide: MaxmindService,
          useValue: {
            getLocation: jest.fn(),
          },
        },
        {
          provide: GoogleService,
          useValue: {
            googleTokenExchange: jest.fn(),
            googleSSOSignup: jest.fn(),
            verifyCredential: jest.fn(),
          },
        },
        {
          provide: UsersService,
          useValue: {
            createUser: jest.fn(),
            findAll: jest.fn(),
            findOneById: jest.fn(),
            findOneByCognitoSub: jest.fn(),
            updateByCognitoSub: jest.fn(),
            addLinkGoogle: jest.fn(),
            removeLinkGoogle: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: configServiceImpl,
        },
      ],
    }).compile();

    service = module.get<ProfileService>(ProfileService);
    cognitoService = module.get<jest.Mocked<CognitoService>>(CognitoService);
    usersService = module.get<jest.Mocked<UsersService>>(UsersService);
    maxmindService = module.get<jest.Mocked<MaxmindService>>(MaxmindService);
    googleService = module.get<jest.Mocked<GoogleService>>(GoogleService);
    configService = module.get<jest.Mocked<ConfigService>>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should merge Cognito attributes with user doc (loginMethods, hasPassword, MFA)', async () => {
    const cognitoSub = '123';
    cognitoService.getUser.mockResolvedValue({
      UserAttributes: [
        { Name: 'email', Value: 'test@example.com' },
        { Name: 'sub', Value: cognitoSub },
        { Name: 'given_name', Value: 'John' },
        { Name: 'family_name', Value: 'Doe' },
      ],
      UserMFASettingList: ['SOFTWARE_TOKEN_MFA'],
      PreferredMfaSetting: 'SOFTWARE_TOKEN_MFA',
    });
    const userDoc: UserDoc = {
      _id: new Types.ObjectId(),
      cognitoSub,
      hasPassword: false,
      linkedProviders: ['GOOGLE'],
      linkedProviderSubjects: { GOOGLE: 'google-sub' },
    };
    usersService.findOneByCognitoSub.mockResolvedValue(userDoc);

    const profile = await service.getMe('accessToken', {
      sub: cognitoSub,
    });
    expect(profile).toMatchObject({
      email: 'test@example.com',
      sub: '123',
      given_name: 'John',
      family_name: 'Doe',
      loginMethods: ['GOOGLE'],
      hasPassword: false,
      hasPasskey: false,
      passkeyCount: 0,
      softwareTokenMfaEnabled: true,
      preferredMfa: 'SOFTWARE_TOKEN_MFA',
      firstLoggedInAt: null,
      accountType: null,
      canManageOthers: false,
      parentId: null,
      linkedStudentIds: [],
      accountStatus: null,
      ageBandAtRegistration: null,
    });
    expect(cognitoService.listWebAuthnCredentials).toHaveBeenCalledWith(
      'accessToken',
    );
  });

  it('should throw when getMe has no sub on current user', async () => {
    await expect(service.getMe('token', {})).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should throw when getMe gets no UserAttributes from Cognito', async () => {
    cognitoService.getUser.mockResolvedValue(undefined);
    await expect(service.getMe('bad-token', { sub: '123' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should throw NotFoundException when getMe user is not in DB', async () => {
    cognitoService.getUser.mockResolvedValue({
      UserAttributes: [
        { Name: 'sub', Value: 'missing-sub' },
        { Name: 'email', Value: 'u@example.com' },
      ],
    });
    usersService.findOneByCognitoSub.mockResolvedValue(null);
    await expect(
      service.getMe('accessToken', { sub: 'missing-sub' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should set hasPasskey from Cognito ListWebAuthnCredentials', async () => {
    const cognitoSub = '123';
    cognitoService.getUser.mockResolvedValue({
      UserAttributes: [
        { Name: 'email', Value: 'u@example.com' },
        { Name: 'sub', Value: cognitoSub },
      ],
    });
    cognitoService.listWebAuthnCredentials.mockResolvedValue({
      Credentials: [{ CredentialId: 'a' }, { CredentialId: 'b' }],
    } as never);
    usersService.findOneByCognitoSub.mockResolvedValue({
      _id: new Types.ObjectId(),
      cognitoSub,
      email: 'u@example.com',
    } as UserDoc);

    const profile = await service.getMe('accessToken', { sub: cognitoSub });
    expect(profile.hasPasskey).toBe(true);
    expect(profile.passkeyCount).toBe(2);
  });

  it('should treat passkey count as zero when listWebAuthnCredentials is unauthorized', async () => {
    const cognitoSub = '123';
    cognitoService.getUser.mockResolvedValue({
      UserAttributes: [
        { Name: 'email', Value: 'u@example.com' },
        { Name: 'sub', Value: cognitoSub },
      ],
    });
    cognitoService.listWebAuthnCredentials.mockRejectedValue(
      new UnauthorizedException(),
    );
    usersService.findOneByCognitoSub.mockResolvedValue({
      _id: new Types.ObjectId(),
      cognitoSub,
    } as UserDoc);

    const profile = await service.getMe('accessToken', { sub: cognitoSub });
    expect(profile.hasPasskey).toBe(false);
    expect(profile.passkeyCount).toBe(0);
  });

  it('listWebAuthnCredentialsForSettings returns empty when Cognito rejects as unauthorized', async () => {
    cognitoService.listWebAuthnCredentials.mockRejectedValue(
      new UnauthorizedException(),
    );
    const rows = await service.listWebAuthnCredentialsForSettings('token');
    expect(rows).toEqual([]);
  });

  describe('saveAccountSetup', () => {
    const dto = {
      accountType: AccountType.Student,
      onboardingExpectedBand: OnboardingExpectedBand.Teen13to17,
      teenAgeConfirmed: true,
      teenPermissionConfirmed: true,
      name: 'Alex',
      avatar: '🐉',
      state: State.California,
      zipCode: '90210',
      phoneNumber: '+15555550100',
      interests: ['reading'],
      shortTermGoal: 'Learn',
      longTermGoal: 'Grow',
      learningStyles: ['hands-on'],
    };

    it('should throw NotFoundException when user is missing', async () => {
      usersService.findOneByCognitoSub.mockResolvedValue(null);
      await expect(service.saveAccountSetup('tok', 'sub', dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw when Cognito update returns falsy', async () => {
      usersService.findOneByCognitoSub.mockResolvedValue({
        _id: new Types.ObjectId(),
        cognitoSub: 'sub',
      } as UserDoc);
      cognitoService.updateUserAttributes.mockResolvedValue(undefined as never);
      await expect(service.saveAccountSetup('tok', 'sub', dto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should update Cognito given_name and persist Mongo fields', async () => {
      usersService.findOneByCognitoSub.mockResolvedValue({
        _id: new Types.ObjectId(),
        cognitoSub: 'sub',
      } as UserDoc);
      cognitoService.updateUserAttributes.mockResolvedValue({} as never);
      const completed = new Date('2024-06-01T12:00:00.000Z');
      usersService.updateByCognitoSub.mockResolvedValue({
        cognitoSub: 'sub',
        onboardingCompletedAt: completed,
      } as never);
      const r = await service.saveAccountSetup('tok', 'sub', dto);
      expect(r.onboardingCompletedAt).toBe(completed.toISOString());
      expect(cognitoService.updateUserAttributes).toHaveBeenCalledWith('tok', [
        { Name: 'given_name', Value: 'Alex' },
        { Name: 'phone_number', Value: '+15555550100' },
      ]);
      expect(usersService.updateByCognitoSub).toHaveBeenCalledWith(
        'sub',
        expect.objectContaining({
          $set: expect.objectContaining({
            ageBandAtRegistration: AgeBandAtRegistration.Teen13To17,
            ageAttestationConfirmedAt: expect.any(Date),
            avatar: '🐉',
            interests: ['reading'],
            shortTermGoal: 'Learn',
            longTermGoal: 'Grow',
            learningStyles: ['hands-on'],
            state: State.California,
            zipCode: '90210',
          }),
          $unset: { age: '', birthDate: '' },
        }),
      );
    });
  });

  describe('recordFirstLoginAt', () => {
    it('should throw NotFoundException when user is missing', async () => {
      usersService.findOneByCognitoSub.mockResolvedValue(null);
      await expect(service.recordFirstLoginAt('sub')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return existing timestamp without updating when already set', async () => {
      const at = new Date('2020-01-01T00:00:00.000Z');
      usersService.findOneByCognitoSub.mockResolvedValue({
        _id: new Types.ObjectId(),
        cognitoSub: 'sub',
        firstLoggedInAt: at,
      } as UserDoc);
      const r = await service.recordFirstLoginAt('sub');
      expect(r.firstLoggedInAt).toBe(at.toISOString());
      expect(usersService.updateByCognitoSub).not.toHaveBeenCalled();
    });

    it('should persist firstLoggedInAt when unset', async () => {
      usersService.findOneByCognitoSub.mockResolvedValue({
        _id: new Types.ObjectId(),
        cognitoSub: 'sub',
        email: 'a@b.com',
      } as UserDoc);
      const now = new Date('2024-06-01T12:00:00.000Z');
      usersService.updateByCognitoSub.mockResolvedValue({
        cognitoSub: 'sub',
        firstLoggedInAt: now,
      } as never);
      const r = await service.recordFirstLoginAt('sub');
      expect(r.firstLoggedInAt).toBe(now.toISOString());
      expect(usersService.updateByCognitoSub).toHaveBeenCalledWith('sub', {
        firstLoggedInAt: expect.any(Date),
      });
    });
  });

  it('should not call Cognito when updateAccount receives no attributes', async () => {
    const response = await service.updateAccount('123', {});
    expect(response).toBeUndefined();
    expect(cognitoService.updateUserAttributes).not.toHaveBeenCalled();
  });

  it('should send only provided updateAccount fields to Cognito', async () => {
    cognitoService.updateUserAttributes.mockResolvedValue({} as never);
    await service.updateAccount('token', {
      email: 'only@example.com',
    } as UpdateAccountDto);
    expect(cognitoService.updateUserAttributes).toHaveBeenCalledTimes(1);
    expect(cognitoService.updateUserAttributes).toHaveBeenCalledWith('token', [
      { Name: 'email', Value: 'only@example.com' },
    ]);
  });

  it('should throw when updateAccount receives no response from Cognito', async () => {
    cognitoService.updateUserAttributes.mockResolvedValue(undefined as never);
    const promise = service.updateAccount('token', { email: 'a@b.com' });
    await expect(promise).rejects.toThrow(InternalServerErrorException);
    await expect(promise).rejects.toThrow('Failed to update user attributes');
  });

  describe('setMfaPreference', () => {
    it('should pass softwareTokenPreferred true when preferredMfa is softwareToken', async () => {
      cognitoService.setUserMFAPreferenceWithSettings.mockResolvedValue(
        {} as never,
      );
      await service.setMfaPreference('token', {
        softwareTokenMfaEnabled: true,
        preferredMfa: 'softwareToken',
      });
      expect(
        cognitoService.setUserMFAPreferenceWithSettings,
      ).toHaveBeenCalledWith('token', {
        softwareTokenMfaEnabled: true,
        softwareTokenPreferred: true,
      });
    });

    it('should pass softwareTokenPreferred false for other preferredMfa values', async () => {
      cognitoService.setUserMFAPreferenceWithSettings.mockResolvedValue(
        {} as never,
      );
      await service.setMfaPreference('token', {
        softwareTokenMfaEnabled: true,
        preferredMfa: 'SOFTWARE_TOKEN_MFA',
      });
      expect(
        cognitoService.setUserMFAPreferenceWithSettings,
      ).toHaveBeenCalledWith('token', {
        softwareTokenMfaEnabled: true,
        softwareTokenPreferred: false,
      });
    });

    it('should throw when Cognito setUserMFAPreferenceWithSettings returns falsy', async () => {
      cognitoService.setUserMFAPreferenceWithSettings.mockResolvedValue(
        undefined as never,
      );
      await expect(
        service.setMfaPreference('token', {
          softwareTokenMfaEnabled: true,
          preferredMfa: 'SOFTWARE_TOKEN_MFA',
        }),
      ).rejects.toThrow(InternalServerErrorException);
      await expect(
        service.setMfaPreference('token', {
          softwareTokenMfaEnabled: true,
          preferredMfa: 'SOFTWARE_TOKEN_MFA',
        }),
      ).rejects.toThrow('Failed to set MFA preference');
    });
  });

  describe('changePassword', () => {
    it('should call Cognito changePassword and update user hasPassword', async () => {
      const changePasswordDto: ChangePasswordDto = {
        currentPassword: 'oldPassword123',
        newPassword: 'newPassword123',
      };
      const mockCognitoResponse = {};
      const mockUserResponse = {};
      cognitoService.changePassword.mockResolvedValue(
        mockCognitoResponse as never,
      );
      usersService.updateByCognitoSub.mockResolvedValue(
        mockUserResponse as never,
      );
      const result = await service.changePassword(
        '123',
        'cognito-sub-123',
        changePasswordDto,
      );
      expect(cognitoService.changePassword).toHaveBeenCalledWith(
        '123',
        'oldPassword123',
        'newPassword123',
      );
      expect(usersService.updateByCognitoSub).toHaveBeenCalledWith(
        'cognito-sub-123',
        { hasPassword: true },
      );
      expect(result).toEqual({
        cognitoResponse: mockCognitoResponse,
        userResponse: mockUserResponse,
      });
    });
  });

  describe('createPassword', () => {
    it('should set password via admin API when user has no password', async () => {
      const dto: CreatePasswordDto = { newPassword: 'NewPassword123' };
      usersService.findOneByCognitoSub.mockResolvedValue({
        _id: new Types.ObjectId(),
        cognitoSub: 'cognito-sub',
        hasPassword: false,
        deleted: false,
      } as UserDoc);
      cognitoService.getUser.mockResolvedValue({
        UserAttributes: [
          { Name: 'email', Value: 'user@example.com' },
          { Name: 'sub', Value: 'cognito-sub' },
        ],
      });
      cognitoService.adminSetUserPassword.mockResolvedValue(undefined as never);
      usersService.updateByCognitoSub.mockResolvedValue({} as never);

      await service.createPassword('access-token', 'cognito-sub', dto);

      expect(cognitoService.adminSetUserPassword).toHaveBeenCalledWith(
        'user@example.com',
        'NewPassword123',
      );
      expect(usersService.updateByCognitoSub).toHaveBeenCalledWith(
        'cognito-sub',
        { hasPassword: true },
      );
    });

    it('should use preferred_username when email is absent', async () => {
      const dto: CreatePasswordDto = { newPassword: 'NewPassword123' };
      usersService.findOneByCognitoSub.mockResolvedValue({
        _id: new Types.ObjectId(),
        cognitoSub: 'cognito-sub',
        hasPassword: false,
        deleted: false,
      } as UserDoc);
      cognitoService.getUser.mockResolvedValue({
        UserAttributes: [
          { Name: 'preferred_username', Value: 'user@example.com' },
        ],
      });
      cognitoService.adminSetUserPassword.mockResolvedValue(undefined as never);
      usersService.updateByCognitoSub.mockResolvedValue({} as never);

      await service.createPassword('access-token', 'cognito-sub', dto);

      expect(cognitoService.adminSetUserPassword).toHaveBeenCalledWith(
        'user@example.com',
        'NewPassword123',
      );
    });

    it('should throw BadRequestException when user already has a password', async () => {
      usersService.findOneByCognitoSub.mockResolvedValue({
        _id: new Types.ObjectId(),
        cognitoSub: 'cognito-sub',
        hasPassword: true,
      } as UserDoc);
      await expect(
        service.createPassword('token', 'cognito-sub', {
          newPassword: 'NewPassword123',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(cognitoService.adminSetUserPassword).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when user doc is missing', async () => {
      usersService.findOneByCognitoSub.mockResolvedValue(null);
      await expect(
        service.createPassword('token', 'cognito-sub', {
          newPassword: 'NewPassword123',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('linkGoogle', () => {
    it('should link Google when Cognito email matches Google email', async () => {
      googleService.verifyCredential.mockResolvedValue({
        email: 'user@example.com',
        sub: 'google-sub-123',
      });
      cognitoService.getUser.mockResolvedValue({
        UserAttributes: [
          { Name: 'email', Value: 'user@example.com' },
          { Name: 'sub', Value: 'cognito-sub' },
        ],
      });
      cognitoService.adminLinkProviderForUser.mockResolvedValue({} as never);
      usersService.addLinkGoogle.mockResolvedValue({} as never);
      await service.linkGoogle('accessToken', 'cognito-sub', 'credential-jwt');
      expect(googleService.verifyCredential).toHaveBeenCalledWith(
        'credential-jwt',
      );
      expect(cognitoService.adminLinkProviderForUser).toHaveBeenCalledWith(
        'cognito-sub',
        'google-sub-123',
        'Google',
      );
      expect(usersService.addLinkGoogle).toHaveBeenCalledWith(
        'cognito-sub',
        'google-sub-123',
      );
    });

    it('should throw BadRequestException when Google email does not match account email', async () => {
      googleService.verifyCredential.mockResolvedValue({
        email: 'other@gmail.com',
        sub: 'google-sub-123',
      });
      cognitoService.getUser.mockResolvedValue({
        UserAttributes: [
          { Name: 'email', Value: 'user@example.com' },
          { Name: 'sub', Value: 'cognito-sub' },
        ],
      });
      await expect(
        service.linkGoogle('accessToken', 'cognito-sub', 'credential-jwt'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.linkGoogle('accessToken', 'cognito-sub', 'credential-jwt'),
      ).rejects.toThrow('Google account email must match your account email.');
      expect(cognitoService.adminLinkProviderForUser).not.toHaveBeenCalled();
    });
  });

  describe('unlinkGoogle', () => {
    it('should call Cognito and UsersService when user has password and Google linked', async () => {
      const userDoc: UserDoc = {
        _id: new Types.ObjectId(),
        cognitoSub: 'cognito-sub',
        hasPassword: true,
        linkedProviders: ['GOOGLE'],
        linkedProviderSubjects: { GOOGLE: 'google-sub-123' },
      };
      usersService.findOneByCognitoSub.mockResolvedValue(userDoc);
      cognitoService.adminDisableProviderForUser.mockResolvedValue({} as never);
      usersService.removeLinkGoogle.mockResolvedValue({} as never);
      await service.unlinkGoogle('accessToken', 'cognito-sub');
      expect(cognitoService.adminDisableProviderForUser).toHaveBeenCalledWith(
        'Google',
        'google-sub-123',
      );
      expect(usersService.removeLinkGoogle).toHaveBeenCalledWith('cognito-sub');
    });

    it('should throw NotFoundException when user is not found', async () => {
      usersService.findOneByCognitoSub.mockResolvedValue(null);
      await expect(
        service.unlinkGoogle('accessToken', 'cognito-sub'),
      ).rejects.toThrow(NotFoundException);
      expect(cognitoService.adminDisableProviderForUser).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when Google is not linked', async () => {
      usersService.findOneByCognitoSub.mockResolvedValue({
        _id: new Types.ObjectId(),
        cognitoSub: 'cognito-sub',
        hasPassword: true,
        linkedProviders: [],
        linkedProviderSubjects: {},
      });
      await expect(
        service.unlinkGoogle('accessToken', 'cognito-sub'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.unlinkGoogle('accessToken', 'cognito-sub'),
      ).rejects.toThrow('Google account is not linked');
    });

    it('should throw BadRequestException when user has no password', async () => {
      usersService.findOneByCognitoSub.mockResolvedValue({
        _id: new Types.ObjectId(),
        cognitoSub: 'cognito-sub',
        hasPassword: false,
        linkedProviders: ['GOOGLE'],
        linkedProviderSubjects: { GOOGLE: 'google-sub-123' },
      });
      await expect(
        service.unlinkGoogle('accessToken', 'cognito-sub'),
      ).rejects.toThrow('You must create a password before you can disconnect');
    });

    it('should throw BadRequestException when linkedProviderSubjects.GOOGLE is missing', async () => {
      usersService.findOneByCognitoSub.mockResolvedValue({
        _id: new Types.ObjectId(),
        cognitoSub: 'cognito-sub',
        hasPassword: true,
        linkedProviders: ['GOOGLE'],
        linkedProviderSubjects: {},
      });
      await expect(
        service.unlinkGoogle('accessToken', 'cognito-sub'),
      ).rejects.toThrow('Unable to unlink Google');
    });

    it('should throw when Cognito or UsersService returns falsy', async () => {
      usersService.findOneByCognitoSub.mockResolvedValue({
        _id: new Types.ObjectId(),
        cognitoSub: 'cognito-sub',
        hasPassword: true,
        linkedProviders: ['GOOGLE'],
        linkedProviderSubjects: { GOOGLE: 'google-sub-123' },
      });
      cognitoService.adminDisableProviderForUser.mockResolvedValue(
        undefined as never,
      );
      usersService.removeLinkGoogle.mockResolvedValue({} as never);
      await expect(
        service.unlinkGoogle('accessToken', 'cognito-sub'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('deleteMe', () => {
    beforeEach(() => {
      usersService.findOneByCognitoSub.mockResolvedValue({
        cognitoSub: 'cognito-sub-123',
        hasPassword: true,
        deleted: false,
      } as UserDoc);
    });

    it('should authenticate with SRP, delete in Cognito, then mark user deleted in DB', async () => {
      cognitoService.getUser.mockResolvedValue({
        UserAttributes: [
          { Name: 'email', Value: 'user@example.com' },
          { Name: 'sub', Value: 'cognito-sub-123' },
        ],
      });
      cognitoService.authenticateWithSrp.mockResolvedValue({
        AuthenticationResult: {},
      } as never);
      cognitoService.deleteUser.mockResolvedValue({} as never);
      usersService.updateByCognitoSub.mockResolvedValue({} as never);
      await service.deleteMe('accessToken', { password: 'password123' });
      expect(cognitoService.authenticateWithSrp).toHaveBeenCalledWith(
        'user@example.com',
        'password123',
      );
      expect(cognitoService.deleteUser).toHaveBeenCalledWith('accessToken');
      expect(usersService.updateByCognitoSub).toHaveBeenCalledWith(
        'cognito-sub-123',
        { deleted: true },
      );
    });

    it('should throw UnauthorizedException when email/preferred_username missing', async () => {
      cognitoService.getUser.mockResolvedValue({
        UserAttributes: [{ Name: 'sub', Value: 'cognito-sub' }],
      });
      await expect(
        service.deleteMe('accessToken', { password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(cognitoService.authenticateWithSrp).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when sub missing', async () => {
      cognitoService.getUser.mockResolvedValue({
        UserAttributes: [{ Name: 'email', Value: 'user@example.com' }],
      });
      await expect(
        service.deleteMe('accessToken', { password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(usersService.findOneByCognitoSub).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when password is wrong', async () => {
      cognitoService.getUser.mockResolvedValue({
        UserAttributes: [
          { Name: 'email', Value: 'user@example.com' },
          { Name: 'sub', Value: 'cognito-sub-123' },
        ],
      });
      cognitoService.authenticateWithSrp.mockResolvedValue({
        AuthenticationResult: undefined,
        ChallengeName: undefined,
        Session: undefined,
      } as never);
      await expect(
        service.deleteMe('accessToken', { password: 'wrongpassword' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(cognitoService.deleteUser).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when SOFTWARE_TOKEN_MFA challenge but no MFA code', async () => {
      cognitoService.getUser.mockResolvedValue({
        UserAttributes: [
          { Name: 'email', Value: 'user@example.com' },
          { Name: 'sub', Value: 'cognito-sub-123' },
        ],
      });
      cognitoService.authenticateWithSrp.mockResolvedValue({
        AuthenticationResult: undefined,
        ChallengeName: 'SOFTWARE_TOKEN_MFA',
        Session: 'mfa-session',
      } as never);
      await expect(
        service.deleteMe('accessToken', { password: 'password123' }),
      ).rejects.toThrow(BadRequestException);
      expect(
        cognitoService.respondToSoftwareTokenMFAChallenge,
      ).not.toHaveBeenCalled();
      expect(cognitoService.deleteUser).not.toHaveBeenCalled();
    });

    it('should complete SOFTWARE_TOKEN_MFA then delete when MFA code is valid', async () => {
      cognitoService.getUser.mockResolvedValue({
        UserAttributes: [
          { Name: 'email', Value: 'user@example.com' },
          { Name: 'sub', Value: 'cognito-sub-123' },
        ],
      });
      cognitoService.authenticateWithSrp.mockResolvedValue({
        AuthenticationResult: undefined,
        ChallengeName: 'SOFTWARE_TOKEN_MFA',
        Session: 'mfa-session',
      } as never);
      cognitoService.respondToSoftwareTokenMFAChallenge.mockResolvedValue({
        AuthenticationResult: {},
      } as never);
      cognitoService.deleteUser.mockResolvedValue({} as never);
      usersService.updateByCognitoSub.mockResolvedValue({} as never);
      await service.deleteMe('accessToken', {
        password: 'password123',
        mfaCode: '123456',
      });
      expect(
        cognitoService.respondToSoftwareTokenMFAChallenge,
      ).toHaveBeenCalledWith('user@example.com', '123456', 'mfa-session');
      expect(cognitoService.deleteUser).toHaveBeenCalledWith('accessToken');
    });

    it('should throw BadRequestException for SMS_MFA challenge', async () => {
      cognitoService.getUser.mockResolvedValue({
        UserAttributes: [
          { Name: 'email', Value: 'user@example.com' },
          { Name: 'sub', Value: 'cognito-sub-123' },
        ],
      });
      cognitoService.authenticateWithSrp.mockResolvedValue({
        AuthenticationResult: undefined,
        ChallengeName: 'SMS_MFA',
        Session: 'sms-session',
      } as never);
      await expect(
        service.deleteMe('accessToken', {
          password: 'password123',
          mfaCode: '123456',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(cognitoService.deleteUser).not.toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException when deleteUser returns falsy', async () => {
      cognitoService.getUser.mockResolvedValue({
        UserAttributes: [
          { Name: 'email', Value: 'user@example.com' },
          { Name: 'sub', Value: 'cognito-sub-123' },
        ],
      });
      cognitoService.authenticateWithSrp.mockResolvedValue({
        AuthenticationResult: {},
      } as never);
      cognitoService.deleteUser.mockResolvedValue(undefined as never);
      await expect(
        service.deleteMe('accessToken', { password: 'password123' }),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException when updateByCognitoSub returns falsy', async () => {
      cognitoService.getUser.mockResolvedValue({
        UserAttributes: [
          { Name: 'email', Value: 'user@example.com' },
          { Name: 'sub', Value: 'cognito-sub-123' },
        ],
      });
      cognitoService.authenticateWithSrp.mockResolvedValue({
        AuthenticationResult: {},
      } as never);
      cognitoService.deleteUser.mockResolvedValue({} as never);
      usersService.updateByCognitoSub.mockResolvedValue(null as never);
      await expect(
        service.deleteMe('accessToken', { password: 'password123' }),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should delete Google-only account after Google credential verification', async () => {
      usersService.findOneByCognitoSub.mockResolvedValue({
        cognitoSub: 'cognito-sub-123',
        hasPassword: false,
        linkedProviders: ['GOOGLE'],
        linkedProviderSubjects: { GOOGLE: 'google-sub-1' },
        deleted: false,
      } as UserDoc);
      cognitoService.getUser.mockResolvedValue({
        UserAttributes: [
          { Name: 'email', Value: 'user@example.com' },
          { Name: 'sub', Value: 'cognito-sub-123' },
        ],
      });
      googleService.verifyCredential.mockResolvedValue({
        email: 'user@example.com',
        sub: 'google-sub-1',
      } as never);
      cognitoService.deleteUser.mockResolvedValue({} as never);
      usersService.updateByCognitoSub.mockResolvedValue({} as never);
      const googleJwt = 'x'.repeat(40);
      await service.deleteMe('accessToken', { googleCredential: googleJwt });
      expect(googleService.verifyCredential).toHaveBeenCalledWith(googleJwt);
      expect(cognitoService.authenticateWithSrp).not.toHaveBeenCalled();
      expect(cognitoService.deleteUser).toHaveBeenCalledWith('accessToken');
    });

    it('should throw BadRequestException when Google-only user omits credential', async () => {
      usersService.findOneByCognitoSub.mockResolvedValue({
        cognitoSub: 'cognito-sub-123',
        hasPassword: false,
        linkedProviders: ['GOOGLE'],
        deleted: false,
      } as UserDoc);
      cognitoService.getUser.mockResolvedValue({
        UserAttributes: [
          { Name: 'email', Value: 'user@example.com' },
          { Name: 'sub', Value: 'cognito-sub-123' },
        ],
      });
      await expect(service.deleteMe('accessToken', {})).rejects.toThrow(
        BadRequestException,
      );
      expect(cognitoService.deleteUser).not.toHaveBeenCalled();
    });
  });

  describe('getKnownDevices', () => {
    it('should map Cognito devices to device list and call listDevices', async () => {
      cognitoService.listDevices.mockResolvedValue({
        Devices: [
          {
            DeviceKey: 'device-1',
            DeviceAttributes: [
              { Name: 'device_name', Value: 'Chrome' },
              { Name: 'last_ip_used', Value: '1.2.3.4' },
            ],
            DeviceCreateDate: new Date(),
            DeviceLastAuthenticatedDate: new Date(),
            DeviceLastModifiedDate: new Date(),
          },
        ],
      } as never);
      configService.get.mockReturnValue(undefined);
      const devices = await service.getKnownDevices('accessToken');
      expect(devices).toHaveLength(1);
      expect(devices[0]).toMatchObject({
        DeviceKey: 'device-1',
        DeviceName: 'Chrome',
        DeviceLastIPUsed: '1.2.3.4',
      });
      expect(cognitoService.listDevices).toHaveBeenCalledWith('accessToken');
    });

    it('should enrich devices with City, Region, Country when MAXMIND_KEY is set', async () => {
      cognitoService.listDevices.mockResolvedValue({
        Devices: [
          {
            DeviceKey: 'device-1',
            DeviceAttributes: [{ Name: 'last_ip_used', Value: '8.8.8.8' }],
          },
        ],
      } as never);
      configService.get.mockReturnValue('maxmind-key');
      maxmindService.getLocation.mockResolvedValue({
        city: { names: { en: 'Mountain View' } },
        subdivisions: [{ names: { en: 'California' } }],
        country: { names: { en: 'United States' } },
      } as never);
      const devices = await service.getKnownDevices('accessToken');
      expect(devices[0]).toMatchObject({
        DeviceKey: 'device-1',
        City: 'Mountain View',
        Region: 'California',
        Country: 'United States',
      });
      expect(maxmindService.getLocation).toHaveBeenCalledWith('8.8.8.8');
    });

    it('should still return device when getLocation throws', async () => {
      cognitoService.listDevices.mockResolvedValue({
        Devices: [
          {
            DeviceKey: 'device-1',
            DeviceAttributes: [{ Name: 'last_ip_used', Value: '1.2.3.4' }],
          },
        ],
      } as never);
      configService.get.mockReturnValue('key');
      maxmindService.getLocation.mockRejectedValue(new Error('Maxmind error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const devices = await service.getKnownDevices('accessToken');
      consoleSpy.mockRestore();
      expect(devices).toHaveLength(1);
      expect(devices[0].DeviceKey).toBe('device-1');
      expect(devices[0].City).toBeUndefined();
      expect(devices[0].Region).toBeUndefined();
      expect(devices[0].Country).toBeUndefined();
    });
  });
});
