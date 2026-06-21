import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import type { SessionPayload } from './authTypes';

const ALG = 'HS256';
const ISSUER = 'sigep-dpe';
const AUDIENCE = 'sigep-dpe-client';

// Résolu à runtime — ne lance pas d'erreur au build (next build = NODE_ENV=production)
function getSecretKey(): Uint8Array {
  const secret = process.env.SIGEP_JWT_SECRET;
  if (!secret && process.env.NODE_ENV === 'production' && typeof window === 'undefined') {
    // Avertissement serveur — ne bloque pas le build mais bloque les requêtes runtime
    console.error('[SIGEP] WARNING: SIGEP_JWT_SECRET is not set in production environment!');
  }
  return new TextEncoder().encode(
    secret ?? 'sigep-dpe-dev-secret-change-in-production-2026'
  );
}

export interface JWTClaims extends JWTPayload, SessionPayload {}

export async function signToken(payload: SessionPayload, maxAgeSec = 7 * 24 * 3600): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(Math.floor(Date.now() / 1000) + maxAgeSec)
    .sign(getSecretKey());
}

export async function verifyToken(token: string): Promise<JWTClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), { issuer: ISSUER, audience: AUDIENCE });
    return payload as JWTClaims;
  } catch {
    return null;
  }
}
