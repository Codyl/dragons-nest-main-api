/** User account role — managers run accounts, managed users are added under them. */
export enum AccountType {
  // ponytail: enum values stay 'adult'/'student' for DB compat; keys use glossary terms
  Manager = 'adult',
  ManagedUser = 'student',
}
