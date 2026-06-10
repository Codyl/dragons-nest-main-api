import { IsString, Length } from 'class-validator';
import { Types } from 'mongoose';

export class SetSelectionDto {
  @IsString()
  @Length(24, 24)
  subjectId: string;

  @IsString()
  @Length(24, 24)
  studentId: Types.ObjectId;

  @IsString()
  @Length(24, 24)
  curriculumItemId: string;
}
