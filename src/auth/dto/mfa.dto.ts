import { IsEmail, IsString, MinLength } from 'class-validator';

export class MfaDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1, { message: 'Session is required' })
  session: string;

  @IsString()
  @MinLength(1, { message: 'MFA code is required' })
  softwareTokenMfaCode: string;
}
