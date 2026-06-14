import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { canAccess, SESSION_COOKIE } from '@/lib/authTypes';
import type { RoleCode, SessionPayload } from '@/lib/authTypes';

// Chemins publics — pas de vérification d'auth
const PUBLIC_PREFIXES = ['/login', '/api/', '/_next/', '/favicon', '/icons/', '/images/'];

// Chemins dashboard connus — tout ce qui n'est pas public
// On protège tout sauf les PUBLIC_PREFIXES ci-dessus.

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(p => pathname.startsWith(p)) || pathname === '/';
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Laisser passer les ressources statiques et chemins publics
  if (isPublic(pathname) || pathname.includes('.')) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value;

  // Pas de session → login (avec returnUrl)
  if (!sessionCookie) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('returnUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Décoder la session
  let payload: SessionPayload | null = null;
  try {
    payload = JSON.parse(decodeURIComponent(sessionCookie)) as SessionPayload;
  } catch {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  const role = payload?.role as RoleCode | undefined;
  if (!role) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  // ADMIN et AUDIT ont accès à tout (wildcard '*' dans ROLE_ROUTES)
  if (role === 'ADMIN' || role === 'AUDIT') {
    return NextResponse.next();
  }

  // Vérification RBAC — le pathname correspond aux routes SIGEPP
  // (ex. /tableau-de-bord, /projets, /budget…)
  if (!canAccess(role, pathname)) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = '/tableau-de-bord';
    homeUrl.search = '';
    return NextResponse.redirect(homeUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Appliquer le middleware sur toutes les routes sauf les ressources statiques Next.js
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
