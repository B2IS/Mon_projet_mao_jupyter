/**
 * supabase.ts — Client Supabase SIGEP-DPE
 * Utilisé pour : persistance des sessions OAuth, table sigep_users (rôles SSO)
 * Les comptes demo continuent à fonctionner via usersDb.ts en fallback.
 */
import { createClient } from '@supabase/supabase-js';
import type { RoleCode } from './authTypes';

const SUPABASE_URL     = process.env.SUPABASE_URL               ?? '';
const SUPABASE_ANON    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY  ?? '';

/** Client public (browser-safe) */
export const supabaseClient = SUPABASE_URL
  ? createClient(SUPABASE_URL, SUPABASE_ANON)
  : null;

/** Client privilégié (serveur uniquement — ne jamais exposer côté client) */
export const supabaseAdmin = SUPABASE_URL && SUPABASE_SERVICE
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

// ─── Schéma Supabase attendu ───────────────────────────────────────────────
// Table : sigep_users
// Colonnes : email TEXT PK, role TEXT, direction TEXT, poste TEXT,
//            departement TEXT, cellule TEXT, prenom TEXT, nom TEXT,
//            initials TEXT, avatar_color TEXT, created_at TIMESTAMPTZ

export interface SupabaseUserRow {
  email:        string;
  role:         RoleCode;
  direction:    string;
  poste?:       string;
  departement?: string;
  cellule?:     string;
  prenom?:      string;
  nom?:         string;
  initials?:    string;
  avatar_color?: string;
}

/**
 * Récupère le profil RBAC d'un utilisateur SSO depuis Supabase.
 * Retourne null si Supabase n'est pas configuré ou si l'email est inconnu.
 */
export async function getUserRoleFromSupabase(email: string): Promise<SupabaseUserRow | null> {
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin
    .from('sigep_users')
    .select('*')
    .eq('email', email.toLowerCase())
    .single();
  if (error || !data) return null;
  return data as SupabaseUserRow;
}

/**
 * Upsert un utilisateur SSO dans Supabase (appelé au premier sign-in OAuth).
 * Ne fait rien si Supabase n'est pas configuré.
 */
export async function upsertSupabaseUser(user: SupabaseUserRow): Promise<void> {
  if (!supabaseAdmin) return;
  await supabaseAdmin
    .from('sigep_users')
    .upsert({ ...user, email: user.email.toLowerCase() }, { onConflict: 'email' });
}
