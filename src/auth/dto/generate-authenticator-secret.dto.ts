import { IsOptional, IsString, MinLength } from 'class-validator';

export class GenerateAuthenticatorSecretDto {
  @IsString()
  @MinLength(1, { message: 'Username is required' })
  username: string;

  @IsString()
  @MinLength(1, { message: 'Session is required' })
  session: string;

  @IsOptional()
  @IsString()
  accessToken?: string;
}
