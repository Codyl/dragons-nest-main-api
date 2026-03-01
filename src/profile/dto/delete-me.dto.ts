import { IsString, MinLength } from 'class-validator';

export class DeleteMeDto {
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password: string;
}
