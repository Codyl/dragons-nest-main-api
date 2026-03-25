import {
  DefaultVerificationCodeResolver,
  type VerificationFlow,
} from './verification-code.resolver';

describe('DefaultVerificationCodeResolver', () => {
  let resolver: DefaultVerificationCodeResolver;

  beforeEach(() => {
    resolver = new DefaultVerificationCodeResolver();
  });

  it('returns client code unchanged for signup', async () => {
    await expect(resolver.resolve('123456', 'signup')).resolves.toBe('123456');
  });

  it('returns client code unchanged for forgot_password', async () => {
    await expect(resolver.resolve('654321', 'forgot_password')).resolves.toBe(
      '654321',
    );
  });

  it('preserves empty string', async () => {
    const flows: VerificationFlow[] = ['signup', 'forgot_password'];
    for (const flow of flows) {
      await expect(resolver.resolve('', flow)).resolves.toBe('');
    }
  });
});
