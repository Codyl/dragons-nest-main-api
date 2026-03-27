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
    await this.passkeyModel.create({
      cognitoSub: sub,
      credentialId: passkey.id,
      publicKey: Buffer.from(passkey.publicKey),
      counter: passkey.counter,
      transports: passkey.transports ?? [],
      webauthnUserID: passkey.webauthnUserID,
      deviceType: passkey.deviceType,
      backedUp: passkey.backedUp,
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
      .updateOne({ credentialId }, { $set: { counter } })
      .exec();
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
  }): StoredPasskey {
    return {
      id: doc.credentialId,
      publicKey: new Uint8Array(doc.publicKey),
      webauthnUserID: doc.webauthnUserID,
      counter: doc.counter,
      deviceType: doc.deviceType,
      backedUp: doc.backedUp,
      transports: doc.transports,
    };
  }
}
