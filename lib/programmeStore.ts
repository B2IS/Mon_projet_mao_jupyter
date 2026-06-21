/**
 * lib/programmeStore.ts
 * Store Zustand persisté pour les programmes utilisateur SIGEP-DPE.
 * Un programme regroupe des projets existants sous un label commun
 * (ex: PADAES, BEST, PES…). Les programmes auto-domaine générés dans
 * Programmes.tsx restent calculés dynamiquement et ne sont pas ici.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Domaine } from './projectStore';

export type StatutProgramme = 'actif' | 'planifie' | 'cloture' | 'suspendu';

export interface UserProgramme {
  id: string;
  code: string;
  nom: string;
  /** 'multi' quand le programme regroupe plusieurs domaines */
  domaine: Domaine | 'multi';
  chef: string;
  dateDebut: string;
  dateFin: string;
  projetsIds: string[];
  statut: StatutProgramme;
  description?: string;
  bailleur?: string;
  createdAt: string;
}

interface ProgrammeStore {
  programmes: UserProgramme[];
  addProgramme: (p: Omit<UserProgramme, 'id' | 'createdAt'>) => UserProgramme;
  updateProgramme: (id: string, updates: Partial<Omit<UserProgramme, 'id' | 'createdAt'>>) => void;
  deleteProgramme: (id: string) => void;
  addProjetToProgramme: (programmeId: string, projetId: string) => void;
  removeProjetFromProgramme: (programmeId: string, projetId: string) => void;
}

export const useProgrammeStore = create<ProgrammeStore>()(
  persist(
    (set) => ({
      programmes: [],

      addProgramme: (p) => {
        const newPrg: UserProgramme = {
          ...p,
          id: `prg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ programmes: [...state.programmes, newPrg] }));
        return newPrg;
      },

      updateProgramme: (id, updates) =>
        set((state) => ({
          programmes: state.programmes.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        })),

      deleteProgramme: (id) =>
        set((state) => ({
          programmes: state.programmes.filter((p) => p.id !== id),
        })),

      addProjetToProgramme: (programmeId, projetId) =>
        set((state) => ({
          programmes: state.programmes.map((p) =>
            p.id === programmeId && !p.projetsIds.includes(projetId)
              ? { ...p, projetsIds: [...p.projetsIds, projetId] }
              : p
          ),
        })),

      removeProjetFromProgramme: (programmeId, projetId) =>
        set((state) => ({
          programmes: state.programmes.map((p) =>
            p.id === programmeId
              ? { ...p, projetsIds: p.projetsIds.filter((id) => id !== projetId) }
              : p
          ),
        })),
    }),
    { name: 'sigep-programmes-v1' }
  )
);
