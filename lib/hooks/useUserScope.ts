/**
 * useUserScope.ts — Hook central de visibilité hiérarchique
 * Utilisé dans TOUTES les pages du dashboard pour filtrer les données
 */

import { useAuth } from '@/lib/authStore';
import { computeVisibilityScope, isProjectVisible, canPerformAction, type UserOrgProfile, type VisibilityScope, type ProjetMinimal } from '@/lib/accessEngine';
import { useMemo } from 'react';

export function useUserScope(): VisibilityScope {
  const { user } = useAuth();
  return useMemo(() => {
    if (!user) {
      return { niveau: 3, directions: [], departements: [], unites: [], programmes: [], domaines: [], typesProjets: [], all: false };
    }
    const profile: UserOrgProfile = {
      role: user.role,
      direction: user.direction,
      departement: user.departement,
      cellule: user.cellule,
      poste: user.poste,
    };
    return computeVisibilityScope(profile);
  }, [user]);
}

export function useCanSeeProject(project: ProjetMinimal): boolean {
  const scope = useUserScope();
  return isProjectVisible(project, scope);
}

export function useCanPerform(action: Parameters<typeof canPerformAction>[0]): boolean {
  const { user } = useAuth();
  return useMemo(() => {
    if (!user) return false;
    const profile: UserOrgProfile = {
      role: user.role,
      direction: user.direction,
      departement: user.departement,
      cellule: user.cellule,
      poste: user.poste,
    };
    return canPerformAction(action, profile);
  }, [user, action]);
}
