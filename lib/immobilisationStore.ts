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
  dureeAmortissement: number;// années
  methode: MethodeAmortissement;
  localisation?: string;
  statut: StatutImmobilisation;
  // ── Nomenclatures officielles DPE (cf. lib/referentielsDPE.ts) ──
  classeComptable?: string;  // NATURE — classe comptable SYSCOHADA (511, 512…)
  actifLivrable?: string;    // composant produit (Alternateur, Armoires BT…)
  unite?: string;            // unité de l'actif livrable (ML, MVA, MW…)
  bailleur?: string;         // source de financement
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
// STORE
// ─────────────────────────────────────────────────────────────────────────────

interface ImmoState {
  immobilisations: Immobilisation[];
  add: (i: Omit<Immobilisation, 'id' | 'createdAt' | 'updatedAt'>) => string;
  update: (id: string, patch: Partial<Immobilisation>) => void;
  remove: (id: string) => void;
  byProjet: (projetId: string) => Immobilisation[];
  seedFor: (projetId: string) => void;
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
      seedFor: (projetId) => {
        if (get().immobilisations.some(x => x.projetId === projetId)) return;
        const now = new Date().toISOString();
        const mk = (o: Omit<Immobilisation, 'id' | 'createdAt' | 'updatedAt' | 'projetId'>): Immobilisation =>
          ({ ...o, projetId, id: uid(), createdAt: now, updatedAt: now });
        set(s => ({
          immobilisations: [...s.immobilisations,
            mk({ code: 'IMM-PS-001', designation: 'Poste HTA/BT 30/0,4 kV', categorie: 'Poste HTA/BT', valeurAcquisition: 185, valeurResiduelle: 0, dateMiseEnService: '2024-06-01', dureeAmortissement: 20, methode: 'lineaire', statut: 'en_service', localisation: 'Kaolack' }),
            mk({ code: 'IMM-TR-002', designation: 'Transformateur 160 kVA', categorie: 'Transformateur', valeurAcquisition: 42, valeurResiduelle: 2, dateMiseEnService: '2024-06-01', dureeAmortissement: 15, methode: 'lineaire', statut: 'en_service', localisation: 'Kaolack' }),
            mk({ code: 'IMM-LG-003', designation: 'Ligne HTA — tronçon 12 km', categorie: 'Ligne HTA', valeurAcquisition: 96, valeurResiduelle: 0, dateMiseEnService: '2024-09-01', dureeAmortissement: 25, methode: 'lineaire', statut: 'en_service', localisation: 'Wack Ngouna' }),
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
