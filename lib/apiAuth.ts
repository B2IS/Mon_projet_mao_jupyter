/**
 * lib/apiAuth.ts — Garde d'authentification pour les routes API
 *
 * Usage dans une route :
 *   const guard = await requireApiAuth(req);
 *   if (!guard.ok) return guard.response;
 */
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { SESSION_COOKIE } from '@/lib/authTypes';
import type { RoleCode } from '@/lib/authTypes';
import { auth } from '@/auth';

export interface AuthGuard {
  ok: true;
  userId: string;
  role: RoleCode;
  email: string;
}
export interface AuthGuardFail {
  ok: false;
  response: NextResponse;
}

export async function requireApiAuth(
  _req?: NextRequest,
  allowedRoles?: RoleCode[],
): Promise<AuthGuard | AuthGuardFail> {
  // ── Voie 1 : JWT custom sigep_session ─────────────────────────────────────
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    const payload = await verifyToken(token);
    if (payload) {
      const role = payload.role as RoleCode;
      if (allowedRoles && !allowedRoles.includes(role)) {
        return { ok: false, response: NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 }) };
      }
      return { ok: true, userId: String(payload.id ?? ''), role, email: String(payload.email ?? '') };
    }
  }

  // ── Voie 2 : session Auth.js (NextAuth v5) ─────────────────────────────────
  try {
    const session = await auth();
    const u = session?.user as { id?: string; role?: RoleCode; email?: string } | undefined;
    if (u?.role) {
      const role = u.role;
      if (allowedRoles && !allowedRoles.includes(role)) {
        return { ok: false, response: NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 }) };
      }
      return { ok: true, userId: String(u.id ?? ''), role, email: String(u.email ?? '') };
    }
  } catch { /* auth() peut échouer en edge — ignoré */ }

  return { ok: false, response: NextResponse.json({ error: 'Non authentifié.' }, { status: 401 }) };
}

// ── Rate Limiter en mémoire ────────────────────────────────────────────────────
// Adapté pour un seul processus Node (serverless : chaque instance a son compteur,
// ce qui suffit pour ralentir les attaques distribuées sans Redis).
interface BucketEntry { count: number; resetAt: number }
const buckets = new Map<string, BucketEntry>();

export interface RateLimitOptions {
  max: number;        // tentatives max dans la fenêtre
  windowMs: number;   // durée de la fenêtre en ms
}

export function checkRateLimit(key: string, opts: RateLimitOptions): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  let entry = buckets.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + opts.windowMs };
    buckets.set(key, entry);
  }
  entry.count++;
  const allowed = entry.count <= opts.max;
  const remaining = Math.max(0, opts.max - entry.count);

  // Nettoyage périodique (évite la fuite mémoire)
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) {
      if (now > v.resetAt) buckets.delete(k);
    }
  }

  return { allowed, remaining, resetAt: entry.resetAt };
}

export function rateLimitResponse(resetAt: number): NextResponse {
  const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
  return NextResponse.json(
    { error: `Trop de tentatives. Réessayez dans ${retryAfter}s.` },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Limit': '10',
        'X-RateLimit-Remaining': '0',
      },
    },
  );
}

// ── Validation helpers ────────────────────────────────────────────────────────
const EMAIL_RE = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

export function isValidEmail(email: unknown): email is string {
  return typeof email === 'string' && EMAIL_RE.test(email) && email.length <= 254;
}

export function isValidPassword(pwd: unknown): pwd is string {
  return typeof pwd === 'string' && pwd.length >= 4 && pwd.length <= 128;
}

export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}
