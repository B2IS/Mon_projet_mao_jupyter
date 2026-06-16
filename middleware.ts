import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { canAccess, SESSION_COOKIE } from '@/lib/authTypes';
import type { RoleCode } from '@/lib/authTypes';
import { getJwtSecretKey, JWT_ISSUER, JWT_AUDIENCE } from '@/lib/authSecret';

const PUBLIC_PREFIXES = ['/login', '/api/', '/_next/', '/favicon', '/icons/', '/images/'];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(p => pathname.startsWith(p)) || pathname === '/';
}

function redirectLogin(request: NextRequest, returnUrl?: string): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  if (returnUrl) url.searchParams.set('returnUrl', returnUrl);
  url.search = returnUrl ? url.search : '';
  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname) || pathname.includes('.')) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return redirectLogin(request, pathname);

  // Verify JWT signature — rejects tampered or expired tokens
  let role: RoleCode | undefined;
  try {
    const { payload } = await jwtVerify(token, getJwtSecretKey(), {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    role = payload.role as RoleCode | undefined;
  } catch {
    const res = redirectLogin(request, pathname);
    res.cookies.set({ name: SESSION_COOKIE, value: '', maxAge: 0, path: '/' });
    return res;
  }

  if (!role) return redirectLogin(request, pathname);
  if (role === 'ADMIN' || role === 'AUDIT') return NextResponse.next();
  if (!canAccess(role, pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/tableau-de-bord';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
