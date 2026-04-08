import type { Types } from 'mongoose';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AccountType } from '../../enums/account-type.enum';

/** Single user in API responses (sanitized document). */
export class UserResponseDto {
  _id!: Types.ObjectId;
  cognitoSub?: string | null;
  linkedProviders?: string[];
  linkedProviderSubjects?: { GOOGLE?: string };
  hasPassword?: boolean;
  email?: string | null;

  @ApiPropertyOptional({ enum: AccountType, nullable: true })
  accountType?: AccountType | null;

  @ApiPropertyOptional({ nullable: true })
  givenName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  familyName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  coppaConsentAt?: Date | null;

  @ApiPropertyOptional({
    description:
      'Present for self or verified parent views; parent responses exclude post–18th-birthday enrollments.',
  })
  addedClasses?: unknown[];
}
