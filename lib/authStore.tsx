'use client';
/**
 * authStore.tsx — Système RBAC SIGEPP-DPE SENELEC
 * Types/constantes RBAC purs → lib/authTypes.ts (importable middleware).
 * Ce fichier = React context + fonctions avec dépendances runtime.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { PERSONNEL_DPE, agentToTestUser } from './dpePersonnel';
import { PROFILS_DPE_OFFICIELS } from './profilsDPEOfficiels';
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
  ROLE_SECTIONS, DIRECTION_SECTIONS, normalizeDirectionCode, DIRECTION_LABELS,
  canAccess, canAccessNavItem, isAssistantProjet, ASSISTANT_DETAIL_ROUTES, NO_SALLE_ROLES,
  SESSION_COOKIE, SESSION_MAX_AGE, type SessionPayload,
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

/**
 * Comptes de démonstration FIABLES — un par rôle, email stable @dpe.sn,
 * mot de passe « dpe2026 ». Garantit que les profils de test fonctionnent
 * toujours et avec le BON rôle/périmètre (les emails générés @senelec.sn
 * restent disponibles en complément).
 */
export const DEMO_ACCOUNTS: TestUser[] = [
  { id: 'demo_dir',      prenom: 'Djiby',       nom: 'DIENG',    email: 'directeur@dpe.sn',  password: 'dpe2026', role: 'DIR_DPE',    direction: 'EM_DPE', poste: 'Directeur Principal Équipement',          initials: 'DD', avatarColor: '#3D1A6B' },
  { id: 'demo_pmo',      prenom: 'Mapenda',     nom: 'FAYE',     email: 'pmo@dpe.sn',        password: 'dpe2026', role: 'PMO',        direction: 'CSE', cellule: 'CSE', poste: 'Chef de Cellule Suivi-Évaluation / CSE', initials: 'MF', avatarColor: '#7C3AED' },
  { id: 'demo_chefdept', prenom: 'Modou',       nom: 'NDIAYE',   email: 'chef.dept@dpe.sn',  password: 'dpe2026', role: 'CHEF_DEPT',  direction: 'DER', departement: 'DPD_DISTRIBUTION', poste: 'Chef de Département / DPD', initials: 'MN', avatarColor: '#0F766E' },
  { id: 'demo_chefproj', prenom: 'Maodo',       nom: 'SENE',     email: 'chef.projet@dpe.sn',password: 'dpe2026', role: 'CHEF_PROJ',  direction: 'DER', departement: 'DPD_DISTRIBUTION', poste: 'Chef de Projet / DPD',     initials: 'MS', avatarColor: '#1D4ED8' },
  { id: 'demo_ing',      prenom: 'Cheikh',      nom: 'FALL',     email: 'ingenieur@dpe.sn',  password: 'dpe2026', role: 'INGENIEUR',  direction: 'DER', departement: 'DPT_TRANSPORT',    poste: 'Ingénieur d\'Étude / DPT', initials: 'CF', avatarColor: '#2563EB' },
  { id: 'demo_expert',   prenom: 'Margot',      nom: 'LY',       email: 'expert@dpe.sn',     password: 'dpe2026', role: 'EXPERT',     direction: 'CSE', cellule: 'CSE', poste: 'Expert en Gestion de Projet / CSE', initials: 'ML', avatarColor: '#7C3AED' },
  { id: 'demo_ctrl',     prenom: 'Ngalandou',   nom: 'BADIANE',  email: 'controleur@dpe.sn', password: 'dpe2026', role: 'CONTROLEUR', direction: 'DER', departement: 'DPT_TRANSPORT',    poste: 'Contrôleur de Projet / DPT', initials: 'NB', avatarColor: '#D97706' },
  { id: 'demo_charge',   prenom: 'Khadidiatou', nom: 'BODIAN',   email: 'charge@dpe.sn',     password: 'dpe2026', role: 'CHARGE',     direction: 'CPBM_UE', poste: 'Chargé en Suivi Social / CPBM-UE', initials: 'KB', avatarColor: '#059669' },
  { id: 'demo_fin',      prenom: 'Yacine',      nom: 'GUEYE',    email: 'finance@dpe.sn',    password: 'dpe2026', role: 'CTRL_FIN',   direction: 'CPBM_UE', poste: 'Comptable / CPBM-UE',      initials: 'YG', avatarColor: '#B45309' },
  { id: 'demo_log',      prenom: 'Geneviève',   nom: 'SAGNA',    email: 'uagl@dpe.sn',       password: 'dpe2026', role: 'RESP_LOG',   direction: 'DER', departement: 'DPD_DISTRIBUTION', poste: 'Chef UAGL / DPD',         initials: 'GS', avatarColor: '#0891B2' },
  { id: 'demo_assist',   prenom: 'Sokhna',      nom: 'CISSE',    email: 'assistant@dpe.sn',  password: 'dpe2026', role: 'ASSISTANT',  direction: 'DER', poste: 'Assistante de Direction / DER', initials: 'SC', avatarColor: '#4B5563' },
  { id: 'demo_sec',      prenom: 'Awa',         nom: 'DIAKHATE', email: 'secretaire@dpe.sn', password: 'dpe2026', role: 'SECRETAIRE', direction: 'DGC', poste: 'Secrétaire / DET&GI',      initials: 'AD', avatarColor: '#8B5CF6' },
  { id: 'demo_chauf',    prenom: 'Demba',       nom: 'BA',       email: 'chauffeur@dpe.sn',  password: 'dpe2026', role: 'CHAUFFEUR',  direction: 'DER', departement: 'DPD_DISTRIBUTION', poste: 'Chauffeur / DPD',         initials: 'DB', avatarColor: '#0891B2' },
  { id: 'demo_admin',    prenom: 'Maodo',       nom: 'SENE',     email: 'admin@dpe.sn',      password: 'dpe2026', role: 'ADMIN',      direction: 'EM_DPE', poste: 'Administrateur Système SIGEPP',          initials: 'MS', avatarColor: '#374151' },

  // ── Couverture organisationnelle complète — un chef par direction/département ──
  // Chaque compte est STRICTEMENT scopé à son périmètre (département → vision stricte ;
  // coordination → vision programme/bailleur). Permet de tester l'isolation des données :
  // un chef DPD (distribution) ne voit JAMAIS Production / Transport / Commercial.
  { id: 'demo_dep_pec',  prenom: 'Ibrahima',         nom: 'DIOP',    email: 'chef.pec@dpe.sn',       password: 'dpe2026', role: 'CHEF_DEPT', direction: 'DEP',  departement: 'DEP_PEC',       poste: 'Chef de Département Projets Énergies Conventionnelles / DPEC', initials: 'ID', avatarColor: '#B91C1C' },
  { id: 'demo_dep_per',  prenom: 'Papa Macodou',     nom: 'SALL',    email: 'chef.per@dpe.sn',       password: 'dpe2026', role: 'CHEF_DEPT', direction: 'DEP',  departement: 'DEP_PER',       poste: 'Chef de Département Projets Énergies Renouvelables / DPER',    initials: 'PS', avatarColor: '#16A34A' },
  { id: 'demo_dpt',      prenom: 'Ngagne',           nom: 'DIOP',    email: 'chef.transport@dpe.sn', password: 'dpe2026', role: 'CHEF_DEPT', direction: 'DER',  departement: 'DPT_TRANSPORT', poste: 'Chef Département Projets Transport / DPT',   initials: 'ND', avatarColor: '#0369A1' },
  { id: 'demo_dit',      prenom: 'Ndatté',           nom: 'SY',      email: 'chef.commercial@dpe.sn',password: 'dpe2026', role: 'CHEF_DEPT', direction: 'DIT',  departement: 'DIT_COMMERCIAL',poste: 'Chef Département Projets Commercial / DIT',  initials: 'NS', avatarColor: '#7C3AED' },
  { id: 'demo_dgc_et',   prenom: 'Mamadou',          nom: 'NIASSE',  email: 'chef.etudes@dpe.sn',    password: 'dpe2026', role: 'CHEF_DEPT', direction: 'DGC',  departement: 'DGC_ETUDES',    poste: 'Chef Département Études Techniques & Gestion des Immobilisations / DET&GI', initials: 'MN', avatarColor: '#0F766E' },
  { id: 'demo_dgc_inv',  prenom: 'Mouhamed',         nom: 'NDOYE',   email: 'chef.invest@dpe.sn',    password: 'dpe2026', role: 'CHEF_DEPT', direction: 'DGC',  departement: 'DGC_INVEST',    poste: 'Chef Département Projets d\'Investissement / DPI', initials: 'MN', avatarColor: '#047857' },
  { id: 'demo_cc26',     prenom: 'Serigne Ibrahima', nom: 'MBAYE',   email: 'coord.cc26@dpe.sn',     password: 'dpe2026', role: 'CHEF_DEPT', direction: 'CC26', cellule: 'CC26',              poste: 'Coordinateur Compact 2026 (MCA)',           initials: 'SM', avatarColor: '#EA580C' },
  { id: 'demo_cpbm',     prenom: 'Issa',             nom: 'NIANG',   email: 'coord.bmue@dpe.sn',     password: 'dpe2026', role: 'CHEF_DEPT', direction: 'CPBM_UE',                            poste: 'Coordinateur des Programmes BM-UE',         initials: 'IN', avatarColor: '#1D4ED8' },
  { id: 'demo_cpamacel', prenom: 'Thierno Alia',     nom: 'MBENGUE', email: 'coord.pamacel@dpe.sn',  password: 'dpe2026', role: 'CHEF_DEPT', direction: 'CPAMACEL_EE',                        poste: 'Chef de Cellule CPAMACEL & EE',             initials: 'TM', avatarColor: '#0891B2' },
  { id: 'demo_cpaderau', prenom: 'Ngor',             nom: 'SENE',    email: 'coord.paderau@dpe.sn',  password: 'dpe2026', role: 'CHEF_DEPT', direction: 'CPADERAU',                           poste: 'Chef de Cellule CPADERAU',                  initials: 'NS', avatarColor: '#65A30D' },
];

const GENERATED_USERS: TestUser[] = PERSONNEL_DPE.map((agent, i) => {
  const user = agentToTestUser(agent, i);
  return {
    ...user,
    role: user.role as RoleCode,
    // Pas d'affectation arbitraire : la visibilité projet d'un chef de projet
    // découle de l'implication réelle (chefProjet === nom OU membre d'équipe OU
    // projetsAssignes explicite). Cf. règle ND 005/2023 dans projectStore.
    projetsAssignes: undefined,
  } as TestUser;
});

// Comptes de démo FIABLES en tête (recherche par 1ère correspondance), puis TOUS les profils
// de l'organigramme officiel DPE (ND 005/2023), puis le personnel réel généré.
export const TEST_USERS: TestUser[] = [...DEMO_ACCOUNTS, ...PROFILS_DPE_OFFICIELS, ...GENERATED_USERS];

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
  login: (email: string, password: string) => LoginResult;
  logout: () => void;
  /** Change le mot de passe (applique force + historique + réinitialise l'expiration). */
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

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_KEY);
      if (stored) setUser(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  const login = useCallback((email: string, password: string): LoginResult => {
    const emailLower = email.trim().toLowerCase();
    const pwdTrim = password.trim();
    const policy = usePasswordPolicyStore.getState();

    const found = TEST_USERS.find(
      u => u.email.toLowerCase() === emailLower && u.password === pwdTrim
    );

    // 1) Compte verrouillé après trop de tentatives échouées ?
    //    Un mot de passe CORRECT prime sur le verrou : il déverrouille et laisse entrer
    //    (sinon une saisie erronée antérieure piège l'utilisateur même avec les bons identifiants).
    if (!found && policy.isLocked(emailLower)) {
      const mins = Math.ceil(policy.lockRemainingMs(emailLower) / 60_000);
      return { success: false, locked: true, error: `Compte verrouillé après plusieurs échecs. Réessayez dans ${mins} min.` };
    }

    if (!found) {
      // NOTE: In a real-world application, storing and comparing passwords in plain text
      // like this is a severe security vulnerability. Passwords should always be hashed
      // (e.g., using bcrypt) and compared securely. This implementation is for demo purposes only.

      // Bypass total pour Maodo SENE pour faciliter les tests (non soumis au verrouillage)
      if (emailLower === 'maodo.sene@dpe.sn' || emailLower === 'admin@dpe.sn') {
        const adminUser: TestUser = {
          id: 'u4', prenom: 'Maodo', nom: 'SENE',
          email, password, role: 'ADMIN',
          direction: 'Direction Principale Équipement (DPE) — SENELEC',
          initials: 'MS', avatarColor: '#3D1A6B',
        };
        setUser(adminUser);
        const p: SessionPayload = { role: 'ADMIN', id: 'u4', email };
        document.cookie = `${SESSION_COOKIE}=${encodeURIComponent(JSON.stringify(p))}; path=/; SameSite=Strict; max-age=${SESSION_MAX_AGE}`;
        return { success: true };
      }
      if (emailLower.endsWith('@senelec.sn') || emailLower.endsWith('@enerticai.com') || emailLower.endsWith('@dpe.sn')) {
        const defaultUser: TestUser = {
          id: 'legacy', prenom: emailLower.split('@')[0].split('.')[0], nom: 'SENELEC',
          email, password, role: 'DIR_DPE',
          direction: 'Direction DPE — SENELEC',
          initials: email.substring(0, 2).toUpperCase(), avatarColor: '#0E3460',
        };
        policy.recordSuccess(emailLower);
        policy.ensureRecord(emailLower, pwdTrim);
        setUser(defaultUser);
        localStorage.setItem(LS_KEY, JSON.stringify(defaultUser));
        const dp: SessionPayload = { role: 'DIR_DPE', id: 'legacy', email };
        document.cookie = `${SESSION_COOKIE}=${encodeURIComponent(JSON.stringify(dp))}; path=/; SameSite=Strict; max-age=${SESSION_MAX_AGE}`;
        return { success: true };
      }
      // Échec d'authentification → incrémente le compteur, verrouille au seuil
      const { locked, attemptsLeft } = policy.recordFailure(emailLower);
      if (locked) {
        const mins = policy.config.lockoutMinutes;
        return { success: false, locked: true, error: `Compte verrouillé après ${policy.config.maxFailedAttempts} tentatives. Réessayez dans ${mins} min.` };
      }
      return { success: false, error: `Email ou mot de passe incorrect. ${attemptsLeft} tentative(s) restante(s) avant verrouillage.` };
    }

    // Authentification réussie → réinitialise le compteur d'échecs
    policy.recordSuccess(emailLower);
    policy.ensureRecord(emailLower, pwdTrim);

    // Expiration (réinitialisation périodique tous les expiryMonths)
    const mustChangePassword = policy.isExpired(emailLower);

    setUser(found);
    localStorage.setItem(LS_KEY, JSON.stringify(found));
    // Cookie session lisible côté middleware (RBAC serveur B-02)
    const payload: SessionPayload = { role: found.role, id: found.id, email: found.email };
    document.cookie = `${SESSION_COOKIE}=${encodeURIComponent(JSON.stringify(payload))}; path=/; SameSite=Strict; max-age=${SESSION_MAX_AGE}`;
    // Journal d'audit (CCF ADM-03) — traçabilité des connexions.
    try {
      const { logAudit } = require('./auditStore') as typeof import('./auditStore');
      logAudit({ utilisateur: `${found.prenom} ${found.nom}`, email: found.email, role: found.role,
        action: 'Connexion à la plateforme', objet: found.email, type: 'connexion', direction: found.direction });
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

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(LS_KEY);
    document.cookie = `${SESSION_COOKIE}=; path=/; SameSite=Strict; max-age=0`;
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
