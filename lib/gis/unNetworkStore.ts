/**
 * unNetworkStore.ts — Store Zustand du réseau Utility Network SENELEC
 * Données mock réalistes (Sénégal) pour développement sans connexion ArcGIS.
 * Bascule automatiquement sur ArcGIS Enterprise quand portalUrl configuré.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UNTier, MigrationCategory } from './unModel';
import { UN_LAYERS } from './unModel';

// ─── GeoJSON-like features UN ────────────────────────────────────────────────

export interface UNPoint {
  lat: number;
  lng: number;
}

export interface UNLineFeature {
  id:        string;
  layerId:   number;
  name:      string;
  tier:      UNTier;
  assetGroup:string;
  assetType: string;
  coords:    [number, number][]; // [lat, lng][]
  feederID?: string;
  voltageKV: number;
  attributes:Record<string, string | number | null>;
}

export interface UNPointFeature {
  id:        string;
  layerId:   number;
  name:      string;
  tier:      UNTier | null;
  assetGroup:string;
  assetType: string;
  lat:       number;
  lng:       number;
  feederID?: string;
  voltageKV: number;
  attributes:Record<string, string | number | null>;
}

// ─── Données mock réseau SENELEC ─────────────────────────────────────────────
// Coordonnées réelles Sénégal (WGS84)

const MOCK_HTB_LINES: UNLineFeature[] = [
  {
    id: 'htb-l01', layerId: 0, name: 'Ligne HTB 225kV Dakar–Thiès', tier: 'HTB',
    assetGroup: 'OverheadLine', assetType: 'Ligne aérienne HTB 225kV',
    coords: [[14.693, -17.444], [14.72, -17.25], [14.745, -17.05], [14.789, -16.926]],
    feederID: 'F-HTB-225-01', voltageKV: 225,
    attributes: { longueurKm: 58.2, etat: 'EN_SERVICE', annee_pose: 2008 },
  },
  {
    id: 'htb-l02', layerId: 0, name: 'Ligne HTB 90kV Thiès–Diourbel', tier: 'HTB',
    assetGroup: 'OverheadLine', assetType: 'Ligne aérienne HTB 90kV',
    coords: [[14.789, -16.926], [14.760, -16.65], [14.652, -16.233]],
    feederID: 'F-HTB-90-02', voltageKV: 90,
    attributes: { longueurKm: 76.4, etat: 'EN_SERVICE', annee_pose: 2001 },
  },
  {
    id: 'htb-l03', layerId: 0, name: 'Ligne HTB 90kV Dakar–Kaolack', tier: 'HTB',
    assetGroup: 'OverheadLine', assetType: 'Ligne aérienne HTB 90kV',
    coords: [[14.693, -17.444], [14.5, -17.1], [14.338, -16.41], [14.165, -16.076]],
    feederID: 'F-HTB-90-03', voltageKV: 90,
    attributes: { longueurKm: 189.5, etat: 'EN_SERVICE', annee_pose: 1998 },
  },
  {
    id: 'htb-l04', layerId: 0, name: 'Ligne HTB 90kV Kaolack–Ziguinchor', tier: 'HTB',
    assetGroup: 'OverheadLine', assetType: 'Ligne aérienne HTB 90kV',
    coords: [[14.165, -16.076], [13.770, -15.5], [13.300, -15.8], [12.583, -16.267]],
    feederID: 'F-HTB-90-04', voltageKV: 90,
    attributes: { longueurKm: 234.1, etat: 'EN_SERVICE', annee_pose: 2003 },
  },
  {
    id: 'htb-l05', layerId: 0, name: 'Ligne HTB 225kV Dakar–Saint-Louis', tier: 'HTB',
    assetGroup: 'OverheadLine', assetType: 'Ligne aérienne HTB 225kV',
    coords: [[14.693, -17.444], [15.0, -17.2], [15.5, -16.8], [16.018, -16.490]],
    feederID: 'F-HTB-225-05', voltageKV: 225,
    attributes: { longueurKm: 270.0, etat: 'EN_SERVICE', annee_pose: 2012 },
  },
  {
    id: 'htb-l06', layerId: 0, name: 'Ligne HTB 90kV Thiès–Louga', tier: 'HTB',
    assetGroup: 'OverheadLine', assetType: 'Ligne aérienne HTB 90kV',
    coords: [[14.789, -16.926], [15.2, -16.7], [15.619, -16.225]],
    feederID: 'F-HTB-90-06', voltageKV: 90,
    attributes: { longueurKm: 131.2, etat: 'EN_SERVICE', annee_pose: 2005 },
  },
];

const MOCK_HTA_LINES: UNLineFeature[] = [
  {
    id: 'hta-l01', layerId: 1, name: 'Départ HTA OH F1 – Plateau', tier: 'HTA',
    assetGroup: 'OverheadLine', assetType: 'Ligne aérienne HTA 30kV',
    coords: [[14.693, -17.444], [14.695, -17.42], [14.700, -17.39], [14.710, -17.37]],
    feederID: 'F-HTA-DKR-01', voltageKV: 30,
    attributes: { longueurKm: 8.4, etat: 'EN_SERVICE', nb_postes: 6 },
  },
  {
    id: 'hta-l02', layerId: 2, name: 'Départ HTA UG F2 – Médina', tier: 'HTA',
    assetGroup: 'UndergroundCable', assetType: 'Câble HTA UG',
    coords: [[14.693, -17.444], [14.688, -17.455], [14.682, -17.462], [14.676, -17.468]],
    feederID: 'F-HTA-DKR-02', voltageKV: 30,
    attributes: { longueurKm: 3.2, etat: 'EN_SERVICE', nb_postes: 4, sectionMm2: 240 },
  },
  {
    id: 'hta-l03', layerId: 1, name: 'Départ HTA OH F3 – Pikine', tier: 'HTA',
    assetGroup: 'OverheadLine', assetType: 'Ligne aérienne HTA 30kV',
    coords: [[14.693, -17.444], [14.720, -17.42], [14.740, -17.40], [14.758, -17.385]],
    feederID: 'F-HTA-DKR-03', voltageKV: 30,
    attributes: { longueurKm: 12.1, etat: 'EN_SERVICE', nb_postes: 9 },
  },
  {
    id: 'hta-l04', layerId: 2, name: 'Départ HTA UG F4 – Almadies', tier: 'HTA',
    assetGroup: 'UndergroundCable', assetType: 'Câble HTA UG',
    coords: [[14.693, -17.444], [14.730, -17.502], [14.742, -17.520], [14.747, -17.537]],
    feederID: 'F-HTA-DKR-04', voltageKV: 30,
    attributes: { longueurKm: 5.8, etat: 'EN_SERVICE', nb_postes: 5, sectionMm2: 150 },
  },
  {
    id: 'hta-l05', layerId: 1, name: 'Départ HTA OH F1 – Thiès Nord', tier: 'HTA',
    assetGroup: 'OverheadLine', assetType: 'Ligne aérienne HTA 30kV',
    coords: [[14.789, -16.926], [14.810, -16.91], [14.830, -16.90], [14.850, -16.88]],
    feederID: 'F-HTA-THS-01', voltageKV: 30,
    attributes: { longueurKm: 7.3, etat: 'EN_SERVICE', nb_postes: 5 },
  },
  {
    id: 'hta-l06', layerId: 1, name: 'Départ HTA OH F2 – Kaolack Centre', tier: 'HTA',
    assetGroup: 'OverheadLine', assetType: 'Ligne aérienne HTA 30kV',
    coords: [[14.165, -16.076], [14.180, -16.060], [14.195, -16.042], [14.210, -16.028]],
    feederID: 'F-HTA-KAO-01', voltageKV: 30,
    attributes: { longueurKm: 6.1, etat: 'EN_SERVICE', nb_postes: 4 },
  },
];

const MOCK_BT_LINES: UNLineFeature[] = [
  {
    id: 'bt-l01', layerId: 3, name: 'Réseau BT OH – Quartier Plateau', tier: 'BT',
    assetGroup: 'OverheadLine', assetType: 'Ligne aérienne BT OH',
    coords: [[14.700, -17.37], [14.703, -17.368], [14.706, -17.364], [14.709, -17.360]],
    feederID: 'F-HTA-DKR-01', voltageKV: 0.4,
    attributes: { longueurKm: 0.9, etat: 'EN_SERVICE', nb_compteurs: 48 },
  },
  {
    id: 'bt-l02', layerId: 4, name: 'Réseau BT UG – Centre-ville Dakar', tier: 'BT',
    assetGroup: 'UndergroundCable', assetType: 'Câble BT UG',
    coords: [[14.676, -17.468], [14.677, -17.464], [14.679, -17.460], [14.681, -17.457]],
    feederID: 'F-HTA-DKR-02', voltageKV: 0.4,
    attributes: { longueurKm: 0.6, etat: 'EN_SERVICE', nb_compteurs: 32, sectionMm2: 95 },
  },
];

// ─── Points (Devices, Assemblies, Junctions) ────────────────────────────────

const MOCK_POINTS: UNPointFeature[] = [
  // Postes HTB (assemblies)
  { id: 'p-htb-01', layerId: 17, name: 'Poste HTB Cap-des-Biches 225kV', tier: 'HTB', assetGroup: 'DynamicSwitch', assetType: 'Disjoncteur source HTB', lat: 14.693, lng: -17.444, feederID: 'F-HTB-225-01', voltageKV: 225, attributes: { puissanceMVA: 200, annee: 2008, etat: 'EN_SERVICE' } },
  { id: 'p-htb-02', layerId: 17, name: 'Poste HTB Thiès 225/90kV', tier: 'HTB',        assetGroup: 'Transformer',   assetType: 'Transformateur de puissance 225/90kV', lat: 14.789, lng: -16.926, feederID: 'F-HTB-225-01', voltageKV: 225, attributes: { puissanceMVA: 100, annee: 2001, etat: 'EN_SERVICE' } },
  { id: 'p-htb-03', layerId: 17, name: 'Poste HTB Kaolack 90/30kV', tier: 'HTB',       assetGroup: 'Transformer',   assetType: 'Transformateur de puissance 90/30kV', lat: 14.165, lng: -16.076, feederID: 'F-HTB-90-03', voltageKV: 90, attributes: { puissanceMVA: 63, annee: 1998, etat: 'EN_SERVICE' } },
  { id: 'p-htb-04', layerId: 17, name: 'Poste HTB Saint-Louis 90kV', tier: 'HTB',       assetGroup: 'Transformer',   assetType: 'Transformateur de puissance 90/30kV', lat: 16.018, lng: -16.490, feederID: 'F-HTB-225-05', voltageKV: 90, attributes: { puissanceMVA: 63, annee: 2012, etat: 'EN_SERVICE' } },
  { id: 'p-htb-05', layerId: 17, name: 'Poste HTB Ziguinchor 90/30kV', tier: 'HTB',    assetGroup: 'Transformer',   assetType: 'Transformateur de puissance 90/30kV', lat: 12.583, lng: -16.267, feederID: 'F-HTB-90-04', voltageKV: 90, attributes: { puissanceMVA: 40, annee: 2003, etat: 'EN_SERVICE' } },
  { id: 'p-htb-06', layerId: 17, name: 'Poste HTB Louga 90/30kV', tier: 'HTB',          assetGroup: 'Transformer',   assetType: 'Transformateur de puissance 90/30kV', lat: 15.619, lng: -16.225, feederID: 'F-HTB-90-06', voltageKV: 90, attributes: { puissanceMVA: 25, annee: 2005, etat: 'EN_SERVICE' } },
  { id: 'p-htb-07', layerId: 17, name: 'Poste HTB Diourbel 90/30kV', tier: 'HTB',       assetGroup: 'Transformer',   assetType: 'Transformateur de puissance 90/30kV', lat: 14.652, lng: -16.233, feederID: 'F-HTB-90-02', voltageKV: 90, attributes: { puissanceMVA: 25, annee: 2001, etat: 'EN_SERVICE' } },

  // Postes HTA/BT (disjoncteur source HTA = subnetwork controller)
  { id: 'p-hta-01', layerId: 6,  name: 'Disj. source HTA F1 – DKR Plateau', tier: 'HTA', assetGroup: 'DynamicSwitch', assetType: 'Disjoncteur source HTA', lat: 14.693, lng: -17.444, feederID: 'F-HTA-DKR-01', voltageKV: 30, attributes: { courantNominal: 400, etat: 'FERME', position: 'FERME' } },
  { id: 'p-hta-02', layerId: 6,  name: 'Disj. source HTA F2 – DKR Médina', tier: 'HTA',  assetGroup: 'DynamicSwitch', assetType: 'Disjoncteur source HTA', lat: 14.693, lng: -17.446, feederID: 'F-HTA-DKR-02', voltageKV: 30, attributes: { courantNominal: 400, etat: 'FERME', position: 'FERME' } },

  // Transformateurs HTA/BT (postes de distribution)
  { id: 'p-tr-01', layerId: 7,  name: 'PM PLATEAU 1 — 30kV/BT',       tier: 'HTA', assetGroup: 'Transformer', assetType: 'Transformateur HT/BT', lat: 14.700, lng: -17.390, feederID: 'F-HTA-DKR-01', voltageKV: 30, attributes: { puissanceKVA: 630, annee: 2015, etat: 'EN_SERVICE', TerminalPrimaire: 30, TerminalSecondaire: 0.4 } },
  { id: 'p-tr-02', layerId: 7,  name: 'PM MEDINA CENTRE — 30kV/BT',   tier: 'HTA', assetGroup: 'Transformer', assetType: 'Transformateur HT/BT', lat: 14.682, lng: -17.462, feederID: 'F-HTA-DKR-02', voltageKV: 30, attributes: { puissanceKVA: 400, annee: 2010, etat: 'EN_SERVICE', TerminalPrimaire: 30, TerminalSecondaire: 0.4 } },
  { id: 'p-tr-03', layerId: 7,  name: 'PM PIKINE NORD — 30kV/BT',     tier: 'HTA', assetGroup: 'Transformer', assetType: 'Transformateur HT/BT', lat: 14.740, lng: -17.400, feederID: 'F-HTA-DKR-03', voltageKV: 30, attributes: { puissanceKVA: 630, annee: 2018, etat: 'EN_SERVICE', TerminalPrimaire: 30, TerminalSecondaire: 0.4 } },
  { id: 'p-tr-04', layerId: 7,  name: 'PM ALMADIES — 30kV/BT',        tier: 'HTA', assetGroup: 'Transformer', assetType: 'Transformateur HT/BT', lat: 14.742, lng: -17.520, feederID: 'F-HTA-DKR-04', voltageKV: 30, attributes: { puissanceKVA: 250, annee: 2012, etat: 'EN_SERVICE', TerminalPrimaire: 30, TerminalSecondaire: 0.4 } },
  { id: 'p-tr-05', layerId: 7,  name: 'PM THIES NORD — 30kV/BT',      tier: 'HTA', assetGroup: 'Transformer', assetType: 'Transformateur HT/BT', lat: 14.830, lng: -16.900, feederID: 'F-HTA-THS-01', voltageKV: 30, attributes: { puissanceKVA: 400, annee: 2009, etat: 'EN_SERVICE', TerminalPrimaire: 30, TerminalSecondaire: 0.4 } },
  { id: 'p-tr-06', layerId: 7,  name: 'PM KAOLACK CENTRE — 30kV/BT',  tier: 'HTA', assetGroup: 'Transformer', assetType: 'Transformateur HT/BT', lat: 14.195, lng: -16.042, feederID: 'F-HTA-KAO-01', voltageKV: 30, attributes: { puissanceKVA: 315, annee: 2006, etat: 'EN_SERVICE', TerminalPrimaire: 30, TerminalSecondaire: 0.4 } },

  // RMU (assemblies HTA)
  { id: 'p-rmu-01', layerId: 15, name: 'RMU Plateau-A',   tier: 'HTA', assetGroup: 'RMU', assetType: 'RMU 4 départs', lat: 14.697, lng: -17.385, feederID: 'F-HTA-DKR-01', voltageKV: 30, attributes: { modele: 'Schneider RM6', nbDeparts: 4, etat: 'EN_SERVICE' } },
  { id: 'p-rmu-02', layerId: 15, name: 'RMU Médina-B',    tier: 'HTA', assetGroup: 'RMU', assetType: 'RMU 3 départs', lat: 14.685, lng: -17.458, feederID: 'F-HTA-DKR-02', voltageKV: 30, attributes: { modele: 'Schneider RM6', nbDeparts: 3, etat: 'EN_SERVICE' } },
  { id: 'p-rmu-03', layerId: 15, name: 'RMU Almadies-C',  tier: 'HTA', assetGroup: 'RMU', assetType: 'RMU 4 départs', lat: 14.745, lng: -17.528, feederID: 'F-HTA-DKR-04', voltageKV: 30, attributes: { modele: 'Schneider SM6',  nbDeparts: 4, etat: 'EN_SERVICE' } },

  // Coffrets BT
  { id: 'p-lvb-01', layerId: 16, name: 'Coffret BT Plateau-1', tier: 'BT', assetGroup: 'LVBoard', assetType: 'Coffret distribution BT', lat: 14.703, lng: -17.367, feederID: 'F-HTA-DKR-01', voltageKV: 0.4, attributes: { nbCircuits: 8, etat: 'EN_SERVICE' } },
  { id: 'p-lvb-02', layerId: 16, name: 'Coffret BT Médina-1',  tier: 'BT', assetGroup: 'LVBoard', assetType: 'Coffret distribution BT', lat: 14.679, lng: -17.459, feederID: 'F-HTA-DKR-02', voltageKV: 0.4, attributes: { nbCircuits: 6, etat: 'EN_SERVICE' } },
  { id: 'p-lvb-03', layerId: 16, name: 'Coffret EP Plateau-1', tier: 'BT', assetGroup: 'LVBoard', assetType: 'Armoire éclairage public',  lat: 14.706, lng: -17.363, feederID: 'F-HTA-DKR-01', voltageKV: 0.4, attributes: { nbLampadaires: 24, etat: 'EN_SERVICE' } },

  // Pylônes HTB (structure domain)
  { id: 'str-pyl-01', layerId: 20, name: 'Pylône HTB P001 – Dakar',  tier: null, assetGroup: 'Tower', assetType: 'Pylône treillis 225kV', lat: 14.720, lng: -17.250, voltageKV: 0, attributes: { hauteurM: 42, materiau: 'Acier galvanisé', annee: 2008 } },
  { id: 'str-pyl-02', layerId: 20, name: 'Pylône HTB P002 – Thiès',  tier: null, assetGroup: 'Tower', assetType: 'Pylône treillis 225kV', lat: 14.760, lng: -17.080, voltageKV: 0, attributes: { hauteurM: 42, materiau: 'Acier galvanisé', annee: 2008 } },
  { id: 'str-pyl-03', layerId: 20, name: 'Pylône HTB P003 – Route',  tier: null, assetGroup: 'Tower', assetType: 'Pylône treillis 90kV',  lat: 14.770, lng: -16.750, voltageKV: 0, attributes: { hauteurM: 32, materiau: 'Acier galvanisé', annee: 2001 } },
];

// ─── Store ──────────────────────────────────────────────────────────────────

export interface MigrationItemStatus {
  itemId:     string;
  done:       boolean;
  note:       string;
  updatedAt?: string;
}

interface UNNetworkState {
  // Active layers (layerId set)
  activeLayers: Set<number>;

  // Network features (mock data until ArcGIS connected)
  lines:  UNLineFeature[];
  points: UNPointFeature[];

  // Migration checklist
  migrationStatus: Record<string, MigrationItemStatus>;

  // Selected feature for popup
  selectedFeature: (UNLineFeature | UNPointFeature) | null;

  // Actions
  toggleLayer:          (layerId: number) => void;
  setActiveLayers:      (ids: number[]) => void;
  setSelectedFeature:   (f: (UNLineFeature | UNPointFeature) | null) => void;
  setMigrationItem:     (itemId: string, done: boolean, note?: string) => void;
  resetMigration:       () => void;
  migrationProgress:    () => { done: number; total: number; mandatoryDone: number; mandatoryTotal: number };
}

// Serialize/deserialize Set for persist middleware
function serializeSet(s: Set<number>): number[] { return Array.from(s); }
function deserializeSet(a: number[]): Set<number> { return new Set(a); }

export const useUNNetworkStore = create<UNNetworkState>()(
  persist(
    (set, get) => ({
      activeLayers: new Set(UN_LAYERS.filter(l => l.defaultOn).map(l => l.id)),
      lines:  [...MOCK_HTB_LINES, ...MOCK_HTA_LINES, ...MOCK_BT_LINES],
      points: MOCK_POINTS,
      migrationStatus: {},
      selectedFeature: null,

      toggleLayer: (layerId) =>
        set(s => {
          const next = new Set(s.activeLayers);
          next.has(layerId) ? next.delete(layerId) : next.add(layerId);
          return { activeLayers: next };
        }),

      setActiveLayers: (ids) =>
        set({ activeLayers: new Set(ids) }),

      setSelectedFeature: (f) =>
        set({ selectedFeature: f }),

      setMigrationItem: (itemId, done, note = '') =>
        set(s => ({
          migrationStatus: {
            ...s.migrationStatus,
            [itemId]: { itemId, done, note, updatedAt: new Date().toISOString() },
          },
        })),

      resetMigration: () => set({ migrationStatus: {} }),

      migrationProgress: () => {
        const { migrationStatus } = get();
        // Import lazily to avoid circular dep at module level
        const { MIGRATION_CHECKLIST } = require('./unModel') as typeof import('./unModel');
        const total = MIGRATION_CHECKLIST.length;
        const mandatoryTotal = MIGRATION_CHECKLIST.filter((i: { mandatory: boolean }) => i.mandatory).length;
        const done = MIGRATION_CHECKLIST.filter((i: { id: string }) => migrationStatus[i.id]?.done).length;
        const mandatoryDone = MIGRATION_CHECKLIST.filter((i: { id: string; mandatory: boolean }) => i.mandatory && migrationStatus[i.id]?.done).length;
        return { done, total, mandatoryDone, mandatoryTotal };
      },
    }),
    {
      name: 'sigep-un-network',
      partialize: (s) => ({
        activeLayers: serializeSet(s.activeLayers),
        migrationStatus: s.migrationStatus,
      }),
      merge: (persisted: unknown, current) => {
        const p = persisted as { activeLayers?: number[]; migrationStatus?: Record<string, MigrationItemStatus> };
        return {
          ...current,
          activeLayers: p?.activeLayers ? deserializeSet(p.activeLayers) : current.activeLayers,
          migrationStatus: p?.migrationStatus ?? {},
        };
      },
    },
  ),
);

// Helpers
export function isLineFeature(f: UNLineFeature | UNPointFeature): f is UNLineFeature {
  return 'coords' in f;
}

export function featureTierColor(tier: string | null): string {
  if (tier === 'HTB') return '#ef4444';
  if (tier === 'HTA') return '#f97316';
  if (tier === 'BT')  return '#22c55e';
  return '#64748b';
}
