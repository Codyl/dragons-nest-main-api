import { Injectable } from '@nestjs/common';
import { PasskeyRepository } from './passkey.repository';

export interface StoredPasskey {
  id: string;
  publicKey: Uint8Array;
  webauthnUserID: string;
  counter: number;
  deviceType: 'singleDevice' | 'multiDevice';
  backedUp: boolean;
  transports?: string[];
  aaguid?: string;
}

export interface RegistrationChallengeOptions {
  challenge?: string;
  user?: { id: string; name: string; displayName: string };
}

/**
 * WebAuthn passkey credentials (persisted via PasskeyRepository) and
 * registration challenges (in-memory, short-lived).
 */
@Injectable()
export class PasskeyStoreService {
  private readonly registrationChallengesBySub = new Map<
    string,
    RegistrationChallengeOptions
  >();

  constructor(private readonly passkeyRepository: PasskeyRepository) {}

  async getPasskeys(sub: string): Promise<StoredPasskey[]> {
    return this.passkeyRepository.getPasskeys(sub);
  }

  async listPasskeysForDisplay(
    sub: string,
  ): ReturnType<PasskeyRepository['listForDisplay']> {
    return this.passkeyRepository.listForDisplay(sub);
  }

  async addPasskey(sub: string, passkey: StoredPasskey): Promise<void> {
    await this.passkeyRepository.addPasskey(sub, passkey);
  }

  async countPasskeys(sub: string): Promise<number> {
    return this.passkeyRepository.countBySub(sub);
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

  async findByCredentialId(
    credentialId: string,
  ): Promise<{ sub: string; passkey: StoredPasskey } | null> {
    return this.passkeyRepository.findByCredentialId(credentialId);
  }

  async updateCounter(credentialId: string, counter: number): Promise<void> {
    await this.passkeyRepository.updateCounter(credentialId, counter);
  }

  async removePasskey(sub: string, credentialId: string): Promise<boolean> {
    return this.passkeyRepository.deleteBySubAndCredentialId(sub, credentialId);
  }
}
