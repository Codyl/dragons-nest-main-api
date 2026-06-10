import { IsMongoId, IsString, Length } from 'class-validator';

export class GetSelectionQueryDto {
  @IsString()
  @Length(24, 24)
  subjectId: string;

  @IsMongoId()
  studentId: string;
}
