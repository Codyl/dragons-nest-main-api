import { IsBoolean, IsIn, IsOptional } from 'class-validator';

export class MfaPreferenceDto {
  @IsOptional()
  @IsBoolean()
  smsMfaEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  softwareTokenMfaEnabled?: boolean;

  @IsOptional()
  @IsIn(
    ['SOFTWARE_TOKEN_MFA', 'SMS_MFA', 'NOMFA', 'softwareToken', 'sms', 'none'],
    {
      message:
        'preferredMfa must be one of: SOFTWARE_TOKEN_MFA, SMS_MFA, NOMFA, softwareToken, sms, none',
    },
  )
  preferredMfa?: string;
}
