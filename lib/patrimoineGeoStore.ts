/**
 * patrimoineGeoStore.ts — Patrimoine Géographique : RÉFÉRENTIEL MAÎTRE SIGEPP-DPE
 * ------------------------------------------------------------------------------
 * Principe directeur : le SIG est le référentiel maître de la plateforme. Le
 * patrimoine géographique (postes, lignes, centrales, ouvrages, sites) devient
 * l'OBJET CENTRAL du système ; le projet n'est plus l'objet principal mais un
 * cycle de vie rattaché à un actif géographique.
 *
 * Un `ActifGeo` agrège et relie, autour d'un point géoréférencé :
 *   - les PROJETS qui le produisent / le font évoluer (projetIds)
 *   - les IMMOBILISATIONS comptables associées (immobilisationIds)
 *
 * Le référentiel est :
 *   - DÉRIVÉ automatiquement des projets géolocalisés et des immobilisations
 *     existantes (`derivePatrimoine`) → la carte n'est jamais vide ;
 *   - ENRICHISSABLE par des actifs saisis manuellement (store persistant).
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Projet } from './projectStore';
import type { Immobilisation, CategorieImmo } from './immobilisationStore';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type TypeActifGeo = 'poste' | 'ligne' | 'centrale' | 'ouvrage' | 'site';
export type StatutActifGeo = 'en_service' | 'en_cours' | 'planifie' | 'reforme';

export interface ActifGeo {
  id: string;
  code: string;
  nom: string;
  type: TypeActifGeo;
  region: string;
  localisation: string;
  lat: number;
  lng: number;
  statut: StatutActifGeo;
  /** Valeur d'acquisition cumulée (MFCFA) si rattachée à des immobilisations. */
  valeurAcquisition?: number;
  /** Projets rattachés à cet actif (cycle de vie). */
  projetIds: string[];
  /** Immobilisations comptables rattachées. */
  immobilisationIds: string[];
  /** Origine de l'actif : dérivé du SI ou saisi manuellement. */
  source: 'derive' | 'manuel';
}

// ─────────────────────────────────────────────────────────────────────────────
// RÉFÉRENTIEL GÉOGRAPHIQUE — centroïdes des régions du Sénégal (WGS84)
// ─────────────────────────────────────────────────────────────────────────────

export const REGION_CENTERS: Record<string, { lat: number; lng: number }> = {
  'Dakar':       { lat: 14.7167, lng: -17.4677 },
  'Thiès':       { lat: 14.7894, lng: -16.9256 },
  'Diourbel':    { lat: 14.6521, lng: -16.2333 },
  'Saint-Louis': { lat: 16.0179, lng: -16.4896 },
  'Louga':       { lat: 15.6185, lng: -16.2247 },
  'Matam':       { lat: 15.6559, lng: -13.2554 },
  'Fatick':      { lat: 14.3384, lng: -16.4101 },
  'Kaolack':     { lat: 14.1652, lng: -16.0758 },
  'Kaffrine':    { lat: 14.1053, lng: -15.5509 },
  'Tambacounda': { lat: 13.7703, lng: -13.6674 },
  'Kédougou':    { lat: 12.5516, lng: -12.1754 },
  'Kolda':       { lat: 12.8833, lng: -14.9500 },
  'Sédhiou':     { lat: 12.7081, lng: -15.5560 },
  'Ziguinchor':  { lat: 12.5833, lng: -16.2667 },
};

/** Centre lat/lng d'une région (fallback : centre du Sénégal). */
export function regionCenter(region: string): { lat: number; lng: number } {
  const key = Object.keys(REGION_CENTERS).find(k => k.toLowerCase() === (region || '').toLowerCase());
  return key ? REGION_CENTERS[key] : { lat: 14.5, lng: -14.5 };
}

// ─────────────────────────────────────────────────────────────────────────────
// LABELS & COULEURS
// ─────────────────────────────────────────────────────────────────────────────

export const TYPE_ACTIF_LABEL: Record<TypeActifGeo, string> = {
  poste: 'Poste / Transformateur',
  ligne: 'Ligne (HTB / HTA / BT)',
  centrale: 'Centrale / Production',
  ouvrage: 'Ouvrage & Génie Civil',
  site: 'Site de projet',
};

export const TYPE_ACTIF_COLOR: Record<TypeActifGeo, string> = {
  poste: '#7C3AED',
  ligne: '#0E3460',
  centrale: '#0EA5E9',
  ouvrage: '#D97706',
  site: '#16A34A',
};

export const STATUT_ACTIF_LABEL: Record<StatutActifGeo, string> = {
  en_service: 'En service',
  en_cours: 'En cours / travaux',
  planifie: 'Planifié',
  reforme: 'Réformé / cédé',
};

// ─────────────────────────────────────────────────────────────────────────────
// MAPPINGS DE DÉRIVATION
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_FROM_CATEGORIE: Record<CategorieImmo, TypeActifGeo> = {
  'Poste HTA/BT': 'poste', 'Poste HTB': 'poste', 'Transformateur': 'poste',
  'Ligne HTA': 'ligne', 'Ligne HTB': 'ligne', 'Ligne BT': 'ligne',
  'Centrale / Production': 'centrale', 'Stockage / Batteries': 'centrale',
  'Bâtiment & Génie Civil': 'ouvrage',
  'Matériel & Équipement': 'site', 'Matériel roulant': 'site',
  'Matériel informatique': 'site', 'Compteurs / AMI': 'site', 'Autre': 'site',
};

function statutFromImmo(s: Immobilisation['statut']): StatutActifGeo {
  if (s === 'en_service') return 'en_service';
  if (s === 'en_cours') return 'en_cours';
  return 'reforme'; // cede | reforme
}

function statutFromProjet(p: Projet): StatutActifGeo {
  if (p.statut === 'termine' || p.statut === 'archive') return 'en_service';
  if (p.statut === 'planifie') return 'planifie';
  return 'en_cours'; // en_cours | en_retard | suspendu
}

/** Décalage déterministe pour éviter l'empilement des marqueurs d'une même région. */
function jitter(base: { lat: number; lng: number }, i: number): { lat: number; lng: number } {
  return {
    lat: base.lat + ((i % 5) - 2) * 0.06,
    lng: base.lng + ((Math.floor(i / 3) % 5) - 2) * 0.06,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DÉRIVATION DU RÉFÉRENTIEL DEPUIS LE SI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Construit le patrimoine géographique à partir des projets visibles et des
 * immobilisations. Chaque immobilisation devient un actif géoréférencé ; chaque
 * projet sans immobilisation devient un « site » (patrimoine en formation).
 */
export function derivePatrimoine(projets: Projet[], immos: Immobilisation[]): ActifGeo[] {
  const projetById: Map<string, Projet> = new Map();
  for (const p of projets) projetById.set(p.id, p);

  const actifs: ActifGeo[] = [];
  const projetsAvecImmo: Set<string> = new Set();

  // 1) Une immobilisation = un actif géographique réel
  immos.forEach((immo, i) => {
    const projet = projetById.get(immo.projetId);
    // On n'expose que les immos rattachées à un projet visible (respect MMH).
    if (!projet) return;
    projetsAvecImmo.add(projet.id);
    const base = (typeof projet.lat === 'number' && typeof projet.lng === 'number')
      ? { lat: projet.lat, lng: projet.lng }
      : regionCenter(projet.region);
    const pos = jitter(base, i);
    actifs.push({
      id: `actif-immo-${immo.id}`,
      code: immo.code || immo.id,
      nom: immo.designation,
      type: TYPE_FROM_CATEGORIE[immo.categorie] ?? 'site',
      region: projet.region,
      localisation: immo.localisation || projet.localisation,
      lat: pos.lat,
      lng: pos.lng,
      statut: statutFromImmo(immo.statut),
      valeurAcquisition: immo.valeurAcquisition,
      projetIds: [projet.id],
      immobilisationIds: [immo.id],
      source: 'derive',
    });
  });

  // 2) Un projet sans immobilisation = un site (futur patrimoine)
  projets.forEach((projet, i) => {
    if (projetsAvecImmo.has(projet.id)) return;
    const base = (typeof projet.lat === 'number' && typeof projet.lng === 'number')
      ? { lat: projet.lat, lng: projet.lng }
      : regionCenter(projet.region);
    const pos = jitter(base, i);
    actifs.push({
      id: `actif-projet-${projet.id}`,
      code: projet.code || projet.id,
      nom: projet.nom,
      type: 'site',
      region: projet.region,
      localisation: projet.localisation,
      lat: pos.lat,
      lng: pos.lng,
      statut: statutFromProjet(projet),
      projetIds: [projet.id],
      immobilisationIds: [],
      source: 'derive',
    });
  });

  return actifs;
}

/** Fusionne le référentiel dérivé et les actifs saisis manuellement. */
export function mergePatrimoine(derives: ActifGeo[], manuels: ActifGeo[]): ActifGeo[] {
  return [...derives, ...manuels];
}

// ─────────────────────────────────────────────────────────────────────────────
// STORE — actifs saisis manuellement (persistés)
// ─────────────────────────────────────────────────────────────────────────────

function uid() { return `actif-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`; }

interface PatrimoineGeoState {
  actifsManuels: ActifGeo[];
  add: (a: Omit<ActifGeo, 'id' | 'source'>) => string;
  update: (id: string, patch: Partial<ActifGeo>) => void;
  remove: (id: string) => void;
  clear: () => void;
}

export const usePatrimoineGeoStore = create<PatrimoineGeoState>()(
  persist(
    (set) => ({
      actifsManuels: [],
      add: (a) => {
        const id = uid();
        set(s => ({ actifsManuels: [...s.actifsManuels, { ...a, id, source: 'manuel' }] }));
        return id;
      },
      update: (id, patch) => set(s => ({
        actifsManuels: s.actifsManuels.map(a => (a.id === id ? { ...a, ...patch } : a)),
      })),
      remove: (id) => set(s => ({ actifsManuels: s.actifsManuels.filter(a => a.id !== id) })),
      clear: () => set({ actifsManuels: [] }),
    }),
    { name: 'sigepp-patrimoine-geo' },
  ),
);
