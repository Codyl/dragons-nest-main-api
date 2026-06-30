/** Wizard path from signup / session; drives which attestation fields are required. */
export enum OnboardingExpectedBand {
  // ponytail: enum values unchanged for DB compat
  Manager = 'adult',
  Teen13to17 = 'teen13to17',
  Under13 = 'under13',
}
