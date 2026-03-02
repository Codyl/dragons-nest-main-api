import {
  IsIn,
  IsObject,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PasskeyRegistrationResponseDto {
  @IsString()
  @MinLength(1, { message: 'clientDataJSON is required' })
  clientDataJSON: string;

  @IsString()
  @MinLength(1, { message: 'attestationObject is required' })
  attestationObject: string;
}

/**
 * WebAuthn registration verification payload (browser credential response).
 * Validates the minimal shape required by @simplewebauthn/server verifyRegistrationResponse.
 */
export class PasskeyVerifyRegistrationDto {
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
  @Type(() => PasskeyRegistrationResponseDto)
  response: PasskeyRegistrationResponseDto;
}
