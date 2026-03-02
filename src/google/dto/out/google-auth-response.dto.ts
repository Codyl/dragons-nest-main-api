/** Shared shape for Google signup and token-exchange responses. */
export class GoogleAuthResponseDto {
  AuthenticationResult?: { ExpiresIn?: number };
  loginProvider?: 'google';
}
