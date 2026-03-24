import { IsEmail, IsString, MinLength } from 'class-validator';

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
}
