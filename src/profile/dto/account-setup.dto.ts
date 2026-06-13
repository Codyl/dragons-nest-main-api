import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  Validate,
  ValidateIf,
  ValidateNested,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { AccountType } from 'src/users/enums/account-type.enum';
import { OnboardingExpectedBand } from 'src/users/enums/onboarding-expected-band.enum';
import { State } from 'src/users/enums/state.enum';
import { HomeschoolCurriculum } from 'src/users/enums/homeschool-curriculum.enum';
import { HomeschoolGrade } from 'src/users/enums/homeschool-grade.enum';

export class PendingStudentOnboardingDto {
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  studentId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(256)
  displayName!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(13)
  currentGrade!: number;
}

@ValidatorConstraint({ name: 'teachableCourseGrades', async: false })
export class TeachableCourseGradesConstraint implements ValidatorConstraintInterface {
  validate(grades: unknown, args: ValidationArguments): boolean {
    const obj = args.object as TeachableCourseOnboardingDto;
    const allowed = new Set<string>(Object.values(HomeschoolGrade));

    if (!Array.isArray(grades)) return false;

    if (obj.matchesAllGrades) {
      return grades.length === 0;
    }

    if (grades.length < 1) return false;

    return grades.every((g) => typeof g === 'string' && allowed.has(g));
  }

  defaultMessage(args: ValidationArguments): string {
    const obj = args.object as TeachableCourseOnboardingDto;

    if (obj.matchesAllGrades) {
      return 'grades must be empty when matchesAllGrades is true';
    }

    return 'grades must list at least one HomeschoolGrade when matchesAllGrades is false';
  }
}

export class TeachableCourseOnboardingDto {
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  className!: string;

  @IsMongoId()
  subjectId!: string;

  @IsBoolean()
  matchesAllGrades!: boolean;

  @IsArray()
  @Validate(TeachableCourseGradesConstraint)
  grades!: HomeschoolGrade[];

  @IsEnum(HomeschoolCurriculum)
  curriculum!: HomeschoolCurriculum;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  maxStudents!: number;
}

const WEEKDAY_RE =
  /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/;

export class TimeSlotOnboardingDto {
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  start!: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  end!: string;
}

export class DayAvailabilityOnboardingDto {
  @IsString()
  @Matches(WEEKDAY_RE)
  day!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeSlotOnboardingDto)
  slots!: TimeSlotOnboardingDto[];
}

export class AccountSetupDto {
  @IsEnum(AccountType)
  accountType!: AccountType;

  @IsEnum(OnboardingExpectedBand)
  onboardingExpectedBand!: OnboardingExpectedBand;

  @IsString()
  @MinLength(1)
  @MaxLength(256)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  avatar!: string;

  @IsEnum(State)
  state!: State;

  @IsString()
  @Matches(/^[0-9]{5}$/)
  zipCode!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(32)
  phoneNumber!: string;

  @IsArray()
  @IsString({ each: true })
  interests!: string[];

  @IsString()
  @MaxLength(2000)
  shortTermGoal!: string;

  @IsString()
  @MaxLength(2000)
  longTermGoal!: string;

  @IsArray()
  @IsString({ each: true })
  learningStyles!: string[];

  @IsArray()
  @ArrayMinSize(7)
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => DayAvailabilityOnboardingDto)
  weeklyAvailability!: DayAvailabilityOnboardingDto[];

  @ValidateIf(
    (o: AccountSetupDto) =>
      o.onboardingExpectedBand === OnboardingExpectedBand.Adult,
  )
  @IsOptional()
  @IsBoolean()
  adultAgeConfirmed?: boolean;

  @ValidateIf(
    (o: AccountSetupDto) =>
      o.onboardingExpectedBand === OnboardingExpectedBand.Adult,
  )
  @IsOptional()
  @IsBoolean()
  adultGuardianDutyConfirmed?: boolean;

  @ValidateIf(
    (o: AccountSetupDto) =>
      o.onboardingExpectedBand === OnboardingExpectedBand.Teen13to17,
  )
  @IsOptional()
  @IsBoolean()
  teenAgeConfirmed?: boolean;

  @ValidateIf(
    (o: AccountSetupDto) =>
      o.onboardingExpectedBand === OnboardingExpectedBand.Teen13to17,
  )
  @IsOptional()
  @IsBoolean()
  teenPermissionConfirmed?: boolean;

  @ValidateIf(
    (o: AccountSetupDto) =>
      o.onboardingExpectedBand === OnboardingExpectedBand.Under13,
  )
  @IsOptional()
  @IsBoolean()
  under13ChildConfirmed?: boolean;

  @ValidateIf(
    (o: AccountSetupDto) =>
      o.onboardingExpectedBand === OnboardingExpectedBand.Under13,
  )
  @IsOptional()
  @IsBoolean()
  under13GuardianPermissionConfirmed?: boolean;

  @ValidateIf((o: AccountSetupDto) => o.accountType === AccountType.Adult)
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PendingStudentOnboardingDto)
  pendingStudents?: PendingStudentOnboardingDto[];

  @ValidateIf((o: AccountSetupDto) => o.accountType === AccountType.Adult)
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TeachableCourseOnboardingDto)
  teachableCourses?: TeachableCourseOnboardingDto[];
}
