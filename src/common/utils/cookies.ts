import { Response } from 'express';
import {
  PASSKEY_SESSION_COOKIE_NAME,
  PASSKEY_SESSION_MAX_AGE_SECONDS,
  signPasskeySession,
} from './passkey-jwt';

export interface AuthResult {
  AccessToken?: string;
  IdToken?: string;
  RefreshToken?: string;
}

export interface SetAuthCookiesOptions {
  secure?: boolean;
}

const REFRESH_COOKIE_MAX_AGE = 30 * 24 * 3600000; // 30 days

function getAuthCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    secure,
    sameSite: 'strict' as const,
    signed: true,
    maxAge: 3600000, // 1 hour for Access/Id
  };
}

export function setAuthCookies(
  res: Response,
  authResult: AuthResult,
  options?: SetAuthCookiesOptions,
): void {
  const secure = options?.secure ?? false;
  const authCookieOptions = getAuthCookieOptions(secure);

  if (authResult.AccessToken) {
    res.cookie('ACCESS_TOKEN', authResult.AccessToken, authCookieOptions);
  }

  if (authResult.IdToken) {
    res.cookie('ID_TOKEN', authResult.IdToken, authCookieOptions);
  }

  if (authResult.RefreshToken) {
    res.cookie('REFRESH_TOKEN', authResult.RefreshToken, {
      ...authCookieOptions,
      maxAge: REFRESH_COOKIE_MAX_AGE,
    });
  }
}

export interface SetPasskeySessionOptions {
  secure?: boolean;
  jwtSecret: string;
}

export function setPasskeySessionCookie(
  res: Response,
  sub: string,
  options: SetPasskeySessionOptions,
): void {
  const secure = options?.secure ?? false;
  const token = signPasskeySession(
    sub,
    options.jwtSecret,
    PASSKEY_SESSION_MAX_AGE_SECONDS,
  );
  res.cookie(PASSKEY_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    signed: true,
    maxAge: PASSKEY_SESSION_MAX_AGE_SECONDS * 1000,
  });
}

export function clearPasskeySessionCookie(res: Response): void {
  res.clearCookie(PASSKEY_SESSION_COOKIE_NAME);
}
