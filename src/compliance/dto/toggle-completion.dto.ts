import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';

export class ToggleCompletionDto {
  @IsString()
  @IsNotEmpty()
  state: string;

  @IsString()
  @IsNotEmpty()
  managedUserId: string;

  @IsString()
  @IsNotEmpty()
  itemKey: string;

  @IsBoolean()
  completed: boolean;
}
