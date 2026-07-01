import { IsMongoId, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateConceptDto {
  @IsMongoId()
  subjectId: string;

  @IsString()
  @IsNotEmpty()
  grade: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;
}
