/**
 * zonesQuantitesStore.ts — Modèle Zones & Quantités par projet (SIGEPP-DPE).
 *
 * Sépare clairement :
 *   • les ZONES (lignes géographiques : localité, commune, lot, coordonnées SIG),
 *   • les ITEMS de quantité (colonnes paramétrables selon le type de projet :
 *     ménages, HTA, BT, postes, supports, etc.) avec unité et prix unitaire,
 *   • la matrice des QUANTITÉS (zone × item → prévu / réalisé / validé terrain).
 *
 * Sert de source unique pour :
 *   • le tableau Zones (lignes) — #25
 *   • la matrice Quantités (zones en lignes, items en colonnes) — #25
 *   • le BOQ pour décomptes/IPC (interim payment) cohérent avec le validé — #26
 *   • la carte SIG auto-mise à jour à partir des coordonnées chargées — #27
 *   • le filtre par lot détecté dans le contenu — #28
 *
 * Persistance localStorage (clé `sigepp-zones-quantites`), indexée par CODE projet.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type StatutZone = 'non_demarre' | 'en_cours' | 'termine' | 'suspendu';

export interface ZoneRow {
  id: string;
  code: string;
  localite: string;
  region?: string;        // REGION (liste BEST)
  departement: string;    // DEPARTEMENT
  cav?: string;           // CAV — arrondissement
  cacrv?: string;         // CACRV — commune / communauté rurale
  commune: string;        // commune (= CACRV pour BEST)
  lot: string;            // Allotissement
  lat?: number;
  lng?: number;
  statut: StatutZone;
  observation: string;
}

export interface QtyItem {
  key: string;          // identifiant stable de la colonne quantité
  label: string;        // ex. "Ménages", "Réseau HTA"
  unite: string;        // "U", "km", "ml", "poste"…
  prixUnitaire: number; // FCFA / unité (sert au BOQ & IPC)
}

export interface QtyCell {
  prevu: number;
  realise: number;
  valide: number;       // quantité validée terrain (base décompte/IPC)
}

export interface ProjetZonesData {
  zones: ZoneRow[];
  items: QtyItem[];
  /** quantites[zoneId][itemKey] */
  quantites: Record<string, Record<string, QtyCell>>;
  updatedAt: string;
}

/* ─── Données d'exemple (projet d'électrification — convertibles/supprimables) ─ */

const SEED_ITEMS: QtyItem[] = [
  { key: 'menages', label: 'Ménages raccordés', unite: 'U',  prixUnitaire: 185000 },
  { key: 'hta',     label: 'Réseau HTA',        unite: 'km', prixUnitaire: 14500000 },
  { key: 'bt',      label: 'Réseau BT',         unite: 'km', prixUnitaire: 9800000 },
  { key: 'postes',  label: 'Postes H61',        unite: 'U',  prixUnitaire: 6200000 },
];

interface SeedZone extends Omit<ZoneRow, 'id'> {
  q: Record<string, [number, number, number]>; // itemKey -> [prevu, realise, valide]
}

const SEED_ZONES: SeedZone[] = [
  { code: 'Z01', localite: 'Medina Diack',    commune: 'Diack',       departement: 'Thiès',       lot: 'Lot 1', lat: 14.8203, lng: -16.0102, statut: 'termine',     observation: 'Réception provisoire signée',
    q: { menages: [420, 420, 420], hta: [12.4, 12.4, 12.4], bt: [18.6, 18.6, 18.6], postes: [4, 4, 4] } },
  { code: 'Z02', localite: 'Nguékokh',        commune: 'Nguékokh',    departement: 'Mbour',       lot: 'Lot 1', lat: 14.5118, lng: -17.0078, statut: 'en_cours',    observation: 'Zone Nord, achèvement en cours',
    q: { menages: [680, 532, 510], hta: [22.1, 16.8, 16.8], bt: [31.4, 24.2, 24.0], postes: [7, 5, 5] } },
  { code: 'Z03', localite: 'Keur Moussa',     commune: 'Keur Moussa', departement: 'Thiès',       lot: 'Lot 2', lat: 14.7836, lng: -17.0664, statut: 'termine',     observation: 'MES réalisée le 15/03/2026',
    q: { menages: [310, 310, 310], hta: [8.9, 8.9, 8.9], bt: [14.2, 14.2, 14.2], postes: [3, 3, 3] } },
  { code: 'Z04', localite: 'Diama Tiakha',    commune: 'Sandiara',    departement: 'Mbour',       lot: 'Lot 2', lat: 14.4039, lng: -16.7589, statut: 'en_cours',    observation: 'Travaux GC achevés, câble en cours',
    q: { menages: [290, 138, 120], hta: [9.6, 4.5, 4.5], bt: [13.8, 6.2, 6.0], postes: [3, 1, 1] } },
  { code: 'Z05', localite: 'Santhiou Diaobé', commune: 'Koumpentoum', departement: 'Tambacounda', lot: 'Lot 3', lat: 13.9876, lng: -14.5512, statut: 'non_demarre', observation: 'En attente mobilisation Lot 3',
    q: { menages: [520, 0, 0], hta: [17.3, 0, 0], bt: [25.6, 0, 0], postes: [5, 0, 0] } },
  { code: 'Z06', localite: 'Missirah',        commune: 'Missirah',    departement: 'Tambacounda', lot: 'Lot 3', lat: 13.6789, lng: -13.4901, statut: 'non_demarre', observation: 'Zones à confirmer avec DER',
    q: { menages: [380, 0, 0], hta: [13.1, 0, 0], bt: [19.4, 0, 0], postes: [4, 0, 0] } },
];

/** Données d'amorçage pour un projet (exemple réaliste, supprimable par l'utilisateur). */
export function seedProjetData(): ProjetZonesData {
  const zones: ZoneRow[] = [];
  const quantites: Record<string, Record<string, QtyCell>> = {};
  SEED_ZONES.forEach((z, i) => {
    const id = `z${i + 1}`;
    const { q, ...rest } = z;
    zones.push({ id, ...rest });
    quantites[id] = {};
    Object.entries(q).forEach(([k, [prevu, realise, valide]]) => {
      quantites[id][k] = { prevu, realise, valide };
    });
  });
  return { zones, items: SEED_ITEMS.map(i => ({ ...i })), quantites, updatedAt: new Date().toISOString() };
}

function emptyProjetData(): ProjetZonesData {
  return { zones: [], items: SEED_ITEMS.map(i => ({ ...i })), quantites: {}, updatedAt: new Date().toISOString() };
}

/* ─── Store ────────────────────────────────────────────────────────────────── */

interface ZonesState {
  byProjet: Record<string, ProjetZonesData>;
  get: (code: string) => ProjetZonesData;
  ensure: (code: string, seed?: boolean) => void;
  setZones: (code: string, zones: ZoneRow[]) => void;
  upsertZone: (code: string, zone: ZoneRow) => void;
  removeZone: (code: string, zoneId: string) => void;
  setItems: (code: string, items: QtyItem[]) => void;
  addItem: (code: string, item: QtyItem) => void;
  updateItem: (code: string, key: string, patch: Partial<QtyItem>) => void;
  removeItem: (code: string, key: string) => void;
  setQty: (code: string, zoneId: string, itemKey: string, patch: Partial<QtyCell>) => void;
  /** Remplace tout le jeu de données d'un projet (import Excel). */
  replaceProjet: (code: string, data: { zones: ZoneRow[]; items: QtyItem[]; quantites: Record<string, Record<string, QtyCell>> }) => void;
  resetProjet: (code: string, seed?: boolean) => void;
}

function touch(data: ProjetZonesData): ProjetZonesData {
  return { ...data, updatedAt: new Date().toISOString() };
}

export const useZonesStore = create<ZonesState>()(
  persist(
    (set, getState) => ({
      byProjet: {},

      get: (code) => getState().byProjet[code] ?? emptyProjetData(),

      ensure: (code, seed = false) => set(s => {
        if (s.byProjet[code]) return s;
        return { byProjet: { ...s.byProjet, [code]: seed ? seedProjetData() : emptyProjetData() } };
      }),

      setZones: (code, zones) => set(s => {
        const cur = s.byProjet[code] ?? emptyProjetData();
        return { byProjet: { ...s.byProjet, [code]: touch({ ...cur, zones }) } };
      }),

      upsertZone: (code, zone) => set(s => {
        const cur = s.byProjet[code] ?? emptyProjetData();
        const exists = cur.zones.some(z => z.id === zone.id);
        const zones = exists ? cur.zones.map(z => z.id === zone.id ? zone : z) : [...cur.zones, zone];
        const quantites = { ...cur.quantites };
        if (!quantites[zone.id]) quantites[zone.id] = {};
        return { byProjet: { ...s.byProjet, [code]: touch({ ...cur, zones, quantites }) } };
      }),

      removeZone: (code, zoneId) => set(s => {
        const cur = s.byProjet[code] ?? emptyProjetData();
        const quantites = { ...cur.quantites }; delete quantites[zoneId];
        return { byProjet: { ...s.byProjet, [code]: touch({ ...cur, zones: cur.zones.filter(z => z.id !== zoneId), quantites }) } };
      }),

      setItems: (code, items) => set(s => {
        const cur = s.byProjet[code] ?? emptyProjetData();
        return { byProjet: { ...s.byProjet, [code]: touch({ ...cur, items }) } };
      }),

      addItem: (code, item) => set(s => {
        const cur = s.byProjet[code] ?? emptyProjetData();
        if (cur.items.some(i => i.key === item.key)) return s;
        return { byProjet: { ...s.byProjet, [code]: touch({ ...cur, items: [...cur.items, item] }) } };
      }),

      updateItem: (code, key, patch) => set(s => {
        const cur = s.byProjet[code] ?? emptyProjetData();
        return { byProjet: { ...s.byProjet, [code]: touch({ ...cur, items: cur.items.map(i => i.key === key ? { ...i, ...patch } : i) }) } };
      }),

      removeItem: (code, key) => set(s => {
        const cur = s.byProjet[code] ?? emptyProjetData();
        const quantites: Record<string, Record<string, QtyCell>> = {};
        Object.entries(cur.quantites).forEach(([zid, row]) => {
          const r = { ...row }; delete r[key]; quantites[zid] = r;
        });
        return { byProjet: { ...s.byProjet, [code]: touch({ ...cur, items: cur.items.filter(i => i.key !== key), quantites }) } };
      }),

      setQty: (code, zoneId, itemKey, patch) => set(s => {
        const cur = s.byProjet[code] ?? emptyProjetData();
        const quantites = { ...cur.quantites };
        const row = { ...(quantites[zoneId] ?? {}) };
        const prev = row[itemKey] ?? { prevu: 0, realise: 0, valide: 0 };
        row[itemKey] = { ...prev, ...patch };
        quantites[zoneId] = row;
        return { byProjet: { ...s.byProjet, [code]: touch({ ...cur, quantites }) } };
      }),

      replaceProjet: (code, data) => set(s => ({
        byProjet: { ...s.byProjet, [code]: touch({ ...data, updatedAt: new Date().toISOString() }) },
      })),

      resetProjet: (code, seed = true) => set(s => ({
        byProjet: { ...s.byProjet, [code]: seed ? seedProjetData() : emptyProjetData() },
      })),
    }),
    { name: 'sigepp-zones-quantites' },
  ),
);

/* ─── Sélecteurs / helpers dérivés ──────────────────────────────────────────── */

/** Liste des lots détectés dans le contenu des zones (#28). */
export function lotsFromZones(zones: ZoneRow[]): string[] {
  const set = new Set<string>();
  zones.forEach(z => { if (z.lot && z.lot.trim()) set.add(z.lot.trim()); });
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }));
}

export interface BoqRow {
  key: string;
  label: string;
  unite: string;
  prixUnitaire: number;
  prevu: number;
  realise: number;
  valide: number;
  montantPrevu: number;
  montantValide: number;
  pctValide: number;
}

/** Agrège la matrice quantités en lignes BOQ (base décompte / IPC) — #26. */
export function buildBOQ(data: ProjetZonesData, zoneFilter?: (z: ZoneRow) => boolean): BoqRow[] {
  const zones = zoneFilter ? data.zones.filter(zoneFilter) : data.zones;
  return data.items.map(it => {
    let prevu = 0, realise = 0, valide = 0;
    zones.forEach(z => {
      const c = data.quantites[z.id]?.[it.key];
      if (c) { prevu += c.prevu; realise += c.realise; valide += c.valide; }
    });
    const montantPrevu = prevu * it.prixUnitaire;
    const montantValide = valide * it.prixUnitaire;
    return {
      key: it.key, label: it.label, unite: it.unite, prixUnitaire: it.prixUnitaire,
      prevu, realise, valide, montantPrevu, montantValide,
      pctValide: prevu > 0 ? Math.round((valide / prevu) * 100) : 0,
    };
  });
}

/** Normalise une chaîne d'en-tête (pour l'auto-mapping import Excel). */
export function normHeader(h: string): string {
  return String(h ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');
}
