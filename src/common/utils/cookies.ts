import { Response } from 'express';

export interface AuthResult {
  AccessToken?: string;
  IdToken?: string;
  RefreshToken?: string;
}

const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  signed: true,
  maxAge: 3600000, // 1 hour for Access/Id
};

const REFRESH_COOKIE_MAX_AGE = 30 * 24 * 3600000; // 30 days

export function setAuthCookies(res: Response, authResult: AuthResult): void {
  if (authResult.AccessToken) {
    res.cookie('ACCESS_TOKEN', authResult.AccessToken, AUTH_COOKIE_OPTIONS);
  }

  if (authResult.IdToken) {
    res.cookie('ID_TOKEN', authResult.IdToken, AUTH_COOKIE_OPTIONS);
  }

  if (authResult.RefreshToken) {
    res.cookie('REFRESH_TOKEN', authResult.RefreshToken, {
      ...AUTH_COOKIE_OPTIONS,
      maxAge: REFRESH_COOKIE_MAX_AGE,
    });
  }
}
