import { ApiProperty } from '@nestjs/swagger';

/** Response data for POST /profile/account-setup */
export class AccountSetupResponseDto {
  @ApiProperty({
    description: 'ISO timestamp when onboarding data was persisted.',
  })
  onboardingCompletedAt!: string;
}
