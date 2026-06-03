/**
 * passwordPolicyStore.ts — Politique de mot de passe CONFIGURABLE SIGEPP-DPE
 * -----------------------------------------------------------------------------
 * Règles de sécurité d'accès (configurables par l'administrateur, sans recompiler) :
 *   • Longueur minimale (défaut : 8 caractères) + complexité optionnelle ;
 *   • Verrouillage du compte après N tentatives échouées (défaut : 3) ;
 *   • Expiration / réinitialisation périodique (défaut : tous les 6 mois) ;
 *   • Interdiction de réutiliser les N derniers mots de passe (défaut : 3).
 *
 * NOTE sécurité : application de démonstration. Les empreintes stockées utilisent
 * un hachage simple (djb2) — NON cryptographique. En production, utiliser bcrypt/argon2
 * côté serveur. Aucun mot de passe en clair n'est conservé dans l'historique.
 *
 * Pas d'import d'authStore ici → aucun cycle de dépendances.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION DE LA POLITIQUE (modifiable par l'admin)
// ─────────────────────────────────────────────────────────────────────────────

export interface PasswordPolicyConfig {
  /** Longueur minimale du mot de passe. */
  minLength: number;
  /** Exiger au moins une majuscule. */
  requireUppercase: boolean;
  /** Exiger au moins une minuscule. */
  requireLowercase: boolean;
  /** Exiger au moins un chiffre. */
  requireDigit: boolean;
  /** Exiger au moins un caractère spécial. */
  requireSpecial: boolean;
  /** Nombre de tentatives échouées avant verrouillage. */
  maxFailedAttempts: number;
  /** Durée du verrouillage (minutes) après dépassement. */
  lockoutMinutes: number;
  /** Durée de validité d'un mot de passe (mois) avant réinitialisation obligatoire. */
  expiryMonths: number;
  /** Nombre de mots de passe précédents interdits à la réutilisation. */
  historyCount: number;
}

export const DEFAULT_PASSWORD_POLICY: PasswordPolicyConfig = {
  minLength: 8,
  requireUppercase: false,
  requireLowercase: false,
  requireDigit: false,
  requireSpecial: false,
  maxFailedAttempts: 3,
  lockoutMinutes: 15,
  expiryMonths: 6,
  historyCount: 3,
};

// ─────────────────────────────────────────────────────────────────────────────
// HACHAGE SIMPLE (djb2) — NON cryptographique, suffisant pour la démo
// ─────────────────────────────────────────────────────────────────────────────

export function hashPassword(pwd: string): string {
  let h = 5381;
  for (let i = 0; i < pwd.length; i++) {
    h = ((h << 5) + h + pwd.charCodeAt(i)) >>> 0;
  }
  return `h${h.toString(36)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// ÉTAT DE SÉCURITÉ PAR UTILISATEUR (clé = email en minuscules)
// ─────────────────────────────────────────────────────────────────────────────

export interface UserSecurityRecord {
  failedAttempts: number;
  /** Timestamp (ms) jusqu'auquel le compte est verrouillé, ou undefined. */
  lockedUntil?: number;
  /** Timestamp (ms) du dernier changement de mot de passe. */
  passwordChangedAt: number;
  /** Empreintes des derniers mots de passe (du plus récent au plus ancien). */
  history: string[];
}

export interface PasswordValidationResult {
  ok: boolean;
  errors: string[];
}

interface PasswordPolicyState {
  config: PasswordPolicyConfig;
  records: Record<string, UserSecurityRecord>;

  // ── Config (admin) ──
  setConfig: (patch: Partial<PasswordPolicyConfig>) => void;
  resetConfig: () => void;

  // ── Validation force du mot de passe ──
  validateStrength: (pwd: string) => PasswordValidationResult;

  // ── Verrouillage / tentatives ──
  isLocked: (email: string) => boolean;
  lockRemainingMs: (email: string) => number;
  recordFailure: (email: string) => { locked: boolean; attemptsLeft: number };
  recordSuccess: (email: string) => void;

  // ── Expiration ──
  isExpired: (email: string, passwordChangedAtFallback?: number) => boolean;
  daysUntilExpiry: (email: string) => number | null;

  // ── Historique / changement ──
  /** true si le nouveau mot de passe est réutilisable (pas dans l'historique). */
  canReuse: (email: string, newPwd: string) => boolean;
  /** Enregistre un changement de mot de passe (met à jour historique + date). */
  registerChange: (email: string, newPwd: string) => void;
  /** Initialise l'enregistrement d'un utilisateur s'il n'existe pas. */
  ensureRecord: (email: string, currentPwd?: string) => void;
}

const k = (email: string) => email.trim().toLowerCase();

export const usePasswordPolicyStore = create<PasswordPolicyState>()(
  persist(
    (set, get) => ({
      config: { ...DEFAULT_PASSWORD_POLICY },
      records: {},

      setConfig: (patch) => set(s => ({ config: { ...s.config, ...patch } })),
      resetConfig: () => set({ config: { ...DEFAULT_PASSWORD_POLICY } }),

      validateStrength: (pwd) => {
        const c = get().config;
        const errors: string[] = [];
        if (pwd.length < c.minLength) errors.push(`Au moins ${c.minLength} caractères requis.`);
        if (c.requireUppercase && !/[A-Z]/.test(pwd)) errors.push('Au moins une majuscule requise.');
        if (c.requireLowercase && !/[a-z]/.test(pwd)) errors.push('Au moins une minuscule requise.');
        if (c.requireDigit && !/[0-9]/.test(pwd)) errors.push('Au moins un chiffre requis.');
        if (c.requireSpecial && !/[^A-Za-z0-9]/.test(pwd)) errors.push('Au moins un caractère spécial requis.');
        return { ok: errors.length === 0, errors };
      },

      isLocked: (email) => {
        const r = get().records[k(email)];
        if (!r?.lockedUntil) return false;
        return r.lockedUntil > Date.now();
      },

      lockRemainingMs: (email) => {
        const r = get().records[k(email)];
        if (!r?.lockedUntil) return 0;
        return Math.max(0, r.lockedUntil - Date.now());
      },

      recordFailure: (email) => {
        const key = k(email);
        const c = get().config;
        const cur = get().records[key] ?? { failedAttempts: 0, passwordChangedAt: Date.now(), history: [] };
        const attempts = cur.failedAttempts + 1;
        const locked = attempts >= c.maxFailedAttempts;
        const next: UserSecurityRecord = {
          ...cur,
          failedAttempts: attempts,
          lockedUntil: locked ? Date.now() + c.lockoutMinutes * 60_000 : cur.lockedUntil,
        };
        set(s => ({ records: { ...s.records, [key]: next } }));
        return { locked, attemptsLeft: Math.max(0, c.maxFailedAttempts - attempts) };
      },

      recordSuccess: (email) => {
        const key = k(email);
        const cur = get().records[key];
        const next: UserSecurityRecord = {
          failedAttempts: 0,
          lockedUntil: undefined,
          passwordChangedAt: cur?.passwordChangedAt ?? Date.now(),
          history: cur?.history ?? [],
        };
        set(s => ({ records: { ...s.records, [key]: next } }));
      },

      isExpired: (email, fallback) => {
        const c = get().config;
        if (c.expiryMonths <= 0) return false;
        const r = get().records[k(email)];
        const changedAt = r?.passwordChangedAt ?? fallback;
        if (!changedAt) return false;
        const expiryMs = c.expiryMonths * 30 * 24 * 60 * 60 * 1000;
        return Date.now() - changedAt > expiryMs;
      },

      daysUntilExpiry: (email) => {
        const c = get().config;
        if (c.expiryMonths <= 0) return null;
        const r = get().records[k(email)];
        if (!r?.passwordChangedAt) return null;
        const expiryMs = c.expiryMonths * 30 * 24 * 60 * 60 * 1000;
        const remaining = r.passwordChangedAt + expiryMs - Date.now();
        return Math.ceil(remaining / (24 * 60 * 60 * 1000));
      },

      canReuse: (email, newPwd) => {
        const c = get().config;
        const r = get().records[k(email)];
        if (!r) return true;
        const h = hashPassword(newPwd);
        return !r.history.slice(0, c.historyCount).includes(h);
      },

      registerChange: (email, newPwd) => {
        const key = k(email);
        const c = get().config;
        const cur = get().records[key] ?? { failedAttempts: 0, passwordChangedAt: Date.now(), history: [] };
        const h = hashPassword(newPwd);
        const history = [h, ...cur.history.filter(x => x !== h)].slice(0, Math.max(c.historyCount, 1));
        set(s => ({
          records: {
            ...s.records,
            [key]: { failedAttempts: 0, lockedUntil: undefined, passwordChangedAt: Date.now(), history },
          },
        }));
      },

      ensureRecord: (email, currentPwd) => {
        const key = k(email);
        if (get().records[key]) return;
        set(s => ({
          records: {
            ...s.records,
            [key]: {
              failedAttempts: 0,
              passwordChangedAt: Date.now(),
              history: currentPwd ? [hashPassword(currentPwd)] : [],
            },
          },
        }));
      },
    }),
    { name: 'sigepp-password-policy' }
  )
);
