import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';

@Schema()
export class User extends Document {
  @Prop({ required: true })
  cognitoSub: string;

  @Prop({ type: [String], default: [] })
  linkedProviders?: string[];

  @Prop({ type: mongoose.Schema.Types.Mixed, default: {} })
  linkedProviderSubjects?: { GOOGLE?: string };

  @Prop({ type: Boolean, default: false })
  hasPassword?: boolean;

  @Prop({ type: String, default: null })
  email?: string;

  @Prop({ type: Boolean, default: false })
  deleted?: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
