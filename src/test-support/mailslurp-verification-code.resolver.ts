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
 * reads verification codes from MailSlurp only if the client omitted the code
 * (empty/whitespace). Otherwise returns the client value so e2e can read the
 * inbox once and Cognito invalid-code tests still send wrong values.
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
    if (codeFromClient.trim() !== '') {
      return codeFromClient;
    }

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
