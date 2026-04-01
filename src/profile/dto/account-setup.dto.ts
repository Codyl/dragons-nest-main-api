import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class AccountSetupDto {
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  name!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(150)
  age!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  avatar!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  interests!: string[];

  @IsString()
  @MaxLength(2000)
  shortTermGoal!: string;

  @IsString()
  @MaxLength(2000)
  longTermGoal!: string;

  @IsArray()
  @IsString({ each: true })
  learningStyles!: string[];
}
