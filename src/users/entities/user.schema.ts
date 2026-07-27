import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AccountType } from '../enums/account-type.enum';
import { AgeBandAtRegistration } from '../enums/age-band-at-registration.enum';
import { State } from '../enums/state.enum';
import {
  TeachableCourse,
  TeachableCourseSchema,
} from '../schemas/teachable-course.schema';

/** UTC Jan 1 of the birth year implied by a stated age (onboarding). */
export function birthDateFromStatedAge(
  age: number,
  refDate = new Date(),
): Date {
  const y = refDate.getUTCFullYear() - age;
  return new Date(Date.UTC(y, 0, 1));
}

/** Parse `YYYY-MM-DD` as local calendar date (aligned with browser `input type="date"`). */
export function parseLocalDateFromYyyyMmDd(s: string): Date | null {
  const trimmed = s.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null;
  }

  const [y, m, d] = trimmed.split('-').map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return null;
  }

  if (m < 1 || m > 12 || d < 1 || d > 31) {
    return null;
  }

  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) {
    return null;
  }

  return dt;
}

/** Whole-year age in local calendar (matches User `age` virtual). */
export function ageFromBirthDate(
  birthDate: Date,
  refDate = new Date(),
): number {
  const bd = new Date(birthDate);
  let years = refDate.getFullYear() - bd.getFullYear();
  const monthDiff = refDate.getMonth() - bd.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && refDate.getDate() < bd.getDate())) {
    years -= 1;
  }

  return years;
}

@Schema({ _id: false })
export class TimeSlot {
  @Prop({ required: true })
  start: string;

  @Prop({ required: true })
  end: string;
}

export const TimeSlotSchema = SchemaFactory.createForClass(TimeSlot);

@Schema({ _id: false })
export class DayAvailability {
  @Prop({
    required: true,
    enum: [
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
    ],
  })
  day: string;

  @Prop({ type: [TimeSlotSchema], default: [] })
  slots: TimeSlot[];
}

export const DayAvailabilitySchema =
  SchemaFactory.createForClass(DayAvailability);

@Schema()
export class EnrolledClass {
  @ApiProperty({ description: 'The user (adult) who is teaching the class' })
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  adult: Types.ObjectId;

  @ApiProperty({ description: 'The course being taught' })
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'TeachableCourse' })
  course: TeachableCourse;

  @ApiProperty({ description: 'The subject this class belongs to' })
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Subject', default: null })
  subjectId?: Types.ObjectId | null;

  @ApiPropertyOptional({
    description: 'The selected curriculum item for this class/subject',
  })
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CurriculumItem',
    default: null,
  })
  curriculumId?: Types.ObjectId | null;

  @ApiProperty({ description: 'The number of hours completed' })
  @Prop({ type: Number, default: 0 })
  hoursCompleted: number;

  @ApiPropertyOptional({
    description:
      'When the enrollment was recorded; used for parent-view privacy cutoffs.',
  })
  @Prop({ type: Date, default: Date.now })
  createdAt?: Date;
}

export const EnrolledClassSchema = SchemaFactory.createForClass(EnrolledClass);

@Schema()
export class User extends Document {
  @ApiProperty({
    enum: AccountType,
    description: 'Account kind: adult or manageduser.',
    required: true,
  })
  @Prop({
    type: String,
    enum: Object.values(AccountType),
    required: true,
  })
  accountType: AccountType;

  @ApiProperty({
    description: 'Given (first) name from signup or onboarding.',
    nullable: true,
  })
  @Prop({ type: String, default: null })
  givenName?: string | null;

  @ApiProperty({
    description: 'Family (last) name from signup or onboarding.',
    nullable: true,
  })
  @Prop({ type: String, default: null })
  familyName?: string | null;

  @ApiProperty({
    description:
      'When an adult household account recorded COPPA / guardian consent.',
    nullable: true,
  })
  @Prop({ type: Date, default: null })
  coppaConsentAt?: Date | null;

  @ApiPropertyOptional({
    description:
      'Cognito subject; omitted for dependent accounts without their own login.',
  })
  @Prop({
    type: String,
    required: false,
    default: null,
    sparse: true,
    index: true,
  })
  cognitoSub?: string | null;

  @ApiProperty({ description: "The user's linked providers" })
  @Prop({ type: [String], default: [] })
  linkedProviders?: string[];

  @ApiProperty({ description: "The user's linked provider subjects" })
  @Prop({ type: mongoose.Schema.Types.Mixed, default: {} })
  linkedProviderSubjects?: { GOOGLE?: string };

  @ApiProperty({ description: 'Whether the user has a password' })
  @Prop({ type: Boolean, default: false })
  hasPassword?: boolean;

  @ApiPropertyOptional({
    description: "The user's email; omitted when the user has no login.",
    nullable: true,
  })
  @Prop({
    type: String,
    required: false,
    unique: true,
    sparse: true,
  })
  email?: string | null;

  @ApiProperty({ description: 'Whether the user is deleted' })
  @Prop({ type: Boolean, default: false })
  deleted?: boolean;

  @ApiProperty({
    description:
      'When the user first completed in-app login (welcome flow). Null until they finish welcome.',
    nullable: true,
  })
  @Prop({ type: Date, default: null })
  firstLoggedInAt?: Date | null;

  @ApiProperty({
    description:
      'Legacy date of birth (no longer written at account setup; may exist on older documents).',
    nullable: true,
  })
  @Prop({ type: Date, default: null })
  birthDate?: Date | null;

  @ApiPropertyOptional({
    description:
      'Self-attested age band at registration (replaces DOB for new users).',
    enum: AgeBandAtRegistration,
  })
  @Prop({
    type: String,
    enum: Object.values(AgeBandAtRegistration),
    required: false,
    default: null,
  })
  ageBandAtRegistration?: AgeBandAtRegistration | null;

  @ApiPropertyOptional({
    description: 'When age-band attestations were recorded at account setup.',
  })
  @Prop({ type: Date, default: null })
  ageAttestationConfirmedAt?: Date | null;

  @ApiPropertyOptional({
    description: 'Computed from birthDate (virtual; not stored).',
  })
  age?: number;

  @ApiProperty({
    description:
      'When the user completed the account-setup wizard (before welcome). Null until saved.',
    nullable: true,
  })
  @Prop({ type: Date, default: null })
  onboardingCompletedAt?: Date | null;

  @ApiProperty({
    description:
      "The user's current state (set during account setup; null until then).",
    enum: State,
    nullable: true,
  })
  @Prop({ type: String, enum: State, required: false, default: null })
  state?: State | null;

  @ApiProperty({
    description:
      "The user's zip code (set during account setup; null until then).",
    nullable: true,
  })
  @Prop({
    type: String,
    match: /^[0-9]{5}$/,
    required: false,
    default: null,
  })
  zipCode?: string | null;

  @ApiProperty({ description: "The user's availability" })
  @Prop({ type: [DayAvailabilitySchema], default: [] })
  availablity: DayAvailability[];

  @ApiPropertyOptional({
    description: 'Household adult managing this user, if any.',
  })
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null })
  parentId?: Types.ObjectId | null;

  @ApiProperty({
    description:
      'Whether this user may manage other profiles (e.g. household).',
    default: false,
  })
  @Prop({ type: Boolean, default: false })
  canManageOthers?: boolean;

  @ApiProperty({
    description:
      'Grade, catalog subject id, and curriculum combinations this adult can teach.',
    type: [TeachableCourse],
  })
  @Prop({ type: [TeachableCourseSchema], default: [] })
  teachableCourses?: TeachableCourse[];

  @ApiProperty({
    description:
      'ManagedUser profiles collected at onboarding before full child accounts exist.',
  })
  @Prop({
    type: [
      {
        managedUserId: { type: Types.ObjectId, required: true, ref: 'User' },
        displayName: { type: String, required: true },
        currentGrade: { type: Number, required: true, min: 0, max: 13 },
        lastPromotionYear: { type: Number, required: true },
        archivedAt: { type: Date, default: null },
      },
    ],
    default: [],
  })
  managedAccountsView?: {
    managedUserId: Types.ObjectId;
    displayName: string;
    currentGrade: number;
    lastPromotionYear: number;
    archivedAt?: Date | null;
  }[];

  @ApiProperty({
    description:
      'Test scores recorded by the Manager for Managed Users in this household.',
  })
  @Prop({
    type: [
      {
        managedUserId: { type: Types.ObjectId, required: true, ref: 'User' },
        subjectName: { type: String, required: true, maxlength: 100 },
        score: { type: Number, required: true, min: 0, max: 100 },
        date: { type: Date, required: true },
      },
    ],
    default: [],
  })
  testScores?: {
    managedUserId: Types.ObjectId;
    subjectName: string;
    score: number;
    date: Date;
  }[];

  @ApiProperty({
    description: 'Avatar id (e.g. dragon, owl) from onboarding.',
    nullable: true,
  })
  @Prop({
    type: String,
    default: null,
    enum: ['🐉', '🦅', '🦉', '🦊', '🐻', '🐢'],
  })
  avatar?: string | null;

  @Prop({ type: [EnrolledClassSchema], default: [] })
  addedClasses?: EnrolledClass[];

  @Prop({ type: Number })
  lastPromotionYear: number;

  @Prop({
    type: [
      {
        type: { type: String, enum: ['COURSE_REMOVED'], required: true },
        recipientUserId: { type: Types.ObjectId, required: true, ref: 'User' },
        payload: { type: mongoose.Schema.Types.Mixed, required: true },
        createdAt: { type: Date, required: true },
      },
    ],
    default: [],
  })
  notificationEvents?: {
    type: 'COURSE_REMOVED';
    recipientUserId: Types.ObjectId;
    payload: unknown;
    createdAt: Date;
  }[];
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.virtual('age').get(function (this: User) {
  if (!this.birthDate) {
    return undefined;
  }

  return ageFromBirthDate(new Date(this.birthDate));
});

UserSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    const plain = ret as { __v?: number };
    delete plain.__v;
    return ret;
  },
});
UserSchema.set('toObject', { virtuals: true });
