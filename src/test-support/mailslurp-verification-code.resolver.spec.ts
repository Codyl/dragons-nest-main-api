import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { EnvironmentVariables } from 'src/env.config';

import { MailslurpVerificationCodeResolver } from './mailslurp-verification-code.resolver';
import * as mailslurpClient from './mailslurp.client';

jest.mock('./mailslurp.client', () => ({
  createMailslurpClient: jest.fn(),
  getVerificationCodeFromEmail: jest.fn(),
  emptyMailslurpInbox: jest.fn(),
}));

describe('MailslurpVerificationCodeResolver', () => {
  const createMailslurpClient = jest.mocked(
    mailslurpClient.createMailslurpClient,
  );
  const getVerificationCodeFromEmail = jest.mocked(
    mailslurpClient.getVerificationCodeFromEmail,
  );
  const emptyMailslurpInbox = jest.mocked(mailslurpClient.emptyMailslurpInbox);

  const mockClient = {} as mailslurpClient.MailslurpClientInstance;

  let resolver: MailslurpVerificationCodeResolver;
  let configService: ConfigService<EnvironmentVariables>;

  beforeEach(() => {
    jest.clearAllMocks();
    emptyMailslurpInbox.mockResolvedValue(undefined);

    configService = {
      get: jest.fn((key: string) => {
        if (key === 'MAILSLURP_API_KEY') return 'key';

        if (key === 'MAILSLURP_INBOX_ID') return 'inbox-1';

        return undefined;
      }),
    } as unknown as ConfigService<EnvironmentVariables>;

    createMailslurpClient.mockReturnValue(mockClient);
    resolver = new MailslurpVerificationCodeResolver(configService);
  });

  describe('client code passthrough', () => {
    it('returns non-empty client code without calling MailSlurp', async () => {
      await expect(resolver.resolve(' 999888 ', 'signup')).resolves.toBe(
        ' 999888 ',
      );
      expect(createMailslurpClient).not.toHaveBeenCalled();
    });
  });

  describe('signup flow', () => {
    it('uses MailSlurp code when present', async () => {
      getVerificationCodeFromEmail.mockResolvedValue('111111');

      await expect(resolver.resolve('', 'signup')).resolves.toBe('111111');
      expect(getVerificationCodeFromEmail).toHaveBeenCalledWith(
        mockClient,
        'inbox-1',
        10_000,
      );
      expect(emptyMailslurpInbox).toHaveBeenCalledWith(mockClient, 'inbox-1');
    });

    it('returns empty string when inbox has no match and client code empty', async () => {
      getVerificationCodeFromEmail.mockResolvedValue(null);

      await expect(resolver.resolve('', 'signup')).resolves.toBe('');
    });
  });

  describe('forgot_password flow', () => {
    it('uses MailSlurp code when client code empty', async () => {
      getVerificationCodeFromEmail.mockResolvedValue('222222');

      await expect(resolver.resolve('', 'forgot_password')).resolves.toBe(
        '222222',
      );
      expect(getVerificationCodeFromEmail).toHaveBeenCalledWith(
        mockClient,
        'inbox-1',
        undefined,
      );
    });

    it('throws when no code in email', async () => {
      getVerificationCodeFromEmail.mockResolvedValue(null);

      await expect(resolver.resolve('', 'forgot_password')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('edge cases', () => {
    it('throws when MailSlurp client cannot be created', async () => {
      createMailslurpClient.mockReturnValue(null);

      await expect(resolver.resolve('', 'signup')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('ignores emptyInbox failures', async () => {
      getVerificationCodeFromEmail.mockResolvedValue('333333');
      emptyMailslurpInbox.mockRejectedValue(new Error('network'));

      await expect(resolver.resolve('', 'signup')).resolves.toBe('333333');
    });
  });
});
