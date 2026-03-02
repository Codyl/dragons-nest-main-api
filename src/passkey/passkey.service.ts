import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { PasskeyStoreService } from './passkey-store.service';
import type { RegistrationChallengeOptions } from './passkey-store.service';
import { CognitoService } from 'src/cognito/cognito.service';
import {
  WEBAUTHN_ORIGIN,
  WEBAUTHN_RP_ID,
  WEBAUTHN_RP_NAME,
  WEBAUTHN_AUTHENTICATOR_ATTACHMENT,
} from 'env.constants';
import { EnvironmentVariables } from 'env.config';

@Injectable()
export class PasskeyService {
  constructor(
    private readonly passkeyStore: PasskeyStoreService,
    private readonly cognitoService: CognitoService,
    private readonly configService: ConfigService<EnvironmentVariables>,
  ) {}

  async getRegistrationOptions(
    accessToken: string,
    sub: string,
  ): Promise<RegistrationChallengeOptions & Record<string, unknown>> {
    const rpID = this.configService.getOrThrow(WEBAUTHN_RP_ID, { infer: true });
    const rpName = this.configService.getOrThrow(WEBAUTHN_RP_NAME, {
      infer: true,
    });
    const userPasskeys = this.passkeyStore.getPasskeys(sub);
    const userResponse = await this.cognitoService.getUser(accessToken);
    const username =
      userResponse?.UserAttributes?.find(
        (a) => a.Name === 'email' || a.Name === 'preferred_username',
      )?.Value ?? sub;
    const options = await generateRegistrationOptions({
      rpName,
      rpID: rpID as 'localhost',
      userName: username,
      userID: new Uint8Array(Buffer.from(sub, 'utf8')),
      userDisplayName: username,
      attestationType: 'none',
      excludeCredentials: userPasskeys.map((passkey) => ({
        id: passkey.id,
        transports: passkey.transports as
          | (
              | 'ble'
              | 'cable'
              | 'hybrid'
              | 'internal'
              | 'nfc'
              | 'smart-card'
              | 'usb'
            )[]
          | undefined,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        ...(this.configService.getOrThrow(WEBAUTHN_AUTHENTICATOR_ATTACHMENT, {
          infer: true,
        }) === 'platform' && {
          authenticatorAttachment: 'platform' as const,
        }),
      },
    });
    this.passkeyStore.setRegistrationChallenge(sub, {
      challenge: options.challenge,
      user: options.user,
    });
    return options as unknown as RegistrationChallengeOptions &
      Record<string, unknown>;
  }

  async verifyRegistration(
    sub: string,
    responseBody: unknown,
  ): Promise<{ verified: boolean }> {
    const expectedOrigin =
      this.configService.getOrThrow(WEBAUTHN_ORIGIN, { infer: true }) ??
      'http://localhost:5173';
    const rpID = this.configService.getOrThrow(WEBAUTHN_RP_ID, { infer: true });
    const currentOptions = this.passkeyStore.getRegistrationChallenge(sub);
    if (!currentOptions) {
      throw new BadRequestException(
        'No registration in progress. Request options first.',
      );
    }

    const verification = await verifyRegistrationResponse({
      response: responseBody as Parameters<
        typeof verifyRegistrationResponse
      >[0]['response'],
      expectedChallenge: currentOptions.challenge ?? '',
      expectedOrigin,
      expectedRPID: rpID,
    });
    this.passkeyStore.clearRegistrationChallenge(sub);
    const verified =
      verification.verified === true && verification.registrationInfo != null;
    if (verified && verification.registrationInfo) {
      const info = verification.registrationInfo;
      const { credential, credentialDeviceType, credentialBackedUp } = info;
      this.passkeyStore.addPasskey(sub, {
        id: credential.id,
        publicKey: credential.publicKey,
        webauthnUserID: currentOptions.user?.id ?? '',
        counter: credential.counter,
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        transports: credential.transports,
      });
    }

    return { verified };
  }
}
