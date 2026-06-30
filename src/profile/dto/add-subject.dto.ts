import { IsString, Matches } from 'class-validator';

export class AddSubjectDto {
  @IsString()
  @Matches(/^[0-9a-f]{24}$/, {
    message: 'subjectId must be a valid 24-character hex ObjectId',
  })
  subjectId: string;
}
