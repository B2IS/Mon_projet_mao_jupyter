'use client';

import { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, ComposedChart, Bar, Area,
  AreaChart,
} from 'recharts';
import { RefreshCw, ChevronDown, Download, Bot, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, ChevronUp, Search, X } from 'lucide-react';
import { useProjectStore } from '@/lib/projectStore';
import { SENELEC_LOGO_DATA_URI } from '@/lib/senelecLogo';

/* ─── PDF Export ────────────────────────────────────────────────────────────── */
function handleExportPDF(title: string, projectLabel: string, BAC: number, EV: number, AC: number, CPI: number, SPI: number) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  const EAC = (BAC / CPI).toFixed(1);
  const CV  = (EV - AC).toFixed(2);
  printWindow.document.write(`
    <html><head><title>${title}</title>
    <style>body{font-family:Arial,sans-serif;margin:20px;} table{border-collapse:collapse;width:100%} td,th{border:1px solid #ddd;padding:8px;} h1{color:#1B4F8A;} h2{color:#1B4F8A;margin-top:20px;}</style>
    </head><body>
    <div style="margin-bottom:12px"><img src="${SENELEC_LOGO_DATA_URI}" alt="SENELEC" style="height:46px;width:auto;display:block" /></div>
    <h1>${title}</h1>
    <p>Rapport généré le: ${new Date().toLocaleDateString('fr-FR')}</p>
    <h2>Projet: ${projectLabel}</h2>
    <table>
      <tr><th>Indicateur EVM</th><th>Valeur</th><th>Description</th></tr>
      <tr><td>BAC</td><td>${BAC} MFCFA</td><td>Budget at Completion — Budget contractuel total</td></tr>
      <tr><td>EV</td><td>${EV} MFCFA</td><td>Earned Value — Valeur acquise cumulée</td></tr>
      <tr><td>AC</td><td>${AC} MFCFA</td><td>Actual Cost — Coût réel cumulé</td></tr>
      <tr><td>CPI</td><td>${CPI.toFixed(2)}</td><td>Cost Performance Index (EV/AC)</td></tr>
      <tr><td>SPI</td><td>${SPI.toFixed(2)}</td><td>Schedule Performance Index (EV/PV)</td></tr>
      <tr><td>CV</td><td>${CV} MFCFA</td><td>Cost Variance (EV−AC)</td></tr>
      <tr><td>EAC</td><td>${EAC} MFCFA</td><td>Estimate at Completion (BAC/CPI)</td></tr>
    </table>
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

/* ─── Types ─────────────────────────────────────────────────────────────────── */
interface SCurvePoint {
  mois: string;
  PV:   number | null;
  EV:   number | null;
  AC:   number | null;
  cpi?: number | null;
  spi?: number | null;
}

interface CPISPIPoint {
  mois: string;
  CPI: number | null;
  SPI: number | null;
}

interface CriticalTask {
  id: string;
  tache: string;
  duree: number;
  margeTotale: number;
  float: number;
  statut: 'critique' | 'risque' | 'ok';
}

interface ForecastPoint {
  mois: string;
  EV_actual: number | null;
  AC_actual: number | null;
  PV_actual: number | null;
  fc_optimiste:  number | null;
  fc_probable:   number | null;
  fc_pessimiste: number | null;
  pv_fc:         number | null;
}

interface ProjectOption {
  val: string;
  label: string;
  BAC: number;
  EV:  number;
  AC:  number;
  CPI: number;
  SPI: number;
}

/* ─── Project list ──────────────────────────────────────────────────────────── */
const PROJECTS: ProjectOption[] = [
  { val: 'P01', label: 'P01 — Centrale CC Tobène',            BAC: 45.2, EV: 21.7, AC: 23.1, CPI: 0.94, SPI: 0.91 },
  { val: 'P02', label: 'P02 — Solar Farm Taïba',              BAC: 24.2, EV: 12.4, AC: 13.0, CPI: 0.95, SPI: 0.93 },
  { val: 'P03', label: 'P03 — Ligne 225kV Tobène–Hann',       BAC: 42.0, EV: 18.6, AC: 21.4, CPI: 0.87, SPI: 0.83 },
  { val: 'P04', label: 'P04 — PADERAU HTB Extension',         BAC: 18.7, EV: 10.2, AC: 10.6, CPI: 0.96, SPI: 0.94 },
  { val: 'P05', label: 'P05 — Réseau BT Dakar Banlieue',      BAC: 15.3, EV:  9.8, AC: 10.2, CPI: 0.96, SPI: 0.97 },
  { val: 'P06', label: 'P06 — AMI Compteurs Intelligents',    BAC: 12.8, EV:  6.1, AC:  7.4, CPI: 0.82, SPI: 0.78 },
  { val: 'P07', label: 'P07 — CRM Commercial Platform',       BAC:  8.6, EV:  5.6, AC:  5.8, CPI: 0.97, SPI: 0.99 },
  { val: 'P08', label: 'P08 — Télégestion SCADA',             BAC: 10.1, EV:  7.1, AC:  7.2, CPI: 0.99, SPI: 1.02 },
  { val: 'P09', label: 'P09 — HTB Thiès–Mbour',               BAC: 22.4, EV:  9.8, AC: 11.5, CPI: 0.85, SPI: 0.79 },
  { val: 'P10', label: 'P10 — BT Ziguinchor Réseau',          BAC:  7.6, EV:  4.2, AC:  4.4, CPI: 0.95, SPI: 0.94 },
  { val: 'P11', label: 'P11 — Sous-station HTA 90kV',         BAC: 14.8, EV:  9.8, AC:  9.6, CPI: 1.02, SPI: 1.04 },
  { val: 'P12', label: 'P12 — Éclairage Public LED x5000',    BAC:  5.2, EV:  2.1, AC:  2.6, CPI: 0.81, SPI: 0.74 },
];

/* ─── S-Curve data (18 months Jan 2024 – Jun 2025) ─────────────────────────── */
const MONTHS_18 = ['Jan-24','Fév-24','Mar-24','Avr-24','Mai-24','Jun-24','Jul-24','Aoû-24','Sep-24','Oct-24','Nov-24','Déc-24','Jan-25','Fév-25','Mar-25','Avr-25','Mai-25','Jun-25'];

const PV_DATA  = [0, 2.4, 5.1, 8.6, 12.4, 16.8, 21.5, 26.4, 31.2, 35.8, 39.6, 42.8, 44.5, 45.0, 45.1, 45.2, 45.2, 45.2];
const EV_DATA  = [0, 2.1, 4.6, 7.8, 11.2, 15.1, 19.3, 23.6, 28.1, 32.0, 35.5, 38.2, 39.8, 40.6, 41.5, 42.2, 43.1, null];
const AC_DATA  = [0, 2.3, 5.0, 8.4, 12.0, 16.2, 20.8, 25.4, 30.2, 34.5, 38.2, 41.4, 43.0, 44.1, 45.2, 46.8, null, null];

const S_CURVE_DATA: SCurvePoint[] = MONTHS_18.map((mois, i) => ({
  mois,
  PV: PV_DATA[i] ?? null,
  EV: EV_DATA[i] ?? null,
  AC: AC_DATA[i] ?? null,
  cpi: (EV_DATA[i] != null && AC_DATA[i] != null && AC_DATA[i]! > 0) ? +(EV_DATA[i]! / AC_DATA[i]!).toFixed(2) : null,
  spi: (EV_DATA[i] != null && PV_DATA[i] > 0) ? +(EV_DATA[i]! / PV_DATA[i]).toFixed(2) : null,
}));

/* ─── CPI/SPI trend data ─────────────────────────────────────────────────────── */
const CPI_VALS = [1.00, 0.99, 0.98, 0.97, 0.96, 0.95, 0.95, 0.94, 0.94, 0.94, 0.94, 0.94];
const SPI_VALS = [1.00, 0.98, 0.97, 0.95, 0.94, 0.93, 0.92, 0.91, 0.91, 0.91, null, null];
const TREND_MONTHS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

const CPI_SPI_DATA: CPISPIPoint[] = TREND_MONTHS.map((mois, i) => ({
  mois,
  CPI: CPI_VALS[i] ?? null,
  SPI: SPI_VALS[i] ?? null,
}));

/* ─── Critical path tasks ───────────────────────────────────────────────────── */
const CRITICAL_TASKS: CriticalTask[] = [
  { id: 'T01', tache: 'Études génie civil fondations',  duree: 45, margeTotale:  0, float:  0, statut: 'critique' },
  { id: 'T02', tache: 'Approvisionnement transformateurs', duree: 90, margeTotale: 0, float:  0, statut: 'critique' },
  { id: 'T03', tache: 'Installation HTA 90kV',          duree: 60, margeTotale:  0, float:  0, statut: 'critique' },
  { id: 'T04', tache: 'Test & mise en service',          duree: 30, margeTotale:  0, float:  0, statut: 'critique' },
  { id: 'T05', tache: 'Réhabilitation accès site',       duree: 20, margeTotale:  5, float:  3, statut: 'risque'   },
  { id: 'T06', tache: 'Formation opérateurs',            duree: 15, margeTotale:  8, float:  5, statut: 'risque'   },
  { id: 'T07', tache: 'Documentation As-Built',          duree: 10, margeTotale: 15, float: 12, statut: 'ok'       },
  { id: 'T08', tache: 'Clôture administrative',          duree:  8, margeTotale: 20, float: 18, statut: 'ok'       },
];

/* ─── Forecast scenarios ────────────────────────────────────────────────────── */
const FORECAST_MONTHS = [
  'Jan-24','Fév-24','Mar-24','Avr-24','Mai-24','Jun-24','Jul-24','Aoû-24','Sep-24','Oct-24','Nov-24','Déc-24',
  'Jan-25','Fév-25','Mar-25','Avr-25','Mai-25',  // actual ends here
  'Jun-25','Jul-25','Aoû-25','Sep-25', // forecast months (CPI=1.0 / 0.94 / 0.85)
];

const BAC = 45.2;
const AC_TODAY = 46.8;
const EV_TODAY = 43.1;
const CPI_ACTUAL = 0.94;

const EAC_optimiste  = +(EV_TODAY + (BAC - EV_TODAY) / 1.0).toFixed(1);
const EAC_probable   = +(EV_TODAY + (BAC - EV_TODAY) / CPI_ACTUAL).toFixed(1);
const EAC_pessimiste = +(EV_TODAY + (BAC - EV_TODAY) / 0.85).toFixed(1);

const FORECAST_DATA: ForecastPoint[] = FORECAST_MONTHS.map((mois, i) => {
  const isActual  = i < 16;  // idx 0-15 = Jan-24 to Avr-25
  const isToday   = i === 16; // Mai-25
  const isForecast= i > 16;
  const progress  = isToday || isForecast ? (i - 15) : 0; // steps beyond today

  return {
    mois,
    EV_actual:     isActual || isToday ? (EV_DATA[i] ?? EV_TODAY) : null,
    AC_actual:     isActual || isToday ? (AC_DATA[i] ?? AC_TODAY) : null,
    PV_actual:     isActual || isToday ? (PV_DATA[i] ?? BAC) : null,
    fc_optimiste:  isToday || isForecast ? +(Math.min(EAC_optimiste,  AC_TODAY + progress * (EAC_optimiste  - AC_TODAY) / 4)).toFixed(2) : null,
    fc_probable:   isToday || isForecast ? +(Math.min(EAC_probable,   AC_TODAY + progress * (EAC_probable   - AC_TODAY) / 4)).toFixed(2) : null,
    fc_pessimiste: isToday || isForecast ? +(Math.min(EAC_pessimiste, AC_TODAY + progress * (EAC_pessimiste - AC_TODAY) / 4)).toFixed(2) : null,
    pv_fc:         isToday || isForecast ? BAC : null,
  };
});

/* ─── Helpers ───────────────────────────────────────────────────────────────── */
function cpiColor(v: number): string {
  if (v < 0.9)  return RED;
  if (v < 1.0)  return AMBER;
  return GREEN;
}

function cpiBadgeStyle(v: number): React.CSSProperties {
  const color = cpiColor(v);
  return {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    padding: '2px 10px', borderRadius: 20,
    background: color + '18', color, fontWeight: 800, fontSize: 13,
    border: `1px solid ${color}40`,
  };
}

function varColor(v: number): string { return v >= 0 ? GREEN : RED; }

/* ─── Custom Tooltip S-Curve ────────────────────────────────────────────────── */
interface SCTooltipProps {
  active?: boolean;
  payload?: Array<{ color: string; name: string; value: number | null }>;
  label?: string;
}

function SCTooltip({ active, payload, label }: SCTooltipProps) {
  if (!active || !payload?.length) return null;
  const pv = payload.find(p => p.name === 'PV')?.value ?? null;
  const ev = payload.find(p => p.name === 'EV')?.value ?? null;
  const ac = payload.find(p => p.name === 'AC')?.value ?? null;
  const cpi = (ev != null && ac != null && ac > 0) ? (ev / ac).toFixed(2) : null;
  const spi = (ev != null && pv != null && pv > 0) ? (ev / pv).toFixed(2) : null;
  return (
    <div style={{ background: '#fff', border: `1px solid ${NAVY}22`, borderRadius: 10, padding: '12px 16px', fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,.12)', minWidth: 200 }}>
      <div style={{ fontWeight: 800, color: NAVY, marginBottom: 8, fontSize: 13 }}>{label}</div>
      {pv != null && <div style={{ color: NAVY,   marginBottom: 3 }}>PV (Valeur planifiée): <b>{pv.toFixed(1)} MFCFA</b></div>}
      {ev != null && <div style={{ color: GREEN,  marginBottom: 3 }}>EV (Valeur acquise):   <b>{ev.toFixed(1)} MFCFA</b></div>}
      {ac != null && <div style={{ color: ORANGE, marginBottom: 3 }}>AC (Coût réel):        <b>{ac.toFixed(1)} MFCFA</b></div>}
      {(cpi || spi) && <div style={{ borderTop: `1px solid #F1F5F9`, marginTop: 8, paddingTop: 6 }}>
        {cpi && <div style={{ color: cpiColor(+cpi) }}>CPI: <b>{cpi}</b></div>}
        {spi && <div style={{ color: cpiColor(+spi) }}>SPI: <b>{spi}</b></div>}
      </div>}
    </div>
  );
}

/* ─── KPI Metric Card (big) ─────────────────────────────────────────────────── */
interface MetricCardProps {
  label: string;
  value: string;
  sub?: string;
  badge?: React.ReactNode;
  accent?: string;
  negative?: boolean;
}

function MetricCard({ label, value, sub, badge, accent = NAVY }: MetricCardProps) {
  return (
    <div style={{
      background: '#fff', borderRadius: 10, border: '1px solid #E2E8F0',
      borderTop: `3px solid ${accent}`, padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 6,
      boxShadow: '0 1px 4px rgba(0,0,0,.06)',
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.4px' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: accent }}>{value}</div>
        {badge}
      </div>
      {sub && <div style={{ fontSize: 11, color: '#94A3B8' }}>{sub}</div>}
    </div>
  );
}

/* ─── Card wrapper ──────────────────────────────────────────────────────────── */
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 10,
      border: '1px solid #E2E8F0', padding: 16,
      boxShadow: '0 1px 4px rgba(0,0,0,.06)', ...style,
    }}>
      {children}
    </div>
  );
}

function SectionHeader({ title, pill }: { title: string; pill?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{title}</div>
      {pill && <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, background: NAVY + '14', color: NAVY, fontWeight: 700 }}>{pill}</span>}
    </div>
  );
}

/* ─── Main Component ────────────────────────────────────────────────────────── */
export default function EVM() {
  const store = useProjectStore();

  // Build ProjectOption list from real store + static fallbacks
  const storeProjects = useMemo<ProjectOption[]>(() => {
    const fromStore = store.projets.map((p, i) => ({
      val: p.id,
      label: `${p.code} — ${p.nom.substring(0, 40)}`,
      BAC: p.budget,
      EV: +(p.budget * (p.avancement / 100) * p.cpi).toFixed(2),
      AC: +(p.budget * (p.avancement / 100)).toFixed(2),
      CPI: p.cpi,
      SPI: p.spi,
    }));
    return fromStore.length > 0 ? fromStore : PROJECTS;
  }, [store.projets]);

  const [selectedProject, setSelectedProject] = useState<string>(() => storeProjects[0]?.val ?? 'P01');
  const [taskSearch, setTaskSearch] = useState('');
  const [recalculating, setRecalculating] = useState(false);
  const [recalcKey, setRecalcKey] = useState(0);
  const [taskStatuses, setTaskStatuses] = useState<Record<string, CriticalTask['statut']>>(
    Object.fromEntries(CRITICAL_TASKS.map(t => [t.id, t.statut]))
  );

  function updateTaskStatus(id: string, newStatus: CriticalTask['statut']) {
    setTaskStatuses(prev => ({ ...prev, [id]: newStatus }));
  }

  const project = useMemo(
    () => storeProjects.find(p => p.val === selectedProject) ?? storeProjects[0] ?? PROJECTS[0],
    [selectedProject, storeProjects]
  );

  const CV   = +(project.EV - project.AC).toFixed(2);
  const SV   = +(project.EV - (project.BAC * project.SPI)).toFixed(2);
  const EAC  = +(project.CPI > 0 ? project.BAC / project.CPI : project.BAC).toFixed(1);
  const ETC  = +(EAC - project.AC).toFixed(1);
  const TCPI = project.BAC !== project.AC ? +((project.BAC - project.EV) / (project.BAC - project.AC)).toFixed(2) : 0;

  /* ── Dynamic S-curve data scaled to selected project ──────────────────── */
  const projectSCurveData = useMemo<SCurvePoint[]>(() => {
    const basePV = 45.2;  // base project BAC used by static PV_DATA
    const pvScale = project.BAC / basePV;
    const acBase = 46.8;  // base project total AC spend
    const evBase = 43.1;  // base project total EV at last actual
    const evScale = project.EV > 0 ? project.EV / evBase : 1;
    const acScale = project.AC > 0 ? project.AC / acBase : 1;
    return MONTHS_18.map((mois, i) => {
      const pv = PV_DATA[i] != null ? +(PV_DATA[i] * pvScale).toFixed(2) : null;
      const ev = EV_DATA[i] != null ? +(EV_DATA[i] * evScale).toFixed(2) : null;
      const ac = AC_DATA[i] != null ? +(AC_DATA[i] * acScale).toFixed(2) : null;
      return {
        mois,
        PV: pv,
        EV: ev,
        AC: ac,
        cpi: (ev != null && ac != null && ac > 0) ? +(ev / ac).toFixed(2) : null,
        spi: (ev != null && pv != null && pv > 0)  ? +(ev / pv).toFixed(2) : null,
      };
    });
  }, [project, recalcKey]);

  /* ── Dynamic CPI/SPI trend for selected project ───────────────────────── */
  const projectCPISPIData = useMemo<CPISPIPoint[]>(() => {
    const targetCPI = project.CPI;
    const targetSPI = project.SPI;
    return TREND_MONTHS.map((mois, i) => {
      // Interpolate from 1.0 at start to actual current value, with small randomness
      const t = i / (TREND_MONTHS.length - 1);
      const cpi = i < 10 ? +(1.0 + (targetCPI - 1.0) * Math.pow(t, 0.7) + (Math.random() - 0.5) * 0.02).toFixed(2) : null;
      const spi = i < 10 ? +(1.0 + (targetSPI - 1.0) * Math.pow(t, 0.7) + (Math.random() - 0.5) * 0.02).toFixed(2) : null;
      return { mois, CPI: cpi, SPI: spi };
    });
  }, [project.CPI, project.SPI, recalcKey]);

  /* ── Dynamic forecast for selected project ────────────────────────────── */
  const projectForecastData = useMemo<ForecastPoint[]>(() => {
    const projBAC = project.BAC;
    const projAC  = project.AC;
    const projEV  = project.EV;
    const projCPI = project.CPI;
    const pvScale = projBAC / 45.2;
    const acScale = projAC / 46.8 || 1;
    const evScale = projEV / 43.1 || 1;
    const eacOpt  = +(projEV + (projBAC - projEV) / 1.0).toFixed(1);
    const eacProb = +(projEV + (projBAC - projEV) / (projCPI > 0 ? projCPI : 1)).toFixed(1);
    const eacPess = +(projEV + (projBAC - projEV) / 0.85).toFixed(1);
    return FORECAST_MONTHS.map((mois, i) => {
      const isActual   = i < 16;
      const isToday    = i === 16;
      const isForecast = i > 16;
      const progress   = isToday || isForecast ? (i - 15) : 0;
      return {
        mois,
        EV_actual:     isActual || isToday ? +(( EV_DATA[i] ?? projEV) * evScale).toFixed(2) : null,
        AC_actual:     isActual || isToday ? +((AC_DATA[i] ?? projAC) * acScale).toFixed(2) : null,
        PV_actual:     isActual || isToday ? +((PV_DATA[i] ?? projBAC) * pvScale).toFixed(2) : null,
        fc_optimiste:  isToday || isForecast ? +(Math.min(eacOpt,  projAC + progress * (eacOpt  - projAC) / 4)).toFixed(2) : null,
        fc_probable:   isToday || isForecast ? +(Math.min(eacProb, projAC + progress * (eacProb - projAC) / 4)).toFixed(2) : null,
        fc_pessimiste: isToday || isForecast ? +(Math.min(eacPess, projAC + progress * (eacPess - projAC) / 4)).toFixed(2) : null,
        pv_fc:         isToday || isForecast ? projBAC : null,
      };
    });
  }, [project, recalcKey]);

  function handleRecalc() {
    setRecalculating(true);
    setRecalcKey(k => k + 1);
    setTimeout(() => setRecalculating(false), 1400);
  }

  const taskStatusColor = (s: CriticalTask['statut']): string => {
    if (s === 'critique') return RED;
    if (s === 'risque')   return AMBER;
    return GREEN;
  };

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#F5F6FA' }}>
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <div style={{ background: NAVY, borderRadius: 10, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>Analyse Valeur Acquise — EVM</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.65)', marginTop: 2 }}>Earned Value Management · Référence PMI PMBOK®</div>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <select
              value={selectedProject}
              onChange={e => setSelectedProject(e.target.value)}
              style={{
                padding: '8px 36px 8px 12px', borderRadius: 7, border: `1px solid rgba(255,255,255,.3)`,
                background: 'rgba(255,255,255,.12)', color: '#fff', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', appearance: 'none', minWidth: 240,
              }}
            >
              {storeProjects.map(p => <option key={p.val} value={p.val} style={{ background: NAVY, color: '#fff' }}>{p.label}</option>)}
            </select>
            <ChevronDown size={14} style={{ position: 'absolute', right: 10, color: 'rgba(255,255,255,.7)', pointerEvents: 'none' }} />
          </div>

          <button
            onClick={handleRecalc}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
              background: ORANGE, color: '#fff', border: 'none', borderRadius: 7,
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}
          >
            <RefreshCw size={13} style={{ animation: recalculating ? 'spin 1s linear infinite' : 'none' }} />
            {recalculating ? 'Recalcul...' : 'Recalculer'}
          </button>

          <button
            onClick={() => handleExportPDF(
              `Rapport EVM — ${project.label}`,
              project.label,
              project.BAC, project.EV, project.AC, project.CPI, project.SPI
            )}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              background: 'rgba(255,255,255,.15)', color: '#fff',
              border: '1px solid rgba(255,255,255,.3)', borderRadius: 7,
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}
          >
            <Download size={13} /> Rapport PDF
          </button>
        </div>
      </div>

      {/* ── ROW 1 — 5 EVM metric cards (primary) ────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
        <MetricCard label="BAC — Budget at Completion" value={`${project.BAC} MFCFA`} sub="Budget contractuel total" accent={NAVY} />
        <MetricCard label="EV — Earned Value" value={`${project.EV} MFCFA`} sub="Valeur acquise cumulée" accent={GREEN} />
        <MetricCard label="AC — Actual Cost" value={`${project.AC} MFCFA`} sub="Coût réel cumulé" accent={ORANGE} />
        <MetricCard
          label="CPI — Cost Performance Index"
          value={project.CPI.toFixed(2)}
          sub="EV / AC"
          accent={cpiColor(project.CPI)}
          badge={<span style={cpiBadgeStyle(project.CPI)}>{project.CPI < 0.9 ? 'CRITIQUE' : project.CPI < 1.0 ? 'ATTN' : 'BON'}</span>}
        />
        <MetricCard
          label="SPI — Schedule Performance Index"
          value={project.SPI.toFixed(2)}
          sub="EV / PV"
          accent={cpiColor(project.SPI)}
          badge={<span style={cpiBadgeStyle(project.SPI)}>{project.SPI < 0.9 ? 'CRITIQUE' : project.SPI < 1.0 ? 'ATTN' : 'BON'}</span>}
        />
      </div>

      {/* ── ROW 2 — 5 more EVM metric cards ─────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
        <MetricCard
          label="CV — Cost Variance"
          value={`${CV >= 0 ? '+' : ''}${CV} MFCFA`}
          sub="EV − AC"
          accent={varColor(CV)}
        />
        <MetricCard
          label="SV — Schedule Variance"
          value={`${SV >= 0 ? '+' : ''}${SV} MFCFA`}
          sub="EV − PV"
          accent={varColor(SV)}
        />
        <MetricCard
          label="EAC — Estimate at Completion"
          value={`${EAC} MFCFA`}
          sub="BAC / CPI"
          accent={EAC > project.BAC ? RED : GREEN}
          badge={EAC > project.BAC ? <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>+{(EAC - project.BAC).toFixed(1)} M dépassement</span> : undefined}
        />
        <MetricCard
          label="ETC — Estimate to Complete"
          value={`${ETC} MFCFA`}
          sub="EAC − AC"
          accent={ORANGE}
        />
        <MetricCard
          label="TCPI — To-Complete PI"
          value={TCPI.toFixed(2)}
          sub="(BAC−EV) / (BAC−AC)"
          accent={TCPI > 1.1 ? RED : TCPI > 1.0 ? AMBER : GREEN}
          badge={<span style={{ fontSize: 10, fontWeight: 700, color: TCPI > 1.1 ? RED : AMBER }}>{TCPI > 1.1 ? 'Difficile' : 'Réalisable'}</span>}
        />
      </div>

      {/* ── ROW 3 — S-Curve Full Width ───────────────────────────────────────── */}
      <Card>
        <SectionHeader
          title="Courbe en S — PV / EV / AC (MFCFA) · Jan 2024 – Jun 2025"
          pill="18 points"
        />
        <div style={{ fontSize: 11, color: '#64748B', marginBottom: 10, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 20, height: 2, background: NAVY, display: 'inline-block', borderRadius: 1, borderTop: '2px dashed '+NAVY }} /> PV planifié
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 20, height: 2, background: GREEN, display: 'inline-block', borderRadius: 1 }} /> EV acquis
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 20, height: 2, background: ORANGE, display: 'inline-block', borderRadius: 1 }} /> AC réel
          </span>
          <span style={{ color: '#94A3B8' }}>Zone entre EV et AC = Écart de coût · Zone entre PV et EV = Écart de délai</span>
        </div>
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart data={projectSCurveData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
            <defs>
              <linearGradient id="evGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={GREEN}  stopOpacity={0.12} />
                <stop offset="95%" stopColor={GREEN}  stopOpacity={0} />
              </linearGradient>
              <linearGradient id="acGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={ORANGE} stopOpacity={0.10} />
                <stop offset="95%" stopColor={ORANGE} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="pvGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={NAVY}   stopOpacity={0.08} />
                <stop offset="95%" stopColor={NAVY}   stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis dataKey="mois" tick={{ fontSize: 10, fill: '#94A3B8' }} />
            <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} unit=" M" domain={[0, 50]} />
            <Tooltip content={<SCTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            <ReferenceLine x="Mai-25" stroke={NAVY} strokeDasharray="4 3" strokeWidth={2}
              label={{ value: "Aujourd'hui", position: 'top', fontSize: 10, fill: NAVY, fontWeight: 700 }} />
            <Area type="monotone" dataKey="PV" name="PV" stroke={NAVY}   fill="url(#pvGrad)" strokeWidth={2} strokeDasharray="6 3" dot={false} connectNulls />
            <Area type="monotone" dataKey="EV" name="EV" stroke={GREEN}  fill="url(#evGrad)" strokeWidth={2.5} dot={false} connectNulls />
            <Area type="monotone" dataKey="AC" name="AC" stroke={ORANGE} fill="url(#acGrad)" strokeWidth={2} dot={false} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      {/* ── ROW 4 — CPI/SPI Trend + Chemin Critique ─────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Card>
          <SectionHeader title="Tendance CPI / SPI — 12 mois glissants" />
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={projectCPISPIData} margin={{ top: 10, right: 20, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="mois" tick={{ fontSize: 10, fill: '#94A3B8' }} />
              <YAxis domain={[0.85, 1.05]} tick={{ fontSize: 10, fill: '#94A3B8' }} />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8, border: `1px solid ${NAVY}20` }}
                formatter={(v: number, n: string) => [`${v?.toFixed(2) ?? '—'}`, n]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine y={1.0} stroke={GREEN} strokeDasharray="5 3" strokeWidth={1.5}
                label={{ value: 'Seuil = 1.0', position: 'right', fontSize: 9, fill: GREEN }} />
              <ReferenceLine y={0.9} stroke={RED} strokeDasharray="4 2" strokeWidth={1}
                label={{ value: 'Seuil critique', position: 'right', fontSize: 9, fill: RED }} />
              <Line type="monotone" dataKey="CPI" name="CPI" stroke={GREEN}  strokeWidth={2.5} dot={{ r: 3, fill: GREEN }}  connectNulls />
              <Line type="monotone" dataKey="SPI" name="SPI" stroke={ORANGE} strokeWidth={2}   dot={{ r: 3, fill: ORANGE }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <SectionHeader title="Analyse Chemin Critique" pill={`${CRITICAL_TASKS.filter(t => t.statut === 'critique').length} tâches critiques`} />
            <div style={{ position: 'relative' }}>
              <Search size={12} style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
              <input value={taskSearch} onChange={e => setTaskSearch(e.target.value)} placeholder="Filtrer les tâches…" style={{ padding: '5px 8px 5px 24px', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: 11, width: 180, paddingRight: taskSearch ? 24 : 8, outline: 'none' }} />
              {taskSearch && <button onClick={() => setTaskSearch('')} aria-label="Effacer le filtre tâches" style={{ position: 'absolute', right: 5, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 0 }}><X size={11} /></button>}
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#F8FAFC' }}>
                  {['Tâche', 'Durée', 'Marge totale', 'Float', 'Statut'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '1px solid #E2E8F0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CRITICAL_TASKS.filter(t => !taskSearch.trim() || t.tache.toLowerCase().includes(taskSearch.toLowerCase())).map(t => {
                  const currentStatus = taskStatuses[t.id] ?? t.statut;
                  return (
                  <tr key={t.id} style={{ background: currentStatus === 'critique' ? RED + '06' : '#fff', borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '8px 10px', fontWeight: currentStatus === 'critique' ? 700 : 500, color: currentStatus === 'critique' ? RED : '#374151', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.tache}
                    </td>
                    <td style={{ padding: '8px 10px', color: '#64748B' }}>{t.duree}j</td>
                    <td style={{ padding: '8px 10px', fontWeight: 700, color: taskStatusColor(currentStatus) }}>{t.margeTotale === 0 ? '0 (Critique)' : `${t.margeTotale}j`}</td>
                    <td style={{ padding: '8px 10px', color: '#64748B' }}>{t.float}j</td>
                    <td style={{ padding: '8px 10px' }}>
                      <select
                        value={currentStatus}
                        onChange={e => updateTaskStatus(t.id, e.target.value as CriticalTask['statut'])}
                        style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                          background: taskStatusColor(currentStatus) + '18',
                          color: taskStatusColor(currentStatus),
                          border: `1px solid ${taskStatusColor(currentStatus)}40`,
                          cursor: 'pointer', appearance: 'auto',
                        }}
                      >
                        <option value="critique">CRITIQUE</option>
                        <option value="risque">RISQUE</option>
                        <option value="ok">OK</option>
                      </select>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* ── ROW 5 — Forecast 3 scenarios ─────────────────────────────────────── */}
      <Card>
        <SectionHeader title="Prévisions d'achèvement — 3 scénarios" pill="EVM Forecasting" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'Optimiste (CPI = 1.0)',         eac: EAC_optimiste,  color: GREEN,  desc: 'Performance idéale, sans dérive' },
            { label: `Probable (CPI = ${CPI_ACTUAL})`, eac: EAC_probable,  color: ORANGE, desc: 'Basé sur la tendance actuelle' },
            { label: 'Pessimiste (CPI = 0.85)',        eac: EAC_pessimiste, color: RED,    desc: 'Dégradation continue des coûts' },
          ].map(s => (
            <div key={s.label} style={{ padding: '12px 14px', borderRadius: 8, border: `1px solid ${s.color}30`, background: s.color + '06' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: s.color, marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>EAC = {s.eac} MFCFA</div>
              <div style={{ fontSize: 10, color: '#64748B', marginTop: 4 }}>{s.desc}</div>
              <div style={{ fontSize: 10, color: s.color, fontWeight: 700, marginTop: 4 }}>
                {s.eac > BAC ? `+${(s.eac - BAC).toFixed(1)} MFCFA / +${(((s.eac - BAC) / BAC) * 100).toFixed(1)}% vs BAC` : `Dans le budget (BAC = ${BAC} M)`}
              </div>
            </div>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={projectForecastData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis dataKey="mois" tick={{ fontSize: 9, fill: '#94A3B8' }} />
            <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} unit=" M" domain={[0, 55]} />
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 8, border: `1px solid ${NAVY}20` }}
              formatter={(v: number, n: string) => [`${v?.toFixed(1) ?? '—'} MFCFA`, n]}
            />
            <Legend wrapperStyle={{ fontSize: 10, paddingTop: 6 }} />
            <ReferenceLine x="Mai-25" stroke={NAVY} strokeDasharray="4 3" strokeWidth={2}
              label={{ value: "Aujourd'hui", position: 'top', fontSize: 10, fill: NAVY, fontWeight: 700 }} />
            <ReferenceLine y={BAC} stroke={NAVY} strokeDasharray="3 2" strokeWidth={1}
              label={{ value: `BAC ${BAC}M`, position: 'right', fontSize: 9, fill: NAVY }} />
            <Line type="monotone" dataKey="AC_actual"     name="AC réel"        stroke={ORANGE} strokeWidth={2.5} dot={false} connectNulls />
            <Line type="monotone" dataKey="EV_actual"     name="EV acquis"      stroke={GREEN}  strokeWidth={2}   dot={false} connectNulls />
            <Line type="monotone" dataKey="PV_actual"     name="PV planifié"    stroke={NAVY}   strokeWidth={2}   strokeDasharray="6 3" dot={false} connectNulls />
            <Line type="monotone" dataKey="fc_optimiste"  name="Optimiste"      stroke={GREEN}  strokeWidth={1.5} dot={false} strokeDasharray="0" connectNulls />
            <Line type="monotone" dataKey="fc_probable"   name="Probable"       stroke={ORANGE} strokeWidth={2}   dot={false} connectNulls />
            <Line type="monotone" dataKey="fc_pessimiste" name="Pessimiste"     stroke={RED}    strokeWidth={1.5} dot={false} strokeDasharray="5 3" connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* ── ROW 6 — AI Advisory Panel ─────────────────────────────────────────── */}
      <AIAdvisoryPanel project={project} CPI={project.CPI} SPI={project.SPI} EAC={EAC} BAC={project.BAC} EV={project.EV} AC={project.AC} CV={CV} />

    </div>
    </div>
  );
}

/* ─── AI Advisory Panel ────────────────────────────────────────────────────── */
interface AIAdvisoryProps {
  project: ProjectOption;
  CPI: number; SPI: number; EAC: number; BAC: number; EV: number; AC: number; CV: number;
}

function AIAdvisoryPanel({ project, CPI, SPI, EAC, BAC, EV, AC, CV }: AIAdvisoryProps) {
  const [open, setOpen] = useState(true);

  // Generate context-aware AI insights based on real KPI values
  const insights = useMemo(() => {
    const items: { type: 'danger' | 'warning' | 'success' | 'info'; title: string; body: string }[] = [];
    const overrun = EAC - BAC;
    const overrunPct = BAC > 0 ? +((overrun / BAC) * 100).toFixed(1) : 0;

    // CPI analysis
    if (CPI < 0.9) {
      items.push({ type: 'danger', title: 'Dérive coût critique (CPI < 0,9)',
        body: `Pour chaque FCFA dépensé, seulement ${(CPI * 100).toFixed(0)} F de valeur est produite. Revoir immédiatement les contrats dépassant leur budget.` });
    } else if (CPI < 1.0) {
      items.push({ type: 'warning', title: `Coût légèrement dépassé (CPI = ${CPI.toFixed(2)})`,
        body: `Dépassement de ${Math.abs(CV).toFixed(1)} MFCFA. Resserrer le contrôle des dépenses sur les postes à forte consommation.` });
    } else {
      items.push({ type: 'success', title: `Coût maîtrisé (CPI = ${CPI.toFixed(2)})`,
        body: `Le projet produit plus de valeur que prévu. Maintenir la discipline budgétaire pour consolider cet avantage.` });
    }

    // SPI analysis
    if (SPI < 0.85) {
      items.push({ type: 'danger', title: `Retard de planning sévère (SPI = ${SPI.toFixed(2)})`,
        body: `Avancement réel très en deçà du plan. Identifier les tâches du chemin critique bloquées et mobiliser des ressources additionnelles.` });
    } else if (SPI < 0.95) {
      items.push({ type: 'warning', title: `Léger retard de planning (SPI = ${SPI.toFixed(2)})`,
        body: `Le planning glisse. Replanifier les jalons intermédiaires et communiquer un nouveau délai réaliste.` });
    } else {
      items.push({ type: 'success', title: `Planning respecté (SPI = ${SPI.toFixed(2)})`,
        body: `Le rythme d'avancement est conforme au planning de référence.` });
    }

    // EAC forecast
    if (overrun > 0) {
      items.push({ type: overrunPct > 10 ? 'danger' : 'warning',
        title: `Prévision de dépassement final : +${overrun.toFixed(1)} MFCFA (+${overrunPct}%)`,
        body: `EAC = ${EAC.toFixed(1)} MFCFA vs BAC = ${BAC} MFCFA. Déclencher une revue de budget et préparer un avenant si nécessaire.` });
    } else {
      items.push({ type: 'success', title: `Projet dans le budget (EAC = ${EAC.toFixed(1)} MFCFA)`,
        body: `Aucun dépassement prévu à l'achèvement. Surveiller la tendance CPI pour anticiper toute dérive.` });
    }

    // SENELEC-specific recommendations
    if (CPI < 0.95 && SPI < 0.95) {
      items.push({ type: 'info', title: 'Actions recommandées — DPE SENELEC',
        body: `1. Convoquer une réunion de revue de projet avec le chef de projet et le contrôleur financier.\n2. Activer le suivi hebdomadaire des jalons critiques.\n3. Envisager une levée de réserves de gestion si le CPI ne s'améliore pas sous 30 jours.` });
    } else if (CPI >= 1.0 && SPI >= 1.0) {
      items.push({ type: 'info', title: 'Opportunité — capitaliser sur la performance',
        body: `Projet performant. Documenter les bonnes pratiques dans la GED pour réplication sur les projets similaires du portefeuille DPE.` });
    }

    return items;
  }, [CPI, SPI, EAC, BAC, CV, AC, EV]);

  const COLORS = {
    danger:  { bg: '#FEF2F2', border: '#FCA5A5', icon: '#DC2626', text: '#991B1B' },
    warning: { bg: '#FFFBEB', border: '#FDE68A', icon: '#D97706', text: '#92400E' },
    success: { bg: '#F0FDF4', border: '#BBF7D0', icon: '#16A34A', text: '#14532D' },
    info:    { bg: '#EFF6FF', border: '#BFDBFE', icon: '#2563EB', text: '#1E3A8A' },
  };

  const ICONS = {
    danger:  <AlertTriangle size={15} />,
    warning: <AlertTriangle size={15} />,
    success: <CheckCircle2 size={15} />,
    info:    <Bot size={15} />,
  };

  return (
    <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,.06)', overflow: 'hidden' }}>
      <button onClick={() => setOpen(v => !v)}
        aria-label={open ? 'Masquer le panneau d\'analyse EVM' : 'Afficher le panneau d\'analyse EVM'}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #7C3AED, #4F46E5)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <Bot size={16} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>Analyse EVM — Conseiller de performance</div>
          <div style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>
            {project.label} · {insights.filter(i => i.type === 'danger').length} critique(s) · {insights.filter(i => i.type === 'warning').length} avertissement(s)
          </div>
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', background: '#F3F0FF', color: '#7C3AED', borderRadius: 20, flexShrink: 0 }}>
          SIGEPP-DPE · EVM
        </span>
        {open ? <ChevronUp size={16} color="#64748B" /> : <ChevronDown size={16} color="#64748B" />}
      </button>

      {open && (
        <div style={{ padding: '0 16px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
          {insights.map((ins, i) => {
            const c = COLORS[ins.type];
            return (
              <div key={i} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 9, padding: '11px 13px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6, color: c.icon }}>
                  {ICONS[ins.type]}
                  <span style={{ fontSize: 12, fontWeight: 700, color: c.text }}>{ins.title}</span>
                </div>
                <div style={{ fontSize: 11, color: c.text, lineHeight: 1.65, whiteSpace: 'pre-line' }}>{ins.body}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
