import { IsNotEmpty, IsString } from 'class-validator';

export class LinkGoogleDto {
  @IsString()
  @IsNotEmpty({ message: 'Credential is required' })
  credential: string;
}
