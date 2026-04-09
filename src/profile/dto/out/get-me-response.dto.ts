/** Response data for GET /profile (current user info). */
export class GetMeResponseDto {
  loginMethods!: string[];
  hasPassword!: boolean;
  hasPasskey!: boolean;
  passkeyCount!: number;
  softwareTokenMfaEnabled?: boolean;
  preferredMfa?: string;
  /** Set after the user completes the welcome flow; null until then. */
  firstLoggedInAt?: string | null;

  /** Set after the user completes the account-setup wizard; null until then. */
  onboardingCompletedAt?: string | null;

  /** `adult` | `student` from the user document. */
  accountType?: string | null;

  /** Household manager / can link and manage other profiles. */
  canManageOthers?: boolean;

  /** Mongo ObjectId string of guardian user when this profile is a dependent. */
  parentId?: string | null;

  /** Mongo ObjectId strings for students linked to this adult. */
  linkedStudentIds?: string[];

  /**
   * MANAGED (under 13), INDEPENDENT (13–17), ADULT (18+); from attested age band or legacy birthDate.
   */
  accountStatus?: 'MANAGED' | 'INDEPENDENT' | 'ADULT' | null;

  /** Self-attested registration band when DOB is not stored. */
  ageBandAtRegistration?: string | null;

  /** Household learner drafts (adults only). */
  householdStudents?: {
    studentDraftId: string;
    displayName: string;
    currentGrade: number;
    lastPromotionYear: number;
  }[];

  // Allow arbitrary string keys for additional Cognito attributes.
  [key: string]:
    | string
    | string[]
    | boolean
    | number
    | null
    | undefined
    | 'MANAGED'
    | 'INDEPENDENT'
    | 'ADULT'
    | unknown;
}
