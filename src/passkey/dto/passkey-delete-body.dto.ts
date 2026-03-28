import { IsString, MinLength } from 'class-validator';

export class PasskeyDeleteBodyDto {
  @IsString()
  @MinLength(1, { message: 'credentialId is required' })
  credentialId!: string;
}
