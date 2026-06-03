/**
 * timesheetStore.ts — Gestion des Heures & Temps Payés SIGEPP-DPE
 * -----------------------------------------------------------------
 * Saisie d'heures par ressource / projet / période avec :
 *  • Répartition multi-projets (si une ressource travaille sur N projets)
 *  • Calcul automatique du coût (heures × taux horaire)
 *  • Alertes dépassement capacité max
 *  • Export par période (semaine / mois)
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── TYPES ──────────────────────────────────────────────────────────────────

export type StatutEntry = 'brouillon' | 'soumis' | 'valide' | 'rejete';

export interface TimeEntry {
  id: string;
  ressourceId: string;   // référence ressource du projectStore
  projetId: string;      // référence projet du projectStore
  date: string;          // 'YYYY-MM-DD'
  heures: number;        // 0.5, 1, 2, 3.5, … (pas de négatif)
  description?: string;  // nature du travail réalisé
  statut: StatutEntry;
  validePar?: string;    // id utilisateur validateur
  dateValidation?: string; // 'YYYY-MM-DD'
  coutCalcule?: number;   // FCFA (heures × tauxHoraire au moment de la saisie)
  tauxHoraireSnapshot: number; // FCFA/h (sauvegardé pour historique)
}

export interface TimesheetSummary {
  ressourceId: string;
  periodeDebut: string;  // 'YYYY-MM-DD'
  periodeFin: string;    // 'YYYY-MM-DD'
  totalHeures: number;
  totalCout: number;     // FCFA
  repartition: { projetId: string; heures: number; cout: number; pct: number }[];
  statutGlobal: StatutEntry;
}

// ─── ÉTAT ─────────────────────────────────────────────────────────────────────

interface TimesheetState {
  entries: TimeEntry[];
  // CRUD
  addEntry: (e: Omit<TimeEntry, 'id' | 'statut' | 'coutCalcule'>) => TimeEntry;
  updateEntry: (id: string, patch: Partial<TimeEntry>) => void;
  removeEntry: (id: string) => void;
  validateEntry: (id: string, validateurId: string) => void;
  rejectEntry: (id: string, validateurId: string) => void;
  // Requêtes
  getEntriesByRessource: (ressourceId: string, periodeDebut?: string, periodeFin?: string) => TimeEntry[];
  getEntriesByProjet: (projetId: string, periodeDebut?: string, periodeFin?: string) => TimeEntry[];
  getSummaryRessource: (ressourceId: string, periodeDebut: string, periodeFin: string, tauxHoraireActuel?: number) => TimesheetSummary;
  getSummaryProjet: (projetId: string, periodeDebut: string, periodeFin: string) => { totalHeures: number; totalCout: number; parRessource: { ressourceId: string; heures: number; cout: number }[] };
  // Alertes
  getAlertesDepassement: (capaciteHebdoMax?: number) => { ressourceId: string; semaine: string; heures: number; max: number }[];
  // Export
  exportPeriode: (periodeDebut: string, periodeFin: string) => string; // JSON
}

let _entryCounter = 0;

function newEntryId() {
  return `ts-${String(++_entryCounter).padStart(4, '0')}`;
}

// ─── UTILITAIRES DE CALCUL ──────────────────────────────────────────────────

function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay(); // 0 = dimanche
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // lundi comme début de semaine
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split('T')[0];
}

function withinRange(date: string, debut?: string, fin?: string): boolean {
  if (debut && date < debut) return false;
  if (fin && date > fin) return false;
  return true;
}

// ─── STORE ────────────────────────────────────────────────────────────────────

export const useTimesheetStore = create<TimesheetState>()(
  persist(
    (set, get) => ({
      entries: [],

      addEntry: (e) => {
        const entry: TimeEntry = {
          ...e,
          id: newEntryId(),
          statut: 'brouillon',
          coutCalcule: Math.round(e.heures * e.tauxHoraireSnapshot),
        };
        set(state => ({ entries: [...state.entries, entry] }));
        return entry;
      },

      updateEntry: (id, patch) => {
        set(state => ({
          entries: state.entries.map(en => {
            if (en.id !== id) return en;
            const merged = { ...en, ...patch };
            // Recalcule le coût si heures ou taux changent
            if (patch.heures !== undefined || patch.tauxHoraireSnapshot !== undefined) {
              merged.coutCalcule = Math.round(merged.heures * merged.tauxHoraireSnapshot);
            }
            return merged;
          }),
        }));
      },

      removeEntry: (id) => {
        set(state => ({ entries: state.entries.filter(en => en.id !== id) }));
      },

      validateEntry: (id, validateurId) => {
        const now = new Date().toISOString().split('T')[0];
        set(state => ({
          entries: state.entries.map(en =>
            en.id === id ? { ...en, statut: 'valide' as StatutEntry, validePar: validateurId, dateValidation: now } : en
          ),
        }));
      },

      rejectEntry: (id, validateurId) => {
        const now = new Date().toISOString().split('T')[0];
        set(state => ({
          entries: state.entries.map(en =>
            en.id === id ? { ...en, statut: 'rejete' as StatutEntry, validePar: validateurId, dateValidation: now } : en
          ),
        }));
      },

      getEntriesByRessource: (ressourceId, debut, fin) => {
        return get().entries.filter(
          e => e.ressourceId === ressourceId && withinRange(e.date, debut, fin)
        );
      },

      getEntriesByProjet: (projetId, debut, fin) => {
        return get().entries.filter(
          e => e.projetId === projetId && withinRange(e.date, debut, fin)
        );
      },

      getSummaryRessource: (ressourceId, periodeDebut, periodeFin, tauxHoraireActuel) => {
        const entries = get().entries.filter(
          e => e.ressourceId === ressourceId && withinRange(e.date, periodeDebut, periodeFin)
        );

        const totalHeures = entries.reduce((s, e) => s + e.heures, 0);
        const totalCout = entries.reduce((s, e) => s + (e.coutCalcule ?? 0), 0);

        // Regroupement par projet
        const map = new Map<string, { heures: number; cout: number }>();
        for (const e of entries) {
          const cur = map.get(e.projetId) ?? { heures: 0, cout: 0 };
          cur.heures += e.heures;
          cur.cout += e.coutCalcule ?? 0;
          map.set(e.projetId, cur);
        }

        const repartition = Array.from(map.entries()).map(([projetId, v]) => ({
          projetId,
          heures: Math.round(v.heures * 100) / 100,
          cout: Math.round(v.cout),
          pct: totalHeures > 0 ? Math.round((v.heures / totalHeures) * 10000) / 100 : 0,
        }));

        // Statut global : si au moins une entrée rejetée → rejeté, sinon si toutes validées → validé, sinon brouillon
        const hasRejete = entries.some(e => e.statut === 'rejete');
        const allValide = entries.length > 0 && entries.every(e => e.statut === 'valide');
        const statutGlobal: StatutEntry = hasRejete ? 'rejete' : allValide ? 'valide' : 'brouillon';

        return {
          ressourceId,
          periodeDebut,
          periodeFin,
          totalHeures: Math.round(totalHeures * 100) / 100,
          totalCout: Math.round(totalCout),
          repartition,
          statutGlobal,
        };
      },

      getSummaryProjet: (projetId, periodeDebut, periodeFin) => {
        const entries = get().entries.filter(
          e => e.projetId === projetId && withinRange(e.date, periodeDebut, periodeFin)
        );

        const totalHeures = entries.reduce((s, e) => s + e.heures, 0);
        const totalCout = entries.reduce((s, e) => s + (e.coutCalcule ?? 0), 0);

        const map = new Map<string, { heures: number; cout: number }>();
        for (const e of entries) {
          const cur = map.get(e.ressourceId) ?? { heures: 0, cout: 0 };
          cur.heures += e.heures;
          cur.cout += e.coutCalcule ?? 0;
          map.set(e.ressourceId, cur);
        }

        const parRessource = Array.from(map.entries()).map(([ressourceId, v]) => ({
          ressourceId,
          heures: Math.round(v.heures * 100) / 100,
          cout: Math.round(v.cout),
        }));

        return { totalHeures: Math.round(totalHeures * 100) / 100, totalCout: Math.round(totalCout), parRessource };
      },

      getAlertesDepassement: (capaciteHebdoMax = 40) => {
        // Regroupe les heures par ressource / semaine
        const map = new Map<string, Map<string, number>>(); // ressourceId → semaine → heures
        for (const e of get().entries) {
          if (!map.has(e.ressourceId)) map.set(e.ressourceId, new Map());
          const weeks = map.get(e.ressourceId)!;
          const ws = getWeekStart(e.date);
          weeks.set(ws, (weeks.get(ws) ?? 0) + e.heures);
        }

        const alertes: { ressourceId: string; semaine: string; heures: number; max: number }[] = [];
        for (const [ressourceId, weeks] of map) {
          for (const [semaine, heures] of weeks) {
            if (heures > capaciteHebdoMax) {
              alertes.push({ ressourceId, semaine, heures: Math.round(heures * 100) / 100, max: capaciteHebdoMax });
            }
          }
        }
        return alertes;
      },

      exportPeriode: (periodeDebut, periodeFin) => {
        const entries = get().entries.filter(e => withinRange(e.date, periodeDebut, periodeFin));
        const data = {
          periodeDebut,
          periodeFin,
          genereLe: new Date().toISOString(),
          totalEntries: entries.length,
          entries: entries.map(e => ({
            id: e.id,
            ressourceId: e.ressourceId,
            projetId: e.projetId,
            date: e.date,
            heures: e.heures,
            cout: e.coutCalcule,
            description: e.description,
            statut: e.statut,
          })),
        };
        return JSON.stringify(data, null, 2);
      },
    }),
    {
      name: 'sigepp-timesheet',
      partialize: (state) => ({ entries: state.entries }),
    }
  )
);

// ─── HOOKS UTILITAIRES (pour React) ─────────────────────────────────────────

/** Récupère le résumé hebdomadaire d'une ressource (hook React) */
export function useWeeklySummary(ressourceId: string, weekStart: string) {
  const { getSummaryRessource } = useTimesheetStore();
  // weekStart = 'YYYY-MM-DD' (lundi)
  const d = new Date(weekStart + 'T00:00:00');
  const sunday = new Date(d);
  sunday.setDate(d.getDate() + 6);
  const weekEnd = sunday.toISOString().split('T')[0];
  return getSummaryRessource(ressourceId, weekStart, weekEnd);
}

/** Récupère le résumé mensuel d'une ressource (hook React) */
export function useMonthlySummary(ressourceId: string, yearMonth: string) {
  const { getSummaryRessource } = useTimesheetStore();
  // yearMonth = 'YYYY-MM'
  const debut = `${yearMonth}-01`;
  const d = new Date(debut + 'T00:00:00');
  d.setMonth(d.getMonth() + 1);
  d.setDate(0); // dernier jour du mois
  const fin = d.toISOString().split('T')[0];
  return getSummaryRessource(ressourceId, debut, fin);
}
