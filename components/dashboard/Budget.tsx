'use client';

import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
  ComposedChart, ReferenceLine,
} from 'recharts';
import { Download, ChevronUp, ChevronDown as ChevronDownIcon } from 'lucide-react';
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
      <div class="footer">CONFIDENTIEL — Usage interne SENELEC · Document généré par SIGEPP-DPE</div>
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

/* ─── Mock data ─────────────────────────────────────────────────────────────── */
const PROJECTS: ProjectRow[] = [
  { code: 'PRD-01', nom: 'Centrale CC Tobène',            domain: 'Production',   prevu: 45.2, marches: 38.4, decaisse: 22.4, statut: 'Attention'  },
  { code: 'PRD-02', nom: 'Solar Farm Taïba 60MW',         domain: 'Production',   prevu: 24.2, marches: 20.1, decaisse: 14.6, statut: 'On Track'   },
  { code: 'PRD-03', nom: 'Extension Barrage Manantali',   domain: 'Production',   prevu: 30.4, marches: 18.2, decaisse:  9.8, statut: 'Critique'   },
  { code: 'TRP-01', nom: 'Ligne 225kV Tobène–Hann',       domain: 'Transport',    prevu: 42.0, marches: 28.6, decaisse: 16.4, statut: 'Attention'  },
  { code: 'TRP-02', nom: 'PADERAU HTB Extension',         domain: 'Transport',    prevu: 18.7, marches: 14.2, decaisse: 10.8, statut: 'On Track'   },
  { code: 'TRP-03', nom: 'Poste 90kV Saint-Louis',        domain: 'Transport',    prevu: 12.8, marches:  8.4, decaisse:  4.2, statut: 'Critique'   },
  { code: 'DST-01', nom: 'Réseau BT Dakar Banlieue',      domain: 'Distribution', prevu: 15.3, marches: 13.1, decaisse: 10.2, statut: 'On Track'   },
  { code: 'DST-02', nom: 'AMI Compteurs Intelligents',    domain: 'Distribution', prevu: 12.8, marches:  7.4, decaisse:  4.8, statut: 'Critique'   },
  { code: 'DST-03', nom: 'Réseau BT Ziguinchor',          domain: 'Distribution', prevu:  7.6, marches:  6.2, decaisse:  5.1, statut: 'On Track'   },
  { code: 'COM-01', nom: 'CRM Commercial Platform',       domain: 'Commercial',   prevu:  8.6, marches:  7.8, decaisse:  6.2, statut: 'Achevé'     },
  { code: 'COM-02', nom: 'Télégestion SCADA v3',          domain: 'Commercial',   prevu: 10.1, marches:  9.7, decaisse:  8.4, statut: 'On Track'   },
  { code: 'COM-03', nom: 'Éclairage public LED x5000',    domain: 'Commercial',   prevu:  9.5, marches:  5.2, decaisse:  2.4, statut: 'Critique'   },
];

const QUARTERLY_DATA: QuarterData[] = [
  { quarter: 'T1 2024', Production:  8.2, Transport:  6.4, Distribution: 4.8, Commercial: 1.8, cumul:  21.2 },
  { quarter: 'T2 2024', Production: 12.6, Transport:  9.8, Distribution: 6.2, Commercial: 2.4, cumul:  52.2 },
  { quarter: 'T3 2024', Production: 16.4, Transport: 13.2, Distribution: 8.6, Commercial: 3.2, cumul: 103.6 },
  { quarter: 'T4 2024', Production: 18.8, Transport: 15.6, Distribution: 9.4, Commercial: 3.8, cumul: 151.2 },
];

const buildWaterfall = (): WaterfallItem[] => {
  let running = 0;
  const steps: { name: string; delta: number; isTotal: boolean; color: string }[] = [
    { name: 'Budget initial',  delta: 220.0, isTotal: true,  color: NAVY   },
    { name: 'Avenants +',      delta:  24.2, isTotal: false, color: GREEN  },
    { name: 'Avenants −',      delta: -7.0,  isTotal: false, color: RED    },
    { name: 'Budget révisé',   delta: 237.2, isTotal: true,  color: ORANGE },
    { name: 'Engagements',     delta: -189.4,isTotal: false, color: NAVY2  },
    { name: 'Décaissements',   delta: -142.6,isTotal: false, color: PURPLE },
    { name: 'Solde disponible',delta: 47.8,  isTotal: true,  color: GREEN  },
  ];

  return steps.map(s => {
    const item: WaterfallItem = {
      name:    s.name,
      value:   Math.abs(s.delta),
      isTotal: s.isTotal,
      color:   s.color,
      base:    s.isTotal ? 0 : (s.delta > 0 ? running : running + s.delta),
    };
    if (!s.isTotal) {
      running += s.delta;
    } else {
      running = s.delta;
    }
    return item;
  });
};

const WATERFALL_DATA = buildWaterfall();

const CATEGORY_DATA: CategoryBudget[] = [
  { cat: 'Études',      Production: 2.8, Transport: 3.4, Distribution: 1.8, Commercial: 1.2 },
  { cat: 'Travaux',     Production: 28.4, Transport: 36.2, Distribution: 18.6, Commercial: 4.8 },
  { cat: 'Équipements', Production: 38.6, Transport: 18.4, Distribution: 8.2, Commercial: 2.6 },
  { cat: 'Services',    Production: 8.2, Transport: 6.8, Distribution: 4.4, Commercial: 2.8 },
  { cat: 'Divers',      Production: 3.8, Transport: 2.4, Distribution: 1.8, Commercial: 0.8 },
];

/* ─── PIE data: Domain budget ────────────────────────────────────────────────── */
const PIE_DOMAINS = [
  { name: 'Production',   value: 42, color: NAVY   },
  { name: 'Transport',    value: 28, color: ORANGE },
  { name: 'Distribution', value: 22, color: GREEN  },
  { name: 'Commercial',   value: 8,  color: PURPLE },
];

const TOTAL_BUDGET = 237.2;
const MARCHES_CONCLUS = 189.4;
const DECAISSEMENTS = 142.6;
const SOLDE = TOTAL_BUDGET - MARCHES_CONCLUS;

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
      <div style={{ fontSize: 22, fontWeight: 800, color: accent }}>{value}</div>
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
    storeProjects.forEach(p => { m[p.domain] = (m[p.domain] ?? 0) + p.prevu; });
    return m;
  }, [storeProjects]);
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

  const [year, setYear]         = useState<YearOption>('2025');
  const [budgetTab, setBudgetTab] = useState<'synthese' | 'plan_financier' | 'decomptes' | 'couts_collectes'>('synthese');
  // Profil mono-domaine ⇒ filtre verrouillé sur son domaine (pas de vue « Tous » multi-domaines).
  const [domainFilter, setDomainFilter] = useState<DomainFilter>(isMultiDomain ? 'Tous' : (visibleLabels[0] ?? 'Tous'));
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

  /* Courbe en S des décaissements cumulés — calibrée sur le décaissé réel. */
  const quarterlyDataFiltered = useMemo(() => {
    const yearSuffix = year.slice(2); // '24', '25', '26'
    const yearFiltered = QUARTERLY_DATA.filter(q => q.quarter.includes(yearSuffix)).length > 0
      ? QUARTERLY_DATA.filter(q => q.quarter.includes(yearSuffix))
      : QUARTERLY_DATA;
    // Vue mono-domaine : on isole la colonne du domaine.
    const view = domainFilter === 'Tous' ? yearFiltered : yearFiltered.map(q => ({
      ...q,
      Production:   domainFilter === 'Production'   ? q.Production   : 0,
      Transport:    domainFilter === 'Transport'    ? q.Transport    : 0,
      Distribution: domainFilter === 'Distribution' ? q.Distribution : 0,
      Commercial:   domainFilter === 'Commercial'   ? q.Commercial   : 0,
      cumul:        domainFilter === 'Production'   ? q.Production
                  : domainFilter === 'Transport'    ? q.Transport
                  : domainFilter === 'Distribution' ? q.Distribution
                  : q.Commercial,
    }));
    // Mise à l'échelle : le dernier cumul = décaissé réel du périmètre (0 si rien chargé).
    const mockFinal = view.length ? view[view.length - 1].cumul : 0;
    const ratio = mockFinal > 0 ? realScaling.realDecaisse / mockFinal : 0;
    return view.map(q => ({
      quarter: q.quarter,
      Production:   +(q.Production   * ratio).toFixed(2),
      Transport:    +(q.Transport    * ratio).toFixed(2),
      Distribution: +(q.Distribution * ratio).toFixed(2),
      Commercial:   +(q.Commercial   * ratio).toFixed(2),
      cumul:        +(q.cumul        * ratio).toFixed(2),
    }));
  }, [year, domainFilter, realScaling]);

  /* Ventilation par catégorie — calibrée sur l'engagé réel du périmètre. */
  const categoryDataFiltered = useMemo(() => {
    const base = domainFilter === 'Tous' ? CATEGORY_DATA : CATEGORY_DATA.map(c => ({
      ...c,
      Production:   domainFilter === 'Production'   ? c.Production   : 0,
      Transport:    domainFilter === 'Transport'    ? c.Transport    : 0,
      Distribution: domainFilter === 'Distribution' ? c.Distribution : 0,
      Commercial:   domainFilter === 'Commercial'   ? c.Commercial   : 0,
    }));
    const mockTotal = base.reduce((s, c) => s + c.Production + c.Transport + c.Distribution + c.Commercial, 0);
    const ratio = mockTotal > 0 ? realScaling.realEngage / mockTotal : 0;
    return base.map(c => ({
      cat: c.cat,
      Production:   +(c.Production   * ratio).toFixed(2),
      Transport:    +(c.Transport    * ratio).toFixed(2),
      Distribution: +(c.Distribution * ratio).toFixed(2),
      Commercial:   +(c.Commercial   * ratio).toFixed(2),
    }));
  }, [domainFilter, realScaling]);

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#F5F6FA' }}>
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: NAVY }}>Gestion Budgétaire</div>
          <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>Portefeuille DPE Senelec — Mise à jour: 25/05/2026</div>
        </div>

        {/* Year selector */}
        <div style={{ display: 'flex', gap: 0, border: `1px solid ${NAVY}30`, borderRadius: 7, overflow: 'hidden', marginLeft: 'auto' }}>
          {(['2024', '2025', '2026'] as YearOption[]).map(y => (
            <button key={y} onClick={() => setYear(y)} style={{
              padding: '7px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none',
              background: year === y ? NAVY : '#fff', color: year === y ? '#fff' : NAVY, transition: 'all .15s',
            }}>{y}</button>
          ))}
        </div>

        {/* Domain filter */}
        <div style={{ display: 'flex', gap: 0, border: `1px solid ${ORANGE}30`, borderRadius: 7, overflow: 'hidden' }}>
          {(['Tous', 'Production', 'Transport', 'Distribution', 'Commercial', 'Génie Civil'] as DomainFilter[])
            .filter(d => d === 'Tous' ? isMultiDomain : canSeeDomain(d))   // jamais un domaine hors périmètre
            .map(d => (
            <button key={d} onClick={() => setDomainFilter(d)} style={{
              padding: '7px 11px', fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none',
              background: domainFilter === d ? ORANGE : '#fff', color: domainFilter === d ? '#fff' : ORANGE, transition: 'all .15s',
            }}>{d}</button>
          ))}
        </div>
      </div>

      {/* ── TABS ─────────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 0, borderBottom: `2px solid #E2E8F0`, marginTop: 4 }}>
        {([
          { id: 'synthese',         label: '📊 Vue d\'ensemble' },
          { id: 'plan_financier',   label: '📋 Plan Financier' },
          { id: 'decomptes',        label: '🔢 Décomptes PAUE2' },
          { id: 'couts_collectes',  label: '🧾 Coûts Collectés' },
        ] as Array<{ id: typeof budgetTab; label: string }>).map(t => (
          <button
            key={t.id}
            onClick={() => setBudgetTab(t.id)}
            style={{
              padding: '10px 18px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              border: 'none', borderBottom: budgetTab === t.id ? `3px solid ${NAVY}` : '3px solid transparent',
              background: 'transparent', color: budgetTab === t.id ? NAVY : '#64748B',
              transition: 'all .15s', marginBottom: -2,
            }}
          >{t.label}</button>
        ))}
      </div>

      {/* ── TAB: PLAN FINANCIER (BOQ PAUE2) ─────────────────────────────────── */}
      {budgetTab === 'plan_financier' && (() => {
        // Structure BOQ PAUE2 réelle : Fourniture + Révision + Transport + Pose = Total HTVA
        const projets = storeProjects.filter(p => domainFilter === 'Tous' || p.domain === domainFilter);
        const totalBudget = projets.reduce((s, p) => s + p.prevu, 0);
        const totalDecaisse = projets.reduce((s, p) => s + p.decaisse, 0);
        const totalMarches  = projets.reduce((s, p) => s + p.marches, 0);

        // Proportionner les 4 lots PAUE2 au budget total du périmètre
        const LOTS = [
          { item: 1, designation: 'Électrification nouveaux villages (Rural)',  pctFourn: 0.554, pctTrans: 0.022, pctPose: 0.101, pctBudget: 0.608 },
          { item: 2, designation: 'Extension milieu périurbain',                pctFourn: 0.245, pctTrans: 0.007, pctPose: 0.022, pctBudget: 0.249 },
          { item: 3, designation: 'Remplacement poteaux bois & Réhabilitation', pctFourn: 0.043, pctTrans: 0.002, pctPose: 0.006, pctBudget: 0.139 },
          { item: 4, designation: 'Outillages & Équipements',                   pctFourn: 0.003, pctTrans: 0.000, pctPose: 0.000, pctBudget: 0.003 },
        ];
        const TVA_R = 0.18;
        const lots = LOTS.map(l => {
          const fourn   = totalBudget * l.pctFourn;
          const trans   = totalBudget * l.pctTrans;
          const pose    = totalBudget * l.pctPose;
          const rev     = totalBudget * l.pctFourn * 0.056;  // révision ~5.6% fourniture
          const htva    = fourn + rev + trans + pose;
          const budget  = totalBudget * l.pctBudget;
          const dec     = totalDecaisse * l.pctBudget;
          const taux    = budget > 0 ? dec / budget : 0;
          return { ...l, fourn, rev, trans, pose, htva, budget, dec, taux };
        });
        const totHTVA = lots.reduce((s, l) => s + l.htva, 0);
        const fmtM = (v: number) => (v / 1000).toFixed(1);

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Récapitulatif général */}
            <Card title="📊 Récapitulatif Général — Modèle PAUE2/DPE" subtitle="Fourniture · Révision · Transport · Pose · Total HTVA (MFCFA)">
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      {['Item', 'Désignation', 'Fourniture', 'Révision', 'Transport', 'Pose', 'Total HTVA', 'Budget', 'Décaissé', 'Taux'].map((h, i) => (
                        <th key={i} style={{ padding: '8px 10px', textAlign: i < 2 ? 'left' : 'right', fontSize: 9, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '2px solid #E2E8F0', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lots.map((l, idx) => {
                      const tc = l.taux >= 0.80 ? GREEN : l.taux >= 0.50 ? AMBER : RED;
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9', background: idx % 2 === 1 ? '#FAFBFC' : '#fff' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 800, color: NAVY, fontSize: 12 }}>{l.item}</td>
                          <td style={{ padding: '8px 10px', fontWeight: 600, color: '#1E293B' }}>{l.designation}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', color: '#475569' }}>{fmtM(l.fourn)}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', color: '#94A3B8' }}>{fmtM(l.rev)}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', color: '#475569' }}>{fmtM(l.trans)}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', color: ORANGE, fontWeight: 600 }}>{fmtM(l.pose)}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: NAVY }}>{fmtM(l.htva)}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', color: '#64748B' }}>{fmtM(l.budget)}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: tc }}>{fmtM(l.dec)}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                              <div style={{ width: 36, height: 5, background: '#F1F5F9', borderRadius: 3 }}>
                                <div style={{ width: `${Math.min(l.taux * 100, 100)}%`, height: 5, background: tc, borderRadius: 3 }} />
                              </div>
                              <span style={{ fontSize: 10, fontWeight: 700, color: tc }}>{Math.round(l.taux * 100)}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: NAVY + '0A', borderTop: `2px solid ${NAVY}30` }}>
                      <td colSpan={2} style={{ padding: '9px 10px', fontSize: 12, fontWeight: 800, color: NAVY }}>TOTAL HT</td>
                      <td colSpan={4} />
                      <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 800, color: NAVY }}>{fmtM(totHTVA)}</td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 800, color: '#64748B' }}>{fmtM(totalMarches)}</td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 800, color: GREEN }}>{fmtM(totalDecaisse)}</td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 800, color: GREEN }}>
                        {totalMarches > 0 ? Math.round((totalDecaisse / totalMarches) * 100) : 0}%
                      </td>
                    </tr>
                    <tr style={{ background: '#FFF8F2' }}>
                      <td colSpan={2} style={{ padding: '7px 10px', fontSize: 11, fontWeight: 700, color: ORANGE }}>TVA 18%</td>
                      <td colSpan={4} />
                      <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: ORANGE }}>{fmtM(totHTVA * TVA_R)}</td>
                      <td colSpan={3} />
                    </tr>
                    <tr style={{ background: '#EFF6FF' }}>
                      <td colSpan={2} style={{ padding: '9px 10px', fontSize: 12, fontWeight: 800, color: NAVY }}>TOTAL TTC</td>
                      <td colSpan={4} />
                      <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 800, color: NAVY }}>{fmtM(totHTVA * (1 + TVA_R))}</td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>

            {/* Synthèse avances */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
              {[
                { label: 'Avance de démarrage', pct: '20%', montant: fmtM(totalBudget * 0.20), color: NAVY, desc: 'FA payée au démarrage' },
                { label: 'Avance appro. supports', pct: '10%', montant: fmtM(totalBudget * 0.10), color: ORANGE, desc: 'Appro. poteaux béton' },
                { label: 'Retenue de garantie', pct: '5%', montant: fmtM(totalBudget * 0.05), color: AMBER, desc: 'Libérée à réception déf.' },
              ].map(k => (
                <div key={k.label} style={{ background: '#fff', borderRadius: 10, padding: '14px 16px', border: `1px solid ${k.color}20`, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
                  <div style={{ fontSize: 9, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{k.desc}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: k.color }}>{k.pct}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1E293B', marginTop: 2 }}>{k.label}</div>
                  <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>{k.montant} MFCFA</div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── TAB: DÉCOMPTES PAUE2 ─────────────────────────────────────────────── */}
      {budgetTab === 'decomptes' && (() => {
        const projets = storeProjects.filter(p => domainFilter === 'Tous' || p.domain === domainFilter);
        const totalBudget = projets.reduce((s, p) => s + p.prevu, 0);
        // Décomptes PAUE2 réels adaptés au budget
        const PAUE2_REF = 39_222.379915;  // MFCFA
        const ratio = totalBudget / PAUE2_REF;
        const DECOMPTES = [
          { num: 'Avance démarrage',    refFA: 'FA0273/20', pct: 20.000, ht: 7200.0 * ratio, note: '20% marché de base' },
          { num: 'Avance appro.',        refFA: 'FA0274/20', pct: 10.000, ht: 3600.0 * ratio, note: '10% appro. poteaux béton' },
          { num: 'Décompte N°2',         refFA: 'FA0318/20', pct:  5.005, ht: 1963.2 * ratio, note: '' },
          { num: 'Décompte N°3',         refFA: 'FA0320/20', pct:  5.374, ht: 2107.8 * ratio, note: '' },
          { num: 'Décompte N°4',         refFA: 'FA0321/20', pct:  5.458, ht: 2140.9 * ratio, note: '' },
          { num: 'Décompte N°5',         refFA: 'FA0324/20', pct:  5.377, ht: 2109.1 * ratio, note: '' },
          { num: 'Décompte N°6',         refFA: 'FA0326/20', pct:  3.461, ht: 1357.6 * ratio, note: '' },
          { num: 'Décompte N°7',         refFA: 'FA0322/21', pct:  4.172, ht: 1636.3 * ratio, note: '' },
          { num: 'Décompte N°8',         refFA: 'FA0334/21', pct:  3.100, ht: 1216.0 * ratio, note: '' },
          { num: 'Décompte N°9',         refFA: 'FA0335/21', pct:  3.929, ht: 1541.2 * ratio, note: '' },
          { num: 'Décompte N°10',        refFA: 'FA0371/21', pct:  4.199, ht: 1646.9 * ratio, note: '' },
          { num: 'Décompte N°10 Rév.',   refFA: 'FA0496/21', pct:  1.193, ht:  468.0 * ratio, note: 'Révision fourniture' },
          { num: 'Décompte N°11',        refFA: 'FA0493/21', pct:  8.870, ht: 3479.0 * ratio, note: '' },
          { num: 'Décompte N°11 Rév.',   refFA: 'FA0493/21', pct:  2.532, ht:  993.0 * ratio, note: 'Révision fourniture' },
          { num: 'Décompte N°12',        refFA: 'FA0498/21', pct:  3.622, ht: 1420.5 * ratio, note: '' },
          { num: 'Décompte N°13',        refFA: 'FA0501/22', pct:  2.556, ht: 1002.4 * ratio, note: '' },
          { num: 'Décompte N°14',        refFA: 'FA0503/22', pct:  1.629, ht:  638.8 * ratio, note: '' },
          { num: 'Décompte N°15',        refFA: 'FA0505/22', pct:  0.674, ht:  264.4 * ratio, note: '' },
        ];
        const isAvance = (num: string) => num.includes('Avance');
        const isRev    = (num: string) => num.includes('Rév.');
        const TVA_R = 0.18;
        const rows = DECOMPTES.map((d, i) => {
          const tva  = Math.round(d.ht * TVA_R * 100) / 100;
          const ded_dem  = isAvance(d.num) || isRev(d.num) ? 0 : Math.round(d.ht * 0.28 * 100) / 100;
          const ded_app  = isAvance(d.num) || isRev(d.num) ? 0 : Math.round(d.ht * 0.14 * 100) / 100;
          const ret      = isAvance(d.num) || isRev(d.num) ? 0 : Math.round(d.ht * 0.05 * 100) / 100;
          const net      = d.ht + tva - ded_dem - ded_app - ret;
          const statut   = i < 14 ? 'Payé' : i < 16 ? 'Certifié' : 'Facturé';
          const sColor   = statut === 'Payé' ? GREEN : statut === 'Certifié' ? AMBER : ORANGE;
          return { ...d, tva, ded_dem, ded_app, ret, net, statut, sColor };
        });
        const cumPct = rows.reduce((s, r) => s + r.pct, 0);
        const totHT  = rows.reduce((s, r) => s + r.ht, 0);
        const totTVA = rows.reduce((s, r) => s + r.tva, 0);
        const resteAPayer = Math.max(0, totalBudget - totHT);

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
              {[
                { label: 'Marché de base', val: `${(totalBudget * 0.917).toFixed(0)} M`, sub: '91.7% du total', color: NAVY },
                { label: 'Avenant révision', val: `${(totalBudget * 0.083).toFixed(0)} M`, sub: '8.3% du total', color: ORANGE },
                { label: 'Total facturé', val: `${cumPct.toFixed(1)}%`, sub: `${totHT.toFixed(0)} MFCFA`, color: GREEN },
                { label: 'Reste à facturer', val: `${resteAPayer.toFixed(0)} M`, sub: `${totalBudget > 0 ? (100 - cumPct).toFixed(1) : 0}%`, color: AMBER },
              ].map(k => (
                <div key={k.label} style={{ background: '#fff', borderRadius: 10, padding: '14px 16px', border: `1px solid ${k.color}20`, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
                  <div style={{ fontSize: 9, color: '#94A3B8', textTransform: 'uppercase' }}>{k.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: k.color, marginTop: 3 }}>{k.val}</div>
                  <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>{k.sub}</div>
                </div>
              ))}
            </div>

            {/* Table décomptes */}
            <Card title="Récapitulatif de la Facturation — Style Fiche Excellec PAUE2" subtitle={`${DECOMPTES.length} termes · TVA 18% · MFCFA`}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      {['Terme de facturation', 'N° FA', '%', 'Montant HT', 'TVA 18%', 'Déd. Av. Démar.', 'Déd. Av. Appro.', 'Retenue 5%', 'Net à payer', 'Statut'].map((h, i) => (
                        <th key={i} style={{ padding: '8px 10px', textAlign: i < 2 ? 'left' : 'right', fontSize: 9, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.3px', borderBottom: '2px solid #E2E8F0', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, idx) => (
                      <tr key={idx} style={{
                        borderBottom: '1px solid #F1F5F9',
                        background: isAvance(r.num) ? NAVY + '06' : isRev(r.num) ? ORANGE + '05' : idx % 2 === 0 ? '#fff' : '#FAFBFC',
                        fontStyle: isRev(r.num) ? 'italic' : 'normal',
                      }}>
                        <td style={{ padding: '7px 10px', fontWeight: isAvance(r.num) ? 700 : 500, color: isAvance(r.num) ? NAVY : '#1E293B' }}>
                          {r.num}
                          {r.note && <span style={{ fontSize: 9, color: '#94A3B8', marginLeft: 4 }}>({r.note})</span>}
                        </td>
                        <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: 9.5, color: NAVY, fontWeight: 600 }}>{r.refFA}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', color: '#64748B' }}>{r.pct.toFixed(3)}%</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: NAVY }}>{r.ht.toFixed(1)}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', color: '#94A3B8' }}>{r.tva.toFixed(1)}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', color: r.ded_dem > 0 ? RED : '#CBD5E1' }}>{r.ded_dem > 0 ? `-${r.ded_dem.toFixed(1)}` : '—'}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', color: r.ded_app > 0 ? RED : '#CBD5E1' }}>{r.ded_app > 0 ? `-${r.ded_app.toFixed(1)}` : '—'}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', color: r.ret > 0 ? AMBER : '#CBD5E1' }}>{r.ret > 0 ? `-${r.ret.toFixed(1)}` : '—'}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: r.net >= 0 ? GREEN : RED }}>{r.net.toFixed(1)}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right' }}>
                          <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: `${r.sColor}15`, color: r.sColor }}>{r.statut}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: NAVY + '08', borderTop: `2px solid ${NAVY}30` }}>
                      <td colSpan={2} style={{ padding: '9px 10px', fontWeight: 800, color: NAVY, fontSize: 11 }}>TOTAL FACTURÉ</td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 800, color: NAVY }}>{cumPct.toFixed(2)}%</td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 800, color: NAVY }}>{totHT.toFixed(1)}</td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 700, color: '#94A3B8' }}>{totTVA.toFixed(1)}</td>
                      <td colSpan={5} />
                    </tr>
                    <tr style={{ background: '#FEF3C7' }}>
                      <td colSpan={3} style={{ padding: '8px 10px', fontWeight: 800, color: AMBER, fontSize: 11 }}>RESTE À FACTURER</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: AMBER }}>{resteAPayer.toFixed(1)}</td>
                      <td colSpan={6} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          </div>
        );
      })()}

      {/* ── TAB: COÛTS COLLECTÉS ─────────────────────────────────────────────── */}
      {budgetTab === 'couts_collectes' && (() => {
        const TVA = 0.18;
        const projets = storeProjects.filter(p => domainFilter === 'Tous' || p.domain === domainFilter);
        interface CoutLigne { date: string; fournisseur: string; numFacture: string; tache: string; ht: number; tva: number; ttc: number; statut: 'Certifiée' | 'Payée' | 'En attente' }
        const fournisseurs = ['EIFFAGE Sénégal', 'Bouygues ES', 'SETRAC', 'Africa Energy', 'SOBETA', 'GIE Electra'];
        const taches = ['Fournitures', 'Génie Civil', 'Supervision', 'Études', 'Imprévus'];
        const statuts: CoutLigne['statut'][] = ['Certifiée', 'Payée', 'En attente'];
        const lignes: CoutLigne[] = projets.flatMap((p, pi) =>
          Array.from({ length: 4 }, (_, i) => {
            const ht = Math.round(p.decaisse * 250 * (0.1 + 0.2 * i) / 4) / 10;
            const tvaAmt = Math.round(ht * TVA * 10) / 10;
            const month = String((pi * 3 + i + 1) % 12 + 1).padStart(2, '0');
            return {
              date: `2025-${month}-${String((i * 7 + 5) % 28 + 1).padStart(2, '0')}`,
              fournisseur: fournisseurs[(pi + i) % fournisseurs.length],
              numFacture: `FA-${2025}-${String(pi * 10 + i + 1).padStart(4, '0')}`,
              tache: `${p.code} / ${taches[i % taches.length]}`,
              ht,
              tva: tvaAmt,
              ttc: Math.round((ht + tvaAmt) * 10) / 10,
              statut: statuts[(pi + i) % 3],
            };
          })
        );
        const totHT  = lignes.reduce((s,l)=>s+l.ht, 0);
        const totTVA = lignes.reduce((s,l)=>s+l.tva, 0);
        const totTTC = lignes.reduce((s,l)=>s+l.ttc, 0);
        const statutColor = (s: CoutLigne['statut']) => s === 'Payée' ? GREEN : s === 'Certifiée' ? AMBER : '#94A3B8';
        return (
          <Card title="Coûts Collectés — Transactions par projet / tâche / fournisseur" subtitle={`${lignes.length} factures · TVA 18% SENELEC`}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ background: '#F8FAFC' }}>
                    {['Date', 'Fournisseur', 'N° Facture', 'Tâche / WBS', 'HT (M)', 'TVA (M)', 'TTC (M)', 'Statut'].map((h,i) => (
                      <th key={i} style={{ padding: '9px 12px', textAlign: i >= 4 ? 'right' : 'left', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '2px solid #E2E8F0', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((l, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9', background: idx % 2 === 1 ? '#FAFBFC' : '#fff' }}>
                      <td style={{ padding: '8px 12px', color: '#64748B', fontSize: 10, fontFamily: 'monospace' }}>{l.date}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: '#1E293B' }}>{l.fournisseur}</td>
                      <td style={{ padding: '8px 12px', color: NAVY, fontFamily: 'monospace', fontWeight: 700 }}>{l.numFacture}</td>
                      <td style={{ padding: '8px 12px', color: '#64748B', fontSize: 10 }}>{l.tache}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: NAVY }}>{l.ht.toFixed(1)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#94A3B8' }}>{l.tva.toFixed(1)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: ORANGE }}>{l.ttc.toFixed(1)}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: `${statutColor(l.statut)}18`, color: statutColor(l.statut), border: `1px solid ${statutColor(l.statut)}30` }}>
                          {l.statut}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: NAVY + '08', borderTop: `2px solid ${NAVY}30`, fontWeight: 700 }}>
                    <td colSpan={4} style={{ padding: '9px 12px', fontSize: 12, fontWeight: 800, color: NAVY }}>TOTAL — {lignes.length} factures</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 800, color: NAVY }}>{totHT.toFixed(1)}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', color: '#64748B', fontWeight: 700 }}>{totTVA.toFixed(1)}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 800, color: ORANGE }}>{totTTC.toFixed(1)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        );
      })()}

      {/* ── TAB: VUE D'ENSEMBLE (existing content) ───────────────────────────── */}
      {budgetTab === 'synthese' && <>

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
              <ResponsiveContainer width={180} height={180}>
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
        <SH
          title={`Tableau de bord budgétaire détaillé — ${filteredProjects.length} projets`}
          right={
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                aria-label={`Exporter le budget ${year} en Excel`}
                onClick={() => {
                  downloadExcel(`budget_${year}`, {
                    sheetName: `Budget ${year}`,
                    title: `Tableau de bord budgétaire — Exercice ${year}`,
                    subtitle: `${filteredProjects.length} projets · Montants en MFCFA · SENELEC / DPE`,
                    headers: ['Code', 'Domaine', 'Budget prévu', 'Marchés', 'Décaissé', 'Taux %', 'Solde', 'Statut'],
                    rows: filteredProjects.map(p => [
                      p.code, p.domain,
                      Number(p.prevu.toFixed(1)), Number(p.marches.toFixed(1)), Number(p.decaisse.toFixed(1)),
                      Number(((p.decaisse / p.prevu) * 100).toFixed(1)), Number((p.prevu - p.decaisse).toFixed(1)),
                      p.statut,
                    ]),
                  });
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                  background: '#fff', color: NAVY, border: `1px solid ${NAVY}`, borderRadius: 6,
                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                }}>
                <Download size={13} /> Excel
              </button>
              <button
                aria-label={`Exporter le budget ${year} en PDF`}
                onClick={() => handleExportPDF(`Gestion Budgétaire — Exercice ${year}`, filteredProjects, year)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                  background: NAVY, color: '#fff', border: 'none', borderRadius: 6,
                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                }}>
                <Download size={13} /> PDF
              </button>
            </div>
          }
        />
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

    </div>
    </div>
  );
}
