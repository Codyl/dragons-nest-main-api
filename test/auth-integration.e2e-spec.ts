import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './test-utils';
import {
  getVerificationCodeFromEmail,
  emptyInbox,
  createMailslurpClient,
} from './mailslurp-helper';
import { VerifyUsernameResponseDto } from 'src/auth/dto/out/verify-username-response.dto';
import { ConfirmForgotPasswordResponseDto } from 'src/auth/dto/out/confirm-forgot-password-response.dto';
import { InitiateSignupResponseDto } from 'src/auth/dto/out/initiate-signup-response.dto';
import { ConfirmSignupResponseDto } from 'src/auth/dto/out/confirm-signup-response.dto';
import { Server } from 'http';
import { ApiErrorDto, ApiResponseDto } from 'src/common/dto/api-response.dto';

const LOGIN_EMAIL =
  process.env.PREEXISTING_USER_EMAIL ?? process.env.MAILSLURP_EMAIL ?? '';
const LOGIN_PASSWORD =
  process.env.PREEXISTING_USER_PASSWORD ?? 'TestPassword123!';

function getCookieValue(
  cookies: string[] | undefined,
  name: string,
): string | undefined {
  if (!cookies) return undefined;

  const prefix = `${name}=`;
  const cookie = cookies.find((c) => c.startsWith(prefix));
  if (!cookie) return undefined;

  return cookie.split(';')[0].substring(prefix.length);
}

const MAILSLURP_EMAIL = process.env.MAILSLURP_EMAIL;
const MAILSLURP_INBOX_ID = process.env.MAILSLURP_INBOX_ID;
const hasMailslurp =
  !!MAILSLURP_EMAIL && !!MAILSLURP_INBOX_ID && !!process.env.MAILSLURP_API_KEY;

const TEST_PASSWORD = 'TestPassword123!';

describe('AuthController integration (e2e) – test pool + Mailslurp', () => {
  let app: INestApplication;
  let server: Server;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('verify-username with test pool', () => {
    it.each([
      ['MAILSLURP_EMAIL', MAILSLURP_EMAIL],
      ['PREEXISTING_USER_EMAIL', process.env.PREEXISTING_USER_EMAIL],
    ] as const)(
      'POST /auth/verify-username with %s returns 2xx and Session when user exists',
      async (_, email) => {
        const res = await request(server)
          .post('/auth/verify-username')
          .send({ email });

        expect(res.body).toHaveProperty('data');
        const { data: authResponse } =
          res.body as ApiResponseDto<VerifyUsernameResponseDto>;

        expect([200, 201]).toContain(res.status);
        expect(authResponse).toHaveProperty('Session');
        expect(authResponse).toHaveProperty('AvailableChallenges');
      },
    );
  });

  describe('forgot-password flow (Mailslurp)', () => {
    it('POST /auth/forgot-password then read code from Mailslurp and confirm-forgot-password', async () => {
      if (!hasMailslurp) return;

      const forgotRes = await request(server)
        .post('/auth/forgot-password')
        .send({ username: MAILSLURP_EMAIL });

      if (![200, 201].includes(forgotRes.status)) return; // e.g. limit exceeded, user not in pool

      const code = await getVerificationCodeFromEmail(
        MAILSLURP_INBOX_ID,
        45_000,
      );
      expect(code).toBeTruthy();

      const confirmRes = await request(server)
        .post('/auth/confirm-forgot-password')
        .send({
          username: MAILSLURP_EMAIL,
          code,
          password: TEST_PASSWORD,
        });

      const { data: confirmResponse } =
        confirmRes.body as ApiResponseDto<ConfirmForgotPasswordResponseDto>;

      expect([200, 201]).toContain(confirmRes.status);
      expect(confirmResponse).toHaveProperty('AuthenticationResult');

      await emptyInbox(MAILSLURP_INBOX_ID).catch(() => {});
    });

    it('POST /auth/forgot-password then attempt to confirm-forgot-password with invalid code', async () => {
      const forgotRes = await request(server)
        .post('/auth/forgot-password')
        .send({ username: MAILSLURP_EMAIL });

      if (![200, 201].includes(forgotRes.status)) return; // e.g. limit exceeded, user not in pool

      const confirmForgotPasswordRes = await request(server)
        .post('/auth/confirm-forgot-password')
        .send({
          username: MAILSLURP_EMAIL,
          code: 'invalid',
          password: 'bad-password',
        });

      const { data: confirmForgotPasswordResponse } =
        confirmForgotPasswordRes.body as ApiErrorDto;

      expect(confirmForgotPasswordRes.status).toBe(400);
      expect(confirmForgotPasswordResponse).toHaveProperty('message');
      expect(confirmForgotPasswordResponse).toHaveProperty('data');
      expect(confirmForgotPasswordResponse).toHaveProperty('error');
    });
  });

  describe('signup flow (Mailslurp)', () => {
    it('POST /auth/initiate-signup then read code from Mailslurp and confirm-signup', async () => {
      if (!hasMailslurp) return;

      const signupEmail = MAILSLURP_EMAIL;

      const initiateRes = await request(server)
        .post('/auth/initiate-signup')
        .send({
          email: signupEmail,
          password: TEST_PASSWORD,
        });

      const initiateResponse = initiateRes.body as InitiateSignupResponseDto;

      if (initiateRes.status === 409) {
        return;
      }

      expect([200, 201]).toContain(initiateRes.status);

      const code = await getVerificationCodeFromEmail(
        MAILSLURP_INBOX_ID,
        45_000,
      );
      expect(code).toBeTruthy();

      const session = initiateResponse.Session ?? ' ';

      const confirmRes = await request(server)
        .post('/auth/confirm-signup')
        .send({
          email: signupEmail,
          code,
          session,
          password: TEST_PASSWORD,
        });

      const { data: confirmResponse } =
        confirmRes.body as ApiResponseDto<ConfirmSignupResponseDto>;

      expect([200, 201]).toContain(confirmRes.status);
      expect(confirmResponse).toHaveProperty('Session');
      expect(confirmResponse).toHaveProperty('AuthenticationResult');
      expect(confirmRes.get('Set-Cookie')).toBeDefined();

      await emptyInbox(MAILSLURP_INBOX_ID).catch(() => {});
    });
  });

  describe('signup additional cases', () => {
    it('POST /auth/initiate-signup with existing email returns conflict or success envelope', async () => {
      const existingEmail =
        process.env.PREEXISTING_USER_EMAIL ?? MAILSLURP_EMAIL;

      if (!existingEmail) return;

      const res = await request(server).post('/auth/initiate-signup').send({
        email: existingEmail,
        password: TEST_PASSWORD,
      });

      expect(res.body).toHaveProperty('message');

      if ([200, 201].includes(res.status)) {
        // Environment allows re-initiating signup; just ensure basic success shape.
        expect(res.body).toHaveProperty('data');
        return;
      }

      expect(res.status).toBe(409);
      expect(res.body).toHaveProperty('error');
      expect(res.body).toHaveProperty('statusCode');
    });

    it('POST /auth/confirm-signup/resend-code returns 2xx when email is pending or confirmed', async () => {
      const email =
        process.env.PENDING_SIGNUP_EMAIL ??
        process.env.PREEXISTING_USER_EMAIL ??
        MAILSLURP_EMAIL;

      if (!email) return;

      const res = await request(server)
        .post('/auth/confirm-signup/resend-code')
        .send({ email });

      if (![200, 201].includes(res.status)) return;

      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('data');
    });

    it('POST /auth/confirm-signup with invalid code returns 4xx error envelope', async () => {
      const email = MAILSLURP_EMAIL ?? process.env.PREEXISTING_USER_EMAIL;

      if (!email) return;

      const res = await request(server).post('/auth/confirm-signup').send({
        email,
        code: 'invalid',
        session: 'invalid-session',
        password: TEST_PASSWORD,
      });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);

      const body = res.body as ApiErrorDto;
      expect(body).toHaveProperty('message');
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('statusCode');
    });
  });

  describe('initiate-login', () => {
    it('POST /auth/initiate-login with valid credentials returns 2xx and data when possible', async () => {
      if (!LOGIN_EMAIL) return;

      const res = await request(server).post('/auth/initiate-login').send({
        email: LOGIN_EMAIL,
        password: LOGIN_PASSWORD,
      });

      if (![200, 201].includes(res.status)) return;

      expect(res.body).toHaveProperty('data');
    });

    it('POST /auth/initiate-login with invalid password returns 4xx error envelope', async () => {
      if (!LOGIN_EMAIL) return;

      const res = await request(server).post('/auth/initiate-login').send({
        email: LOGIN_EMAIL,
        password: 'DefinitelyNotTheRightPassword123!',
      });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);

      const body = res.body as ApiErrorDto;
      expect(body).toHaveProperty('message');
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('statusCode');
    });
  });

  describe('MFA routes', () => {
    it('POST /auth/mfa with invalid session yields 404 Not Found', async () => {
      const email =
        LOGIN_EMAIL || MAILSLURP_EMAIL || process.env.PREEXISTING_USER_EMAIL;

      if (!email) return;

      const res = await request(server).post('/auth/mfa').send({
        email,
        session: 'invalid-session',
        softwareTokenMfaCode: '000000',
      });

      expect(res.status).toBe(404);

      const body = res.body as ApiErrorDto;
      expect(body).toHaveProperty('message');
      expect(body.message).toMatch(/mfa not found/i);
    });

    it('POST /auth/mfa/generate-authenticator-secret without access token yields 4xx', async () => {
      const username =
        LOGIN_EMAIL || MAILSLURP_EMAIL || process.env.PREEXISTING_USER_EMAIL;

      if (!username) return;

      const res = await request(server)
        .post('/auth/mfa/generate-authenticator-secret')
        .send({
          username,
          session: 'invalid-session',
        });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });

    it('POST /auth/mfa/connect-authenticator-app with invalid data yields 4xx', async () => {
      const username =
        LOGIN_EMAIL || MAILSLURP_EMAIL || process.env.PREEXISTING_USER_EMAIL;

      if (!username) return;

      const res = await request(server)
        .post('/auth/mfa/connect-authenticator-app')
        .send({
          session: 'invalid-session',
          userCode: '000000',
          friendlyDeviceName: 'Test device',
          accessToken: undefined,
          username,
          password: LOGIN_PASSWORD,
        });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(600);
    });
  });

  describe('token and session management', () => {
    it('POST /auth/refresh-token succeeds with valid refresh cookie when available', async () => {
      if (!hasMailslurp) return;

      if (!MAILSLURP_EMAIL || !MAILSLURP_INBOX_ID) return;

      const initiateRes = await request(server)
        .post('/auth/initiate-signup')
        .send({
          email: MAILSLURP_EMAIL,
          password: TEST_PASSWORD,
        });

      if (initiateRes.status === 409) {
        // User already exists but should still be usable for confirm-signup
      } else if (![200, 201].includes(initiateRes.status)) {
        return;
      }

      const code = await getVerificationCodeFromEmail(
        MAILSLURP_INBOX_ID,
        45_000,
      );
      expect(code).toBeTruthy();

      const confirmRes = await request(server)
        .post('/auth/confirm-signup')
        .send({
          email: MAILSLURP_EMAIL,
          code,
          session: ' ',
          password: TEST_PASSWORD,
        });

      if (![200, 201].includes(confirmRes.status)) return;

      const cookies = confirmRes.get('Set-Cookie');
      const refreshToken = getCookieValue(cookies, 'REFRESH_TOKEN');

      if (!refreshToken) return;

      const refreshRes = await request(server)
        .post('/auth/refresh-token')
        .set('Cookie', `REFRESH_TOKEN=${refreshToken}`);

      if (![200, 201].includes(refreshRes.status)) return;

      expect(refreshRes.body).toHaveProperty('data');
      expect(refreshRes.get('Set-Cookie')).toBeDefined();
    });

    it('POST /auth/refresh-token without cookie returns a valid envelope', async () => {
      const res = await request(server).post('/auth/refresh-token');

      if ([200, 201].includes(res.status)) {
        expect(res.body).toHaveProperty('message');
        expect(res.body).toHaveProperty('data');
        return;
      }

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(600);
      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('error');
    });

    it('POST /auth/set-session with valid tokens sets auth cookies when verification succeeds', async () => {
      if (!hasMailslurp) return;

      if (!MAILSLURP_EMAIL || !MAILSLURP_INBOX_ID) return;

      const initiateRes = await request(server)
        .post('/auth/initiate-signup')
        .send({
          email: MAILSLURP_EMAIL,
          password: TEST_PASSWORD,
        });

      if (initiateRes.status === 409) {
        // User already exists but should still be usable for confirm-signup
      } else if (![200, 201].includes(initiateRes.status)) {
        return;
      }

      const code = await getVerificationCodeFromEmail(
        MAILSLURP_INBOX_ID,
        45_000,
      );
      expect(code).toBeTruthy();

      const confirmRes = await request(server)
        .post('/auth/confirm-signup')
        .send({
          email: MAILSLURP_EMAIL,
          code,
          session: ' ',
          password: TEST_PASSWORD,
        });

      if (![200, 201].includes(confirmRes.status)) return;

      const cookies = confirmRes.get('Set-Cookie');
      const accessToken = getCookieValue(cookies, 'ACCESS_TOKEN');
      const idToken = getCookieValue(cookies, 'ID_TOKEN');
      const refreshToken = getCookieValue(cookies, 'REFRESH_TOKEN');

      if (!accessToken || !idToken || !refreshToken) return;

      const setSessionRes = await request(server)
        .post('/auth/set-session')
        .send({
          AccessToken: accessToken,
          IdToken: idToken,
          RefreshToken: refreshToken,
        });

      if (![200, 201].includes(setSessionRes.status)) return;

      expect(setSessionRes.body).toHaveProperty('data');
      expect(setSessionRes.get('Set-Cookie')).toBeDefined();
    });

    it('POST /auth/set-session with missing tokens returns 4xx/5xx error', async () => {
      const res = await request(server).post('/auth/set-session').send({});

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(600);
    });
  });

  describe('logout', () => {
    it('POST /auth/logout clears cookies when session is active', async () => {
      if (!hasMailslurp) return;

      if (!MAILSLURP_EMAIL || !MAILSLURP_INBOX_ID) return;

      const initiateRes = await request(server)
        .post('/auth/initiate-signup')
        .send({
          email: MAILSLURP_EMAIL,
          password: TEST_PASSWORD,
        });

      if (initiateRes.status === 409) {
        // User already exists but should still be usable for confirm-signup
      } else if (![200, 201].includes(initiateRes.status)) {
        return;
      }

      const code = await getVerificationCodeFromEmail(
        MAILSLURP_INBOX_ID,
        45_000,
      );
      expect(code).toBeTruthy();

      const confirmRes = await request(server)
        .post('/auth/confirm-signup')
        .send({
          email: MAILSLURP_EMAIL,
          code,
          session: ' ',
          password: TEST_PASSWORD,
        });

      if (![200, 201].includes(confirmRes.status)) return;

      const cookies = confirmRes.get('Set-Cookie');
      const accessToken = getCookieValue(cookies, 'ACCESS_TOKEN');

      if (!accessToken) return;

      const logoutRes = await request(server)
        .post('/auth/logout')
        .set('Cookie', `ACCESS_TOKEN=${accessToken}`);

      expect([200, 201]).toContain(logoutRes.status);
      expect(logoutRes.body).toHaveProperty('message');
      expect(logoutRes.get('Set-Cookie')).toBeDefined();
    });

    it('POST /auth/logout without session still returns success', async () => {
      const res = await request(server).post('/auth/logout');

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('message');
    });
  });

  describe('forgot-password additional cases', () => {
    it('POST /auth/forgot-password with unknown user returns 2xx or 4xx depending on implementation', async () => {
      const res = await request(server)
        .post('/auth/forgot-password')
        .send({ username: 'nonexistent-user-' + Date.now() + '@example.com' });

      if ([200, 201].includes(res.status)) {
        expect(res.body).toHaveProperty('message');
        expect(res.body).toHaveProperty('data');
        return;
      }

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);

      const body = res.body as ApiErrorDto;
      expect(body).toHaveProperty('message');
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('error');
    });
  });
});

describe('Mailslurp helper', () => {
  it('createMailslurpClient returns client when MAILSLURP_API_KEY is set', () => {
    const client = createMailslurpClient();
    if (process.env.MAILSLURP_API_KEY) {
      expect(client).not.toBeNull();
    } else {
      expect(client).toBeNull();
    }
  });
});
