'use client';

/**
 * CalculBuilder.tsx — Importer des données + définir une formule de calcul.
 * L'admin colle/importe un tableau (CSV/TSV), nomme une colonne résultat et
 * saisit une formule référençant les colonnes par [NomColonne]. Aperçu en direct.
 * Évaluation SÉCURISÉE : après substitution des valeurs, seuls chiffres et
 * opérateurs arithmétiques sont autorisés (aucun code JS arbitraire).
 */
import { useMemo, useState } from 'react';
import { FunctionSquare, Calculator, Upload, Download } from 'lucide-react';
import { downloadCSV } from '@/lib/exportUtils';
import toast from 'react-hot-toast';

function parseTable(raw: string): { headers: string[]; rows: string[][] } {
  const lines = raw.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return { headers: [], rows: [] };
  const sep = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
  const split = (l: string) => l.split(sep).map(c => c.trim());
  return { headers: split(lines[0]), rows: lines.slice(1).map(split) };
}

/** Évalue une formule arithmétique après substitution — refuse tout caractère suspect. */
function evalFormula(expr: string): number | null {
  const cleaned = expr.replace(/\s+/g, '');
  if (!cleaned) return null;
  // n'autorise que chiffres, . , + - * / ( ) et l'opérateur %
  if (!/^[0-9.+\-*/()%,]+$/.test(cleaned)) return null;
  try {
    // eslint-disable-next-line no-new-func
    const v = Function(`"use strict";return (${cleaned.replace(/,/g, '.')})`)();
    return typeof v === 'number' && isFinite(v) ? v : null;
  } catch { return null; }
}

export default function CalculBuilder() {
  const [raw, setRaw] = useState('Projet,Budget,Avancement\nPRJ-001,365,98\nPRJ-002,667,76\nPRJ-003,813,95');
  const [resultCol, setResultCol] = useState('Décaissé estimé');
  const [formula, setFormula] = useState('[Budget] * [Avancement] / 100');

  const { headers, rows } = useMemo(() => parseTable(raw), [raw]);

  const computed = useMemo(() => {
    return rows.map(r => {
      let expr = formula;
      headers.forEach((h, i) => {
        const val = (r[i] ?? '').replace(/\s/g, '').replace(',', '.');
        const num = parseFloat(val);
        expr = expr.split(`[${h}]`).join(isFinite(num) ? String(num) : '0');
      });
      const res = evalFormula(expr);
      return res === null ? '—' : Math.round(res * 100) / 100;
    });
  }, [rows, headers, formula]);

  const onFile = async (f: File | null) => {
    if (!f) return;
    const text = await f.text();
    setRaw(text.trim());
    toast.success('Données importées');
  };

  const exporter = () => {
    downloadCSV('calcul_resultat', [...headers, resultCol], rows.map((r, i) => [...r, String(computed[i])]));
  };

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header">
        <div>
          <span className="card-title"><FunctionSquare size={14} /> Importer des données & définir une formule</span>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Collez/importez un tableau, référencez les colonnes par <code>[NomColonne]</code>, l'aperçu se calcule en direct.</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
            <Upload size={13} /> Importer CSV
            <input type="file" accept=".csv,.tsv,.txt" style={{ display: 'none' }} onChange={e => onFile(e.target.files?.[0] ?? null)} />
          </label>
          <button className="btn btn-secondary btn-sm" onClick={exporter} disabled={!rows.length}><Download size={13} /> Exporter</button>
        </div>
      </div>
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={lbl}>Données (CSV / TSV — 1re ligne = entêtes)</label>
            <textarea value={raw} onChange={e => setRaw(e.target.value)} rows={6}
              style={{ width: '100%', padding: 8, borderRadius: 8, border: '1.5px solid #CBD5E1', fontSize: 12, fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box' }} />
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Colonnes détectées : {headers.map(h => `[${h}]`).join(' ') || '—'}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={lbl}>Nom de la colonne résultat</label>
              <input value={resultCol} onChange={e => setResultCol(e.target.value)} className="form-input" style={{ width: '100%' }} />
            </div>
            <div>
              <label style={lbl}>Formule</label>
              <input value={formula} onChange={e => setFormula(e.target.value)} className="form-input" style={{ width: '100%', fontFamily: 'monospace' }} placeholder="[Budget] * [Avancement] / 100" />
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Opérateurs : + − × (*) ÷ (/) ( ). Ex : <code>([A] + [B]) / 2</code></div>
            </div>
            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '8px 10px', fontSize: 12, color: '#15803D', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Calculator size={14} /> {computed.filter(c => c !== '—').length}/{rows.length} ligne(s) calculée(s)
            </div>
          </div>
        </div>

        {/* Aperçu */}
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead><tr>{headers.map(h => <th key={h}>{h}</th>)}<th style={{ background: '#15803D' }}>{resultCol}</th></tr></thead>
            <tbody>
              {rows.slice(0, 30).map((r, i) => (
                <tr key={i}>
                  {headers.map((_, ci) => <td key={ci}>{r[ci] ?? ''}</td>)}
                  <td style={{ fontWeight: 700, color: computed[i] === '—' ? '#EF4444' : '#15803D' }}>{computed[i]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 30 && <div style={{ fontSize: 11, color: 'var(--muted)', padding: 6 }}>… {rows.length - 30} ligne(s) supplémentaire(s)</div>}
        </div>
      </div>
    </div>
  );
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 10.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 4 };
