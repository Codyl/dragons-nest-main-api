import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Passkey } from './entities/passkey.entity';
import type { StoredPasskey } from './passkey-store.service';

@Injectable()
export class PasskeyRepository {
  constructor(
    @InjectModel(Passkey.name) private readonly passkeyModel: Model<Passkey>,
  ) {}

  async getPasskeys(sub: string): Promise<StoredPasskey[]> {
    const docs = await this.passkeyModel
      .find({ cognitoSub: sub })
      .lean()
      .exec();
    return docs.map((d) => this.toStoredPasskey(d));
  }

  async addPasskey(sub: string, passkey: StoredPasskey): Promise<void> {
    const now = new Date();
    await this.passkeyModel.create({
      cognitoSub: sub,
      credentialId: passkey.id,
      publicKey: Buffer.from(passkey.publicKey),
      counter: passkey.counter,
      transports: passkey.transports ?? [],
      webauthnUserID: passkey.webauthnUserID,
      deviceType: passkey.deviceType,
      backedUp: passkey.backedUp,
      aaguid: passkey.aaguid,
      lastUsedAt: now,
    });
  }

  async findByCredentialId(
    credentialId: string,
  ): Promise<{ sub: string; passkey: StoredPasskey } | null> {
    const doc = await this.passkeyModel.findOne({ credentialId }).lean().exec();
    if (!doc) return null;

    return {
      sub: doc.cognitoSub,
      passkey: this.toStoredPasskey(doc),
    };
  }

  async updateCounter(credentialId: string, counter: number): Promise<void> {
    await this.passkeyModel
      .updateOne(
        { credentialId },
        { $set: { counter, lastUsedAt: new Date() } },
      )
      .exec();
  }

  async listForDisplay(sub: string): Promise<
    {
      credentialId: string;
      aaguid?: string;
      deviceType: 'singleDevice' | 'multiDevice';
      backedUp: boolean;
      transports?: string[];
      createdAt: Date;
      lastUsedAt?: Date;
    }[]
  > {
    const docs = await this.passkeyModel
      .find({ cognitoSub: sub })
      .select(
        'credentialId aaguid deviceType backedUp transports createdAt lastUsedAt',
      )
      .sort({ createdAt: 1 })
      .lean()
      .exec();

    type PasskeyListLean = {
      credentialId: string;
      aaguid?: string;
      deviceType: 'singleDevice' | 'multiDevice';
      backedUp: boolean;
      transports?: string[];
      createdAt: Date;
      lastUsedAt?: Date;
    };

    return (docs as PasskeyListLean[]).map((d) => ({
      credentialId: d.credentialId,
      aaguid: d.aaguid,
      deviceType: d.deviceType,
      backedUp: d.backedUp,
      transports: d.transports,
      createdAt: d.createdAt,
      lastUsedAt: d.lastUsedAt,
    }));
  }

  async deleteBySubAndCredentialId(
    sub: string,
    credentialId: string,
  ): Promise<boolean> {
    const res = await this.passkeyModel
      .deleteOne({ cognitoSub: sub, credentialId })
      .exec();
    return res.deletedCount > 0;
  }

  async countBySub(sub: string): Promise<number> {
    return this.passkeyModel.countDocuments({ cognitoSub: sub }).exec();
  }

  private toStoredPasskey(doc: {
    credentialId: string;
    publicKey: Buffer;
    counter: number;
    transports?: string[];
    webauthnUserID: string;
    deviceType: 'singleDevice' | 'multiDevice';
    backedUp: boolean;
    aaguid?: string;
  }): StoredPasskey {
    return {
      id: doc.credentialId,
      publicKey: new Uint8Array(doc.publicKey),
      webauthnUserID: doc.webauthnUserID,
      counter: doc.counter,
      deviceType: doc.deviceType,
      backedUp: doc.backedUp,
      transports: doc.transports,
      aaguid: doc.aaguid,
    };
  }
}
