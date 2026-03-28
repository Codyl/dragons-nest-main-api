import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class DeleteMeDto {
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password: string;

  /** TOTP from authenticator app when the account uses software-token MFA. */
  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Authenticator code must be at least 6 characters' })
  @MaxLength(8)
  mfaCode?: string;
}
