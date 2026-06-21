/**
 * middleware.ts — Auth.js v5 middleware SIGEP-DPE
 * Utilise auth.config.ts (Edge-compatible, sans Node.js APIs).
 * La logique RBAC (canAccess) est dans le callback `authorized` de auth.config.ts.
 *
 * Compatibilité ascendante : l'ancien cookie sigep_session est toujours accepté
 * comme fallback pendant la période de transition (voir bloc legacy ci-dessous).
 */
import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import authConfig from './auth.config';

const { auth } = NextAuth(authConfig);

// ── Fallback legacy : si pas de session NextAuth, vérifier l'ancien JWT ──────
// Conservé pour les sessions existantes (cookie sigep_session) qui n'ont pas
// encore été ré-authentifiées via Auth.js.
import { jwtVerify } from 'jose';
import { SESSION_COOKIE, canAccess } from '@/lib/authTypes';
import type { RoleCode, SessionPayload } from '@/lib/authTypes';

// Secret résolu à runtime (pas au build) — évite l'échec du `next build` sans env
function getSecretKey(): Uint8Array {
  const secret = process.env.SIGEP_JWT_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('[SIGEP] SIGEP_JWT_SECRET must be set in production. Refusing to process request without secret.');
  }
  return new TextEncoder().encode(secret ?? 'sigep-dpe-dev-secret-change-in-production-2026');
}

// Routes statiques et auth : toujours publiques
const PUBLIC_PREFIXES = ['/login', '/_next/', '/favicon', '/icons/', '/images/'];

// Routes API qui ne nécessitent PAS de session middleware
// (ouvertes par design — les routes protégées ont requireApiAuth() dans leur handler)
const PUBLIC_API_ROUTES = [
  '/api/auth/',       // Auth.js callbacks (OAuth, credentials, /auth/me)
];

function isPublicPath(pathname: string): boolean {
  if (pathname === '/' || pathname.includes('.')) return true;
  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) return true;
  // API : laisser passer uniquement les routes explicitement publiques
  if (pathname.startsWith('/api/')) {
    return PUBLIC_API_ROUTES.some(p => pathname.startsWith(p));
  }
  return false;
}

export default auth(async (req) => {
  const { pathname } = req.nextUrl;

  // Routes publiques : toujours laisser passer
  if (isPublicPath(pathname)) return NextResponse.next();

  // Auth.js session présente → déjà validée par le callback `authorized`
  if (req.auth?.user) return NextResponse.next();

  // ── Fallback legacy JWT ──────────────────────────────────────────────────
  const legacyToken = (req as unknown as NextRequest).cookies.get(SESSION_COOKIE)?.value;
  if (legacyToken) {
    try {
      const { payload } = await jwtVerify(legacyToken, getSecretKey(), {
        issuer: 'sigep-dpe',
        audience: 'sigep-dpe-client',
      });
      const session = payload as unknown as SessionPayload;
      const role = session.role as RoleCode;

      // RBAC pages : canAccess() est conçu pour les routes UI, pas /api/*.
      // Les routes API ont leur propre RBAC via requireApiAuth(req, allowedRoles).
      if (!pathname.startsWith('/api/') && role && role !== 'ADMIN' && role !== 'AUDIT') {
        if (!canAccess(role, pathname)) {
          return NextResponse.redirect(new URL('/tableau-de-bord', req.url));
        }
      }

      // Token legacy valide et accès autorisé
      return NextResponse.next();
    } catch {
      // Token invalide ou expiré → supprimer et rediriger vers login
      const res = NextResponse.redirect(new URL(`/login?returnUrl=${encodeURIComponent(pathname)}`, req.url));
      res.cookies.set({ name: SESSION_COOKIE, value: '', maxAge: 0, path: '/' });
      return res;
    }
  }

  // Aucune session → rediriger vers login
  return NextResponse.redirect(new URL(`/login?returnUrl=${encodeURIComponent(pathname)}`, req.url));
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
