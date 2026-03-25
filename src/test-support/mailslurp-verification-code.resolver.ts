import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  type VerificationCodeResolver,
  type VerificationFlow,
} from 'src/auth/verification-code.resolver';
import { EnvironmentVariables } from 'src/env.config';

import {
  createMailslurpClient,
  emptyMailslurpInbox,
  getVerificationCodeFromEmail,
} from './mailslurp.client';

const CONFIRM_SIGNUP_TIMEOUT_MS = 10_000;

/**
 * When active (factory-gated: NODE_ENV + APP_ENV test + MailSlurp env),
 * always loads the verification code from the MailSlurp inbox so Cypress/UI can
 * submit placeholder digits while Cognito still receives the real emailed code.
 */
@Injectable()
export class MailslurpVerificationCodeResolver implements VerificationCodeResolver {
  constructor(
    private readonly configService: ConfigService<EnvironmentVariables>,
  ) {}

  async resolve(
    codeFromClient: string,
    flow: VerificationFlow,
  ): Promise<string> {
    void codeFromClient;

    const apiKey = this.configService.get('MAILSLURP_API_KEY', { infer: true });
    const inboxId = this.configService.get('MAILSLURP_INBOX_ID', {
      infer: true,
    });

    const client = createMailslurpClient(apiKey);
    if (!client || !inboxId) {
      throw new BadRequestException('MailSlurp is not configured for tests.');
    }

    const timeoutMs = flow === 'signup' ? CONFIRM_SIGNUP_TIMEOUT_MS : undefined;

    const mailCode = await getVerificationCodeFromEmail(
      client,
      inboxId,
      timeoutMs,
    );

    await emptyMailslurpInbox(client, inboxId).catch(() => {});

    if (flow === 'signup') {
      return mailCode ?? '';
    }

    if (!mailCode) {
      throw new BadRequestException('Cognito code not found in email body');
    }

    return mailCode;
  }
}
