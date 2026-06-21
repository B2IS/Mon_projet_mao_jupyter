/**
 * formatUtils.ts — Formateurs partagés SIGEP
 *
 * Deux échelles pour les montants FCFA :
 *   fmtFCFA(n)  — entrée en FCFA brut (ex: 2_400_000_000)
 *   fmtMFCFA(n) — entrée en millions de FCFA (ex: 2_400)
 */

/** Montant en FCFA brut → "2,40 Md" / "150 M" / "45 000" */
export function fmtFCFA(n: number): string {
  if (!isFinite(n)) return '—';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)} Md`;
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(0)} M`;
  return n.toLocaleString('fr-FR');
}

/** Montant en millions de FCFA → "2,40 Md FCFA" / "150 M FCFA" */
export function fmtMFCFA(n: number): string {
  if (!isFinite(n)) return '—';
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)} Md FCFA`;
  return `${Math.round(n)} M FCFA`;
}

/** Pourcentage à 1 décimale — "45.3%" */
export function fmtPct(n: number): string {
  if (!isFinite(n)) return '—';
  return `${n.toFixed(1)}%`;
}

/** Pourcentage entier — "45%" */
export function fmtPctInt(n: number): string {
  if (!isFinite(n)) return '—';
  return `${Math.round(n)}%`;
}

/** Pourcentage signé — "+12.5%" / "-3.0%" */
export function fmtPctSigned(n: number): string {
  if (!isFinite(n)) return '—';
  return `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;
}

/** RAG depuis statut texte (vert/amber/rouge) */
export function ragFromStatut(statut: string): 'vert' | 'amber' | 'rouge' {
  const s = statut.toLowerCase();
  if (/termin|réalis|realis|mes\b/.test(s)) return 'vert';
  if (/cours|actif/.test(s)) return 'amber';
  return 'rouge';
}

/** Couleur hex depuis RAG */
export const RAG_HEX: Record<'vert' | 'amber' | 'rouge', string> = {
  vert:  '#16A34A',
  amber: '#F59E0B',
  rouge: '#EF3340',
};
