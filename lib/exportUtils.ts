/**
 * exportUtils.ts — Utilitaires d'export HARMONISÉS & bien formatés.
 *
 * Centralise la production des fichiers exportés (CSV, Excel, PDF/impression)
 * avec une présentation SENELEC cohérente : en-têtes, largeurs de colonnes,
 * ligne de titre, métadonnées, pied de page et charte graphique.
 *
 * Objectif (tâche #11) : remplacer les exports « bruts » disséminés dans
 * l'application par des sorties propres et professionnelles.
 */

import * as XLSX from 'xlsx';
import { SENELEC_LOGO_DATA_URI } from './senelecLogo';

export type Cell = string | number | null | undefined;

const PRINT_BRAND = {
  navy: '#0E3460',
  orange: '#F39200',
};

/* ─── Helpers de formatage ─────────────────────────────────────────────── */

export function fmtNombre(n: number, decimals = 0): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function todayFR(): string {
  return new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9_\-]+/gi, '_').replace(/_+/g, '_').toLowerCase();
}

/* ─── CSV (UTF-8 + BOM, délimiteur « ; » pour Excel FR) ─────────────────── */

function csvEscape(v: Cell): string {
  const s = v === null || v === undefined ? '' : String(v);
  // Doubler les guillemets, encadrer si nécessaire
  if (/[";\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function downloadCSV(filenameBase: string, headers: string[], rows: Cell[][]): void {
  const sep = ';';
  const head = headers.map(csvEscape).join(sep);
  const body = rows.map(r => r.map(csvEscape).join(sep)).join('\r\n');
  const content = `﻿${head}\r\n${body}`;
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeFilename(filenameBase)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ─── Excel (.xlsx) bien formaté ───────────────────────────────────────── */

export interface ExcelSheet {
  sheetName: string;
  title?: string;            // titre affiché en ligne 1 (fusionnée)
  subtitle?: string;         // sous-titre / contexte (ligne 2)
  headers: string[];
  rows: Cell[][];
  colWidths?: number[];      // largeurs (en caractères) ; sinon auto
}

/** Largeur auto d'une colonne = max(longueur header, longueurs cellules) borné. */
function autoColWidths(headers: string[], rows: Cell[][]): number[] {
  return headers.map((h, i) => {
    let max = String(h).length;
    for (const r of rows) {
      const len = r[i] === null || r[i] === undefined ? 0 : String(r[i]).length;
      if (len > max) max = len;
    }
    return Math.min(Math.max(max + 2, 10), 48);
  });
}

function buildWorksheet(s: ExcelSheet): XLSX.WorkSheet {
  const aoa: Cell[][] = [];
  let headerRowIdx = 0;
  if (s.title) { aoa.push([s.title]); headerRowIdx++; }
  if (s.subtitle) { aoa.push([s.subtitle]); headerRowIdx++; }
  if (s.title || s.subtitle) { aoa.push([]); headerRowIdx++; }
  aoa.push(s.headers);
  s.rows.forEach(r => aoa.push(r));

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Largeurs de colonnes
  const widths = s.colWidths ?? autoColWidths(s.headers, s.rows);
  ws['!cols'] = widths.map(w => ({ wch: w }));

  // Fusion du titre / sous-titre sur toute la largeur
  const merges: XLSX.Range[] = [];
  const lastCol = Math.max(0, s.headers.length - 1);
  let mr = 0;
  if (s.title) { merges.push({ s: { r: mr, c: 0 }, e: { r: mr, c: lastCol } }); mr++; }
  if (s.subtitle) { merges.push({ s: { r: mr, c: 0 }, e: { r: mr, c: lastCol } }); mr++; }
  if (merges.length) ws['!merges'] = merges;

  // Auto-filtre sur la ligne d'en-tête
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  ws['!autofilter'] = {
    ref: XLSX.utils.encode_range(
      { r: headerRowIdx, c: 0 },
      { r: range.e.r, c: lastCol },
    ),
  };

  // Mise en gras de l'en-tête (style appliqué si le moteur le supporte)
  for (let c = 0; c <= lastCol; c++) {
    const addr = XLSX.utils.encode_cell({ r: headerRowIdx, c });
    if (ws[addr]) ws[addr].s = { font: { bold: true } };
  }
  return ws;
}

export function downloadExcel(filenameBase: string, sheets: ExcelSheet | ExcelSheet[]): void {
  const list = Array.isArray(sheets) ? sheets : [sheets];
  const wb = XLSX.utils.book_new();
  list.forEach(s => {
    const ws = buildWorksheet(s);
    // Excel limite les noms d'onglet à 31 caractères
    XLSX.utils.book_append_sheet(wb, ws, s.sheetName.slice(0, 31));
  });
  XLSX.writeFile(wb, `${sanitizeFilename(filenameBase)}.xlsx`);
}

/* ─── Impression / PDF avec charte SENELEC ─────────────────────────────── */

export interface PrintTable {
  title?: string;
  headers: string[];
  rows: Cell[][];
  /** index de colonnes à aligner à droite (nombres) */
  rightAlign?: number[];
}

export interface PrintOptions {
  title: string;
  subtitle?: string;
  /** Sections de tableaux ; alternative à bodyHTML */
  tables?: PrintTable[];
  /** HTML libre inséré après les tableaux (graphes SVG, encadrés…) */
  bodyHTML?: string;
  landscape?: boolean;
  /** Mention de confidentialité dans le pied de page */
  confidentiel?: boolean;
}

function renderPrintTable(t: PrintTable): string {
  const right = new Set(t.rightAlign ?? []);
  const thead = t.headers
    .map((h, i) => `<th style="text-align:${right.has(i) ? 'right' : 'left'}">${h}</th>`)
    .join('');
  const tbody = t.rows
    .map(r => `<tr>${r.map((c, i) => `<td style="text-align:${right.has(i) ? 'right' : 'left'}">${c ?? ''}</td>`).join('')}</tr>`)
    .join('');
  return `
    ${t.title ? `<div class="tbl-title">${t.title}</div>` : ''}
    <table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>`;
}

/** Ouvre une fenêtre d'impression (→ PDF) avec en-tête/pied SENELEC harmonisés. */
export function printBranded(opts: PrintOptions): boolean {
  const win = window.open('', '_blank');
  if (!win) return false;

  const tablesHTML = (opts.tables ?? []).map(renderPrintTable).join('');
  const doc = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><title>${opts.title}</title>
<style>
  @page { size: A4 ${opts.landscape ? 'landscape' : 'portrait'}; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1E293B; margin: 0; }
  .header { display:flex; align-items:center; justify-content:space-between; border-bottom: 3px solid ${PRINT_BRAND.navy}; padding-bottom: 14px; margin-bottom: 18px; }
  .brand { display:flex; align-items:center; gap: 12px; }
  .logo { width:58px; height:58px; display:flex; align-items:center; justify-content:center; }
  .logo img { width:58px; height:auto; max-height:58px; object-fit:contain; display:block; }
  .brand h1 { margin:0; font-size:15px; color:${PRINT_BRAND.navy}; font-weight:800; }
  .brand p { margin:2px 0 0; font-size:9px; color:#64748B; }
  .doc-title { text-align:right; }
  .doc-title h2 { margin:0; font-size:17px; color:${PRINT_BRAND.navy}; font-weight:800; }
  .doc-title .sub { font-size:10px; color:#64748B; margin-top:3px; }
  .doc-title .date { font-size:9px; color:#94A3B8; margin-top:2px; }
  .tbl-title { font-size:12px; font-weight:700; color:${PRINT_BRAND.navy}; margin:18px 0 6px; border-left:3px solid ${PRINT_BRAND.orange}; padding-left:9px; }
  table { width:100%; border-collapse:collapse; font-size:10px; margin-bottom:10px; }
  th { background:${PRINT_BRAND.navy}; color:#fff; padding:7px 9px; text-align:left; font-weight:600; font-size:9px; text-transform:uppercase; letter-spacing:0.04em; }
  td { padding:6px 9px; border-bottom:1px solid #E2E8F0; }
  tbody tr:nth-child(even) td { background:#F8FAFC; }
  .footer { margin-top:24px; border-top:1px solid #E2E8F0; padding-top:8px; display:flex; justify-content:space-between; font-size:8px; color:#94A3B8; }
</style></head>
<body>
  <div class="header">
    <div class="brand">
      <div class="logo"><img src="${SENELEC_LOGO_DATA_URI}" alt="SENELEC" /></div>
      <div>
        <h1>SENELEC</h1>
        <p>Société Nationale d'Électricité du Sénégal</p>
        <p>Direction Principale Équipement (DPE)</p>
      </div>
    </div>
    <div class="doc-title">
      <h2>${opts.title}</h2>
      ${opts.subtitle ? `<div class="sub">${opts.subtitle}</div>` : ''}
      <div class="date">Édité le ${todayFR()}</div>
    </div>
  </div>
  ${tablesHTML}
  ${opts.bodyHTML ?? ''}
  <div class="footer">
    <span>${opts.confidentiel ? 'CONFIDENTIEL — Usage interne SENELEC' : 'SENELEC — Direction Principale Équipement'}</span>
    <span>SIGEPP-DPE · Document généré le ${todayFR()}</span>
  </div>
  <script>window.onload = () => { window.print(); };</script>
</body></html>`;

  win.document.write(doc);
  win.document.close();
  return true;
}
