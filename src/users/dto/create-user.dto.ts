import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AccountType } from '../enums/account-type.enum';

/**
 * Unified signup / user-creation payload (no discriminator-specific DTOs).
 * Validation for household-specific rules (e.g. COPPA) stays in services.
 */
export class CreateUserDto {
  @ApiProperty({ enum: AccountType })
  @IsEnum(AccountType)
  accountType!: AccountType;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  givenName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  familyName?: string;

  @ApiPropertyOptional({
    description:
      'Guardian consent for household / minor flows; persisted when applicable.',
  })
  @IsOptional()
  @IsBoolean()
  coppaConsent?: boolean;
}
