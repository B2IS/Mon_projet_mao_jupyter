'use client';

import { useState, useMemo, useRef, useCallback } from 'react';
import { Download, Plus, Trash2, TableProperties } from 'lucide-react';
import { useBudgetImputationStore, NATURES, type LigneImputation, type NatureDepense } from '@/lib/budgetImputationStore';

const NAVY = '#1B4F8A';
const RED  = '#EF3340';

const NATURE_COLORS: Record<NatureDepense, string> = {
  'Études':             '#7C3AED',
  'Travaux':            '#1B4F8A',
  'Équipements':        '#F47920',
  'Services':           '#16A34A',
  "Maîtrise d'œuvre":  '#0891B2',
  'Divers':             '#64748B',
};

const COLS = [
  { key: 'projetCode',    label: 'Code',         width: 90,  type: 'text'   },
  { key: 'projetNom',     label: 'Projet',        width: 200, type: 'text'   },
  { key: 'nature',        label: 'Nature',        width: 150, type: 'select' },
  { key: 'description',   label: 'Désignation',   width: 220, type: 'text'   },
  { key: 'prevuMFCFA',    label: 'Prévu (M)',     width: 90,  type: 'number' },
  { key: 'engageMFCFA',   label: 'Engagé (M)',    width: 90,  type: 'number' },
  { key: 'decaisseMFCFA', label: 'Décaissé (M)',  width: 90,  type: 'number' },
  { key: 'exercice',      label: 'Exercice',      width: 75,  type: 'text'   },
  { key: 'observations',  label: 'Observations',  width: 180, type: 'text'   },
] as const;

type ColKey = typeof COLS[number]['key'];

const BORDER  = '#E2E8F0';
const HEAD_BG = '#0F172A';

export default function ImputationsTableur() {
  const { lignes, addLigne, updateLigne, deleteLigne } = useBudgetImputationStore();
  const [editCell, setEditCell] = useState<{ id: string; field: ColKey } | null>(null);
  const [editVal, setEditVal]   = useState('');
  const [filterNature, setFilterNature] = useState<NatureDepense | 'Toutes'>('Toutes');
  const [filterCode, setFilterCode]     = useState('');
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null);

  const filtered = useMemo(() => {
    return lignes.filter(l => {
      if (filterNature !== 'Toutes' && l.nature !== filterNature) return false;
      if (filterCode && !l.projetCode.toLowerCase().includes(filterCode.toLowerCase()) &&
          !l.projetNom.toLowerCase().includes(filterCode.toLowerCase())) return false;
      return true;
    });
  }, [lignes, filterNature, filterCode]);

  const totals = useMemo(() => ({
    prevu:    filtered.reduce((s, l) => s + l.prevuMFCFA, 0),
    engage:   filtered.reduce((s, l) => s + l.engageMFCFA, 0),
    decaisse: filtered.reduce((s, l) => s + l.decaisseMFCFA, 0),
  }), [filtered]);

  const startEdit = useCallback((id: string, field: ColKey, currentVal: string) => {
    setEditCell({ id, field });
    setEditVal(currentVal);
    setTimeout(() => (inputRef.current as HTMLElement | null)?.focus(), 30);
  }, []);

  const commitEdit = useCallback(() => {
    if (!editCell) return;
    const { id, field } = editCell;
    const col = COLS.find(c => c.key === field);
    const val = col?.type === 'number' ? parseFloat(editVal) || 0 : editVal;
    updateLigne(id, { [field]: val } as Partial<LigneImputation>);
    setEditCell(null);
  }, [editCell, editVal, updateLigne]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); commitEdit(); }
    if (e.key === 'Escape') setEditCell(null);
  };

  function exportCSV() {
    const headers = COLS.map(c => c.label).join(';');
    const rows = filtered.map(l =>
      COLS.map(c => {
        const v = l[c.key as keyof LigneImputation];
        return typeof v === 'number' ? v.toFixed(3) : String(v ?? '');
      }).join(';')
    );
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'imputations_budget.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  function CellEditor({ id, field, col }: { id: string; field: ColKey; col: typeof COLS[number] }) {
    const ligne = lignes.find(l => l.id === id)!;
    const isEditing = editCell?.id === id && editCell.field === field;
    const rawVal = ligne[field as keyof LigneImputation];
    const displayVal = col.type === 'number' ? (rawVal as number).toFixed(2) : String(rawVal ?? '');

    if (isEditing) {
      if (col.type === 'select') {
        return (
          <select
            ref={r => { (inputRef as React.MutableRefObject<HTMLSelectElement | null>).current = r; }}
            value={editVal}
            onChange={e => setEditVal(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            style={{ width: '100%', border: 'none', outline: 'none', background: '#EFF6FF',
              fontSize: 11.5, padding: '2px 4px', borderRadius: 4, fontFamily: 'inherit' }}
          >
            {NATURES.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        );
      }
      return (
        <input
          ref={r => { (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = r; }}
          type={col.type === 'number' ? 'number' : 'text'}
          value={editVal}
          onChange={e => setEditVal(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          step={col.type === 'number' ? '0.001' : undefined}
          style={{ width: '100%', border: 'none', outline: 'none', background: '#EFF6FF',
            fontSize: 11.5, padding: '2px 4px', borderRadius: 4, fontFamily: 'inherit',
            textAlign: col.type === 'number' ? 'right' : 'left' }}
        />
      );
    }

    if (field === 'nature') {
      const color = NATURE_COLORS[rawVal as NatureDepense] ?? '#64748B';
      return (
        <span style={{ display: 'inline-block', background: color + '18', color, border: `1px solid ${color}44`,
          padding: '2px 8px', borderRadius: 12, fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap' }}>
          {displayVal}
        </span>
      );
    }
    if (col.type === 'number') {
      const v = rawVal as number;
      return <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v > 0 ? v.toFixed(2) : '—'}</span>;
    }
    return <span style={{ fontSize: 11.5, color: displayVal ? '#1E293B' : '#94A3B8' }}>{displayVal || '—'}</span>;
  }

  return (
    <div style={{ padding: '18px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TableProperties size={16} color={NAVY} />
          <span style={{ fontWeight: 800, fontSize: 14, color: '#0F172A' }}>Tableur — Imputations budgétaires</span>
          <span style={{ fontSize: 11, color: '#64748B', background: '#F1F5F9', padding: '2px 8px', borderRadius: 10 }}>
            {filtered.length} ligne{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div style={{ flex: 1 }} />
        <select
          value={filterNature}
          onChange={e => setFilterNature(e.target.value as NatureDepense | 'Toutes')}
          style={{ fontSize: 11.5, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '5px 10px',
            background: '#fff', color: '#374151', cursor: 'pointer' }}
        >
          <option value="Toutes">Toutes natures</option>
          {NATURES.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <input
          placeholder="Filtrer par projet…"
          value={filterCode}
          onChange={e => setFilterCode(e.target.value)}
          style={{ fontSize: 11.5, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '5px 10px',
            background: '#fff', color: '#374151', width: 160 }}
        />
        <button
          onClick={() => addLigne({ exercice: new Date().getFullYear().toString() })}
          style={{ display: 'flex', alignItems: 'center', gap: 5, background: NAVY, color: '#fff',
            border: 'none', borderRadius: 7, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
        >
          <Plus size={13} /> Ajouter ligne
        </button>
        <button
          onClick={exportCSV}
          style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#fff', color: NAVY,
            border: `1.5px solid ${NAVY}`, borderRadius: 7, padding: '6px 12px', fontSize: 12,
            fontWeight: 700, cursor: 'pointer' }}
        >
          <Download size={13} /> Exporter CSV
        </button>
      </div>

      <p style={{ fontSize: 11, color: '#64748B', margin: '0 0 10px', fontStyle: 'italic' }}>
        Cliquez sur une cellule pour l'éditer · Tab ou Entrée pour valider · Échap pour annuler
      </p>

      <div style={{ overflowX: 'auto', borderRadius: 10, border: `1px solid ${BORDER}`,
        boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 1280 }}>
          <colgroup>
            {COLS.map(c => <col key={c.key} style={{ width: c.width }} />)}
            <col style={{ width: 44 }} />
          </colgroup>
          <thead>
            <tr style={{ background: HEAD_BG }}>
              {COLS.map(c => (
                <th key={c.key} style={{ padding: '9px 10px', textAlign: c.type === 'number' ? 'right' : 'left',
                  fontSize: 10, fontWeight: 700, color: '#CBD5E1', textTransform: 'uppercase',
                  letterSpacing: '0.06em', borderRight: `1px solid rgba(255,255,255,.08)`, whiteSpace: 'nowrap' }}>
                  {c.label}
                </th>
              ))}
              <th style={{ padding: '9px 6px', background: HEAD_BG }} />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={COLS.length + 1} style={{ padding: '32px', textAlign: 'center', color: '#94A3B8',
                  fontSize: 13, fontStyle: 'italic' }}>
                  Aucune ligne — cliquez « Ajouter ligne » pour commencer.
                </td>
              </tr>
            )}
            {filtered.map((ligne, rowIdx) => {
              const isOdd = rowIdx % 2 === 1;
              const engageRatio = ligne.prevuMFCFA > 0 ? ligne.engageMFCFA / ligne.prevuMFCFA : 0;
              const decRatio    = ligne.prevuMFCFA > 0 ? ligne.decaisseMFCFA / ligne.prevuMFCFA : 0;
              return (
                <tr key={ligne.id}
                  style={{ background: isOdd ? '#F8FAFC' : '#fff',
                    borderBottom: `1px solid ${BORDER}`, transition: 'background .1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#EFF6FF')}
                  onMouseLeave={e => (e.currentTarget.style.background = isOdd ? '#F8FAFC' : '#fff')}
                >
                  {COLS.map(col => {
                    const field = col.key as ColKey;
                    const isActive = editCell?.id === ligne.id && editCell.field === field;
                    const isNum = col.type === 'number';
                    let rowAlert = '';
                    if (field === 'engageMFCFA' && engageRatio > 1) rowAlert = RED;
                    if (field === 'decaisseMFCFA' && decRatio > 1) rowAlert = RED;
                    return (
                      <td
                        key={field}
                        onClick={() => startEdit(ligne.id, field, String(ligne[field as keyof LigneImputation] ?? ''))}
                        style={{
                          padding: '7px 10px',
                          textAlign: isNum ? 'right' : 'left',
                          cursor: 'cell',
                          borderRight: `1px solid ${BORDER}`,
                          background: isActive ? '#EFF6FF' : rowAlert ? rowAlert + '12' : undefined,
                          verticalAlign: 'middle',
                          maxWidth: col.width,
                          overflow: 'hidden',
                          position: 'relative',
                        }}
                      >
                        <CellEditor id={ligne.id} field={field} col={col} />
                      </td>
                    );
                  })}
                  <td style={{ padding: '4px 6px', textAlign: 'center', borderRight: 'none' }}>
                    <button
                      onClick={() => { if (window.confirm('Supprimer cette ligne ?')) deleteLigne(ligne.id); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CBD5E1',
                        borderRadius: 4, padding: 3, display: 'flex', alignItems: 'center' }}
                      onMouseEnter={e => (e.currentTarget.style.color = RED)}
                      onMouseLeave={e => (e.currentTarget.style.color = '#CBD5E1')}
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: '#0F172A', fontWeight: 800 }}>
              <td colSpan={4} style={{ padding: '9px 10px', color: '#94A3B8', fontSize: 11,
                textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                TOTAL — {filtered.length} ligne{filtered.length !== 1 ? 's' : ''}
              </td>
              <td style={{ padding: '9px 10px', textAlign: 'right', color: '#F8FAFC', fontFamily: 'monospace',
                fontSize: 13, borderLeft: `1px solid rgba(255,255,255,.1)` }}>
                {totals.prevu.toFixed(2)}
              </td>
              <td style={{ padding: '9px 10px', textAlign: 'right', fontFamily: 'monospace', fontSize: 13,
                color: totals.engage > totals.prevu ? RED : '#F8FAFC',
                borderLeft: `1px solid rgba(255,255,255,.1)` }}>
                {totals.engage.toFixed(2)}
              </td>
              <td style={{ padding: '9px 10px', textAlign: 'right', fontFamily: 'monospace', fontSize: 13,
                color: totals.decaisse > totals.prevu ? RED : '#4ADE80',
                borderLeft: `1px solid rgba(255,255,255,.1)` }}>
                {totals.decaisse.toFixed(2)}
              </td>
              <td colSpan={2} style={{ borderLeft: `1px solid rgba(255,255,255,.1)` }} />
              <td />
            </tr>
            <tr style={{ background: '#1E293B' }}>
              <td colSpan={10} style={{ padding: '8px 10px' }}>
                <div style={{ display: 'flex', gap: 24, fontSize: 11, color: '#94A3B8' }}>
                  <span>
                    <span style={{ color: '#F8FAFC', fontWeight: 700 }}>
                      {totals.prevu > 0 ? Math.round((totals.engage / totals.prevu) * 100) : 0}%
                    </span>
                    {' '}taux engagement
                  </span>
                  <span>
                    <span style={{ color: '#4ADE80', fontWeight: 700 }}>
                      {totals.prevu > 0 ? Math.round((totals.decaisse / totals.prevu) * 100) : 0}%
                    </span>
                    {' '}taux décaissement
                  </span>
                  <span>
                    Solde disponible :{' '}
                    <span style={{ color: '#F59E0B', fontWeight: 700 }}>
                      {(totals.prevu - totals.engage).toFixed(2)} M FCFA
                    </span>
                  </span>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
