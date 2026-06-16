/**
 * objectSecurity.ts — Sécurité au niveau objet (Row Level Security générique)
 * ---------------------------------------------------------------------------
 * Couche transverse appliquant le principe directeur de sécurité :
 *   « Un utilisateur ne voit que son unité, ses sous-unités, ses projets
 *     affectés, ses documents, ses workflows — jamais les unités parallèles. »
 *
 * Chaque objet sécurisable (projet, contrat, marché, KPI, courrier, dashboard,
 * appel d'API, agent IA…) porte un `SecurityContext`. La même règle de
 * visibilité s'applique à TOUS via `canSeeObject` / `filterSecured`.
 *
 * S'appuie sur le moteur existant (accessEngine : RBAC + ABAC + hiérarchie
 * organisationnelle) — cette couche ajoute :
 *   - l'identification d'objet générique (8 attributs de rattachement)
 *   - le niveau de confidentialité (Document Security)
 *   - la propriété (owner) — accès garanti au propriétaire.
 */

import { canonDirectionKey } from '../dpeOrgStructure';
import type { VisibilityScope, UserOrgProfile } from '../accessEngine';
import { getNiveauHierarchique } from '../accessEngine';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Document Security — niveau de confidentialité d'un objet. */
export type ConfidentialityLevel = 'public' | 'interne' | 'confidentiel' | 'secret';

export const CONFIDENTIALITY_LABEL: Record<ConfidentialityLevel, string> = {
  public: 'Public',
  interne: 'Interne',
  confidentiel: 'Confidentiel',
  secret: 'Secret',
};

/**
 * Contexte de sécurité porté par chaque objet sécurisable.
 * (Tous les identifiants de rattachement sont optionnels : un objet purement
 *  transverse peut n'en porter aucun, il sera alors traité comme « interne ».)
 */
export interface SecurityContext {
  organizationId?: string;   // ex: 'SENELEC'
  directionId?: string;      // ex: 'DER', 'DEP', 'DGC'…
  departementId?: string;    // ex: 'DPT_TRANSPORT', 'DPD_DISTRIBUTION'
  serviceId?: string;        // ex: 'SIG', 'IMMOBILISATIONS'
  programmeId?: string;      // ex: 'BEST', 'PADAES', 'Compact2026'
  projetId?: string;         // rattachement projet
  ownerId?: string;          // créateur / responsable de l'objet
  confidentialityLevel?: ConfidentialityLevel;
}

/** Identité minimale de l'utilisateur courant pour l'évaluation d'accès. */
export interface SecuritySubject {
  userId: string;
  profile: UserOrgProfile;
  scope: VisibilityScope;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIDENTIALITÉ (Document Security)
// ─────────────────────────────────────────────────────────────────────────────

/** Niveau hiérarchique minimal requis (0=DPE … 3=Agent) selon la confidentialité. */
function niveauRequisPour(level: ConfidentialityLevel): 0 | 1 | 2 | 3 {
  switch (level) {
    case 'secret':      return 1; // directions & état-major
    case 'confidentiel':return 2; // + chefs de département / métiers transverses
    case 'interne':     return 3; // tout utilisateur authentifié
    case 'public':      return 3;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RATTACHEMENT ORGANISATIONNEL (Hierarchical / Row Level Security)
// ─────────────────────────────────────────────────────────────────────────────

function matchScope(ctx: SecurityContext, scope: VisibilityScope): boolean {
  if (scope.all) return true;

  const dep = (ctx.departementId ?? '').toUpperCase();
  const dir = canonDirectionKey(ctx.directionId ?? '');
  const prog = (ctx.programmeId ?? '').toUpperCase();

  // 1) Rattachement par DÉPARTEMENT (le plus précis).
  if (dep && scope.departements.some(d => d.toUpperCase() === dep)) return true;

  // 2) Rattachement par DIRECTION / UNITÉ.
  if (dir && (
    scope.directions.some(sd => canonDirectionKey(sd) === dir) ||
    scope.unites.some(su => canonDirectionKey(su) === dir)
  )) return true;

  // 3) Rattachement par PROGRAMME / bailleur.
  if (prog && (scope.programmes.includes('*') ||
    scope.programmes.some(sp => prog.includes(sp.toUpperCase()) || sp.toUpperCase().includes(prog)))) return true;

  // Objet sans rattachement organisationnel exploitable → traité comme transverse.
  if (!dep && !dir && !prog) return true;

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// DÉCISION D'ACCÈS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Décide si `subject` peut voir un objet portant `ctx`.
 * Combine : propriété (owner) → confidentialité → rattachement hiérarchique.
 */
export function canSeeObject(subject: SecuritySubject, ctx: SecurityContext): boolean {
  // Le propriétaire voit toujours son objet.
  if (ctx.ownerId && ctx.ownerId === subject.userId) return true;

  // Vision exhaustive (super-rôles, état-major, S&E).
  if (subject.scope.all) return true;

  // Document Security : la confidentialité borne par niveau hiérarchique.
  const level = ctx.confidentialityLevel ?? 'interne';
  const niveau = subject.scope.niveau ?? getNiveauHierarchique(subject.profile);
  if (niveau > niveauRequisPour(level)) return false;

  // Public = visible par tout authentifié (dans la limite de confidentialité ci-dessus).
  if (level === 'public') return true;

  // Hierarchical / Row Level Security : rattachement organisationnel.
  return matchScope(ctx, subject.scope);
}

/** Filtre une liste d'objets selon leur contexte de sécurité. */
export function filterSecured<T>(
  items: T[],
  getContext: (item: T) => SecurityContext,
  subject: SecuritySubject,
): T[] {
  return items.filter(item => canSeeObject(subject, getContext(item)));
}
