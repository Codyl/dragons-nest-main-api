import { IsNotEmpty, IsString } from 'class-validator';

export class GetCompletionQueryDto {
  @IsString()
  @IsNotEmpty()
  state: string;

  @IsString()
  @IsNotEmpty()
  managedUserId: string;
}
