import { ApiProperty } from '@nestjs/swagger';

export class HealthIndicatorDto {
  @ApiProperty({ example: 'up', enum: ['up', 'down'] })
  status: 'up' | 'down';
}

export class HealthResponseDto {
  @ApiProperty({ example: 'ok', enum: ['ok', 'error', 'shutting_down'] })
  status: 'ok' | 'error' | 'shutting_down';

  @ApiProperty({
    example: {
      cognito: { status: 'up' },
      google: { status: 'up' },
      database: { status: 'up' },
    },
  })
  info: Record<string, HealthIndicatorDto>;

  @ApiProperty({ example: {} })
  error: Record<string, HealthIndicatorDto>;

  @ApiProperty({
    example: {
      cognito: { status: 'up' },
      google: { status: 'up' },
      database: { status: 'up' },
    },
  })
  details: Record<string, HealthIndicatorDto>;
}
