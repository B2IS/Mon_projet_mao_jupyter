/**
 * auth.ts — Configuration NextAuth v5 (Auth.js) SIGEP-DPE
 * Flow : Utilisateur → Microsoft Entra ID → Auth.js → Supabase PostgreSQL
 *
 * Providers :
 *   1. Credentials  — email/password (comptes demo + domaines SENELEC)
 *   2. Microsoft Entra ID — SSO entreprise (Azure AD / M365)
 *
 * Session strategy : JWT (pas de DB requise pour les sessions)
 * Supabase : stockage profils RBAC des utilisateurs SSO
 */
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';
import authConfig from './auth.config';
import { findUser, TEST_USERS } from '@/lib/usersDb';
import { getUserRoleFromSupabase, upsertSupabaseUser } from '@/lib/supabase';
import type { RoleCode } from '@/lib/authTypes';

const TRUSTED_DOMAINS = ['@dpe.sn', '@senelec.sn'];

function isTrustedEmail(email: string): boolean {
  const e = email.toLowerCase();
  return TRUSTED_DOMAINS.some(d => e.endsWith(d));
}

/** Résout le profil RBAC pour un email :
 *  1. usersDb (comptes demo/officiels)
 *  2. Supabase sigep_users (comptes SSO onboardés)
 *  3. Fallback domaine de confiance → INGENIEUR
 */
async function resolveProfile(email: string) {
  const emailLow = email.toLowerCase();

  // 1. Base locale
  const local = TEST_USERS.find(u => u.email.toLowerCase() === emailLow);
  if (local) return {
    id: local.id,
    email: local.email,
    role: local.role,
    direction: local.direction,
    initials: local.initials,
    avatarColor: local.avatarColor,
    prenom: local.prenom,
    nom: local.nom,
    poste: (local as { poste?: string }).poste,
    departement: (local as { departement?: string }).departement,
    cellule: (local as { cellule?: string }).cellule,
  };

  // 2. Supabase
  const sb = await getUserRoleFromSupabase(emailLow);
  if (sb) return {
    id: emailLow,
    email: emailLow,
    role: sb.role,
    direction: sb.direction,
    initials: sb.initials ?? emailLow.substring(0, 2).toUpperCase(),
    avatarColor: sb.avatar_color ?? '#374151',
    prenom: sb.prenom,
    nom: sb.nom,
    poste: sb.poste,
    departement: sb.departement,
    cellule: sb.cellule,
  };

  // 3. Fallback domaine de confiance
  if (isTrustedEmail(emailLow)) {
    const parts = emailLow.split('@')[0].split('.');
    return {
      id: emailLow,
      email: emailLow,
      role: 'INGENIEUR' as RoleCode,
      direction: 'DPE',
      initials: parts.map(p => p[0]?.toUpperCase() ?? '').join('').slice(0, 2),
      avatarColor: '#374151',
      prenom: parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) : '',
      nom: parts[1]?.toUpperCase() ?? '',
      poste: undefined,
      departement: undefined,
      cellule: undefined,
    };
  }

  return null;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,

  providers: [
    // ── 1. Credentials (email + password) ───────────────────────────────────
    Credentials({
      id: 'credentials',
      name: 'Email / Mot de passe',
      credentials: {
        email:    { label: 'Email', type: 'email' },
        password: { label: 'Mot de passe', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const emailLow = (credentials.email as string).trim().toLowerCase();
        const pwd      = (credentials.password as string).trim();

        // Vérifie email+password dans usersDb
        const found = findUser(emailLow, pwd);

        // Fallback : domaine de confiance → DIR_DPE legacy (comportement actuel)
        const sessionUser = found ?? (isTrustedEmail(emailLow)
          ? TEST_USERS.find(u => u.email.toLowerCase() === emailLow) // déjà dans TEST_USERS sans mot de passe connu ?
          : null
        );

        if (!sessionUser) return null;

        return {
          id: sessionUser.id,
          email: sessionUser.email,
          name: `${sessionUser.prenom} ${sessionUser.nom}`,
          role: sessionUser.role,
          direction: sessionUser.direction,
          initials: sessionUser.initials,
          avatarColor: sessionUser.avatarColor,
          prenom: sessionUser.prenom,
          nom: sessionUser.nom,
          poste: (sessionUser as { poste?: string }).poste,
          departement: (sessionUser as { departement?: string }).departement,
          cellule: (sessionUser as { cellule?: string }).cellule,
        };
      },
    }),

    // ── 2. Microsoft Entra ID (Azure AD / M365) ──────────────────────────────
    MicrosoftEntraID({
      clientId:     process.env.MICROSOFT_ENTRA_ID_CLIENT_ID     ?? '',
      clientSecret: process.env.MICROSOFT_ENTRA_ID_CLIENT_SECRET ?? '',
      issuer: process.env.MICROSOFT_ENTRA_ID_TENANT_ID
        ? `https://login.microsoftonline.com/${process.env.MICROSOFT_ENTRA_ID_TENANT_ID}/v2.0`
        : 'https://login.microsoftonline.com/common/v2.0',
      authorization: {
        params: { scope: 'openid profile email User.Read' },
      },
    }),

  ],

  session: { strategy: 'jwt' },

  callbacks: {
    // ── signIn : bloquer les emails non autorisés pour les providers OAuth ──
    async signIn({ user, account }) {
      if (account?.provider === 'credentials') return true;

      const email = user.email ?? '';
      const profile = await resolveProfile(email);
      if (!profile) return '/login?error=AccessDenied';

      // Crée/met à jour le profil dans Supabase pour les SSO onboardés
      if (account?.provider) {
        await upsertSupabaseUser({
          email: profile.email,
          role: profile.role,
          direction: profile.direction,
          prenom: profile.prenom,
          nom: profile.nom,
          initials: profile.initials,
          avatar_color: profile.avatarColor,
          poste: profile.poste,
          departement: profile.departement,
          cellule: profile.cellule,
        });
      }

      return true;
    },

    // ── jwt : enrichit le token avec les données RBAC ─────────────────────
    async jwt({ token, user, account }) {
      // Premier sign-in : `user` est défini
      if (user) {
        token.role        = (user as { role?: RoleCode }).role;
        token.direction   = (user as { direction?: string }).direction;
        token.initials    = (user as { initials?: string }).initials;
        token.avatarColor = (user as { avatarColor?: string }).avatarColor;
        token.prenom      = (user as { prenom?: string }).prenom;
        token.nom         = (user as { nom?: string }).nom;
        token.poste       = (user as { poste?: string }).poste;
        token.departement = (user as { departement?: string }).departement;
        token.cellule     = (user as { cellule?: string }).cellule;
      }

      // Pour les providers OAuth, résoudre le profil depuis usersDb/Supabase
      if (account?.provider && account.provider !== 'credentials' && !token.role) {
        const profile = await resolveProfile(token.email ?? '');
        if (profile) {
          token.role        = profile.role;
          token.direction   = profile.direction;
          token.initials    = profile.initials;
          token.avatarColor = profile.avatarColor;
          token.prenom      = profile.prenom;
          token.nom         = profile.nom;
          token.poste       = profile.poste;
          token.departement = profile.departement;
          token.cellule     = profile.cellule;
        }
      }

      return token;
    },

    // ── session : expose les données RBAC dans la session client ─────────
    session({ session, token }) {
      session.user.id          = token.sub ?? '';
      session.user.role        = (token.role as RoleCode | undefined) ?? 'INGENIEUR';
      session.user.direction   = token.direction as string | undefined;
      session.user.initials    = token.initials as string | undefined;
      session.user.avatarColor = token.avatarColor as string | undefined;
      session.user.prenom      = token.prenom as string | undefined;
      session.user.nom         = token.nom as string | undefined;
      session.user.poste       = token.poste as string | undefined;
      session.user.departement = token.departement as string | undefined;
      session.user.cellule     = token.cellule as string | undefined;
      return session;
    },
  },
});
