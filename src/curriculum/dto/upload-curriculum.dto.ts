import { IsMongoId, IsOptional, MaxLength } from 'class-validator';

export class UploadCurriculumDto {
  @IsMongoId({ message: 'subjectId must be a valid MongoDB ObjectId' })
  @MaxLength(64)
  subjectId: string;

  @IsMongoId({ message: 'householdId must be a valid MongoDB ObjectId' })
  @MaxLength(64)
  householdId: string;

  @IsOptional()
  @IsMongoId({ message: 'householdId must be a valid MongoDB ObjectId' })
  @MaxLength(64)
  studentId?: string;
}
