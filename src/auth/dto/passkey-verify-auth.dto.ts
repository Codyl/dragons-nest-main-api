import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Assertion response from the authenticator (matches @simplewebauthn/browser startAuthentication).
 */
export class AuthenticatorAssertionResponseDto {
  @IsString()
  @MinLength(1, { message: 'clientDataJSON is required' })
  clientDataJSON: string;

  @IsString()
  @MinLength(1, { message: 'authenticatorData is required' })
  authenticatorData: string;

  @IsString()
  @MinLength(1, { message: 'signature is required' })
  signature: string;

  @IsOptional()
  @IsString()
  userHandle?: string;
}

/**
 * WebAuthn authentication (assertion) verification payload.
 */
export class PasskeyVerifyAuthDto {
  @IsString()
  @MinLength(1, { message: 'Credential id is required' })
  id: string;

  @IsString()
  @MinLength(1, { message: 'rawId is required' })
  rawId: string;

  @IsIn(['public-key'], { message: 'type must be "public-key"' })
  type: string;

  @IsObject()
  @ValidateNested()
  @Type(() => AuthenticatorAssertionResponseDto)
  response: AuthenticatorAssertionResponseDto;

  @IsOptional()
  @IsObject()
  clientExtensionResults?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  authenticatorAttachment?: string;
}
