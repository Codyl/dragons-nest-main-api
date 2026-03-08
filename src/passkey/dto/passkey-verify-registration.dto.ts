import {
  IsArray,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
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

  @IsOptional()
  @IsString()
  @MinLength(1)
  authenticatorData?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  publicKey?: string;

  @IsOptional()
  @IsNumber()
  publicKeyAlgorithm?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  transports?: string[];
}

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

  @IsOptional()
  @IsObject()
  clientExtensionResults?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @IsIn(['platform', 'cross-platform'], {
    message:
      'authenticatorAttachment must be "platform" or "cross-platform" when present',
  })
  authenticatorAttachment?: string;
}
