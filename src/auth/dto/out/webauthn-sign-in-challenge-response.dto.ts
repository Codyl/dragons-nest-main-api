import { ApiPropertyOptional } from '@nestjs/swagger';

export class WebAuthnSignInChallengeResponseDto {
  @ApiPropertyOptional()
  session?: string;

  @ApiPropertyOptional()
  challengeName?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  challengeParameters?: Record<string, string>;

  @ApiPropertyOptional({ type: [String] })
  availableChallenges?: string[];

  /** Present (empty object) when HttpOnly cookies were set. */
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: false,
  })
  authenticationResult?: Record<string, never>;
}
