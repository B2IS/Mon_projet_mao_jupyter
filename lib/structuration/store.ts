'use client';
/**
 * store.ts — Persistance des structurations d'actifs par projet (localStorage).
 * Alimente la gestion de projet (WBS/coûts) ET la capitalisation Immo (séparée).
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StructurationProjet } from './types';

interface StructurationState {
  byProjet: Record<string, StructurationProjet>;
  save: (s: StructurationProjet) => void;
  remove: (projetCode: string) => void;
  valider: (projetCode: string) => void;
}

export const useStructurationStore = create<StructurationState>()(
  persist(
    (set) => ({
      byProjet: {},
      save: (s) => set(st => ({ byProjet: { ...st.byProjet, [s.projetCode]: s } })),
      remove: (code) => set(st => { const m = { ...st.byProjet }; delete m[code]; return { byProjet: m }; }),
      valider: (code) => set(st => st.byProjet[code] ? { byProjet: { ...st.byProjet, [code]: { ...st.byProjet[code], valide: true } } } : st),
    }),
    { name: 'sigepp-structuration-v1' },
  ),
);
