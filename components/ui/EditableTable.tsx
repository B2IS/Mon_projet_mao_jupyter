'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Plus, Trash2, GripVertical, X, Check, Download, Settings2, ChevronLeft, ChevronRight } from 'lucide-react';

/* ════════════════════════════════════════════════════════════════════════════
   EditableTable — tableau entièrement personnalisable par l'utilisateur
   - Ajouter / renommer / supprimer / réordonner des colonnes
   - Choisir le type d'une colonne (texte, nombre, sélection, date, calculée)
   - Éditer chaque cellule en place
   - Ajouter / supprimer des lignes
   - Totaux automatiques sur les colonnes numériques
   - Export CSV
   Conçu pour les BoQ, livrables, et tout tableau métier adaptable.
═══════════════════════════════════════════════════════════════════════════════ */

const NAVY = '#1B4F8A';
const ORANGE = '#F47920';
const RED = '#EF3340';
const BORDER = '#E2E8F0';

export type ColType = 'text' | 'number' | 'select' | 'date' | 'computed';

export interface EditableColumn {
  id: string;
  label: string;
  type: ColType;
  options?: string[];          // pour type 'select'
  align?: 'left' | 'right' | 'center';
  width?: number;              // largeur en px (sinon flex)
  prefix?: string;
  suffix?: string;
  total?: boolean;             // afficher le total dans le pied
  /** Formule de calcul pour les colonnes 'computed' (lecture seule) */
  compute?: (row: EditableRow) => number;
  editable?: boolean;          // défaut true (false pour 'computed')
}

export type CellValue = string | number;
export interface EditableRow {
  id: string;
  [key: string]: CellValue;
}

interface Props {
  initialColumns: EditableColumn[];
  initialRows: EditableRow[];
  title?: string;
  /** Désactive l'édition de la structure (colonnes) — édition cellules seulement */
  lockStructure?: boolean;
  /** Notifié à chaque changement de données ou de structure */
  onChange?: (columns: EditableColumn[], rows: EditableRow[]) => void;
  /** Libellé du bouton "ajouter une ligne" */
  addRowLabel?: string;
  /** Devise / format des nombres */
  numberLocale?: string;
}

function fmtNum(v: number, locale = 'fr-FR'): string {
  if (Number.isNaN(v)) return '0';
  return v.toLocaleString(locale);
}

export default function EditableTable({
  initialColumns, initialRows, title,
  lockStructure = false, onChange,
  addRowLabel = 'Ajouter une ligne', numberLocale = 'fr-FR',
}: Props) {
  const [columns, setColumns] = useState<EditableColumn[]>(initialColumns);
  const [rows, setRows] = useState<EditableRow[]>(initialRows);
  const [colMenu, setColMenu] = useState<string | null>(null);       // id colonne dont le menu est ouvert
  const [renaming, setRenaming] = useState<string | null>(null);     // id colonne en cours de renommage
  const [renameVal, setRenameVal] = useState('');
  const [showAddCol, setShowAddCol] = useState(false);
  const [newCol, setNewCol] = useState<{ label: string; type: ColType; options: string }>({ label: '', type: 'text', options: '' });

  const menuRef = useRef<HTMLDivElement | null>(null);

  // Synchroniser vers le parent
  useEffect(() => { onChange?.(columns, rows); }, [columns, rows]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fermer le menu colonne au clic extérieur
  useEffect(() => {
    if (!colMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setColMenu(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [colMenu]);

  /* ─── Valeur affichée d'une cellule ─── */
  const cellDisplay = (row: EditableRow, col: EditableColumn): CellValue => {
    if (col.type === 'computed' && col.compute) return col.compute(row);
    return row[col.id] ?? (col.type === 'number' ? 0 : '');
  };

  /* ─── Édition d'une cellule ─── */
  const updateCell = (rowId: string, colId: string, value: CellValue) => {
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, [colId]: value } : r));
  };

  /* ─── Colonnes ─── */
  const addColumn = () => {
    if (!newCol.label.trim()) return;
    const id = `col_${Date.now()}`;
    const col: EditableColumn = {
      id, label: newCol.label.trim(), type: newCol.type,
      align: newCol.type === 'number' ? 'right' : 'left',
      total: newCol.type === 'number',
      options: newCol.type === 'select' ? newCol.options.split(',').map(s => s.trim()).filter(Boolean) : undefined,
    };
    setColumns(prev => [...prev, col]);
    // initialiser la valeur sur chaque ligne
    setRows(prev => prev.map(r => ({ ...r, [id]: newCol.type === 'number' ? 0 : '' })));
    setNewCol({ label: '', type: 'text', options: '' });
    setShowAddCol(false);
  };
  const renameColumn = (colId: string) => {
    if (!renameVal.trim()) { setRenaming(null); return; }
    setColumns(prev => prev.map(c => c.id === colId ? { ...c, label: renameVal.trim() } : c));
    setRenaming(null);
  };
  const deleteColumn = (colId: string) => {
    setColumns(prev => prev.filter(c => c.id !== colId));
    setColMenu(null);
  };
  const moveColumn = (colId: string, dir: -1 | 1) => {
    setColumns(prev => {
      const i = prev.findIndex(c => c.id === colId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };
  const changeColType = (colId: string, type: ColType) => {
    setColumns(prev => prev.map(c => c.id === colId
      ? { ...c, type, align: type === 'number' ? 'right' : c.align, total: type === 'number' ? c.total : false }
      : c));
    setColMenu(null);
  };

  /* ─── Lignes ─── */
  const addRow = () => {
    const id = `row_${Date.now()}`;
    const row: EditableRow = { id };
    columns.forEach(c => { row[c.id] = c.type === 'number' ? 0 : ''; });
    setRows(prev => [...prev, row]);
  };
  const deleteRow = (rowId: string) => setRows(prev => prev.filter(r => r.id !== rowId));

  /* ─── Totaux ─── */
  const totals = useMemo(() => {
    const t: Record<string, number> = {};
    columns.forEach(c => {
      if ((c.type === 'number' || c.type === 'computed') && c.total) {
        t[c.id] = rows.reduce((s, r) => s + Number(cellDisplay(r, c) || 0), 0);
      }
    });
    return t;
  }, [columns, rows]); // eslint-disable-line react-hooks/exhaustive-deps
  const hasTotals = Object.keys(totals).length > 0;

  /* ─── Export CSV ─── */
  const exportCSV = () => {
    const header = columns.map(c => c.label).join(';');
    const body = rows.map(r => columns.map(c => {
      const v = cellDisplay(r, c);
      return typeof v === 'string' && v.includes(';') ? `"${v}"` : String(v);
    }).join(';')).join('\n');
    const csv = `${header}\n${body}`;
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,﻿' + encodeURIComponent(csv);
    a.download = `${(title ?? 'tableau').replace(/\s+/g, '_').toLowerCase()}.csv`;
    a.click();
  };

  const gridTemplate = columns.map(c => c.width ? `${c.width}px` : 'minmax(90px, 1fr)').join(' ') + ' 44px';

  const thStyle: React.CSSProperties = {
    fontSize: 10.5, fontWeight: 700, color: '#64748B',
    textTransform: 'uppercase', letterSpacing: '0.05em',
  };

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${BORDER}`, overflow: 'visible' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', flex: 1 }}>
          {title ?? 'Tableau personnalisable'}
          <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 500, color: '#94A3B8' }}>
            {rows.length} ligne{rows.length > 1 ? 's' : ''} · {columns.length} colonne{columns.length > 1 ? 's' : ''}
          </span>
        </div>
        {!lockStructure && (
          <button onClick={() => setShowAddCol(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 7, border: `1px solid ${ORANGE}`, background: `${ORANGE}12`, color: ORANGE, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            <Plus size={13} /> Colonne
          </button>
        )}
        <button onClick={exportCSV}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 7, border: `1px solid ${BORDER}`, background: '#fff', color: '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          <Download size={13} /> CSV
        </button>
      </div>

      {/* En-têtes */}
      <div style={{ display: 'grid', gridTemplateColumns: gridTemplate, gap: 6, padding: '8px 12px', background: '#F8FAFC', borderBottom: `1px solid ${BORDER}`, position: 'relative' }}>
        {columns.map(col => (
          <div key={col.id} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 4, justifyContent: col.align === 'right' ? 'flex-end' : col.align === 'center' ? 'center' : 'flex-start' }}>
            {renaming === col.id ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <input autoFocus value={renameVal} onChange={e => setRenameVal(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') renameColumn(col.id); if (e.key === 'Escape') setRenaming(null); }}
                  style={{ width: 90, fontSize: 11, padding: '2px 5px', border: `1px solid ${NAVY}`, borderRadius: 4, outline: 'none' }} />
                <button onClick={() => renameColumn(col.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#16A34A', display: 'flex' }}><Check size={13} /></button>
              </span>
            ) : (
              <>
                <span style={thStyle}>{col.label}</span>
                {col.type === 'computed' && <span style={{ fontSize: 8, color: ORANGE, fontWeight: 700 }}>ƒ</span>}
                {!lockStructure && (
                  <button onClick={() => setColMenu(colMenu === col.id ? null : col.id)}
                    title="Options colonne"
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex', padding: 1 }}>
                    <Settings2 size={12} />
                  </button>
                )}
              </>
            )}

            {/* Menu colonne */}
            {colMenu === col.id && (
              <div ref={menuRef} style={{ position: 'absolute', top: 22, right: 0, zIndex: 50, background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.14)', width: 188, padding: 6, textTransform: 'none', letterSpacing: 0 }}>
                <button onClick={() => { setRenaming(col.id); setRenameVal(col.label); setColMenu(null); }} style={menuBtn}>✏️ Renommer</button>
                <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px 2px', fontWeight: 700, textTransform: 'uppercase' }}>Type de colonne</div>
                {(['text', 'number', 'select', 'date'] as ColType[]).map(t => (
                  <button key={t} onClick={() => changeColType(col.id, t)} style={{ ...menuBtn, background: col.type === t ? '#EFF6FF' : 'none', color: col.type === t ? NAVY : '#374151', fontWeight: col.type === t ? 700 : 500 }}>
                    {t === 'text' ? '🔤 Texte' : t === 'number' ? '🔢 Nombre' : t === 'select' ? '📋 Liste' : '📅 Date'}
                  </button>
                ))}
                <div style={{ height: 1, background: BORDER, margin: '4px 0' }} />
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => moveColumn(col.id, -1)} style={{ ...menuBtn, flex: 1, justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 2 }}><ChevronLeft size={12} /> Gauche</button>
                  <button onClick={() => moveColumn(col.id, 1)} style={{ ...menuBtn, flex: 1, justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 2 }}>Droite <ChevronRight size={12} /></button>
                </div>
                <button onClick={() => deleteColumn(col.id)} style={{ ...menuBtn, color: RED }}>🗑️ Supprimer la colonne</button>
              </div>
            )}
          </div>
        ))}
        <div /> {/* colonne actions */}
      </div>

      {/* Lignes */}
      <div style={{ maxHeight: 420, overflowY: 'auto' }}>
        {rows.length === 0 && (
          <div style={{ padding: 28, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>Aucune ligne — cliquez sur « {addRowLabel} »</div>
        )}
        {rows.map(row => (
          <div key={row.id} className="et-row" style={{ display: 'grid', gridTemplateColumns: gridTemplate, gap: 6, padding: '6px 12px', borderBottom: `1px solid #F1F5F9`, alignItems: 'center' }}>
            {columns.map(col => {
              const val = cellDisplay(row, col);
              const ro = col.type === 'computed' || col.editable === false;
              const cellAlign = col.align ?? (col.type === 'number' ? 'right' : 'left');
              if (ro) {
                return (
                  <div key={col.id} style={{ fontSize: 12.5, textAlign: cellAlign, fontWeight: col.type === 'computed' ? 700 : 500, color: col.type === 'computed' ? NAVY : '#1E293B' }}>
                    {col.prefix}{col.type === 'computed' || col.type === 'number' ? fmtNum(Number(val), numberLocale) : val}{col.suffix}
                  </div>
                );
              }
              if (col.type === 'select') {
                return (
                  <select key={col.id} value={String(val)} onChange={e => updateCell(row.id, col.id, e.target.value)}
                    style={{ fontSize: 12, padding: '4px 6px', border: `1px solid ${BORDER}`, borderRadius: 5, background: '#fff', outline: 'none', fontFamily: 'inherit', width: '100%' }}>
                    <option value=""></option>
                    {(col.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                );
              }
              return (
                <input key={col.id}
                  type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'}
                  value={String(val)}
                  onChange={e => updateCell(row.id, col.id, col.type === 'number' ? Number(e.target.value) : e.target.value)}
                  style={{ fontSize: 12.5, padding: '4px 6px', border: `1px solid transparent`, borderRadius: 5, background: 'transparent', outline: 'none', fontFamily: 'inherit', width: '100%', textAlign: cellAlign, color: '#1E293B', boxSizing: 'border-box' }}
                  onFocus={e => { e.currentTarget.style.border = `1px solid ${NAVY}`; e.currentTarget.style.background = '#fff'; }}
                  onBlur={e => { e.currentTarget.style.border = '1px solid transparent'; e.currentTarget.style.background = 'transparent'; }}
                />
              );
            })}
            <button onClick={() => deleteRow(row.id)} title="Supprimer la ligne"
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#CBD5E1', display: 'flex', justifyContent: 'center', padding: 4 }}
              onMouseEnter={e => (e.currentTarget.style.color = RED)}
              onMouseLeave={e => (e.currentTarget.style.color = '#CBD5E1')}>
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>

      {/* Totaux */}
      {hasTotals && (
        <div style={{ display: 'grid', gridTemplateColumns: gridTemplate, gap: 6, padding: '9px 12px', borderTop: `2px solid ${BORDER}`, background: '#F8FAFC', alignItems: 'center' }}>
          {columns.map((col, i) => (
            <div key={col.id} style={{ fontSize: 12.5, textAlign: col.align ?? (col.type === 'number' ? 'right' : 'left'), fontWeight: 800, color: NAVY }}>
              {i === 0 ? 'TOTAL' : totals[col.id] != null ? `${col.prefix ?? ''}${fmtNum(totals[col.id], numberLocale)}${col.suffix ?? ''}` : ''}
            </div>
          ))}
          <div />
        </div>
      )}

      {/* Pied : ajouter ligne */}
      <div style={{ padding: '10px 16px', borderTop: `1px solid ${BORDER}` }}>
        <button onClick={addRow}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7, border: `1px dashed ${NAVY}`, background: '#F8FAFC', color: NAVY, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          <Plus size={14} /> {addRowLabel}
        </button>
      </div>

      {/* Modal : ajouter une colonne */}
      {showAddCol && (
        <>
          <div onClick={() => setShowAddCol(false)} style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 401, background: '#fff', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', width: 380, padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: NAVY }}>+ Nouvelle colonne</div>
              <button onClick={() => setShowAddCol(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={18} /></button>
            </div>
            <label style={addLbl}>Nom de la colonne</label>
            <input autoFocus value={newCol.label} onChange={e => setNewCol(c => ({ ...c, label: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') addColumn(); }}
              placeholder="Ex : Délai (jours)" style={addInp} />
            <label style={addLbl}>Type</label>
            <select value={newCol.type} onChange={e => setNewCol(c => ({ ...c, type: e.target.value as ColType }))} style={addInp}>
              <option value="text">🔤 Texte</option>
              <option value="number">🔢 Nombre (avec total)</option>
              <option value="select">📋 Liste de choix</option>
              <option value="date">📅 Date</option>
            </select>
            {newCol.type === 'select' && (
              <>
                <label style={addLbl}>Options (séparées par des virgules)</label>
                <input value={newCol.options} onChange={e => setNewCol(c => ({ ...c, options: e.target.value }))}
                  placeholder="Ex : Faible, Moyen, Élevé" style={addInp} />
              </>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setShowAddCol(false)} style={{ padding: '7px 16px', borderRadius: 7, border: `1px solid ${BORDER}`, background: '#fff', fontSize: 12, cursor: 'pointer' }}>Annuler</button>
              <button onClick={addColumn} disabled={!newCol.label.trim()} style={{ padding: '7px 18px', borderRadius: 7, border: 'none', background: newCol.label.trim() ? NAVY : '#E5E7EB', color: newCol.label.trim() ? '#fff' : '#9CA3AF', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ Ajouter</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const menuBtn: React.CSSProperties = {
  display: 'block', width: '100%', textAlign: 'left', padding: '6px 8px',
  border: 'none', background: 'none', cursor: 'pointer', fontSize: 12,
  color: '#374151', borderRadius: 5, fontFamily: 'inherit',
};
const addLbl: React.CSSProperties = { display: 'block', fontSize: 10.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4, marginTop: 12 };
const addInp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 7, border: `1px solid ${BORDER}`, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' };
