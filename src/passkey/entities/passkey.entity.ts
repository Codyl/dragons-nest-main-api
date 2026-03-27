import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Passkey extends Document {
  @Prop({ required: true })
  cognitoSub: string;

  @Prop({ required: true, unique: true })
  credentialId: string;

  @Prop({ required: true, type: Buffer })
  publicKey: Buffer;

  @Prop({ required: true, default: 0 })
  counter: number;

  @Prop({ type: [String], default: [] })
  transports: string[];

  @Prop({ required: true, default: '' })
  webauthnUserID: string;

  @Prop({ required: true, enum: ['singleDevice', 'multiDevice'] })
  deviceType: 'singleDevice' | 'multiDevice';

  @Prop({ required: true, default: false })
  backedUp: boolean;
}

export const PasskeySchema = SchemaFactory.createForClass(Passkey);
