'use client';
/**
 * EditableDataTable — Tableau entièrement modifiable, réutilisable
 * ----------------------------------------------------------------
 * • Édition inline de chaque cellule
 * • Ajout / suppression de LIGNES
 * • Ajout / renommage / suppression de COLONNES (colonnes dynamiques)
 * • Import Excel / CSV : le tableau « épouse » les colonnes du fichier importé
 * • Export Excel (.xlsx) + CSV + téléchargement
 * • Traçabilité (versioning) : historique horodaté + restauration d'une version
 * • Persistance locale (localStorage) par `storageKey`
 *
 * Conçu pour être déposé dans n'importe quelle page : <EditableDataTable
 *   storageKey="..." title="..." initialColumns={...} initialRows={...} />
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  Plus, Trash2, Download, Upload, History, X, RotateCcw, FileSpreadsheet,
} from 'lucide-react';
import { useAuth } from '@/lib/authStore';

export interface EDTColumn { key: string; label: string; }
export type EDTRow = Record<string, string>; // + champ interne _id

interface EDTVersion {
  ts: string;          // ISO
  user: string;        // auteur de la modification
  action: string;      // description courte
  columns: EDTColumn[];
  rows: EDTRow[];
}

interface Props {
  storageKey: string;
  title?: string;
  initialColumns: EDTColumn[];
  initialRows: EDTRow[];
  /** Notifié à chaque changement (facultatif) */
  onChange?: (columns: EDTColumn[], rows: EDTRow[]) => void;
}

const MAX_VERSIONS = 60;

function uid(prefix = 'r'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}
function slugKey(label: string, existing: string[]): string {
  const base = label.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'col';
  let k = base, i = 1;
  while (existing.includes(k)) k = `${base}_${i++}`;
  return k;
}

export default function EditableDataTable({ storageKey, title, initialColumns, initialRows, onChange }: Props) {
  const { user } = useAuth();
  const userName = user ? `${user.prenom} ${user.nom}` : 'Utilisateur';

  const dataKey = `edt:${storageKey}`;
  const histKey = `edt:${storageKey}:hist`;

  const [columns, setColumns] = useState<EDTColumn[]>(() => {
    if (typeof window === 'undefined') return initialColumns;
    try {
      const raw = window.localStorage.getItem(dataKey);
      if (raw) { const p = JSON.parse(raw); if (Array.isArray(p.columns)) return p.columns; }
    } catch { /* ignore */ }
    return initialColumns;
  });
  const [rows, setRows] = useState<EDTRow[]>(() => {
    if (typeof window === 'undefined') return initialRows;
    try {
      const raw = window.localStorage.getItem(dataKey);
      if (raw) { const p = JSON.parse(raw); if (Array.isArray(p.rows)) return p.rows; }
    } catch { /* ignore */ }
    return initialRows.map(r => ({ _id: r._id || uid(), ...r }));
  });
  const [history, setHistory] = useState<EDTVersion[]>(() => {
    if (typeof window === 'undefined') return [];
    try { const raw = window.localStorage.getItem(histKey); return raw ? JSON.parse(raw) : []; }
    catch { return []; }
  });
  const [showHistory, setShowHistory] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Persistance
  useEffect(() => {
    try { window.localStorage.setItem(dataKey, JSON.stringify({ columns, rows })); } catch { /* ignore */ }
    onChange?.(columns, rows);
  }, [columns, rows, dataKey, onChange]);
  useEffect(() => {
    try { window.localStorage.setItem(histKey, JSON.stringify(history)); } catch { /* ignore */ }
  }, [history, histKey]);

  // Enregistre une version (snapshot) avec l'auteur + l'action
  const commit = useCallback((action: string, nextCols: EDTColumn[], nextRows: EDTRow[]) => {
    setColumns(nextCols);
    setRows(nextRows);
    setHistory(h => [
      { ts: new Date().toISOString(), user: userName, action, columns: nextCols, rows: nextRows },
      ...h,
    ].slice(0, MAX_VERSIONS));
  }, [userName]);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const updateCell = useCallback((rowId: string, colKey: string, value: string) => {
    const next = rows.map(r => r._id === rowId ? { ...r, [colKey]: value } : r);
    const col = columns.find(c => c.key === colKey);
    commit(`Cellule modifiée (${col?.label ?? colKey})`, columns, next);
  }, [rows, columns, commit]);

  const addRow = useCallback(() => {
    const blank: EDTRow = { _id: uid() };
    columns.forEach(c => { blank[c.key] = ''; });
    commit('Ligne ajoutée', columns, [...rows, blank]);
  }, [rows, columns, commit]);

  const deleteRow = useCallback((rowId: string) => {
    commit('Ligne supprimée', columns, rows.filter(r => r._id !== rowId));
  }, [rows, columns, commit]);

  const addColumn = useCallback(() => {
    const label = window.prompt('Nom de la nouvelle colonne :', '');
    if (!label || !label.trim()) return;
    const key = slugKey(label.trim(), columns.map(c => c.key));
    const nextCols = [...columns, { key, label: label.trim() }];
    const nextRows = rows.map(r => ({ ...r, [key]: '' }));
    commit(`Colonne ajoutée (${label.trim()})`, nextCols, nextRows);
  }, [columns, rows, commit]);

  const renameColumn = useCallback((colKey: string, label: string) => {
    const nextCols = columns.map(c => c.key === colKey ? { ...c, label } : c);
    commit(`Colonne renommée (${label})`, nextCols, rows);
  }, [columns, rows, commit]);

  const deleteColumn = useCallback((colKey: string) => {
    if (columns.length <= 1) { window.alert('Le tableau doit conserver au moins une colonne.'); return; }
    const col = columns.find(c => c.key === colKey);
    if (!window.confirm(`Supprimer la colonne « ${col?.label ?? colKey} » ?`)) return;
    const nextCols = columns.filter(c => c.key !== colKey);
    const nextRows = rows.map(r => { const { [colKey]: _drop, ...rest } = r; return rest as EDTRow; });
    commit(`Colonne supprimée (${col?.label ?? colKey})`, nextCols, nextRows);
  }, [columns, rows, commit]);

  // ── Import Excel / CSV : le tableau adopte les colonnes du fichier ──────────
  const onImport = useCallback(async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const matrix = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, blankrows: false, defval: '' });
      if (!matrix.length) { window.alert('Fichier vide ou illisible.'); return; }
      const headerRow = matrix[0].map(h => String(h ?? '').trim());
      const keys: string[] = [];
      const newCols: EDTColumn[] = headerRow.map((label, i) => {
        const lbl = label || `Colonne ${i + 1}`;
        const key = slugKey(lbl, keys);
        keys.push(key);
        return { key, label: lbl };
      });
      const newRows: EDTRow[] = matrix.slice(1).map(line => {
        const row: EDTRow = { _id: uid() };
        newCols.forEach((c, i) => { row[c.key] = String(line[i] ?? '').trim(); });
        return row;
      });
      commit(`Import « ${file.name} » (${newRows.length} lignes, ${newCols.length} colonnes)`, newCols, newRows);
    } catch (e) {
      window.alert('Échec de l\'import : ' + (e as Error).message);
    }
  }, [commit]);

  // ── Export Excel / CSV ──────────────────────────────────────────────────────
  const buildSheet = useCallback(() => {
    const aoa = [columns.map(c => c.label), ...rows.map(r => columns.map(c => r[c.key] ?? ''))];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Donnees');
    return wb;
  }, [columns, rows]);

  const exportXlsx = useCallback(() => {
    XLSX.writeFile(buildSheet(), `${storageKey}.xlsx`);
  }, [buildSheet, storageKey]);

  const exportCsv = useCallback(() => {
    const ws = buildSheet().Sheets['Donnees'];
    const csv = XLSX.utils.sheet_to_csv(ws, { FS: ';' });
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,﻿' + encodeURIComponent(csv);
    a.download = `${storageKey}.csv`;
    a.click();
  }, [buildSheet, storageKey]);

  const restoreVersion = useCallback((v: EDTVersion) => {
    if (!window.confirm(`Restaurer la version du ${new Date(v.ts).toLocaleString('fr-FR')} par ${v.user} ?`)) return;
    commit(`Restauration de la version du ${new Date(v.ts).toLocaleString('fr-FR')}`, v.columns, v.rows);
    setShowHistory(false);
  }, [commit]);

  const btn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 7,
    border: '1px solid #CBD5E1', background: '#fff', color: '#334155', fontSize: 11, fontWeight: 600, cursor: 'pointer',
  };

  const lastEdit = history[0];

  return (
    <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '10px 14px', borderBottom: '1px solid #E2E8F0' }}>
        <span style={{ fontSize: 12.5, fontWeight: 800, color: '#0E3460', flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
          <FileSpreadsheet size={15} style={{ color: '#1B4F8A' }} /> {title || 'Tableau dynamique'}
          <span style={{ fontSize: 10.5, fontWeight: 600, color: '#94A3B8' }}>· {rows.length} lignes × {columns.length} colonnes</span>
        </span>
        <button onClick={addRow} style={{ ...btn, borderColor: '#1B4F8A', color: '#1B4F8A' }}><Plus size={12} /> Ligne</button>
        <button onClick={addColumn} style={{ ...btn, borderColor: '#1B4F8A', color: '#1B4F8A' }}><Plus size={12} /> Colonne</button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = ''; }} />
        <button onClick={() => fileRef.current?.click()} style={{ ...btn, borderColor: '#7C3AED', color: '#7C3AED' }}><Upload size={12} /> Importer Excel/CSV</button>
        <button onClick={exportXlsx} style={btn}><Download size={12} /> Excel</button>
        <button onClick={exportCsv} style={btn}><Download size={12} /> CSV</button>
        <button onClick={() => setShowHistory(s => !s)} style={{ ...btn, borderColor: showHistory ? '#16A34A' : '#CBD5E1', color: showHistory ? '#16A34A' : '#334155' }}>
          <History size={12} /> Historique ({history.length})
        </button>
      </div>

      {lastEdit && (
        <div style={{ padding: '5px 14px', fontSize: 10.5, color: '#64748B', background: '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
          Dernière modification : <strong>{lastEdit.action}</strong> — {lastEdit.user} · {new Date(lastEdit.ts).toLocaleString('fr-FR')}
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
          <thead>
            <tr style={{ background: '#0E346008', borderBottom: '2px solid #0E346020' }}>
              <th style={{ width: 30 }}></th>
              {columns.map(c => (
                <th key={c.key} style={{ padding: '6px 8px', textAlign: 'left', minWidth: 90 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <input
                      value={c.label}
                      onChange={e => setColumns(cols => cols.map(x => x.key === c.key ? { ...x, label: e.target.value } : x))}
                      onBlur={e => renameColumn(c.key, e.target.value)}
                      style={{ width: '100%', minWidth: 70, fontSize: 10.5, fontWeight: 700, color: '#0E3460', textTransform: 'uppercase', letterSpacing: '.3px', border: '1px solid transparent', borderRadius: 4, padding: '2px 4px', background: 'transparent', outline: 'none' }}
                      onFocus={e => e.currentTarget.style.border = '1px solid #CBD5E1'}
                    />
                    <button onClick={() => deleteColumn(c.key)} title="Supprimer la colonne"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CBD5E1', padding: 0, lineHeight: 1 }}
                      onMouseEnter={e => e.currentTarget.style.color = '#DC2626'}
                      onMouseLeave={e => e.currentTarget.style.color = '#CBD5E1'}>
                      <X size={12} />
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r._id} style={{ borderBottom: '1px solid #F1F5F9', background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                <td style={{ textAlign: 'center' }}>
                  <button onClick={() => deleteRow(r._id)} title="Supprimer la ligne"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CBD5E1', padding: 4 }}
                    onMouseEnter={e => e.currentTarget.style.color = '#DC2626'}
                    onMouseLeave={e => e.currentTarget.style.color = '#CBD5E1'}>
                    <Trash2 size={12} />
                  </button>
                </td>
                {columns.map(c => (
                  <td key={c.key} style={{ padding: 0 }}>
                    <input
                      value={r[c.key] ?? ''}
                      onChange={e => setRows(rs => rs.map(x => x._id === r._id ? { ...x, [c.key]: e.target.value } : x))}
                      onBlur={e => updateCell(r._id, c.key, e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', border: '1px solid transparent', padding: '7px 8px', fontSize: 11.5, color: '#1E293B', background: 'transparent', outline: 'none' }}
                      onFocus={e => { e.currentTarget.style.border = '1px solid #1B4F8A'; e.currentTarget.style.background = '#fff'; }}
                    />
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={columns.length + 1} style={{ textAlign: 'center', padding: '30px', color: '#94A3B8' }}>
                Aucune ligne. Cliquez « + Ligne » ou importez un fichier Excel/CSV.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Historique / versioning */}
      {showHistory && (
        <div style={{ borderTop: '1px solid #E2E8F0', maxHeight: 260, overflowY: 'auto', background: '#FAFAFA' }}>
          <div style={{ padding: '8px 14px', fontSize: 11, fontWeight: 800, color: '#0E3460', textTransform: 'uppercase', letterSpacing: '.4px' }}>
            Traçabilité des modifications
          </div>
          {history.length === 0 ? (
            <div style={{ padding: '0 14px 14px', fontSize: 11, color: '#94A3B8' }}>Aucune modification enregistrée.</div>
          ) : history.map((v, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 14px', borderTop: '1px solid #F1F5F9', fontSize: 11 }}>
              <span style={{ color: '#94A3B8', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{new Date(v.ts).toLocaleString('fr-FR')}</span>
              <span style={{ fontWeight: 700, color: '#1B4F8A', whiteSpace: 'nowrap' }}>{v.user}</span>
              <span style={{ flex: 1, color: '#374151' }}>{v.action}</span>
              <button onClick={() => restoreVersion(v)} style={{ ...btn, padding: '3px 8px', fontSize: 10 }}>
                <RotateCcw size={11} /> Restaurer
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
