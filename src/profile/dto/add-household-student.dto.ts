import { Type } from 'class-transformer';
import { IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class AddHouseholdStudentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  displayName!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(13)
  currentGrade!: number;
}
