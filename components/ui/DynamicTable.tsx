/**
 * DynamicTable.tsx — Tableau configurable dynamiquement
 * Permet : ajout/suppression de colonnes, champs personnalisés,
 * filtres, sauvegarde de vues, drag & drop (simplifié).
 */

'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Settings, Plus, X, ArrowUpDown, Search, Download,
  ChevronLeft, ChevronRight, Filter, Eye, EyeOff,
} from 'lucide-react';

export type ColumnType = 'text' | 'number' | 'date' | 'badge' | 'progress' | 'currency' | 'actions';

export interface ColumnDef<T = any> {
  key: string;
  label: string;
  type: ColumnType;
  width?: number;
  sortable?: boolean;
  filterable?: boolean;
  visible?: boolean;
  render?: (row: T, value: any) => React.ReactNode;
}

export interface TableView {
  name: string;
  columns: ColumnDef[];
  filters: Record<string, string>;
  sortKey?: string;
  sortDir?: 'asc' | 'desc';
}

interface DynamicTableProps<T extends Record<string, any>> {
  data: T[];
  baseColumns: ColumnDef<T>[];
  title?: string;
  exportable?: boolean;
  searchable?: boolean;
  pageSize?: number;
  onRowClick?: (row: T) => void;
  onAddRow?: () => void;
  onEditRow?: (row: T) => void;
  onDeleteRow?: (row: T) => void;
}

export default function DynamicTable<T extends Record<string, any>>({
  data,
  baseColumns,
  title,
  exportable = true,
  searchable = true,
  pageSize = 20,
  onRowClick,
  onAddRow,
  onEditRow,
  onDeleteRow,
}: DynamicTableProps<T>) {
  const [columns, setColumns] = useState<ColumnDef<T>[]>(baseColumns.map(c => ({ ...c, visible: c.visible !== false })));
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sortKey, setSortKey] = useState<string | undefined>();
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  const [showConfig, setShowConfig] = useState(false);
  const [views, setViews] = useState<TableView[]>([]);
  const [viewName, setViewName] = useState('');

  const visibleCols = useMemo(() => columns.filter(c => c.visible), [columns]);

  const filtered = useMemo(() => {
    let rows = [...data];
    // Global search
    if (search.trim()) {
      const s = search.toLowerCase();
      rows = rows.filter(r =>
        visibleCols.some(c => {
          const v = r[c.key];
          return v != null && String(v).toLowerCase().includes(s);
        })
      );
    }
    // Per-column filters
    Object.entries(filters).forEach(([key, val]) => {
      if (val) {
        rows = rows.filter(r => {
          const v = r[key];
          return v != null && String(v).toLowerCase().includes(val.toLowerCase());
        });
      }
    });
    // Sort
    if (sortKey) {
      rows.sort((a, b) => {
        const av = a[sortKey], bv = b[sortKey];
        if (av == null) return sortDir === 'asc' ? -1 : 1;
        if (bv == null) return sortDir === 'asc' ? 1 : -1;
        if (typeof av === 'number' && typeof bv === 'number') {
          return sortDir === 'asc' ? av - bv : bv - av;
        }
        return sortDir === 'asc'
          ? String(av).localeCompare(String(bv))
          : String(bv).localeCompare(String(av));
      });
    }
    return rows;
  }, [data, search, filters, sortKey, sortDir, visibleCols]);

  const paged = useMemo(() => {
    const start = page * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  const toggleSort = useCallback((key: string) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }, [sortKey]);

  const toggleColumn = useCallback((key: string) => {
    setColumns(prev => prev.map(c => c.key === key ? { ...c, visible: !c.visible } : c));
  }, []);

  const addCustomColumn = useCallback(() => {
    const key = `custom_${Date.now()}`;
    setColumns(prev => [...prev, { key, label: 'Nouveau champ', type: 'text', visible: true }]);
  }, []);

  const saveView = useCallback(() => {
    if (!viewName.trim()) return;
    const view: TableView = { name: viewName, columns: [...columns], filters: { ...filters }, sortKey, sortDir };
    setViews(prev => [...prev.filter(v => v.name !== viewName), view]);
    setViewName('');
  }, [viewName, columns, filters, sortKey, sortDir]);

  const loadView = useCallback((view: TableView) => {
    setColumns(view.columns.map(c => ({ ...c })));
    setFilters(view.filters);
    setSortKey(view.sortKey);
    setSortDir(view.sortDir ?? 'asc');
  }, []);

  const exportCSV = useCallback(() => {
    const headers = visibleCols.map(c => c.label).join(';');
    const rows = filtered.map(r => visibleCols.map(c => `"${String(r[c.key] ?? '')}"`).join(';')).join('\n');
    const blob = new Blob([headers + '\n' + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'export'}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filtered, visibleCols, title]);

  return (
    <div className="data-table-wrap" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <div className="tbl-toolbar" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {title && <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</span>}
          {searchable && (
            <div className="filter-search">
              <Search size={12} />
              <input
                placeholder="Rechercher..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(0); }}
              />
            </div>
          )}
          {onAddRow && (
            <button className="btn btn-primary btn-sm" onClick={onAddRow}>
              <Plus size={12} /> Ajouter
            </button>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {exportable && (
            <button className="btn btn-secondary btn-sm" onClick={exportCSV} title="Exporter CSV">
              <Download size={12} />
            </button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={() => setShowConfig(v => !v)} title="Configurer colonnes">
            <Settings size={12} />
          </button>
        </div>
      </div>

      {/* Config panel */}
      {showConfig && (
        <div style={{ padding: 12, borderBottom: '1px solid var(--border)', background: 'var(--bg-stripe)' }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Colonnes visibles</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {columns.map(c => (
                  <button
                    key={c.key}
                    onClick={() => toggleColumn(c.key)}
                    className={`badge ${c.visible ? 'badge-primary' : 'badge-neutral'}`}
                    style={{ cursor: 'pointer', fontSize: 10 }}
                  >
                    {c.visible ? <Eye size={10} /> : <EyeOff size={10} />}
                    {c.label}
                  </button>
                ))}
              </div>
              <button className="btn btn-ghost btn-xs" onClick={addCustomColumn} style={{ alignSelf: 'flex-start' }}>
                <Plus size={10} /> Ajouter colonne
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 160 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Vues sauvegardées</span>
              {views.map(v => (
                <button key={v.name} className="btn btn-ghost btn-xs" onClick={() => loadView(v)} style={{ justifyContent: 'flex-start' }}>
                  {v.name}
                </button>
              ))}
              <div style={{ display: 'flex', gap: 4 }}>
                <input
                  className="form-input"
                  style={{ fontSize: 11, padding: '4px 8px', width: 100 }}
                  placeholder="Nom vue..."
                  value={viewName}
                  onChange={e => setViewName(e.target.value)}
                />
                <button className="btn btn-primary btn-xs" onClick={saveView}>Sauver</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="table-responsive">
        <table className="tbl">
          <thead>
            <tr>
              {visibleCols.map(c => (
                <th key={c.key} style={{ width: c.width, whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {c.label}
                    {c.sortable !== false && (
                      <button onClick={() => toggleSort(c.key)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-muted)' }}>
                        <ArrowUpDown size={11} />
                      </button>
                    )}
                  </div>
                  {c.filterable !== false && (
                    <input
                      className="form-input"
                      style={{ marginTop: 4, fontSize: 10, padding: '3px 6px', width: '100%', minWidth: 60 }}
                      placeholder="Filtrer..."
                      value={filters[c.key] || ''}
                      onChange={e => { setFilters(f => ({ ...f, [c.key]: e.target.value })); setPage(0); }}
                    />
                  )}
                </th>
              ))}
              {(onEditRow || onDeleteRow) && <th style={{ width: 80 }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr><td colSpan={visibleCols.length + 1} className="tbl-empty">Aucune donnée</td></tr>
            ) : paged.map((row, i) => (
              <tr
                key={i}
                onClick={() => onRowClick?.(row)}
                style={{ cursor: onRowClick ? 'pointer' : undefined }}
              >
                {visibleCols.map(c => {
                  const val = row[c.key];
                  const rendered = c.render ? c.render(row, val) : null;
                  return (
                    <td key={c.key} title={String(val ?? '')}>
                      {rendered ?? renderValue(val, c.type)}
                    </td>
                  );
                })}
                {(onEditRow || onDeleteRow) && (
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {onEditRow && (
                        <button className="btn btn-ghost btn-xs" onClick={e => { e.stopPropagation(); onEditRow(row); }}>Modifier</button>
                      )}
                      {onDeleteRow && (
                        <button className="btn btn-danger btn-xs" onClick={e => { e.stopPropagation(); onDeleteRow(row); }}>Supprimer</button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)' }}>
        <span>{filtered.length} résultat{filtered.length > 1 ? 's' : ''}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button className="btn btn-ghost btn-xs" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft size={12} />
          </button>
          <span>Page {page + 1} / {totalPages}</span>
          <button className="btn btn-ghost btn-xs" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
            <ChevronRight size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

function renderValue(value: any, type: ColumnType): React.ReactNode {
  if (value == null) return <span style={{ color: 'var(--text-placeholder)' }}>—</span>;
  switch (type) {
    case 'currency':
      return <span>{Number(value).toLocaleString('fr-FR')} FCFA</span>;
    case 'progress':
      return (
        <div className="progress-bar" style={{ width: 80 }}>
          <div className="progress-fill" style={{ width: `${Math.min(100, Number(value))}%` }} />
        </div>
      );
    case 'badge':
      return <span className={`badge badge-${value}`}>{value}</span>;
    case 'date':
      return <span>{new Date(value).toLocaleDateString('fr-FR')}</span>;
    case 'number':
      return <span style={{ textAlign: 'right', display: 'block' }}>{Number(value).toLocaleString('fr-FR')}</span>;
    default:
      return <span>{String(value)}</span>;
  }
}
