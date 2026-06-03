/**
 * decompteCircuitStore.ts — Circuit de validation des décomptes, modifiable & personnalisable.
 *
 * Le circuit de référence (étapes, responsables, ordre) est paramétrable par les profils
 * habilités (DPE / PMO / Contrôle financier / Admin). Il sert de modèle aux nouveaux
 * décomptes. Persisté dans localStorage (clé `sigepp-decompte-circuit`).
 *
 * Circuit par défaut : CDC §18 — 5 étapes.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CircuitEtapeDef {
  id: string;
  label: string;
  responsable: string;
  /** SLA indicatif en jours ouvrés pour cette étape */
  slaJours: number;
}

export const DEFAULT_CIRCUIT: CircuitEtapeDef[] = [
  { id: 'depot',              label: 'Dépôt',              responsable: 'Secrétariat',          slaJours: 1 },
  { id: 'controle_technique', label: 'Contrôle technique', responsable: 'Ingénieur / CP',       slaJours: 7 },
  { id: 'validation_admin',   label: 'Validation admin.',  responsable: 'Chef de Département',   slaJours: 3 },
  { id: 'validation_finance', label: 'Validation finance', responsable: 'DCAF',                 slaJours: 5 },
  { id: 'transmission_erp',   label: 'Transmission ERP',   responsable: 'DSI / Oracle EBS',     slaJours: 1 },
];

export interface DecompteCircuitState {
  circuit: CircuitEtapeDef[];
  addEtape: (label: string, responsable: string, slaJours: number) => void;
  updateEtape: (id: string, patch: Partial<CircuitEtapeDef>) => void;
  removeEtape: (id: string) => void;
  moveEtape: (id: string, dir: -1 | 1) => void;
  resetCircuit: () => void;
}

export const useDecompteCircuit = create<DecompteCircuitState>()(
  persist(
    (set) => ({
      circuit: DEFAULT_CIRCUIT.map(e => ({ ...e })),
      addEtape: (label, responsable, slaJours) => set(state => ({
        circuit: [...state.circuit, { id: `et${Date.now()}`, label: label.trim() || 'Nouvelle étape', responsable: responsable.trim(), slaJours: Math.max(0, slaJours) }],
      })),
      updateEtape: (id, patch) => set(state => ({
        circuit: state.circuit.map(e => e.id === id ? { ...e, ...patch } : e),
      })),
      removeEtape: (id) => set(state => ({ circuit: state.circuit.filter(e => e.id !== id) })),
      moveEtape: (id, dir) => set(state => {
        const arr = [...state.circuit];
        const i = arr.findIndex(e => e.id === id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= arr.length) return {};
        [arr[i], arr[j]] = [arr[j], arr[i]];
        return { circuit: arr };
      }),
      resetCircuit: () => set({ circuit: DEFAULT_CIRCUIT.map(e => ({ ...e })) }),
    }),
    { name: 'sigepp-decompte-circuit', partialize: (s) => ({ circuit: s.circuit }) }
  )
);
