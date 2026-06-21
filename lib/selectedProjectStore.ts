/**
 * selectedProjectStore.ts — Contexte projet global SIGEP-DPE
 * Persisté en sessionStorage pour suivre la sélection entre modules
 * sans polluer le localStorage de façon permanente.
 *
 * Usage : chaque module lit selectedId/selectedCode au montage
 * pour pré-sélectionner le bon projet (cohérence cross-module).
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface SelectedProjectState {
  selectedId:   string;
  selectedCode: string;
  setSelected:  (id: string, code: string) => void;
  clearSelected: () => void;
}

export const useSelectedProjectStore = create<SelectedProjectState>()(
  persist(
    (set) => ({
      selectedId:   '',
      selectedCode: '',
      setSelected:  (selectedId, selectedCode) => set({ selectedId, selectedCode }),
      clearSelected: () => set({ selectedId: '', selectedCode: '' }),
    }),
    {
      name:    'sigep_selected_project',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined'
          ? window.sessionStorage
          : (({ getItem: () => null, setItem: () => {}, removeItem: () => {}, length: 0, clear: () => {}, key: () => null }) as unknown as Storage)
      ),
    }
  )
);
