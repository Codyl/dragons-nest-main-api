import { ApiProperty } from '@nestjs/swagger';

export class WebAuthnCredentialListItemDto {
  @ApiProperty()
  credentialId: string;

  @ApiProperty()
  displayName: string;

  @ApiProperty()
  provider: string;

  @ApiProperty()
  createdAt: string;

  @ApiProperty({ nullable: true, type: String })
  lastUsedAt: string | null;
}
