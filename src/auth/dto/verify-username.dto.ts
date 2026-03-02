import { IsEmail } from 'class-validator';

export class VerifyUsernameDto {
  @IsEmail()
  email: string;
}
