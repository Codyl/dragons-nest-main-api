import { ApiProperty } from '@nestjs/swagger';

export class PasskeyListItemDto {
  @ApiProperty({ description: 'WebAuthn credential id (base64url)' })
  credentialId!: string;

  @ApiProperty({ example: 'iCloud Keychain' })
  displayName!: string;

  @ApiProperty({
    description: 'Hint for client icons / grouping',
    example: 'apple_icloud',
  })
  provider!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  lastUsedAt!: string;
}
