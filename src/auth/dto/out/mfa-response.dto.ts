/** Minimal MFA challenge response; tokens are set via cookies. */
export class MfaResponseDto {
  Session?: string;
  ChallengeName?: string;
  AuthenticationResult?: Record<string, unknown>;
}
