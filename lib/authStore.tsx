'use client';
/**
 * authStore.tsx — Système RBAC SIGEPP-DPE SENELEC
 * Types/constantes RBAC purs → lib/authTypes.ts (importable middleware).
 * Ce fichier = React context + fonctions avec dépendances runtime.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
export { DEMO_ACCOUNTS, TEST_USERS } from './usersDb';
import { usePasswordPolicyStore } from './passwordPolicyStore';
import {
  computeVisibilityScope,
  type VisibilityScope,
  type UserOrgProfile,
} from './accessEngine';

// Re-export complet pour backward compat (40+ fichiers importent depuis ici)
export * from './authTypes';
import {
  type RoleCode, type TestUser, type SidebarSectionId,
  type LoginResult, type ChangePasswordResult,
  ROLE_SECTIONS, DIRECTION_SECTIONS, normalizeDirectionCode, DIRECTION_LABELS,
  canAccess, canAccessNavItem, isAssistantProjet, ASSISTANT_DETAIL_ROUTES, NO_SALLE_ROLES,
} from './authTypes';

/** getDirectionLabel utilise un require() dynamique (orgConfigStore client-only) — reste ici */
export function getDirectionLabel(code: string): string {
  const canonical = normalizeDirectionCode(code);
  // Lecture dynamique via le store organisationnel
  try {
    const { useOrgConfig } = require('./orgConfigStore') as typeof import('./orgConfigStore');
    const d = useOrgConfig.getState().directions.find(
      x => x.code === canonical || x.shortLabel === canonical
    );
    if (d) return d.label;
  } catch { /* SSR / cycle */ }
  return DIRECTION_LABELS[canonical] ?? code;
}

/** Calcule le périmètre de visibilité d'un utilisateur via le moteur d'accès intelligent.
 *  Remplace l'ancien DIRECTION_TO_UNITES (legacy) — utilise computeVisibilityScope pour
 *  un scope hiérarchique complet (directions, départements, programmes, domaines, types). */
export function getUserScope(user: TestUser | null): VisibilityScope {
  if (!user) return { niveau: 3, directions: [], departements: [], unites: [], programmes: [], domaines: [], typesProjets: [], all: false };

  // Surcharge admin éventuelle (direction affectée + niveau de vue) configurée
  // via la console d'administration (permissionStore.roleScopes[role]).
  let direction = normalizeDirectionCode(user.direction);
  let override: { niveau?: 0 | 1 | 2 | 3 } | undefined;
  try {
    const { usePermissionStore } = require('./permissionStore') as typeof import('./permissionStore');
    const sc = usePermissionStore.getState().scopeFor(user.role);
    if (sc?.direction) direction = normalizeDirectionCode(sc.direction);
    if (sc?.niveau != null) override = { niveau: sc.niveau };
  } catch { /* SSR / store non initialisé → périmètre par défaut */ }

  const profile: UserOrgProfile = {
    role: user.role,
    direction,
    departement: user.departement,
    cellule: user.cellule,
    poste: user.poste,
    fonction: undefined,
  };
  return computeVisibilityScope(profile, override);
}


// ── LECTURE SEULE OPÉRATIONNELLE ──
// Les niveaux 0 (Directeur DPE, PMO Central/CSE) et 1 (directeurs d'unité) VOIENT le
// planning et la gestion de projet, mais en LECTURE SEULE. L'ÉDITION opérationnelle est
// réservée au niveau 2 : départements ET chefs de cellule (CPBM, CPADERAU, CPAMACEL, CC26),
// plus l'équipe projet (chef de projet + ingénieurs affectés). L'Admin n'est jamais bridé.
export function isOperationalReadOnly(user: TestUser | null): boolean {
  if (!user || user.role === 'ADMIN') return false;
  return getUserScope(user).niveau <= 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT
// ─────────────────────────────────────────────────────────────────────────────
// LoginResult, ChangePasswordResult → re-exportés depuis authTypes via export *

interface AuthContextValue {
  user: TestUser | null;
  /** Authentifie via /api/auth/login (JWT httpOnly). */
  login: (email: string, password: string) => Promise<LoginResult>;
  /** Révoque la session JWT et efface les données locales. */
  logout: () => Promise<void>;
  changePassword: (email: string, oldPassword: string, newPassword: string) => ChangePasswordResult;
  canAccess: (route: string) => boolean;
  canAccessSection: (sectionId: SidebarSectionId) => boolean;
  canAccessNavItem: (href: string) => boolean;
  isRole: (...roles: RoleCode[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const LS_KEY = 'sigepp_dpe_user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<TestUser | null>(null);

  // Hydrate depuis le JWT côté serveur — fallback localStorage pour le dev hot-reload
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.user) {
          setUser(data.user);
          localStorage.setItem(LS_KEY, JSON.stringify(data.user));
        } else {
          try {
            const stored = localStorage.getItem(LS_KEY);
            if (stored) setUser(JSON.parse(stored));
          } catch { /* ignore */ }
        }
      })
      .catch(() => {
        try {
          const stored = localStorage.getItem(LS_KEY);
          if (stored) setUser(JSON.parse(stored));
        } catch { /* ignore */ }
      });
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    const emailLower = email.trim().toLowerCase();
    const pwdTrim    = password.trim();
    const policy     = usePasswordPolicyStore.getState();

    // Vérification locale du verrouillage avant d'appeler l'API
    if (policy.isLocked(emailLower)) {
      const mins = Math.ceil(policy.lockRemainingMs(emailLower) / 60_000);
      return { success: false, locked: true, error: `Compte verrouillé. Réessayez dans ${mins} min.` };
    }

    let res: Response;
    try {
      res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email: emailLower, password: pwdTrim }),
      });
    } catch {
      return { success: false, error: 'Erreur réseau. Vérifiez votre connexion.' };
    }

    if (!res.ok) {
      const { locked, attemptsLeft } = policy.recordFailure(emailLower);
      if (locked) {
        return { success: false, locked: true, error: `Compte verrouillé après ${policy.config.maxFailedAttempts} tentatives. Réessayez dans ${policy.config.lockoutMinutes} min.` };
      }
      return { success: false, error: `Identifiants incorrects. ${attemptsLeft} tentative(s) restante(s) avant verrouillage.` };
    }

    const data = await res.json();
    policy.recordSuccess(emailLower);
    policy.ensureRecord(emailLower, pwdTrim);
    const mustChangePassword = policy.isExpired(emailLower);

    setUser(data.user);
    localStorage.setItem(LS_KEY, JSON.stringify(data.user));

    try {
      const { logAudit } = require('./auditStore') as typeof import('./auditStore');
      logAudit({ utilisateur: `${data.user.prenom} ${data.user.nom}`, email: data.user.email,
        role: data.user.role, action: 'Connexion JWT', objet: data.user.email,
        type: 'connexion', direction: data.user.direction });
    } catch { /* noop */ }

    return { success: true, mustChangePassword };
  }, []);

  const changePassword = useCallback((email: string, oldPassword: string, newPassword: string): ChangePasswordResult => {
    const emailLower = email.trim().toLowerCase();
    const oldTrim = oldPassword.trim();
    const newTrim = newPassword.trim();
    const policy = usePasswordPolicyStore.getState();

    const found = TEST_USERS.find(u => u.email.toLowerCase() === emailLower);
    // Vérifie l'ancien mot de passe (sauf comptes bypass legacy/admin sans entrée TEST_USERS)
    if (found && found.password !== oldTrim) {
      return { success: false, error: 'Ancien mot de passe incorrect.' };
    }
    // Force du mot de passe
    const strength = policy.validateStrength(newTrim);
    if (!strength.ok) {
      return { success: false, error: strength.errors.join(' ') };
    }
    // Pas de réutilisation des N derniers
    if (!policy.canReuse(emailLower, newTrim)) {
      return { success: false, error: `Mot de passe déjà utilisé récemment (les ${policy.config.historyCount} derniers sont interdits).` };
    }
    if (newTrim === oldTrim) {
      return { success: false, error: 'Le nouveau mot de passe doit différer de l\'ancien.' };
    }
    // Applique le changement (en mémoire pour la démo) + historique + date
    if (found) found.password = newTrim;
    policy.registerChange(emailLower, newTrim);
    // Met à jour la session courante si c'est l'utilisateur connecté
    setUser(prev => {
      if (prev && prev.email.toLowerCase() === emailLower) {
        const updated = { ...prev, password: newTrim };
        localStorage.setItem(LS_KEY, JSON.stringify(updated));
        return updated;
      }
      return prev;
    });
    return { success: true };
  }, []);

  const logout = useCallback(async () => {
    setUser(null);
    localStorage.removeItem(LS_KEY);
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
  }, []);

  const canAccessRoute = useCallback((route: string) => {
    if (!user) return false;
    return canAccess(user.role, route);
  }, [user]);

  const canAccessSection = useCallback((sectionId: SidebarSectionId) => {
    if (!user) return false;
    // RÈGLE DE BASE = ROLE_SECTIONS (aligné sur les organigrammes DPE / ND 005/2023),
    // SAUF si l'administrateur a défini une surcharge configurable pour ce rôle
    // (habilitations modifiables — évolutivité). Le rôle reste autoritaire :
    // un Directeur ne voit pas l'exécution terrain même s'il est de niveau 0.
    let allowedSections: string[] = ROLE_SECTIONS[user.role];
    try {
      const { usePermissionStore } = require('./permissionStore') as typeof import('./permissionStore');
      const override = usePermissionStore.getState().overrideFor(user.role);
      if (override) allowedSections = override;
    } catch { /* SSR / store non initialisé → défaut code */ }
    // La section « Projets » porte l'id 'portefeuille' dans le menu, mais certains rôles
    // l'expriment via 'mes_projets' (vue « Mes Projets »). On les considère équivalents,
    // sinon le Chef de Projet ne verrait PAS sa section Projets (planning, Gantt, gestion).
    const accepted = sectionId === 'portefeuille' ? ['portefeuille', 'mes_projets'] : [sectionId];
    if (!accepted.some(s => allowedSections.includes(s))) return false;
    // ABAC : l'assistante de DIRECTION (≠ assistant projet) n'a NI Exécution NI Projets.
    if (user.role === 'ASSISTANT' && !isAssistantProjet(user)
        && (sectionId === 'execution' || sectionId === 'portefeuille' || sectionId === 'mes_projets')) return false;
    // Affinage métier par direction (intersection si une restriction existe).
    const dirAllowed = DIRECTION_SECTIONS[normalizeDirectionCode(user.direction)];
    if (dirAllowed && !dirAllowed.includes(sectionId)) return false;
    return true;
  }, [user]);

  const canAccessNavItemFn = useCallback((href: string) => {
    if (!user) return true; // demo mode: show all
    // ABAC : le détail projet (gestion/WBS/tâches/terrain/Gantt) n'est visible que pour
    // l'assistant CHEF DE PROJET ; l'assistante de DIRECTION reste sur l'admin (GED, courriers…).
    if (user.role === 'ASSISTANT' && ASSISTANT_DETAIL_ROUTES.includes(href) && !isAssistantProjet(user)) return false;
    return canAccessNavItem(user.role, href);
  }, [user]);

  const isRole = useCallback((...roles: RoleCode[]) => {
    if (!user) return false;
    return roles.includes(user.role);
  }, [user]);

  return (
    <AuthContext.Provider value={{
      user, login, logout, changePassword,
      canAccess: canAccessRoute,
      canAccessSection,
      canAccessNavItem: canAccessNavItemFn,
      isRole,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
