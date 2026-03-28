import { IsObject } from 'class-validator';

export class WebAuthnRegisterCompleteDto {
  /** Browser `RegistrationResponseJSON` from @simplewebauthn/browser. */
  @IsObject()
  credential: Record<string, unknown>;
}
