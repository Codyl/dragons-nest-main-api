import {
  IsDateString,
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateActivityDto {
  @IsMongoId({ message: 'subjectId must be a valid MongoDB ObjectId' })
  subjectId: string;

  @IsMongoId({ message: 'managedUserId must be a valid MongoDB ObjectId' })
  managedUserId: string;

  @IsDateString({}, { message: 'date must be a valid ISO 8601 date' })
  date: string;

  @IsMongoId({ message: 'conceptId must be a valid MongoDB ObjectId' })
  conceptId: string;

  @IsIn(['Easy', 'Medium', 'Hard'], {
    message: 'difficulty must be one of: Easy, Medium, Hard',
  })
  difficulty: string;

  @IsInt({ message: 'timeSpentMinutes must be a positive integer' })
  @Min(1, { message: 'timeSpentMinutes must be at least 1' })
  @Max(1440, { message: 'timeSpentMinutes must be no greater than 1440' })
  timeSpentMinutes: number;

  @IsOptional()
  @IsString({ message: 'notes must be a string' })
  notes?: string;
}
