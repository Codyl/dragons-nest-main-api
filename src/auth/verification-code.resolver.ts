import { Injectable } from '@nestjs/common';

export type VerificationFlow =
  | 'signup'
  | 'forgot_password'
  | 'account_recovery';

export interface VerificationCodeResolver {
  resolve(codeFromClient: string, flow: VerificationFlow): Promise<string>;
}

export const VERIFICATION_CODE_RESOLVER = Symbol('VERIFICATION_CODE_RESOLVER');

@Injectable()
export class DefaultVerificationCodeResolver implements VerificationCodeResolver {
  resolve(codeFromClient: string, flow: VerificationFlow): Promise<string> {
    void flow;
    return Promise.resolve(codeFromClient);
  }
}
