/**
 * pointageStore.ts — Bulletins d'heures supplémentaires (pointage) → UAGL
 * -----------------------------------------------------------------------------
 * Le personnel projet (assistants, contrôleurs, ingénieurs…) saisit ses heures
 * supplémentaires par jour avec coefficient de majoration, panier, sujétion,
 * prime de conduite et déplacements, puis adresse le bulletin à l'UAGL pour
 * validation (Chef de Projet → Chef de Département → UAGL/Service des salaires).
 * Reproduit le « BULLETIN D'HEURES SUPPLÉMENTAIRES » officiel SENELEC.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Coefficients de majoration officiels (heures normales, +15%, +40%, +60%, ×2). */
export const COEFFICIENTS = [1, 1.15, 1.4, 1.6, 2] as const;
export type Coefficient = typeof COEFFICIENTS[number];

export type PointageStatut = 'brouillon' | 'soumis_cp' | 'soumis_uagl' | 'valide_cp' | 'valide_dept' | 'valide_uagl' | 'rejete';

export interface LignePointage {
  id: string;
  date: string;        // YYYY-MM-DD
  heureDe: string;     // HH:MM
  heureA: string;      // HH:MM
  projet: string;      // ODM / projet (imputation)
  activite: string;
  nbHeures: number;
  coefficient: Coefficient;
  panier: boolean;
  sujetion: boolean;
  primeConduite: boolean;
  deplacement: 0 | 1 | 2 | 3; // D1/D2/D3 (0 = aucun)
}

export interface Bulletin {
  id: string;
  mle: string;
  prenom: string;
  nom: string;
  direction: string;
  departement: string;
  mois: string;        // 'MARS'
  annee: number;
  lignes: LignePointage[];
  statut: PointageStatut;
  auteurEmail: string;
  dateSoumission?: string;
  motifRejet?: string;
  historique: { etape: string; par: string; date: string }[];
}

interface PointageState {
  bulletins: Bulletin[];
  createBulletin: (b: Omit<Bulletin, 'id' | 'lignes' | 'statut' | 'historique'>) => string;
  updateBulletin: (id: string, patch: Partial<Bulletin>) => void;
  removeBulletin: (id: string) => void;
  addLigne: (bulletinId: string, ligne: Omit<LignePointage, 'id'>) => void;
  updateLigne: (bulletinId: string, ligneId: string, patch: Partial<LignePointage>) => void;
  removeLigne: (bulletinId: string, ligneId: string) => void;
  soumettre: (id: string, par: string) => void;
  valider: (id: string, etape: PointageStatut, par: string) => void;
  rejeter: (id: string, par: string, motif: string) => void;
}

/** Total des heures pondérées d'un bulletin (Σ nbHeures × coefficient). */
export function totalHeuresPonderees(b: Bulletin): number {
  return Math.round(b.lignes.reduce((s, l) => s + l.nbHeures * l.coefficient, 0) * 100) / 100;
}
/** Total des heures brutes. */
export function totalHeures(b: Bulletin): number {
  return Math.round(b.lignes.reduce((s, l) => s + l.nbHeures, 0) * 100) / 100;
}
/** Sous-totaux par coefficient (pour la ligne TOTAL du bulletin officiel). */
export function totauxParCoefficient(b: Bulletin): Record<string, number> {
  const out: Record<string, number> = {};
  COEFFICIENTS.forEach(c => { out[String(c)] = 0; });
  b.lignes.forEach(l => { out[String(l.coefficient)] += l.nbHeures; });
  return out;
}

const uid = (p: string) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;

export const usePointage = create<PointageState>()(
  persist(
    (set) => ({
      bulletins: [],
      createBulletin: (b) => {
        const id = uid('bull');
        set(s => ({ bulletins: [{ ...b, id, lignes: [], statut: 'brouillon', historique: [] }, ...s.bulletins] }));
        return id;
      },
      updateBulletin: (id, patch) => set(s => ({ bulletins: s.bulletins.map(b => b.id === id ? { ...b, ...patch } : b) })),
      removeBulletin: (id) => set(s => ({ bulletins: s.bulletins.filter(b => b.id !== id) })),
      addLigne: (bid, ligne) => set(s => ({ bulletins: s.bulletins.map(b => b.id === bid ? { ...b, lignes: [...b.lignes, { ...ligne, id: uid('lg') }] } : b) })),
      updateLigne: (bid, lid, patch) => set(s => ({ bulletins: s.bulletins.map(b => b.id === bid ? { ...b, lignes: b.lignes.map(l => l.id === lid ? { ...l, ...patch } : l) } : b) })),
      removeLigne: (bid, lid) => set(s => ({ bulletins: s.bulletins.map(b => b.id === bid ? { ...b, lignes: b.lignes.filter(l => l.id !== lid) } : b) })),
      soumettre: (id, par) => set(s => ({ bulletins: s.bulletins.map(b => b.id === id ? { ...b, statut: 'soumis_cp', dateSoumission: new Date().toISOString(), historique: [...b.historique, { etape: 'Soumis au Chef de Projet', par, date: new Date().toISOString() }] } : b) })),
      valider: (id, etape, par) => set(s => ({ bulletins: s.bulletins.map(b => b.id === id ? { ...b, statut: etape, historique: [...b.historique, { etape: `Validé (${etape})`, par, date: new Date().toISOString() }] } : b) })),
      rejeter: (id, par, motif) => set(s => ({ bulletins: s.bulletins.map(b => b.id === id ? { ...b, statut: 'rejete', motifRejet: motif, historique: [...b.historique, { etape: 'Rejeté', par, date: new Date().toISOString() }] } : b) })),
    }),
    { name: 'sigepp-pointage' },
  ),
);
