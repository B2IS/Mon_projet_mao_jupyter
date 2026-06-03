/**
 * mobileSyncStore.ts — Saisies terrain mensuelles + file de synchronisation mobile.
 *
 * Modélise le flux réel : un agent sur le terrain renseigne chaque mois, par projet,
 * l'avancement par phase + les indicateurs physiques pertinents (selon le TYPE de projet,
 * cf. terrainTemplates). La saisie peut être faite hors-ligne (« brouillon ») puis
 * synchronisée (« synchronisé ») vers la plateforme.
 *
 * Persisté dans localStorage (clé `sigepp-mobile-sync`).
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PhaseKey } from './terrainTemplates';

export type SyncStatut = 'brouillon' | 'en_attente' | 'synchronise';

export interface SaisieTerrain {
  id: string;
  projetCode: string;
  projetNom: string;
  templateType: string;        // type de projet (terrainTemplates)
  periode: string;             // 'YYYY-MM' (dérivé de la date de visite — compat & regroupement)
  dateVisite?: string;         // 'YYYY-MM-DD' — date réelle de la visite terrain (saisie à tout moment)
  visiteLibelle?: string;      // ex. « Visite hebdo », « Réception partielle », « Constat »
  region: string;
  localisation: string;
  gps?: { lat: number; lng: number };
  phaseProgress: Partial<Record<PhaseKey, number>>; // 0..100 par phase
  indicateurs: Record<string, number | string>;     // key indicateur -> valeur saisie
  facturationMois?: number;    // MFCFA facturés sur la période
  observations?: string;
  photos: number;              // nb de photos jointes
  auteur: string;
  device?: string;
  statut: SyncStatut;
  createdAt: string;           // ISO
  syncedAt?: string;           // ISO
}

export interface MobileSyncState {
  saisies: SaisieTerrain[];
  addSaisie: (s: Omit<SaisieTerrain, 'id' | 'createdAt' | 'statut'> & { statut?: SyncStatut }) => string;
  updateSaisie: (id: string, patch: Partial<SaisieTerrain>) => void;
  removeSaisie: (id: string) => void;
  /** Marque toutes les saisies en attente/brouillon comme synchronisées (simule l'upload). */
  syncAll: () => number;
  syncOne: (id: string) => void;
}

const nowISO = () => new Date().toISOString();

/* Exemples seedés depuis les matrices réelles DPD (Distribution) & DPT (Transport) — fév. 2026. */
const SEED: SaisieTerrain[] = [
  {
    id: 'st-dpt-1', projetCode: '23TE10135020', projetNom: 'POSTE KOUNGHEUL AIS 225/30 kV',
    templateType: 'transport_poste', periode: '2026-02', region: 'Kaffrine',
    localisation: 'Koungheul', gps: { lat: 13.9817, lng: -14.7958 },
    phaseProgress: { passation: 100, etudes: 100, fournitures: 98, travaux: 99, mise_en_service: 0, cloture: 0 },
    indicateurs: { gc_batiment: 98.77, fouilles: '36/36', equip_gis: 90, transfo: 2, essais: 10 },
    facturationMois: 139.92, observations: 'Travaux GC : 98,77% — terrassement terminé, essais à planifier.',
    photos: 6, auteur: 'Jean Marie Sene', device: 'Terrain-DPT-01', statut: 'synchronise',
    createdAt: '2026-02-26T09:12:00Z', syncedAt: '2026-02-26T18:30:00Z',
  },
  {
    id: 'st-dpt-2', projetCode: '23TE10135024', projetNom: 'POSTE DE SINDIA 225/90/30 kV',
    templateType: 'transport_poste', periode: '2026-02', region: 'Thiès',
    localisation: 'Sindia, Mbour', gps: { lat: 14.4167, lng: -17.0 },
    phaseProgress: { passation: 100, etudes: 100, fournitures: 60, travaux: 42, mise_en_service: 0, cloture: 0 },
    indicateurs: { gc_batiment: 42, fouilles: '18/24', equip_gis: 35, transfo: 0, essais: 0 },
    facturationMois: 0, observations: 'Bâtiment GIS 225 kV en cours de gros œuvre.',
    photos: 4, auteur: 'Stéphane Niouky', device: 'Terrain-DPT-02', statut: 'synchronise',
    createdAt: '2026-02-27T10:40:00Z', syncedAt: '2026-02-27T19:05:00Z',
  },
  {
    id: 'st-dpt-3', projetCode: '307/18TE20031088', projetNom: 'Boucle du Ferlo — Extension',
    templateType: 'transport_ligne', periode: '2026-02', region: 'Louga',
    localisation: 'Touba, Linguère, Ndioum', gps: { lat: 15.3833, lng: -15.3 },
    phaseProgress: { passation: 100, etudes: 100, fournitures: 100, travaux: 94, mise_en_service: 0, cloture: 0 },
    indicateurs: { embases: '120/128', montage_pylones: '118/128', tirage_cables: 168, deroulage: 92, liberation_emprise: 100, essais: 0 },
    facturationMois: 354.40, observations: 'Réalisation globale 94% — projet actuellement à l’arrêt (financement).',
    photos: 8, auteur: 'Ismaïla Ba', device: 'Terrain-DPT-03', statut: 'synchronise',
    createdAt: '2026-02-25T08:00:00Z', syncedAt: '2026-02-25T17:45:00Z',
  },
  {
    id: 'st-dpd-1', projetCode: '18DX30211498', projetNom: 'L20 — Sécurisation réseau MT/BT (PASE)',
    templateType: 'distribution_reseau', periode: '2026-02', region: 'Dakar',
    localisation: 'Diass, Sébikhotane, Bénteignée', gps: { lat: 14.6667, lng: -17.0833 },
    phaseProgress: { passation: 100, etudes: 100, fournitures: 85, travaux: 70, mise_en_service: 20, cloture: 0 },
    indicateurs: { reseau_mt: 8.2, reseau_bt: 12.5, postes_mtbt: '14/20', supports: 210, branchements: 480, compteurs: 320 },
    facturationMois: 0, observations: '10 km de réseaux MT prévus — 8,2 km posés.',
    photos: 5, auteur: 'Abdourahmane Diallo', device: 'Terrain-DPD-01', statut: 'synchronise',
    createdAt: '2026-02-24T07:50:00Z', syncedAt: '2026-02-24T16:20:00Z',
  },
  {
    id: 'st-dpd-2', projetCode: 'PU-DPD-2026', projetNom: 'Travaux Programme d’Urgence — Électrification rurale',
    templateType: 'electrification_rurale', periode: '2026-02', region: 'Multi-régions',
    localisation: 'Thiès, Diourbel, Louga, Kaolack', gps: { lat: 14.79, lng: -16.93 },
    phaseProgress: { passation: 100, etudes: 100, fournitures: 90, travaux: 65, mise_en_service: 15, cloture: 0 },
    indicateurs: { localites: '12/19', reseau_mt: 22, reseau_bt: 41, postes: 18, menages: 1340, branchements: 1180 },
    facturationMois: 82.6, observations: 'Programme d’urgence en cours d’exécution (Fass Électricité).',
    photos: 9, auteur: 'Ababacar Ka', device: 'Terrain-DPD-02', statut: 'en_attente',
    createdAt: '2026-02-28T11:30:00Z',
  },
];

export const useMobileSyncStore = create<MobileSyncState>()(
  persist(
    (set, get) => ({
      saisies: SEED,
      addSaisie: (s) => {
        const id = `st-${Date.now()}`;
        set(state => ({
          saisies: [{ ...s, id, statut: s.statut ?? 'brouillon', createdAt: nowISO() }, ...state.saisies],
        }));
        return id;
      },
      updateSaisie: (id, patch) => set(state => ({
        saisies: state.saisies.map(x => x.id === id ? { ...x, ...patch } : x),
      })),
      removeSaisie: (id) => set(state => ({ saisies: state.saisies.filter(x => x.id !== id) })),
      syncAll: () => {
        const pending = get().saisies.filter(x => x.statut !== 'synchronise').length;
        set(state => ({
          saisies: state.saisies.map(x => x.statut === 'synchronise' ? x : { ...x, statut: 'synchronise', syncedAt: nowISO() }),
        }));
        return pending;
      },
      syncOne: (id) => set(state => ({
        saisies: state.saisies.map(x => x.id === id ? { ...x, statut: 'synchronise', syncedAt: nowISO() } : x),
      })),
    }),
    { name: 'sigepp-mobile-sync', partialize: (s) => ({ saisies: s.saisies }) }
  )
);
