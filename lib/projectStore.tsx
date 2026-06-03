'use client';

/**
 * projectStore.tsx — Global mutable state for SENELEC DPE platform.
 * Single source of truth: Projects, WBS Tasks, Resources, Assignments.
 * All components share this context; mutations propagate instantly.
 */

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { useAuth, type RoleCode } from '@/lib/authStore';
import { computeVisibilityScope, isProjectVisible, type UserOrgProfile } from '@/lib/accessEngine';
import { PERSONNEL_DPE } from '@/lib/dpePersonnel';
import { logAudit, type AuditType } from '@/lib/auditStore';

/** Journalise une action dans le journal d'audit (CCF ADM-03), avec l'utilisateur courant. */
function auditLog(action: string, objet: string, type: AuditType, detail?: string, direction?: string): void {
  try {
    const u = JSON.parse(localStorage.getItem('sigepp_dpe_user') || 'null');
    logAudit({ utilisateur: u ? `${u.prenom} ${u.nom}` : 'Système', email: u?.email, role: u?.role,
      action, objet, type, detail, direction: direction ?? u?.direction });
  } catch { /* SSR / pas d'utilisateur */ }
}

/** Normalise un nom de personne : minuscules, sans accents, espaces compactés. */
function normalizeName(s: string | undefined): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// ─────────────────────────────────── TYPES ───────────────────────────────────

/**
 * Domaines projet OFFICIELS SENELEC — DPE (contexte métier : Électricité).
 * Les 4 domaines structurent l'ensemble des projets du portefeuille DPE :
 *  - production    : Production d'énergie (thermique, solaire, éolien, hydro, biomasse)
 *  - transport     : Transport HTB/HTA (lignes THT, postes HT, interconnexions)
 *  - distribution  : Distribution HTA/BT (réseaux HTA/BT, postes source, branchements,
 *                    électrification rurale, accès universel — extension du réseau de distribution)
 *  - commercial    : Technologies Commerciales (AMI, compteurs intelligents, prépaiement,
 *                    GRC, digitalisation client, smart grid côté client)
 *
 * Le Génie Civil (DGC) est une DIRECTION SUPPORT, pas un domaine projet :
 * ses ouvrages sont rattachés au domaine du projet qu'ils servent.
 */
// Domaines métier officiels SENELEC (l'électrification/accès relève de la Distribution).
// `genie_civil` = « métier 0 » : projets propres de la Direction Génie Civil (DGC) —
// bâtiments, routes, ouvrages d'art sur sites SENELEC ou travaux GC autonomes (ND 005/2023).
export type Domaine = 'production' | 'transport' | 'distribution' | 'commercial' | 'genie_civil';
export type StatutProjet = 'en_cours' | 'planifie' | 'termine' | 'en_retard' | 'suspendu' | 'archive';
export type TypeTache = 'Normale' | 'Récapitulative' | 'Jalon';
export type DepType = 'FS' | 'SS' | 'FF' | 'SF';
export type TypeRessource = 'Travail' | 'Matériel' | 'Coût';
export type StatutTache = 'a_faire' | 'en_cours' | 'bloque' | 'termine';
export type Priorite = 'Haute' | 'Moyenne' | 'Faible';
export type DeviseCode = 'FCFA' | 'USD' | 'EUR' | 'GBP' | 'CNY' | 'DKK' | 'JPY' | 'CAD';

// ─────────────────────────── PHASES PROJET ─────────────────────────────────
// Phases de projet génériques avec pondération configurable par projet.
// Le modèle à 7 phases (Préparation, Études, Approvisionnement, Travaux, Réception, Clôture)
// est utilisé par défaut pour tous les projets. Chaque projet peut avoir ses propres poids.
export type PhaseId =
  // Cycle standard DPE (6 phases pondérées — identique pour TOUS les projets)
  | 'passations'
  | 'etudes'
  | 'fournitures'
  | 'travaux'
  | 'mise_en_service'
  | 'cloture'
  // Anciens identifiants conservés pour compatibilité (données héritées)
  | 'preparation'
  | 'etude_conception'
  | 'etude_execution'
  | 'approvisionnement'
  | 'reception_mes';

export interface PhaseProjet {
  id: PhaseId;
  label: string;
  poids: number;   // pondération en % (somme = 100)
  avancement: number; // 0–100
}

/**
 * Cycle de vie standard DPE — 6 phases pondérées, IDENTIQUES pour tous les projets.
 * Pondération officielle : Passations 10 · Études 10 · Fournitures 20 · Travaux 52
 * · Mise en Service 5 · Clôture 3 (somme = 100). L'avancement physique est la
 * somme pondérée de l'avancement de chaque phase.
 */
export const PHASES_DEFAUT: PhaseProjet[] = [
  { id: 'passations',      label: 'Passations',      poids: 10, avancement: 0 },
  { id: 'etudes',          label: 'Études',          poids: 10, avancement: 0 },
  { id: 'fournitures',     label: 'Fournitures',     poids: 20, avancement: 0 },
  { id: 'travaux',         label: 'Travaux',         poids: 52, avancement: 0 },
  { id: 'mise_en_service', label: 'Mise en Service', poids:  5, avancement: 0 },
  { id: 'cloture',         label: 'Clôture',         poids:  3, avancement: 0 },
];

/**
 * Conservé pour compatibilité : la pondération est désormais unique pour tous les
 * projets (le DPE impose le même cycle). PHASES_BEST est un alias de PHASES_DEFAUT.
 */
export const PHASES_BEST: PhaseProjet[] = PHASES_DEFAUT.map(p => ({ ...p }));

/**
 * Répartit un avancement global pondéré (0–100) sur les 6 phases standard, en
 * remplissant les phases dans l'ordre du cycle (les premières se terminent avant).
 * Garantit que computeAvancementReel(résultat) ≈ av.
 */
export function mkPhases(av: number): PhaseProjet[] {
  let reste = Math.max(0, Math.min(100, av)); // points pondérés restants à placer
  return PHASES_DEFAUT.map(ph => {
    const pris = Math.max(0, Math.min(ph.poids, reste));
    reste -= pris;
    return { ...ph, avancement: Math.round((pris / ph.poids) * 100) };
  });
}

/** Calcule le taux d'avancement réel pondéré */
export function computeAvancementReel(phases: PhaseProjet[]): number {
  const totalPoids = phases.reduce((s, p) => s + p.poids, 0);
  if (totalPoids === 0) return 0;
  const weighted   = phases.reduce((s, p) => s + (p.poids * p.avancement) / 100, 0);
  return Math.round((weighted / totalPoids) * 10000) / 100; // 2 décimales
}

// ─────────────────────────── DEVISES ─────────────────────────────────────────
export const DEVISES_LABEL: Record<DeviseCode, string> = {
  FCFA: 'Franc CFA (FCFA)',
  USD:  'Dollar US (USD)',
  EUR:  'Euro (EUR)',
  GBP:  'Livre Sterling (GBP)',
  CNY:  'Yuan Renminbi (CNY)',
  DKK:  'Couronne danoise (DKK)',
  JPY:  'Yen japonais (JPY)',
  CAD:  'Dollar canadien (CAD)',
};

/** Taux de change de référence par rapport au FCFA (modifiables par contrat) */
export const TAUX_CHANGE_DEFAUT: Record<DeviseCode, number> = {
  FCFA: 1,
  USD:  600,   // 1 USD ≈ 600 FCFA
  EUR:  655.957, // taux fixe BCEAO
  GBP:  760,
  CNY:  83,
  DKK:  88,
  JPY:  4.05,
  CAD:  440,
};

export interface Bailleur {
  nom: string;
  montant: number;
  devise: 'FCFA' | 'EUR' | 'USD';
  pourcentage: number;
}

export interface Predecesseur {
  tacheId: string;
  type: DepType;
  delai: number; // jours (peut être négatif)
}

export interface Assignation {
  id: string;
  tacheId: string;
  ressourceId: string;
  unite: number; // 0–100 (% d'allocation)
  travailPrevu?: number; // heures
  travailReel?: number;
}

export interface TacheWBS {
  id: string;
  projetId: string;
  nom: string;
  type: TypeTache;
  niveau: number; // 1=racine récap, 2=sous-tâche, 3=détail…
  ordre: number; // position dans le tri
  duree: number; // jours ouvrés
  dateDebut: string; // 'YYYY-MM-DD'
  dateFin: string;
  avancement: number; // 0–100
  statutTache: StatutTache;
  priorite: Priorite;
  predecesseurs: Predecesseur[];
  assignations: Assignation[];
  commentaire?: string;
  reference?: boolean; // baseline saved
  dateDebutRef?: string;
  dateFinRef?: string;
  dureeRef?: number;
  coutRef?: number;
  coutReel?: number;
  coutPrevu?: number;
}

export interface Ressource {
  id: string;
  nom: string;
  prenom: string;
  type: TypeRessource;
  capaciteMax: number; // % (100 = plein temps)
  tauxHoraire: number; // FCFA/h
  unite?: string; // pour matériel
  direction?: string;
  poste?: string;
  mle?: string;
  email?: string;
  telephone?: string;
}

export interface Jalon {
  label: string;
  date: string;
  atteint: boolean;
}

export interface Projet {
  id: string;
  domaine: Domaine;
  nom: string;
  code: string;
  description: string;
  objectif?: string;
  /** Contexte & justification — propre à chaque projet (modifiable dans la fiche). */
  contexte?: string;
  /** Objectifs spécifiques du projet (liste, modifiable dans la fiche). */
  objectifs?: string[];
  /** Livrables attendus (liste, modifiable dans la fiche). */
  livrables?: string[];
  chefProjet: string;
  localisation: string;
  region: string;
  lat?: number;
  lng?: number;
  avancement: number;
  avancementPlanifie: number;
  avancementReel?: number; // taux pondéré réel (calculé depuis phases)
  budget: number;           // budget total en MFCFA (part fixe + équivalent FCFA part étrangère)
  budgetEngage: number;     // MFCFA
  budgetDecaisse: number;   // MFCFA
  // ── Budget dual-devise — optionnel si projet 100% FCFA ──
  partFixeFCFA?: number;      // part en devise locale (MFCFA)
  partEtrangere?: number;     // montant part étrangère (dans deviseEtrangere)
  deviseEtrangere?: DeviseCode; // devise de la part étrangère
  tauxChange?: number;         // 1 deviseEtrangere = tauxChange FCFA (modifiable par contrat)
  // ── Planning ──────────────────────────────────────────────────────────
  dateDebut: string; // 'YYYY-MM-DD'
  dateFinPrevue: string;
  dateFinEstimee: string;
  statut: StatutProjet;
  priorite: Priorite;
  cpi: number;
  spi: number;
  bailleurs: Bailleur[];
  equipe: string[]; // ressource ids
  jalons: Jalon[];
  taches: TacheWBS[];
  phases?: PhaseProjet[]; // phases du projet avec pondération propre
  typePonderation?: 'standard' | 'BEST' | 'custom'; // quel modèle de pondération
  dateCreation: string;
  dateModification: string;
  motifSuspension?: string;
  baselineSaved?: boolean;
  baselineDate?: string;
  unite?: string;  // ex. "DPD", "DPT", "DIT", "PAMACEL", "PADERAU", "CPBM-UE"
  programme?: string; // ex. "PADAES", "PADERAU", "PES"
  departement?: string; // ex. "DPT_TRANSPORT", "DPD_DISTRIBUTION", "DEP_PER" — NIVEAU 2 hiérarchie DPE
  metadata?: Record<string, any>; // Pour l'ajout de champs/colonnes dynamiques par l'utilisateur
  /** IDs des utilisateurs délégués par le chef de projet pour modifier le projet. */
  delegues?: string[];
}

// ─────────────────────────────── INITIAL DATA ────────────────────────────────

const now = new Date().toISOString().split('T')[0];

/** Code direction normalisé à partir du libellé du fichier personnel DPE. */
function dirCodeFromPersonnel(dir: string): string {
  const d = (dir || '').toUpperCase().replace(/\s+/g, '').replace(/-/g, '');
  if (d.startsWith('EMDPE')) return 'EM_DPE';
  if (d.startsWith('CPBM')) return 'CPBM_UE';
  if (d.startsWith('CPAMACEL')) return 'CPAMACEL_EE';
  if (d.startsWith('CPADERAU')) return 'CPADERAU';
  if (d.startsWith('CC26')) return 'CC26';
  if (d.startsWith('CSE')) return 'CSE';
  if (d.startsWith('DER')) return 'DER';
  if (d.startsWith('DEP')) return 'DEP';
  if (d.startsWith('DGC')) return 'DGC';
  if (d.startsWith('DIT')) return 'DIT';
  return dir || '';
}

/** Taux horaire indicatif (FCFA/h) selon la fonction réelle. */
function tauxHoraireFor(fonction: string): number {
  const f = (fonction || '').toLowerCase();
  if (f.includes('directeur')) return 18000;
  if (f.includes('chef de département') || f.includes('chef de departement')) return 15000;
  if (f.includes('coordonnateur') || f.includes('coordinateur')) return 15000;
  if (f.includes('chef de service') || f.includes('chef unité') || f.includes('chef unite') || f.includes('chef uagl') || f.includes('chef de groupe')) return 13000;
  if (f.includes('expert')) return 12500;
  if (f.includes('chef de projet')) return 12000;
  if (f.includes('ingénieur') || f.includes('ingenieur')) return 11000;
  if (f.includes('responsable')) return 11000;
  if (f.includes('contrôleur') || f.includes('controleur')) return 9000;
  if (f.includes('chargé') || f.includes('charge')) return 9000;
  if (f.includes('comptable')) return 9000;
  if (f.includes('assistant')) return 7000;
  if (f.includes('secrétaire') || f.includes('secretaire')) return 6500;
  if (f.includes('chauffeur')) return 5000;
  return 8000;
}

function emailFor(prenom: string, nom: string): string {
  const p = (prenom || '').split(' ')[0].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const n = (nom || '').toLowerCase().replace(/\s+/g, '').normalize('NFD').replace(/[̀-ͯ]/g, '');
  return `${p}.${n}@senelec.sn`;
}

/**
 * Ressources « Travail » = personnel RÉEL de la DPE (fichier du 10/03/2026).
 * Aucune personne inventée : sélection directe depuis le roster officiel.
 */
const PERSONNEL_RESSOURCES: Ressource[] = PERSONNEL_DPE.map((p) => ({
  id: `r-${p.mle}`,
  nom: p.nom,
  prenom: p.prenom,
  type: 'Travail' as const,
  capaciteMax: 100,
  tauxHoraire: tauxHoraireFor(p.fonction || p.poste || ''),
  direction: dirCodeFromPersonnel(p.direction),
  poste: p.poste,
  mle: p.mle,
  email: emailFor(p.prenom, p.nom),
}));

const MATERIELS_RESSOURCES: Ressource[] = [
  { id: 'r11', nom: 'Câbles HTA', prenom: '', type: 'Matériel', capaciteMax: 999, tauxHoraire: 0, unite: 'km' },
  { id: 'r12', nom: 'Transformateurs 160kVA', prenom: '', type: 'Matériel', capaciteMax: 999, tauxHoraire: 0, unite: 'unité' },
  { id: 'r13', nom: 'Pylônes acier', prenom: '', type: 'Matériel', capaciteMax: 999, tauxHoraire: 0, unite: 'unité' },
  { id: 'r14', nom: 'Sous-traitance GC', prenom: '', type: 'Coût', capaciteMax: 999, tauxHoraire: 0 },
];

const RESSOURCES_INIT: Ressource[] = [...PERSONNEL_RESSOURCES, ...MATERIELS_RESSOURCES];

/**
 * Mappe l'unité/département d'un projet vers le code direction du roster RÉEL.
 * Les unités de la DPE (DPD, DPT) relèvent de la DER ; les cellules/directions
 * propres (CPADERAU, DEP, DIT, DGC) ont leur propre vivier de personnel.
 */
function directionPourUnite(unite: string, departement?: string): string {
  const u = (unite || departement || '').toUpperCase();
  if (u.startsWith('CPADERAU')) return 'CPADERAU';
  if (u.startsWith('DEP')) return 'DEP';
  if (u.startsWith('DIT')) return 'DIT';
  if (u.startsWith('DGC')) return 'DGC';
  // DPD / DPT et tout le reste : personnel rattaché à la DER (Direction Études & Réalisation)
  return 'DER';
}

/**
 * Construit une équipe COHÉRENTE avec l'unité RÉELLE du projet : uniquement des
 * agents dont le rattachement correspond exactement au département du projet.
 *
 * Point clé : DPD et DPT partagent la même direction « DER » dans le roster — on
 * NE peut donc PAS filtrer sur `direction`, sinon un agent DPT (ex. Cheikh FALL,
 * « Ingénieur d'Étude / DPT ») se retrouverait à tort dans une équipe DPD. Le
 * département figure dans le suffixe du `poste` (« … / DPD », « … / DPT »), c'est
 * donc lui qui sert de discriminant pour DPD/DPT. Pour les autres unités
 * (CPADERAU, DEP, DIT, DGC), le code direction suffit. Le chef de projet est exclu.
 */
function equipeParUnite(unite: string, chefProjet: string, n = 4, departement?: string, offset = 0): string[] {
  const u = (unite || departement || '').toUpperCase();
  const chef = normalizeName(chefProjet);
  let pool: Ressource[];
  if (u.startsWith('DPD') || u.startsWith('DPT')) {
    const tok = u.startsWith('DPT') ? 'DPT' : 'DPD';
    pool = PERSONNEL_RESSOURCES.filter(r => (r.poste || '').toUpperCase().includes(tok));
  } else {
    const dir = directionPourUnite(unite, departement);
    pool = PERSONNEL_RESSOURCES.filter(r => r.direction === dir);
  }
  // Les MEMBRES d'équipe sont des exécutants (ingénieurs, techniciens, chargés…),
  // PAS d'autres chefs de projet/département : sans cela, un chef de projet serait
  // automatiquement « membre » de tous les projets de l'unité et les verrait tous,
  // alors qu'il ne pilote que les siens (règle d'implication ND 005/2023).
  const isLeader = (poste?: string) => /chef de projet|chef de d[ée]partement|chef de division/i.test(poste || '');
  let eligibles = pool.filter(r => normalizeName(`${r.prenom} ${r.nom}`) !== chef && !isLeader(r.poste));
  if (eligibles.length === 0) eligibles = pool.filter(r => normalizeName(`${r.prenom} ${r.nom}`) !== chef);
  if (eligibles.length === 0) return [];
  // ROTATION par projet : chaque projet reçoit une tranche DIFFÉRENTE du vivier,
  // afin que les équipes varient réellement d'un projet à l'autre. Sans cela, les
  // mêmes premiers agents se retrouveraient dans TOUTES les équipes de l'unité, ce
  // qui ferait « voir » tout le portefeuille à un simple membre (règle d'implication
  // ND 005/2023 vidée de son sens). L'offset dérive de l'identifiant du projet.
  const off = ((offset % eligibles.length) + eligibles.length) % eligibles.length;
  const rotated = [...eligibles.slice(off), ...eligibles.slice(0, off)];
  return rotated.slice(0, Math.max(0, n)).map(r => r.id);
}

/** Offset numérique stable dérivé d'un id projet (« prj-043 » → 43). */
function offsetFromId(id: string): number {
  const m = (id || '').match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

function makeTaches(projetId: string, domaine: Domaine, dateDebut: string): TacheWBS[] {
  const templates: Record<Domaine, { nom: string; duree: number; niveau: number }[]> = {
    production: [
      { nom: 'Études & Conception', duree: 60, niveau: 1 },
      { nom: 'Études APS', duree: 20, niveau: 2 },
      { nom: 'Études APD', duree: 25, niveau: 2 },
      { nom: 'Validation technique', duree: 15, niveau: 2 },
      { nom: 'Génie Civil', duree: 90, niveau: 1 },
      { nom: 'Terrassement & fondations', duree: 30, niveau: 2 },
      { nom: 'Bâtiments & structures', duree: 60, niveau: 2 },
      { nom: 'Génie Électromécanique', duree: 120, niveau: 1 },
      { nom: 'Fourniture équipements', duree: 45, niveau: 2 },
      { nom: 'Installation & câblage', duree: 60, niveau: 2 },
      { nom: 'Tests & mise en service', duree: 15, niveau: 2 },
      { nom: 'Clôture du projet', duree: 10, niveau: 1 },
    ],
    transport: [
      { nom: 'Études tracé & conception', duree: 75, niveau: 1 },
      { nom: 'Études topographiques', duree: 20, niveau: 2 },
      { nom: 'Études APD ligne', duree: 40, niveau: 2 },
      { nom: 'Validation DER', duree: 15, niveau: 2 },
      { nom: 'Acquisitions foncières', duree: 60, niveau: 1 },
      { nom: 'Enquêtes & servitudes', duree: 30, niveau: 2 },
      { nom: 'Indemnisations', duree: 30, niveau: 2 },
      { nom: 'Travaux ligne', duree: 150, niveau: 1 },
      { nom: 'Fondations pylônes', duree: 45, niveau: 2 },
      { nom: 'Montage pylônes', duree: 50, niveau: 2 },
      { nom: 'Tirage câbles conducteurs', duree: 35, niveau: 2 },
      { nom: 'Postes extrémités & essais', duree: 30, niveau: 2 },
      { nom: 'Clôture du projet', duree: 10, niveau: 1 },
    ],
    distribution: [
      { nom: 'Études réseau', duree: 45, niveau: 1 },
      { nom: 'Audit réseau existant', duree: 15, niveau: 2 },
      { nom: 'Dimensionnement HTA/BT', duree: 20, niveau: 2 },
      { nom: 'Plans d\'exécution', duree: 10, niveau: 2 },
      { nom: 'Approvisionnement', duree: 60, niveau: 1 },
      { nom: 'Matériels réseaux HTA/BT', duree: 30, niveau: 2 },
      { nom: 'Transformateurs & cabines', duree: 30, niveau: 2 },
      { nom: 'Travaux terrain', duree: 120, niveau: 1 },
      { nom: 'Pose réseaux HTA/BT', duree: 60, niveau: 2 },
      { nom: 'Branchements & comptage', duree: 40, niveau: 2 },
      { nom: 'Réception technique', duree: 20, niveau: 2 },
      { nom: 'Clôture du projet', duree: 10, niveau: 1 },
    ],
    commercial: [
      { nom: 'Cadrage & spécifications', duree: 30, niveau: 1 },
      { nom: 'Atelier de cadrage', duree: 10, niveau: 2 },
      { nom: 'Cahier des charges fonctionnel', duree: 20, niveau: 2 },
      { nom: 'Développement & intégration', duree: 90, niveau: 1 },
      { nom: 'Développement modules core', duree: 60, niveau: 2 },
      { nom: 'Intégration SI Senelec', duree: 30, niveau: 2 },
      { nom: 'Tests & recette', duree: 30, niveau: 1 },
      { nom: 'Tests unitaires & UAT', duree: 20, niveau: 2 },
      { nom: 'Corrections & optimisation', duree: 10, niveau: 2 },
      { nom: 'Déploiement & formation', duree: 20, niveau: 1 },
      { nom: 'Déploiement progressif', duree: 10, niveau: 2 },
      { nom: 'Formation utilisateurs', duree: 10, niveau: 2 },
    ],
    genie_civil: [
      { nom: 'Études & Conception GC', duree: 45, niveau: 1 },
      { nom: 'Études géotechniques & topo', duree: 20, niveau: 2 },
      { nom: 'Plans d\'architecture & structure', duree: 25, niveau: 2 },
      { nom: 'Autorisations & permis', duree: 30, niveau: 1 },
      { nom: 'Permis de construire', duree: 20, niveau: 2 },
      { nom: 'Études d\'impact environnemental', duree: 20, niveau: 2 },
      { nom: 'Gros œuvre', duree: 120, niveau: 1 },
      { nom: 'Terrassement & fondations', duree: 40, niveau: 2 },
      { nom: 'Structures & élévation', duree: 80, niveau: 2 },
      { nom: 'Second œuvre & VRD', duree: 60, niveau: 1 },
      { nom: 'Corps d\'état techniques', duree: 35, niveau: 2 },
      { nom: 'Voiries & réseaux divers', duree: 25, niveau: 2 },
      { nom: 'Réception & livraison', duree: 20, niveau: 1 },
      { nom: 'Levée des réserves', duree: 15, niveau: 2 },
      { nom: 'Clôture du projet', duree: 10, niveau: 1 },
    ],
  };

  const tmpl = templates[domaine] ?? templates.distribution;
  let cursor = new Date(dateDebut);
  const addJours = (d: Date, j: number): Date => {
    const r = new Date(d);
    let added = 0;
    while (added < j) {
      r.setDate(r.getDate() + 1);
      if (r.getDay() !== 0 && r.getDay() !== 6) added++;
    }
    return r;
  };

  return tmpl.map((t, i) => {
    const debut = cursor.toISOString().split('T')[0];
    const fin = addJours(cursor, t.duree).toISOString().split('T')[0];
    if (t.niveau === 1) cursor = addJours(cursor, t.duree);
    return {
      id: `${projetId}-t${i + 1}`,
      projetId,
      nom: t.nom,
      type: (t.niveau === 1 ? 'Récapitulative' : i === 0 ? 'Normale' : 'Normale') as TypeTache,
      niveau: t.niveau,
      ordre: i + 1,
      duree: t.duree,
      dateDebut: debut,
      dateFin: fin,
      avancement: i < 3 ? 100 : i < 6 ? Math.floor(Math.random() * 60 + 10) : 0,
      statutTache: i < 3 ? 'termine' : i < 7 ? 'en_cours' : 'a_faire',
      priorite: i === 0 ? 'Haute' : 'Moyenne',
      predecesseurs: i > 0 ? [{ tacheId: `${projetId}-t${i}`, type: 'FS', delai: 0 }] : [],
      assignations: [],
    };
  });
}

/**
 * mkMatrixProjet — fabrique compacte d'un Projet réel issu des matrices
 * d'identification DPD / DPT (fév. 2026). Réduit la verbosité tout en
 * garantissant des champs cohérents (budgets MFCFA, CPI/SPI, jalons, tâches).
 * Le `chefProjet` DOIT correspondre au « prénom nom » du compte de connexion
 * pour que la visibilité par implication (ND 005/2023) fonctionne.
 */
function mkMatrixProjet(o: {
  id: string;
  domaine: Domaine;
  nom: string;
  code: string;
  chefProjet: string;
  region: string;
  localisation: string;
  lat?: number;
  lng?: number;
  budget: number;
  avancement: number;
  unite: string;
  departement: string;
  programme?: string;
  bailleur?: string;
  dateDebut?: string;
  dateFinPrevue?: string;
  statut?: StatutProjet;
  priorite?: Priorite;
  description?: string;
  /** Décaissement réel (M FCFA) issu de la matrice ; sinon estimé depuis l'avancement. */
  budgetDecaisse?: number;
}): Projet {
  const debut = o.dateDebut ?? '2024-01-01';
  const finP = o.dateFinPrevue ?? '2027-12-31';
  const av = Math.max(0, Math.min(100, o.avancement));
  const avPlan = Math.min(100, Math.round(av * 1.08));
  // Budget : si la matrice ne renseigne pas de montant (0), on estime une enveloppe
  // plausible afin d'éviter l'affichage « 0 MFCFA » et les divisions NaN. Cette
  // estimation est remplacée dès qu'une fiche projet/document est chargée.
  const budget = o.budget && o.budget > 0 ? Math.round(o.budget) : 1500;
  // Décaissé réel (matrice) prioritaire ; borné au budget. Sinon estimation.
  const dec = o.budgetDecaisse !== undefined && o.budgetDecaisse >= 0
    ? Math.min(Math.round(o.budgetDecaisse), budget)
    : Math.round(budget * (av / 100) * 0.78);
  const eng = Math.max(dec, Math.round(budget * (av / 100) * 1.05));
  return {
    id: o.id,
    domaine: o.domaine,
    nom: o.nom,
    code: o.code || o.id.toUpperCase(),
    description: o.description ?? o.nom,
    objectif: o.description ?? o.nom,
    chefProjet: o.chefProjet,
    localisation: o.localisation,
    region: o.region,
    lat: o.lat,
    lng: o.lng,
    avancement: av,
    avancementPlanifie: avPlan,
    avancementReel: Math.max(0, av - 1),
    budget,
    budgetEngage: eng,
    budgetDecaisse: dec,
    dateDebut: debut,
    dateFinPrevue: finP,
    dateFinEstimee: finP,
    statut: o.statut ?? (av >= 100 ? 'termine' : av <= 0 ? 'planifie' : 'en_cours'),
    priorite: o.priorite ?? 'Moyenne',
    cpi: 0.97,
    spi: 0.93,
    bailleurs: [{ nom: o.bailleur ?? 'SENELEC', montant: budget, devise: 'FCFA', pourcentage: 100 }],
    equipe: equipeParUnite(o.unite, o.chefProjet, 4, o.departement, offsetFromId(o.id)),
    jalons: [
      { label: 'Démarrage / ODS', date: debut, atteint: av > 5 },
      { label: 'Mi-parcours', date: finP, atteint: av >= 50 },
      { label: 'Réception provisoire', date: finP, atteint: av >= 100 },
    ],
    phases: mkPhases(av),
    taches: makeTaches(o.id, o.domaine, debut),
    unite: o.unite,
    departement: o.departement,
    programme: o.programme ?? 'BIT',
    dateCreation: debut,
    dateModification: now,
  };
}

const PROJETS_INIT: Projet[] = [
  // ─── PORTEFEUILLE RÉEL — Source unique de vérité ───
  // Généré depuis : « Matrice DPD Fevrier 2026.xlsx » (53 projets, Distribution)
  //               + « Matrice Suivi projets DPT au 28 Fevrier 2026.xlsx » (24 projets, Transport).
  // 77 projets — budgets/décaissés/avancements/statuts fidèles aux matrices (Fév. 2026).
  // chefProjet = prénom nom exact du personnel DPE → visibilité par implication (ND 005/2023).
  mkMatrixProjet({ id: 'prj-001', domaine: 'distribution', code: '', nom: 'Travaux Programme d\'Urgence Electrification Rurale -2010-2011- Convention 20- phase1', chefProjet: 'Ababacar KA', region: 'Multi-régions', localisation: 'Multi-régions', budget: 365, budgetDecaisse: 364, avancement: 98, unite: 'DPD', departement: 'DPD_DISTRIBUTION', statut: 'en_cours' }),
  mkMatrixProjet({ id: 'prj-002', domaine: 'distribution', code: '', nom: 'Travaux Programme d\'Urgence Electrification Rurale -2010-2011- Convention 20- phase1', chefProjet: 'Ababacar KA', region: 'Multi-régions', localisation: 'Multi-régions', budget: 667, budgetDecaisse: 358, avancement: 76, unite: 'DPD', departement: 'DPD_DISTRIBUTION', statut: 'en_cours' }),
  mkMatrixProjet({ id: 'prj-003', domaine: 'distribution', code: '22DM10014027', nom: 'REHABILITATION DE LA SOUS STATION 30 kV DE LOUGA', chefProjet: 'Ndiémé GUEYE', region: 'Louga', localisation: 'Louga', budget: 813, budgetDecaisse: 783, avancement: 95, unite: 'DPD', departement: 'DPD_DISTRIBUTION', statut: 'en_cours', dateFinPrevue: '2025-03-20' }),
  mkMatrixProjet({ id: 'prj-004', domaine: 'distribution', code: '22DM10014028', nom: 'Réhabilitation des postes de manœuvre de la boucle 30 kV de Touba (renouvellement des cellules iraniennes)', chefProjet: 'El Hadji Moussa SOW', region: 'Multi-régions', localisation: 'Multi-régions', budget: 2300, budgetDecaisse: 1414, avancement: 58, unite: 'DPD', departement: 'DPD_DISTRIBUTION', statut: 'en_cours', dateDebut: '2024-07-27', dateFinPrevue: '2026-02-28' }),
  mkMatrixProjet({ id: 'prj-005', domaine: 'distribution', code: '18DX30211498', nom: 'AOI N° 24/2019 ;L20-Sécurisation alimentation électrique de KARMEL et amélioration qualité de service des feeders T32 ; T31 ; Rufisque Nord et Km 22', chefProjet: 'Abdourahmane Diallo', region: 'Multi-régions', localisation: 'Multi-régions', budget: 2793, budgetDecaisse: 2262, avancement: 84, unite: 'DPD', departement: 'DPD_DISTRIBUTION', statut: 'en_cours', dateDebut: '2019-11-01' }),
  mkMatrixProjet({ id: 'prj-006', domaine: 'distribution', code: '21DE10453882', nom: 'BOUCLE 225kV DU FERLO (MATAM 2 (NDIOUM) – LINGUERE – TOUBA) (Partie Distribution).', chefProjet: 'Adama KAMA', region: 'Matam', localisation: 'Matam', budget: 13836, budgetDecaisse: 11836, avancement: 99, unite: 'DPD', departement: 'DPD_DISTRIBUTION', statut: 'termine', dateDebut: '2023-02-14' }),
  mkMatrixProjet({ id: 'prj-007', domaine: 'distribution', code: '', nom: 'Construction de la Liaison 225 kV Tanaf – Ziguinchor Contrat n°T2965/21-DK Avenant n°2 au contrat n°T1810/16 DK « Construction de la ligne 225 kV Tamba-Kolda-Ziguinchor et extension et réhabilitation des réseaux dans les région »', chefProjet: 'Adama KAMA', region: 'Ziguinchor', localisation: 'Ziguinchor', budget: 4159, budgetDecaisse: 3243, avancement: 99, unite: 'DPD', departement: 'DPD_DISTRIBUTION', statut: 'termine', dateFinPrevue: '2025-11-19' }),
  mkMatrixProjet({ id: 'prj-008', domaine: 'distribution', code: '19TE10033044', nom: 'Réaménagement et renforcement de réseaux de distribution de l’énergie électrique de SENELEC dans les régions de Dakar, Thiès, Kaolack, Fatick, Saint-Louis et Tambacounda au Sénégal - LOT 02', chefProjet: 'Mamadou POUYE', region: 'Dakar', localisation: 'Dakar', budget: 3176, budgetDecaisse: 2664, avancement: 100, unite: 'DPD', departement: 'DPD_DISTRIBUTION', statut: 'en_cours', dateDebut: '2020-03-01' }),
  mkMatrixProjet({ id: 'prj-009', domaine: 'distribution', code: '19TE10273039', nom: 'Réaménagement et renforcement de réseaux de distribution de l’énergie électrique de SENELEC dans les régions de Dakar, Thiès, Kaolack, Fatick, Saint-Louis et Tambacounda au Sénégal - LOT 07', chefProjet: 'Mor TINE SENE', region: 'Dakar', localisation: 'Dakar', budget: 2622, budgetDecaisse: 524, avancement: 10, unite: 'DPD', departement: 'DPD_DISTRIBUTION', statut: 'en_cours' }),
  mkMatrixProjet({ id: 'prj-010', domaine: 'distribution', code: '19DE10503566', nom: 'AO N°15/2019LOT 2:Densification et Renforcement des réseaux à Thiès, Diourbel, Touba, darou Mousty ; Changement de Tenson 6,6/30 kV à Richard Toll', chefProjet: 'Mamadou POUYE', region: 'Diourbel', localisation: 'Diourbel', budget: 1218, budgetDecaisse: 0, avancement: 70, unite: 'DPD', departement: 'DPD_DISTRIBUTION', statut: 'en_cours' }),
  mkMatrixProjet({ id: 'prj-011', domaine: 'distribution', code: '23DE10555035', nom: 'ELECTRIFICATION DU BARRAGE ANTISEL D’AFFINIAM, DE LA CITE KASSAS ET DES VILLAGES DE GUENENE, MBADIENE ET DIORI. CREATION SECTEUR A MBACKE KADIOR', chefProjet: 'Becegade AMAR', region: 'Multi-régions', localisation: 'Multi-régions', budget: 166, budgetDecaisse: 33, avancement: 15, unite: 'DPD', departement: 'DPD_DISTRIBUTION', statut: 'suspendu' }),
  mkMatrixProjet({ id: 'prj-012', domaine: 'distribution', code: '19DE10013582', nom: 'Projet AO 01/2021 "Extension, densification et renforcement du réseau de distribution dans les zones touristiques – Lot 01: Création du feeder Secours Saly à partir de la Sous Station Malicounda et Réaménagement du réseau HTA"', chefProjet: 'Becegade AMAR', region: 'Multi-régions', localisation: 'Multi-régions', budget: 1609, budgetDecaisse: 1226, avancement: 99, unite: 'DPD', departement: 'DPD_DISTRIBUTION', statut: 'termine', dateFinPrevue: '2023-10-19' }),
  mkMatrixProjet({ id: 'prj-013', domaine: 'distribution', code: '18DM20271476', nom: 'Renforcement et de renouvellement de la ligne HTA de faible section par 148mm² le tronçon du départ D3 (Bignona) entre Oulampane - Medina Wandifa - Entrée Sedhiou sur environ 75 KM', chefProjet: 'Elimane Malick DIAW', region: 'Sédhiou', localisation: 'Sédhiou', budget: 2307, budgetDecaisse: 461, avancement: 42, unite: 'DPD', departement: 'DPD_DISTRIBUTION', statut: 'suspendu', dateDebut: '2022-04-15' }),
  mkMatrixProjet({ id: 'prj-014', domaine: 'distribution', code: '', nom: 'AO 06/16 [T_PAP_109]: Amélioration de la Qualité de Service (AQS) avec renforcement de ligne HTA, création poste en cabine, réhabilitation antenne, acquisition poste mobile à DRCE', chefProjet: 'Mamadou POUYE', region: 'Multi-régions', localisation: 'Multi-régions', budget: 612, budgetDecaisse: 367, avancement: 99, unite: 'DPD', departement: 'DPD_DISTRIBUTION', statut: 'termine', dateDebut: '2018-01-02', dateFinPrevue: '2018-10-31' }),
  mkMatrixProjet({ id: 'prj-015', domaine: 'distribution', code: '', nom: 'AO 06/16 [T_PAP_109]: Amélioration de la Qualité de Service (AQS) avec renforcement de ligne HTA, création poste en cabine, réhabilitation antenne, acquisition poste mobile à DRCE', chefProjet: 'Mamadou POUYE', region: 'Multi-régions', localisation: 'Multi-régions', budget: 492, budgetDecaisse: 294, avancement: 98, unite: 'DPD', departement: 'DPD_DISTRIBUTION', statut: 'termine', dateDebut: '2018-01-02', dateFinPrevue: '2018-10-31' }),
  mkMatrixProjet({ id: 'prj-016', domaine: 'distribution', code: '19PX10013045', nom: 'Réaménagement et renforcement de réseaux de distribution de l’énergie électrique de SENELEC dans les régions de Dakar, Thiès, Kaolack, Fatick, Saint-Louis et Tambacounda au Sénégal - LOT 01', chefProjet: 'MAMADOU POUYE', region: 'Dakar', localisation: 'Dakar', budget: 2634, budgetDecaisse: 2004, avancement: 76, unite: 'DPD', departement: 'DPD_DISTRIBUTION', statut: 'en_cours' }),
  mkMatrixProjet({ id: 'prj-017', domaine: 'distribution', code: '19TE10383043', nom: 'Réaménagement et renforcement de réseaux de distribution de l’énergie électrique de SENELEC dans les régions de Dakar, Thiès, Kaolack, Fatick, Saint-Louis et Tambacounda au Sénégal - LOT 03', chefProjet: 'MAMADOU POUYE', region: 'Dakar', localisation: 'Dakar', budget: 3449, budgetDecaisse: 2507, avancement: 89, unite: 'DPD', departement: 'DPD_DISTRIBUTION', statut: 'en_cours' }),
  mkMatrixProjet({ id: 'prj-018', domaine: 'distribution', code: '19TE10273042', nom: 'Réaménagement et renforcement de réseaux de distribution de l’énergie électrique de SENELEC dans les régions de Dakar, Thiès, Kaolack, Fatick, Saint-Louis et Tambacounda au Sénégal - LOT 04', chefProjet: 'MAMADOU POUYE', region: 'Dakar', localisation: 'Dakar', budget: 2380, budgetDecaisse: 1711, avancement: 70, unite: 'DPD', departement: 'DPD_DISTRIBUTION', statut: 'en_cours' }),
  mkMatrixProjet({ id: 'prj-019', domaine: 'distribution', code: '19TE10273040', nom: 'Réaménagement et renforcement de réseaux de distribution de l’énergie électrique de SENELEC dans les régions de Dakar, Thiès, Kaolack, Fatick, Saint-Louis et Tambacounda au Sénégal - LOT 06', chefProjet: 'MAMADOU POUYE', region: 'Dakar', localisation: 'Dakar', budget: 3621, budgetDecaisse: 2702, avancement: 77, unite: 'DPD', departement: 'DPD_DISTRIBUTION', statut: 'en_cours' }),
  mkMatrixProjet({ id: 'prj-020', domaine: 'distribution', code: '19TE10463038', nom: 'Réaménagement et renforcement de réseaux de distribution de l’énergie électrique de SENELEC dans les régions de Dakar, Thiès, Kaolack, Fatick, Saint-Louis et Tambacounda au Sénégal - LOT 08', chefProjet: 'MAMADOU POUYE', region: 'Dakar', localisation: 'Dakar', budget: 2089, budgetDecaisse: 1544, avancement: 72, unite: 'DPD', departement: 'DPD_DISTRIBUTION', statut: 'en_cours' }),
  mkMatrixProjet({ id: 'prj-021', domaine: 'distribution', code: '18DN10502764', nom: 'AO N°15/2019 Lot 1 : Bouclage des feeders Ranérou Dahra Linguère entre Poste Barkkédji et Ranérou', chefProjet: 'Mamadou POUYE', region: 'Multi-régions', localisation: 'Multi-régions', budget: 1908, budgetDecaisse: 1262, avancement: 93, unite: 'DPD', departement: 'DPD_DISTRIBUTION', statut: 'en_cours', dateDebut: '2020-06-17' }),
  mkMatrixProjet({ id: 'prj-022', domaine: 'distribution', code: '20DE10033790', nom: 'WELDY: des PLE (PLAN LOCAL ELECTRIFICATION) dans les 4 nouvelles CER (Partie electrification rurale)', chefProjet: 'Mamadou POUYE', region: 'Multi-régions', localisation: 'Multi-régions', budget: 51784, budgetDecaisse: 28566, avancement: 34, unite: 'DPD', departement: 'DPD_DISTRIBUTION', statut: 'en_cours', dateFinPrevue: '2025-12-19' }),
  mkMatrixProjet({ id: 'prj-023', domaine: 'distribution', code: '21DX10303878', nom: 'ACCES UNIVERSEL A L\'ELECTRICTE WELDY (Partie péri-urbain)', chefProjet: 'Non assigné', region: 'Multi-régions', localisation: 'Multi-régions', budget: 0, budgetDecaisse: 0, avancement: 0, unite: 'DPD', departement: 'DPD_DISTRIBUTION', statut: 'planifie' }),
  mkMatrixProjet({ id: 'prj-024', domaine: 'distribution', code: '18DE10031277', nom: 'Densification et renforcemenr réseau à DRCO, DRCE, DRN ,et DRS; Densification et renforcemenr réseau dans la banlieue de Dakar ( Rufisque et BARGNY) ( AO 24/2017) Lot 1 & 2', chefProjet: 'Mamadou Pouye', region: 'Dakar', localisation: 'Dakar', budget: 1742, budgetDecaisse: 1002, avancement: 90, unite: 'DPD', departement: 'DPD_DISTRIBUTION', statut: 'en_cours' }),
  mkMatrixProjet({ id: 'prj-025', domaine: 'distribution', code: '20DE10033791', nom: 'Approvisionnement de poteaux en béton et réalisation de trvaux nécessaires au renforcement du service public pour l\'accés universel à l\'léctricité - Phase 2', chefProjet: 'Maodo SENE', region: 'Multi-régions', localisation: 'Multi-régions', budget: 39222, budgetDecaisse: 35722, avancement: 96, unite: 'DPD', departement: 'DPD_DISTRIBUTION', statut: 'en_cours', dateDebut: '2021-05-21' }),
  mkMatrixProjet({ id: 'prj-026', domaine: 'distribution', code: '18DX30211605', nom: 'AOI 27/19 : P4- POSTE HTB, TELECOMS ET TELECONDUITE (PASE) + Avenant 30%', chefProjet: 'Maodo SENE', region: 'Multi-régions', localisation: 'Multi-régions', budget: 1089, budgetDecaisse: 1077, avancement: 99, unite: 'DPD', departement: 'DPD_DISTRIBUTION', statut: 'termine' }),
  mkMatrixProjet({ id: 'prj-027', domaine: 'distribution', code: '18DX30021616', nom: 'AOI 27/19 : P4- POSTE HTB, TELECOMS ET TELECONDUITE (PASE) + Avenant 30%', chefProjet: 'Maodo SENE', region: 'Multi-régions', localisation: 'Multi-régions', budget: 1612, budgetDecaisse: 1612, avancement: 99, unite: 'DPD', departement: 'DPD_DISTRIBUTION', statut: 'termine' }),
  mkMatrixProjet({ id: 'prj-028', domaine: 'distribution', code: '19DX30213583', nom: 'AOI 30/19 P4 BIS : Automatisation du reseau de distribution national 3e phase + Avenant 29,9%', chefProjet: 'Maodo SENE', region: 'Multi-régions', localisation: 'Multi-régions', budget: 3473, budgetDecaisse: 3473, avancement: 100, unite: 'DPD', departement: 'DPD_DISTRIBUTION', statut: 'termine' }),
  mkMatrixProjet({ id: 'prj-029', domaine: 'distribution', code: '18DE30021368', nom: 'AOI N° 62 lot 1 J.1. Extension et densification de réseau (EIB)', chefProjet: 'Maodo SENE', region: 'Multi-régions', localisation: 'Multi-régions', budget: 3292, budgetDecaisse: 2175, avancement: 99, unite: 'DPD', departement: 'DPD_DISTRIBUTION', statut: 'en_cours', dateDebut: '2019-09-30' }),
  mkMatrixProjet({ id: 'prj-030', domaine: 'distribution', code: '19DE10463589', nom: 'P2B - LIGNE ET POSTE HTA (EIB/UE) : « CREATION DE TROIS (03) DORSALES 30kV DANS LA ZONE DE KOLDA ET ENVIRONS (PNUER) ET ELECTRIFICATION RURALE DE 104 LOCALITES » LOT1', chefProjet: 'Mor Tine SENE', region: 'Kolda', localisation: 'Kolda', budget: 3954, budgetDecaisse: 0, avancement: 0, unite: 'DPD', departement: 'DPD_DISTRIBUTION', statut: 'planifie' }),
  mkMatrixProjet({ id: 'prj-031', domaine: 'distribution', code: '18DE30021450', nom: 'P2B - LIGNE ET POSTE HTA (EIB/UE) : « CREATION DE TROIS (03) DORSALES 30kV DANS LA ZONE DE KOLDA ET ENVIRONS (PNUER) ET ELECTRIFICATION RURALE DE 93 LOCALITES » LOT2', chefProjet: 'Modou NDIAYE/Moussa Mbaye THIAM', region: 'Kolda', localisation: 'Kolda', budget: 3776, budgetDecaisse: 1350, avancement: 34, unite: 'DPD', departement: 'DPD_DISTRIBUTION', statut: 'suspendu', dateDebut: '2021-03-24' }),
  mkMatrixProjet({ id: 'prj-032', domaine: 'distribution', code: '18DE10231290', nom: 'Extension des Réseaux dans les Périphéries des zones Urbaines et alentours de Gros Villages (Lots 4 - DRS)', chefProjet: 'Modou NDIAYE', region: 'Multi-régions', localisation: 'Multi-régions', budget: 3600, budgetDecaisse: 705, avancement: 97, unite: 'DPD', departement: 'DPD_DISTRIBUTION', statut: 'suspendu', dateDebut: '2017-05-15' }),
  mkMatrixProjet({ id: 'prj-033', domaine: 'distribution', code: '18DE10011463', nom: 'Réhabilitation des réseaux de distribution (ILES DU SALOUM, KIDIRA, GOUDIRY, MEDINA GOUNASS) - Contrepartie financement KFW', chefProjet: 'Modou NDIAYE', region: 'Multi-régions', localisation: 'Multi-régions', budget: 500, budgetDecaisse: 291, avancement: 48, unite: 'DPD', departement: 'DPD_DISTRIBUTION', statut: 'suspendu', dateDebut: '2019-01-21' }),
  mkMatrixProjet({ id: 'prj-034', domaine: 'distribution', code: '18DE30021297', nom: 'AOI N° 04/2019 - P2A - LIGNE ET POSTE HTA (WB/EIB) - Lot 2:', chefProjet: 'Modou NDIAYE/Mor TINE', region: 'Multi-régions', localisation: 'Multi-régions', budget: 1180, budgetDecaisse: 1133, avancement: 97, unite: 'DPD', departement: 'DPD_DISTRIBUTION', statut: 'en_cours', dateDebut: '2019-10-03' }),
  mkMatrixProjet({ id: 'prj-035', domaine: 'distribution', code: '18DE30021296', nom: 'AOI N° 04/2019 - P2A - LIGNE ET POSTE HTA (WB/EIB) - Lot3', chefProjet: 'Modou NDIAYE/Mor TINE', region: 'Multi-régions', localisation: 'Multi-régions', budget: 1328, budgetDecaisse: 1103, avancement: 90, unite: 'DPD', departement: 'DPD_DISTRIBUTION', statut: 'en_cours', dateDebut: '2019-11-11' }),
  mkMatrixProjet({ id: 'prj-036', domaine: 'distribution', code: '19DE10513580', nom: 'AO 56 - 2020 - Soutien à l’électrification par le développement de lignes 30 kv (dorsale) et électrification de villages proches (Ziguichor-Mpack et Boulogne-Boutoupa…)', chefProjet: 'Ndeye Daba KAMA', region: 'Multi-régions', localisation: 'Multi-régions', budget: 1800, budgetDecaisse: 1066, avancement: 100, unite: 'DPD', departement: 'DPD_DISTRIBUTION', statut: 'en_cours', dateDebut: '2023-04-03', dateFinPrevue: '2025-07-15' }),
  mkMatrixProjet({ id: 'prj-037', domaine: 'distribution', code: '20DE10513146', nom: 'DP 57 - 2020 - Recrutement d’un consultant pour le suivi et le contrôle des travaux du projet « soutien a l’électrification par le développement de lignes 30 kV (dorsale) et électrification de villages proches (Ziguinchor-Mpack et Boulome-Boutoupa…etc…)', chefProjet: 'Ndeye Daba KAMA', region: 'Ziguinchor', localisation: 'Ziguinchor', budget: 200, budgetDecaisse: 201, avancement: 100, unite: 'DPD', departement: 'DPD_DISTRIBUTION', statut: 'en_cours', dateDebut: '2023-04-03', dateFinPrevue: '2025-07-15' }),
  mkMatrixProjet({ id: 'prj-038', domaine: 'distribution', code: '19PE10013070', nom: 'SECURISATION ELECTRIQUE DES OUVRAGES DE SEN EAU', chefProjet: 'Moussa Mbaye THIAM', region: 'Multi-régions', localisation: 'Multi-régions', budget: 1000, budgetDecaisse: 197, avancement: 12, unite: 'DPD', departement: 'DPD_DISTRIBUTION', statut: 'en_cours', dateFinPrevue: '2025-12-15' }),
  mkMatrixProjet({ id: 'prj-039', domaine: 'distribution', code: '19DE10013582', nom: 'Projet AO 01/2021 "Extension, densification et renforcement du réseau de distribution dans les zones touristiques – Lot 03 : Alimentation électrique des iles de Marlodj, Mar souloum et Mar fafako', chefProjet: 'El Hadji Moussa SOW', region: 'Multi-régions', localisation: 'Multi-régions', budget: 1093, budgetDecaisse: 824, avancement: 80, unite: 'DPD', departement: 'DPD_DISTRIBUTION', statut: 'en_cours', dateDebut: '2022-04-19' }),
  mkMatrixProjet({ id: 'prj-040', domaine: 'distribution', code: '23DE10135037', nom: 'VINCI2 Extension et densification de réseaux à DRS (LOT 4)', chefProjet: 'Moussa Mbaye THIAM', region: 'Multi-régions', localisation: 'Multi-régions', budget: 4573, budgetDecaisse: 5135, avancement: 92, unite: 'DPD', departement: 'DPD_DISTRIBUTION', statut: 'en_cours', dateDebut: '2023-12-11', dateFinPrevue: '2026-12-11' }),
  mkMatrixProjet({ id: 'prj-041', domaine: 'distribution', code: '23DE10135038', nom: 'VINCI2 Extension et densification de réseaux à DRCO (LOT 2)', chefProjet: 'Ndiémé GUEYE', region: 'Multi-régions', localisation: 'Multi-régions', budget: 5231, budgetDecaisse: 5809, avancement: 90, unite: 'DPD', departement: 'DPD_DISTRIBUTION', statut: 'en_cours', dateDebut: '2023-12-11', dateFinPrevue: '2026-12-11' }),
  mkMatrixProjet({ id: 'prj-042', domaine: 'distribution', code: '23DE10135039', nom: 'VINCI2 Extension et densification de réseaux à DRN (LOT 3)', chefProjet: 'Ndiémé GUEYE', region: 'Multi-régions', localisation: 'Multi-régions', budget: 5606, budgetDecaisse: 5601, avancement: 91, unite: 'DPD', departement: 'DPD_DISTRIBUTION', statut: 'en_cours', dateDebut: '2023-12-11', dateFinPrevue: '2026-12-11' }),
  mkMatrixProjet({ id: 'prj-043', domaine: 'distribution', code: '23DE10135040', nom: 'VINCI2 Extension et densification de réseaux à DRCE (LOT 1)', chefProjet: 'Moussa Mbaye THIAM', region: 'Multi-régions', localisation: 'Multi-régions', budget: 6876, budgetDecaisse: 4371, avancement: 95, unite: 'DPD', departement: 'DPD_DISTRIBUTION', statut: 'en_cours', dateDebut: '2023-12-11', dateFinPrevue: '2026-12-11' }),
  mkMatrixProjet({ id: 'prj-044', domaine: 'distribution', code: '19DE10013582', nom: 'Projet AO 01/2021 "Extension, densification et renforcement du réseau de distribution dans les zones touristiques – Lot 02: Passage en souterrain et Sécurisation du feeder saly issu de Malicoudna et bouclage"', chefProjet: 'Ndiémé GUEYE', region: 'Multi-régions', localisation: 'Multi-régions', budget: 2065, budgetDecaisse: 413, avancement: 15, unite: 'DPD', departement: 'DPD_DISTRIBUTION', statut: 'suspendu', dateDebut: '2022-04-19' }),
  mkMatrixProjet({ id: 'prj-045', domaine: 'distribution', code: '', nom: 'AOI 30/2023 : Acquisitions et Installations d’Appareils Télécommandés à Dakar et dans les Régions-10 mois', chefProjet: 'Maodo SENE/Mor Tine SENE', region: 'Dakar', localisation: 'Dakar', budget: 1700, budgetDecaisse: 1002, avancement: 96, unite: 'DPD', departement: 'DPD_DISTRIBUTION', statut: 'en_cours' }),
  mkMatrixProjet({ id: 'prj-046', domaine: 'distribution', code: '', nom: 'NG-ECOWAS-DEM-315397-CW-RFB: BEST-Lot 1 (449 Localités) : Réseaux de distribution des postes des Régions de Ziguinchor, Sédhiou et du département de Medina Yoro Foulah de la région de Kolda-18 mois', chefProjet: 'Maodo SENE', region: 'Ziguinchor', localisation: 'Ziguinchor', budget: 0, budgetDecaisse: 14508, avancement: 41, unite: 'DPD', departement: 'DPD_DISTRIBUTION', statut: 'en_cours' }),
  mkMatrixProjet({ id: 'prj-047', domaine: 'distribution', code: '', nom: 'NG-ECOWAS-DEM-315397-CW-RFB: BEST Lot 2 (308 Localités) : Lot 2 : réseaux de distribution des postes de la Région de Kolda excepté le département de Médina Yoro Foulah-18 mois', chefProjet: 'Maodo SENE', region: 'Kolda', localisation: 'Kolda', budget: 0, budgetDecaisse: 15202, avancement: 41, unite: 'DPD', departement: 'DPD_DISTRIBUTION', statut: 'en_cours' }),
  mkMatrixProjet({ id: 'prj-048', domaine: 'distribution', code: '', nom: 'NG-ECOWAS-DEM-315397-CW-RFB : BEST-Lot 3 : Réseaux de distribution des postes des Régions de Kedougou, Tambacounda et Kaolack-Tranche Ferme et Conditionnelle - 18 mois - Tranche Ferme: 16 mois - Tranche Conditionnelle: 10 mois à partir de M8 de la tranche ferme', chefProjet: 'Maodo SENE', region: 'Tambacounda', localisation: 'Tambacounda', budget: 0, budgetDecaisse: 9614, avancement: 33, unite: 'DPD', departement: 'DPD_DISTRIBUTION', statut: 'en_cours' }),
  mkMatrixProjet({ id: 'prj-049', domaine: 'distribution', code: '19DE10013575', nom: 'Projet: Boucle 90 kV Phase 2: réhabilitation et Extension Réseaux Dakar et CPL', chefProjet: 'Moussa Mbaye THIAM', region: 'Dakar', localisation: 'Dakar', budget: 1000, budgetDecaisse: 572, avancement: 100, unite: 'DPD', departement: 'DPD_DISTRIBUTION', statut: 'suspendu' }),
  mkMatrixProjet({ id: 'prj-050', domaine: 'distribution', code: '24DE30565084', nom: 'TRAVAUX DE « RACCORDEMENT DES NOUVELLES LOCALITES EN PERI-URBAINES DANS LE CADRE DE L\'ACCES UNIVERSEL A L’ELECTRICITE » - Lot 1', chefProjet: 'Becegade AMAR', region: 'Multi-régions', localisation: 'Multi-régions', budget: 1800, budgetDecaisse: 1331, avancement: 99, unite: 'DPD', departement: 'DPD_DISTRIBUTION', statut: 'en_cours', dateFinPrevue: '2025-10-08' }),
  mkMatrixProjet({ id: 'prj-051', domaine: 'distribution', code: '24DE30565084', nom: 'TRAVAUX DE « RACCORDEMENT DES NOUVELLES LOCALITES EN PERI-URBAINES DANS LE CADRE DE L\'ACCES UNIVERSEL A L’ELECTRICITE » - Lot 2', chefProjet: 'Becegade AMAR', region: 'Multi-régions', localisation: 'Multi-régions', budget: 1800, budgetDecaisse: 1029, avancement: 87, unite: 'DPD', departement: 'DPD_DISTRIBUTION', statut: 'en_cours', dateFinPrevue: '2025-10-08' }),
  mkMatrixProjet({ id: 'prj-052', domaine: 'distribution', code: '24DE30565084', nom: 'TRAVAUX DE « RACCORDEMENT DES NOUVELLES LOCALITES EN PERI-URBAINES DANS LE CADRE DE L\'ACCES UNIVERSEL A L’ELECTRICITE » - Lot 3', chefProjet: 'Becegade AMAR', region: 'Multi-régions', localisation: 'Multi-régions', budget: 1200, budgetDecaisse: 815, avancement: 100, unite: 'DPD', departement: 'DPD_DISTRIBUTION', statut: 'en_cours', dateFinPrevue: '2025-10-08' }),
  mkMatrixProjet({ id: 'prj-053', domaine: 'distribution', code: '24DE30565084', nom: 'TRAVAUX DE « RACCORDEMENT DES NOUVELLES LOCALITES EN PERI-URBAINES DANS LE CADRE DE L\'ACCES UNIVERSEL A L’ELECTRICITE » - Lot 4', chefProjet: 'Becegade AMAR', region: 'Multi-régions', localisation: 'Multi-régions', budget: 1200, budgetDecaisse: 467, avancement: 100, unite: 'DPD', departement: 'DPD_DISTRIBUTION', statut: 'en_cours', dateFinPrevue: '2025-10-08' }),
  mkMatrixProjet({ id: 'prj-054', domaine: 'transport', code: '297/18TE10381078', nom: 'Liaison double terne 225 kV Tobène-Kounoune lot 1 (ligne)', chefProjet: 'Abdoulaye Aziz Camara', region: 'Multi-régions', localisation: 'Multi-régions', budget: 14247, budgetDecaisse: 6506, avancement: 88, unite: 'DPT', departement: 'DPT_TRANSPORT', statut: 'suspendu', dateDebut: '2018-03-06', bailleur: 'BOAD' }),
  mkMatrixProjet({ id: 'prj-055', domaine: 'transport', code: '18TE10021080', nom: 'Liaison double terne 225 kV Sendou-Kounoune', chefProjet: 'Abdoulaye Aziz Camara', region: 'Multi-régions', localisation: 'Multi-régions', budget: 1190, budgetDecaisse: 1370, avancement: 89, unite: 'DPT', departement: 'DPT_TRANSPORT', statut: 'suspendu', dateDebut: '2018-07-16', bailleur: 'BOAD' }),
  mkMatrixProjet({ id: 'prj-056', domaine: 'transport', code: '307/18TE20031088', nom: 'Boucle du Ferlo : - Extension Poste TOUBA 1 - Poste NDINDY - Poste LINGUERE - Poste NDIOUM - Ligne 225kV TOUBA 1 - TOUBA 2 - ligne 225 kV TOUBA 2 - LINGUERE', chefProjet: 'ISMAILA BA', region: 'Multi-régions', localisation: 'Multi-régions', budget: 56112, budgetDecaisse: 52420, avancement: 93, unite: 'DPT', departement: 'DPT_TRANSPORT', statut: 'suspendu', dateDebut: '2021-12-17', dateFinPrevue: '2025-01-23', bailleur: 'BNP' }),
  mkMatrixProjet({ id: 'prj-057', domaine: 'transport', code: '18TE40392364', nom: 'Poste GIS 90 KV - CENTRE VILLE', chefProjet: 'Non assigné', region: 'Multi-régions', localisation: 'Multi-régions', budget: 7204, budgetDecaisse: 0, avancement: 0, unite: 'DPT', departement: 'DPT_TRANSPORT', statut: 'suspendu', dateDebut: '2018-05-18', bailleur: 'BNP' }),
  mkMatrixProjet({ id: 'prj-058', domaine: 'transport', code: '18TE40392437', nom: 'Liaison souterraine en 90 kV UNIVERSITE – CENTRE VILLE – BEL AIR', chefProjet: 'Non assigné', region: 'Multi-régions', localisation: 'Multi-régions', budget: 0, budgetDecaisse: 0, avancement: 100, unite: 'DPT', departement: 'DPT_TRANSPORT', statut: 'suspendu', dateDebut: '2018-05-18', bailleur: 'BNP' }),
  mkMatrixProjet({ id: 'prj-059', domaine: 'transport', code: '23TX10015034', nom: 'POSTE 225/30 kV de Patte d\'oie', chefProjet: 'François Xavier S. DIONE', region: 'Multi-régions', localisation: 'Multi-régions', budget: 10000, budgetDecaisse: 0, avancement: 0, unite: 'DPT', departement: 'DPT_TRANSPORT', statut: 'planifie', bailleur: 'FONDS PROPRES' }),
  mkMatrixProjet({ id: 'prj-060', domaine: 'transport', code: '23TE10135020', nom: 'POSTE KOUNGHEUL AIS 225/30 kV - 2x40 MVA', chefProjet: 'Jean Marie Sene', region: 'Multi-régions', localisation: 'Multi-régions', budget: 11177, budgetDecaisse: 9561, avancement: 94, unite: 'DPT', departement: 'DPT_TRANSPORT', statut: 'en_cours', dateDebut: '2023-12-11', bailleur: 'NATIXIS' }),
  mkMatrixProjet({ id: 'prj-061', domaine: 'transport', code: '23TE10135015', nom: 'ALIMENTATION DU POSTE DE KOUNGHEUL / 225KV SIMPLE TERNE & FAISCEAU DOUBLE', chefProjet: 'Jean Marie Sene', region: 'Multi-régions', localisation: 'Multi-régions', budget: 3501, budgetDecaisse: 3471, avancement: 98, unite: 'DPT', departement: 'DPT_TRANSPORT', statut: 'en_cours', dateDebut: '2023-12-11', dateFinPrevue: '2026-12-11', bailleur: 'NATIXIS' }),
  mkMatrixProjet({ id: 'prj-062', domaine: 'transport', code: '23TE10135021', nom: 'POSTE VELINGARA AIS 225/30 kV - 2x40 MVA', chefProjet: 'Jean Marie Sene', region: 'Multi-régions', localisation: 'Multi-régions', budget: 11281, budgetDecaisse: 8816, avancement: 91, unite: 'DPT', departement: 'DPT_TRANSPORT', statut: 'en_cours', dateDebut: '2023-12-11', bailleur: 'NATIXIS' }),
  mkMatrixProjet({ id: 'prj-063', domaine: 'transport', code: '23TE10135016', nom: 'ALIMENTATION DU POSTE DE VELINGARA / 225KV SIMPLE TERNE & FAISCEAU DOUBLE', chefProjet: 'Jean Marie Sene', region: 'Multi-régions', localisation: 'Multi-régions', budget: 3716, budgetDecaisse: 3456, avancement: 98, unite: 'DPT', departement: 'DPT_TRANSPORT', statut: 'en_cours', dateDebut: '2023-12-11', dateFinPrevue: '2026-12-11', bailleur: 'NATIXIS' }),
  mkMatrixProjet({ id: 'prj-064', domaine: 'transport', code: '23TE10135024', nom: 'POSTE DE SINDIA 225/90/30KV', chefProjet: 'Stéphane Niouky', region: 'Multi-régions', localisation: 'Multi-régions', budget: 18180, budgetDecaisse: 3636, avancement: 44, unite: 'DPT', departement: 'DPT_TRANSPORT', statut: 'en_cours', dateDebut: '2025-05-01', dateFinPrevue: '2027-12-31', bailleur: 'NATIXIS' }),
  mkMatrixProjet({ id: 'prj-065', domaine: 'transport', code: '', nom: 'RACCORDEMENT 225KV DU POSTE SINDIA', chefProjet: 'Stéphane Niouky', region: 'Multi-régions', localisation: 'Multi-régions', budget: 1167, budgetDecaisse: 233, avancement: 0, unite: 'DPT', departement: 'DPT_TRANSPORT', statut: 'en_cours', dateDebut: '2025-05-01', dateFinPrevue: '2027-12-31', bailleur: 'NATIXIS' }),
  mkMatrixProjet({ id: 'prj-066', domaine: 'transport', code: '23TE10135017', nom: 'EXTENSION POSTE KAOLACK AIS 225/30 kV - 2x80 MVA', chefProjet: 'Stéphane Niouky', region: 'Kaolack', localisation: 'Kaolack', budget: 4738, budgetDecaisse: 3852, avancement: 81, unite: 'DPT', departement: 'DPT_TRANSPORT', statut: 'en_cours', dateDebut: '2023-12-11', dateFinPrevue: '2026-06-11', bailleur: 'NATIXIS' }),
  mkMatrixProjet({ id: 'prj-067', domaine: 'transport', code: '23TE10135019', nom: 'POSTE WACK NGOUNA AIS 225/30 kV - 2x40 MVA', chefProjet: 'Stéphane Niouky', region: 'Multi-régions', localisation: 'Multi-régions', budget: 10427, budgetDecaisse: 8762, avancement: 98, unite: 'DPT', departement: 'DPT_TRANSPORT', statut: 'en_cours', dateDebut: '2023-12-11', dateFinPrevue: '2026-08-11', bailleur: 'NATIXIS' }),
  mkMatrixProjet({ id: 'prj-068', domaine: 'transport', code: '23TE10135022', nom: 'LIAISON 225KV AERIENNE SIMPLE TERNE / SIMPLE FAISCEAU KAOLACK-WACK NGOUNA', chefProjet: 'Stéphane Niouky', region: 'Kaolack', localisation: 'Kaolack', budget: 11333, budgetDecaisse: 10914, avancement: 100, unite: 'DPT', departement: 'DPT_TRANSPORT', statut: 'en_cours', dateDebut: '2023-12-11', dateFinPrevue: '2026-12-13', bailleur: 'NATIXIS' }),
  mkMatrixProjet({ id: 'prj-069', domaine: 'transport', code: '23TE10135023', nom: 'POSTE PEKESSE AIS 90/30 kV - 2x40 MVA', chefProjet: 'Fatou Kiné Ngom', region: 'Multi-régions', localisation: 'Multi-régions', budget: 11665, budgetDecaisse: 7966, avancement: 84, unite: 'DPT', departement: 'DPT_TRANSPORT', statut: 'en_cours', dateDebut: '2023-12-11', bailleur: 'NATIXIS' }),
  mkMatrixProjet({ id: 'prj-070', domaine: 'transport', code: '23TE10135013', nom: 'LIGNE 90KV MEKHE PEKESSE AERIENNE SIMPLE TERNE/SIMPLE FAISCEAU 3x1 ASTER 366mm2 + 1 OPGW ET FOURNITURE DU CABLE OPGW 48 FIBRES ET ACCESSOIRES', chefProjet: 'Fatou Kiné Ngom', region: 'Multi-régions', localisation: 'Multi-régions', budget: 3127, budgetDecaisse: 3028, avancement: 100, unite: 'DPT', departement: 'DPT_TRANSPORT', statut: 'en_cours', dateDebut: '2023-12-11', bailleur: 'NATIXIS' }),
  mkMatrixProjet({ id: 'prj-071', domaine: 'transport', code: '23TE10135014', nom: 'REALISATION DES LIAISONS SOUTERRAINES 225KV KAOLACK-WACK NGOUNA', chefProjet: 'Stéphane Niouky', region: 'Kaolack', localisation: 'Kaolack', budget: 3493, budgetDecaisse: 2558, avancement: 99, unite: 'DPT', departement: 'DPT_TRANSPORT', statut: 'en_cours', dateDebut: '2023-12-11', dateFinPrevue: '2026-12-13', bailleur: 'NATIXIS' }),
  mkMatrixProjet({ id: 'prj-072', domaine: 'transport', code: '23TM10135018', nom: 'REALISATION DES LIAISONS SOUTERRAINES 90KV SOCOCIM-CAP DES BICHES', chefProjet: 'Fatou Kiné Ngom', region: 'Multi-régions', localisation: 'Multi-régions', budget: 4923, budgetDecaisse: 4128, avancement: 89, unite: 'DPT', departement: 'DPT_TRANSPORT', statut: 'en_cours', dateDebut: '2023-12-11', bailleur: 'NATIXIS' }),
  mkMatrixProjet({ id: 'prj-073', domaine: 'transport', code: '', nom: 'REMPLACEMENT DES CELLULES DE SICAP', chefProjet: 'Jean Marie Sene', region: 'Multi-régions', localisation: 'Multi-régions', budget: 0, budgetDecaisse: 0, avancement: 100, unite: 'DPT', departement: 'DPT_TRANSPORT', statut: 'termine', bailleur: 'NATIXIS' }),
  mkMatrixProjet({ id: 'prj-074', domaine: 'transport', code: '', nom: 'PASSAGE EN SOUTERRAIN DES LIGNES 90 KV SURPLOMBANT LA STATION PETROSEN', chefProjet: 'Fatou Kiné Ngom', region: 'Multi-régions', localisation: 'Multi-régions', budget: 0, budgetDecaisse: 0, avancement: 89, unite: 'DPT', departement: 'DPT_TRANSPORT', statut: 'en_cours', dateDebut: '2025-07-29', bailleur: 'NATIXIS' }),
  mkMatrixProjet({ id: 'prj-075', domaine: 'transport', code: '', nom: 'REALISATION DE LA LIAISON SOUTERRAINE 225 KV ENTRE LE POSTE WAE ET LE POSTE MCA', chefProjet: 'Fatou Kiné Ngom', region: 'Multi-régions', localisation: 'Multi-régions', budget: 0, budgetDecaisse: 0, avancement: 89, unite: 'DPT', departement: 'DPT_TRANSPORT', statut: 'en_cours', dateDebut: '2025-07-30', bailleur: 'NATIXIS' }),
  mkMatrixProjet({ id: 'prj-076', domaine: 'transport', code: '', nom: 'REMPLACEMENT DE LA LIGNE 90 KV KOUNOUNE-SOCOCIM', chefProjet: 'Jean Marie Sene', region: 'Multi-régions', localisation: 'Multi-régions', budget: 0, budgetDecaisse: 0, avancement: 0, unite: 'DPT', departement: 'DPT_TRANSPORT', statut: 'en_cours', bailleur: 'NATIXIS' }),
  mkMatrixProjet({ id: 'prj-077', domaine: 'transport', code: '26TM10015135', nom: 'REABILITATION DU POSTE 225 KV DE SENDOU', chefProjet: 'François Xavier S. DIONE', region: 'Multi-régions', localisation: 'Multi-régions', budget: 4600, budgetDecaisse: 0, avancement: 0, unite: 'DPT', departement: 'DPT_TRANSPORT', statut: 'en_cours', bailleur: 'FONDS PROPRES' }),
];

// ────────────────────────────── CONTEXT ──────────────────────────────────────

export interface ProjectStore {
  projets: Projet[];
  ressources: Ressource[];
  // Project CRUD
  createProjet: (p: Omit<Projet, 'id' | 'dateCreation' | 'dateModification' | 'taches'>) => Projet;
  updateProjet: (id: string, patch: Partial<Projet>) => void;
  deleteProjet: (id: string) => void;
  changeStatut: (id: string, statut: StatutProjet, motif?: string) => void;
  saveBaseline: (id: string) => void;
  // Task CRUD
  createTache: (t: Omit<TacheWBS, 'id'>) => TacheWBS;
  updateTache: (projetId: string, tacheId: string, patch: Partial<TacheWBS>) => void;
  deleteTache: (projetId: string, tacheId: string) => void;
  reorderTaches: (projetId: string, ordered: string[]) => void;
  // Resource CRUD
  createRessource: (r: Omit<Ressource, 'id'>) => Ressource;
  updateRessource: (id: string, patch: Partial<Ressource>) => void;
  deleteRessource: (id: string) => void;
  // Assignment CRUD
  assignRessource: (projetId: string, tacheId: string, ressourceId: string, unite: number) => void;
  updateAssignation: (projetId: string, tacheId: string, assignationId: string, patch: Partial<Assignation>) => void;
  removeAssignation: (projetId: string, tacheId: string, assignationId: string) => void;
  // Jalon
  updateJalon: (projetId: string, idx: number, patch: Partial<Jalon>) => void;
  addJalon: (projetId: string, jalon: Jalon) => void;
  removeJalon: (projetId: string, idx: number) => void;
  // Progress
  updateAvancement: (projetId: string, tacheId: string, pct: number) => void;
  // Phases projet
  updatePhase: (projetId: string, phaseId: PhaseId, avancement: number) => void;
}

const ProjectContext = createContext<ProjectStore | null>(null);

let _projectIdCounter = 100;
let _taskIdCounter = 1000;
let _ressourceIdCounter = 50;
let _assignationIdCounter = 200;

function nextId(prefix: string, counter: { val: number }) {
  counter.val++;
  return `${prefix}-${counter.val}`;
}

export function ProjectStoreProvider({ children }: { children: React.ReactNode }) {
  const [projets, setProjets] = useState<Projet[]>(PROJETS_INIT);
  const [ressources, setRessources] = useState<Ressource[]>(RESSOURCES_INIT);

  // ── Project ──
  const createProjet = useCallback((p: Omit<Projet, 'id' | 'dateCreation' | 'dateModification' | 'taches'>) => {
    const id = `prj-${String(++_projectIdCounter).padStart(3, '0')}`;
    const taches = makeTaches(id, p.domaine, p.dateDebut);
    // Choisir les phases selon le type de pondération demandé
    const typePond = p.typePonderation ?? 'standard';
    const phasesSource = p.phases?.length
      ? p.phases
      : typePond === 'BEST'
        ? PHASES_BEST.map(ph => ({ ...ph }))
        : PHASES_DEFAUT.map(ph => ({ ...ph }));
    const phases = phasesSource;
    const avancementReel = p.avancementReel ?? computeAvancementReel(phases);
    const newP: Projet = {
      ...p,
      id,
      taches,
      phases,
      typePonderation: typePond,
      avancementReel,
      partFixeFCFA:    p.partFixeFCFA    ?? p.budget,
      partEtrangere:   p.partEtrangere   ?? 0,
      deviseEtrangere: p.deviseEtrangere ?? 'USD',
      tauxChange:      p.tauxChange      ?? TAUX_CHANGE_DEFAUT['USD'],
      dateCreation:    now,
      dateModification: now,
    };
    setProjets(prev => [...prev, newP]);
    auditLog('Création de projet', `${newP.code || newP.id} — ${newP.nom}`, 'projet', undefined, newP.departement);
    return newP;
  }, []);

  const updateProjet = useCallback((id: string, patch: Partial<Projet>) => {
    setProjets(prev => prev.map(p => {
      if (p.id !== id) return p;
      const changed = Object.keys(patch).filter(k => (p as any)[k] !== (patch as any)[k]);
      auditLog('Mise à jour de projet', `${p.code || p.id} — ${p.nom}`, 'projet', changed.join(', '), p.departement);
      return { ...p, ...patch, dateModification: now };
    }));
  }, []);

  const deleteProjet = useCallback((id: string) => {
    setProjets(prev => prev.filter(p => p.id !== id));
  }, []);

  const changeStatut = useCallback((id: string, statut: StatutProjet, motif?: string) => {
    setProjets(prev => prev.map(p => p.id === id ? { ...p, statut, motifSuspension: motif ?? p.motifSuspension, dateModification: now } : p));
  }, []);

  const saveBaseline = useCallback((id: string) => {
    setProjets(prev => prev.map(p => {
      if (p.id !== id) return p;
      const taches = p.taches.map(t => ({
        ...t,
        reference: true,
        dateDebutRef: t.dateDebut,
        dateFinRef: t.dateFin,
        dureeRef: t.duree,
        coutRef: t.coutPrevu,
      }));
      return { ...p, taches, baselineSaved: true, baselineDate: now, dateModification: now };
    }));
  }, []);

  // ── Tasks ──
  const createTache = useCallback((t: Omit<TacheWBS, 'id'>) => {
    const id = `t-${String(++_taskIdCounter).padStart(4, '0')}`;
    const newT: TacheWBS = { ...t, id };
    setProjets(prev => prev.map(p => p.id === t.projetId ? { ...p, taches: [...p.taches, newT], dateModification: now } : p));
    return newT;
  }, []);

  const updateTache = useCallback((projetId: string, tacheId: string, patch: Partial<TacheWBS>) => {
    setProjets(prev => prev.map(p => p.id !== projetId ? p : {
      ...p,
      taches: p.taches.map(t => t.id === tacheId ? { ...t, ...patch } : t),
      dateModification: now,
    }));
  }, []);

  const deleteTache = useCallback((projetId: string, tacheId: string) => {
    setProjets(prev => prev.map(p => p.id !== projetId ? p : {
      ...p,
      taches: p.taches.filter(t => t.id !== tacheId),
      dateModification: now,
    }));
  }, []);

  const reorderTaches = useCallback((projetId: string, ordered: string[]) => {
    setProjets(prev => prev.map(p => {
      if (p.id !== projetId) return p;
      const map = new Map(p.taches.map(t => [t.id, t]));
      const reordered = ordered.map((id, i) => ({ ...map.get(id)!, ordre: i + 1 }));
      return { ...p, taches: reordered, dateModification: now };
    }));
  }, []);

  // ── Resources ──
  const createRessource = useCallback((r: Omit<Ressource, 'id'>) => {
    const id = `r${String(++_ressourceIdCounter).padStart(2, '0')}`;
    const newR: Ressource = { ...r, id };
    setRessources(prev => [...prev, newR]);
    return newR;
  }, []);

  const updateRessource = useCallback((id: string, patch: Partial<Ressource>) => {
    setRessources(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  }, []);

  const deleteRessource = useCallback((id: string) => {
    setRessources(prev => prev.filter(r => r.id !== id));
  }, []);

  // ── Assignments ──
  const assignRessource = useCallback((projetId: string, tacheId: string, ressourceId: string, unite: number) => {
    const id = `asgn-${String(++_assignationIdCounter).padStart(3, '0')}`;
    const asgn: Assignation = { id, tacheId, ressourceId, unite };
    setProjets(prev => prev.map(p => p.id !== projetId ? p : {
      ...p,
      taches: p.taches.map(t => t.id !== tacheId ? t : {
        ...t,
        assignations: [...t.assignations.filter(a => a.ressourceId !== ressourceId), asgn],
      }),
      dateModification: now,
    }));
  }, []);

  const updateAssignation = useCallback((projetId: string, tacheId: string, assignationId: string, patch: Partial<Assignation>) => {
    setProjets(prev => prev.map(p => p.id !== projetId ? p : {
      ...p,
      taches: p.taches.map(t => t.id !== tacheId ? t : {
        ...t,
        assignations: t.assignations.map(a => a.id === assignationId ? { ...a, ...patch } : a),
      }),
    }));
  }, []);

  const removeAssignation = useCallback((projetId: string, tacheId: string, assignationId: string) => {
    setProjets(prev => prev.map(p => p.id !== projetId ? p : {
      ...p,
      taches: p.taches.map(t => t.id !== tacheId ? t : {
        ...t,
        assignations: t.assignations.filter(a => a.id !== assignationId),
      }),
    }));
  }, []);

  // ── Jalons ──
  const updateJalon = useCallback((projetId: string, idx: number, patch: Partial<Jalon>) => {
    setProjets(prev => prev.map(p => p.id !== projetId ? p : {
      ...p,
      jalons: p.jalons.map((j, i) => i === idx ? { ...j, ...patch } : j),
      dateModification: now,
    }));
  }, []);

  const addJalon = useCallback((projetId: string, jalon: Jalon) => {
    setProjets(prev => prev.map(p => p.id !== projetId ? p : {
      ...p,
      jalons: [...p.jalons, jalon],
      dateModification: now,
    }));
  }, []);

  const removeJalon = useCallback((projetId: string, idx: number) => {
    setProjets(prev => prev.map(p => p.id !== projetId ? p : {
      ...p,
      jalons: p.jalons.filter((_, i) => i !== idx),
      dateModification: now,
    }));
  }, []);

  // ── Progress ──
  const updateAvancement = useCallback((projetId: string, tacheId: string, pct: number) => {
    setProjets(prev => prev.map(p => {
      if (p.id !== projetId) return p;
      const taches = p.taches.map(t => t.id === tacheId ? {
        ...t,
        avancement: pct,
        statutTache: (pct === 100 ? 'termine' : pct > 0 ? 'en_cours' : 'a_faire') as StatutTache,
      } : t);
      // recalculate project avancement (simple average on leaf tasks)
      const leafTaches = taches.filter(t => t.type !== 'Récapitulative');
      const avg = leafTaches.length ? Math.round(leafTaches.reduce((s, t) => s + t.avancement, 0) / leafTaches.length) : p.avancement;
      return { ...p, taches, avancement: avg, dateModification: now };
    }));
  }, []);

  // ── Phases BEST ──
  const updatePhase = useCallback((projetId: string, phaseId: PhaseId, avancement: number) => {
    setProjets(prev => prev.map(p => {
      if (p.id !== projetId) return p;
      const phases = (p.phases ?? PHASES_DEFAUT.map(ph => ({ ...ph }))).map(ph => ph.id === phaseId ? { ...ph, avancement } : ph);
      const avancementReel = computeAvancementReel(phases);
      return { ...p, phases, avancementReel, dateModification: now };
    }));
  }, []);

  const store: ProjectStore = {
    projets,
    ressources,
    createProjet,
    updateProjet,
    deleteProjet,
    changeStatut,
    saveBaseline,
    createTache,
    updateTache,
    deleteTache,
    reorderTaches,
    createRessource,
    updateRessource,
    deleteRessource,
    assignRessource,
    updateAssignation,
    removeAssignation,
    updateJalon,
    addJalon,
    removeJalon,
    updateAvancement,
    updatePhase,
  };

  return <ProjectContext.Provider value={store}>{children}</ProjectContext.Provider>;
}

export function useProjectStore(): ProjectStore {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProjectStore must be used inside ProjectStoreProvider');

  const { user, isRole } = useAuth();

  // Filter projects based on organizational hierarchy (RBAC + ABAC + Org Scope)
  const filteredProjets = useMemo(() => {
    if (!user) return []; // No user, no projects
    const profile: UserOrgProfile = {
      role: user.role,
      direction: user.direction,
      departement: user.departement,
      cellule: user.cellule,
      poste: user.poste,
    };
    const scope = computeVisibilityScope(profile);
    // Super-rôles ou wildcard : vision exhaustive du portefeuille
    if (scope.all || isRole('DIR_DPE', 'PMO', 'ADMIN')) {
      return ctx.projets;
    }

    // 1) Filtrage hiérarchique : périmètre organisationnel (unité / département)
    const dansPerimetre = ctx.projets.filter(p =>
      isProjectVisible({
        id: p.id,
        departement: p.departement,
        programme: p.programme,
        domaine: p.domaine,
        unite: p.unite,
      }, scope)
    );

    // 2) RÈGLE D'IMPLICATION (ND 005/2023) — les rôles OPÉRATIONNELS ne voient,
    //    AU SEIN de leur unité, QUE les projets pour lesquels ils sont impliqués
    //    (chef de projet, membre d'équipe, ou explicitement assignés).
    //    Ex : Maodo SENE (chef de projet DPD) ne voit pas tous les projets DPD,
    //    seulement les siens — surtout pas PADERAU s'il n'y est pas affecté.
    //    Les rôles de PILOTAGE (chef de dépt, finance, logistique) gardent la
    //    vision complète de leur périmètre.
    // S&E (EXPERT/CHARGE) NON inclus : ils suivent les KPI de TOUT leur département
    // (Responsable S&E DPD = tous les projets DPD), pas seulement ceux qui leur sont affectés.
    const rolesImplication: RoleCode[] = ['CHEF_PROJ', 'INGENIEUR', 'CONTROLEUR', 'ASSISTANT'];
    if (rolesImplication.includes(user.role)) {
      const assignedIds = new Set(user.projetsAssignes ?? []);
      const myName = normalizeName(`${user.prenom} ${user.nom}`);
      const myResIds = new Set(
        ctx.ressources
          .filter(r => normalizeName(`${r.prenom ?? ''} ${r.nom}`) === myName)
          .map(r => r.id)
      );
      const impliques = dansPerimetre.filter(p =>
        assignedIds.has(p.id) ||
        normalizeName(p.chefProjet) === myName ||
        p.equipe.some(rid => myResIds.has(rid))
      );
      // Repli : si aucune implication détectée mais des projets assignés explicites
      // existent hors périmètre, on les rattache quand même.
      if (impliques.length > 0) return impliques;
      if (assignedIds.size > 0) return ctx.projets.filter(p => assignedIds.has(p.id));
      return impliques; // peut être vide → l'utilisateur n'est impliqué dans aucun projet
    }

    return dansPerimetre;
  }, [ctx.projets, ctx.ressources, user, isRole]);

  return { ...ctx, projets: filteredProjets };
}

/**
 * useScopeDomaines — domaines métier VISIBLES par l'utilisateur courant.
 * Un profil ne voit, sur toutes les pages comportant un sélecteur de domaine,
 * QUE son/ses domaine(s) d'appartenance (ND 005/2023). Les super-rôles
 * (Directeur, PMO, Admin) voient l'ensemble des domaines.
 */
const ALL_DOMAINES: Domaine[] = ['production', 'transport', 'distribution', 'commercial', 'genie_civil'];
export function useScopeDomaines(): Domaine[] {
  const { user } = useAuth();
  return useMemo(() => {
    if (!user) return ALL_DOMAINES;
    const scope = computeVisibilityScope({
      role: user.role, direction: user.direction,
      departement: user.departement, cellule: user.cellule, poste: user.poste,
    });
    if (scope.all || scope.domaines.includes('*') || scope.domaines.length === 0) return ALL_DOMAINES;
    const wanted = scope.domaines.map(d => d.toLowerCase());
    const filtered = ALL_DOMAINES.filter(d => wanted.some(w => w === d || d.includes(w) || w.includes(d)));
    return filtered.length > 0 ? filtered : ALL_DOMAINES;
  }, [user]);
}

// ─── Domain config (shared) ───────────────────────────────────────────────────
/**
 * Configuration des 5 domaines SENELEC — DPE (4 métiers + Génie Civil autonome).
 * Chaîne de valeur électrique : Production → Transport → Distribution → Commercial.
 * L'électrification rurale et l'accès universel relèvent du domaine `distribution`
 * (extension du réseau HTA/BT).
 * Le domaine `genie_civil` couvre les projets propres de la DGC (bâtiments, routes,
 * ouvrages d'art, VRD sur sites SENELEC — ND 005/2023).
 */
export const DOMAINE_CFG: Record<Domaine, { label: string; color: string; emoji: string; desc: string }> = {
  production:   { label: 'Production',    color: '#F37021', emoji: '🔋', desc: 'Thermique, solaire, éolien, hydro, biomasse, stockage' },
  transport:    { label: 'Transport',     color: '#1B4F8A', emoji: '⚡', desc: 'Lignes THT/HTB, postes HT, interconnexions régionales' },
  distribution: { label: 'Distribution',  color: '#16A34A', emoji: '🔌', desc: 'Réseaux HTA/BT, postes source, renforcement, électrification rurale, accès universel' },
  commercial:   { label: 'Commercial',    color: '#8B5CF6', emoji: '📊', desc: 'AMI, compteurs intelligents, GRC, prépaiement, smart grid client, digitalisation' },
  genie_civil:  { label: 'Génie Civil',   color: '#B45309', emoji: '🏗️', desc: 'Projets propres DGC : bâtiments, routes, ouvrages d\'art, VRD sur sites SENELEC' },
};

export const STATUT_CFG: Record<StatutProjet, { label: string; color: string }> = {
  en_cours:  { label: 'En cours',  color: '#F47920' },
  planifie:  { label: 'Planifié',  color: '#1B4F8A' },
  termine:   { label: 'Terminé',   color: '#16A34A' },
  en_retard: { label: 'En retard', color: '#EF3340' },
  suspendu:  { label: 'Suspendu',  color: '#6B7280' },
  archive:   { label: 'Archivé',   color: '#374151' },
};

export const REGIONS = [
  'Dakar', 'Thiès', 'Louga', 'Saint-Louis', 'Ziguinchor',
  'Tambacounda', 'Kaolack', 'Fatick', 'Kolda', 'Sédhiou',
  'Kédougou', 'Matam', 'Diourbel', 'Kaffrine', 'Multi-régions',
];

// Chefs de projet RÉELS de la DPE (fichier du personnel) — dérivé du roster officiel.
export const CHEFS: string[] = Array.from(new Set(
  PERSONNEL_DPE
    .filter(p => /chef de projet|chef de département|chef de departement/i.test(p.fonction || ''))
    .map(p => `${p.prenom} ${p.nom}`)
)).sort((a, b) => a.localeCompare(b, 'fr'));
