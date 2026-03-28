import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

@Schema()
export class User extends Document {
  @ApiProperty({
    description: 'Cognito subject for identifying a Cognito user',
  })
  @Prop({ required: true })
  cognitoSub: string;

  @ApiProperty({ description: "The user's linked providers" })
  @Prop({ type: [String], default: [] })
  linkedProviders?: string[];

  @ApiProperty({ description: "The user's linked provider subjects" })
  @Prop({ type: mongoose.Schema.Types.Mixed, default: {} })
  linkedProviderSubjects?: { GOOGLE?: string };

  @ApiProperty({ description: 'Whether the user has a password' })
  @Prop({ type: Boolean, default: false })
  hasPassword?: boolean;

  @ApiProperty({ description: "The user's email" })
  @Prop({ type: String, default: null })
  email?: string;

  @ApiProperty({ description: 'Whether the user is deleted' })
  @Prop({ type: Boolean, default: false })
  deleted?: boolean;

  @ApiProperty({
    description:
      'When the user first completed in-app login (welcome flow). Null until they finish welcome.',
    nullable: true,
  })
  @Prop({ type: Date, default: null })
  first_logged_in_at?: Date | null;
}

export const UserSchema = SchemaFactory.createForClass(User);
