import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import type { RoleCode, SessionPayload } from './authTypes';

const _jwtSecret = process.env.SIGEPP_JWT_SECRET;
if (!_jwtSecret && process.env.NODE_ENV === 'production') {
  throw new Error('[SIGEPP] SIGEPP_JWT_SECRET must be set in production.');
}
const SECRET_KEY = new TextEncoder().encode(
  _jwtSecret ?? 'sigepp-dpe-dev-secret-change-in-production-2026'
);

const ALG = 'HS256';
const ISSUER = 'sigepp-dpe';
const AUDIENCE = 'sigepp-dpe-client';

export interface JWTClaims extends JWTPayload, SessionPayload {}

export async function signToken(payload: SessionPayload, maxAgeSec = 7 * 24 * 3600): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(Math.floor(Date.now() / 1000) + maxAgeSec)
    .sign(SECRET_KEY);
}

export async function verifyToken(token: string): Promise<JWTClaims | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY, { issuer: ISSUER, audience: AUDIENCE });
    return payload as JWTClaims;
  } catch {
    return null;
  }
}
