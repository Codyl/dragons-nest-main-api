import { IsEmail, IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class WebAuthnSignInCompleteDto {
  @IsEmail()
  username: string;

  @IsString()
  @MinLength(1, { message: 'Session is required' })
  session: string;

  /** Browser `AuthenticationResponseJSON` from @simplewebauthn/browser (POST body as JSON). */
  @IsObject()
  credential: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Device name is required when provided' })
  deviceName?: string;
}
