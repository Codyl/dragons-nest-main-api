import { Body, Controller, Post } from '@nestjs/common';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { PasskeyService } from './passkey.service';
import { AccessToken } from 'src/auth/decorators/access-token.decorator';
import { PasskeyVerifyRegistrationDto } from 'src/profile/dto/passkey-verify-registration.dto';

interface MessageDataResponse<T = object> {
  message: string;
  data: T;
}

@Controller('passkey')
export class PasskeyController {
  constructor(private readonly passkeyService: PasskeyService) {}

  @Post('passkey/register/options')
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

  @Post('passkey/register/verify')
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
