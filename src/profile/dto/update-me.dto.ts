import { User } from 'src/users/entities/user.schema';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateMeDto implements Partial<User> {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  given_name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
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
