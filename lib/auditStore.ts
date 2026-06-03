/**
 * auditStore.ts — Journal d'audit SIGEPP-DPE (CCF MVP · ADM-03)
 * « En tant qu'administrateur, je veux consulter le journal d'audit afin de tracer
 *   toutes les actions effectuées sur la plateforme. »
 * Critères : date · heure · utilisateur · action · objet concerné · export CSV.
 *
 * Traçabilité inaltérable : on n'EFFACE jamais une entrée (append-only),
 * conformément à l'exigence de traçabilité du CCF.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AuditType =
  | 'connexion' | 'projet' | 'document' | 'workflow' | 'planning'
  | 'finance' | 'administration' | 'export' | 'sig' | 'autre';

export interface AuditEntry {
  id: string;
  date: string;        // ISO — date + heure
  utilisateur: string; // nom affiché
  email?: string;
  role?: string;
  action: string;      // ex : « Création de projet », « Changement de statut »
  objet: string;       // ex : « PRJ-DPD-2026-014 » ou « FMR-Q1.xlsx »
  type: AuditType;
  detail?: string;     // complément libre (ancien→nouveau, montant…)
  direction?: string;  // périmètre organisationnel (héritage MMH)
}

interface AuditState {
  entries: AuditEntry[];
  log: (e: Omit<AuditEntry, 'id' | 'date'> & { date?: string }) => void;
  clearOlderThan: (days: number) => void; // purge RGPD (archivage), pas suppression unitaire
}

export const useAuditStore = create<AuditState>()(
  persist(
    (set) => ({
      entries: [],
      log: (e) => set(s => ({
        entries: [
          {
            id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            date: e.date ?? new Date().toISOString(),
            ...e,
          },
          ...s.entries,
        ].slice(0, 5000), // borne mémoire (les plus récentes)
      })),
      clearOlderThan: (days) => set(s => {
        const cutoff = Date.now() - days * 864e5;
        return { entries: s.entries.filter(x => new Date(x.date).getTime() >= cutoff) };
      }),
    }),
    { name: 'sigepp-audit-journal' },
  ),
);

/** Helper hors-React : journaliser depuis n'importe quel store / action. */
export function logAudit(e: Omit<AuditEntry, 'id' | 'date'> & { date?: string }): void {
  try { useAuditStore.getState().log(e); } catch { /* SSR */ }
}

/** Export CSV du journal (ADM-03 : « export CSV disponible »). */
export function auditToCSV(entries: AuditEntry[]): string {
  const esc = (v: string) => `"${(v ?? '').replace(/"/g, '""')}"`;
  const head = ['Date', 'Heure', 'Utilisateur', 'Rôle', 'Direction', 'Type', 'Action', 'Objet', 'Détail'];
  const rows = entries.map(e => {
    const d = new Date(e.date);
    return [
      d.toLocaleDateString('fr-FR'),
      d.toLocaleTimeString('fr-FR'),
      e.utilisateur, e.role ?? '', e.direction ?? '', e.type, e.action, e.objet, e.detail ?? '',
    ].map(esc).join(';');
  });
  return [head.map(esc).join(';'), ...rows].join('\r\n');
}
