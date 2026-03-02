import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ConnectAuthenticatorAppDto {
  @IsString()
  @MinLength(1, { message: 'Session is required' })
  session: string;

  @IsString()
  @MinLength(1, { message: 'User code is required' })
  userCode: string;

  @IsString()
  @MinLength(1, { message: 'Friendly device name is required' })
  @MaxLength(256)
  friendlyDeviceName: string;

  @IsOptional()
  @IsString()
  accessToken?: string;

  @IsString()
  @MinLength(1, { message: 'Username is required' })
  username: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password: string;
}
