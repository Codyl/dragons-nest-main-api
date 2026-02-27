import { Injectable } from '@nestjs/common';

export interface StoredPasskey {
  id: string;
  publicKey: Uint8Array;
  webauthnUserID: string;
  counter: number;
  deviceType: 'singleDevice' | 'multiDevice';
  backedUp: boolean;
  transports?: string[];
}

export interface RegistrationChallengeOptions {
  challenge?: string;
  user?: { id: string; name: string; displayName: string };
}

/**
 * In-memory store for WebAuthn passkey credentials and registration challenges.
 * Keyed by Cognito sub. For production, replace with a database.
 */
@Injectable()
export class PasskeyStoreService {
  private readonly passkeysBySub = new Map<string, StoredPasskey[]>();
  private readonly registrationChallengesBySub = new Map<
    string,
    RegistrationChallengeOptions
  >();

  getPasskeys(sub: string): StoredPasskey[] {
    return this.passkeysBySub.get(sub) ?? [];
  }

  addPasskey(sub: string, passkey: StoredPasskey): void {
    const list = this.passkeysBySub.get(sub) ?? [];
    list.push(passkey);
    this.passkeysBySub.set(sub, list);
  }

  setRegistrationChallenge(
    sub: string,
    options: RegistrationChallengeOptions,
  ): void {
    this.registrationChallengesBySub.set(sub, options);
  }

  getRegistrationChallenge(
    sub: string,
  ): RegistrationChallengeOptions | undefined {
    return this.registrationChallengesBySub.get(sub);
  }

  clearRegistrationChallenge(sub: string): void {
    this.registrationChallengesBySub.delete(sub);
  }
}
