import { Test, TestingModule } from '@nestjs/testing';
import {
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  ForbiddenException,
} from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
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
import { AddManagedUserDto } from './dto/add-managed-user.dto';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import * as fc from 'fast-check';
import { AddTeachableSubjectDto } from './dto/add-teachable-subject.dto';
import { HomeschoolCurriculum } from 'src/users/enums/homeschool-curriculum.enum';
import { HomeschoolGrade } from 'src/users/enums/homeschool-grade.enum';
import { Subject } from 'src/subjects/subject.entity';

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
            createManagedUser: jest
              .fn()
              .mockResolvedValue({ _id: new Types.ObjectId() }),
          },
        },
        {
          provide: ConfigService,
          useValue: configServiceImpl,
        },
        {
          provide: getModelToken(Subject.name),
          useValue: { exists: jest.fn() },
        },
        {
          provide: getModelToken('User'),
          useValue: { findByIdAndUpdate: jest.fn() },
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
      linkedmanagedUserIds: [],
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
    const weeklyAvailability = (
      [
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
        'sunday',
      ] as const
    ).map((day) => ({
      day,
      slots: [{ start: '08:00', end: '21:00' }],
    }));

    const dto = {
      accountType: AccountType.ManagedUser,
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
      weeklyAvailability,
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
            availablity: weeklyAvailability,
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

// Feature: manage-teachable-subjects, Property 10: PATCH endpoint rejects invalid payloads
describe('Property 10: AddTeachableSubjectDto rejects invalid payloads', () => {
  // We test DTO validation directly using class-validator's validate() function,
  // which mirrors what NestJS ValidationPipe does before the service is called.
  // Invalid payloads must produce validation errors (HTTP 400 in the real endpoint).

  const validCurriculumValues = Object.values(HomeschoolCurriculum);
  const validGradeValues = Object.values(HomeschoolGrade);
  const validMongoId = '507f1f77bcf86cd799439011';

  /** Build a valid DTO plain object to use as a baseline. */
  function validBase() {
    return {
      className: 'Math 101',
      subjectId: validMongoId,
      matchesAllGrades: true,
      grades: [],
      curriculum: HomeschoolCurriculum.Saxon,
      maxManagedUsers: 10,
    };
  }

  async function expectInvalid(plain: Record<string, unknown>): Promise<void> {
    const dto = plainToInstance(AddTeachableSubjectDto, plain);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  }

  it('property: missing className produces validation errors', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          subjectId: fc.constant(validMongoId),
          matchesAllGrades: fc.boolean(),
          grades: fc.constant([]),
          curriculum: fc.constantFrom(...validCurriculumValues),
          maxManagedUsers: fc.integer({ min: 1, max: 20 }),
        }),
        async (partial) => {
          // className is intentionally omitted
          await expectInvalid(partial as Record<string, unknown>);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('property: missing subjectId produces validation errors', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          className: fc.string({ minLength: 1, maxLength: 256 }),
          matchesAllGrades: fc.boolean(),
          grades: fc.constant([]),
          curriculum: fc.constantFrom(...validCurriculumValues),
          maxManagedUsers: fc.integer({ min: 1, max: 20 }),
        }),
        async (partial) => {
          // subjectId is intentionally omitted
          await expectInvalid(partial as Record<string, unknown>);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('property: invalid curriculum enum value produces validation errors', async () => {
    // Generate strings that are NOT valid HomeschoolCurriculum values
    const invalidCurriculumArb = fc
      .string({ minLength: 1, maxLength: 50 })
      .filter((s) => !(validCurriculumValues as string[]).includes(s));

    await fc.assert(
      fc.asyncProperty(invalidCurriculumArb, async (badCurriculum) => {
        const plain = { ...validBase(), curriculum: badCurriculum };
        await expectInvalid(plain);
      }),
      { numRuns: 100 },
    );
  });

  it('property: maxManagedUsers = 0 produces validation errors', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(0), async (maxManagedUsers) => {
        const plain = { ...validBase(), maxManagedUsers };
        await expectInvalid(plain);
      }),
      { numRuns: 100 },
    );
  });

  it('property: maxManagedUsers negative produces validation errors', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: -10000, max: -1 }),
        async (maxManagedUsers) => {
          const plain = { ...validBase(), maxManagedUsers };
          await expectInvalid(plain);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('property: maxManagedUsers > 20 produces validation errors', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 21, max: 10000 }),
        async (maxManagedUsers) => {
          const plain = { ...validBase(), maxManagedUsers };
          await expectInvalid(plain);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('property: missing matchesAllGrades produces validation errors', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          className: fc.string({ minLength: 1, maxLength: 256 }),
          subjectId: fc.constant(validMongoId),
          grades: fc.constant([]),
          curriculum: fc.constantFrom(...validCurriculumValues),
          maxManagedUsers: fc.integer({ min: 1, max: 20 }),
        }),
        async (partial) => {
          // matchesAllGrades is intentionally omitted
          await expectInvalid(partial as Record<string, unknown>);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('property: empty className (length 0) produces validation errors', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(''), async (emptyName) => {
        const plain = { ...validBase(), className: emptyName };
        await expectInvalid(plain);
      }),
      { numRuns: 100 },
    );
  });

  it('property: non-boolean matchesAllGrades produces validation errors', async () => {
    const nonBooleanArb = fc.oneof(
      fc.integer(),
      fc.string(),
      fc.constant(null),
    );

    await fc.assert(
      fc.asyncProperty(nonBooleanArb, async (badValue) => {
        const plain = { ...validBase(), matchesAllGrades: badValue };
        await expectInvalid(plain);
      }),
      { numRuns: 100 },
    );
  });

  it('property: grades non-empty when matchesAllGrades=true produces validation errors', async () => {
    // When matchesAllGrades is true, grades must be empty per TeachableCourseGradesConstraint
    const nonEmptyGradesArb = fc.array(fc.constantFrom(...validGradeValues), {
      minLength: 1,
      maxLength: 5,
    });

    await fc.assert(
      fc.asyncProperty(nonEmptyGradesArb, async (grades) => {
        const plain = { ...validBase(), matchesAllGrades: true, grades };
        await expectInvalid(plain);
      }),
      { numRuns: 100 },
    );
  });

  it('property: grades empty when matchesAllGrades=false produces validation errors', async () => {
    // When matchesAllGrades is false, grades must have at least one entry
    await fc.assert(
      fc.asyncProperty(fc.constant([]), async (grades) => {
        const plain = { ...validBase(), matchesAllGrades: false, grades };
        await expectInvalid(plain);
      }),
      { numRuns: 100 },
    );
  });
});

// Feature: manage-teachable-subjects, Property 9: PATCH endpoint appends course (round-trip)
// Validates: Requirements 7.1, 7.8
describe('Property 9: PATCH endpoint appends course (round-trip)', () => {
  const validCurriculumValues = Object.values(HomeschoolCurriculum);
  const validGradeValues = Object.values(HomeschoolGrade);
  const validMongoId = '507f1f77bcf86cd799439011';

  /** Arbitrary for a valid AddTeachableSubjectDto plain object. */
  function arbitraryAddTeachableCourseDto() {
    return fc.boolean().chain((matchesAllGrades) => {
      const gradesArb = matchesAllGrades
        ? fc.constant([] as string[])
        : fc.array(fc.constantFrom(...validGradeValues), { minLength: 1 });

      return fc.record({
        className: fc.string({ minLength: 1, maxLength: 256 }),
        subjectId: fc.constant(validMongoId),
        matchesAllGrades: fc.constant(matchesAllGrades),
        grades: gradesArb,
        curriculum: fc.constantFrom(...validCurriculumValues),
        maxManagedUsers: fc.integer({ min: 1, max: 20 }),
      });
    });
  }

  /** Arbitrary for a single existing teachable course (as stored in the DB). */
  function arbitraryExistingCourse() {
    return fc.boolean().chain((matchesAllGrades) => {
      const gradesArb = matchesAllGrades
        ? fc.constant([] as string[])
        : fc.array(fc.constantFrom(...validGradeValues), { minLength: 1 });

      return fc.record({
        className: fc.string({ minLength: 1, maxLength: 256 }),
        subjectId: fc.constant(new Types.ObjectId(validMongoId)),
        matchesAllGrades: fc.constant(matchesAllGrades),
        grades: gradesArb,
        curriculum: fc.constantFrom(...validCurriculumValues),
        maxManagedUsers: fc.integer({ min: 1, max: 20 }),
        activeEnrollmentCount: fc.constant(0),
      });
    });
  }

  it('property: returned array length = original length + 1 and last element matches DTO fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryAddTeachableCourseDto(),
        fc.array(arbitraryExistingCourse(), { minLength: 0, maxLength: 5 }),
        async (dto, existingCourses) => {
          // Build the NestJS testing module fresh for each run
          const configGet = jest.fn();
          const module = await Test.createTestingModule({
            providers: [
              ProfileService,
              {
                provide: CognitoService,
                useValue: {
                  getUser: jest.fn(),
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
                useValue: { getLocation: jest.fn() },
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
                  createManagedUser: jest
                    .fn()
                    .mockResolvedValue({ _id: new Types.ObjectId() }),
                },
              },
              {
                provide: ConfigService,
                useValue: {
                  get: configGet,
                  getOrThrow: jest.fn((key: string) => {
                    const v = configGet(key);
                    if (v !== undefined && v !== null) return v;

                    if (key === MAXMIND_KEY) return '';

                    throw new Error(`Missing configuration key: ${key}`);
                  }),
                },
              },
              {
                provide: getModelToken(Subject.name),
                useValue: { exists: jest.fn() },
              },
              {
                provide: getModelToken('User'),
                useValue: { findByIdAndUpdate: jest.fn() },
              },
            ],
          }).compile();

          const svc =
            module.get<InstanceType<typeof ProfileService>>(ProfileService);
          const users = module.get<jest.Mocked<UsersService>>(UsersService);

          const cognitoSub = 'test-sub';

          // The user returned by findOneByCognitoSub is an adult with existing courses
          const userDoc = {
            _id: new Types.ObjectId(),
            cognitoSub,
            accountType: AccountType.Adult,
            ageBandAtRegistration: AgeBandAtRegistration.Adult18Plus,
            deleted: false,
            teachableCourses: existingCourses,
          };
          users.findOneByCognitoSub.mockResolvedValue(userDoc as never);

          // The new course that will be appended (mirrors what the service builds)
          const newCourse = {
            className: dto.className.trim(),
            subjectId: new Types.ObjectId(dto.subjectId),
            matchesAllGrades: dto.matchesAllGrades,
            grades: dto.matchesAllGrades ? [] : [...dto.grades],
            curriculum: dto.curriculum,
            maxManagedUsers: dto.maxManagedUsers,
            activeEnrollmentCount: 0,
          };

          // updateByCognitoSub returns the user with the new course appended
          const updatedCourses = [...existingCourses, newCourse];
          users.updateByCognitoSub.mockResolvedValue({
            ...userDoc,
            teachableCourses: updatedCourses,
          } as never);

          const result = await svc.addTeachableSubject(cognitoSub, dto as never);

          // Assert: returned array length = original length + 1
          expect(result).toHaveLength(existingCourses.length + 1);

          // Assert: last element matches the DTO input fields
          const last = result[result.length - 1];
          expect(last.className).toBe(dto.className.trim());
          expect(last.subjectId).toBe(validMongoId);
          expect(last.matchesAllGrades).toBe(dto.matchesAllGrades);
          expect(last.curriculum).toBe(dto.curriculum);
          expect(last.maxManagedUsers).toBe(dto.maxManagedUsers);
          if (dto.matchesAllGrades) {
            expect(last.grades).toEqual([]);
          } else {
            expect(last.grades).toEqual(dto.grades);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: manage-teachable-subjects, Property 11: DELETE endpoint removes course at index (round-trip)
// Validates: Requirements 7.4, 7.8
describe('Property 11: DELETE endpoint removes course at index (round-trip)', () => {
  const validCurriculumValues = Object.values(HomeschoolCurriculum);
  const validGradeValues = Object.values(HomeschoolGrade);
  const validMongoId = '507f1f77bcf86cd799439011';

  function arbitraryStoredCourse() {
    return fc.boolean().chain((matchesAllGrades) => {
      const gradesArb = matchesAllGrades
        ? fc.constant([] as string[])
        : fc.array(fc.constantFrom(...validGradeValues), { minLength: 1 });

      return fc.record({
        _id: fc.constant(new Types.ObjectId()),
        className: fc.string({ minLength: 1, maxLength: 256 }),
        subjectId: fc.constant(new Types.ObjectId(validMongoId)),
        matchesAllGrades: fc.constant(matchesAllGrades),
        grades: gradesArb,
        curriculum: fc.constantFrom(...validCurriculumValues),
        maxManagedUsers: fc.integer({ min: 1, max: 20 }),
      });
    });
  }

  async function buildModule() {
    const configGet = jest.fn();
    const module = await Test.createTestingModule({
      providers: [
        ProfileService,
        {
          provide: CognitoService,
          useValue: {
            getUser: jest.fn(),
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
        { provide: MaxmindService, useValue: { getLocation: jest.fn() } },
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
            createManagedUser: jest
              .fn()
              .mockResolvedValue({ _id: new Types.ObjectId() }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: configGet,
            getOrThrow: jest.fn((key: string) => {
              const v = configGet(key);
              if (v !== undefined && v !== null) return v;

              if (key === MAXMIND_KEY) return '';

              throw new Error(`Missing configuration key: ${key}`);
            }),
          },
        },
        {
          provide: getModelToken(Subject.name),
          useValue: { exists: jest.fn() },
        },
        {
          provide: getModelToken('User'),
          useValue: { findByIdAndUpdate: jest.fn() },
        },
      ],
    }).compile();

    return {
      svc: module.get<InstanceType<typeof ProfileService>>(ProfileService),
      users: module.get<jest.Mocked<UsersService>>(UsersService),
    };
  }

  it('property: returned array length = original − 1 and removed course is absent', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc
          .array(arbitraryStoredCourse(), { minLength: 1, maxLength: 10 })
          .chain((courses) =>
            fc.record({
              courses: fc.constant(courses),
              index: fc.integer({ min: 0, max: courses.length - 1 }),
            }),
          ),
        async ({ courses, index }) => {
          const { svc, users } = await buildModule();
          const cognitoSub = 'test-sub';
          const userId = new Types.ObjectId();

          const userDoc = {
            _id: userId,
            cognitoSub,
            accountType: AccountType.Adult,
            ageBandAtRegistration: AgeBandAtRegistration.Adult18Plus,
            deleted: false,
            teachableCourses: courses,
            linkedManagedUsers: [],
            notificationEvents: [],
          };
          users.findOneByCognitoSub.mockResolvedValue(userDoc as never);

          // The updated courses array after removal
          const remainingCourses = courses.filter((_, i) => i !== index);
          users.updateByCognitoSub.mockResolvedValue({
            ...userDoc,
            teachableCourses: remainingCourses,
          } as never);

          const result = await svc.removeTeachableSubject(cognitoSub, index);

          // Assert: returned array length = original − 1
          expect(result).toHaveLength(courses.length - 1);

          // Assert: the course originally at `index` is absent from the result
          const removedSubjectId = courses[index].subjectId.toString();
          const removedClassName = courses[index].className;
          // Check that the exact combination is not present (unless duplicates existed)
          const removedCount = courses.filter(
            (c, i) =>
              i !== index &&
              c.subjectId.toString() === removedSubjectId &&
              c.className === removedClassName,
          ).length;
          const resultCount = result.filter(
            (c) =>
              c.subjectId === removedSubjectId &&
              c.className === removedClassName,
          ).length;
          expect(resultCount).toBe(removedCount);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: manage-teachable-subjects, Property 12: DELETE endpoint rejects invalid indices
// Validates: Requirements 7.5
describe('Property 12: DELETE endpoint rejects invalid indices', () => {
  const validCurriculumValues = Object.values(HomeschoolCurriculum);
  const validGradeValues = Object.values(HomeschoolGrade);
  const validMongoId = '507f1f77bcf86cd799439011';

  function arbitraryStoredCourse() {
    return fc.boolean().chain((matchesAllGrades) => {
      const gradesArb = matchesAllGrades
        ? fc.constant([] as string[])
        : fc.array(fc.constantFrom(...validGradeValues), { minLength: 1 });

      return fc.record({
        _id: fc.constant(new Types.ObjectId()),
        className: fc.string({ minLength: 1, maxLength: 256 }),
        subjectId: fc.constant(new Types.ObjectId(validMongoId)),
        matchesAllGrades: fc.constant(matchesAllGrades),
        grades: gradesArb,
        curriculum: fc.constantFrom(...validCurriculumValues),
        maxManagedUsers: fc.integer({ min: 1, max: 20 }),
      });
    });
  }

  async function buildModule() {
    const configGet = jest.fn();
    const module = await Test.createTestingModule({
      providers: [
        ProfileService,
        {
          provide: CognitoService,
          useValue: {
            getUser: jest.fn(),
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
        { provide: MaxmindService, useValue: { getLocation: jest.fn() } },
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
            createManagedUser: jest
              .fn()
              .mockResolvedValue({ _id: new Types.ObjectId() }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: configGet,
            getOrThrow: jest.fn((key: string) => {
              const v = configGet(key);
              if (v !== undefined && v !== null) return v;

              if (key === MAXMIND_KEY) return '';

              throw new Error(`Missing configuration key: ${key}`);
            }),
          },
        },
        {
          provide: getModelToken(Subject.name),
          useValue: { exists: jest.fn() },
        },
        {
          provide: getModelToken('User'),
          useValue: { findByIdAndUpdate: jest.fn() },
        },
      ],
    }).compile();

    return {
      svc: module.get<InstanceType<typeof ProfileService>>(ProfileService),
      users: module.get<jest.Mocked<UsersService>>(UsersService),
    };
  }

  it('property: negative integers throw BadRequestException', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ max: -1 }),
        fc.array(arbitraryStoredCourse(), { minLength: 0, maxLength: 5 }),
        async (negativeIndex, courses) => {
          const { svc, users } = await buildModule();
          const cognitoSub = 'test-sub';

          users.findOneByCognitoSub.mockResolvedValue({
            _id: new Types.ObjectId(),
            cognitoSub,
            accountType: AccountType.Adult,
            ageBandAtRegistration: AgeBandAtRegistration.Adult18Plus,
            deleted: false,
            teachableCourses: courses,
            linkedManagedUsers: [],
          } as never);

          await expect(
            svc.removeTeachableSubject(cognitoSub, negativeIndex),
          ).rejects.toThrow(BadRequestException);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('property: non-integer numbers throw BadRequestException', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc
          .float({
            min: Math.fround(0.001),
            max: Math.fround(1000),
            noNaN: true,
          })
          .filter((n) => !Number.isInteger(n)),
        fc.array(arbitraryStoredCourse(), { minLength: 1, maxLength: 5 }),
        async (nonIntIndex, courses) => {
          const { svc, users } = await buildModule();
          const cognitoSub = 'test-sub';

          users.findOneByCognitoSub.mockResolvedValue({
            _id: new Types.ObjectId(),
            cognitoSub,
            accountType: AccountType.Adult,
            ageBandAtRegistration: AgeBandAtRegistration.Adult18Plus,
            deleted: false,
            teachableCourses: courses,
            linkedManagedUsers: [],
          } as never);

          await expect(
            svc.removeTeachableSubject(cognitoSub, nonIntIndex),
          ).rejects.toThrow(BadRequestException);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('property: index >= array length throws BadRequestException', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc
          .array(arbitraryStoredCourse(), { minLength: 0, maxLength: 5 })
          .chain((courses) =>
            fc.record({
              courses: fc.constant(courses),
              // index is >= courses.length (out of range)
              index: fc.integer({
                min: courses.length,
                max: courses.length + 100,
              }),
            }),
          ),
        async ({ courses, index }) => {
          const { svc, users } = await buildModule();
          const cognitoSub = 'test-sub';

          users.findOneByCognitoSub.mockResolvedValue({
            _id: new Types.ObjectId(),
            cognitoSub,
            accountType: AccountType.Adult,
            ageBandAtRegistration: AgeBandAtRegistration.Adult18Plus,
            deleted: false,
            teachableCourses: courses,
            linkedManagedUsers: [],
          } as never);

          await expect(
            svc.removeTeachableSubject(cognitoSub, index),
          ).rejects.toThrow(BadRequestException);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: manage-teachable-subjects, Property 13: DELETE with active enrollments produces notification events
// Validates: Requirements 7.7
describe('Property 13: DELETE with active enrollments produces notification events', () => {
  const validCurriculumValues = Object.values(HomeschoolCurriculum);
  const validMongoId = '507f1f77bcf86cd799439011';

  async function buildModule() {
    const configGet = jest.fn();
    const module = await Test.createTestingModule({
      providers: [
        ProfileService,
        {
          provide: CognitoService,
          useValue: {
            getUser: jest.fn(),
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
        { provide: MaxmindService, useValue: { getLocation: jest.fn() } },
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
            createManagedUser: jest
              .fn()
              .mockResolvedValue({ _id: new Types.ObjectId() }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: configGet,
            getOrThrow: jest.fn((key: string) => {
              const v = configGet(key);
              if (v !== undefined && v !== null) return v;

              if (key === MAXMIND_KEY) return '';

              throw new Error(`Missing configuration key: ${key}`);
            }),
          },
        },
        {
          provide: getModelToken(Subject.name),
          useValue: { exists: jest.fn() },
        },
        {
          provide: getModelToken('User'),
          useValue: { findByIdAndUpdate: jest.fn() },
        },
      ],
    }).compile();

    return {
      svc: module.get<InstanceType<typeof ProfileService>>(ProfileService),
      users: module.get<jest.Mocked<UsersService>>(UsersService),
    };
  }

  it('property: notificationEvents array length equals enrollment count M after DELETE', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 20 }),
        async (enrollmentCount) => {
          const { svc, users } = await buildModule();
          const cognitoSub = 'test-sub';
          const userId = new Types.ObjectId();
          const courseId = new Types.ObjectId();

          // The course being removed (at index 0)
          const courseToRemove = {
            _id: courseId,
            className: 'Test Class',
            subjectId: new Types.ObjectId(validMongoId),
            matchesAllGrades: true,
            grades: [],
            curriculum: validCurriculumValues[0],
            maxManagedUsers: 5,
          };

          // Build M linked managedusers, each with an addedClasses entry referencing
          // the adult user and the course being removed
          const linkedmanagedUserIds: (typeof Types.ObjectId)[] = [];
          const manageduserDocs: Record<string, unknown>[] = [];

          for (let i = 0; i < enrollmentCount; i++) {
            const managedUserId = new Types.ObjectId();
            const parentId = new Types.ObjectId();
            linkedmanagedUserIds.push(managedUserId as never);
            manageduserDocs.push({
              _id: managedUserId,
              parentId,
              deleted: false,
              addedClasses: [
                {
                  adult: userId,
                  course: courseId,
                  hoursCompleted: 0,
                },
              ],
            });
          }

          const userDoc = {
            _id: userId,
            cognitoSub,
            accountType: AccountType.Adult,
            ageBandAtRegistration: AgeBandAtRegistration.Adult18Plus,
            deleted: false,
            teachableCourses: [courseToRemove],
            linkedManagedUsers: linkedmanagedUserIds,
            notificationEvents: [],
          };

          users.findOneByCognitoSub.mockResolvedValue(userDoc as never);

          // findOneById returns each manageduser in order
          let callCount = 0;
          users.findOneById.mockImplementation((() => {
            const doc = manageduserDocs[callCount++];
            return Promise.resolve(doc) as never;
          }) as never);

          // Capture what updateByCognitoSub is called with
          let capturedUpdate: Record<string, unknown> | null = null;
          users.updateByCognitoSub.mockImplementation(((
            _sub: string,
            update: Record<string, unknown>,
          ) => {
            capturedUpdate = update;
            return Promise.resolve({
              ...userDoc,
              teachableCourses: [],
              notificationEvents:
                ((update as { $set: Record<string, unknown> }).$set[
                  'notificationEvents'
                ] as unknown[]) ?? [],
            }) as never;
          }) as never);

          await svc.removeTeachableSubject(cognitoSub, 0);

          // Assert: notificationEvents in the update equals M
          expect(capturedUpdate).not.toBeNull();
          const setPayload = (
            capturedUpdate! as { $set: Record<string, unknown> }
          ).$set;
          const events = setPayload['notificationEvents'] as unknown[];
          expect(events).toHaveLength(enrollmentCount);

          // Assert: each event has type COURSE_REMOVED
          for (const event of events) {
            expect((event as { type: string }).type).toBe('COURSE_REMOVED');
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: manage-teachable-subjects, Property 14: GET /profile includes activeEnrollmentCount for every course
// Validates: Requirements 8.2
describe('Property 14: GET /profile includes activeEnrollmentCount for every course', () => {
  const validCurriculumValues = Object.values(HomeschoolCurriculum);
  const validGradeValues = Object.values(HomeschoolGrade);
  const validMongoId = '507f1f77bcf86cd799439011';

  function arbitraryStoredCourse() {
    return fc.boolean().chain((matchesAllGrades) => {
      const gradesArb = matchesAllGrades
        ? fc.constant([] as string[])
        : fc.array(fc.constantFrom(...validGradeValues), { minLength: 1 });

      return fc.record({
        _id: fc.constant(new Types.ObjectId()),
        className: fc.string({ minLength: 1, maxLength: 64 }),
        subjectId: fc.constant(new Types.ObjectId(validMongoId)),
        matchesAllGrades: fc.constant(matchesAllGrades),
        grades: gradesArb,
        curriculum: fc.constantFrom(...validCurriculumValues),
        maxManagedUsers: fc.integer({ min: 1, max: 20 }),
      });
    });
  }

  async function buildModule() {
    const configGet = jest.fn();
    const module = await Test.createTestingModule({
      providers: [
        ProfileService,
        {
          provide: CognitoService,
          useValue: {
            getUser: jest.fn(),
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
        { provide: MaxmindService, useValue: { getLocation: jest.fn() } },
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
            createManagedUser: jest
              .fn()
              .mockResolvedValue({ _id: new Types.ObjectId() }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: configGet,
            getOrThrow: jest.fn((key: string) => {
              const v = configGet(key);
              if (v !== undefined && v !== null) return v;

              if (key === MAXMIND_KEY) return '';

              throw new Error(`Missing configuration key: ${key}`);
            }),
          },
        },
        {
          provide: getModelToken(Subject.name),
          useValue: { exists: jest.fn() },
        },
        {
          provide: getModelToken('User'),
          useValue: { findByIdAndUpdate: jest.fn() },
        },
      ],
    }).compile();

    return {
      svc: module.get<InstanceType<typeof ProfileService>>(ProfileService),
      users: module.get<jest.Mocked<UsersService>>(UsersService),
      cognito: module.get<jest.Mocked<CognitoService>>(CognitoService),
    };
  }

  it('property: response.teachableCourses[i].activeEnrollmentCount equals actual matching addedClasses count for each i', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate 0–5 courses
        fc.array(arbitraryStoredCourse(), { minLength: 0, maxLength: 5 }),
        // Generate 0–5 linked managedusers
        fc.array(
          fc.record({
            // Each manageduser has 0–3 addedClasses entries per course
            enrollmentCounts: fc.array(fc.integer({ min: 0, max: 3 }), {
              minLength: 0,
              maxLength: 5,
            }),
          }),
          { minLength: 0, maxLength: 5 },
        ),
        async (courses, manageduserEnrollmentSpecs) => {
          const { svc, users, cognito } = await buildModule();
          const cognitoSub = 'adult-sub';
          const userId = new Types.ObjectId();

          // Build linked manageduser docs with addedClasses referencing the adult + courses
          const linkedmanagedUserIds: (typeof Types.ObjectId)[] = [];
          const manageduserDocs: Record<string, unknown>[] = [];

          // Compute expected counts per course index
          const expectedCounts = new Array<number>(courses.length).fill(0);

          for (const spec of manageduserEnrollmentSpecs) {
            const managedUserId = new Types.ObjectId();
            linkedmanagedUserIds.push(managedUserId as never);

            const addedClasses: {
              adult: typeof Types.ObjectId;
              course: typeof Types.ObjectId;
              hoursCompleted: number;
            }[] = [];

            // For each course, add spec.enrollmentCounts[i] entries (capped to 1 per manageduser per course
            // since we're counting managedusers, not entries — but the spec says "count of linked managedusers
            // whose addedClasses contain an entry", so one entry per manageduser per course is sufficient)
            for (let i = 0; i < courses.length; i++) {
              const count = spec.enrollmentCounts[i] ?? 0;
              if (count > 0 && courses[i]._id) {
                // Add one enrollment entry for this manageduser+course combination
                addedClasses.push({
                  adult: userId as never,
                  course: courses[i]._id as never,
                  hoursCompleted: 0,
                });
                expectedCounts[i]++;
              }
            }

            manageduserDocs.push({
              _id: managedUserId,
              deleted: false,
              addedClasses,
            });
          }

          const userDoc = {
            _id: userId,
            cognitoSub,
            accountType: AccountType.Adult,
            ageBandAtRegistration: AgeBandAtRegistration.Adult18Plus,
            deleted: false,
            teachableCourses: courses,
            linkedManagedUsers: linkedmanagedUserIds,
            managedAccountsView: [],
          };

          // Mock Cognito getUser
          cognito.getUser.mockResolvedValue({
            UserAttributes: [
              { Name: 'sub', Value: cognitoSub },
              { Name: 'email', Value: 'adult@example.com' },
            ],
          } as never);

          users.findOneByCognitoSub.mockResolvedValue(userDoc as never);

          // findOneById returns each manageduser in order
          let callIdx = 0;
          users.findOneById.mockImplementation((() => {
            const doc = manageduserDocs[callIdx++];
            return Promise.resolve(doc ?? null) as never;
          }) as never);

          const result = await svc.getMe('access-token', { sub: cognitoSub });

          // Assert: teachableCourses is present in the response
          expect(result.teachableCourses).toBeDefined();
          expect(Array.isArray(result.teachableCourses)).toBe(true);

          const resultCourses = result.teachableCourses as Array<{
            activeEnrollmentCount: number;
          }>;

          // Assert: length matches
          expect(resultCourses).toHaveLength(courses.length);

          // Assert: each course's activeEnrollmentCount matches expected
          for (let i = 0; i < courses.length; i++) {
            expect(resultCourses[i].activeEnrollmentCount).toBe(
              expectedCounts[i],
            );
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('ProfileService household manageduser drafts', () => {
  let service: ProfileService;
  let usersService: jest.Mocked<UsersService>;
  let cognitoService: jest.Mocked<CognitoService>;
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
        { provide: MaxmindService, useValue: { getLocation: jest.fn() } },
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
            createManagedUser: jest
              .fn()
              .mockResolvedValue({ _id: new Types.ObjectId() }),
          },
        },
        {
          provide: ConfigService,
          useValue: configServiceImpl,
        },
        {
          provide: getModelToken(Subject.name),
          useValue: { exists: jest.fn() },
        },
        {
          provide: getModelToken('User'),
          useValue: { findByIdAndUpdate: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<ProfileService>(ProfileService);
    usersService = module.get<jest.Mocked<UsersService>>(UsersService);
    cognitoService = module.get<jest.Mocked<CognitoService>>(CognitoService);
  });

  it('getMe returns managedUsers active-only and managedAccountsViewAll for adults', async () => {
    const cognitoSub = 'sub-adult';
    const activemanagedUserId = new Types.ObjectId();
    const archivedmanagedUserId = new Types.ObjectId();
    cognitoService.getUser.mockResolvedValue({
      UserAttributes: [
        { Name: 'email', Value: 'a@ex.com' },
        { Name: 'sub', Value: cognitoSub },
      ],
    });
    const archivedDate = new Date('2024-01-02T00:00:00.000Z');
    usersService.findOneByCognitoSub.mockResolvedValue({
      _id: new Types.ObjectId(),
      cognitoSub,
      accountType: AccountType.Adult,
      ageBandAtRegistration: AgeBandAtRegistration.Adult18Plus,
      deleted: false,
      managedAccountsView: [
        {
          managedUserId: activemanagedUserId,
          displayName: 'Active',
          currentGrade: 3,
          lastPromotionYear: 2025,
        },
        {
          managedUserId: archivedmanagedUserId,
          displayName: 'Old',
          currentGrade: 5,
          lastPromotionYear: 2024,
          archivedAt: archivedDate,
        },
      ],
    } as UserDoc);

    const profile = await service.getMe('tok', { sub: cognitoSub });

    expect(profile.managedUsers).toHaveLength(1);
    expect(profile.managedUsers![0].managedUserId).toEqual(activemanagedUserId);
    expect(profile.managedAccountsViewAll).toHaveLength(2);
    expect(profile.managedAccountsViewAll![1].archivedAt).toBe(
      archivedDate.toISOString(),
    );
  });

  it('addManagedUser forbids non-adult', async () => {
    usersService.findOneByCognitoSub.mockResolvedValue({
      _id: new Types.ObjectId(),
      cognitoSub: 's',
      accountType: AccountType.ManagedUser,
      deleted: false,
    } as UserDoc);

    await expect(
      service.addManagedUser('s', {
        displayName: 'X',
        currentGrade: 1,
      } as AddManagedUserDto),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('addManagedUser appends and returns mapped drafts', async () => {
    const cognitoSub = 'adult';
    usersService.findOneByCognitoSub.mockResolvedValue({
      _id: new Types.ObjectId(),
      cognitoSub,
      accountType: AccountType.Adult,
      ageBandAtRegistration: AgeBandAtRegistration.Adult18Plus,
      deleted: false,
      managedAccountsView: [],
    } as never);

    usersService.updateByCognitoSub.mockResolvedValue({
      cognitoSub,
      managedAccountsView: [
        {
          managedUserId: '00000000-0000-4000-8000-000000000001',
          displayName: 'Sam',
          currentGrade: 2,
          lastPromotionYear: new Date().getFullYear(),
          archivedAt: null,
        },
      ],
    } as never);

    const rows = await service.addManagedUser(cognitoSub, {
      displayName: 'Sam',
      currentGrade: 2,
    } as AddManagedUserDto);

    expect(rows).toHaveLength(1);
    expect(rows[0].displayName).toBe('Sam');
    expect(rows[0].archivedAt).toBeNull();
    expect(usersService.updateByCognitoSub).toHaveBeenCalledWith(
      cognitoSub,
      expect.objectContaining({
        $push: {
          managedAccountsView: expect.objectContaining({
            displayName: 'Sam',
            currentGrade: 2,
          }),
        },
      }),
    );
  });

  it('archiveManagedUser sets archivedAt', async () => {
    const cognitoSub = 'adult';
    const managedUserId = new Types.ObjectId();
    usersService.findOneByCognitoSub.mockResolvedValue({
      _id: new Types.ObjectId(),
      cognitoSub,
      accountType: AccountType.Adult,
      ageBandAtRegistration: AgeBandAtRegistration.Adult18Plus,
      deleted: false,
      managedAccountsView: [
        {
          managedUserId,
          displayName: 'Sam',
          currentGrade: 2,
          lastPromotionYear: 2025,
        },
      ],
    } as UserDoc);

    usersService.updateByCognitoSub.mockResolvedValue({
      cognitoSub,
      managedAccountsView: [
        {
          managedUserId,
          displayName: 'Sam',
          currentGrade: 2,
          lastPromotionYear: 2025,
          archivedAt: new Date('2025-06-01T00:00:00.000Z'),
        },
      ],
    } as never);

    const rows = await service.archiveManagedUser(cognitoSub, managedUserId);
    expect(rows[0].archivedAt).not.toBeNull();
  });

  it('restoreManagedUser clears archivedAt', async () => {
    const cognitoSub = 'adult';
    const managedUserId = new Types.ObjectId();
    usersService.findOneByCognitoSub.mockResolvedValue({
      _id: new Types.ObjectId(),
      cognitoSub,
      accountType: AccountType.Adult,
      ageBandAtRegistration: AgeBandAtRegistration.Adult18Plus,
      deleted: false,
      managedAccountsView: [
        {
          managedUserId,
          displayName: 'Sam',
          currentGrade: 2,
          lastPromotionYear: 2025,
          archivedAt: new Date(),
        },
      ],
    } as UserDoc);

    usersService.updateByCognitoSub.mockResolvedValue({
      cognitoSub,
      managedAccountsView: [
        {
          managedUserId,
          displayName: 'Sam',
          currentGrade: 2,
          lastPromotionYear: 2025,
          archivedAt: null,
        },
      ],
    } as never);

    const rows = await service.restoreManagedUser(cognitoSub, managedUserId);
    expect(rows[0].archivedAt).toBeNull();
  });
});
