import { Response } from 'express';

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
    sameSite: secure ? ('none' as const) : ('strict' as const),
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
