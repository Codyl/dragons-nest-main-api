import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class InitiateLoginDto {
  @IsEmail()
  username: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Session is required' })
  session: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Device key is required' })
  @MaxLength(256)
  deviceKey: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Device name is required' })
  @MaxLength(256)
  deviceName: string;
}
