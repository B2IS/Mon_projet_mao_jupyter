import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import type { SessionPayload } from './authTypes';
import { getJwtSecretKey, JWT_ISSUER as ISSUER, JWT_AUDIENCE as AUDIENCE } from './authSecret';

const ALG = 'HS256';

export interface JWTClaims extends JWTPayload, SessionPayload {}

export async function signToken(payload: SessionPayload, maxAgeSec = 7 * 24 * 3600): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(Math.floor(Date.now() / 1000) + maxAgeSec)
    .sign(getJwtSecretKey());
}

export async function verifyToken(token: string): Promise<JWTClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecretKey(), { issuer: ISSUER, audience: AUDIENCE });
    return payload as JWTClaims;
  } catch {
    return null;
  }
}
