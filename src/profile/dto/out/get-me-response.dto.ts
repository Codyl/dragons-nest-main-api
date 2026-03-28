/** Response data for GET /profile (current user info). */
export class GetMeResponseDto {
  loginMethods!: string[];
  hasPassword!: boolean;
  hasPasskey!: boolean;
  passkeyCount!: number;
  softwareTokenMfaEnabled?: boolean;
  preferredMfa?: string;
  /** Set after the user completes the welcome flow; null until then. */
  first_logged_in_at?: string | null;

  // Allow arbitrary string keys for additional Cognito attributes.
  [key: string]: string | string[] | boolean | number | null | undefined;
}
