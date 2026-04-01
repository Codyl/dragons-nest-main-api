import { ApiProperty } from '@nestjs/swagger';

export class FirstLoginResponseDto {
  @ApiProperty({
    description: 'ISO 8601 timestamp when first in-app login was recorded',
  })
  firstLoggedInAt!: string;
}
