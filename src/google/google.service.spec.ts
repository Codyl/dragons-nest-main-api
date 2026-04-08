import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';

import { User } from 'src/users/entities/user.schema';

import { GoogleService } from './google.service';

describe('GoogleService', () => {
  let service: GoogleService;
  const verifyIdTokenMock = jest.fn();
  const getPayloadMock = jest.fn();

  beforeEach(async () => {
    verifyIdTokenMock.mockReset();
    getPayloadMock.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleService,
        {
          provide: 'GOOGLE_OAUTH2_CLIENT',
          useValue: {
            verifyIdToken: verifyIdTokenMock,
          },
        },
        {
          provide: 'COGNITO_CLIENT',
          useValue: { send: jest.fn() },
        },
        {
          provide: getModelToken(User.name),
          useValue: {},
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
            getOrThrow: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<GoogleService>(GoogleService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('verifyCredential', () => {
    it('returns 429 when provider is rate limited', async () => {
      verifyIdTokenMock.mockRejectedValueOnce(
        new Error('429 quota exceeded on verifyIdToken'),
      );

      await expect(service.verifyCredential('cred')).rejects.toMatchObject({
        status: HttpStatus.TOO_MANY_REQUESTS,
      });
    });

    it('throws UnauthorizedException for non-quota verification errors', async () => {
      verifyIdTokenMock.mockRejectedValueOnce(new Error('invalid token'));

      await expect(service.verifyCredential('cred')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('returns email and sub when token payload is valid', async () => {
      getPayloadMock.mockReturnValue({
        email: 'user@example.com',
        sub: 'google-sub-123',
      });
      verifyIdTokenMock.mockResolvedValueOnce({
        getPayload: getPayloadMock,
      });

      await expect(service.verifyCredential('cred')).resolves.toEqual({
        email: 'user@example.com',
        sub: 'google-sub-123',
      });
    });
  });
});
