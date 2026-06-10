import { IsMongoId, IsOptional, IsString } from 'class-validator';

export class GetCurriculumQueryDto {
  @IsMongoId({ message: 'subjectId must be a valid MongoDB ObjectId' })
  subjectId: string;

  @IsMongoId({ message: 'householdId must be a valid MongoDB ObjectId' })
  householdId: string;

  @IsOptional()
  @IsString({ message: 'studentId must be a string' })
  studentId?: string;
}
