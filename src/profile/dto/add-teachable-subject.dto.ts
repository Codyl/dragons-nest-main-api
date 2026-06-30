import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsMongoId,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  Validate,
} from 'class-validator';
import { HomeschoolCurriculum } from 'src/users/enums/homeschool-curriculum.enum';
import { HomeschoolGrade } from 'src/users/enums/homeschool-grade.enum';
import { TeachableCourseGradesConstraint } from './account-setup.dto';

export class AddTeachableSubjectDto {
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
