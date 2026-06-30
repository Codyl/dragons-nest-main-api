/** Age band self-attested at account setup (no date of birth stored). */
export enum AgeBandAtRegistration {
  // ponytail: enum values unchanged for DB compat; keys use glossary terms
  Manager18Plus = 'ADULT_18_PLUS',
  Teen13To17 = 'TEEN_13_17',
  ManagedUserUnder13 = 'CHILD_UNDER_13_MANAGED',
}
