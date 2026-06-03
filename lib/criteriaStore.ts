/**
 * criteriaStore.ts — Référentiel de gouvernance des critères pondérés.
 *
 * Centralise deux grilles paramétrables, modifiables uniquement par DPE / PMO / Admin :
 *  • prioritization — critères d'arbitrage / priorisation des projets (portefeuille).
 *  • supplier       — critères de notation / scoring des fournisseurs.
 *
 * Persisté dans localStorage (clé `sigepp-criteria-config`) pour survivre aux
 * recompilations et être partagé par tous les modules (ProjetsDPE, Marchés, …).
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Critere {
  id: string;
  label: string;
  poids: number;   // poids relatif (%) — la somme idéale = 100
}

export type CritereGroup = 'prioritization' | 'supplier';

/* Grille de priorisation projets — réf. PMI (Standard for Portfolio Management). */
export const DEFAULT_PRIORITIZATION: Critere[] = [
  { id: 'p1', label: 'Alignement stratégique (PSE / lettre de mission)', poids: 25 },
  { id: 'p2', label: 'Impact socio-économique (ménages, accès, emplois)', poids: 20 },
  { id: 'p3', label: 'Rentabilité économique (VAN / TRI)', poids: 15 },
  { id: 'p4', label: 'Financement sécurisé (engagement bailleur)', poids: 15 },
  { id: 'p5', label: 'Urgence / criticité réseau', poids: 15 },
  { id: 'p6', label: 'Maturité & faisabilité technique', poids: 10 },
];

/* Grille de scoring fournisseurs — évaluation des marchés/prestataires. */
export const DEFAULT_SUPPLIER: Critere[] = [
  { id: 's1', label: 'Qualité technique des prestations', poids: 30 },
  { id: 's2', label: 'Respect des délais de livraison', poids: 25 },
  { id: 's3', label: 'Compétitivité financière', poids: 15 },
  { id: 's4', label: 'Conformité administrative & HSE', poids: 15 },
  { id: 's5', label: 'Absence de contentieux / litiges', poids: 15 },
];

export interface CriteriaState {
  prioritization: Critere[];
  supplier: Critere[];
  addCritere: (group: CritereGroup, label: string) => void;
  updateCritere: (group: CritereGroup, id: string, patch: Partial<Critere>) => void;
  removeCritere: (group: CritereGroup, id: string) => void;
  resetGroup: (group: CritereGroup) => void;
}

const DEFAULTS: Record<CritereGroup, Critere[]> = {
  prioritization: DEFAULT_PRIORITIZATION,
  supplier: DEFAULT_SUPPLIER,
};

export const useCriteriaStore = create<CriteriaState>()(
  persist(
    (set) => ({
      prioritization: DEFAULT_PRIORITIZATION.map(c => ({ ...c })),
      supplier: DEFAULT_SUPPLIER.map(c => ({ ...c })),
      addCritere: (group, label) => set(state => ({
        [group]: [...state[group], { id: `${group[0]}${Date.now()}`, label: label.trim(), poids: 10 }],
      } as Pick<CriteriaState, CritereGroup>)),
      updateCritere: (group, id, patch) => set(state => ({
        [group]: state[group].map(c => c.id === id ? { ...c, ...patch } : c),
      } as Pick<CriteriaState, CritereGroup>)),
      removeCritere: (group, id) => set(state => ({
        [group]: state[group].filter(c => c.id !== id),
      } as Pick<CriteriaState, CritereGroup>)),
      resetGroup: (group) => set({
        [group]: DEFAULTS[group].map(c => ({ ...c })),
      } as Pick<CriteriaState, CritereGroup>),
    }),
    {
      name: 'sigepp-criteria-config',
      partialize: (state) => ({ prioritization: state.prioritization, supplier: state.supplier }),
    }
  )
);
