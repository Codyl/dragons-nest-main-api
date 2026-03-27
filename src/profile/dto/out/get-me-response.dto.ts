/** Response data for GET /profile (current user info). */
export class GetMeResponseDto {
  loginMethods!: string[];
  hasPassword!: boolean;
  hasPasskey!: boolean;
  passkeyCount!: number;
  softwareTokenMfaEnabled?: boolean;
  preferredMfa?: string;

  // Allow arbitrary string keys for additional Cognito attributes.
  [key: string]: string | string[] | boolean | number | undefined;
}
