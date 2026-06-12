'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from 'nanoid';

export type NatureDepense = 'Études' | 'Travaux' | 'Équipements' | 'Services' | 'Maîtrise d\'œuvre' | 'Divers';

export const NATURES: NatureDepense[] = ['Études', 'Travaux', 'Équipements', 'Services', 'Maîtrise d\'œuvre', 'Divers'];

export interface LigneImputation {
  id: string;
  projetCode: string;
  projetNom: string;
  nature: NatureDepense;
  description: string;
  prevuMFCFA: number;
  engageMFCFA: number;
  decaisseMFCFA: number;
  exercice: string;
  observations: string;
}

interface BudgetImputationStore {
  lignes: LigneImputation[];
  addLigne: (l?: Partial<LigneImputation>) => string;
  updateLigne: (id: string, patch: Partial<LigneImputation>) => void;
  deleteLigne: (id: string) => void;
  reorderLigne: (fromIdx: number, toIdx: number) => void;
}

const DEFAULT_LIGNES: LigneImputation[] = [
  { id: nanoid(), projetCode: 'PRD-01', projetNom: 'Centrale CC Tobène', nature: 'Études',       description: 'Études de faisabilité technique', prevuMFCFA: 2.8,  engageMFCFA: 2.8,  decaisseMFCFA: 2.8,  exercice: '2026', observations: '' },
  { id: nanoid(), projetCode: 'PRD-01', projetNom: 'Centrale CC Tobène', nature: 'Travaux',       description: 'Génie civil & installation turbines', prevuMFCFA: 28.4, engageMFCFA: 22.0, decaisseMFCFA: 12.0, exercice: '2026', observations: '' },
  { id: nanoid(), projetCode: 'PRD-01', projetNom: 'Centrale CC Tobène', nature: 'Équipements',   description: 'Turbines & alternateurs', prevuMFCFA: 38.6, engageMFCFA: 30.0, decaisseMFCFA: 15.0, exercice: '2026', observations: 'Commande passée T3 2025' },
  { id: nanoid(), projetCode: 'TRP-01', projetNom: 'Ligne 225kV Tobène–Hann', nature: 'Travaux',  description: 'Pose de câbles HTB', prevuMFCFA: 36.2, engageMFCFA: 28.6, decaisseMFCFA: 16.4, exercice: '2026', observations: '' },
  { id: nanoid(), projetCode: 'TRP-01', projetNom: 'Ligne 225kV Tobène–Hann', nature: 'Études',   description: 'Bureau d\'études tracé', prevuMFCFA: 3.4,  engageMFCFA: 3.4,  decaisseMFCFA: 3.4,  exercice: '2026', observations: '' },
  { id: nanoid(), projetCode: 'DST-01', projetNom: 'Réseau BT Dakar Banlieue', nature: 'Travaux', description: 'Extension réseau BT', prevuMFCFA: 18.6, engageMFCFA: 13.1, decaisseMFCFA: 10.2, exercice: '2026', observations: '' },
  { id: nanoid(), projetCode: 'DST-02', projetNom: 'AMI Compteurs Intelligents', nature: 'Équipements', description: 'Compteurs AMI Linky', prevuMFCFA: 8.2,  engageMFCFA: 7.4,  decaisseMFCFA: 4.8,  exercice: '2026', observations: 'Fournisseur: Itron' },
  { id: nanoid(), projetCode: 'COM-01', projetNom: 'CRM Commercial Platform', nature: 'Services', description: 'Licence & intégration CRM', prevuMFCFA: 7.8,  engageMFCFA: 7.8,  decaisseMFCFA: 6.2,  exercice: '2026', observations: 'Terminé' },
];

export const useBudgetImputationStore = create<BudgetImputationStore>()(
  persist(
    (set) => ({
      lignes: DEFAULT_LIGNES,

      addLigne: (l = {}) => {
        const id = nanoid();
        const ligne: LigneImputation = {
          id,
          projetCode: l.projetCode ?? '',
          projetNom: l.projetNom ?? '',
          nature: l.nature ?? 'Travaux',
          description: l.description ?? '',
          prevuMFCFA: l.prevuMFCFA ?? 0,
          engageMFCFA: l.engageMFCFA ?? 0,
          decaisseMFCFA: l.decaisseMFCFA ?? 0,
          exercice: l.exercice ?? new Date().getFullYear().toString(),
          observations: l.observations ?? '',
        };
        set(s => ({ lignes: [...s.lignes, ligne] }));
        return id;
      },

      updateLigne: (id, patch) =>
        set(s => ({ lignes: s.lignes.map(l => l.id === id ? { ...l, ...patch } : l) })),

      deleteLigne: (id) =>
        set(s => ({ lignes: s.lignes.filter(l => l.id !== id) })),

      reorderLigne: (fromIdx, toIdx) =>
        set(s => {
          const arr = [...s.lignes];
          const [item] = arr.splice(fromIdx, 1);
          arr.splice(toIdx, 0, item);
          return { lignes: arr };
        }),
    }),
    { name: 'sigepp-budget-imputations' }
  )
);
