import { IsOptional, IsString, MinLength } from 'class-validator';

export class SetSessionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  AccessToken?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  IdToken?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  RefreshToken?: string;
}
