import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsArray,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  cognitoSub?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  linkedProviders?: string[];

  @IsOptional()
  @IsBoolean()
  hasPassword?: boolean;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsBoolean()
  deleted?: boolean;
}
