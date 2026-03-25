import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { PasskeyService } from './passkey.service';
import { AccessToken } from 'src/auth/decorators/access-token.decorator';
import { PasskeyVerifyRegistrationDto } from 'src/passkey/dto/passkey-verify-registration.dto';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { ApiOperation } from '@nestjs/swagger';

interface MessageDataResponse<T = object> {
  message: string;
  data: T;
}

@Controller('profile/passkey')
@UseGuards(AuthGuard)
export class PasskeyController {
  constructor(private readonly passkeyService: PasskeyService) {}

  @ApiOperation({
    summary: 'Gets the passkey registration options for the logged in user',
  })
  @Post('register/options')
  async passkeyRegisterOptions(
    @AccessToken() accessToken: string,
    @CurrentUser() user: Record<string, unknown> & { sub?: string },
  ): Promise<
    MessageDataResponse<
      Awaited<ReturnType<PasskeyService['getRegistrationOptions']>>
    >
  > {
    const sub = user?.sub;
    if (!sub || typeof sub !== 'string') {
      throw new Error('Not authenticated');
    }

    const options = await this.passkeyService.getRegistrationOptions(
      accessToken,
      sub,
    );
    return {
      message: 'Registration options',
      data: options,
    };
  }

  @ApiOperation({
    summary: 'Verifies the passkey registration for the logged in user',
    description:
      "Verifies the passkey registration for the logged in user by verifying the passkey and returning the result. This is used to register the passkey with the user's account.",
  })
  @Post('register/verify')
  async passkeyRegisterVerify(
    @CurrentUser() user: Record<string, unknown> & { sub?: string },
    @Body() dto: PasskeyVerifyRegistrationDto,
  ): Promise<MessageDataResponse<{ verified: boolean }>> {
    const sub = user?.sub;
    if (!sub || typeof sub !== 'string') {
      throw new Error('Not authenticated');
    }

    const result = await this.passkeyService.verifyRegistration(sub, dto);
    return {
      message: result.verified
        ? 'Passkey registered successfully'
        : 'Passkey verification failed',
      data: { verified: result.verified },
    };
  }
}
