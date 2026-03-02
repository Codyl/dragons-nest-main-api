/** WebAuthn registration options from POST /profile/passkey/register/options. */
export class PasskeyRegisterOptionsResponseDto {
  // Loose index signature to accommodate WebAuthn options shape.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}
