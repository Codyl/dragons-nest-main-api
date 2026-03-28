import { IsEmail, IsString, MinLength } from 'class-validator';

export class WebAuthnSignInBeginDto {
  @IsEmail()
  username: string;

  @IsString()
  @MinLength(1, { message: 'Session is required' })
  session: string;
}
