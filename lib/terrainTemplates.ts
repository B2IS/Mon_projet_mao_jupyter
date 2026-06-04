/**
 * terrainTemplates.ts — Référentiel des fiches de réception terrain par TYPE de projet.
 *
 * Source : matrices de suivi réelles DPE (DPD Distribution, DPT Transport, …) — fév. 2026.
 * Chaque type de projet expose :
 *   • un modèle de pondération par PHASE (identique aux onglets « Pondérations » des matrices) ;
 *   • une liste d'INDICATEURS PHYSIQUES pertinents (le contenu réel de la colonne
 *     « Réalisation à date » : embases, pylônes, km de réseau, postes MT/BT, branchements…).
 *
 * Ce référentiel alimente : la saisie terrain mensuelle (synchronisation mobile),
 * le calcul d'avancement physique pondéré, et les fiches de réception (PVP/PVD).
 */

import type { Domaine } from './projectStore';

/* ─── Phases standard (cycle de vie projet DPE) + pondération matricielle ─── */
export type PhaseKey = 'passation' | 'etudes' | 'fournitures' | 'travaux' | 'mise_en_service' | 'cloture';

export interface PhaseDef {
  key: PhaseKey;
  label: string;
  poids: number; // % — somme = 100
}

/** Pondération par défaut, conforme à l'onglet « Pondérations » des matrices DPD & DPT. */
export const DEFAULT_PHASE_WEIGHTS: PhaseDef[] = [
  { key: 'passation',       label: 'Préparation',      poids: 10 },
  { key: 'etudes',          label: 'Études',           poids: 10 },
  { key: 'fournitures',     label: 'Approvisionnement', poids: 20 },
  { key: 'travaux',         label: 'Travaux',          poids: 52 },
  { key: 'mise_en_service', label: 'Mise en service',  poids: 5 },
  { key: 'cloture',         label: 'Clôture',          poids: 3 },
];

/* ─── Indicateurs physiques pertinents par type de projet ─────────────────── */
export type IndicateurUnite = 'unite' | 'km' | 'pct' | 'nombre' | 'ml';

export interface IndicateurPhysique {
  key: string;
  label: string;
  unite: IndicateurUnite;
  phase: PhaseKey;
}

export interface TerrainTemplate {
  /** identifiant stable du type de projet */
  type: string;
  label: string;
  domaine: Domaine;
  /** mots-clés pour rattacher automatiquement un projet à ce modèle (libellé/description) */
  matchKeywords: string[];
  phases: PhaseDef[];
  indicateurs: IndicateurPhysique[];
}

/* Modèles dérivés des matrices réelles. Les indicateurs reprennent le vocabulaire terrain. */
export const TERRAIN_TEMPLATES: TerrainTemplate[] = [
  {
    type: 'transport_poste',
    label: 'Transport — Poste HT (GIS/AIS)',
    domaine: 'transport',
    matchKeywords: ['poste', 'gis', 'ais', '225', '90 kv', '90kv', 'patte', 'koungheul', 'velingara', 'sindia'],
    phases: DEFAULT_PHASE_WEIGHTS,
    indicateurs: [
      { key: 'gc_batiment', label: 'Travaux GC bâtiment (%)', unite: 'pct', phase: 'travaux' },
      { key: 'fouilles', label: 'Fouilles ouvertes (nb/total)', unite: 'nombre', phase: 'travaux' },
      { key: 'terrassement', label: 'Terrassement plateforme (%)', unite: 'pct', phase: 'travaux' },
      { key: 'equip_gis', label: 'Équipements GIS posés (%)', unite: 'pct', phase: 'fournitures' },
      { key: 'transfo', label: 'Transformateurs installés (nb)', unite: 'nombre', phase: 'travaux' },
      { key: 'essais', label: 'Essais & mise sous tension (%)', unite: 'pct', phase: 'mise_en_service' },
    ],
  },
  {
    type: 'transport_ligne',
    label: 'Transport — Ligne HT (225/90 kV)',
    domaine: 'transport',
    matchKeywords: ['liaison', 'ligne', 'terne', 'ferlo', 'aérienne', 'souterraine', 'évacuation', 'boucle'],
    phases: DEFAULT_PHASE_WEIGHTS,
    indicateurs: [
      { key: 'embases', label: 'Embases réalisées (nb/total)', unite: 'nombre', phase: 'travaux' },
      { key: 'montage_pylones', label: 'Montage pylônes (nb/total)', unite: 'nombre', phase: 'travaux' },
      { key: 'tirage_cables', label: 'Tirage câbles (km)', unite: 'km', phase: 'travaux' },
      { key: 'deroulage', label: 'Déroulage conducteurs (%)', unite: 'pct', phase: 'travaux' },
      { key: 'liberation_emprise', label: 'Libération emprise / ROW (%)', unite: 'pct', phase: 'etudes' },
      { key: 'essais', label: 'Essais & mise en service (%)', unite: 'pct', phase: 'mise_en_service' },
    ],
  },
  {
    type: 'distribution_reseau',
    label: 'Distribution — Réseau MT/BT & Postes',
    domaine: 'distribution',
    matchKeywords: ['réseau', 'reseau', 'mt/bt', 'mt', 'bt', 'densification', 'sécurisation', 'securisation', 'réhabilitation', 'rehabilitation', 'renforcement', 'distribution'],
    phases: DEFAULT_PHASE_WEIGHTS,
    indicateurs: [
      { key: 'reseau_mt', label: 'Réseau MT construit (km)', unite: 'km', phase: 'travaux' },
      { key: 'reseau_bt', label: 'Réseau BT construit (km)', unite: 'km', phase: 'travaux' },
      { key: 'postes_mtbt', label: 'Postes MT/BT posés (nb/total)', unite: 'nombre', phase: 'travaux' },
      { key: 'supports', label: 'Supports/poteaux implantés (nb)', unite: 'nombre', phase: 'travaux' },
      { key: 'branchements', label: 'Branchements sociaux (nb)', unite: 'nombre', phase: 'travaux' },
      { key: 'compteurs', label: 'Compteurs posés (nb)', unite: 'nombre', phase: 'mise_en_service' },
    ],
  },
  {
    type: 'electrification_rurale',
    label: 'Distribution — Électrification rurale',
    domaine: 'distribution',
    matchKeywords: ['électrification', 'electrification', 'rurale', 'localité', 'localite', 'village', 'urgence', 'accès', 'acces'],
    phases: DEFAULT_PHASE_WEIGHTS,
    indicateurs: [
      { key: 'localites', label: 'Localités électrifiées (nb/total)', unite: 'nombre', phase: 'travaux' },
      { key: 'reseau_mt', label: 'Réseau MT (km)', unite: 'km', phase: 'travaux' },
      { key: 'reseau_bt', label: 'Réseau BT (km)', unite: 'km', phase: 'travaux' },
      { key: 'postes', label: 'Postes de transformation (nb)', unite: 'nombre', phase: 'travaux' },
      { key: 'menages', label: 'Ménages raccordés (nb)', unite: 'nombre', phase: 'mise_en_service' },
      { key: 'branchements', label: 'Branchements réalisés (nb)', unite: 'nombre', phase: 'mise_en_service' },
    ],
  },
  {
    type: 'production',
    label: 'Production — Centrale / Moyens de production',
    domaine: 'production',
    matchKeywords: ['centrale', 'production', 'groupe', 'turbine', 'solaire', 'photovolta', 'générat', 'generat'],
    phases: DEFAULT_PHASE_WEIGHTS,
    indicateurs: [
      { key: 'gc_fondations', label: 'GC & fondations (%)', unite: 'pct', phase: 'travaux' },
      { key: 'montage_equip', label: 'Montage équipements (%)', unite: 'pct', phase: 'travaux' },
      { key: 'lignes_evac', label: 'Lignes d\'évacuation (km)', unite: 'km', phase: 'travaux' },
      { key: 'capacite', label: 'Capacité installée (MW)', unite: 'nombre', phase: 'fournitures' },
      { key: 'essais', label: 'Essais & mise en service (%)', unite: 'pct', phase: 'mise_en_service' },
    ],
  },
  {
    type: 'genie_civil',
    label: 'Génie Civil — Bâtiment / Ouvrage',
    domaine: 'genie_civil',
    matchKeywords: ['bâtiment', 'batiment', 'génie civil', 'genie civil', 'ouvrage', 'vrd', 'route', 'siège', 'siege'],
    phases: DEFAULT_PHASE_WEIGHTS,
    indicateurs: [
      { key: 'terrassement', label: 'Terrassement (%)', unite: 'pct', phase: 'travaux' },
      { key: 'gros_oeuvre', label: 'Gros œuvre (%)', unite: 'pct', phase: 'travaux' },
      { key: 'second_oeuvre', label: 'Second œuvre & VRD (%)', unite: 'pct', phase: 'travaux' },
      { key: 'cet', label: 'Corps d\'état techniques (%)', unite: 'pct', phase: 'travaux' },
      { key: 'reception', label: 'Réception & levée réserves (%)', unite: 'pct', phase: 'mise_en_service' },
    ],
  },
  {
    type: 'commercial_si',
    label: 'Commercial / SI — Déploiement',
    domaine: 'commercial',
    matchKeywords: ['compteur', 'ami', 'commercial', 'si', 'système', 'systeme', 'déploiement', 'deploiement', 'comptage'],
    phases: DEFAULT_PHASE_WEIGHTS,
    indicateurs: [
      { key: 'specs', label: 'Spécifications validées (%)', unite: 'pct', phase: 'etudes' },
      { key: 'dev', label: 'Développement / paramétrage (%)', unite: 'pct', phase: 'travaux' },
      { key: 'compteurs', label: 'Compteurs / unités déployés (nb)', unite: 'nombre', phase: 'travaux' },
      { key: 'uat', label: 'Tests UAT (%)', unite: 'pct', phase: 'mise_en_service' },
      { key: 'formation', label: 'Formation utilisateurs (%)', unite: 'pct', phase: 'mise_en_service' },
    ],
  },
];

const norm = (s: string) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Retourne le modèle terrain le plus pertinent pour un projet (par mots-clés puis domaine). */
export function resolveTemplate(domaine: Domaine, libelle = '', description = ''): TerrainTemplate {
  const hay = norm(`${libelle} ${description}`);
  const candidates = TERRAIN_TEMPLATES.filter(t => t.domaine === domaine);
  // 1) meilleur score par mots-clés parmi les modèles du même domaine
  let best: TerrainTemplate | undefined;
  let bestScore = 0;
  for (const t of candidates) {
    const score = t.matchKeywords.reduce((s, k) => s + (hay.includes(norm(k)) ? 1 : 0), 0);
    if (score > bestScore) { bestScore = score; best = t; }
  }
  if (best) return best;
  // 2) premier modèle du domaine, sinon repli générique distribution
  return candidates[0] ?? TERRAIN_TEMPLATES.find(t => t.type === 'distribution_reseau')!;
}

export function getTemplateByType(type: string): TerrainTemplate | undefined {
  return TERRAIN_TEMPLATES.find(t => t.type === type);
}

/** Avancement physique pondéré (0..100) à partir de l'avancement par phase (0..100 par phase). */
export function computeWeightedProgress(
  phaseProgress: Partial<Record<PhaseKey, number>>,
  phases: PhaseDef[] = DEFAULT_PHASE_WEIGHTS,
): number {
  const totalPoids = phases.reduce((s, p) => s + p.poids, 0) || 1;
  const acc = phases.reduce((s, p) => s + (Math.max(0, Math.min(100, phaseProgress[p.key] ?? 0)) * p.poids), 0);
  return Math.round(acc / totalPoids);
}
