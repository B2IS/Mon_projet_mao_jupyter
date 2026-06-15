/**
 * auth.config.ts — Config NextAuth compatible Edge Runtime (middleware)
 * Ne contient PAS les providers qui nécessitent Node.js (Credentials).
 * Importé par middleware.ts ET étendu par auth.ts.
 */
import type { NextAuthConfig } from 'next-auth';
import { canAccess } from '@/lib/authTypes';
import type { RoleCode } from '@/lib/authTypes';

const PUBLIC_PREFIXES = ['/login', '/api/', '/_next/', '/favicon', '/icons/', '/images/'];

function isPublicPath(pathname: string): boolean {
  return (
    pathname === '/' ||
    pathname.includes('.') ||
    PUBLIC_PREFIXES.some(p => pathname.startsWith(p))
  );
}

export default {
  providers: [], // Les providers OAuth/Credentials sont dans auth.ts
  secret: process.env.AUTH_SECRET ?? 'sigepp-authjs-dev-secret-change-in-prod',
  session: { strategy: 'jwt' as const },
  pages: { signIn: '/login' },
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      if (isPublicPath(pathname)) return true;
      if (!auth?.user) return false;

      const role = (auth.user as { role?: RoleCode }).role;
      if (!role || role === 'ADMIN' || role === 'AUDIT') return true;

      // Redirection si le rôle n'a pas accès à la route
      if (!canAccess(role, pathname)) {
        const url = request.nextUrl.clone();
        url.pathname = '/tableau-de-bord';
        url.search = '';
        return Response.redirect(url);
      }
      return true;
    },
  },
} satisfies NextAuthConfig;
