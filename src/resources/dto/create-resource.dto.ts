import { IsMongoId, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateResourceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  description: string;

  @IsMongoId({ message: 'subjectId must be a valid MongoDB ObjectId' })
  subjectId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  subjectName: string;
}
