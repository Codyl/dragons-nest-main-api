import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { PasskeyStoreService } from './passkey-store.service';
import type { RegistrationChallengeOptions } from './passkey-store.service';
import { CognitoService } from 'src/cognito/cognito.service';
import {
  WEBAUTHN_ORIGIN,
  WEBAUTHN_RP_ID,
  WEBAUTHN_RP_NAME,
  // WEBAUTHN_AUTHENTICATOR_ATTACHMENT,
} from 'src/env.constants';
import { EnvironmentVariables } from 'src/env.config';

const AUTH_CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class PasskeyService {
  private readonly authChallenges = new Map<string, number>();

  constructor(
    private readonly passkeyStore: PasskeyStoreService,
    private readonly cognitoService: CognitoService,
    private readonly configService: ConfigService<EnvironmentVariables>,
  ) {}

  private pruneExpiredAuthChallenges(): void {
    const now = Date.now();
    for (const [challenge, createdAt] of this.authChallenges.entries()) {
      if (now - createdAt > AUTH_CHALLENGE_TTL_MS) {
        this.authChallenges.delete(challenge);
      }
    }
  }

  async getRegistrationOptions(
    accessToken: string,
    sub: string,
  ): Promise<RegistrationChallengeOptions & Record<string, unknown>> {
    const rpID = this.configService.getOrThrow(WEBAUTHN_RP_ID, { infer: true });
    const rpName = this.configService.getOrThrow(WEBAUTHN_RP_NAME, {
      infer: true,
    });
    const userPasskeys = await this.passkeyStore.getPasskeys(sub);
    const userResponse = await this.cognitoService.getUser(accessToken);
    const username =
      userResponse?.UserAttributes?.find(
        (a) => a.Name === 'email' || a.Name === 'preferred_username',
      )?.Value ?? sub;
    const options = await generateRegistrationOptions({
      rpName,
      rpID: rpID,
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
        // ...(this.configService.getOrThrow(WEBAUTHN_AUTHENTICATOR_ATTACHMENT, {
        //   infer: true,
        // }) === 'platform' && {
        //   authenticatorAttachment: 'platform' as const,
        // }),
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
      await this.passkeyStore.addPasskey(sub, {
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

  /**
   * Generate options for passkey authentication (login). No allowCredentials so
   * discoverable (resident) keys can be used. Challenge is stored for verify.
   */
  async getAuthenticationOptions(): Promise<Record<string, unknown>> {
    this.pruneExpiredAuthChallenges();
    const rpID = this.configService.getOrThrow(WEBAUTHN_RP_ID, { infer: true });
    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: [],
      userVerification: 'preferred',
    });
    this.authChallenges.set(options.challenge, Date.now());
    return options as unknown as Record<string, unknown>;
  }

  /**
   * Verify passkey assertion and return sub on success. Updates stored counter.
   */
  async verifyAuthentication(responseBody: unknown): Promise<{
    verified: boolean;
    sub?: string;
  }> {
    this.pruneExpiredAuthChallenges();
    const expectedOrigin =
      this.configService.getOrThrow(WEBAUTHN_ORIGIN, { infer: true }) ??
      'http://localhost:5173';
    const rpID = this.configService.getOrThrow(WEBAUTHN_RP_ID, { infer: true });

    const response = responseBody as {
      id: string;
      response: { clientDataJSON: string };
    };
    const clientDataJson = JSON.parse(
      Buffer.from(response.response.clientDataJSON, 'base64url').toString(
        'utf8',
      ),
    ) as { challenge?: string };
    const challenge = clientDataJson.challenge;
    if (!challenge || typeof challenge !== 'string') {
      throw new BadRequestException('Invalid assertion: missing challenge');
    }

    const createdAt = this.authChallenges.get(challenge);
    if (createdAt == null) {
      throw new BadRequestException(
        'Invalid or expired challenge. Request new options.',
      );
    }

    if (Date.now() - createdAt > AUTH_CHALLENGE_TTL_MS) {
      this.authChallenges.delete(challenge);
      throw new BadRequestException('Challenge expired. Request new options.');
    }

    this.authChallenges.delete(challenge);

    const found = await this.passkeyStore.findByCredentialId(response.id);
    if (!found) {
      throw new BadRequestException('Credential not found');
    }

    const credential = {
      id: found.passkey.id,
      publicKey: found.passkey.publicKey,
      counter: found.passkey.counter,
      transports: found.passkey.transports,
    } as Parameters<typeof verifyAuthenticationResponse>[0]['credential'];

    const verification = await verifyAuthenticationResponse({
      response: responseBody as Parameters<
        typeof verifyAuthenticationResponse
      >[0]['response'],
      expectedChallenge: challenge,
      expectedOrigin,
      expectedRPID: rpID,
      credential,
    });

    if (!verification.verified) {
      return { verified: false };
    }

    await this.passkeyStore.updateCounter(
      response.id,
      verification.authenticationInfo.newCounter,
    );

    return { verified: true, sub: found.sub };
  }
}
