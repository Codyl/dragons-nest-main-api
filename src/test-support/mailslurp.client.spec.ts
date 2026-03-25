import MailSlurp from 'mailslurp-client';

import {
  createMailslurpClient,
  emptyMailslurpInbox,
  getVerificationCodeFromEmail,
} from './mailslurp.client';

describe('mailslurp.client', () => {
  describe('createMailslurpClient', () => {
    it('returns null when api key is missing', () => {
      expect(createMailslurpClient(undefined)).toBeNull();
      expect(createMailslurpClient('')).toBeNull();
    });

    it('returns client when api key is set', () => {
      const client = createMailslurpClient('test-api-key');
      expect(client).toBeInstanceOf(MailSlurp);
    });
  });

  describe('getVerificationCodeFromEmail', () => {
    it('extracts 6-digit code from body', async () => {
      const client = {
        waitForLatestEmail: jest.fn().mockResolvedValue({
          body: 'Your code is 482910 today.',
        }),
      } as unknown as InstanceType<typeof MailSlurp>;

      await expect(
        getVerificationCodeFromEmail(client, 'inbox', 1000),
      ).resolves.toBe('482910');
    });

    it('returns null when body has no 6-digit code', async () => {
      const client = {
        waitForLatestEmail: jest.fn().mockResolvedValue({
          body: 'no code here',
        }),
      } as unknown as InstanceType<typeof MailSlurp>;

      await expect(
        getVerificationCodeFromEmail(client, 'inbox', 1000),
      ).resolves.toBeNull();
    });
  });

  describe('emptyMailslurpInbox', () => {
    it('delegates to client.emptyInbox', async () => {
      const emptyInbox = jest.fn().mockResolvedValue(undefined);
      const client = { emptyInbox } as unknown as InstanceType<
        typeof MailSlurp
      >;

      await emptyMailslurpInbox(client, 'inbox-id');
      expect(emptyInbox).toHaveBeenCalledWith('inbox-id');
    });
  });
});
