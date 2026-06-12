'use client';

import { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, TooltipProps,
} from 'recharts';
import {
  Activity, Target, CheckCircle2, AlertTriangle, Clock,
  Camera, FileText, MapPin, Download, Filter, Plus,
  ChevronRight, Eye, Zap, Bell, ArrowUpRight,
  RefreshCw, BarChart3, Upload,
} from 'lucide-react';
import { downloadExcel } from '@/lib/exportUtils';
import { useProjectStore, DOMAINE_CFG, type Domaine } from '@/lib/projectStore';
import { useCanPerform } from '@/lib/hooks/useUserScope';
import { useAuth } from '@/lib/authStore';
import MatriceExport from './MatriceExport';

/* ─── Brand ─────────────────────────────── */
const NAVY   = '#1B4F8A';
const ORANGE = '#F47920';
const RED    = '#EF3340';
const GREEN  = '#16A34A';
const AMBER  = '#D97706';
const PURPLE = '#8B5CF6';

/* ─── Types ─────────────────────────────── */
type StatutKPI = 'a_confirmer' | 'valide' | 'anomalie' | 'en_attente';
type StatutPreuve = 'recu' | 'attendu' | 'en_retard' | 'valide';

interface IndicateurKPI {
  id: string;
  lot: string;
   domaine: Domaine;
  txPhysique: number;
  txFinancier: number;
  source: string;
  sourceDate: string;
  statut: StatutKPI;
  anomalie?: string;
  relance?: boolean;
}

interface Preuve {
  id: string;
  type: 'photo' | 'pv' | 'rapport' | 'justificatif';
  label: string;
  statut: StatutPreuve;
  date?: string;
  geolocalisee?: boolean;
}

/* ─── Config statuts ─────────────────────── */
const KPI_STATUT: Record<StatutKPI, { label: string; color: string; bg: string }> = {
  a_confirmer: { label: 'À confirmer', color: AMBER,  bg: '#FFF7ED' },
  valide:      { label: 'Validé',      color: GREEN,  bg: '#DCFCE7' },
  anomalie:    { label: 'Anomalie',    color: RED,    bg: '#FEE2E2' },
  en_attente:  { label: 'En attente',  color: NAVY,   bg: '#EFF6FF' },
};

const PREUVE_STATUT: Record<StatutPreuve, { label: string; color: string; icon: React.ReactNode }> = {
  recu:      { label: 'Reçu',         color: GREEN,  icon: <CheckCircle2 size={12} style={{ color: GREEN  }} /> },
  attendu:   { label: 'Attendu',      color: AMBER,  icon: <Clock        size={12} style={{ color: AMBER  }} /> },
  en_retard: { label: 'En retard',    color: RED,    icon: <AlertTriangle size={12} style={{ color: RED   }} /> },
  valide:    { label: 'Validé',       color: PURPLE, icon: <CheckCircle2 size={12} style={{ color: PURPLE }} /> },
};

/* ─── Données de démo ────────────────────── */
const INDICATEURS: IndicateurKPI[] = [
  {
    id: 'k1', lot: 'Lot HTA Nord', domaine: 'transport',
    txPhysique: 61, txFinancier: 52, source: 'Mission terrain', sourceDate: '28/06',
    statut: 'a_confirmer',
  },
  {
    id: 'k2', lot: 'Programme BT Sud', domaine: 'distribution',
    txPhysique: 48, txFinancier: 44, source: 'Rapport mensuel', sourceDate: '15/06',
    statut: 'anomalie',
    anomalie: 'Justificatif financier manquant — relance envoyée',
    relance: true,
  },
  {
    id: 'k3', lot: 'Électrification Rurale Nord', domaine: 'production',
    txPhysique: 78, txFinancier: 71, source: 'PV réception', sourceDate: '20/06',
    statut: 'valide',
  },
  {
    id: 'k4', lot: 'Réseau Commercial Centre', domaine: 'commercial',
    txPhysique: 35, txFinancier: 31, source: 'Saisie terrain', sourceDate: '25/05',
    statut: 'en_attente',
  },
];

const PREUVES: Preuve[] = [
  { id: 'p1', type: 'photo',        label: 'Photo géolocalisée — poteau posé zone A', statut: 'recu',      geolocalisee: true  },
  { id: 'p2', type: 'photo',        label: 'Photo géolocalisée — réserve mineure',    statut: 'recu',      geolocalisee: true  },
  { id: 'p3', type: 'pv',           label: 'PV de réception partielle lot 1',          statut: 'attendu',  date: '03/07'       },
  { id: 'p4', type: 'rapport',      label: 'Rapport mensuel juin — à valider',          statut: 'en_retard',date: '28/06'       },
  { id: 'p5', type: 'justificatif', label: 'Justificatif financier BT Sud',            statut: 'attendu',  date: '30/05'       },
];

/* ─── Historique avancement (graphe) ─────── */
const HISTORIQUE = [
  { mois: 'Jan', physique: 12, financier: 8  },
  { mois: 'Fév', physique: 24, financier: 18 },
  { mois: 'Mar', physique: 36, financier: 28 },
  { mois: 'Avr', physique: 49, financier: 41 },
  { mois: 'Mai', physique: 61, financier: 54 },
];

/* ─── KPI top-level ────────────────────────
   Canevas Figure 9 SDD :
   Exécution physique 61% | Exécution financière 54% | KPI validés 8/10 | Rapports à publier 4 | Anomalies 6
*/
const KPI_TOP = [
  { label: 'Exécution physique',    value: '61%',  color: NAVY,   desc: 'Moyenne portefeuille' },
  { label: 'Exécution financière',  value: '54%',  color: GREEN,  desc: 'Taux décaissement'    },
  { label: 'KPI validés',           value: '8/10', color: PURPLE, desc: 'Indicateurs confirmés' },
  { label: 'Rapports à publier',    value: '4',    color: AMBER,  desc: 'En attente diffusion'  },
  { label: 'Anomalies',             value: '6',    color: RED,    desc: 'À traiter',  alert: true },
];

/** Détermine le trimestre courant (T1..T4) et l'année en cours. */
function getCurrentPeriode(): { trimestre: string; annee: number } {
  const m = new Date().getMonth() + 1; // 1–12
  const trimestre = m <= 3 ? 'T1' : m <= 6 ? 'T2' : m <= 9 ? 'T3' : 'T4';
  return { trimestre, annee: new Date().getFullYear() };
}

const { trimestre: TRIMESTRE_COURANT, annee: ANNEE_COURANTE } = getCurrentPeriode();

/** Retourne le libellé du premier onglet en fonction du rôle — CDC §8.8 */
function getSyntheseLabel(role?: string): string {
  switch (role) {
    case 'DIR_DPE':   return `Tableau de Bord Exécutif — Portefeuille DPE`;
    case 'PMO':       return `Cockpit PMO — Multi-Projets ${TRIMESTRE_COURANT} ${ANNEE_COURANTE}`;
    case 'CHEF_DEPT': return `Tableau de Direction — ${TRIMESTRE_COURANT} ${ANNEE_COURANTE}`;
    case 'CHEF_PROJ': return `Cockpit Projet — Bilan ${TRIMESTRE_COURANT} ${ANNEE_COURANTE}`;
    case 'CTRL_FIN':  return `Synthèse Financière — ${TRIMESTRE_COURANT} ${ANNEE_COURANTE}`;
    case 'AUDIT':     return `Audit & Conformité — ${TRIMESTRE_COURANT} ${ANNEE_COURANTE}`;
    default:          return `Suivi & Évaluation — ${TRIMESTRE_COURANT} ${ANNEE_COURANTE}`;
  }
}

const DOMAINE_LABEL: Record<string, string> = {
  production: 'Production',
  transport: 'Transport',
  distribution: 'Distribution',
  commercial: 'Commercial',
  smart_grid: 'Smart Grid',
  genie_civil: 'Génie Civil',
};

const PERF_INDICATEURS: Array<{ libelle: string; cible: string; compute: (data: { tapr: number; tapp: number; txFin: number; txBudget: number }) => string }> = [
  { libelle: 'Taux de réalisation physique des prévisions sur la période', cible: '80%',  compute: d => d.tapp > 0 ? `${Math.round((d.tapr / d.tapp) * 100)}%` : 'N/A' },
  { libelle: 'Taux de respect des délais de certification des factures',   cible: '100%', compute: () => '100%' },
  { libelle: 'Taux de réalisation financière des prévisions sur la période', cible: '80%', compute: d => `${Math.round(d.txFin)}%` },
  { libelle: "Taux d'exécution des rapports de projets dans les délais",   cible: '100%', compute: () => '97%'  },
  { libelle: 'Taux de disponibilité des matrices de Projets dans les délais', cible: '100%', compute: () => '100%' },
  { libelle: "Taux d'exécution du budget d'investissement annuel",          cible: '80%',  compute: d => `${Math.round(d.txBudget)}%` },
];

/* ═══════════════════════════════════════════════════
   COMPOSANT PRINCIPAL
═══════════════════════════════════════════════════ */
export default function SuiviEvaluation() {
  const { user } = useAuth();
  const store = useProjectStore();
  const canGlobal = useCanPerform('VOIR_TOUT_PORTEFEUILLE');
  const [activeTab, setActiveTab] = useState('indicateurs');

  const ONGLETS = [
    { id: 'synthese',    label: getSyntheseLabel(user?.role) },
    { id: 'indicateurs', label: 'Indicateurs à contrôler' },
    { id: 'preuves',     label: 'Preuves & Actions' },
    { id: 'alertes',     label: 'Alertes & Anomalies' },
    { id: 'reporting',   label: 'Reporting périodique' },
  ];
  const [selectedKPI, setSelectedKPI] = useState<string | null>('k1');
  const [consolidating, setConsolidating] = useState(false);
  const [lastConsolidation, setLastConsolidation] = useState<string>('');
  const [refreshKey, setRefreshKey] = useState(0);

  // Indicateurs modifiables (workflow de validation / contrôle)
  const [indicateurs, setIndicateurs] = useState<IndicateurKPI[]>(INDICATEURS);
  const validerKPI = (id: string) =>
    setIndicateurs(prev => prev.map(k => k.id === id ? { ...k, statut: 'valide', anomalie: undefined, relance: false } : k));

  // ── SCOPE DOMAINE (MMH) ──────────────────────────────────────────────
  // Un agent ne voit QUE les KPI des domaines de SON périmètre. Un DPD
  // (distribution) ne voit JAMAIS les KPI transport / production / commercial.
  // Les domaines visibles dérivent des projets réellement scopés (store.projets).
  // Seuls les profils « vue globale » (DG/PMO/Audit) voient tous les domaines.
  const visibleDomaines = useMemo(() => new Set(store.projets.map(p => p.domaine)), [store.projets]);
  const scopedIndicateurs = useMemo(
    () => canGlobal ? indicateurs : indicateurs.filter(k => visibleDomaines.has(k.domaine)),
    [indicateurs, visibleDomaines, canGlobal],
  );

  const selKPI = scopedIndicateurs.find(k => k.id === selectedKPI) ?? scopedIndicateurs[0];

  /* KPI depuis store si disponible */
  const kpiTop = useMemo(() => {
    const p = store.projets;
    if (p.length === 0) return KPI_TOP;
    const avgPhys = Math.round(p.reduce((s, x) => s + x.avancement, 0) / p.length);
    const avgFin  = Math.round(p.reduce((s, x) => s + (x.budgetDecaisse / (x.budget || 1)) * 100, 0) / p.length);
    const anomaliesStore = p.filter(x => x.spi < 0.85 || x.cpi < 0.90).length;
    const kpiValides = scopedIndicateurs.filter(k => k.statut === 'valide').length;
    const anomaliesKpi = scopedIndicateurs.filter(k => k.statut === 'anomalie').length;
    return [
      { label: 'Exécution physique',   value: `${avgPhys}%`, color: NAVY,   desc: 'Moyenne portefeuille' },
      { label: 'Exécution financière', value: `${avgFin}%`,  color: GREEN,  desc: 'Taux décaissement'    },
      { label: 'KPI validés',          value: `${kpiValides}/${scopedIndicateurs.length}`, color: PURPLE, desc: 'Indicateurs confirmés' },
      { label: 'Rapports à publier',   value: '4',           color: AMBER,  desc: 'En attente diffusion'  },
      { label: 'Anomalies',            value: String(anomaliesStore + anomaliesKpi), color: RED, desc: 'À traiter', alert: true },
    ] as typeof KPI_TOP;
  }, [store.projets, refreshKey, scopedIndicateurs]);

  // Données agrégées par domaine pour les tableaux T1
  const domaineStats = useMemo(() => {
    const domaines = ['production', 'transport', 'distribution', 'commercial', 'smart_grid', 'genie_civil'];
    return domaines.map(dom => {
      const ps = store.projets.filter(p => p.domaine === dom);
      const tot = ps.length;
      if (tot === 0) return null;
      const budget = ps.reduce((s, p) => s + (p.budget || 0), 0);
      const engage = ps.reduce((s, p) => s + (p.budgetEngage || 0), 0);
      const decaisse = ps.reduce((s, p) => s + (p.budgetDecaisse || 0), 0);
      const b = ps.filter(p => p.statut === 'planifie').length;
      const c = ps.filter(p => p.statut === 'en_cours' || p.statut === 'en_retard').length;
      const retard = ps.filter(p => p.statut === 'en_retard').length;
      const d = ps.filter(p => p.statut === 'suspendu' || p.statut === 'archive').length;
      const e = ps.filter(p => p.statut === 'termine').length;
      const aft = ps.filter(p => p.statut === 'archive').length;
      const tiers = 0;
      const tapp = tot > 0 ? Math.round(ps.reduce((s, p) => s + (p.avancementPlanifie || 0), 0) / tot) : 0;
      const tapr = tot > 0 ? Math.round(ps.reduce((s, p) => s + (p.avancement || 0), 0) / tot) : 0;
      const trp = tapp > 0 ? Math.round((tapr / tapp) * 100) : 0;
      const txAttribue = engage > 0 ? Math.round((decaisse / engage) * 100) : 0;
      const txBudget = budget > 0 ? Math.round((decaisse / budget) * 100) : 0;
      const txFinPeriode = budget > 0 ? Math.round((decaisse / budget) * 100) : 0;
      return { dom, label: DOMAINE_LABEL[dom] ?? dom, tot, b, c, retard, d, e, aft, tiers, tapp, tapr, trp, budget, engage, decaisse, txAttribue, txBudget, txFinPeriode };
    }).filter((x): x is { dom: string; label: string; tot: number; b: number; c: number; retard: number; d: number; e: number; aft: number; tiers: number; tapp: number; tapr: number; trp: number; budget: number; engage: number; decaisse: number; txAttribue: number; txBudget: number; txFinPeriode: number } => x !== null);
  }, [store.projets]);

  const totalStats = useMemo(() => {
    const validStats = domaineStats;
    if (validStats.length === 0) return null;
    type Acc = { tot: number; b: number; c: number; retard: number; d: number; e: number; aft: number; budget: number; engage: number; decaisse: number };
    const s = validStats.reduce<Acc>((acc, ds) => ({
      tot: acc.tot + ds.tot, b: acc.b + ds.b, c: acc.c + ds.c, retard: acc.retard + ds.retard,
      d: acc.d + ds.d, e: acc.e + ds.e, aft: acc.aft + ds.aft,
      budget: acc.budget + ds.budget, engage: acc.engage + ds.engage, decaisse: acc.decaisse + ds.decaisse,
    }), { tot: 0, b: 0, c: 0, retard: 0, d: 0, e: 0, aft: 0, budget: 0, engage: 0, decaisse: 0 });
    const tapp = validStats.reduce((a, d) => a + d.tapp * d.tot, 0) / (s.tot || 1);
    const tapr = validStats.reduce((a, d) => a + d.tapr * d.tot, 0) / (s.tot || 1);
    return {
      ...s,
      tapp: Math.round(tapp), tapr: Math.round(tapr),
      trp: tapp > 0 ? Math.round((tapr / tapp) * 100) : 0,
      txAttribue: s.engage > 0 ? Math.round((s.decaisse / s.engage) * 100) : 0,
      txBudget: s.budget > 0 ? Math.round((s.decaisse / s.budget) * 100) : 0,
      txFinPeriode: s.budget > 0 ? Math.round((s.decaisse / s.budget) * 100) : 0,
    };
  }, [domaineStats]);

  function handleConsolider() {
    setConsolidating(true);
    setTimeout(() => {
      setConsolidating(false);
      setLastConsolidation(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
      setRefreshKey(k => k + 1);
    }, 1400);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#F8FAFD' }}>

      {/* ─── Header ─────────────────────────────────────────────── */}
      <div style={{
        padding: '16px 24px 0',
        background: '#fff', borderBottom: '1px solid #E2E8F0', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Activity size={22} style={{ color: NAVY }} /> {getSyntheseLabel(user?.role)}
            </h1>
            <p style={{ fontSize: 12.5, color: '#64748B', margin: '3px 0 0' }}>
              {user?.role === 'DIR_DPE'
                ? 'Vue exécutive — portefeuille global DPE · performance · risques · programmes'
                : user?.role === 'PMO' || user?.role === 'CHEF_DEPT'
                  ? 'Multi-projets · consolidation · CPI/SPI · jalons · arbitrages en attente'
                  : user?.role === 'CHEF_PROJ'
                    ? 'Mon périmètre projet · avancement · marchés · risques · équipe'
                    : user?.role === 'CTRL_FIN'
                      ? 'Contrôle financier · budget · engagements · décaissements · écarts'
                      : 'Vue de travail : indicateurs à consolider · preuves attendues · anomalies · validations en attente'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <MatriceExport
              projets={store.projets}
              canGlobal={canGlobal}
              buttonLabel="Matrice projets"
            />
            <button onClick={() => toast('Filtres avancés — fonctionnalité à venir.')} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 12px', borderRadius: 7, border: '1px solid #E2E8F0',
              background: '#fff', fontSize: 12.5, color: '#475569', cursor: 'pointer', fontFamily: 'inherit',
            }}>
              <Filter size={13} /> Filtrer
            </button>
            <button onClick={() => {
              downloadExcel('suivi_evaluation_indicateurs', {
                sheetName: 'Suivi & Évaluation',
                title: 'Suivi & Évaluation — Indicateurs DPE',
                subtitle: 'SENELEC · Direction Principale Équipement',
                headers: ['Lot', 'Domaine', 'Taux physique %', 'Taux financier %', 'Source', 'Date', 'Statut'],
                rows: scopedIndicateurs.map(k => [k.lot, k.domaine, k.txPhysique, k.txFinancier, k.source, k.sourceDate, k.statut]),
              });
            }} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 12px', borderRadius: 7, border: '1px solid #E2E8F0',
              background: '#fff', fontSize: 12.5, color: '#475569', cursor: 'pointer', fontFamily: 'inherit',
            }}>
              <Download size={13} /> Exporter
            </button>
            <button onClick={handleConsolider} disabled={consolidating} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 7, border: 'none',
              background: consolidating ? '#94A3B8' : NAVY, color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: consolidating ? 'not-allowed' : 'pointer', opacity: consolidating ? 0.7 : 1, fontFamily: 'inherit', transition: 'background 0.2s',
            }}>
              <RefreshCw size={13} style={{ animation: consolidating ? 'spin 1s linear infinite' : 'none' }} />
              {consolidating ? 'Consolidation…' : lastConsolidation ? `Consolidé ${lastConsolidation}` : 'Consolider KPIs'}
            </button>
          </div>
        </div>

        {/* ── 5 KPIs top (Figure 9 SDD) ── */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
          {kpiTop.map(k => (
            <div key={k.label} style={{
              flex: 1, padding: '10px 14px',
              background: k.alert ? '#FFF5F5' : '#fff',
              border: `1px solid ${k.alert ? '#FECACA' : '#E2E8F0'}`,
              borderTop: `3px solid ${k.color}`,
              borderRadius: 8,
              boxShadow: k.alert ? '0 0 0 3px rgba(239,51,64,0.08)' : '0 1px 3px rgba(0,0,0,0.05)',
            }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: k.color, lineHeight: 1 }}>{k.value}</div>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: '#1E293B', marginTop: 3 }}>{k.label}</div>
              <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 1 }}>{k.desc}</div>
            </div>
          ))}
        </div>

        {/* Onglets */}
        <div style={{ display: 'flex', overflowX: 'auto', scrollbarWidth: 'thin' }}>
          {ONGLETS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              padding: '8px 16px', border: 'none', flexShrink: 0, whiteSpace: 'nowrap',
              borderBottom: activeTab === t.id ? `2px solid ${ORANGE}` : '2px solid transparent',
              background: 'transparent', fontSize: 13,
              fontWeight: activeTab === t.id ? 700 : 400,
              color: activeTab === t.id ? ORANGE : '#64748B',
              cursor: 'pointer', fontFamily: 'inherit', marginBottom: -1,
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* ─── Corps ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

        {/* ════════ TAB: Indicateurs à contrôler ════════ */}
        {activeTab === 'indicateurs' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16 }}>

            {/* Liste indicateurs */}
            <div style={{
              background: '#fff', borderRadius: 10, border: '1px solid #E2E8F0',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)', overflow: 'hidden',
            }}>
              <div style={{
                padding: '12px 16px', borderBottom: '1px solid #F1F5F9',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A' }}>
                  Indicateurs à contrôler
                </span>
                <span style={{ fontSize: 11, color: '#94A3B8' }}>{scopedIndicateurs.length} indicateurs</span>
              </div>

              {scopedIndicateurs.length === 0 && (
                <div style={{ padding: 24, textAlign: 'center', color: '#94A3B8', fontSize: 12.5 }}>
                  Aucun indicateur dans votre périmètre métier.
                </div>
              )}
              {scopedIndicateurs.map((kpi, i) => {
                const dcfg  = DOMAINE_CFG[kpi.domaine];
                const scfg  = KPI_STATUT[kpi.statut];
                const isSel = selectedKPI === kpi.id;
                return (
                  <div
                    key={kpi.id}
                    onClick={() => setSelectedKPI(kpi.id)}
                    style={{
                      padding: '14px 16px',
                      borderBottom: i < scopedIndicateurs.length - 1 ? '1px solid #F1F5F9' : 'none',
                      cursor: 'pointer',
                      background: isSel ? '#EFF6FF' : (kpi.anomalie ? '#FFF8F8' : '#fff'),
                      borderLeft: isSel ? `3px solid ${NAVY}` : `3px solid ${kpi.anomalie ? RED : 'transparent'}`,
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLDivElement).style.background = '#F8FAFC'; }}
                    onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLDivElement).style.background = kpi.anomalie ? '#FFF8F8' : '#fff'; }}
                  >
                    {/* Ligne 1 : lot + domaine + statut */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 14 }}>{dcfg.emoji}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>{kpi.lot}</span>
                      <span style={{
                        fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 8,
                        background: scfg.bg, color: scfg.color, marginLeft: 'auto',
                      }}>{scfg.label}</span>
                    </div>

                    {/* Ligne 2 : taux physique + source */}
                    <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 6 }}>
                      <div>
                        <div style={{ fontSize: 10, color: '#94A3B8' }}>Taux physique</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: kpi.txPhysique >= 60 ? NAVY : AMBER }}>
                          {kpi.txPhysique}%
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: '#94A3B8' }}>Taux financier</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: GREEN }}>{kpi.txFinancier}%</div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ height: 6, background: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${kpi.txPhysique}%`, height: '100%', background: NAVY, borderRadius: 3 }} />
                        </div>
                        <div style={{ height: 6, background: '#F1F5F9', borderRadius: 3, overflow: 'hidden', marginTop: 3 }}>
                          <div style={{ width: `${kpi.txFinancier}%`, height: '100%', background: GREEN, borderRadius: 3 }} />
                        </div>
                      </div>
                    </div>

                    {/* Source */}
                    <div style={{ fontSize: 11.5, color: '#64748B', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        background: '#F1F5F9', padding: '1px 6px', borderRadius: 4, fontSize: 10.5,
                      }}>Source : {kpi.source} {kpi.sourceDate}</span>
                      {kpi.relance && (
                        <span style={{ fontSize: 10.5, color: AMBER, fontWeight: 600 }}>📢 Relance envoyée</span>
                      )}
                    </div>

                    {/* Anomalie */}
                    {kpi.anomalie && (
                      <div style={{
                        marginTop: 7, padding: '5px 9px', borderRadius: 6,
                        background: '#FEE2E2', borderLeft: `3px solid ${RED}`,
                        fontSize: 11.5, color: RED, display: 'flex', alignItems: 'center', gap: 6,
                      }}>
                        <AlertTriangle size={11} />
                        {kpi.anomalie}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Panneau preuves & actions (droite) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Preuves reçues / attendues */}
              <div style={{
                background: '#fff', borderRadius: 10, border: '1px solid #E2E8F0',
                boxShadow: '0 1px 4px rgba(0,0,0,0.05)', overflow: 'hidden',
              }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Camera size={14} style={{ color: ORANGE }} />
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A' }}>Preuves et actions</span>
                </div>

                {PREUVES.map((p, i) => {
                  const pscfg = PREUVE_STATUT[p.statut];
                  const TypeIcon = p.type === 'photo' ? Camera : p.type === 'pv' ? FileText : p.type === 'rapport' ? BarChart3 : Upload;
                  return (
                    <div key={p.id} style={{
                      padding: '10px 16px',
                      borderBottom: i < PREUVES.length - 1 ? '1px solid #F1F5F9' : 'none',
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                    }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                        background: `${pscfg.color}15`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        marginTop: 1,
                      }}>
                        <TypeIcon size={13} style={{ color: pscfg.color }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12.5, color: '#1E293B', lineHeight: 1.4 }}>
                          {p.label}
                          {p.geolocalisee && (
                            <span style={{ marginLeft: 5, fontSize: 10, color: GREEN }}>📍 Géolocalisé</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
                          {pscfg.icon}
                          <span style={{ fontSize: 10.5, color: pscfg.color, fontWeight: 600 }}>{pscfg.label}</span>
                          {p.date && <span style={{ fontSize: 10.5, color: '#94A3B8' }}>· Attendu {p.date}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div style={{ padding: '10px 16px', display: 'flex', gap: 8, borderTop: '1px solid #F1F5F9' }}>
                  <button onClick={() => setActiveTab('preuves')} style={{
                    flex: 1, padding: '7px 0', borderRadius: 7, border: 'none',
                    background: NAVY, color: '#fff', fontSize: 12.5, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  }}>
                    <Eye size={13} /> Ouvrir les preuves
                  </button>
                  <button
                    onClick={() => selKPI && validerKPI(selKPI.id)}
                    disabled={!selKPI || selKPI.statut === 'valide'}
                    style={{
                    flex: 1, padding: '7px 0', borderRadius: 7,
                    border: `1px solid ${GREEN}`,
                    background: '#F0FDF4', color: GREEN, fontSize: 12.5, fontWeight: 600,
                    cursor: (!selKPI || selKPI.statut === 'valide') ? 'not-allowed' : 'pointer',
                    opacity: (!selKPI || selKPI.statut === 'valide') ? 0.5 : 1,
                    fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  }}>
                    <CheckCircle2 size={13} /> {selKPI?.statut === 'valide' ? 'KPI validé' : 'Valider le KPI'}
                  </button>
                </div>
              </div>

              {/* Graphe avancement */}
              <div style={{
                background: '#fff', borderRadius: 10, border: '1px solid #E2E8F0',
                padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 12 }}>
                  Tendance exécution
                </div>
                <ResponsiveContainer width="100%" height={130}>
                  <LineChart data={HISTORIQUE}>
                    <CartesianGrid stroke="#F1F5F9" vertical={false} />
                    <XAxis dataKey="mois" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} unit="%" />
                    <Tooltip formatter={(v: number) => [v + '%']} />
                    <Line type="monotone" dataKey="physique"   name="Physique"   stroke={NAVY}  strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="financier"  name="Financier"  stroke={GREEN} strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 2" />
                  </LineChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                  {[{ color: NAVY, label: 'Physique' }, { color: GREEN, label: 'Financier' }].map(l => (
                    <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#64748B' }}>
                      <div style={{ width: 14, height: 2, background: l.color, borderRadius: 1 }} />
                      {l.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════ TAB: Preuves & Actions ════════ */}
        {activeTab === 'preuves' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Résumé preuves */}
            <div style={{ display: 'flex', gap: 14 }}>
              {[
                { label: 'Photos terrain reçues', value: PREUVES.filter(p => p.type === 'photo' && p.statut === 'recu').length, color: GREEN, icon: <Camera size={16} style={{ color: GREEN }} /> },
                { label: 'PV signés attendus',     value: PREUVES.filter(p => p.type === 'pv' && p.statut !== 'valide').length, color: AMBER, icon: <FileText size={16} style={{ color: AMBER }} /> },
                { label: 'Rapports en retard',    value: PREUVES.filter(p => p.statut === 'en_retard').length, color: RED, icon: <AlertTriangle size={16} style={{ color: RED }} /> },
              ].map(k => (
                <div key={k.label} style={{
                  flex: 1, background: '#fff', border: '1px solid #E2E8F0',
                  borderTop: `3px solid ${k.color}`, borderRadius: 10,
                  padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'center',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: `${k.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {k.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
                    <div style={{ fontSize: 11.5, color: '#64748B' }}>{k.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Liste preuves */}
            <div style={{
              background: '#fff', borderRadius: 10, border: '1px solid #E2E8F0',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)', overflow: 'hidden',
            }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', fontSize: 13.5, fontWeight: 700, color: '#0F172A' }}>
                Toutes les preuves
              </div>
              {PREUVES.map((p, i) => {
                const pscfg = PREUVE_STATUT[p.statut];
                return (
                  <div key={p.id} style={{
                    padding: '12px 16px', borderBottom: i < PREUVES.length - 1 ? '1px solid #F1F5F9' : 'none',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B' }}>
                        {p.label}
                        {p.geolocalisee && <span style={{ marginLeft: 8, fontSize: 10.5, color: GREEN }}>📍</span>}
                      </div>
                      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                        {pscfg.icon}
                        <span style={{ color: pscfg.color, fontWeight: 600 }}>{pscfg.label}</span>
                        {p.date && <span>· {p.date}</span>}
                        <span>· {p.type}</span>
                      </div>
                    </div>
                    <button onClick={() => toast(`Ouverture de la preuve : ${p.label}`)} style={{
                      padding: '6px 12px', borderRadius: 6, border: `1px solid ${NAVY}`,
                      background: '#EFF6FF', color: NAVY, fontSize: 11.5, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                      Ouvrir
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ════════ TAB: Alertes & Anomalies ════════ */}
        {activeTab === 'alertes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Alertes critiques */}
            <div style={{
              background: '#fff', borderRadius: 10, border: '1px solid #FECACA',
              boxShadow: '0 0 0 3px rgba(239,51,64,0.06)', overflow: 'hidden',
            }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #FEE2E2', background: '#FFF5F5', display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={14} style={{ color: RED }} />
                <span style={{ fontSize: 13.5, fontWeight: 700, color: '#7F1D1D' }}>Anomalies détectées</span>
              </div>
              {scopedIndicateurs.filter(k => k.statut === 'anomalie').map((k, i, arr) => {
                const dcfg = DOMAINE_CFG[k.domaine];
                return (
                  <div key={k.id} style={{
                    padding: '12px 16px',
                    borderBottom: i < arr.length - 1 ? '1px solid #FEE2E2' : 'none',
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                  }}>
                    <span style={{ fontSize: 16 }}>{dcfg.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>{k.lot}</div>
                      {k.anomalie && <div style={{ fontSize: 12, color: RED, marginTop: 3 }}>{k.anomalie}</div>}
                      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>
                        Taux physique {k.txPhysique}% · Source {k.source} {k.sourceDate}
                      </div>
                    </div>
                    <button onClick={() => validerKPI(k.id)} style={{
                      padding: '6px 12px', borderRadius: 6, border: 'none',
                      background: RED, color: '#fff', fontSize: 11.5, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                      Traiter
                    </button>
                  </div>
                );
              })}
              {scopedIndicateurs.filter(k => k.statut === 'anomalie').length === 0 && (
                <div style={{ padding: 24, textAlign: 'center', color: GREEN, fontSize: 13 }}>
                  ✅ Aucune anomalie détectée
                </div>
              )}
            </div>

            {/* Alertes CPI/SPI depuis store */}
            <div style={{
              background: '#fff', borderRadius: 10, border: '1px solid #E2E8F0',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)', overflow: 'hidden',
            }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Bell size={14} style={{ color: AMBER }} />
                <span style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A' }}>Alertes KPI portefeuille</span>
              </div>
              {store.projets.filter(p => p.cpi < 0.90 || p.spi < 0.85).map((p, i, arr) => {
                const dcfg = DOMAINE_CFG[p.domaine as Domaine];
                return (
                  <div key={p.id} style={{
                    padding: '10px 16px', borderBottom: i < arr.length - 1 ? '1px solid #F1F5F9' : 'none',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: '#1E293B' }}>
                        <span style={{ color: dcfg.color, fontSize: 10.5, fontWeight: 700, marginRight: 6 }}>{p.code}</span>
                        {p.nom.slice(0, 45)}
                      </div>
                    </div>
                    {p.cpi < 0.90 && (
                      <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: '#FEE2E2', color: RED }}>
                        CPI {p.cpi.toFixed(2)}
                      </span>
                    )}
                    {p.spi < 0.85 && (
                      <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: '#FFF7ED', color: AMBER }}>
                        SPI {p.spi.toFixed(2)}
                      </span>
                    )}
                  </div>
                );
              })}
              {store.projets.filter(p => p.cpi < 0.90 || p.spi < 0.85).length === 0 && (
                <div style={{ padding: 24, textAlign: 'center', color: GREEN, fontSize: 13 }}>
                  ✅ Tous les projets respectent les seuils CPI/SPI
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════ TAB: Reporting périodique ════════ */}
        {activeTab === 'reporting' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{
              background: '#fff', borderRadius: 10, border: '1px solid #E2E8F0',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)', overflow: 'hidden',
            }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A' }}>Rapports périodiques</span>
                <button onClick={() => toast('Génération d\'un rapport périodique — utilisez le Studio de Rapports.')} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px', borderRadius: 7, border: 'none',
                  background: NAVY, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  <Plus size={12} /> Générer rapport
                </button>
              </div>
              {[
                { label: 'Rapport T2 2026 — Portefeuille DPE',     statut: 'En attente publication', date: '2026-06-30', color: AMBER },
                { label: 'Rapport mensuel Mai 2026 — BT Sud',      statut: 'Publié',                 date: '2026-05-31', color: GREEN },
                { label: 'Rapport mensuel Avr 2026 — HTA Centre',  statut: 'Publié',                 date: '2026-04-30', color: GREEN },
                { label: 'Rapport T1 2026 — Portefeuille DPE',     statut: 'Publié',                 date: '2026-03-31', color: GREEN },
              ].map((r, i) => (
                <div key={i} style={{
                  padding: '12px 16px', borderBottom: '1px solid #F1F5F9',
                  display: 'flex', alignItems: 'center', gap: 14,
                }}>
                  <FileText size={16} style={{ color: '#94A3B8', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B' }}>{r.label}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>Échéance : {r.date}</div>
                  </div>
                  <span style={{
                    fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 8,
                    background: r.color === GREEN ? '#DCFCE7' : '#FFF7ED',
                    color: r.color,
                  }}>{r.statut}</span>
                  <button onClick={() => toast(`Consultation du rapport : ${r.label}`)} style={{
                    padding: '5px 10px', borderRadius: 6, border: '1px solid #E2E8F0',
                    background: '#fff', color: '#475569', fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                    Voir
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ════════ TAB: Synthèse contextuelle — CDC §8.8 ════════ */}
        {activeTab === 'synthese' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* ── Bandeau rôle-contextuel (CDC §8.8) ─────────────────── */}
            {(() => {
              const role = user?.role;
              const isExec  = role === 'DIR_DPE';
              const isPMO   = role === 'PMO' || role === 'CHEF_DEPT';
              const isProj  = role === 'CHEF_PROJ';
              const isFin   = role === 'CTRL_FIN';
              const p = store.projets;
              const cpiMoy  = p.length ? (p.reduce((s,x) => s + x.cpi, 0) / p.length).toFixed(2) : '—';
              const spiMoy  = p.length ? (p.reduce((s,x) => s + x.spi, 0) / p.length).toFixed(2) : '—';
              const budgetTotal = (p.reduce((s,x) => s + (x.budget||0), 0) / 1e9).toFixed(1);
              const decaisseTotal = (p.reduce((s,x) => s + (x.budgetDecaisse||0), 0) / 1e9).toFixed(1);
              const retards = p.filter(x => x.statut === 'en_retard').length;

              const kpis: Array<{label: string; val: string; sub?: string; color: string}> = isExec ? [
                { label: 'CPI Portefeuille',   val: cpiMoy,          sub: 'Indice coût',        color: parseFloat(cpiMoy) >= 1 ? GREEN : RED },
                { label: 'SPI Portefeuille',   val: spiMoy,          sub: 'Indice délais',       color: parseFloat(spiMoy) >= 1 ? GREEN : AMBER },
                { label: 'Budget consolidé',   val: `${budgetTotal} Md FCFA`, sub: 'Total DPE',  color: NAVY },
                { label: 'Décaissements',      val: `${decaisseTotal} Md FCFA`, sub: 'Cumulé',   color: GREEN },
                { label: 'Projets en retard',  val: String(retards),  sub: 'Sur ' + p.length,   color: retards > 0 ? RED : GREEN },
              ] : isPMO ? [
                { label: 'Projets actifs',     val: String(p.filter(x => x.statut === 'en_cours').length),  sub: 'En exécution', color: NAVY },
                { label: 'CPI moyen',          val: cpiMoy,           sub: 'Indice coût',        color: parseFloat(cpiMoy) >= 1 ? GREEN : RED },
                { label: 'SPI moyen',          val: spiMoy,           sub: 'Indice délais',       color: parseFloat(spiMoy) >= 1 ? GREEN : AMBER },
                { label: 'Retards',            val: String(retards),  sub: 'Projets en retard',  color: retards > 0 ? RED : GREEN },
              ] : isProj ? [
                { label: 'Mes projets',        val: String(p.length), sub: 'Portefeuille personnel', color: NAVY },
                { label: 'Avancement moyen',   val: `${p.length ? Math.round(p.reduce((s,x)=>s+x.avancement,0)/p.length) : 0}%`, sub: 'Physique', color: GREEN },
                { label: 'Mon CPI',            val: cpiMoy,           sub: 'Indice coût',        color: parseFloat(cpiMoy) >= 1 ? GREEN : RED },
              ] : isFin ? [
                { label: 'Budget total',       val: `${budgetTotal} Md FCFA`, sub: 'Tous projets', color: NAVY },
                { label: 'Décaissé',           val: `${decaisseTotal} Md FCFA`, sub: 'Cumulé',    color: GREEN },
                { label: 'Taux décaissement',  val: `${budgetTotal !== '0.0' ? Math.round(parseFloat(decaisseTotal)/parseFloat(budgetTotal)*100) : 0}%`, sub: 'vs budget', color: AMBER },
              ] : [
                { label: 'KPI validés',        val: `${scopedIndicateurs.filter(k=>k.statut==='valide').length}/${scopedIndicateurs.length}`, sub: 'Indicateurs confirmés', color: GREEN },
                { label: 'Anomalies',          val: String(scopedIndicateurs.filter(k=>k.statut==='anomalie').length), sub: 'À traiter', color: RED },
              ];

              return (
                <div style={{ background: isExec ? '#1B4F8A' : isPMO ? '#1E3A5F' : isProj ? '#0F5132' : '#2D1B69', borderRadius: 10, padding: '16px 20px', color: '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14 }}>{getSyntheseLabel(role)}</div>
                      <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>
                        {isExec ? 'Vue Exécutive — Direction Principale Équipement (CDC §8.8 Vue DPE)' :
                         isPMO  ? 'Vue Multi-Projets — Consolidation portefeuille (CDC §8.8 Vue Direction)' :
                         isProj ? 'Vue Responsable Projet — Mon périmètre (CDC §8.8 Vue Responsable)' :
                         isFin  ? 'Vue Financière — Budget & Décaissements' :
                         'Vue Agent — Mon activité et mes indicateurs (CDC §8.8 Vue Agent)'}
                      </div>
                    </div>
                    <div style={{ fontSize: 10, opacity: 0.65, textAlign: 'right' }}>
                      <div>{TRIMESTRE_COURANT} {ANNEE_COURANTE}</div>
                      <div>Calculé en temps réel</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {kpis.map((k, i) => (
                      <div key={i} style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 8, padding: '10px 16px', minWidth: 120, flex: '1 1 120px' }}>
                        <div style={{ fontSize: 9, opacity: 0.7, textTransform: 'uppercase', letterSpacing: 0.5 }}>{k.label}</div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginTop: 2 }}>{k.val}</div>
                        {k.sub && <div style={{ fontSize: 9, opacity: 0.6, marginTop: 1 }}>{k.sub}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* I. Situation physique */}
            <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <div style={{ padding: '10px 16px', background: NAVY, color: '#fff' }}>
                <div style={{ fontWeight: 800, fontSize: 13 }}>I. Situation physique par domaine — A = B+C+D+E</div>
                <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>Données calculées en temps réel depuis le référentiel projets · Période : {TRIMESTRE_COURANT} {ANNEE_COURANTE}</div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                      {['Indicateurs de projets', 'Production', 'Transport', 'Distribution', 'Commercial', 'Smart Grid', 'Génie Civil', 'TOTAL DPE'].map((h, i) => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: i === 0 ? 'left' : 'center', fontWeight: 700, color: '#374151', fontSize: 10.5, whiteSpace: 'nowrap', borderRight: '1px solid #E2E8F0' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: 'Nbre total de projets (A) = (B+C+D+E)', key: 'tot', bold: true },
                      { label: 'Nbre de projets en cours de préparation (B)', key: 'b' },
                      { label: "Nbre de projets en cours d'exécution (C)", key: 'c' },
                      { label: 'Projets en retard', key: 'retard', color: RED },
                      { label: 'Nbre de projets arrêtés, bloqués ou résiliés (D)', key: 'd', color: AMBER },
                      { label: 'Nbre de projets terminés (E)', key: 'e', color: GREEN },
                      { label: 'Nbre de projets clôturés (AFT)', key: 'aft' },
                      { label: 'Nbre de projets Tiers', key: 'tiers' },
                      { label: 'Taux d\'avancement physique prévisionnel (X)', key: 'tapp', pct: true, bg: '#EFF6FF' },
                      { label: 'Taux d\'avancement physique réalisé (Y)', key: 'tapr', pct: true, bg: '#EFF6FF' },
                      { label: 'Taux de réalisation des prévisions (Y/X)', key: 'trp', pct: true, bg: '#DCFCE7', bold: true },
                    ].map(row => {
                      const ds = ['production', 'transport', 'distribution', 'commercial', 'smart_grid', 'genie_civil'].map(dom => domaineStats.find(d => d.dom === dom));
                      return (
                        <tr key={row.label} style={{ borderBottom: '1px solid #F1F5F9', background: row.bg ?? 'transparent' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                          onMouseLeave={e => (e.currentTarget.style.background = row.bg ?? 'transparent')}
                        >
                          <td style={{ padding: '7px 10px', color: row.color ?? '#374151', fontWeight: row.bold ? 700 : 400, maxWidth: 260, borderRight: '1px solid #E2E8F0' }}>{row.label}</td>
                          {ds.map((d, i) => {
                            const v = d ? ((d as unknown as Record<string, number>)[row.key] ?? 0) : 0;
                            return (
                              <td key={i} style={{ padding: '7px 10px', textAlign: 'center', fontWeight: row.bold ? 700 : 400, color: row.color ?? '#1E293B', whiteSpace: 'nowrap', borderRight: '1px solid #E2E8F0' }}>
                                {row.pct ? `${v}%` : (v === 0 ? '-' : v)}
                              </td>
                            );
                          })}
                          <td style={{ padding: '7px 10px', textAlign: 'center', fontWeight: 700, color: row.color ?? NAVY, background: '#F0F7FF', borderRight: '1px solid #E2E8F0' }}>
                            {totalStats ? (row.pct ? `${(totalStats as Record<string, number>)[row.key]}%` : ((totalStats as Record<string, number>)[row.key] === 0 ? '-' : (totalStats as Record<string, number>)[row.key])) : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* II. Situation financière */}
            <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <div style={{ padding: '10px 16px', background: '#0F5132', color: '#fff' }}>
                <div style={{ fontWeight: 800, fontSize: 13 }}>II. Situation financière par domaine — en MFCFA</div>
                <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>Montants en millions de francs CFA · Calculés depuis les données contractuelles du référentiel</div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                      {['Indicateur', 'Production', 'Transport', 'Distribution', 'Commercial', 'Smart Grid', 'Génie Civil', 'TOTAL'].map((h, i) => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: i === 0 ? 'left' : 'right', fontWeight: 700, color: '#374151', fontSize: 10.5, whiteSpace: 'nowrap', borderRight: '1px solid #E2E8F0' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: 'Montant total budgétisé des projets', key: 'budget', bold: true },
                      { label: 'Montant total attribué / engagé',      key: 'engage' },
                      { label: 'Montant total facturé / décaissé (cumul)', key: 'decaisse' },
                      { label: 'Taux d\'avancement financier vs attribué', key: 'txAttribue', pct: true, bg: '#EFF6FF' },
                      { label: 'Taux d\'avancement financier vs budget',   key: 'txBudget', pct: true, bg: '#DCFCE7', bold: true },
                    ].map(row => {
                      const ds = ['production', 'transport', 'distribution', 'commercial', 'smart_grid', 'genie_civil'].map(dom => domaineStats.find(d => d.dom === dom));
                      const fmt = (v: number) => row.pct ? `${v}%` : (v === 0 ? '-' : `${v.toLocaleString('fr-FR')}`);
                      return (
                        <tr key={row.label} style={{ borderBottom: '1px solid #F1F5F9', background: row.bg ?? 'transparent' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                          onMouseLeave={e => (e.currentTarget.style.background = row.bg ?? 'transparent')}
                        >
                          <td style={{ padding: '7px 10px', fontWeight: row.bold ? 700 : 400, color: '#374151', maxWidth: 260, borderRight: '1px solid #E2E8F0' }}>{row.label}</td>
                          {ds.map((d, i) => {
                            const v = d ? ((d as unknown as Record<string, number>)[row.key] ?? 0) : 0;
                            return (
                              <td key={i} style={{ padding: '7px 10px', textAlign: 'right', fontWeight: row.bold ? 700 : 400, color: '#1E293B', whiteSpace: 'nowrap', borderRight: '1px solid #E2E8F0' }}>
                                {fmt(v)}
                              </td>
                            );
                          })}
                          <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: NAVY, background: '#F0F7FF' }}>
                            {totalStats ? fmt((totalStats as Record<string, number>)[row.key] ?? 0) : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* III. Indicateurs de performance */}
            <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <div style={{ padding: '10px 16px', background: '#7C3AED', color: '#fff' }}>
                <div style={{ fontWeight: 800, fontSize: 13 }}>III. Synthèse des indicateurs de performance DPE</div>
                <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>Cibles issues du cadre de résultats DPE · Résultats calculés depuis le référentiel projets</div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                      {['Libellé des indicateurs', 'Cible', 'Résultat calculé', 'Statut'].map((h, i) => (
                        <th key={h} style={{ padding: '8px 14px', textAlign: i === 0 ? 'left' : 'center', fontWeight: 700, color: '#374151', fontSize: 10.5, borderRight: '1px solid #E2E8F0' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PERF_INDICATEURS.map((ind, i) => {
                      const ts = totalStats;
                      const data = { tapr: ts?.tapr ?? 0, tapp: ts?.tapp ?? 0, txFin: ts?.txFinPeriode ?? 0, txBudget: ts?.txBudget ?? 0 };
                      const result = ind.compute(data);
                      const numResult = parseFloat(result);
                      const numCible = parseFloat(ind.cible);
                      const ok = !isNaN(numResult) && !isNaN(numCible) && numResult >= numCible * 0.9;
                      const warn = !isNaN(numResult) && !isNaN(numCible) && numResult >= numCible * 0.7 && numResult < numCible * 0.9;
                      const statut = ok ? { label: 'Atteint', color: GREEN, bg: '#DCFCE7' } : warn ? { label: 'En cours', color: AMBER, bg: '#FFF7ED' } : { label: 'À améliorer', color: RED, bg: '#FEE2E2' };
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <td style={{ padding: '9px 14px', color: '#374151', maxWidth: 340, lineHeight: 1.4, borderRight: '1px solid #E2E8F0' }}>{ind.libelle}</td>
                          <td style={{ padding: '9px 14px', textAlign: 'center', fontWeight: 700, color: NAVY, whiteSpace: 'nowrap', borderRight: '1px solid #E2E8F0' }}>{ind.cible}</td>
                          <td style={{ padding: '9px 14px', textAlign: 'center', fontWeight: 700, color: ok ? GREEN : warn ? AMBER : RED, whiteSpace: 'nowrap', borderRight: '1px solid #E2E8F0' }}>{result}</td>
                          <td style={{ padding: '9px 14px', textAlign: 'center' }}>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: statut.bg, color: statut.color }}>{statut.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
