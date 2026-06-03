'use client';

/**
 * SearchableSelect — liste déroulante AVEC recherche (option « recherche partout »).
 * Remplace n'importe quel <select> : tape pour filtrer, clavier ↑/↓/Entrée/Échap,
 * fermeture au clic extérieur. Styles inline (cohérent avec le reste de l'app).
 *
 * Usage simple :
 *   <SearchableSelect value={v} onChange={setV} options={['A','B','C']} />
 * Usage objet :
 *   <SearchableSelect value={id} onChange={setId}
 *     options={users.map(u => ({ value: u.email, label: `${u.prenom} ${u.nom}`, sub: u.poste }))} />
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';

export interface SSOption {
  value: string;
  label: string;
  sub?: string;       // ligne secondaire (e-mail, poste…)
  keywords?: string;  // texte additionnel inclus dans la recherche
}

type RawOption = string | SSOption;

function norm(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'Sélectionner…',
  searchPlaceholder = 'Rechercher…',
  disabled = false,
  style,
  allowEmpty = false,
}: {
  value: string;
  onChange: (v: string) => void;
  options: RawOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
  allowEmpty?: boolean;
}) {
  const opts: SSOption[] = useMemo(
    () => options.map(o => (typeof o === 'string' ? { value: o, label: o } : o)),
    [options],
  );
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hi, setHi] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selected = opts.find(o => o.value === value);

  const filtered = useMemo(() => {
    const nq = norm(q.trim());
    if (!nq) return opts;
    return opts.filter(o => norm(`${o.label} ${o.sub ?? ''} ${o.keywords ?? ''} ${o.value}`).includes(nq));
  }, [opts, q]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    setTimeout(() => inputRef.current?.focus(), 30);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => setHi(0), [q]);

  const pick = (v: string) => { onChange(v); setOpen(false); setQ(''); };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(h + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[hi]) pick(filtered[hi].value); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  const base: React.CSSProperties = {
    width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #E2E8F0',
    fontSize: 12.5, fontFamily: 'inherit', boxSizing: 'border-box', background: '#fff',
    display: 'flex', alignItems: 'center', gap: 6, cursor: disabled ? 'not-allowed' : 'pointer',
    color: selected ? '#1E293B' : '#94A3B8', textAlign: 'left',
    opacity: disabled ? 0.6 : 1, ...style,
  };

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button type="button" disabled={disabled} style={base}
        onClick={() => !disabled && setOpen(o => !o)}>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={14} style={{ color: '#94A3B8', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 60,
          background: '#fff', border: '1px solid #E2E8F0', borderRadius: 9,
          boxShadow: '0 12px 32px rgba(15,23,42,0.16)', overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderBottom: '1px solid #F1F5F9' }}>
            <Search size={13} style={{ color: '#94A3B8', flexShrink: 0 }} />
            <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} onKeyDown={onKey}
              placeholder={searchPlaceholder}
              style={{ flex: 1, border: 'none', outline: 'none', fontSize: 12.5, fontFamily: 'inherit', background: 'transparent' }} />
          </div>
          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            {allowEmpty && (
              <Row label={placeholder} active={!value} hi={false} onClick={() => pick('')} muted />
            )}
            {filtered.length === 0 ? (
              <div style={{ padding: '12px 12px', fontSize: 12, color: '#94A3B8', textAlign: 'center' }}>Aucun résultat.</div>
            ) : filtered.map((o, i) => (
              <Row key={o.value + i} label={o.label} sub={o.sub} active={o.value === value} hi={i === hi}
                onMouseEnter={() => setHi(i)} onClick={() => pick(o.value)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, sub, active, hi, onClick, onMouseEnter, muted }: {
  label: string; sub?: string; active: boolean; hi: boolean;
  onClick: () => void; onMouseEnter?: () => void; muted?: boolean;
}) {
  return (
    <div onMouseDown={e => e.preventDefault()} onClick={onClick} onMouseEnter={onMouseEnter}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer',
        background: hi ? '#EFF6FF' : active ? '#F8FAFF' : 'transparent',
        borderBottom: '1px solid #F8FAFC',
      }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: active ? 700 : 500, color: muted ? '#94A3B8' : '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
        {sub && <div style={{ fontSize: 10.5, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>}
      </div>
      {active && <Check size={13} style={{ color: '#1B4F8A', flexShrink: 0 }} />}
    </div>
  );
}
