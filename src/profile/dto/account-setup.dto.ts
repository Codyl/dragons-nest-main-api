import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsMongoId,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { AccountType } from 'src/users/enums/account-type.enum';
import { State } from 'src/users/enums/state.enum';
import { HomeschoolCurriculum } from 'src/users/enums/homeschool-curriculum.enum';
import { HomeschoolGrade } from 'src/users/enums/homeschool-grade.enum';

export class PendingStudentOnboardingDto {
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  displayName!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(120)
  age!: number;
}

export class TeachableCourseOnboardingDto {
  @IsMongoId()
  subjectId!: string;

  @IsEnum(HomeschoolGrade)
  grade!: HomeschoolGrade;

  @IsEnum(HomeschoolCurriculum)
  curriculum!: HomeschoolCurriculum;
}

export class AccountSetupDto {
  @IsEnum(AccountType)
  accountType!: AccountType;

  @IsString()
  @MinLength(1)
  @MaxLength(256)
  name!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(150)
  age!: number;

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
