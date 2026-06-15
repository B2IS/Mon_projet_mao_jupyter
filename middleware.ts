/**
 * middleware.ts — Auth.js v5 middleware SIGEPP-DPE
 * Utilise auth.config.ts (Edge-compatible, sans Node.js APIs).
 * La logique RBAC (canAccess) est dans le callback `authorized` de auth.config.ts.
 *
 * Compatibilité ascendante : l'ancien cookie sigepp_session est toujours accepté
 * comme fallback pendant la période de transition (voir bloc legacy ci-dessous).
 */
import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import authConfig from './auth.config';

const { auth } = NextAuth(authConfig);

// ── Fallback legacy : si pas de session NextAuth, vérifier l'ancien JWT ──────
// Conservé pour les sessions existantes (cookie sigepp_session) qui n'ont pas
// encore été ré-authentifiées via Auth.js.
import { jwtVerify } from 'jose';
import { SESSION_COOKIE } from '@/lib/authTypes';

const SECRET_KEY = new TextEncoder().encode(
  process.env.SIGEPP_JWT_SECRET ?? 'sigepp-dpe-dev-secret-change-in-production-2026'
);

const PUBLIC_PREFIXES = ['/login', '/api/', '/_next/', '/favicon', '/icons/', '/images/'];

function isPublicPath(pathname: string): boolean {
  return (
    pathname === '/' ||
    pathname.includes('.') ||
    PUBLIC_PREFIXES.some(p => pathname.startsWith(p))
  );
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
      await jwtVerify(legacyToken, SECRET_KEY, {
        issuer: 'sigepp-dpe',
        audience: 'sigepp-dpe-client',
      });
      // Token legacy valide → laisser passer (l'authStore hydrate depuis /api/auth/me)
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
