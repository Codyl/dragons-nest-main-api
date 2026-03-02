import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleCredentialDto {
  @IsString()
  @IsNotEmpty({ message: 'Credential is required' })
  credential: string;
}
