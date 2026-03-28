import { IsString, MinLength } from 'class-validator';

export class WebAuthnDeleteCredentialDto {
  @IsString()
  @MinLength(1)
  credentialId: string;
}
