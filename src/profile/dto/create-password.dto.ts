import { IsString, MinLength } from 'class-validator';

export class CreatePasswordDto {
  @IsString()
  @MinLength(8, { message: 'New password must be at least 8 characters' })
  newPassword: string;
}
