import { User } from 'src/users/entities/user.schema';
import {
  IsString,
  IsObject,
  IsBoolean,
  IsEmail,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class LinkedProviderSubjects {
  @IsString()
  @IsOptional()
  GOOGLE?: string;
}

export class GetMeDto implements Partial<User> {
  @IsString()
  @IsOptional()
  cognitoSub?: string;
  @IsString({ each: true })
  @IsOptional()
  linkedProviders?: string[];
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => LinkedProviderSubjects)
  linkedProviderSubjects?: LinkedProviderSubjects;
  @IsBoolean()
  hasPassword?: boolean;
  @IsEmail()
  email?: string;
}
