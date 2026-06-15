/**
 * immobilisationStore.ts — Immobilisations & Amortissements SIGEPP-DPE
 * --------------------------------------------------------------------
 * Chaque immobilisation est rattachée à un PROJET (jusqu'au niveau de détail :
 * poste, transformateur, tronçon de ligne, bâtiment, véhicule, matériel…).
 * La direction en charge de la gestion des immobilisations (DGC — Gestion des
 * Immos / DET&GI, en lien avec la Finance) gère les amortissements.
 *
 * Moteur d'amortissement : linéaire (par défaut) et dégressif (coefficients
 * fiscaux usuels), avec plan d'amortissement annuel et Valeur Nette Comptable.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type MethodeAmortissement = 'lineaire' | 'degressif';
export type StatutImmobilisation = 'en_service' | 'en_cours' | 'cede' | 'reforme';

export type CategorieImmo =
  | 'Poste HTA/BT' | 'Poste HTB' | 'Transformateur' | 'Ligne HTA' | 'Ligne HTB' | 'Ligne BT'
  | 'Centrale / Production' | 'Stockage / Batteries' | 'Bâtiment & Génie Civil'
  | 'Matériel & Équipement' | 'Matériel roulant' | 'Matériel informatique' | 'Compteurs / AMI' | 'Autre';

export interface Immobilisation {
  id: string;
  projetId: string;          // rattachement projet (clé)
  code: string;              // n° d'immobilisation
  designation: string;
  categorie: CategorieImmo;
  valeurAcquisition: number; // FCFA (valeur brute)
  valeurResiduelle: number;  // FCFA (valeur à terme)
  dateMiseEnService: string; // 'YYYY-MM-DD'
  datePVReception?: string;   // YYYY-MM-DD — peut differer de la mise en service
  dureeAmortissement: number;// années
  methode: MethodeAmortissement;
  localisation?: string;
  statut: StatutImmobilisation;
  // ── Nomenclatures officielles DPE (cf. lib/referentielsDPE.ts) ──
  classeComptable?: string;  // NATURE — classe comptable SYSCOHADA (511, 512…)
  actifLivrable?: string;    // composant produit (Alternateur, Armoires BT…)
  unite?: string;            // unité de l'actif livrable (ML, MVA, MW…)
  bailleur?: string;         // source de financement
  sourcePV?: string;         // réf. PV origine (PVRP ou MES) — idempotence
  createdAt: string;
  updatedAt: string;
}

export interface LigneAmortissement {
  annee: number;
  baseDebut: number;   // VNC en début d'exercice
  annuite: number;     // dotation de l'exercice
  cumul: number;       // amortissements cumulés
  vnc: number;         // Valeur Nette Comptable en fin d'exercice
}

// ─────────────────────────────────────────────────────────────────────────────
// MOTEUR D'AMORTISSEMENT
// ─────────────────────────────────────────────────────────────────────────────

/** Coefficient dégressif fiscal usuel selon la durée (BCEAO/France) */
export function coefficientDegressif(duree: number): number {
  if (duree <= 4) return 1.5;
  if (duree <= 6) return 2.0;
  return 2.5;
}

/** Génère le plan d'amortissement annuel d'une immobilisation. */
export function planAmortissement(immo: Immobilisation): LigneAmortissement[] {
  const base = Math.max(0, immo.valeurAcquisition - immo.valeurResiduelle);
  const duree = Math.max(1, Math.round(immo.dureeAmortissement));
  const anneeDebut = new Date(immo.dateMiseEnService).getFullYear() || new Date().getFullYear();
  const lignes: LigneAmortissement[] = [];

  if (immo.methode === 'lineaire') {
    const annuite = base / duree;
    let cumul = 0;
    for (let i = 0; i < duree; i++) {
      const baseDebut = immo.valeurAcquisition - cumul;
      const dot = i === duree - 1 ? base - cumul : annuite; // ajustement dernier exercice
      cumul += dot;
      lignes.push({
        annee: anneeDebut + i, baseDebut, annuite: dot, cumul,
        vnc: immo.valeurAcquisition - cumul,
      });
    }
    return lignes;
  }

  // Dégressif : taux = (1/durée) × coefficient, bascule en linéaire quand plus avantageux
  const coef = coefficientDegressif(duree);
  const tauxDeg = (1 / duree) * coef;
  let vnc = immo.valeurAcquisition;
  let cumul = 0;
  for (let i = 0; i < duree; i++) {
    const restant = duree - i;
    const dotDeg = (vnc - immo.valeurResiduelle) * tauxDeg;
    const dotLin = (vnc - immo.valeurResiduelle) / restant;
    let dot = Math.max(dotDeg, dotLin);
    if (i === duree - 1) dot = vnc - immo.valeurResiduelle; // solde
    const baseDebut = vnc;
    cumul += dot;
    vnc -= dot;
    lignes.push({ annee: anneeDebut + i, baseDebut, annuite: dot, cumul, vnc });
  }
  return lignes;
}

/** Amortissement cumulé à une date donnée (par défaut : aujourd'hui). */
export function amortissementCumule(immo: Immobilisation, at: Date = new Date()): number {
  if (immo.statut === 'en_cours') return 0;
  const plan = planAmortissement(immo);
  const anneeRef = at.getFullYear();
  let cumul = 0;
  for (const l of plan) {
    if (l.annee <= anneeRef) cumul = l.cumul;
  }
  return cumul;
}

/** Valeur Nette Comptable à une date donnée. */
export function valeurNetteComptable(immo: Immobilisation, at: Date = new Date()): number {
  return immo.valeurAcquisition - amortissementCumule(immo, at);
}

// ─────────────────────────────────────────────────────────────────────────────
// RÉFÉRENTIELS — durées & valeurs par défaut par catégorie
// ─────────────────────────────────────────────────────────────────────────────

export const DUREE_PAR_CATEGORIE: Partial<Record<CategorieImmo, number>> = {
  'Ligne HTA': 30, 'Ligne HTB': 35, 'Ligne BT': 20,
  'Poste HTA/BT': 25, 'Poste HTB': 30, 'Transformateur': 15,
  'Centrale / Production': 25, 'Stockage / Batteries': 10,
  'Bâtiment & Génie Civil': 40, 'Matériel & Équipement': 10,
  'Matériel roulant': 5, 'Matériel informatique': 3,
  'Compteurs / AMI': 10, 'Autre': 10,
};

export const VALEUR_PAR_CATEGORIE: Partial<Record<CategorieImmo, number>> = {
  'Ligne HTA': 850, 'Ligne HTB': 2500, 'Ligne BT': 420,
  'Poste HTA/BT': 165, 'Poste HTB': 800, 'Transformateur': 42,
  'Centrale / Production': 1500, 'Stockage / Batteries': 600,
  'Bâtiment & Génie Civil': 600, 'Matériel & Équipement': 60,
  'Matériel roulant': 25, 'Matériel informatique': 5,
  'Compteurs / AMI': 95, 'Autre': 50,
};

// ─────────────────────────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────────────────────────

export interface TriggerPVArgs {
  projetId: string;
  pvRef: string;
  projetNom: string;
  date: string;          // YYYY-MM-DD
  categorie?: CategorieImmo;
  valeur?: number;       // M FCFA — optionnel, estimé si absent
  duree?: number;        // années d'amortissement
}

interface ImmoState {
  immobilisations: Immobilisation[];
  add: (i: Omit<Immobilisation, 'id' | 'createdAt' | 'updatedAt'>) => string;
  update: (id: string, patch: Partial<Immobilisation>) => void;
  remove: (id: string) => void;
  byProjet: (projetId: string) => Immobilisation[];
  seedFor: (projetId: string) => void;
  /** PVRP validé → crée un encours d'immobilisation (statut en_cours). Idempotent sur pvRef. */
  onPVRP: (args: TriggerPVArgs) => { id: string; created: boolean };
  /** Mise en service validée → passe l'immo en_service, démarre l'amortissement. */
  onMES:  (args: TriggerPVArgs) => { id: string; annuite: number; duree: number };
}

function uid() { return `immo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`; }

export const useImmobilisationStore = create<ImmoState>()(
  persist(
    (set, get) => ({
      immobilisations: [],
      add: (i) => {
        const now = new Date().toISOString();
        const id = uid();
        set(s => ({ immobilisations: [...s.immobilisations, { ...i, id, createdAt: now, updatedAt: now }] }));
        return id;
      },
      update: (id, patch) => set(s => ({
        immobilisations: s.immobilisations.map(x => x.id === id ? { ...x, ...patch, updatedAt: new Date().toISOString() } : x),
      })),
      remove: (id) => set(s => ({ immobilisations: s.immobilisations.filter(x => x.id !== id) })),
      byProjet: (projetId) => get().immobilisations.filter(x => x.projetId === projetId),

      onPVRP: ({ projetId, pvRef, projetNom, date, categorie = 'Autre', valeur, duree }) => {
        const existing = get().immobilisations.find(x => x.sourcePV === pvRef);
        if (existing) return { id: existing.id, created: false };
        const now = new Date().toISOString();
        const id = uid();
        const nextCode = `IMM-${new Date(date).getFullYear()}-${String(get().immobilisations.length + 1).padStart(3, '0')}`;
        const defaultDuree = DUREE_PAR_CATEGORIE[categorie] ?? 15;
        const defaultValeur = VALEUR_PAR_CATEGORIE[categorie] ?? 100;
        const immo: Immobilisation = {
          id, projetId, code: nextCode,
          designation: `${categorie} — ${projetNom}`,
          categorie,
          valeurAcquisition: valeur ?? defaultValeur,
          valeurResiduelle: 0,
          dateMiseEnService: date,
          datePVReception: date,
          dureeAmortissement: duree ?? defaultDuree,
          methode: 'lineaire',
          statut: 'en_cours',
          sourcePV: pvRef,
          createdAt: now, updatedAt: now,
        };
        set(s => ({ immobilisations: [...s.immobilisations, immo] }));
        return { id, created: true };
      },

      onMES: ({ projetId, pvRef, projetNom, date, categorie = 'Autre', valeur, duree }) => {
        // Cherche l'encours lié à ce projet ou à ce PV
        const existing = get().immobilisations.find(
          x => x.sourcePV === pvRef || (x.projetId === projetId && x.statut === 'en_cours')
        );
        const defaultDuree = duree ?? DUREE_PAR_CATEGORIE[categorie] ?? 15;
        const defaultValeur = valeur ?? VALEUR_PAR_CATEGORIE[categorie] ?? 100;
        if (existing) {
          const patch: Partial<Immobilisation> = {
            statut: 'en_service',
            dateMiseEnService: date,
            dureeAmortissement: duree ?? existing.dureeAmortissement,
            updatedAt: new Date().toISOString(),
          };
          set(s => ({ immobilisations: s.immobilisations.map(x => x.id === existing.id ? { ...x, ...patch } : x) }));
          const annuite = (existing.valeurAcquisition - existing.valeurResiduelle) / (duree ?? existing.dureeAmortissement);
          return { id: existing.id, annuite, duree: duree ?? existing.dureeAmortissement };
        }
        // Pas d'encours → crée directement en_service
        const now = new Date().toISOString();
        const id = uid();
        const nextCode = `IMM-${new Date(date).getFullYear()}-${String(get().immobilisations.length + 1).padStart(3, '0')}`;
        const immo: Immobilisation = {
          id, projetId, code: nextCode,
          designation: `${categorie} — ${projetNom}`,
          categorie,
          valeurAcquisition: defaultValeur,
          valeurResiduelle: 0,
          dateMiseEnService: date,
          datePVReception: date,
          dureeAmortissement: defaultDuree,
          methode: 'lineaire',
          statut: 'en_service',
          sourcePV: pvRef,
          createdAt: now, updatedAt: now,
        };
        set(s => ({ immobilisations: [...s.immobilisations, immo] }));
        return { id, annuite: defaultValeur / defaultDuree, duree: defaultDuree };
      },

      seedFor: (projetId) => {
        if (get().immobilisations.some(x => x.projetId === projetId)) return;
        const now = new Date().toISOString();
        const mk = (o: Omit<Immobilisation, 'id' | 'createdAt' | 'updatedAt' | 'projetId'>): Immobilisation =>
          ({ ...o, projetId, id: uid(), createdAt: now, updatedAt: now });
        set(s => ({
          immobilisations: [...s.immobilisations,
            mk({ code: 'IMM-PS-001', designation: 'Poste HTA/BT 30/0,4 kV', categorie: 'Poste HTA/BT', valeurAcquisition: 185, valeurResiduelle: 0, dateMiseEnService: '2024-06-01', datePVReception: '2025-11-15', dureeAmortissement: 20, methode: 'lineaire', statut: 'en_service', localisation: 'Kaolack' }),
            mk({ code: 'IMM-TR-002', designation: 'Transformateur 160 kVA', categorie: 'Transformateur', valeurAcquisition: 42, valeurResiduelle: 2, dateMiseEnService: '2024-06-01', datePVReception: '2025-11-15', dureeAmortissement: 15, methode: 'lineaire', statut: 'en_service', localisation: 'Kaolack' }),
            mk({ code: 'IMM-LG-003', designation: 'Ligne HTA — tronçon 12 km', categorie: 'Ligne HTA', valeurAcquisition: 96, valeurResiduelle: 0, dateMiseEnService: '2024-09-01', datePVReception: '2025-11-15', dureeAmortissement: 25, methode: 'lineaire', statut: 'en_service', localisation: 'Wack Ngouna' }),
          ],
        }));
      },
    }),
    { name: 'sigepp-immobilisations' }
  )
);

export const CATEGORIES_IMMO: CategorieImmo[] = [
  'Poste HTA/BT', 'Poste HTB', 'Transformateur', 'Ligne HTA', 'Ligne HTB', 'Ligne BT',
  'Centrale / Production', 'Stockage / Batteries', 'Bâtiment & Génie Civil',
  'Matériel & Équipement', 'Matériel roulant', 'Matériel informatique', 'Compteurs / AMI', 'Autre',
];

export const STATUT_IMMO_LABEL: Record<StatutImmobilisation, { fr: string; en: string; color: string }> = {
  en_service: { fr: 'En service', en: 'In service', color: '#16A34A' },
  en_cours:   { fr: 'En cours (encours d\'immo)', en: 'Work in progress', color: '#D97706' },
  cede:       { fr: 'Cédé', en: 'Disposed', color: '#6B7280' },
  reforme:    { fr: 'Réformé', en: 'Retired', color: '#DC2626' },
};
