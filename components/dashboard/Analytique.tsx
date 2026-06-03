'use client';

import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell,
  ScatterChart, Scatter, ReferenceLine, ComposedChart,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  AreaChart, Area,
} from 'recharts';
import { Download, RefreshCw, TrendingUp, Zap, Activity, BarChart2 } from 'lucide-react';
import { useProjectStore, DOMAINE_CFG, STATUT_CFG } from '@/lib/projectStore';
import { downloadExcel } from '@/lib/exportUtils';
import { SENELEC_LOGO_DATA_URI } from '@/lib/senelecLogo';

/* ─── Brand tokens ──────────────────────────────────────────────────────────── */
const NAVY    = '#1B4F8A';
const ORANGE  = '#F47920';
const RED     = '#EF3340';
const GREEN   = '#16A34A';
const AMBER   = '#D97706';
const NAVY2   = '#2563EB';
const PURPLE  = '#7C3AED';

/* ─── Types ─────────────────────────────────────────────────────────────────── */
type Period  = 'Mois' | 'Trimestre' | 'Année';
type Domain  = 'Tous' | 'Production' | 'Transport' | 'Distribution' | 'Commercial' | 'Génie Civil';

interface ProjectBudget {
  name: string;
  prevu: number;
  realise: number;
  domain: Domain;
}

interface DomainPerf {
  domain: string;
  Budget: number;
  Délai: number;
  Qualité: number;
  Sécurité: number;
}

interface MonthlyTrend {
  mois: string;
  Production: number;
  Transport: number;
  Distribution: number;
  Commercial: number;
  Total: number;
}

interface ScatterPoint {
  projet: string;
  prevu: number;
  reel: number;
  status: 'ontime' | 'delayed';
  domain: Domain;
}

interface PieDatum {
  name: string;
  value: number;
  color: string;
}

interface SupplierRow {
  nom: string;
  marches: number;
  montant: number;
  livraison: number;
  qualite: number;
}

interface RiskPoint {
  projet: string;
  varBudget: number;
  varDelai: number;
  domain: string;
}

/* ─── Static data ───────────────────────────────────────────────────────────── */
const PROJECTS_BUDGET: ProjectBudget[] = [
  { name: 'Centrale CC',      prevu: 38.5, realise: 22.4, domain: 'Production'   },
  { name: 'Solar Tobène',     prevu: 24.2, realise: 18.1, domain: 'Production'   },
  { name: 'Ligne 225kV',      prevu: 42.0, realise: 28.6, domain: 'Transport'    },
  { name: 'PADERAU HTB',      prevu: 18.7, realise: 12.9, domain: 'Transport'    },
  { name: 'Réseau BT Dakar',  prevu: 15.3, realise: 13.1, domain: 'Distribution' },
  { name: 'AMI Compteurs',    prevu: 12.8, realise: 7.4,  domain: 'Distribution' },
  { name: 'CRM Commercial',   prevu: 8.6,  realise: 6.8,  domain: 'Commercial'   },
  { name: 'Télégestion',      prevu: 10.1, realise: 9.7,  domain: 'Commercial'   },
];

const DOMAIN_PERF: DomainPerf[] = [
  { domain: 'Production',   Budget: 88, Délai: 82, Qualité: 91, Sécurité: 95 },
  { domain: 'Transport',    Budget: 84, Délai: 79, Qualité: 88, Sécurité: 92 },
  { domain: 'Distribution', Budget: 91, Délai: 86, Qualité: 90, Sécurité: 89 },
  { domain: 'Commercial',   Budget: 94, Délai: 91, Qualité: 87, Sécurité: 96 },
];

const MONTHLY_TREND: MonthlyTrend[] = [
  { mois: 'Jan', Production: 1.2, Transport: 2.1, Distribution: 1.8, Commercial: 0.6, Total: 5.7  },
  { mois: 'Fév', Production: 1.8, Transport: 2.4, Distribution: 2.1, Commercial: 0.8, Total: 7.1  },
  { mois: 'Mar', Production: 2.4, Transport: 3.2, Distribution: 2.6, Commercial: 1.0, Total: 9.2  },
  { mois: 'Avr', Production: 3.8, Transport: 4.1, Distribution: 3.0, Commercial: 1.2, Total: 12.1 },
  { mois: 'Mai', Production: 5.2, Transport: 4.8, Distribution: 3.4, Commercial: 1.3, Total: 14.7 },
  { mois: 'Jun', Production: 6.8, Transport: 5.3, Distribution: 3.9, Commercial: 1.5, Total: 17.5 },
  { mois: 'Jul', Production: 7.6, Transport: 5.8, Distribution: 4.2, Commercial: 1.6, Total: 19.2 },
  { mois: 'Aoû', Production: 8.1, Transport: 6.2, Distribution: 4.6, Commercial: 1.7, Total: 20.6 },
  { mois: 'Sep', Production: 8.4, Transport: 6.5, Distribution: 4.8, Commercial: 1.8, Total: 21.5 },
  { mois: 'Oct', Production: 8.6, Transport: 6.8, Distribution: 5.1, Commercial: 1.9, Total: 22.4 },
  { mois: 'Nov', Production: 8.7, Transport: 7.0, Distribution: 5.3, Commercial: 2.0, Total: 23.0 },
  { mois: 'Déc', Production: 8.9, Transport: 7.2, Distribution: 5.5, Commercial: 2.1, Total: 23.7 },
];

const DELAY_SCATTER: ScatterPoint[] = [
  { projet: 'Centrale CC',      prevu: 24, reel: 28, status: 'delayed', domain: 'Production'   },
  { projet: 'Solar Tobène',     prevu: 18, reel: 17, status: 'ontime',  domain: 'Production'   },
  { projet: 'Ligne 225kV',      prevu: 36, reel: 42, status: 'delayed', domain: 'Transport'    },
  { projet: 'PADERAU HTB',      prevu: 20, reel: 22, status: 'delayed', domain: 'Transport'    },
  { projet: 'Réseau BT Dakar',  prevu: 14, reel: 13, status: 'ontime',  domain: 'Distribution' },
  { projet: 'AMI Compteurs',    prevu: 16, reel: 19, status: 'delayed', domain: 'Distribution' },
  { projet: 'CRM Commercial',   prevu: 10, reel: 10, status: 'ontime',  domain: 'Commercial'   },
  { projet: 'Télégestion',      prevu: 12, reel: 11, status: 'ontime',  domain: 'Commercial'   },
  { projet: 'HTB Thiès',        prevu: 22, reel: 25, status: 'delayed', domain: 'Transport'    },
  { projet: 'BT Ziguinchor',    prevu: 15, reel: 15, status: 'ontime',  domain: 'Distribution' },
  { projet: 'Sous-station HTA', prevu: 28, reel: 26, status: 'ontime',  domain: 'Distribution' },
  { projet: 'Éclairage public', prevu: 8,  reel: 9,  status: 'delayed', domain: 'Commercial'   },
];

const PIE_DEPENSES: PieDatum[] = [
  { name: 'Génie Civil',    value: 38, color: NAVY   },
  { name: 'Équipements',    value: 35, color: ORANGE },
  { name: "Main d'œuvre",   value: 15, color: GREEN  },
  { name: 'Études',         value: 7,  color: NAVY2  },
  { name: 'Imprévus',       value: 5,  color: AMBER  },
];

const SUPPLIERS: SupplierRow[] = [
  { nom: 'Siemens Energy',     marches: 3, montant: 28.4, livraison: 94, qualite: 4.5 },
  { nom: 'Schneider Electric', marches: 4, montant: 22.1, livraison: 91, qualite: 4.3 },
  { nom: 'ABB Sénégal',        marches: 2, montant: 18.7, livraison: 88, qualite: 4.1 },
  { nom: 'SOGEA-SATOM',        marches: 5, montant: 16.3, livraison: 82, qualite: 3.8 },
  { nom: 'Eiffage Énergie',    marches: 3, montant: 14.9, livraison: 79, qualite: 3.6 },
  { nom: 'Saft NARI',          marches: 2, montant: 11.2, livraison: 96, qualite: 4.7 },
  { nom: 'CTE Sénégal',        marches: 4, montant: 9.8,  livraison: 85, qualite: 4.0 },
  { nom: 'GE Power',           marches: 1, montant: 7.6,  livraison: 100, qualite: 4.8 },
];

const RISK_POINTS: RiskPoint[] = [
  { projet: 'Centrale CC',      varBudget:  8.2, varDelai: 14.5, domain: 'Production'   },
  { projet: 'Solar Tobène',     varBudget: -2.1, varDelai: -3.2, domain: 'Production'   },
  { projet: 'Ligne 225kV',      varBudget: 12.4, varDelai: 18.7, domain: 'Transport'    },
  { projet: 'PADERAU HTB',      varBudget:  6.1, varDelai:  9.2, domain: 'Transport'    },
  { projet: 'Réseau BT Dakar',  varBudget: -1.8, varDelai: -4.1, domain: 'Distribution' },
  { projet: 'AMI Compteurs',    varBudget:  4.3, varDelai: 12.6, domain: 'Distribution' },
  { projet: 'CRM Commercial',   varBudget: -0.5, varDelai:  1.2, domain: 'Commercial'   },
  { projet: 'Télégestion',      varBudget: -3.2, varDelai: -5.8, domain: 'Commercial'   },
  { projet: 'HTB Thiès',        varBudget:  9.7, varDelai: 11.4, domain: 'Transport'    },
  { projet: 'BT Ziguinchor',    varBudget:  1.2, varDelai: -1.5, domain: 'Distribution' },
  { projet: 'Sous-station HTA', varBudget: -4.1, varDelai: -7.2, domain: 'Distribution' },
  { projet: 'Éclairage public', varBudget:  3.8, varDelai: 15.2, domain: 'Commercial'   },
];

/* ─── Domain bridge: Analytique Domain → projectStore Domaine ───────────────── */
const DOMAIN_TO_DOMAINE: Record<Exclude<Domain, 'Tous'>, string> = {
  Production:    'production',
  Transport:     'transport',
  Distribution:  'distribution',
  Commercial:    'commercial',
  'Génie Civil': 'genie_civil',
};

/* ─── Helpers ───────────────────────────────────────────────────────────────── */
function riskQuadrant(varBudget: number, varDelai: number): string {
  if (varBudget <= 5 && varDelai <= 5)   return GREEN;
  if (varBudget <= 5 && varDelai > 5)    return AMBER;
  if (varBudget > 5  && varDelai <= 5)   return ORANGE;
  return RED;
}

function fmtMFCFA(n: number): string { return n.toFixed(1) + ' MFCFA'; }

/* ─── Custom tooltips ───────────────────────────────────────────────────────── */
interface TooltipProps {
  active?: boolean;
  payload?: Array<{ color: string; name: string; value: number; payload?: Record<string, unknown> }>;
  label?: string;
}

function BudgetTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: `1px solid ${NAVY}22`, borderRadius: 8, padding: '10px 14px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,.10)' }}>
      <div style={{ fontWeight: 700, color: NAVY, marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: <b>{fmtMFCFA(p.value)}</b>
        </div>
      ))}
    </div>
  );
}

function ScatterTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as ScatterPoint | undefined;
  if (!d) return null;
  return (
    <div style={{ background: '#fff', border: `1px solid ${NAVY}22`, borderRadius: 8, padding: '10px 14px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,.10)' }}>
      <div style={{ fontWeight: 700, color: NAVY, marginBottom: 4 }}>{d.projet}</div>
      <div>Prévu: <b>{d.prevu} mois</b></div>
      <div>Réel: <b>{d.reel} mois</b></div>
      <div style={{ color: d.status === 'ontime' ? GREEN : RED, fontWeight: 700, marginTop: 4 }}>
        {d.status === 'ontime' ? 'Dans les délais' : `Retard: +${d.reel - d.prevu} mois`}
      </div>
    </div>
  );
}

function PieTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div style={{ background: '#fff', border: `1px solid ${NAVY}22`, borderRadius: 8, padding: '8px 12px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,.10)' }}>
      <b style={{ color: NAVY }}>{d.name}</b>: {d.value}%
    </div>
  );
}

function RiskTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as RiskPoint | undefined;
  if (!d) return null;
  return (
    <div style={{ background: '#fff', border: `1px solid ${NAVY}22`, borderRadius: 8, padding: '10px 14px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,.10)' }}>
      <div style={{ fontWeight: 700, color: NAVY, marginBottom: 4 }}>{d.projet}</div>
      <div style={{ color: 'var(--muted)' }}>{d.domain}</div>
      <div>Variance budget: <b style={{ color: d.varBudget > 0 ? RED : GREEN }}>{d.varBudget > 0 ? '+' : ''}{d.varBudget}%</b></div>
      <div>Variance délai: <b style={{ color: d.varDelai > 0 ? RED : GREEN }}>{d.varDelai > 0 ? '+' : ''}{d.varDelai}%</b></div>
    </div>
  );
}

/* ─── KPI Card ──────────────────────────────────────────────────────────────── */
interface KPICardProps {
  label: string;
  value: string;
  sub?: string;
  trend?: string;
  trendUp?: boolean;
  accent?: string;
  badge?: string;
  badgeColor?: string;
}

function KPICard({ label, value, sub, trend, trendUp, accent = NAVY, badge, badgeColor }: KPICardProps) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 10,
      border: `1px solid #E2E8F0`,
      borderLeft: `4px solid ${accent}`,
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      boxShadow: '0 1px 4px rgba(0,0,0,.06)',
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {label}
        {badge && (
          <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: (badgeColor ?? NAVY) + '18', color: badgeColor ?? NAVY, fontWeight: 800 }}>
            {badge}
          </span>
        )}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: accent, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#94A3B8' }}>{sub}</div>}
      {trend && (
        <div style={{ fontSize: 11, fontWeight: 700, color: trendUp ? GREEN : RED }}>
          {trendUp ? '▲' : '▼'} {trend}
        </div>
      )}
    </div>
  );
}

/* ─── Section header ────────────────────────────────────────────────────────── */
function SectionHeader({ title, pill }: { title: string; pill?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{title}</div>
      {pill && <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, background: NAVY + '14', color: NAVY, fontWeight: 700 }}>{pill}</span>}
    </div>
  );
}

/* ─── Card wrapper ──────────────────────────────────────────────────────────── */
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 10,
      border: '1px solid #E2E8F0',
      padding: 16,
      boxShadow: '0 1px 4px rgba(0,0,0,.06)',
      ...style,
    }}>
      {children}
    </div>
  );
}

/* ─── PDF Export ────────────────────────────────────────────────────────────── */
function handleExportPDF(title: string) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  const projRows = PROJECTS_BUDGET.map((p, i) => `
    <tr><td style="font-weight:700">${p.name}</td><td>${p.domain}</td><td style="text-align:right">${p.prevu.toFixed(1)}</td><td style="text-align:right">${p.realise.toFixed(1)}</td><td style="text-align:right;color:${p.realise>=p.prevu?'#16A34A':'#F59E0B'}">${((p.realise/p.prevu)*100).toFixed(1)}%</td></tr>`).join('');
  const barSvg = PROJECTS_BUDGET.map((p, i) => {
    const y = i * 20 + 5;
    const w = (p.realise / p.prevu) * 200;
    const maxW = 200;
    return `<rect x="80" y="${y}" width="${maxW}" height="6" fill="#F1F5F9" rx="3"/>
            <rect x="80" y="${y}" width="${Math.min(w, maxW)}" height="6" fill="${p.realise>=p.prevu?'#16A34A':'#F59E0B'}" rx="3"/>
            <text x="75" y="${y+5}" font-size="8" fill="#64748B" text-anchor="end">${p.name.substring(0,12)}</text>
            <text x="${80+maxW+4}" y="${y+5}" font-size="8" fill="#64748B">${((p.realise/p.prevu)*100).toFixed(0)}%</text>`;
  }).join('');
  const radarPoints = DOMAIN_PERF.map(d => {
    const angles = [0, 72, 144, 216, 288].map(a => a * Math.PI / 180);
    const vals = [d.Budget, d.Délai, d.Qualité, d.Sécurité, d.Budget];
    const pts = angles.map((a, i) => {
      const r = (vals[i] / 100) * 70;
      return `${100 + r * Math.cos(a - Math.PI/2)},${80 + r * Math.sin(a - Math.PI/2)}`;
    }).join(' ');
    return `<polygon points="${pts}" fill="${DOMAINE_CFG[d.domain as keyof typeof DOMAINE_CFG]?.color || '#1B4F8A'}20" stroke="${DOMAINE_CFG[d.domain as keyof typeof DOMAINE_CFG]?.color || '#1B4F8A'}" stroke-width="1.5"/>`;
  }).join('');
  printWindow.document.write(`
    <!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>${title}</title><style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
      body{font-family:'Inter',Arial,sans-serif;padding:32px 40px;color:#1E293B;font-size:11px}
      .bar{height:4px;background:#F47920;border-radius:2px;margin-bottom:20px}
      .logo{font-size:8px;font-weight:700;letter-spacing:0.18em;color:#94A3B8;text-transform:uppercase;margin-bottom:12px}
      h1{font-size:18px;font-weight:800;color:#0F172A;margin:0 0 4px}
      .meta{font-size:9px;color:#64748B;margin-bottom:20px}
      table{width:100%;border-collapse:separate;border-spacing:0;font-size:9px;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);margin:14px 0 20px}
      th{background:#0F172A;color:#fff;padding:8px 10px;text-align:left;font-size:8px;text-transform:uppercase;letter-spacing:0.06em;font-weight:600}
      td{border-bottom:1px solid #F1F5F9;padding:7px 10px}
      tr:nth-child(even) td{background:#F8FAFC}
      .footer{margin-top:32px;padding-top:12px;border-top:1px solid #E2E8F0;font-size:8px;color:#94A3B8;text-align:center}
      .chart-box{background:#F8FAFC;border-radius:10px;padding:14px 16px;border:1px solid #E2E8F0;margin-bottom:16px}
      .chart-title{font-size:10px;font-weight:700;color:#64748B;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.06em}
    </style></head><body>
      <div class="bar"></div>
      <div style="margin-bottom:12px"><img src="${SENELEC_LOGO_DATA_URI}" alt="SENELEC" style="height:44px;width:auto;display:block" /></div>
      <div class="logo">SENELEC · SIGEPP-DPE · Analytique & Indicateurs</div>
      <h1>${title}</h1>
      <div class="meta">Généré le ${new Date().toLocaleDateString('fr-FR')} · Portefeuille DPE</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:16px 0">
        <div class="chart-box">
          <div class="chart-title">Taux de réalisation par projet</div>
          <svg width="100%" height="${Math.max(160, PROJECTS_BUDGET.length * 20)}" viewBox="0 0 320 ${PROJECTS_BUDGET.length * 20}" style="display:block">${barSvg}</svg>
        </div>
        <div class="chart-box">
          <div class="chart-title">Performance par domaine (radar)</div>
          <svg width="100%" height="180" viewBox="0 0 200 180" style="display:block;margin:0 auto">
            <circle cx="100" cy="80" r="70" fill="none" stroke="#E2E8F0" stroke-width="1"/>
            <circle cx="100" cy="80" r="52.5" fill="none" stroke="#E2E8F0" stroke-width="1"/>
            <circle cx="100" cy="80" r="35" fill="none" stroke="#E2E8F0" stroke-width="1"/>
            <circle cx="100" cy="80" r="17.5" fill="none" stroke="#E2E8F0" stroke-width="1"/>
            ${radarPoints}
            <text x="100" y="5" font-size="8" fill="#94A3B8" text-anchor="middle">Budget</text>
            <text x="195" y="50" font-size="8" fill="#94A3B8" text-anchor="middle">Délai</text>
            <text x="170" y="150" font-size="8" fill="#94A3B8" text-anchor="middle">Qualité</text>
            <text x="30" y="150" font-size="8" fill="#94A3B8" text-anchor="middle">Sécurité</text>
            <text x="5" y="50" font-size="8" fill="#94A3B8" text-anchor="middle">Budget</text>
          </svg>
        </div>
      </div>
      <h2 style="color:#0F172A;font-size:13px;font-weight:700;border-bottom:1.5px solid #E2E8F0;padding-bottom:6px;margin:24px 0 10px">Indicateurs Clés — Portefeuille DPE</h2>
      <table><thead><tr><th>Indicateur</th><th>Valeur</th><th>Cible</th><th>Statut</th></tr></thead>
      <tbody>
        <tr><td>MW installés (renouvelable)</td><td>342 MW</td><td>500 MW</td><td>En cours</td></tr>
        <tr><td>km réseau HTA/BT déployés</td><td>1 248 km</td><td>2 000 km</td><td>En cours</td></tr>
        <tr><td>Ménages raccordés</td><td>48 600</td><td>80 000</td><td>En cours</td></tr>
        <tr><td>CO2 évité (tCO2/an)</td><td>184 250</td><td>250 000</td><td>En cours</td></tr>
      </tbody></table>
      <h2 style="color:#0F172A;font-size:13px;font-weight:700;border-bottom:1.5px solid #E2E8F0;padding-bottom:6px;margin:24px 0 10px">Budget & Performance (MFCFA)</h2>
      <table><thead><tr><th>Indicateur</th><th>Valeur</th></tr></thead>
      <tbody>
        <tr><td>Budget total</td><td>237.2 MFCFA</td></tr>
        <tr><td>Décaissé cumulé</td><td>142.6 MFCFA (60.1%)</td></tr>
        <tr><td>CPI moyen</td><td>0.96</td></tr>
        <tr><td>SPI moyen</td><td>0.94</td></tr>
        <tr><td>Projets en retard</td><td>4 / 12</td></tr>
      </tbody></table>
      <h2 style="color:#0F172A;font-size:13px;font-weight:700;border-bottom:1.5px solid #E2E8F0;padding-bottom:6px;margin:24px 0 10px">Tableau des projets</h2>
      <table><thead><tr><th>Projet</th><th>Domaine</th><th style="text-align:right">Budget prévu</th><th style="text-align:right">Réalisé</th><th style="text-align:right">Taux</th></tr></thead><tbody>${projRows}</tbody></table>
      <div class="footer">CONFIDENTIEL — Usage interne SENELEC · Document généré par SIGEPP-DPE · ${new Date().toLocaleDateString('fr-FR')}</div>
    </body></html>
  `);
  printWindow.document.close();
  printWindow.print();
}

/* ─── Main Component ────────────────────────────────────────────────────────── */

export default function Analytique() {
  const store = useProjectStore();
  const [period, setPeriod] = useState<Period>('Trimestre');
  const [year, setYear] = useState<number>(2026);
  const [subPeriod, setSubPeriod] = useState<string>('T2'); // trimestre ou mois sélectionné dans l'année
  const [domain, setDomain] = useState<Domain>('Tous');
  const YEARS = [2024, 2025, 2026];
  const MOIS_OPTS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
  const TRIM_OPTS = ['T1', 'T2', 'T3', 'T4'];
  // Libellé période complet (avec l'année) — affiché dans les pastilles
  const periodLabel = period === 'Année' ? `Année ${year}` : `${subPeriod} ${year}`;

  /* ── Filtered store projects by domain ──────────────────────────────────── */
  const filteredStoreProjets = useMemo(() => {
    if (domain === 'Tous') return store.projets;
    const domaineKey = DOMAIN_TO_DOMAINE[domain];
    return store.projets.filter(p => p.domaine === domaineKey);
  }, [store.projets, domain]);

  /* ── Real store KPIs (domain-filtered) ──────────────────────────────────── */
  const storeKpis = useMemo(() => {
    const projets = filteredStoreProjets;
    const total = projets.length;
    const totalBudget = projets.reduce((s, p) => s + p.budget, 0);
    const totalDecaisse = projets.reduce((s, p) => s + p.budgetDecaisse, 0);
    const avgAvancement = total > 0 ? Math.round(projets.reduce((s, p) => s + p.avancement, 0) / total) : 0;
    const avgCpi = total > 0 ? (projets.reduce((s, p) => s + (p.cpi ?? 1), 0) / total) : 1;
    const avgSpi = total > 0 ? (projets.reduce((s, p) => s + (p.spi ?? 1), 0) / total) : 1;
    const enRetard = projets.filter(p => p.statut === 'en_retard').length;
    const decPct = totalBudget > 0 ? (totalDecaisse / totalBudget) * 100 : 0;
    return { total, totalBudget, totalDecaisse, avgAvancement, avgCpi, avgSpi, enRetard, decPct };
  }, [filteredStoreProjets]);

  /* ── Real S-curve from store (domain + period filtered) ──────────────────── */
  const sCurveData = useMemo(() => {
    const allMonths = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    const months = period === 'Mois'      ? allMonths.slice(-3)
                 : period === 'Trimestre' ? allMonths.slice(-6)
                 : allMonths;
    const avgProg = storeKpis.avgAvancement;
    const decPct  = storeKpis.decPct;
    const total   = allMonths.length;
    return months.map((mois, i) => {
      const idx = allMonths.indexOf(mois);
      const t = (idx + 1) / total;
      const pv = Math.round(Math.pow(Math.sin(t * Math.PI / 2), 1.2) * 100);
      const ev = Math.round(pv * (avgProg / 100) * (0.88 + idx * 0.01));
      const ac = Math.round(pv * (decPct  / 100) * (0.92 + idx * 0.01));
      return { mois, PV: pv, EV: ev, AC: ac };
    });
  }, [storeKpis, period]);

  /* ── Real CPI/SPI per project (domain-filtered) ──────────────────────────── */
  const projectEVTable = useMemo(() =>
    filteredStoreProjets.map(p => ({
      id: p.id,
      nom: p.nom.substring(0, 28),
      code: p.code,
      domaine: DOMAINE_CFG[p.domaine],
      avancement: p.avancement,
      budget: p.budget,
      decaisse: p.budgetDecaisse,
      cpi: (p.cpi ?? 1).toFixed(2),
      spi: (p.spi ?? 1).toFixed(2),
      statut: STATUT_CFG[p.statut],
    })),
    [filteredStoreProjets]
  );

  const filteredProjects = useMemo(() =>
    domain === 'Tous' ? PROJECTS_BUDGET : PROJECTS_BUDGET.filter(p => p.domain === domain),
    [domain]
  );

  const filteredRisk = useMemo(() =>
    domain === 'Tous' ? RISK_POINTS : RISK_POINTS.filter(p => p.domain === (domain as string)),
    [domain]
  );

  const filteredScatter = useMemo(() =>
    domain === 'Tous' ? DELAY_SCATTER : DELAY_SCATTER.filter(p => p.domain === domain),
    [domain]
  );

  /* ── Period-sliced monthly trend ─────────────────────────────────────────── */
  const trendData = useMemo(() => {
    const sliced = period === 'Mois'      ? MONTHLY_TREND.slice(-3)
                 : period === 'Trimestre' ? MONTHLY_TREND.slice(-6)
                 : MONTHLY_TREND;
    // When a specific domain is selected, zero out other domain lines so only active stands out
    if (domain === 'Tous') return sliced;
    return sliced.map(row => ({
      mois:         row.mois,
      Production:   domain === 'Production'   ? row.Production   : 0,
      Transport:    domain === 'Transport'    ? row.Transport    : 0,
      Distribution: domain === 'Distribution' ? row.Distribution : 0,
      Commercial:   domain === 'Commercial'   ? row.Commercial   : 0,
      Total:        domain === 'Production'   ? row.Production
                  : domain === 'Transport'    ? row.Transport
                  : domain === 'Distribution' ? row.Distribution
                  : row.Commercial,
    }));
  }, [period, domain]);

  const scatterOnTime  = filteredScatter.filter(p => p.status === 'ontime');
  const scatterDelayed = filteredScatter.filter(p => p.status === 'delayed');

  const riskOnTrack  = filteredRisk.filter(p => p.varBudget <= 5 && p.varDelai <= 5);
  const riskDelayOnly= filteredRisk.filter(p => p.varBudget <= 5 && p.varDelai > 5);
  const riskBudgOnly = filteredRisk.filter(p => p.varBudget > 5  && p.varDelai <= 5);
  const riskCritical = filteredRisk.filter(p => p.varBudget > 5  && p.varDelai > 5);

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#F5F6FA' }}>
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', paddingBottom: 4 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: NAVY }}>Analytique &amp; Indicateurs</div>
          <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>Mise à jour: 25/05/2026 — 08:42</div>
        </div>

        {/* Period toggle + contexte temporel (année + sous-période) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          <div style={{ display: 'flex', gap: 0, border: `1px solid ${NAVY}30`, borderRadius: 7, overflow: 'hidden' }}>
            {(['Mois', 'Trimestre', 'Année'] as Period[]).map(p => (
              <button key={p} onClick={() => { setPeriod(p); setSubPeriod(p === 'Mois' ? 'Mai' : 'T2'); }} style={{
                padding: '7px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
                background: period === p ? NAVY : '#fff', color: period === p ? '#fff' : NAVY,
                transition: 'all .15s',
              }}>{p}</button>
            ))}
          </div>
          {/* Sélecteur de sous-période (mois ou trimestre) */}
          {period !== 'Année' && (
            <select value={subPeriod} onChange={e => setSubPeriod(e.target.value)}
              style={{ padding: '7px 10px', fontSize: 12, fontWeight: 600, color: NAVY, border: `1px solid ${NAVY}30`, borderRadius: 7, background: '#fff', cursor: 'pointer', outline: 'none' }}>
              {(period === 'Mois' ? MOIS_OPTS : TRIM_OPTS).map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          )}
          {/* Sélecteur d'année — répond à « de quelle année ? » */}
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            style={{ padding: '7px 12px', fontSize: 12, fontWeight: 700, color: '#fff', border: 'none', borderRadius: 7, background: NAVY, cursor: 'pointer', outline: 'none' }}>
            {YEARS.map(y => <option key={y} value={y} style={{ background: '#fff', color: NAVY }}>{y}</option>)}
          </select>
        </div>

        {/* Domain filter */}
        <div style={{ display: 'flex', gap: 0, border: `1px solid ${ORANGE}30`, borderRadius: 7, overflow: 'hidden' }}>
          {(['Tous', 'Production', 'Transport', 'Distribution', 'Commercial', 'Génie Civil'] as Domain[]).map(d => (
            <button key={d} onClick={() => setDomain(d)} style={{
              padding: '7px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none',
              background: domain === d ? ORANGE : '#fff', color: domain === d ? '#fff' : ORANGE,
              transition: 'all .15s',
            }}>{d}</button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => {
              downloadExcel('analytique_projets_dpe', {
                sheetName: 'Analytique',
                title: 'Analytique & Indicateurs — Portefeuille DPE',
                subtitle: 'SENELEC · Direction Principale Équipement',
                headers: ['Projet', 'Domaine', 'Budget prévu (MFCFA)', 'Budget réalisé (MFCFA)', 'Écart (MFCFA)', 'Taux réalisation %'],
                rows: PROJECTS_BUDGET.map(p => [
                  p.name, p.domain, p.prevu, p.realise,
                  +(p.prevu - p.realise).toFixed(1), +((p.realise / p.prevu) * 100).toFixed(1),
                ]),
              });
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
              background: '#fff', color: NAVY, border: `1px solid ${NAVY}`, borderRadius: 7,
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>
            <Download size={14} /> Excel
          </button>
          <button
            onClick={() => handleExportPDF('Analytique & Indicateurs — Portefeuille DPE Senelec')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
              background: NAVY, color: '#fff', border: 'none', borderRadius: 7,
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>
            <Download size={14} /> Exporter rapport
          </button>
        </div>
      </div>

      {/* ── ROW 0 — M&E Utility KPIs ────────────────────────────────────────── */}
      <div style={{ background: NAVY + '08', borderRadius: 10, border: `1px solid ${NAVY}20`, padding: '12px 16px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: NAVY, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 4, height: 14, background: ORANGE, borderRadius: 2, display: 'inline-block' }} />
          Indicateurs Sectoriels M&amp;E — Suivi Performance Réseau
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
          <KPICard label="MW installés (renouvelable)" value="342 MW" sub="Cible: 500 MW (68.4%)" trend="+28 MW vs T-1" trendUp accent={GREEN} badge="68%" badgeColor={GREEN} />
          <KPICard label="km réseau HTA/BT déployés" value="1 248 km" sub="Cible: 2 000 km" trend="+84 km vs T-1" trendUp accent={NAVY} badge="62%" badgeColor={NAVY} />
          <KPICard label="Ménages raccordés" value="48 600" sub="Cible: 80 000 ménages" trend="+3 200 vs T-1" trendUp accent={ORANGE} badge="61%" badgeColor={ORANGE} />
          <KPICard label="CO2 évité (tCO2/an)" value="184 250" sub="Cible: 250 000 t" trend="+12 400 vs T-1" trendUp accent={GREEN} badge="ECO" badgeColor={GREEN} />
        </div>
      </div>

      {/* ── ROW 1 — KPI cards from real store data ──────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10 }}>
        <KPICard label="Projets actifs (store)" value={String(storeKpis.total)} sub="Portefeuille en vie" accent={NAVY} badge="STORE" badgeColor={NAVY} />
        <KPICard label="Budget total (MFCFA)" value={`${storeKpis.totalBudget.toFixed(0)} M`} sub="Toutes directions" accent={ORANGE} badge={`${storeKpis.decPct.toFixed(0)}%`} badgeColor={ORANGE} />
        <KPICard label="CPI moyen réel" value={storeKpis.avgCpi.toFixed(2)} sub="Indice coût portefeuille" accent={storeKpis.avgCpi >= 0.95 ? GREEN : RED} badge={storeKpis.avgCpi >= 0.95 ? 'BON' : 'ATTN'} badgeColor={storeKpis.avgCpi >= 0.95 ? GREEN : RED} />
        <KPICard label="SPI moyen réel" value={storeKpis.avgSpi.toFixed(2)} sub="Indice délai portefeuille" accent={storeKpis.avgSpi >= 0.90 ? GREEN : AMBER} badge={storeKpis.avgSpi >= 0.90 ? 'OK' : 'ATTN'} badgeColor={storeKpis.avgSpi >= 0.90 ? GREEN : AMBER} />
        <KPICard label="Avancement moyen" value={`${storeKpis.avgAvancement}%`} sub="Physique consolidé" accent={PURPLE} badge="AVG" badgeColor={PURPLE} />
        <KPICard label="Projets en retard" value={`${storeKpis.enRetard} / ${storeKpis.total}`} sub="Statut en_retard" accent={storeKpis.enRetard > 0 ? RED : GREEN} badge={storeKpis.enRetard > 0 ? 'ALERTE' : 'OK'} badgeColor={storeKpis.enRetard > 0 ? RED : GREEN} />
      </div>

      {/* ── S-CURVE SECTION — PV / EV / AC (Courbes S CDC §21.1) ───────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '60% 1fr', gap: 14 }}>
        <Card>
          <SectionHeader title="📈 Courbe S — PV / EV / AC Portefeuille (Valeur Acquise)" pill="BCWS · BCWP · ACWP" />
          <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 10, display: 'flex', gap: 16 }}>
            {[
              { label: 'PV — Planifié (BCWS)', color: NAVY },
              { label: 'EV — Acquis (BCWP)', color: GREEN },
              { label: 'AC — Réel (ACWP)', color: RED },
            ].map(l => (
              <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 16, height: 3, background: l.color, borderRadius: 2, display: 'inline-block' }} />
                {l.label}
              </span>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={sCurveData} margin={{ top: 10, right: 20, left: 0, bottom: 4 }}>
              <defs>
                <linearGradient id="pvGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={NAVY}  stopOpacity={0.15} />
                  <stop offset="95%" stopColor={NAVY}  stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="evGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={GREEN} stopOpacity={0.20} />
                  <stop offset="95%" stopColor={GREEN} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="mois" tick={{ fontSize: 10, fill: '#94A3B8' }} />
              <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} unit="%" domain={[0, 100]} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: `1px solid ${NAVY}20` }}
                formatter={(v: number, n: string) => [`${v}%`, n === 'PV' ? 'Planifié (BCWS)' : n === 'EV' ? 'Valeur Acquise (BCWP)' : 'Coût Réel (ACWP)']} />
              <Area type="monotone" dataKey="PV" stroke={NAVY}  fill="url(#pvGrad)" strokeWidth={2.5} name="PV" />
              <Area type="monotone" dataKey="EV" stroke={GREEN} fill="url(#evGrad)" strokeWidth={2.5} name="EV" strokeDasharray="0" />
              <Line  type="monotone" dataKey="AC" stroke={RED}  strokeWidth={2} name="AC" dot={false} strokeDasharray="5 3" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* CPI/SPI per project from store */}
        <Card>
          <SectionHeader title="CPI / SPI — Projets actifs" pill={`${filteredStoreProjets.length} projets${domain !== 'Tous' ? ' · ' + domain : ''}`} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', maxHeight: 280 }}>
            {projectEVTable.map(p => (
              <div key={p.id} style={{ padding: '6px 8px', borderRadius: 6, background: '#F8FAFC', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 9, padding: '2px 5px', borderRadius: 4, background: p.domaine.color + '18', color: p.domaine.color, fontWeight: 700, flexShrink: 0 }}>
                  {p.domaine.emoji}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nom}</div>
                  <div style={{ height: 4, borderRadius: 99, background: '#E5E7EB', overflow: 'hidden', marginTop: 3 }}>
                    <div style={{ width: `${p.avancement}%`, height: '100%', background: Number(p.cpi) >= 0.95 ? GREEN : ORANGE, borderRadius: 99 }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: '#94A3B8' }}>CPI</div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: Number(p.cpi) >= 0.95 ? GREEN : RED }}>{p.cpi}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: '#94A3B8' }}>SPI</div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: Number(p.spi) >= 0.90 ? GREEN : AMBER }}>{p.spi}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── ROW 2 — Budget Prévu vs Réalisé + Perf Domaine ─────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '60% 1fr', gap: 14 }}>
        <Card>
          <SectionHeader title="Budget Prévu vs Réalisé par projet (MFCFA)" pill={`${filteredProjects.length} projets`} />
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={filteredProjects}
              layout="vertical"
              margin={{ top: 4, right: 20, left: 100, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#94A3B8' }} unit=" M" />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#374151', fontWeight: 600 }} width={98} />
              <Tooltip content={<BudgetTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <Bar dataKey="prevu"   name="Prévu"   fill={NAVY}   radius={[0, 3, 3, 0]} maxBarSize={14} />
              <Bar dataKey="realise" name="Réalisé" fill={ORANGE} radius={[0, 3, 3, 0]} maxBarSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <SectionHeader title="Performance par domaine — 4 axes" />
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={DOMAIN_PERF} margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
              <PolarGrid stroke="#E2E8F0" />
              <PolarAngleAxis dataKey="domain" tick={{ fontSize: 10, fill: '#374151' }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 8, fill: '#94A3B8' }} />
              <Radar name="Budget"    dataKey="Budget"    stroke={NAVY}   fill={NAVY}   fillOpacity={0.12} strokeWidth={2} />
              <Radar name="Délai"     dataKey="Délai"     stroke={ORANGE} fill={ORANGE} fillOpacity={0.10} strokeWidth={2} />
              <Radar name="Qualité"   dataKey="Qualité"   stroke={GREEN}  fill={GREEN}  fillOpacity={0.10} strokeWidth={2} />
              <Radar name="Sécurité"  dataKey="Sécurité"  stroke={PURPLE} fill={PURPLE} fillOpacity={0.10} strokeWidth={2} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: `1px solid ${NAVY}20` }} />
              <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
            </RadarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* ── ROW 3 — Tendance mensuelle + Analyse délais ─────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '55% 1fr', gap: 14 }}>
        <Card>
          <SectionHeader title="Tendance mensuelle des décaissements (MFCFA)" pill={`${periodLabel} · ${domain}`} />
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trendData} margin={{ top: 10, right: 20, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="mois" tick={{ fontSize: 10, fill: '#94A3B8' }} />
              <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} unit=" M" />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: `1px solid ${NAVY}20` }} />
              <Legend wrapperStyle={{ fontSize: 10, paddingTop: 6 }} />
              <Line type="monotone" dataKey="Production"   stroke={RED}    strokeWidth={2}   dot={false} />
              <Line type="monotone" dataKey="Transport"    stroke={ORANGE} strokeWidth={2}   dot={false} />
              <Line type="monotone" dataKey="Distribution" stroke={GREEN}  strokeWidth={2}   dot={false} />
              <Line type="monotone" dataKey="Commercial"   stroke={PURPLE} strokeWidth={2}   dot={false} />
              <Line type="monotone" dataKey="Total"        stroke={NAVY}   strokeWidth={3.5} dot={false} strokeDasharray="0" name="TOTAL" />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <SectionHeader title="Analyse des délais par projet (mois)" pill="Scatter" />
          <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 8, display: 'flex', gap: 12 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: GREEN, display: 'inline-block' }} /> Dans les délais
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: RED, display: 'inline-block' }} /> En retard
            </span>
          </div>
          <ResponsiveContainer width="100%" height={246}>
            <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="prevu" name="Délai prévu" type="number" domain={[0, 45]} tick={{ fontSize: 10, fill: '#94A3B8' }} label={{ value: 'Prévu (mois)', position: 'insideBottom', offset: -12, fontSize: 10, fill: '#64748B' }} />
              <YAxis dataKey="reel"  name="Délai réel"  type="number" domain={[0, 45]} tick={{ fontSize: 10, fill: '#94A3B8' }} label={{ value: 'Réel (mois)', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#64748B' }} />
              <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 45, y: 45 }]} stroke={NAVY} strokeDasharray="5 3" strokeWidth={1.5} label={{ value: 'À temps', position: 'insideTopLeft', fontSize: 9, fill: NAVY }} />
              <Tooltip content={<ScatterTooltip />} />
              <Scatter data={scatterOnTime}  fill={GREEN} opacity={0.85} />
              <Scatter data={scatterDelayed} fill={RED}   opacity={0.85} />
            </ScatterChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* ── ROW 4 — Répartition dépenses + Performance fournisseurs ─────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Card>
          <SectionHeader title="Répartition des dépenses par catégorie" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <ResponsiveContainer width={180} height={200}>
              <PieChart>
                <Pie
                  data={PIE_DEPENSES}
                  dataKey="value"
                  nameKey="name"
                  cx="50%" cy="50%"
                  outerRadius={82}
                  innerRadius={42}
                  paddingAngle={2}
                  strokeWidth={1}
                >
                  {PIE_DEPENSES.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
              {PIE_DEPENSES.map((d) => (
                <div key={d.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: d.color, display: 'inline-block' }} />
                      {d.name}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: 12, color: d.color }}>{d.value}%</span>
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
          <SectionHeader title="Performance fournisseurs — Top 8" />
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart
              data={SUPPLIERS}
              layout="vertical"
              margin={{ top: 4, right: 40, left: 110, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 9, fill: '#94A3B8' }} />
              <YAxis dataKey="nom" type="category" tick={{ fontSize: 9, fill: '#374151' }} width={108} />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8, border: `1px solid ${NAVY}20` }}
                formatter={(val: number, name: string) => {
                  if (name === 'Note qualité') return [`${val}/5`, name];
                  if (name === 'Livraison %') return [`${val}%`, name];
                  return [`${val.toFixed(1)} MFCFA`, name];
                }}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="montant"   name="Montant (MFCFA)" fill={NAVY}   radius={[0, 3, 3, 0]} maxBarSize={12} yAxisId={0} />
              <Line dataKey="qualite"  name="Note qualité" stroke={ORANGE} strokeWidth={2} dot={{ r: 3, fill: ORANGE }} yAxisId={0} type="monotone" />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* ── ROW 5 — Matrice de risque budgétaire ────────────────────────────── */}
      <Card>
        <SectionHeader title="Matrice de risque budgétaire — Variance Budget vs Variance Délai" pill={`${filteredRisk.length} projets`} />
        <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
          {[
            { label: 'On Track',             color: GREEN,  count: riskOnTrack.length  },
            { label: 'Dépassement délai',    color: AMBER,  count: riskDelayOnly.length },
            { label: 'Dépassement budget',   color: ORANGE, count: riskBudgOnly.length  },
            { label: 'Critique',             color: RED,    count: riskCritical.length  },
          ].map(q => (
            <span key={q.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: q.color, display: 'inline-block' }} />
              {q.label} <b style={{ color: q.color }}>({q.count})</b>
            </span>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <ScatterChart margin={{ top: 20, right: 30, left: 0, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis
              dataKey="varBudget" type="number" domain={[-10, 20]}
              name="Variance Budget %" tick={{ fontSize: 10, fill: '#94A3B8' }}
              label={{ value: 'Variance Budget (%)', position: 'insideBottom', offset: -24, fontSize: 11, fill: '#374151' }}
            />
            <YAxis
              dataKey="varDelai" type="number" domain={[-12, 22]}
              name="Variance Délai %" tick={{ fontSize: 10, fill: '#94A3B8' }}
              label={{ value: 'Variance Délai (%)', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#374151' }}
            />
            {/* Quadrant lines */}
            <ReferenceLine x={5}  stroke={NAVY} strokeDasharray="4 2" strokeWidth={1.5} />
            <ReferenceLine y={5}  stroke={NAVY} strokeDasharray="4 2" strokeWidth={1.5} />
            <Tooltip content={<RiskTooltip />} />
            <Scatter data={riskOnTrack}   fill={GREEN}  opacity={0.85} name="On Track" />
            <Scatter data={riskDelayOnly} fill={AMBER}  opacity={0.85} name="Délai seul" />
            <Scatter data={riskBudgOnly}  fill={ORANGE} opacity={0.85} name="Budget seul" />
            <Scatter data={riskCritical}  fill={RED}    opacity={0.85} name="Critique" />
          </ScatterChart>
        </ResponsiveContainer>
        {/* Quadrant labels */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
          {[
            { label: 'On Track', desc: 'Budget et délai maîtrisés', color: GREEN  },
            { label: 'Dépassement délai uniquement', desc: 'Ressources à renforcer', color: AMBER  },
            { label: 'Dépassement budget uniquement', desc: 'Révision des coûts requis', color: ORANGE },
            { label: 'Zone critique', desc: 'Plan de redressement obligatoire', color: RED   },
          ].map(q => (
            <div key={q.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: q.color + '10', borderRadius: 6, border: `1px solid ${q.color}30` }}>
              <div style={{ width: 6, height: 24, background: q.color, borderRadius: 3 }} />
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: q.color }}>{q.label}</div>
                <div style={{ fontSize: 10, color: '#64748B' }}>{q.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

    </div>
    </div>
  );
}
