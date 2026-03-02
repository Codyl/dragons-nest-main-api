import { IsEmail, IsString, MinLength } from 'class-validator';

export class VerifyUsernameDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password: string;
}
