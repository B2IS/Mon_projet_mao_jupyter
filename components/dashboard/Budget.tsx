'use client';

import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
  ComposedChart, ReferenceLine,
} from 'recharts';
import { Download, ChevronUp, ChevronDown as ChevronDownIcon } from 'lucide-react';
import IndicatorWidget from '@/components/dashboard/IndicatorWidget';
import { useProjectStore, DOMAINE_CFG, useScopeDomaines } from '@/lib/projectStore';
import { downloadExcel } from '@/lib/exportUtils';
import { SENELEC_LOGO_DATA_URI } from '@/lib/senelecLogo';

/* ─── PDF Export ────────────────────────────────────────────────────────────── */
function handleExportPDF(title: string, rows: ProjectRow[], year: string) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  const rowsHtml = rows.map(p => `
    <tr>
      <td>${p.code}</td><td>${p.nom}</td><td>${p.domain}</td>
      <td style="text-align:right">${p.prevu.toFixed(1)}</td>
      <td style="text-align:right">${p.marches.toFixed(1)}</td>
      <td style="text-align:right">${p.decaisse.toFixed(1)}</td>
      <td style="text-align:right">${p.prevu > 0 ? Math.round((p.decaisse/p.prevu)*100) : 0}%</td>
      <td>${p.statut}</td>
    </tr>`).join('');
  const total = rows.reduce((s, p) => s + p.prevu, 0).toFixed(1);
  const totalDec = rows.reduce((s, p) => s + p.decaisse, 0).toFixed(1);
  const barSvg = rows.map((p, i) => {
    const y = i * 20 + 5;
    const ratio = p.prevu > 0 ? p.decaisse / p.prevu : 0;
    const w = Math.min(ratio * 200, 200);
    return `<rect x="80" y="${y}" width="200" height="6" fill="#F1F5F9" rx="3"/>
            <rect x="80" y="${y}" width="${w}" height="6" fill="${ratio>=0.8?'#16A34A':ratio>=0.5?'#F59E0B':'#EF4444'}" rx="3"/>
            <text x="75" y="${y+5}" font-size="8" fill="#64748B" text-anchor="end">${p.code}</text>
            <text x="${80+w+4}" y="${y+5}" font-size="8" fill="#64748B" font-weight="700">${Math.round(ratio*100)}%</text>`;
  }).join('');
  const domainTotals: Record<string, number> = {};
  rows.forEach(p => { domainTotals[p.domain] = (domainTotals[p.domain] || 0) + p.prevu; });
  const domTotal = Object.values(domainTotals).reduce((a, b) => a + b, 0);
  const domColors: Record<string, string> = { Production: '#1B4F8A', Transport: '#F47920', Distribution: '#16A34A', Commercial: '#7C3AED', 'Génie Civil': '#B45309' };
  let angle = 0;
  const cx = 100, cy = 80, r = 55, r2 = 35;
  const donutSlices = Object.entries(domainTotals).map(([d, v]) => {
    const pct = v / domTotal;
    const a = pct * 360;
    const start = angle * Math.PI / 180;
    const end = (angle + a) * Math.PI / 180;
    const large = a > 180 ? 1 : 0;
    const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end);
    const x3 = cx + r2 * Math.cos(end), y3 = cy + r2 * Math.sin(end);
    const x4 = cx + r2 * Math.cos(start), y4 = cy + r2 * Math.sin(start);
    const path = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${r2} ${r2} 0 ${large} 0 ${x4} ${y4} Z`;
    angle += a;
    return `<path d="${path}" fill="${domColors[d] || '#94A3B8'}" stroke="#fff" stroke-width="2"/>`;
  }).join('');
  const donutLegend = Object.entries(domainTotals).map(([d, v], i) => {
    const y = 150 + i * 12;
    return `<rect x="10" y="${y-6}" width="8" height="8" fill="${domColors[d] || '#94A3B8'}" rx="2"/>
            <text x="22" y="${y}" font-size="7" fill="#64748B">${d} — ${domTotal > 0 ? ((v/domTotal)*100).toFixed(1) : 0}%</text>`;
  }).join('');
  printWindow.document.write(`
    <!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>${title}</title><style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
      body{font-family:'Inter',Arial,sans-serif;padding:32px 40px;color:#1E293B;font-size:11px}
      .bar{height:4px;background:#F47920;border-radius:2px;margin-bottom:20px}
      h1{font-size:18px;font-weight:800;color:#0F172A;margin:0 0 4px}
      .meta{font-size:9px;color:#64748B;margin-bottom:20px}
      table{width:100%;border-collapse:separate;border-spacing:0;font-size:9px;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);margin:14px 0 20px}
      th{background:#0F172A;color:#fff;padding:8px 10px;text-align:left;font-size:8px;text-transform:uppercase;letter-spacing:0.06em;font-weight:600}
      td{border-bottom:1px solid #F1F5F9;padding:7px 10px}
      tr:nth-child(even) td{background:#F8FAFC}
      tfoot tr td{background:#EFF6FF!important;font-weight:700;border-top:2px solid #BFDBFE}
      .footer{margin-top:32px;padding-top:12px;border-top:1px solid #E2E8F0;font-size:8px;color:#94A3B8;text-align:center}
      .chart-box{background:#F8FAFC;border-radius:10px;padding:14px 16px;border:1px solid #E2E8F0;margin-bottom:16px}
      .chart-title{font-size:10px;font-weight:700;color:#64748B;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.06em}
    </style></head><body>
      <div class="bar"></div>
      <div style="margin-bottom:12px"><img src="${SENELEC_LOGO_DATA_URI}" alt="SENELEC" style="height:44px;width:auto;display:block" /></div>
      <h1>${title}</h1>
      <div class="meta">Exercice ${year} · Généré le ${new Date().toLocaleDateString('fr-FR')} · ${rows.length} projets</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:16px 0">
        <div class="chart-box">
          <div class="chart-title">Taux de décaissement par projet</div>
          <svg width="100%" height="${Math.max(140, rows.length * 20)}" viewBox="0 0 320 ${rows.length * 20}" style="display:block">${barSvg}</svg>
        </div>
        <div class="chart-box">
          <div class="chart-title">Répartition budget par domaine</div>
          <svg width="100%" height="180" viewBox="0 0 200 180" style="display:block;margin:0 auto">
            ${donutSlices}${donutLegend}
          </svg>
        </div>
      </div>
      <table>
        <thead><tr><th>Code</th><th>Projet</th><th>Domaine</th><th style="text-align:right">Budget prévu (M)</th><th style="text-align:right">Marchés (M)</th><th style="text-align:right">Décaissé (M)</th><th style="text-align:right">%</th><th>Statut</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot><tr><td colspan="3">TOTAL (${rows.length} projets)</td><td style="text-align:right">${total}</td><td></td><td style="text-align:right">${totalDec}</td><td></td><td></td></tr></tfoot>
      </table>
      <div class="footer">CONFIDENTIEL — Usage interne SENELEC · Document généré par SIGEP-DPE</div>
    </body></html>
  `);
  printWindow.document.close();
  printWindow.print();
}

/* ─── Brand tokens ──────────────────────────────────────────────────────────── */
const NAVY    = '#1B4F8A';
const ORANGE  = '#F47920';
const RED     = '#EF3340';
const GREEN   = '#16A34A';
const AMBER   = '#D97706';
const NAVY2   = '#2563EB';
const PURPLE  = '#7C3AED';

/* ─── Types ─────────────────────────────────────────────────────────────────── */
type YearOption   = '2024' | '2025' | '2026';
type DomainFilter = 'Tous' | 'Production' | 'Transport' | 'Distribution' | 'Commercial' | 'Génie Civil';
type SortDir      = 'asc' | 'desc';

interface ProjectRow {
  code:     string;
  nom:      string;
  domain:   DomainFilter;
  prevu:    number;
  marches:  number;
  decaisse: number;
  statut:   'On Track' | 'Attention' | 'Critique' | 'Achevé';
}

interface QuarterData {
  quarter:      string;
  Production:   number;
  Transport:    number;
  Distribution: number;
  Commercial:   number;
  cumul:        number;
}

interface WaterfallItem {
  name:    string;
  value:   number;
  isTotal: boolean;
  color:   string;
  base:    number;
}

interface CategoryBudget {
  cat:          string;
  Production:   number;
  Transport:    number;
  Distribution: number;
  Commercial:   number;
}

type SortKey = keyof ProjectRow;

/* ─── Domain colors ──────────────────────────────────────────────────────────── */
const DOMAIN_COLORS: Record<string, string> = {
  Production: NAVY, Transport: ORANGE, Distribution: GREEN, Commercial: PURPLE, 'Génie Civil': '#B45309',
};


const PHASE_TO_CAT: Record<string, string> = {
  passations: 'Services',
  etudes: 'Études',
  fournitures: 'Équipements',
  travaux: 'Travaux',
  mise_en_service: 'Services',
  cloture: 'Divers',
};

/* ─── Helpers ───────────────────────────────────────────────────────────────── */
function pct(a: number, b: number): number { return b > 0 ? Math.round((a / b) * 100) : 0; }

function decaisseColor(ratio: number): string {
  if (ratio >= 0.8) return GREEN;
  if (ratio >= 0.5) return AMBER;
  return RED;
}

function statutColor(s: ProjectRow['statut']): string {
  if (s === 'On Track') return GREEN;
  if (s === 'Attention') return AMBER;
  if (s === 'Critique')  return RED;
  return NAVY2;
}

/* ─── Custom Tooltips ───────────────────────────────────────────────────────── */
interface TTPProps {
  active?: boolean;
  payload?: Array<{ color: string; name: string; value: number }>;
  label?: string;
}

function QuarterTooltip({ active, payload, label }: TTPProps) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + (p.value ?? 0), 0);
  return (
    <div style={{ background: '#fff', border: `1px solid ${NAVY}22`, borderRadius: 10, padding: '12px 16px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,.10)' }}>
      <div style={{ fontWeight: 800, color: NAVY, marginBottom: 8 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: <b>{p.value?.toFixed(1)} MFCFA</b>
        </div>
      ))}
      <div style={{ borderTop: `1px solid #F1F5F9`, marginTop: 6, paddingTop: 6, fontWeight: 700, color: NAVY }}>
        Total T: {total.toFixed(1)} MFCFA
      </div>
    </div>
  );
}

function WFTooltip({ active, payload, label }: TTPProps) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: `1px solid ${NAVY}22`, borderRadius: 10, padding: '10px 14px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,.10)' }}>
      <div style={{ fontWeight: 700, color: NAVY, marginBottom: 4 }}>{label}</div>
      <div style={{ fontWeight: 800, fontSize: 14 }}>{payload[0]?.value?.toFixed(1)} MFCFA</div>
    </div>
  );
}

function PieTT({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { color: string; raw?: number } }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div style={{ background: '#fff', border: `1px solid ${NAVY}22`, borderRadius: 8, padding: '8px 12px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,.10)' }}>
      <b style={{ color: d.payload.color }}>{d.name}</b>: {d.value}%{d.payload.raw != null ? ` — ${d.payload.raw.toFixed(1)} Mrd` : ''}
    </div>
  );
}

/* ─── KPI Card ──────────────────────────────────────────────────────────────── */
interface KPICardProps {
  label: string;
  value: string;
  sub?: string;
  progress?: number;
  progressColor?: string;
  accent?: string;
  badge?: string;
  badgeColor?: string;
}

function KPICard({ label, value, sub, progress, progressColor = ORANGE, accent = NAVY, badge, badgeColor }: KPICardProps) {
  return (
    <div style={{
      background: '#fff', borderRadius: 10, border: '1px solid #E2E8F0',
      borderLeft: `4px solid ${accent}`, padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 5,
      boxShadow: '0 1px 4px rgba(0,0,0,.06)',
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {label}
        {badge && (
          <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: (badgeColor ?? NAVY) + '18', color: badgeColor ?? NAVY, fontWeight: 800 }}>
            {badge}
          </span>
        )}
      </div>
      <div style={{ fontSize: 'clamp(13px, 3.5vw, 22px)', fontWeight: 800, color: accent, lineHeight: 1.2, wordBreak: 'break-word' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#94A3B8' }}>{sub}</div>}
      {progress !== undefined && (
        <div style={{ height: 5, background: '#F1F5F9', borderRadius: 3, marginTop: 4 }}>
          <div style={{ height: 5, width: `${progress}%`, background: progressColor, borderRadius: 3, transition: 'width .4s' }} />
        </div>
      )}
    </div>
  );
}

/* ─── Card + SectionHeader ──────────────────────────────────────────────────── */
function Card({ children, style, title, subtitle }: { children: React.ReactNode; style?: React.CSSProperties; title?: string; subtitle?: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E2E8F0', padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,.06)', ...style }}>
      {(title || subtitle) && (
        <div style={{ marginBottom: 12 }}>
          {title && <div style={{ fontSize: 13, fontWeight: 800, color: NAVY }}>{title}</div>}
          {subtitle && <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>{subtitle}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

function SH({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{title}</div>
      {right}
    </div>
  );
}

/* Map domain label → DomainFilter type */
const DOMAIN_MAP: Record<string, DomainFilter> = {
  production: 'Production', transport: 'Transport', distribution: 'Distribution', commercial: 'Commercial', genie_civil: 'Génie Civil',
};

/* ─── PrevisionsTab ─────────────────────────────────────────────────────────── */
const PERIODES: Record<string, string[]> = {
  mensuel:     ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'],
  trimestriel: ['T1','T2','T3','T4'],
  semestriel:  ['S1','S2'],
  annuel:      ['Annuel'],
};

interface PrevisionsTabProps {
  prevPeriod:    'mensuel' | 'trimestriel' | 'semestriel' | 'annuel';
  setPrevPeriod: (p: 'mensuel' | 'trimestriel' | 'semestriel' | 'annuel') => void;
  prevData:      Record<string, Record<string, number>>;
  setPrevData:   React.Dispatch<React.SetStateAction<Record<string, Record<string, number>>>>;
  year:          string;
  domainFilter:  DomainFilter;
  storeProjects: ProjectRow[];
}

function PrevisionsTab({ prevPeriod, setPrevPeriod, prevData, setPrevData, year, domainFilter, storeProjects }: PrevisionsTabProps) {
  const cols     = PERIODES[prevPeriod];
  const projList = storeProjects.filter(p => domainFilter === 'Tous' || p.domain === domainFilter);

  const getPrev = (code: string, col: string) => prevData[code]?.[col] ?? 0;
  const setPrev = (code: string, col: string, val: number) =>
    setPrevData(prev => ({ ...prev, [code]: { ...(prev[code] ?? {}), [col]: isNaN(val) ? 0 : val } }));
  const getRealise = (p: ProjectRow, col: string) => {
    const share = (cols.indexOf(col) + 1) / cols.length;
    return +(p.decaisse * (share / cols.length) * 4).toFixed(2);
  };

  const colTotauxPrev  = cols.map(col => projList.reduce((s, p) => s + getPrev(p.code, col), 0));
  const colTotauxReal  = cols.map(col => projList.reduce((s, p) => s + getRealise(p, col), 0));
  const grandTotalPrev = colTotauxPrev.reduce((s, v) => s + v, 0);
  const grandTotalReal = colTotauxReal.reduce((s, v) => s + v, 0);

  const exportCSV = () => {
    const rows = ['Projet,Domaine,' + cols.map(c => `Prévu ${c},Réalisé ${c}`).join(',')];
    projList.forEach(p => rows.push(`${p.nom},${p.domain},` + cols.map(c => `${getPrev(p.code,c).toFixed(1)},${getRealise(p,c).toFixed(1)}`).join(',')));
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `previsions-${prevPeriod}-${year}.csv`;
    a.click();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="Total prévu"       value={`${grandTotalPrev.toFixed(1)} Mrd`} accent={NAVY}  badge={year} badgeColor={NAVY} />
        <KPICard label="Total réalisé"     value={`${grandTotalReal.toFixed(1)} Mrd`} accent={GREEN} badge={`${grandTotalPrev > 0 ? Math.round((grandTotalReal/grandTotalPrev)*100) : 0}%`} badgeColor={GREEN} progress={grandTotalPrev > 0 ? Math.round((grandTotalReal/grandTotalPrev)*100) : 0} progressColor={GREEN} />
        <KPICard label="Écart"             value={`${(grandTotalReal - grandTotalPrev).toFixed(1)} Mrd`} accent={grandTotalReal >= grandTotalPrev ? GREEN : AMBER} sub="Réalisé − Prévu" />
        <KPICard label="Projets planifiés" value={`${projList.filter(p => cols.some(c => getPrev(p.code, c) > 0)).length} / ${projList.length}`} accent={ORANGE} sub="avec prévisions saisies" />
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#64748B' }}>Période :</span>
        {(['mensuel','trimestriel','semestriel','annuel'] as const).map(p => (
          <button key={p} onClick={() => setPrevPeriod(p)} style={{
            padding: '6px 14px', fontSize: 12, fontWeight: 700, borderRadius: 7, cursor: 'pointer',
            border: `1px solid ${prevPeriod === p ? NAVY : '#CBD5E1'}`,
            background: prevPeriod === p ? NAVY : '#fff',
            color: prevPeriod === p ? '#fff' : '#64748B',
          }}>{p.charAt(0).toUpperCase() + p.slice(1)}</button>
        ))}
        <button onClick={exportCSV} style={{
          marginLeft: 'auto', padding: '6px 14px', fontSize: 11, fontWeight: 700,
          border: `1px solid ${NAVY}30`, borderRadius: 7, background: '#fff',
          color: NAVY, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
        }}><Download size={13} /> Export CSV</button>
      </div>

      <Card style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 600 }}>
          <thead>
            <tr style={{ background: NAVY, color: '#fff' }}>
              <th style={{ padding: '10px 12px', textAlign: 'left', position: 'sticky', left: 0, background: NAVY, zIndex: 1, minWidth: 180 }}>Projet</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', minWidth: 100 }}>Domaine</th>
              {cols.map(col => (
                <th key={col} colSpan={2} style={{ padding: '10px 12px', textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,.15)' }}>{col}</th>
              ))}
            </tr>
            <tr style={{ background: NAVY + 'DD', color: '#CBD5E1', fontSize: 10 }}>
              <th style={{ padding: '6px 12px', position: 'sticky', left: 0, background: NAVY + 'DD', zIndex: 1 }} />
              <th />
              {cols.map(col => [
                <th key={col+'p'} style={{ padding: '6px 8px', textAlign: 'right', borderLeft: '1px solid rgba(255,255,255,.1)', fontWeight: 600 }}>Prévu</th>,
                <th key={col+'r'} style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>Réalisé</th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {projList.length === 0 && (
              <tr><td colSpan={2 + cols.length * 2} style={{ padding: 24, textAlign: 'center', color: '#94A3B8' }}>Aucun projet dans ce périmètre</td></tr>
            )}
            {projList.map((p, idx) => (
              <tr key={`${p.code}-${idx}`} style={{ background: idx % 2 === 0 ? '#F8FAFC' : '#fff', borderBottom: '1px solid #E2E8F0' }}>
                <td style={{ padding: '8px 12px', fontWeight: 700, color: NAVY, position: 'sticky', left: 0, background: idx % 2 === 0 ? '#F8FAFC' : '#fff', zIndex: 1 }}>
                  <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 400 }}>{p.code}</div>
                  <div style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nom}</div>
                </td>
                <td style={{ padding: '8px 12px', color: DOMAIN_COLORS[p.domain] ?? NAVY, fontWeight: 600, fontSize: 11 }}>{p.domain}</td>
                {cols.map(col => {
                  const prev  = getPrev(p.code, col);
                  const real  = getRealise(p, col);
                  const ecart = real - prev;
                  return [
                    <td key={col+'p'} style={{ padding: '6px 8px', borderLeft: '1px solid #E2E8F0' }}>
                      <input type="number" value={prev === 0 ? '' : prev} placeholder="0"
                        onChange={e => setPrev(p.code, col, parseFloat(e.target.value))}
                        style={{ width: 70, fontSize: 12, textAlign: 'right', border: '1px solid #E2E8F0',
                          borderRadius: 5, padding: '3px 6px', background: '#fff', color: NAVY, fontWeight: 600, outline: 'none' }}
                      />
                    </td>,
                    <td key={col+'r'} style={{ padding: '6px 8px', textAlign: 'right' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: real > 0 ? GREEN : '#CBD5E1' }}>{real > 0 ? real.toFixed(1) : '—'}</div>
                      {prev > 0 && real > 0 && (
                        <div style={{ fontSize: 9, color: ecart >= 0 ? GREEN : RED, fontWeight: 600 }}>{ecart >= 0 ? '+' : ''}{ecart.toFixed(1)}</div>
                      )}
                    </td>,
                  ];
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: NAVY + '10', borderTop: `2px solid ${NAVY}30`, fontWeight: 800 }}>
              <td colSpan={2} style={{ padding: '10px 12px', color: NAVY, fontSize: 12 }}>TOTAL ({projList.length} projets)</td>
              {cols.map((col, i) => [
                <td key={col+'p'} style={{ padding: '10px 8px', textAlign: 'right', borderLeft: '1px solid #E2E8F0', color: NAVY, fontWeight: 800 }}>{colTotauxPrev[i].toFixed(1)}</td>,
                <td key={col+'r'} style={{ padding: '10px 8px', textAlign: 'right', color: GREEN, fontWeight: 800 }}>{colTotauxReal[i].toFixed(1)}</td>,
              ])}
            </tr>
          </tfoot>
        </table>
      </Card>

      <div style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center' }}>
        Saisir les montants en Milliards FCFA (Mrd) · Les valeurs réalisées sont calculées à partir des décaissements enregistrés dans les projets
      </div>
    </div>
  );
}

/* ─── Main Component ────────────────────────────────────────────────────────── */
export default function Budget() {
  const store = useProjectStore();

  // ── RÈGLE ABSOLUE DE VISIBILITÉ : un profil ne voit QUE les domaines de son périmètre ──
  // (son unité + sous-unités). Un département DPD ne voit que « Distribution », jamais les
  // budgets Production / Transport / Commercial. Source : useScopeDomaines() (org-scopé).
  const scopeDomaines = useScopeDomaines();
  const visibleLabels = scopeDomaines
    .map(d => DOMAIN_MAP[d as keyof typeof DOMAIN_MAP])
    .filter(Boolean) as DomainFilter[];
  const isMultiDomain = visibleLabels.length !== 1; // mono-domaine ⇒ pas de bouton « Tous »
  const canSeeDomain = (d: DomainFilter) => visibleLabels.includes(d);
  // Déclaré ici (avant scopedDomainBudget) pour que le memo puisse l'utiliser comme dépendance.
  const [domainFilter, setDomainFilter] = useState<DomainFilter>(isMultiDomain ? 'Tous' : (visibleLabels[0] ?? 'Tous'));

  /* Build ProjectRow list from real store data */
  const storeProjects = useMemo<ProjectRow[]>(() => {
    return store.projets.map(p => {
      const dom = DOMAIN_MAP[p.domaine] ?? 'Production';
      const decaissePct = p.budget > 0 ? p.budgetDecaisse / p.budget : 0;
      const cpiOk = p.cpi >= 0.95 && p.spi >= 0.90;
      const statut: ProjectRow['statut'] = p.statut === 'termine' ? 'Achevé'
        : p.statut === 'en_retard' ? 'Critique'
        : decaissePct < 0.3 ? 'Attention'
        : 'On Track';
      return {
        code: p.code,
        nom: p.nom.length > 40 ? p.nom.slice(0, 40) + '…' : p.nom,
        domain: dom,
        prevu: p.budget / 1000,       // MFCFA → Mrd
        marches: p.budgetEngage / 1000,
        decaisse: p.budgetDecaisse / 1000,
        statut,
      };
    });
  }, [store.projets]);

  // Données donut/total dérivées des projets SCOPÉS (jamais des constantes tous-domaines).
  const scopedDomainBudget = useMemo<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    const src = domainFilter === 'Tous' ? storeProjects : storeProjects.filter(p => p.domain === domainFilter);
    src.forEach(p => { m[p.domain] = (m[p.domain] ?? 0) + p.prevu; });
    return m;
  }, [storeProjects, domainFilter]);
  const totalBudgetScoped = useMemo(() => Object.values(scopedDomainBudget).reduce((s, v) => s + v, 0), [scopedDomainBudget]);
  // Totaux RÉELS du périmètre du profil (engagements/décaissements) — pour ne JAMAIS
  // afficher les chiffres globaux à un profil restreint.
  const marchesScoped = useMemo(() => storeProjects.reduce((s, p) => s + (p.marches || 0), 0), [storeProjects]);
  const decaisseScoped = useMemo(() => storeProjects.reduce((s, p) => s + (p.decaisse || 0), 0), [storeProjects]);
  // Waterfall scopé au périmètre du profil (Budget → Engagements → Décaissements → Solde).
  const waterfallScoped = useMemo<WaterfallItem[]>(() => {
    let running = 0;
    const steps: { name: string; delta: number; isTotal: boolean; color: string }[] = [
      { name: 'Budget révisé',    delta: totalBudgetScoped,         isTotal: true,  color: ORANGE },
      { name: 'Engagements',      delta: -marchesScoped,            isTotal: false, color: NAVY2  },
      { name: 'Décaissements',    delta: -decaisseScoped,           isTotal: false, color: PURPLE },
      { name: 'Solde disponible', delta: totalBudgetScoped - marchesScoped, isTotal: true, color: GREEN },
    ];
    return steps.map(s => {
      const item: WaterfallItem = { name: s.name, value: Math.abs(s.delta), isTotal: s.isTotal, color: s.color,
        base: s.isTotal ? 0 : (s.delta > 0 ? running : running + s.delta) };
      if (!s.isTotal) running += s.delta; else running = s.delta;
      return item;
    });
  }, [totalBudgetScoped, marchesScoped, decaisseScoped]);
  const pieData = useMemo(() => {
    const colors: Record<string, string> = { Production: NAVY, Transport: ORANGE, Distribution: GREEN, Commercial: PURPLE, 'Génie Civil': AMBER };
    const total = totalBudgetScoped || 1;
    return Object.entries(scopedDomainBudget)
      .map(([name, val]) => ({ name, value: Math.round((val / total) * 100), color: colors[name] ?? NAVY, raw: val }))
      .sort((a, b) => b.value - a.value);
  }, [scopedDomainBudget, totalBudgetScoped]);

  const [activeTab, setActiveTab]   = useState<'synthese' | 'previsions'>('synthese');
  const [prevPeriod, setPrevPeriod] = useState<'mensuel' | 'trimestriel' | 'semestriel' | 'annuel'>('trimestriel');
  const [prevData, setPrevData]     = useState<Record<string, Record<string, number>>>({});

  const [year, setYear]         = useState<YearOption>('2025');
  const [sortKey, setSortKey]   = useState<SortKey>('prevu');
  const [sortDir, setSortDir]   = useState<SortDir>('desc');
  const [projectStatuses, setProjectStatuses] = useState<Record<string, ProjectRow['statut']>>({});

  function updateProjectStatus(code: string, newStatus: ProjectRow['statut']) {
    setProjectStatuses(prev => ({ ...prev, [code]: newStatus }));
  }

  const filteredProjects = useMemo(() => {
    const base = storeProjects;
    const rows = domainFilter === 'Tous'
      ? base.map(p => ({ ...p, statut: projectStatuses[p.code] ?? p.statut }))
      : base.filter(p => p.domain === domainFilter).map(p => ({ ...p, statut: projectStatuses[p.code] ?? p.statut }));
    rows.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return rows;
  }, [storeProjects, domainFilter, sortKey, sortDir, projectStatuses]);

  const totals = useMemo(() => ({
    prevu:    filteredProjects.reduce((s, p) => s + p.prevu, 0),
    marches:  filteredProjects.reduce((s, p) => s + p.marches, 0),
    decaisse: filteredProjects.reduce((s, p) => s + p.decaisse, 0),
  }), [filteredProjects]);

  function toggleSort(col: SortKey) {
    if (sortKey === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(col); setSortDir('desc'); }
  }

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey === col
      ? (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDownIcon size={12} />)
      : null;

  /* build project decaissement ratio data */
  const ratioData = filteredProjects.map(p => ({
    name: p.code,
    ratio: pct(p.decaisse, p.prevu),
    color: decaisseColor(p.prevu > 0 ? p.decaisse / p.prevu : 0),
  }));

  /* ── Données RÉELLES (org-scopées) servant à calibrer les courbes ──
   * La courbe en S des décaissements cumulés et la ventilation par catégorie
   * sont mises à l'ÉCHELLE des montants réellement chargés pour le périmètre du
   * profil. Sans données chargées (ex. CPAMACEL, DER avant chargement) → 0 :
   * plus de courbe « fantôme » alors que tous les indicateurs sont à zéro. */
  const realScaling = useMemo(() => {
    const inScope = (d: ProjectRow['domain']) => domainFilter === 'Tous' || d === domainFilter;
    const projs = storeProjects.filter(p => inScope(p.domain));
    const realDecaisse = projs.reduce((s, p) => s + (p.decaisse || 0), 0); // Mrd
    const realEngage   = projs.reduce((s, p) => s + (p.marches  || 0), 0); // Mrd
    return { realDecaisse, realEngage, hasData: projs.length > 0 && (realDecaisse > 0 || realEngage > 0) };
  }, [storeProjects, domainFilter]);

  /* Courbe en S des décaissements cumulés — distribuée linéairement sur la durée du projet. */
  const quarterlyDataFiltered = useMemo(() => {
    const inScope = (dom: string) => domainFilter === 'Tous' || dom === domainFilter;
    const yr = parseInt(year);
    return ['T1', 'T2', 'T3', 'T4'].map((label, qi) => {
      const qStart = new Date(yr, qi * 3, 1).getTime();
      const qEnd   = new Date(yr, qi * 3 + 3, 0, 23, 59, 59).getTime();
      const row: QuarterData = { quarter: `${label} ${year}`, Production: 0, Transport: 0, Distribution: 0, Commercial: 0, cumul: 0 };
      store.projets.forEach(p => {
        const dom = DOMAIN_MAP[p.domaine] ?? 'Production';
        if (!inScope(dom)) return;
        const phStart = new Date(p.dateDebut).getTime();
        const phEnd   = new Date(p.dateFinPrevue).getTime();
        if (!phStart || !phEnd || phStart >= phEnd || phStart > qEnd || phEnd < qStart) return;
        const totalMs   = phEnd - phStart;
        const overlapMs = Math.max(0, Math.min(phEnd, qEnd) - Math.max(phStart, qStart));
        const frac = overlapMs / totalMs;
        const rowAny = row as unknown as Record<string, number>;
        rowAny[dom] = +((rowAny[dom] ?? 0) + (p.budgetDecaisse / 1_000) * frac).toFixed(3);
      });
      row.cumul = +(row.Production + row.Transport + row.Distribution + row.Commercial).toFixed(3);
      return row;
    });
  }, [store.projets, domainFilter, year]);

  /* Ventilation par catégorie — estimée depuis les poids de phases projet. */
  const categoryDataFiltered = useMemo(() => {
    const inScope = (dom: string) => domainFilter === 'Tous' || dom === domainFilter;
    const acc: Record<string, Record<string, number>> = {
      'Études': {}, 'Travaux': {}, 'Équipements': {}, 'Services': {}, 'Divers': {},
    };
    store.projets.forEach(p => {
      const dom = DOMAIN_MAP[p.domaine] ?? 'Production';
      if (!inScope(dom)) return;
      const phases = p.phases ?? [];
      const totalPoids = phases.reduce((s, ph) => s + ph.poids, 0) || 100;
      phases.forEach(ph => {
        const cat = PHASE_TO_CAT[ph.id] ?? 'Divers';
        const fraction = ph.poids / totalPoids;
        acc[cat][dom] = (acc[cat][dom] ?? 0) + (p.budgetEngage / 1_000) * fraction;
      });
    });
    return Object.entries(acc).map(([cat, vals]) => ({
      cat,
      Production:   +(vals.Production   ?? 0).toFixed(2),
      Transport:    +(vals.Transport    ?? 0).toFixed(2),
      Distribution: +(vals.Distribution ?? 0).toFixed(2),
      Commercial:   +(vals.Commercial   ?? 0).toFixed(2),
    })) as CategoryBudget[];
  }, [store.projets, domainFilter]);

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#F5F6FA', padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', rowGap: 8 }}>
        <div style={{ flex: '1 1 200px', minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: NAVY, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Gestion Budgétaire</div>
          <div style={{ fontSize: 11, color: '#64748B', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Portefeuille DPE — SENELEC · Mise à jour : 25/05/2026</div>
        </div>

        {/* Year selector */}
        <div style={{ display: 'flex', gap: 0, border: `1px solid ${NAVY}30`, borderRadius: 7, overflow: 'hidden', flexShrink: 0 }}>
          {(['2024', '2025', '2026'] as YearOption[]).map(y => (
            <button key={y} onClick={() => setYear(y)} style={{
              padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none',
              background: year === y ? NAVY : '#fff', color: year === y ? '#fff' : NAVY, transition: 'all .15s',
            }}>{y}</button>
          ))}
        </div>

      </div>

      {/* ── ONGLETS ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 0, borderBottom: `2px solid #E2E8F0`, marginBottom: 4 }}>
        {([
          { key: 'synthese',   label: 'Synthèse budgétaire' },
          { key: 'previsions', label: 'Prévisions financières' },
        ] as const).map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            border: 'none', background: 'transparent',
            color: activeTab === tab.key ? NAVY : '#64748B',
            borderBottom: activeTab === tab.key ? `3px solid ${ORANGE}` : '3px solid transparent',
            marginBottom: -2, transition: 'all .15s',
          }}>{tab.label}</button>
        ))}
      </div>

      {/* ── VUE D'ENSEMBLE ───────────────────────────────────────────────────── */}
      {activeTab === 'synthese' && <>

      {/* ── ROW 1 — 4 KPI cards (real store data) ──────────────────────────── */}
      {(() => {
        const allProjets = storeProjects;
        const visibleProjets = domainFilter === 'Tous' ? allProjets : allProjets.filter(p => p.domain === domainFilter);
        const totalBudget = visibleProjets.reduce((s, p) => s + p.prevu, 0);
        const totalMarches = visibleProjets.reduce((s, p) => s + p.marches, 0);
        const totalDecaisse = visibleProjets.reduce((s, p) => s + p.decaisse, 0);
        const solde = totalBudget - totalMarches;
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPICard
              label="Budget total portefeuille"
              value={`${totalBudget.toFixed(2)} Mrd FCFA`}
              sub={`${visibleProjets.length} projets — Données réelles`}
              accent={NAVY} badge="PORTEFEUILLE" badgeColor={NAVY}
            />
            <KPICard
              label="Engagements / Marchés"
              value={`${totalMarches.toFixed(2)} Mrd FCFA`}
              sub={`${pct(totalMarches, totalBudget)}% du budget`}
              progress={pct(totalMarches, totalBudget)}
              progressColor={ORANGE} accent={ORANGE}
              badge={`${pct(totalMarches, totalBudget)}%`} badgeColor={ORANGE}
            />
            <KPICard
              label="Décaissements cumulés"
              value={`${totalDecaisse.toFixed(2)} Mrd FCFA`}
              sub={`${pct(totalDecaisse, totalBudget)}% du budget`}
              progress={pct(totalDecaisse, totalBudget)}
              progressColor={GREEN} accent={GREEN}
              badge={`${pct(totalDecaisse, totalBudget)}%`} badgeColor={GREEN}
            />
            <KPICard
              label="Solde disponible"
              value={`${solde.toFixed(2)} Mrd FCFA`}
              sub={`${pct(solde, totalBudget)}% non engagé`}
              accent={AMBER} badge="SOLDE" badgeColor={AMBER}
            />
          </div>
        );
      })()}

      {/* ── ROW 2 — Pie Domains + Quarterly stacked ──────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <Card>
          <SH title="Répartition budget par domaine (% et MFCFA)" />
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            {/* Donut with center label */}
            <div style={{ position: 'relative', width: 180, height: 180, flexShrink: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%" cy="50%"
                    outerRadius={82}
                    innerRadius={48}
                    paddingAngle={2}
                    strokeWidth={1}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTT />} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', pointerEvents: 'none' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: NAVY }}>{totalBudgetScoped.toFixed(1)}</div>
                <div style={{ fontSize: 9, color: '#94A3B8', fontWeight: 600 }}>Mrd FCFA</div>
              </div>
            </div>

            {/* Legend with progress bars */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pieData.map(d => (
                <div key={d.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 12 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: d.color, display: 'inline-block' }} />
                      {d.name}
                    </span>
                    <span style={{ fontWeight: 800, color: d.color }}>{d.value}% — {(totalBudgetScoped * d.value / 100).toFixed(1)} Mrd</span>
                  </div>
                  <div style={{ height: 5, background: '#F1F5F9', borderRadius: 3 }}>
                    <div style={{ height: 5, width: `${d.value}%`, background: d.color, borderRadius: 3 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <SH title={`Évolution trimestrielle des décaissements ${year} (MFCFA)`} />
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={quarterlyDataFiltered} margin={{ top: 10, right: 30, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="quarter" tick={{ fontSize: 10, fill: '#94A3B8' }} />
              <YAxis yAxisId="left"  tick={{ fontSize: 10, fill: '#94A3B8' }} unit=" M" />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#94A3B8' }} unit=" M" />
              <Tooltip content={<QuarterTooltip />} />
              <Legend wrapperStyle={{ fontSize: 10, paddingTop: 6 }} />
              {canSeeDomain('Production')   && <Bar yAxisId="left" dataKey="Production"   name="Production"   fill={NAVY}   stackId="s" radius={[0,0,0,0]} />}
              {canSeeDomain('Transport')    && <Bar yAxisId="left" dataKey="Transport"    name="Transport"    fill={ORANGE} stackId="s" radius={[0,0,0,0]} />}
              {canSeeDomain('Distribution') && <Bar yAxisId="left" dataKey="Distribution" name="Distribution" fill={GREEN}  stackId="s" radius={[0,0,0,0]} />}
              {canSeeDomain('Commercial')   && <Bar yAxisId="left" dataKey="Commercial"   name="Commercial"   fill={PURPLE} stackId="s" radius={[3,3,0,0]} />}
              <Line yAxisId="right" type="monotone" dataKey="cumul" name="Cumul décaissé" stroke={NAVY} strokeWidth={2.5} dot={{ r: 4, fill: NAVY }} />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* ── ROW 3 — Waterfall ────────────────────────────────────────────────── */}
      <Card>
        <SH title="Flux budgétaire — Waterfall du budget révisé aux décaissements (MFCFA)" />
        <div style={{ fontSize: 11, color: '#64748B', marginBottom: 10, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {[
            { label: 'Total / Solde', color: NAVY },
            { label: 'Additions (+)',  color: GREEN },
            { label: 'Réductions (−)', color: RED },
            { label: 'Budget révisé', color: ORANGE },
            { label: 'Engagements',   color: NAVY2 },
            { label: 'Décaissements', color: PURPLE },
          ].map(l => (
            <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: l.color, display: 'inline-block' }} />
              {l.label}
            </span>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={waterfallScoped} margin={{ top: 10, right: 20, left: 30, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#374151', fontWeight: 600 }} />
            <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} unit=" M" domain={[0, 270]} />
            <Tooltip content={<WFTooltip />} />
            {/* Invisible base bar to float bars */}
            <Bar dataKey="base"  fill="transparent" stackId="wf" radius={[0,0,0,0]} legendType="none" />
            <Bar dataKey="value" stackId="wf" radius={[4,4,0,0]} maxBarSize={50} legendType="none">
              {waterfallScoped.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      {/* ── ROW 4 — Taux décaissement + Budget par catégorie ────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <SH title="Taux de décaissement par projet (%)" right={
            <span style={{ fontSize: 10, color: '#94A3B8' }}>{filteredProjects.length} projets</span>
          } />
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={ratioData}
              layout="vertical"
              margin={{ top: 4, right: 40, left: 50, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: '#94A3B8' }} unit="%" />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#374151', fontWeight: 600 }} width={48} />
              <ReferenceLine x={80} stroke={GREEN}  strokeDasharray="4 2" strokeWidth={1.5} label={{ value: '80%', position: 'top', fontSize: 9, fill: GREEN }} />
              <ReferenceLine x={50} stroke={AMBER}  strokeDasharray="4 2" strokeWidth={1.5} label={{ value: '50%', position: 'top', fontSize: 9, fill: AMBER }} />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8, border: `1px solid ${NAVY}20` }}
                formatter={(v: number) => [`${v}%`, 'Taux décaissé']}
              />
              <Bar dataKey="ratio" name="Taux décaissé %" radius={[0, 4, 4, 0]} maxBarSize={16}>
                {ratioData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <SH title="Budget par catégorie de dépenses × domaine (MFCFA)" />
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={categoryDataFiltered} margin={{ top: 10, right: 20, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="cat" tick={{ fontSize: 11, fill: '#374151', fontWeight: 600 }} />
              <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} unit=" M" />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: `1px solid ${NAVY}20` }} formatter={(v: number, n: string) => [`${v.toFixed(1)} MFCFA`, n]} />
              <Legend wrapperStyle={{ fontSize: 10, paddingTop: 6 }} />
              {canSeeDomain('Production')   && <Bar dataKey="Production"   name="Production"   fill={NAVY}   radius={[3,3,0,0]} maxBarSize={18} />}
              {canSeeDomain('Transport')    && <Bar dataKey="Transport"    name="Transport"    fill={ORANGE} radius={[3,3,0,0]} maxBarSize={18} />}
              {canSeeDomain('Distribution') && <Bar dataKey="Distribution" name="Distribution" fill={GREEN}  radius={[3,3,0,0]} maxBarSize={18} />}
              {canSeeDomain('Commercial')   && <Bar dataKey="Commercial"   name="Commercial"   fill={PURPLE} radius={[3,3,0,0]} maxBarSize={18} />}
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* ── ROW 5 — Budget detail table ──────────────────────────────────────── */}
      <Card>
        <SH title={`Tableau de bord budgétaire détaillé — ${filteredProjects.length} projets`} />
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                {(
                  [
                    { key: 'code',     label: 'Projet'         },
                    { key: 'domain',   label: 'Domaine'        },
                    { key: 'prevu',    label: 'Budget prévu'   },
                    { key: 'marches',  label: 'Marchés'        },
                    { key: 'decaisse', label: 'Décaissé'       },
                    { key: '__pct',    label: '%'              },
                    { key: '__solde',  label: 'Solde'          },
                    { key: 'statut',   label: 'Statut'         },
                  ] as Array<{ key: string; label: string }>
                ).map(col => (
                  <th
                    key={col.key}
                    onClick={() => col.key.startsWith('__') ? undefined : toggleSort(col.key as SortKey)}
                    style={{
                      padding: '9px 12px', textAlign: col.key === 'code' || col.key === 'domain' || col.key === 'statut' ? 'left' : 'right',
                      fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase',
                      letterSpacing: '.4px', borderBottom: '2px solid #E2E8F0',
                      cursor: col.key.startsWith('__') ? 'default' : 'pointer', userSelect: 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3, justifyContent: col.key === 'code' || col.key === 'domain' || col.key === 'statut' ? 'flex-start' : 'flex-end' }}>
                      {col.label}
                      {!col.key.startsWith('__') && <SortIcon col={col.key as SortKey} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map((p, idx) => {
                const ratio   = pct(p.decaisse, p.prevu);
                const solde   = p.prevu - p.marches;
                const dcolor  = decaisseColor(p.prevu > 0 ? p.decaisse / p.prevu : 0);
                const currentStatut = projectStatuses[p.code] ?? p.statut;
                return (
                  <tr key={`${p.code}-${idx}`} style={{ borderBottom: '1px solid #F1F5F9', background: idx % 2 === 1 ? '#FAFBFC' : '#fff' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 700, fontSize: 11, color: NAVY }}>{p.code}</div>
                      <div style={{ fontSize: 10, color: '#64748B', marginTop: 1, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nom}</div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                        background: DOMAIN_COLORS[p.domain] + '18', color: DOMAIN_COLORS[p.domain],
                        border: `1px solid ${DOMAIN_COLORS[p.domain]}30`,
                      }}>{p.domain}</span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: NAVY }}>{p.prevu.toFixed(1)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: ORANGE, fontWeight: 600 }}>{p.marches.toFixed(1)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: dcolor, fontWeight: 600 }}>{p.decaisse.toFixed(1)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                        <div style={{ width: 40, height: 5, background: '#F1F5F9', borderRadius: 3 }}>
                          <div style={{ height: 5, width: `${ratio}%`, background: dcolor, borderRadius: 3 }} />
                        </div>
                        <span style={{ fontWeight: 700, color: dcolor, fontSize: 11 }}>{ratio}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: solde < 0 ? RED : '#64748B', fontWeight: 600 }}>{solde.toFixed(1)}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <select
                        value={currentStatut}
                        onChange={e => updateProjectStatus(p.code, e.target.value as ProjectRow['statut'])}
                        style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 8,
                          background: statutColor(currentStatut) + '18',
                          color: statutColor(currentStatut),
                          border: `1px solid ${statutColor(currentStatut)}40`,
                          cursor: 'pointer', appearance: 'auto',
                        }}
                      >
                        <option value="On Track">On Track</option>
                        <option value="Attention">Attention</option>
                        <option value="Critique">Critique</option>
                        <option value="Achevé">Achevé</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: NAVY + '08', borderTop: `2px solid ${NAVY}30`, fontWeight: 700 }}>
                <td colSpan={2} style={{ padding: '10px 12px', fontSize: 12, fontWeight: 800, color: NAVY }}>
                  TOTAL — {filteredProjects.length} projets
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: NAVY }}>{totals.prevu.toFixed(1)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: ORANGE }}>{totals.marches.toFixed(1)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: GREEN }}>{totals.decaisse.toFixed(1)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                  <span style={{ fontWeight: 800, color: GREEN }}>{pct(totals.decaisse, totals.prevu)}%</span>
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: AMBER }}>{(totals.prevu - totals.marches).toFixed(1)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      </>}

      {/* ── PRÉVISIONS FINANCIÈRES ──────────────────────────────────────────── */}
      {activeTab === 'previsions' && (
        <PrevisionsTab
          prevPeriod={prevPeriod}
          setPrevPeriod={setPrevPeriod}
          prevData={prevData}
          setPrevData={setPrevData}
          year={year}
          domainFilter={domainFilter}
          storeProjects={storeProjects}
        />
      )}

    </div>
  );
}
