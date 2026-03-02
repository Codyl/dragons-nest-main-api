import { IsString, MinLength } from 'class-validator';

export class ConfirmForgotPasswordDto {
  @IsString()
  @MinLength(1, { message: 'Username is required' })
  username: string;

  @IsString()
  @MinLength(1, { message: 'Reset code is required' })
  code: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password: string;
}
