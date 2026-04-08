import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { AccountType } from 'src/users/enums/account-type.enum';

export class ConfirmSignupDto {
  @IsEmail()
  username: string;

  @IsString()
  @MinLength(1, { message: 'Verification code is required' })
  code: string;

  @IsString()
  @MinLength(1, { message: 'Session is required' })
  session: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password: string;

  @IsOptional()
  @IsEnum(AccountType)
  accountType?: AccountType;

  @IsOptional()
  @IsString()
  @MinLength(1)
  givenName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  familyName?: string;

  /** When true and account is adult, persists {@link User.coppaConsentAt} (household signup). */
  @IsOptional()
  @IsBoolean()
  coppaConsent?: boolean;
}
