import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAccountDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  given_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  family_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  middle_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone_number?: string;
}
