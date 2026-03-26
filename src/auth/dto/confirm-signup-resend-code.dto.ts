import { IsEmail } from 'class-validator';

export class ConfirmSignupResendCodeDto {
  @IsEmail()
  username: string;
}
