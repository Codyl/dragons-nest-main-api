import type { Types } from 'mongoose';

/** Single user in API responses (sanitized document). */
export class UserResponseDto {
  _id!: Types.ObjectId;
  cognitoSub!: string;
  linkedProviders?: string[];
  linkedProviderSubjects?: { GOOGLE?: string };
  hasPassword?: boolean;
  email?: string | null;
}
