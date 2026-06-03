/**
 * permissionStore.ts — Habilitations CONFIGURABLES par rôle (évolutivité)
 * -----------------------------------------------------------------------
 * Permet à un administrateur de MODIFIER les modules/sections accessibles à
 * chaque rôle SANS recompiler : les surcharges sont persistées (localStorage)
 * et consultées par `authStore.canAccessSection`.
 *
 * Trois leviers de configuration par rôle :
 *   1. sectionOverrides[role] → quelles SECTIONS du menu (modules) sont visibles ;
 *   2. roleScopes[role].direction → quelle DIRECTION/coordination est affectée ;
 *   3. roleScopes[role].niveau → quel NIVEAU DE VUE (0=tout … 3=agent).
 *
 * Principe : si un rôle possède une surcharge, elle fait foi ; sinon on retombe
 * sur la configuration par défaut codée (`ROLE_SECTIONS` / organigramme DPE).
 * Pas d'import d'authStore ici → aucun cycle.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Périmètre configurable affecté à un rôle (override admin). */
export interface RoleScopeConfig {
  /** Code direction/coordination affecté (ex: 'DER', 'DEP', 'DIT'…). */
  direction?: string;
  /** Niveau de vue forcé : 0=tout voir, 1=direction, 2=département, 3=agent. */
  niveau?: 0 | 1 | 2 | 3;
}

interface PermissionState {
  /** role (RoleCode) → liste de SidebarSectionId autorisées (surcharge). */
  sectionOverrides: Record<string, string[]>;
  /** role (RoleCode) → périmètre (direction + niveau de vue) affecté. */
  roleScopes: Record<string, RoleScopeConfig>;

  setRoleSections: (role: string, sections: string[]) => void;
  toggleRoleSection: (role: string, section: string) => void;
  resetRole: (role: string) => void;
  resetAll: () => void;
  /** Surcharge effective de sections pour un rôle, ou null si aucune (→ défaut code). */
  overrideFor: (role: string) => string[] | null;

  /** Affecte une direction à un rôle (vide = retour au défaut). */
  setRoleDirection: (role: string, direction: string) => void;
  /** Affecte un niveau de vue à un rôle (null = retour au défaut). */
  setRoleNiveau: (role: string, niveau: 0 | 1 | 2 | 3 | null) => void;
  /** Périmètre configuré pour un rôle, ou null si aucun. */
  scopeFor: (role: string) => RoleScopeConfig | null;
}

export const usePermissionStore = create<PermissionState>()(
  persist(
    (set, get) => ({
      sectionOverrides: {},
      roleScopes: {},
      setRoleSections: (role, sections) =>
        set(s => ({ sectionOverrides: { ...s.sectionOverrides, [role]: [...new Set(sections)] } })),
      toggleRoleSection: (role, section) =>
        set(s => {
          const cur = s.sectionOverrides[role] ?? [];
          const next = cur.includes(section) ? cur.filter(x => x !== section) : [...cur, section];
          return { sectionOverrides: { ...s.sectionOverrides, [role]: next } };
        }),
      resetRole: (role) =>
        set(s => {
          const { [role]: _removedSec, ...restSec } = s.sectionOverrides;
          const { [role]: _removedScope, ...restScope } = s.roleScopes;
          return { sectionOverrides: restSec, roleScopes: restScope };
        }),
      resetAll: () => set({ sectionOverrides: {}, roleScopes: {} }),
      overrideFor: (role) => get().sectionOverrides[role] ?? null,

      setRoleDirection: (role, direction) =>
        set(s => {
          const cur = s.roleScopes[role] ?? {};
          const next: RoleScopeConfig = { ...cur, direction: direction || undefined };
          // Nettoyage : si plus aucun override, on retire l'entrée
          if (!next.direction && next.niveau == null) {
            const { [role]: _r, ...rest } = s.roleScopes;
            return { roleScopes: rest };
          }
          return { roleScopes: { ...s.roleScopes, [role]: next } };
        }),
      setRoleNiveau: (role, niveau) =>
        set(s => {
          const cur = s.roleScopes[role] ?? {};
          const next: RoleScopeConfig = { ...cur, niveau: niveau == null ? undefined : niveau };
          if (!next.direction && next.niveau == null) {
            const { [role]: _r, ...rest } = s.roleScopes;
            return { roleScopes: rest };
          }
          return { roleScopes: { ...s.roleScopes, [role]: next } };
        }),
      scopeFor: (role) => get().roleScopes[role] ?? null,
    }),
    { name: 'sigepp-permissions' }
  )
);
