import * as crypto from 'crypto';

const HEADER = { alg: 'HS256', typ: 'JWT' };
const ENCODING = 'base64url';

function encodePayload(obj: object): string {
  return Buffer.from(JSON.stringify(obj), 'utf8').toString(ENCODING);
}

function decodePayload(payloadB64: string): Record<string, unknown> | null {
  try {
    const json = Buffer.from(payloadB64, ENCODING).toString('utf8');
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Sign a passkey session JWT with sub claim. Uses HS256.
 */
export function signPasskeySession(
  sub: string,
  secret: string,
  expiresInSeconds: number,
): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub,
    iat: now,
    exp: now + expiresInSeconds,
  };
  const headerB64 = encodePayload(HEADER);
  const payloadB64 = encodePayload(payload);
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest(ENCODING);
  return `${headerB64}.${payloadB64}.${signature}`;
}

/**
 * Verify and decode a passkey session JWT. Returns payload with sub or null if invalid/expired.
 */
export function verifyPasskeySession(
  token: string,
  secret: string,
): { sub: string } | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signature] = parts;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest(ENCODING);
  if (signature !== expectedSignature) return null;

  const payload = decodePayload(payloadB64);
  if (!payload || typeof payload.sub !== 'string') return null;

  const exp = payload.exp as number | undefined;
  if (exp != null && Math.floor(Date.now() / 1000) > exp) return null;

  return { sub: payload.sub };
}

export const PASSKEY_SESSION_COOKIE_NAME = 'PASSKEY_SESSION';
export const PASSKEY_SESSION_MAX_AGE_SECONDS = 60 * 60; // 1 hour
