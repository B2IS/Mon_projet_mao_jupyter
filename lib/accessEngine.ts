/**
 * accessEngine.ts — Moteur d'Accès Intelligent SIGEPP-DPE
 * RBAC + ABAC + Organizational Hierarchy Security
 *
 * Principe : « Chaque utilisateur ne voit que son périmètre organisationnel
 *             et les niveaux inférieurs. »
 *
 * NIVEAU 0 (DPE) → NIVEAU 1 (Direction) → NIVEAU 2 (Département) → NIVEAU 3 (Agent)
 */

import type { RoleCode } from './authStore';
import {
  DPE_ORG, getDirectionOrg, canonDirectionKey,
  DEPT_TO_UNITES, unitesForDirection,
  type DirectionCoordination, type Departement,
} from './dpeOrgStructure';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface UserOrgProfile {
  role: RoleCode;
  direction: string;         // ex: 'DER', 'DEP', 'EM DPE', 'CC26'
  departement?: string;      // ex: 'DPT_TRANSPORT', 'DPD_DISTRIBUTION'
  cellule?: string;           // ex: 'CSE', 'CC26'
  poste?: string;
  fonction?: string;
}

export interface VisibilityScope {
  niveau: 0 | 1 | 2 | 3;
  directions: string[];      // directions visibles (codes)
  departements: string[];    // départements visibles (codes)
  unites: string[];          // unités projet visibles (ex: 'DPT','DPD','DEP'…)
  programmes: string[];      // programmes / bailleurs visibles ('*' = tous)
  domaines: string[];        // domaines métier visibles ('*' = tous)
  typesProjets: string[];    // types de projets visibles ('*' = tous)
  all: boolean;              // vision exhaustive du portefeuille (super-rôles)
}

/** Forme minimale d'un projet nécessaire pour décider de sa visibilité. */
export interface ProjetMinimal {
  id: string;
  departement?: string;
  programme?: string;
  domaine?: string;
  unite?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. NIVEAU HIÉRARCHIQUE (0=DPE · 1=Direction · 2=Département/Cellule · 3=Agent)
// ─────────────────────────────────────────────────────────────────────────────

const NIVEAU_0_ROLES: RoleCode[] = ['DIR_DPE', 'ADMIN', 'AUDIT', 'PMO'];
// Départements ET chefs de cellule (CPBM, CPADERAU, CPAMACEL, CC26) = rang département.
// Métiers transverses rattachés au niveau département : marchés, SIG, immo, contrôle travaux, finance.
const NIVEAU_2_ROLES: RoleCode[] = ['CHEF_DEPT', 'CTRL_FIN', 'MARCHES', 'SIG', 'IMMO', 'CONTROLEUR_TRAVAUX', 'RESP_LOG'];

export function getNiveauHierarchique(profile: UserOrgProfile): 0 | 1 | 2 | 3 {
  if (NIVEAU_0_ROLES.includes(profile.role)) return 0;
  if (NIVEAU_2_ROLES.includes(profile.role)) return 2;
  // Tous les autres (équipe projet, assistants, secrétaires, chauffeurs, experts) = agents.
  return 3;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. PÉRIMÈTRE DE VISIBILITÉ (RBAC + ABAC + Hiérarchie organisationnelle)
// ─────────────────────────────────────────────────────────────────────────────

const SUPER_ROLES: RoleCode[] = ['DIR_DPE', 'ADMIN', 'PMO', 'AUDIT'];

export function computeVisibilityScope(
  profile: UserOrgProfile,
  override?: { niveau?: 0 | 1 | 2 | 3 },
): VisibilityScope {
  const niveau = override?.niveau ?? getNiveauHierarchique(profile);
  const dir = getDirectionOrg(profile.direction);
  const dirKey = canonDirectionKey(profile.direction);

  // Vision exhaustive : super-rôles, état-major DPE, cellule suivi-évaluation, scope wildcard.
  const all =
    SUPER_ROLES.includes(profile.role) ||
    dirKey === 'EMDPE' || dirKey === 'CSE' ||
    !!dir && (dir.scopeDirections.includes('*') || dir.scopeProgrammes.includes('*'));

  if (all) {
    return {
      niveau, all: true,
      directions: ['*'], departements: ['*'], unites: ['*'],
      programmes: ['*'], domaines: ['*'], typesProjets: ['*'],
    };
  }

  // Directions visibles : scope propre de la direction (sinon elle-même).
  const directions = dir
    ? (dir.scopeDirections.length ? dir.scopeDirections : [dir.code])
    : (profile.direction ? [profile.direction] : []);

  // Unités projet visibles : enfants de la direction.
  let unites = dir ? unitesForDirection(dir.code) : unitesForDirection(profile.direction);

  // Départements visibles.
  let departements = dir ? dir.departements.map(d => d.code) : [];

  let programmes = dir ? (dir.scopeProgrammes.length ? dir.scopeProgrammes : dir.programmes) : [];
  let domaines = dir ? dir.domaine : [];
  let typesProjets = dir ? dir.typesProjets : [];

  // ── AFFECTATION (clé de la MMH : Poste + Unité + Affectation + Niveau) ──
  // Dès qu'un agent est AFFECTÉ à un département précis (DPT, DPD, DEP_PEC…), il est
  // RESTREINT à CE département — quel que soit son niveau. C'est ce qui distingue
  // « Chef Projet DPT » de « Chef Projet DPD » : mêmes modules, données différentes.
  // Un Directeur de direction (DER/DEP/DGC/DIT) n'a PAS de département affecté → il
  // conserve la vision de toute sa direction (DER ⊃ DPT + DPD, mais jamais DEP).
  if (profile.departement) {
    departements = [profile.departement];
    const deptUnites = DEPT_TO_UNITES[profile.departement];
    if (deptUnites && deptUnites.length) unites = deptUnites;
    // IMPORTANT : on neutralise les filtres LARGES (programme / domaine / type) de la
    // direction, sinon un agent DPD matcherait des projets DPT via le programme
    // « BEST » ou le domaine partagé. Le rattachement DÉPARTEMENT + UNITÉ suffit.
    programmes = [];
    domaines = [];
    typesProjets = [];
  }

  return { niveau, all: false, directions, departements, unites, programmes, domaines, typesProjets };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. VISIBILITÉ D'UN PROJET DANS LE PÉRIMÈTRE
// ─────────────────────────────────────────────────────────────────────────────

export function isProjectVisible(projet: ProjetMinimal, scope: VisibilityScope): boolean {
  if (scope.all || scope.unites.includes('*')) return true;

  const u = canonDirectionKey(projet.unite ?? '');
  const dep = (projet.departement ?? '').toUpperCase();
  const prog = (projet.programme ?? '').toUpperCase();
  const dom = (projet.domaine ?? '').toLowerCase();

  // 1) Rattachement par DÉPARTEMENT (le plus précis).
  if (dep && scope.departements.some(d => d.toUpperCase() === dep)) return true;

  // 2) Rattachement par UNITÉ projet (DPT / DPD / DEP / DIT…).
  if (u && scope.unites.some(su => canonDirectionKey(su) === u)) return true;

  // 3) Rattachement par PROGRAMME / bailleur.
  if (prog && (scope.programmes.includes('*') || scope.programmes.some(sp => prog.includes(sp.toUpperCase()) || sp.toUpperCase().includes(prog)))) return true;

  // 4) Repli par DOMAINE métier (uniquement si la direction n'a pas de rattachement plus précis).
  if (dom && (scope.domaines.includes('*') || scope.domaines.some(sd => dom.includes(sd.toLowerCase())))) return true;

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. VÉRIFICATION DE DROIT SPÉCIFIQUE (RBAC)
// ─────────────────────────────────────────────────────────────────────────────

export function canPerformAction(
  action: 'CREER_PROJET' | 'VALIDER_MARCHE' | 'MODIFIER_BUDGET' | 'SUPPRIMER_PROJET' | 'VOIR_TOUT_PORTEFEUILLE' | 'EXPORTER_DONNEES',
  user: UserOrgProfile
): boolean {
  const niveau = getNiveauHierarchique(user);

  // AUDIT : lecture seule globale — aucune action d'écriture, mais consultation totale.
  if (user.role === 'AUDIT') return action === 'VOIR_TOUT_PORTEFEUILLE' || action === 'EXPORTER_DONNEES';

  switch (action) {
    case 'VOIR_TOUT_PORTEFEUILLE':
      return niveau <= 1; // NIVEAU 0 ou 1
    case 'CREER_PROJET':
      return niveau <= 2; // NIVEAU 0, 1, 2
    case 'VALIDER_MARCHE':
      return niveau <= 1 || user.role === 'CTRL_FIN';
    case 'MODIFIER_BUDGET':
      return niveau <= 1 || user.role === 'CTRL_FIN';
    case 'SUPPRIMER_PROJET':
      return niveau <= 1;
    case 'EXPORTER_DONNEES':
      return niveau <= 2;
    default:
      return false;
  }
}

// ─── Export rapide ─────────────────────────────────────────────────────────
export { DPE_ORG, getDirectionOrg };
