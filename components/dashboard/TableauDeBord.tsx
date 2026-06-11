'use client';

/**
 * TableauDeBord.tsx — Cockpit Exécutif SIGEPP-DPE
 * Canevas A (SDD §19) : vue de pilotage direction/PMO
 * Données temps-réel depuis useProjectStore()
 */

import { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import {
  AlertTriangle, TrendingUp, TrendingDown, Clock, Folder,
  ChevronRight, ArrowUpRight, Bell, Filter, Download,
  Zap, Flag, BarChart3, AlertCircle, CheckCircle2,
  CircleDot, RefreshCw, Calendar, Users, X,
  DollarSign, Activity, Target, Layers, Fuel,
  Cable, Gauge, Building2, ShieldCheck, Check,
} from 'lucide-react';
import { downloadExcel } from '@/lib/exportUtils';
import { SENELEC_LOGO_DATA_URI } from '@/lib/senelecLogo';
import { useProjectStore, DOMAINE_CFG, STATUT_CFG, type Domaine, type StatutProjet, type Projet } from '@/lib/projectStore';
import { useAuth, getDirectionLabel, isAssistantProjet } from '@/lib/authStore';
import { computeIndicateursSenelec, cockpitCardsForRole } from '@/lib/indicateursSenelec';
import { useMeetingRoom } from '@/lib/meetingRoomStore';
import { useOdmConfig } from '@/lib/odmConfigStore';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

/* ─── Design tokens ──────────────────────────────────────── */
const C = {
  navy:   '#1B4F8A',
  orange: '#F47920',
  red:    '#EF3340',
  green:  '#16A34A',
  amber:  '#D97706',
  purple: '#8B5CF6',
  slate:  '#64748B',
  border: '#E2E8F0',
  bg:     '#F0F4F9',
  surface:'#fff',
} as const;

/* ─── Helpers ────────────────────────────────────────────── */
function fmtM(n: number): string {
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)} Md`;
  return `${n.toLocaleString('fr-FR')} M`;
}
function fmtPct(n: number): string { return `${Math.round(n)}%`; }
function ragColor(cpi: number, spi: number): string {
  if (cpi < 0.85 || spi < 0.80) return C.red;
  if (cpi < 0.95 || spi < 0.90) return C.amber;
  return C.green;
}

/* ─── Courbe S portefeuille ─────────────────────────────── */
const SCURVE = [
  { m: 'J', p: 8,   r: 5   }, { m: 'F', p: 14,  r: 10  },
  { m: 'M', p: 22,  r: 16  }, { m: 'A', p: 32,  r: 26  },
  { m: 'M', p: 44,  r: 36  }, { m: 'J', p: 57,  r: null },
  { m: 'J', p: 68,  r: null }, { m: 'A', p: 77,  r: null },
  { m: 'S', p: 85,  r: null }, { m: 'O', p: 91,  r: null },
  { m: 'N', p: 97,  r: null }, { m: 'D', p: 100, r: null },
];

/* ─── Drawer projet ──────────────────────────────────────── */
function ProjetDrawer({ projet, onClose }: { projet: Projet; onClose: () => void }) {
  const dcfg = DOMAINE_CFG[projet.domaine as Domaine];
  const scfg = STATUT_CFG[projet.statut as StatutProjet];
  const engPct = projet.budget > 0 ? Math.round((projet.budgetDecaisse / projet.budget) * 100) : 0;
  const jalonsAtteints = projet.jalons.filter(j => j.atteint).length;
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 299, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(2px)' }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 300, width: 440,
        background: '#fff', boxShadow: '-8px 0 40px rgba(27,79,138,0.18)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ background: C.navy, padding: '18px 20px', borderBottom: `3px solid ${dcfg.color}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>{projet.code}</span>
                <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.30)' }} />
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{dcfg.label}</span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', lineHeight: 1.3, marginRight: 12 }}>{projet.nom}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <span style={{
                  fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.18)', color: '#fff',
                }}>{scfg.label}</span>
                <span style={{
                  fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 8,
                  background: `${ragColor(projet.cpi, projet.spi)}22`,
                  color: ragColor(projet.cpi, projet.spi),
                  border: `1px solid ${ragColor(projet.cpi, projet.spi)}40`,
                }}>
                  CPI {projet.cpi.toFixed(2)} · SPI {projet.spi.toFixed(2)}
                </span>
              </div>
            </div>
            <button onClick={onClose} aria-label="Fermer le détail du projet" style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 7, padding: 6, cursor: 'pointer', color: '#fff', display: 'flex' }}>
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 18 }}>
            {[
              { label: 'Avancement', value: `${projet.avancement}%`, color: projet.avancement >= 70 ? C.green : C.amber },
              { label: 'Budget décaissé', value: `${engPct}%`, color: engPct >= 70 ? C.green : C.amber },
              { label: 'Jalons atteints', value: `${jalonsAtteints}/${projet.jalons.length}`, color: C.navy },
              { label: 'Budget', value: fmtM(projet.budget) + ' FCFA', color: C.slate },
              { label: 'Engagé', value: fmtM(projet.budgetEngage) + ' FCFA', color: C.slate },
              { label: 'Décaissé', value: fmtM(projet.budgetDecaisse) + ' FCFA', color: C.purple },
            ].map(k => (
              <div key={k.label} style={{ border: '1px solid #F1F5F9', borderRadius: 8, padding: '10px 12px', background: '#FAFBFD' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: k.color }}>{k.value}</div>
                <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 2 }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* Avancement bar */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
              <span style={{ color: '#475569', fontWeight: 600 }}>Avancement physique</span>
              <span style={{ color: C.navy, fontWeight: 800 }}>{projet.avancement}%</span>
            </div>
            <div style={{ height: 10, background: '#F1F5F9', borderRadius: 5, overflow: 'hidden' }}>
              <div style={{ width: `${projet.avancement}%`, height: '100%', background: `linear-gradient(90deg, ${C.navy}, ${C.orange})`, borderRadius: 5, transition: 'width 0.6s' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: '#94A3B8', marginTop: 4 }}>
              <span>Prévu : {projet.avancementPlanifie}%</span>
              <span>Écart : {projet.avancement - projet.avancementPlanifie > 0 ? '+' : ''}{projet.avancement - projet.avancementPlanifie}%</span>
            </div>
          </div>

          {/* Jalons */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', marginBottom: 10 }}>Jalons ({projet.jalons.length})</div>
            {projet.jalons.map((j, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid #F8FAFC' }}>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                  background: j.atteint ? C.green : '#F1F5F9',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: j.atteint ? 'none' : '2px solid #CBD5E1',
                }}>
                  {j.atteint && <CheckCircle2 size={12} style={{ color: '#fff' }} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500, color: j.atteint ? '#64748B' : '#1E293B', textDecoration: j.atteint ? 'line-through' : 'none' }}>{j.label}</div>
                  <div style={{ fontSize: 10.5, color: '#94A3B8' }}>{j.date}</div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 6, background: j.atteint ? '#DCFCE7' : '#F1F5F9', color: j.atteint ? C.green : '#64748B' }}>
                  {j.atteint ? 'Atteint' : 'En attente'}
                </span>
              </div>
            ))}
          </div>

          {/* Équipe */}
          {projet.equipe.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>Équipe ({projet.equipe.length})</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {projet.equipe.map(id => (
                  <span key={id} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: '#EFF6FF', color: C.navy, fontWeight: 600 }}>{id}</span>
                ))}
              </div>
            </div>
          )}

          {/* Chef de projet */}
          <div style={{ padding: '12px 14px', borderRadius: 8, background: '#F8FAFC', border: '1px solid #E2E8F0', display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: `linear-gradient(135deg, ${C.navy}, ${dcfg.color})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
              {projet.chefProjet.split(' ').map(w => w[0]).join('').slice(0, 2)}
            </div>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1E293B' }}>{projet.chefProjet}</div>
              <div style={{ fontSize: 10.5, color: '#94A3B8' }}>Chef de projet · {projet.region}</div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid #E2E8F0', background: '#FAFBFD', display: 'flex', gap: 8, flexShrink: 0 }}>
          <Link href={`/cockpit-projet?code=${encodeURIComponent(projet.code)}`} style={{ flex: 1, textDecoration: 'none' }}>
            <button style={{ width: '100%', padding: '8px', borderRadius: 7, border: 'none', background: C.navy, color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              Ouvrir le cockpit <ArrowUpRight size={13} />
            </button>
          </Link>
          <button onClick={() => toast('Téléchargement de la fiche PDF du projet à venir.', { icon: 'ℹ️' })} style={{ padding: '8px 12px', borderRadius: 7, border: '1px solid #E2E8F0', background: '#fff', color: '#475569', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Download size={13} /> Fiche
          </button>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════ */
export default function TableauDeBord() {
  const store = useProjectStore();
  const { user, isRole } = useAuth();
  const router = useRouter();
  // Bandeau d'indicateurs CONSOLIDÉS réservé aux profils de PILOTAGE
  // (chef de département/cellule, PMO, Directeur, Experts S&E/CSE).
  const canSeeConsolidated = isRole('DIR_DPE', 'ADMIN', 'PMO', 'CHEF_DEPT', 'EXPERT');

  /* ── Niveau de consolidation selon le profil (détaillé → consolidé) ── */
  const scope = useMemo(() => {
    if (!user) return { titre: 'Portefeuille DPE', sousTitre: 'Vue consolidée', badge: 'Consolidé' };
    if (isRole('DIR_DPE', 'PMO', 'ADMIN'))
      return { titre: 'Portefeuille DPE — Cockpit Exécutif', sousTitre: 'Vue consolidée — Portefeuille global', badge: 'Consolidé' };
    if (isRole('CHEF_DEPT')) {
      const lib = getDirectionLabel(user.direction || '');
      return { titre: `Portefeuille ${user.departement || lib}`, sousTitre: `Vue département — ${lib}`, badge: 'Département' };
    }
    if (isRole('CTRL_FIN', 'RESP_LOG'))
      return { titre: 'Tableau de bord — Périmètre', sousTitre: `Vue périmètre — ${getDirectionLabel(user.direction || '')}`, badge: 'Périmètre' };
    return { titre: 'Mes projets', sousTitre: 'Vue détaillée — Projets dont je suis responsable ou membre', badge: 'Détaillé' };
  }, [user, isRole]);
  const [drawer, setDrawer] = useState<Projet | null>(null);
  const [filtreDomaine, setFiltreDomaine] = useState<string>('tous');
  const [filtreStatut, setFiltreStatut]   = useState<string>('tous');
  const [activeTab, setActiveTab]         = useState<'cockpit' | 'portfolio' | 'risques'>('cockpit');
  const [arbDecisions, setArbDecisions]   = useState<Record<string, 'approuve' | 'rejete'>>({});
  const [refreshing, setRefreshing]       = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    setFiltreDomaine('tous');
    setFiltreStatut('tous');
    router.refresh();
    setTimeout(() => {
      setRefreshing(false);
      toast.success(`Tableau de bord actualisé — ${store.projets.length} projets`, { duration: 2500 });
    }, 450);
  };

  /* ── Computed metrics ── */
  const metrics = useMemo(() => {
    const p = store.projets;
    const filtered = p
      .filter(pr => filtreDomaine === 'tous' || pr.domaine === filtreDomaine)
      .filter(pr => filtreStatut  === 'tous' || pr.statut  === filtreStatut);

    const tot  = p.length;
    const tb   = p.reduce((s, x) => s + x.budget, 0);
    const td   = p.reduce((s, x) => s + x.budgetDecaisse, 0);
    const te   = p.reduce((s, x) => s + x.budgetEngage, 0);
    const engPct  = tb > 0 ? (td / tb) * 100 : 0;
    const critiques = p.filter(x => x.cpi < 0.90 || x.spi < 0.85 || x.statut === 'en_retard');
    const alertes   = critiques.length;
    const avgAv  = p.length > 0 ? p.reduce((s, x) => s + x.avancement, 0) / p.length : 0;
    const jalonsSoon = p.flatMap(pr => pr.jalons.filter(j => !j.atteint)).slice(0, 5);

    /* Domaine breakdown for bar chart */
    const domaineMap: Record<string, { budget: number; decaisse: number; count: number; color: string; label: string }> = {};
    p.forEach(pr => {
      const dcfg = DOMAINE_CFG[pr.domaine as Domaine];
      if (!domaineMap[pr.domaine]) domaineMap[pr.domaine] = { budget: 0, decaisse: 0, count: 0, color: dcfg.color, label: dcfg.label };
      domaineMap[pr.domaine].budget   += pr.budget;
      domaineMap[pr.domaine].decaisse += pr.budgetDecaisse;
      domaineMap[pr.domaine].count    += 1;
    });
    const domaineData = Object.entries(domaineMap).map(([k, v]) => ({
      name: v.label.split(' ')[0], budget: +(v.budget / 1000).toFixed(1), decaisse: +(v.decaisse / 1000).toFixed(1), color: v.color, count: v.count,
    }));

    /* Priority sort */
    const prioritaires = [...filtered].sort((a, b) => {
      const sa = (2 - a.cpi) + (2 - a.spi) + (a.statut === 'en_retard' ? 1 : 0);
      const sb = (2 - b.cpi) + (2 - b.spi) + (b.statut === 'en_retard' ? 1 : 0);
      return sb - sa;
    });

    return { tot, tb, td, te, engPct, alertes, avgAv, jalonsSoon, domaineData, prioritaires, critiques, filtered };
  }, [store.projets, filtreDomaine, filtreStatut]);

  // DPE energy KPIs (dérivés des données store + coefficients sectoriels)
  const dpeKpis = useMemo(() => {
    const distrib = metrics.filtered.filter(p => p.domaine === 'distribution');
    const prod    = metrics.filtered.filter(p => p.domaine === 'production');
    const trans   = metrics.filtered.filter(p => p.domaine === 'transport');
    // Coefficients calibrés sur des ratios physiques réalistes (budget en MFCFA).
    const kmReseau   = distrib.reduce((s, p) => s + (p.budget * 0.025 * p.avancement / 100), 0);
    const mwInstalle = prod.reduce((s, p) => s + (p.budget * 0.01 * p.avancement / 100), 0);
    const compteurs  = Math.round(distrib.reduce((s, p) => s + (p.budget * 1.0 * p.avancement / 100), 0));
    // Pertes techniques évitées (GWh/an) — impact RÉEL des renforcements réseau (distribution + transport),
    // pas une « économie d'énergie » (hors mission DPE). Seuls les projets réseau contribuent.
    const pertesEvitees = [...distrib, ...trans].reduce((s, p) => s + (p.budget * 0.0012 * p.avancement / 100), 0);
    const conformite = Math.round(metrics.filtered.reduce((s, p) => s + (p.avancement >= 80 ? 92 : p.avancement >= 50 ? 75 : 55), 0) / Math.max(1, metrics.filtered.length));
    const postes     = Math.round(distrib.reduce((s, p) => s + (p.budget * 0.08 * p.avancement / 100), 0) + trans.reduce((s, p) => s + (p.budget * 0.02 * p.avancement / 100), 0));
    return { kmReseau, mwInstalle, compteurs, pertesEvitees, conformite, postes };
  }, [metrics.filtered]);

  // Indicateurs SENELEC officiels + cartes du cockpit ADAPTÉES AU PROFIL (Accueil intelligent).
  const indSenelec = useMemo(() => computeIndicateursSenelec(
    store.projets.map(p => ({
      domaine: p.domaine, budget: p.budget, budgetEngage: p.budgetEngage, budgetDecaisse: p.budgetDecaisse,
      avancement: p.avancement, cpi: p.cpi, spi: p.spi, statut: p.statut,
    })),
  ), [store.projets]);
  const cockpitCards = useMemo(() => cockpitCardsForRole(user?.role ?? '', indSenelec), [user?.role, indSenelec]);

  /* ── Arbitrages dérivés des projets réellement à risque ── */
  const arbitrages = useMemo(() => {
    const fmtDate = (d?: string) => {
      if (!d) return '—';
      const dt = new Date(d);
      return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('fr-FR');
    };
    return metrics.critiques
      .map(p => {
        const ecartBudget = p.budget - p.budgetDecaisse;
        const critique = p.cpi < 0.85 || p.spi < 0.80 || p.statut === 'en_retard';
        let titre: string;
        let action: string;
        if (p.statut === 'en_retard') {
          titre = `Retard planning — ${p.nom}`;
          action = `Replanifier et arbitrer les ressources (SPI ${p.spi.toFixed(2)})`;
        } else if (p.cpi < 0.90) {
          titre = `Dérive budgétaire — ${p.nom}`;
          action = `Valider plan de redressement coûts (CPI ${p.cpi.toFixed(2)}, reste ${fmtM(Math.max(0, ecartBudget))})`;
        } else {
          titre = `Dérive délai — ${p.nom}`;
          action = `Arbitrage planning requis (SPI ${p.spi.toFixed(2)})`;
        }
        return {
          id: p.id,
          projetId: p.id,
          projet: p.code || p.id,
          titre,
          urgence: (critique ? 'critique' : 'attention') as 'critique' | 'attention',
          action,
          resp: p.chefProjet || '—',
          date: fmtDate(p.dateFinEstimee || p.dateFinPrevue),
        };
      })
      .slice(0, 6);
  }, [metrics.critiques]);




  // Domaines limités au périmètre de l'utilisateur (uniquement ceux de ses projets visibles)
  const DOMAINE_OPTS = Object.entries(DOMAINE_CFG)
    .filter(([k]) => store.projets.some(p => p.domaine === k))
    .map(([k, v]) => ({ value: k, label: `${v.emoji} ${v.label}` }));

  // Libellé du cockpit ADAPTÉ AU PROFIL (Direction / Département / Mes projets…).
  const cockpitTabLabel = isRole('DIR_DPE', 'ADMIN', 'PMO')
    ? 'Cockpit Direction'
    : isRole('CHEF_DEPT')
      ? 'Cockpit Département'
      : isRole('CTRL_FIN', 'RESP_LOG')
        ? 'Cockpit Périmètre'
        : 'Mes Projets';
  const portfolioTabLabel = isRole('DIR_DPE', 'ADMIN', 'PMO') ? 'Portefeuille complet'
    : isRole('CHEF_DEPT') ? 'Projets du département' : 'Mes projets détaillés';
  // Profils SUPPORT (UAGL, assistante de direction, secrétaire, chauffeur) : leur cockpit
  // porte sur LEUR travail (missions, courriers, flotte, réunions) — PAS les KPI projet.
  const isSupportProfile =
    isRole('RESP_LOG', 'CHAUFFEUR', 'SECRETAIRE') ||
    (user?.role === 'ASSISTANT' && !isAssistantProjet(user));
  const TABS = isSupportProfile
    ? [{ id: 'cockpit', label: 'Mon espace de travail' }]
    : [
        { id: 'cockpit',   label: cockpitTabLabel },
        { id: 'portfolio', label: portfolioTabLabel },
        { id: 'risques',   label: 'Risques & Alertes' },
      ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.bg, fontFamily: 'inherit' }}>

      {/* ══ HEADER ══════════════════════════════════════════════ */}
      <div style={{ background: '#fff', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>

        {/* Title bar + Global KPIs */}
        <div style={{ padding: '14px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ fontSize: 19, fontWeight: 900, color: '#0F172A', margin: 0 }}>{scope.titre}</h1>
              <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#EEF2FF', color: C.navy }}>{scope.badge}</span>
              <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#DCFCE7', color: C.green }}>● Temps réel</span>
            </div>
            <p style={{ fontSize: 12, color: C.slate, margin: '3px 0 0' }}>
              {isSupportProfile
                ? `${scope.sousTitre} · Mon espace de travail`
                : `${scope.sousTitre} · ${metrics.tot} projets · Budget ${fmtM(metrics.tb)} FCFA · Décaissé ${fmtM(metrics.td)} FCFA`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {/* Filtres + exports PROJET — masqués pour les profils SUPPORT (non pertinents) */}
            {!isSupportProfile && (<>
            {/* Filtre domaine */}
            <select value={filtreDomaine} onChange={e => setFiltreDomaine(e.target.value)} style={{
              padding: '6px 10px', borderRadius: 7, border: `1px solid ${C.border}`,
              fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', color: '#475569', background: '#fff',
            }}>
              <option value="tous">Tous les domaines</option>
              {DOMAINE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button onClick={() => {
              const w = window.open('', '_blank');
              if (!w) { alert('Veuillez autoriser les popups pour générer le PDF.'); return; }
              const rows = metrics.prioritaires.map(p => `<tr><td style="font-weight:700;color:#1B4F8A">${p.code ?? ''}</td><td>${p.nom}</td><td style="text-align:right">${p.avancement}%</td><td style="text-align:right">${p.cpi.toFixed(2)}</td><td style="text-align:right">${p.spi.toFixed(2)}</td></tr>`).join('');
              const barSvg = metrics.prioritaires.map((p, i) => {
                const y = i * 18 + 4;
                const w = (p.avancement / 100) * 200;
                return `<rect x="80" y="${y}" width="200" height="5" fill="#F1F5F9" rx="2.5"/>
                        <rect x="80" y="${y}" width="${w}" height="5" fill="${p.avancement>=80?'#16A34A':p.avancement>=50?'#F59E0B':'#EF4444'}" rx="2.5"/>
                        <text x="75" y="${y+5}" font-size="8" fill="#64748B" text-anchor="end">${p.code}</text>
                        <text x="${80+w+4}" y="${y+5}" font-size="8" fill="#64748B" font-weight="700">${p.avancement}%</text>`;
              }).join('');
              const cpiSpiSvg = metrics.prioritaires.slice(0, 8).map((p, i) => {
                const y = i * 16 + 4;
                const cpiW = Math.min((p.cpi / 1.5) * 120, 120);
                const spiW = Math.min((p.spi / 1.5) * 120, 120);
                return `<text x="70" y="${y+5}" font-size="7" fill="#64748B" text-anchor="end">${p.code.substring(0,10)}</text>
                        <rect x="75" y="${y}" width="${cpiW}" height="4" fill="${p.cpi>=1?'#16A34A':p.cpi>=0.9?'#F59E0B':'#EF4444'}" rx="2"/>
                        <text x="${75+cpiW+3}" y="${y+5}" font-size="7" fill="#64748B">${p.cpi.toFixed(2)}</text>
                        <rect x="210" y="${y}" width="${spiW}" height="4" fill="${p.spi>=1?'#16A34A':p.spi>=0.85?'#F59E0B':'#EF4444'}" rx="2"/>
                        <text x="${210+spiW+3}" y="${y+5}" font-size="7" fill="#64748B">${p.spi.toFixed(2)}</text>`;
              }).join('');
              w.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Tableau de bord DPE</title><style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
                body{font-family:'Inter',Arial,sans-serif;padding:32px 40px;color:#1E293B;font-size:11px}
                .bar{height:4px;background:#F47920;border-radius:2px;margin-bottom:20px}
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
                <div style="margin-bottom:12px"><img src="${SENELEC_LOGO_DATA_URI}" alt="SENELEC" style="height:46px;width:auto;display:block" /></div>
                <h1>Tableau de bord exécutif — DPE</h1>
                <div class="meta">SENELEC · Généré le ${new Date().toLocaleString('fr-FR')} · ${metrics.prioritaires.length} projets prioritaires</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:16px 0">
                  <div class="chart-box">
                    <div class="chart-title">Avancement des projets prioritaires</div>
                    <svg width="100%" height="${Math.max(140, metrics.prioritaires.length * 18)}" viewBox="0 0 320 ${metrics.prioritaires.length * 18}" style="display:block">${barSvg}</svg>
                  </div>
                  <div class="chart-box">
                    <div class="chart-title">CPI / SPI par projet</div>
                    <svg width="100%" height="${Math.max(140, Math.min(8, metrics.prioritaires.length) * 16)}" viewBox="0 0 340 ${Math.min(8, metrics.prioritaires.length) * 16}" style="display:block">
                      <text x="75" y="12" font-size="7" fill="#94A3B8" font-weight="700">CPI</text>
                      <text x="210" y="12" font-size="7" fill="#94A3B8" font-weight="700">SPI</text>
                      ${cpiSpiSvg}
                    </svg>
                  </div>
                </div>
                <table><thead><tr><th>Code</th><th>Projet</th><th style="text-align:right">Avancement</th><th style="text-align:right">CPI</th><th style="text-align:right">SPI</th></tr></thead><tbody>${rows}</tbody></table>
                <div class="footer">CONFIDENTIEL — Usage interne SENELEC · Document généré par SIGEPP-DPE</div>
                <script>window.onload=()=>window.print()</script>
              </body></html>`);
              w.document.close();
            }} aria-label="Exporter le tableau de bord en PDF" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 7, border: `1px solid ${C.border}`, background: '#fff', fontSize: 12.5, color: '#475569', cursor: 'pointer', fontFamily: 'inherit' }}>
              <Download size={13} /> PDF
            </button>
            <button onClick={() => {
              downloadExcel('tableau_bord_dpe', {
                sheetName: 'Tableau de bord',
                title: 'Tableau de bord exécutif — DPE',
                subtitle: 'SENELEC · Direction Principale Équipement',
                headers: ['Code', 'Projet', 'Avancement', 'CPI', 'SPI', 'Domaine', 'Budget prévu', 'Budget décaissé', 'Statut'],
                rows: metrics.filtered.map(p => [p.code ?? '', p.nom, p.avancement, +p.cpi.toFixed(2), +p.spi.toFixed(2), p.domaine, p.budget, p.budgetDecaisse, p.statut]),
              });
            }} aria-label="Exporter le tableau de bord en Excel" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 7, border: `1px solid ${C.border}`, background: '#fff', fontSize: 12.5, color: '#475569', cursor: 'pointer', fontFamily: 'inherit' }}>
              <Download size={13} /> Excel
            </button>
            </>)}
            <button onClick={handleRefresh} disabled={refreshing} aria-label="Actualiser le tableau de bord" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 7, border: 'none', background: C.navy, fontSize: 12.5, color: '#fff', cursor: refreshing ? 'wait' : 'pointer', fontFamily: 'inherit', fontWeight: 700, opacity: refreshing ? 0.75 : 1 }}>
              <RefreshCw size={13} style={{ animation: refreshing ? 'spin 0.6s linear infinite' : undefined }} /> {refreshing ? 'Actualisation…' : 'Actualiser'}
            </button>
          </div>
        </div>

        {/* ── KPI Row (6 cartes PROJET) — masquée pour les profils SUPPORT (UAGL/assistante/secrétaire/chauffeur) ── */}
        {!isSupportProfile && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 0, padding: '12px 24px 0', overflow: 'hidden' }}>
          {[
            { label: 'Projets actifs',        value: String(metrics.tot),             sub: `${metrics.filtered.length} filtrés`, color: C.navy,   icon: <Folder size={15} style={{ color: C.navy   }} />, alert: false, title: `${metrics.tot} projets au total — ${metrics.filtered.length} visibles avec les filtres actuels` },
            { label: 'Budget engagé',         value: fmtPct(metrics.engPct),          sub: `${fmtM(metrics.td)} / ${fmtM(metrics.tb)}`, color: C.green,  icon: <BarChart3 size={15} style={{ color: C.green  }} />, alert: false, title: `Décaissé : ${fmtM(metrics.td)} sur budget total ${fmtM(metrics.tb)} FCFA` },
            { label: 'Avancement moyen',      value: fmtPct(metrics.avgAv),           sub: isRole('DIR_DPE','ADMIN','PMO') ? 'Portefeuille global' : 'Mon périmètre', color: C.purple, icon: <Target   size={15} style={{ color: C.purple }} />, alert: false, title: `Avancement physique moyen du portefeuille : ${fmtPct(metrics.avgAv)}` },
            { label: 'Projets critiques',     value: String(metrics.alertes),         sub: 'CPI < 0.90 ou SPI < 0.85',        color: metrics.alertes > 0 ? C.red : C.green, icon: <AlertTriangle size={15} style={{ color: metrics.alertes > 0 ? C.red : C.green }} />, alert: metrics.alertes > 0, title: `${metrics.alertes} projet(s) avec CPI < 0,90 ou SPI < 0,85 ou en retard` },
            { label: 'Arbitrages en attente', value: String(arbitrages.length),        sub: 'Décisions requises',               color: C.amber,  icon: <Zap      size={15} style={{ color: C.amber  }} />, alert: arbitrages.length > 0, title: `${arbitrages.length} décision(s) d'arbitrage requises` },
            { label: 'Jalons prochain 30j',   value: String(metrics.jalonsSoon.length), sub: 'Jalons non atteints',             color: C.orange, icon: <Flag     size={15} style={{ color: C.orange }} />, alert: false, title: `${metrics.jalonsSoon.length} jalon(s) non atteint(s) à échéance dans les 30 prochains jours` },
          ].map((k, i, arr) => (
            <div key={k.label} title={k.title} style={{
              flex: '1 1 140px', padding: '10px 14px', borderRight: i < arr.length - 1 ? `1px solid ${C.border}` : 'none',
              background: k.alert ? '#FFF8F8' : 'transparent',
              borderBottom: `3px solid ${k.alert ? k.color : 'transparent'}`,
              transition: 'background 0.1s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                <div style={{ width: 26, height: 26, borderRadius: 6, background: `${k.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {k.icon}
                </div>
                {k.alert && (
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: k.color, boxShadow: `0 0 0 3px ${k.color}30` }} />
                )}
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: k.color, lineHeight: 1 }}>{k.value}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#1E293B', marginTop: 2 }}>{k.label}</div>
              <div style={{ fontSize: 10, color: '#94A3B8' }}>{k.sub}</div>
            </div>
          ))}
        </div>
        )}

        {/* Onglets */}
        <div style={{ display: 'flex', padding: '0 24px', marginTop: 4, overflowX: 'auto', scrollbarWidth: 'thin' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id as typeof activeTab)} style={{
              padding: '8px 16px', border: 'none', flexShrink: 0, whiteSpace: 'nowrap',
              borderBottom: activeTab === t.id ? `2px solid ${C.orange}` : '2px solid transparent',
              background: 'transparent', fontSize: 13,
              fontWeight: activeTab === t.id ? 700 : 400,
              color: activeTab === t.id ? C.orange : C.slate,
              cursor: 'pointer', fontFamily: 'inherit', marginBottom: -1,
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* ══ BODY ════════════════════════════════════════════════ */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>

        {/* ── DPE Energy & Indicateurs Métier (dans le flux scrollable, compact) ── */}
        {canSeeConsolidated && (
        <details open style={{ background: 'linear-gradient(135deg, #1B4F8A 0%, #0F3460 100%)', borderRadius: 10, padding: '8px 12px', marginBottom: 16 }}>
          <summary style={{ fontSize: 9.5, fontWeight: 700, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '.7px', cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Zap size={12} style={{ color: '#FCD34D' }} /> Indicateurs DPE &amp; Énergie — {isRole('DIR_DPE','ADMIN','PMO') ? 'Portefeuille consolidé' : 'Mon périmètre'}</span>
            <span style={{ fontSize: 9, opacity: 0.6, display: 'inline-flex', alignItems: 'center', gap: 2 }}>réduire <ChevronRight size={10} style={{ transform: 'rotate(90deg)' }} /></span>
          </summary>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 7, marginTop: 8 }}>
            {[
              { Icon: Cable,       label: 'Réseau HTA/BT',  val: `${dpeKpis.kmReseau.toFixed(0)} km`,      sub: 'déployé',      color: '#60A5FA' },
              { Icon: Building2,   label: 'Postes transfo', val: String(dpeKpis.postes),                   sub: 'installés',    color: '#059669' },
              { Icon: Zap,         label: 'MW installés',   val: `${dpeKpis.mwInstalle.toFixed(0)} MW`,    sub: 'production',   color: '#FCD34D' },
              { Icon: Gauge,       label: 'Compteurs posés', val: dpeKpis.compteurs.toLocaleString('fr'),  sub: 'actifs',       color: '#C084FC' },
              { Icon: TrendingDown, label: 'Pertes évitées', val: `${dpeKpis.pertesEvitees.toFixed(1)} GWh`, sub: 'par an',     color: '#6EE7B7' },
              { Icon: ShieldCheck, label: 'Conformité DPE', val: `${dpeKpis.conformite}%`,                 sub: 'moy. portef.', color: dpeKpis.conformite >= 80 ? '#4ADE80' : '#F87171' },
            ].map(k => (
              <div key={k.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <div style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 6, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <k.Icon size={14} style={{ color: k.color }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 800, color: k.color, lineHeight: 1.05 }}>{k.val}</div>
                  <div style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.55)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.label} · {k.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </details>
        )}

        {/* ═══════════ COCKPIT SUPPORT (UAGL/assistante/secrétaire/chauffeur) ═══════════ */}
        {activeTab === 'cockpit' && isSupportProfile && (
          <SupportCockpit role={user?.role ?? ''} router={router} />
        )}

        {/* ════════════════════════ COCKPIT ════════════════════ */}
        {activeTab === 'cockpit' && !isSupportProfile && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Cockpit du PROFIL — indicateurs SENELEC adaptés au rôle connecté */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
              {cockpitCards.map((c, i) => (
                <div key={i} style={{ background: C.surface, borderRadius: 10, border: `1px solid ${C.border}`, borderLeft: `3px solid ${c.accent ?? C.navy}`, padding: '12px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                  <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, marginBottom: 4 }}>{c.label}</div>
                  <div style={{ fontSize: 19, fontWeight: 800, color: c.accent ?? '#0F172A', lineHeight: 1.1 }}>{c.value}</div>
                  {c.sub && <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 3 }}>{c.sub}</div>}
                </div>
              ))}
            </div>

            {/* Row 1 : Projets prioritaires + Arbitrages */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 14 }}>

              {/* Projets prioritaires */}
              <div style={{ background: C.surface, borderRadius: 10, border: `1px solid ${C.border}`, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                <div style={{ padding: '11px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FAFBFD' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Flag size={13} style={{ color: C.navy }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Projets prioritaires</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: '#EFF6FF', color: C.navy }}>{metrics.prioritaires.length}</span>
                  </div>
                  <Link href="/portefeuille" style={{ fontSize: 11.5, color: C.navy, textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                    Voir tout <ChevronRight size={12} />
                  </Link>
                </div>

                {/* En-têtes */}
                <div style={{ display: 'grid', gridTemplateColumns: '8px 1fr 90px 50px 50px 6px', padding: '6px 14px', gap: 8, background: '#F8FAFC', borderBottom: `1px solid ${C.border}`, fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', alignItems: 'center' }}>
                  <span></span><span>Projet</span><span style={{ textAlign: 'right' }}>Avanc.</span><span style={{ textAlign: 'center' }}>CPI</span><span style={{ textAlign: 'center' }}>SPI</span><span></span>
                </div>

                {metrics.prioritaires.map(p => {
                  const dcfg = DOMAINE_CFG[p.domaine as Domaine];
                  const rag  = ragColor(p.cpi, p.spi);
                  const cpiOk = p.cpi >= 0.90;
                  const spiOk = p.spi >= 0.85;
                  return (
                    <div key={p.id}
                      onClick={() => setDrawer(p)}
                      style={{ display: 'grid', gridTemplateColumns: '8px 1fr 90px 50px 50px 6px', padding: '8px 14px', borderBottom: `1px solid #F8FAFC`, gap: 8, cursor: 'pointer', alignItems: 'center', transition: 'background 0.08s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: rag, boxShadow: `0 0 0 2px ${rag}30` }} />
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: dcfg.color }}>{p.code.split('-').slice(0, 2).join('-')}</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#1E293B' }}>{p.nom.length > 38 ? p.nom.slice(0, 38) + '…' : p.nom}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span style={{ fontSize: 10, color: C.slate }}>{dcfg.emoji} {dcfg.label}</span>
                          {p.statut === 'en_retard' && <span style={{ fontSize: 9.5, color: C.red, fontWeight: 700, background: '#FEE2E2', padding: '1px 4px', borderRadius: 4 }}>RETARD</span>}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: p.avancement >= 70 ? C.green : C.amber }}>{p.avancement}%</div>
                        <div style={{ height: 3, background: '#F1F5F9', borderRadius: 2, overflow: 'hidden', width: 60, marginLeft: 'auto', marginTop: 3 }}>
                          <div style={{ width: `${p.avancement}%`, height: '100%', background: p.avancement >= 70 ? C.green : C.amber, borderRadius: 2 }} />
                        </div>
                      </div>
                      <div style={{ textAlign: 'center', fontSize: 11, fontWeight: 800, color: cpiOk ? C.green : C.red }}>{p.cpi.toFixed(2)}</div>
                      <div style={{ textAlign: 'center', fontSize: 11, fontWeight: 800, color: spiOk ? C.green : C.amber }}>{p.spi.toFixed(2)}</div>
                      <ChevronRight size={11} style={{ color: '#CBD5E1' }} />
                    </div>
                  );
                })}
                {metrics.prioritaires.length === 0 && (
                  <div style={{ padding: 28, textAlign: 'center', color: C.slate, fontSize: 13 }}>Aucun projet correspondant aux filtres</div>
                )}
              </div>

              {/* Arbitrages rapides */}
              <div style={{ background: C.surface, borderRadius: 10, border: `1px solid ${C.border}`, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '11px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8, background: '#FFFBF5' }}>
                  <Zap size={13} style={{ color: C.orange }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Arbitrages rapides</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: '#FFF7ED', color: C.orange }}>{arbitrages.length}</span>
                </div>
                <div style={{ flex: 1 }}>
                  {arbitrages.length === 0 && (
                    <div style={{ padding: 28, textAlign: 'center', color: C.slate, fontSize: 12.5 }}>Aucun arbitrage en attente — portefeuille sous contrôle</div>
                  )}
                  {arbitrages.map((arb, i) => (
                    <div key={arb.id} style={{ padding: '12px 16px', borderBottom: i < arbitrages.length - 1 ? `1px solid #FEF3E2` : 'none', background: arb.urgence === 'critique' ? '#FFF8F8' : '#fff' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                        <CircleDot size={10} style={{ color: arb.urgence === 'critique' ? C.red : C.amber, flexShrink: 0 }} />
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: '#1E293B', flex: 1 }}>{arb.titre}</span>
                        <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 8, background: arb.urgence === 'critique' ? '#FEE2E2' : '#FFF7ED', color: arb.urgence === 'critique' ? C.red : C.amber }}>
                          {arb.urgence === 'critique' ? 'Critique' : 'Attention'}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: C.slate, marginBottom: 6 }}>
                        {arb.projet} · Resp. {arb.resp} · Éch. {arb.date}
                      </div>
                      <div style={{ padding: '5px 8px', background: '#F8FAFC', borderRadius: 6, borderLeft: `3px solid ${arb.urgence === 'critique' ? C.red : C.amber}`, fontSize: 11.5, color: '#334155', marginBottom: 8 }}>
                        {arb.action}
                      </div>
                      {arbDecisions[arb.id] ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 6, background: arbDecisions[arb.id] === 'approuve' ? '#DCFCE7' : '#FEE2E2', color: arbDecisions[arb.id] === 'approuve' ? C.green : C.red, fontSize: 11, fontWeight: 700 }}>
                          {arbDecisions[arb.id] === 'approuve' ? <><Check size={13} /> Arbitrage approuvé</> : <><X size={13} /> Arbitrage rejeté</>}
                          <button onClick={() => setArbDecisions(d => { const n = { ...d }; delete n[arb.id]; return n; })} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', fontSize: 10, textDecoration: 'underline' }}>Annuler</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => setArbDecisions(d => ({ ...d, [arb.id]: 'approuve' }))} style={{ flex: 1, padding: '5px 0', borderRadius: 6, border: 'none', background: C.green, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}><Check size={13} /> Approuver</button>
                          <button onClick={() => setArbDecisions(d => ({ ...d, [arb.id]: 'rejete' }))} style={{ flex: 1, padding: '5px 0', borderRadius: 6, border: 'none', background: C.red, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}><X size={13} /> Rejeter</button>
                          <button onClick={() => router.push(`/cockpit-projet?projet=${encodeURIComponent(arb.projetId)}`)} style={{ padding: '5px 10px', borderRadius: 6, border: `1px solid ${C.navy}`, background: '#fff', color: C.navy, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Ouvrir</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Row 2 : Courbe S + Budget par domaine + Milestones */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px 280px', gap: 14 }}>

              {/* Courbe S */}
              <div style={{ background: C.surface, borderRadius: 10, border: `1px solid ${C.border}`, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <Activity size={13} style={{ color: C.navy }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Courbe S — Portefeuille 2026</span>
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    {[{ color: C.navy, label: 'Prévisionnel', dash: true }, { color: C.green, label: 'Réalisé' }].map(l => (
                      <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: C.slate }}>
                        <div style={{ width: 16, height: 2, borderTop: l.dash ? `2px dashed ${l.color}` : `2px solid ${l.color}`, opacity: 0.8 }} />
                        {l.label}
                      </div>
                    ))}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={155}>
                  <AreaChart data={SCURVE}>
                    <defs>
                      <linearGradient id="lgR" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={C.green} stopOpacity={0.22} />
                        <stop offset="95%" stopColor={C.green} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#F1F5F9" vertical={false} />
                    <XAxis dataKey="m" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} unit="%" domain={[0, 100]} />
                    <Tooltip formatter={(v: number | string | Array<number | string>) => typeof v === 'number' ? [`${v}%`] : ['—']} />
                    <ReferenceLine x="M" stroke={C.orange} strokeDasharray="3 2" strokeWidth={1} label={{ value: 'Auj.', fontSize: 9, fill: C.orange }} />
                    <Area type="monotone" dataKey="p" name="Prévu" stroke={C.navy} strokeWidth={1.5} strokeDasharray="5 3" fill="none" dot={false} />
                    <Area type="monotone" dataKey="r" name="Réel" stroke={C.green} strokeWidth={2.5} fill="url(#lgR)" dot={{ r: 3, fill: C.green }} connectNulls={false} />
                  </AreaChart>
                </ResponsiveContainer>
                {/* Delta */}
                <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
                  <div style={{ fontSize: 11, color: C.slate }}>Prévisionnel mai : <strong style={{ color: C.navy }}>44%</strong></div>
                  <div style={{ fontSize: 11, color: C.slate }}>Réalisé mai : <strong style={{ color: C.green }}>36%</strong></div>
                  <div style={{ fontSize: 11, color: C.slate }}>Écart : <strong style={{ color: C.red }}>-8 pts</strong></div>
                </div>
              </div>

              {/* Budget par domaine */}
              <div style={{ background: C.surface, borderRadius: 10, border: `1px solid ${C.border}`, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                  <DollarSign size={13} style={{ color: C.green }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Budget par domaine</span>
                </div>
                {metrics.domaineData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={110}>
                      <BarChart data={metrics.domaineData} barSize={14} layout="vertical">
                        <XAxis type="number" tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false} unit=" Md" />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} width={60} />
                        <Tooltip formatter={(v: number) => [`${v} Md FCFA`]} />
                        <Bar dataKey="budget"   name="Budget total" radius={[0,3,3,0]} opacity={0.5}>
                          {metrics.domaineData.map((d, i) => <Cell key={i} fill={d.color} />)}
                        </Bar>
                        <Bar dataKey="decaisse" name="Décaissé" radius={[0,3,3,0]}>
                          {metrics.domaineData.map((d, i) => <Cell key={i} fill={d.color} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {metrics.domaineData.map(d => (
                        <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color }} />
                          <span style={{ flex: 1, color: '#475569' }}>{d.name}</span>
                          <span style={{ fontWeight: 700, color: '#1E293B' }}>{d.count} proj.</span>
                          <span style={{ color: C.slate }}>{d.decaisse} / {d.budget} Md</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div style={{ padding: 20, textAlign: 'center', color: '#94A3B8', fontSize: 12 }}>Aucune donnée</div>
                )}
              </div>

              {/* Prochains jalons */}
              <div style={{ background: C.surface, borderRadius: 10, border: `1px solid ${C.border}`, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                <div style={{ padding: '11px 14px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 7, background: '#FAFBFD' }}>
                  <Calendar size={13} style={{ color: C.purple }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Prochains jalons</span>
                </div>
                {store.projets.flatMap(pr =>
                  pr.jalons.filter(j => !j.atteint).map(j => ({
                    ...j, code: pr.code, dom: pr.domaine as Domaine,
                  }))
                ).slice(0, 6).map((j, i) => {
                  const dcfg = DOMAINE_CFG[j.dom];
                  return (
                    <div key={i} style={{ padding: '9px 14px', borderBottom: `1px solid #F8FAFC`, display: 'flex', gap: 10, alignItems: 'center' }}>
                      <div style={{ width: 28, height: 28, borderRadius: 7, background: `${dcfg.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>{dcfg.emoji}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11.5, fontWeight: 600, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.label}</div>
                        <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>{j.code} · {j.date}</div>
                      </div>
                      <Flag size={10} style={{ color: C.orange, flexShrink: 0 }} />
                    </div>
                  );
                })}
                {store.projets.flatMap(pr => pr.jalons.filter(j => !j.atteint)).length === 0 && (
                  <div style={{ padding: 24, textAlign: 'center', color: C.slate, fontSize: 12 }}>Aucun jalon à venir</div>
                )}
              </div>
            </div>

          </div>
        )}

        {/* ════════════════════════ PORTFOLIO ══════════════════ */}
        {activeTab === 'portfolio' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Filtres */}
            <div style={{ display: 'flex', gap: 8 }}>
              {(['tous', 'en_cours', 'en_retard', 'planifie', 'suspendu'] as const).map(s => (
                <button key={s} onClick={() => setFiltreStatut(s)} style={{
                  padding: '5px 12px', borderRadius: 20, fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit',
                  border: filtreStatut === s ? `1px solid ${C.navy}` : `1px solid ${C.border}`,
                  background: filtreStatut === s ? C.navy : '#fff',
                  color: filtreStatut === s ? '#fff' : C.slate,
                  fontWeight: filtreStatut === s ? 700 : 400,
                }}>
                  {s === 'tous' ? 'Tous' : STATUT_CFG[s]?.label ?? s}
                </button>
              ))}
              <span style={{ marginLeft: 'auto', fontSize: 12, color: C.slate, display: 'flex', alignItems: 'center' }}>
                {metrics.filtered.length} / {metrics.tot} projets
              </span>
            </div>

            {/* Tableau */}
            <div style={{ background: C.surface, borderRadius: 10, border: `1px solid ${C.border}`, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '8px 32px 1fr 100px 80px 64px 64px 110px 80px',
                padding: '7px 14px', gap: 8, background: '#F8FAFC', borderBottom: `1px solid ${C.border}`,
                fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', alignItems: 'center',
              }}>
                <span></span><span></span><span>Projet</span><span>Statut</span><span style={{ textAlign: 'right' }}>Avanc.</span>
                <span style={{ textAlign: 'center' }}>CPI</span><span style={{ textAlign: 'center' }}>SPI</span>
                <span style={{ textAlign: 'right' }}>Budget</span><span style={{ textAlign: 'right' }}>Décaissé</span>
              </div>

              {metrics.filtered.length === 0 && (
                <div style={{ padding: 32, textAlign: 'center', color: '#94A3B8' }}>
                  <Filter size={28} style={{ margin: '0 auto 8px', display: 'block', color: '#CBD5E1' }} />
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.slate }}>Aucun projet ne correspond aux filtres</div>
                  <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 4 }}>Modifiez le filtre domaine ou statut pour afficher des projets.</div>
                </div>
              )}
              {metrics.filtered.map((p, i) => {
                const dcfg  = DOMAINE_CFG[p.domaine as Domaine];
                const scfg  = STATUT_CFG[p.statut as StatutProjet];
                const rag   = ragColor(p.cpi, p.spi);
                const engPct = p.budget > 0 ? Math.round((p.budgetDecaisse / p.budget) * 100) : 0;
                return (
                  <div key={p.id}
                    onClick={() => setDrawer(p)}
                    style={{ display: 'grid', gridTemplateColumns: '8px 32px 1fr 100px 80px 64px 64px 110px 80px', padding: '9px 14px', borderBottom: i < metrics.filtered.length - 1 ? `1px solid #F8FAFC` : 'none', gap: 8, cursor: 'pointer', alignItems: 'center', transition: 'background 0.08s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: rag, boxShadow: `0 0 0 2px ${rag}30` }} />
                    <div style={{ width: 26, height: 26, borderRadius: 6, background: `${dcfg.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>{dcfg.emoji}</div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#1E293B' }}>
                        <span style={{ color: dcfg.color, fontSize: 10, marginRight: 5 }}>{p.code}</span>
                        {p.nom.length > 42 ? p.nom.slice(0, 42) + '…' : p.nom}
                      </div>
                      <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>{p.chefProjet} · {p.region}</div>
                    </div>
                    <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 8, background: `${scfg.color}18`, color: scfg.color }}>{scfg.label}</span>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: p.avancement >= 70 ? C.green : C.amber }}>{p.avancement}%</div>
                      <div style={{ height: 3, background: '#F1F5F9', borderRadius: 2, overflow: 'hidden', width: 55, marginLeft: 'auto', marginTop: 2 }}>
                        <div style={{ width: `${p.avancement}%`, height: '100%', background: p.avancement >= 70 ? C.green : C.amber }} />
                      </div>
                    </div>
                    <div style={{ textAlign: 'center', fontSize: 11, fontWeight: 800, color: p.cpi >= 0.90 ? C.green : C.red }}>{p.cpi.toFixed(2)}</div>
                    <div style={{ textAlign: 'center', fontSize: 11, fontWeight: 800, color: p.spi >= 0.85 ? C.green : C.amber }}>{p.spi.toFixed(2)}</div>
                    <div style={{ textAlign: 'right', fontSize: 11, color: '#475569' }}>{fmtM(p.budget)} FCFA</div>
                    <div style={{ textAlign: 'right', fontSize: 11, fontWeight: 700, color: engPct >= 70 ? C.green : C.amber }}>{engPct}%</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ════════════════════════ RISQUES ════════════════════ */}
        {activeTab === 'risques' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Projets critiques */}
            <div style={{ background: C.surface, borderRadius: 10, border: `1px solid #FECACA`, overflow: 'hidden', boxShadow: '0 0 0 3px rgba(239,51,64,0.06)' }}>
              <div style={{ padding: '11px 16px', borderBottom: '1px solid #FEE2E2', background: '#FFF5F5', display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={13} style={{ color: C.red }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#7F1D1D' }}>Projets en situation critique</span>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 8, background: '#FEE2E2', color: C.red }}>{metrics.critiques.length}</span>
              </div>
              {metrics.critiques.map((p, i, arr) => {
                const dcfg = DOMAINE_CFG[p.domaine as Domaine];
                return (
                  <div key={p.id} onClick={() => setDrawer(p)} style={{ padding: '12px 16px', borderBottom: i < arr.length - 1 ? '1px solid #FEE2E2' : 'none', display: 'flex', gap: 12, cursor: 'pointer', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#FFF8F8')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>
                        <span style={{ color: dcfg.color, fontSize: 11, marginRight: 6 }}>{p.code}</span>{p.nom}
                      </div>
                      <div style={{ fontSize: 11, color: C.slate, marginTop: 3 }}>
                        {dcfg.emoji} {dcfg.label} · Chef : {p.chefProjet} · Avancement {p.avancement}%
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {p.cpi < 0.90 && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: '#FEE2E2', color: C.red }}>CPI {p.cpi.toFixed(2)}</span>}
                      {p.spi < 0.85 && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: '#FFF7ED', color: C.amber }}>SPI {p.spi.toFixed(2)}</span>}
                      {p.statut === 'en_retard' && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: '#FEE2E2', color: C.red }}>RETARD</span>}
                      <button onClick={e => { e.stopPropagation(); router.push(`/cockpit-projet?code=${encodeURIComponent(p.code)}`); }} style={{ padding: '5px 11px', borderRadius: 6, border: 'none', background: C.red, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Analyser</button>
                    </div>
                  </div>
                );
              })}
              {metrics.critiques.length === 0 && (
                <div style={{ padding: 32, textAlign: 'center' }}>
                  <CheckCircle2 size={28} style={{ color: C.green, margin: '0 auto 8px', display: 'block' }} />
                  <div style={{ fontSize: 13, color: C.green, fontWeight: 700 }}>Aucun projet en situation critique</div>
                </div>
              )}
            </div>

            {/* Arbitrages requis */}
            <div style={{ background: C.surface, borderRadius: 10, border: `1px solid ${C.border}`, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <div style={{ padding: '11px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8, background: '#FFFBF5' }}>
                <Clock size={13} style={{ color: C.amber }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Actions & Décisions requises ({arbitrages.length})</span>
              </div>
              {arbitrages.length === 0 && (
                <div style={{ padding: 28, textAlign: 'center', color: C.slate, fontSize: 12.5 }}>Aucune action en attente</div>
              )}
              {arbitrages.map((arb, i) => (
                <div key={arb.id} style={{ padding: '12px 16px', borderBottom: i < arbitrages.length - 1 ? `1px solid #F1F5F9` : 'none', display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: arb.urgence === 'critique' ? '#FEE2E2' : '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Bell size={14} style={{ color: arb.urgence === 'critique' ? C.red : C.amber }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>{arb.titre}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{arb.projet} · Resp. {arb.resp} · Éch. {arb.date}</div>
                    <div style={{ fontSize: 12, color: '#475569', marginTop: 4, fontStyle: 'italic' }}>{arb.action}</div>
                  </div>
                  <button onClick={() => router.push(`/cockpit-projet?projet=${encodeURIComponent(arb.projetId)}`)} style={{ padding: '6px 14px', borderRadius: 7, border: 'none', background: C.navy, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Traiter</button>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* ══ DRAWER ══════════════════════════════════════════════ */}
      {drawer && <ProjetDrawer projet={drawer} onClose={() => setDrawer(null)} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   COCKPIT SUPPORT — UAGL · Assistante de direction · Secrétaire · Chauffeur
   Vue centrée sur LEUR travail quotidien (missions, courriers, réunions,
   flotte, GED) — AUCUN KPI projet / financier / énergie.
═══════════════════════════════════════════════════════════════ */
interface SupportTile { label: string; desc: string; href: string; icon: React.ReactNode; accent: string; }

function SupportCockpit({ role, router }: { role: string; router: ReturnType<typeof useRouter> }) {
  const mr = useMeetingRoom();
  const odmCfg = useOdmConfig();
  const demandesReunion = mr.reservations.filter(r => r.statut === 'demande').length;
  const reunionsConfirmees = mr.reservations.filter(r => r.statut === 'confirmee').length;

  const vehiculesTotal = odmCfg.vehicules.length;
  const vehiculesPanne = 1; // Mock
  const vehiculesDispos = vehiculesTotal - vehiculesPanne;

  const CFG: Record<string, { titre: string; sous: string; cards: { label: string; value: string; sub?: string; accent: string }[]; tiles: { label: string; desc: string; href: string; icon: any; accent: string }[] }> = {
    RESP_LOG: {
      titre: 'Espace UAGL — Administration & Logistique',
      sous: 'Missions, flotte, ressources et patrimoine de votre périmètre',
      cards: [
        { label: 'Missions en cours', value: '4', sub: 'sur le terrain', accent: C.navy },
        { label: 'Véhicules dispo.', value: String(vehiculesDispos), sub: `sur ${vehiculesTotal} total`, accent: C.green },
        { label: 'Véhicules en panne', value: String(vehiculesPanne), sub: 'en réparation', accent: C.red },
        { label: 'Demandes salle', value: String(demandesReunion), sub: 'en attente', accent: C.orange },
        { label: 'Conso. Carburant', value: '450 L', sub: 'cette semaine', accent: C.purple },
        { label: 'Taux utilisation', value: '80%', sub: 'flotte automobile', accent: C.amber },
      ],
      tiles: [
        { label: 'Ordres de mission', desc: 'ODM · validation · véhicules', href: '/odm', icon: <Activity size={18} />, accent: C.navy },
        { label: 'Flotte & Chauffeurs', desc: 'parc · carburant · maintenance', href: '/flotte', icon: <Fuel size={18} />, accent: C.purple },
        { label: 'Ressources Humaines', desc: 'logistique RH', href: '/rh', icon: <Users size={18} />, accent: C.green },
        { label: 'Réservation de salle', desc: 'salles · équipements · réunions', href: '/reservation-salle', icon: <Calendar size={18} />, accent: C.orange },
        { label: 'Courriers', desc: 'entrants · sortants · parapheur', href: '/courriers', icon: <Bell size={18} />, accent: '#0891B2' },
        { label: 'Réceptions & Appui', desc: 'support logistique projets', href: '/receptions', icon: <CheckCircle2 size={18} />, accent: C.green },
        { label: 'Patrimoine & Inventaire', desc: 'mobilier · équipements', href: '/immobilisations', icon: <Layers size={18} />, accent: C.slate },
        { label: 'GED & Documents', desc: 'classement · archivage', href: '/ged', icon: <Folder size={18} />, accent: C.navy },
      ],
    },
    CHAUFFEUR: {
      titre: 'Mon espace chauffeur',
      sous: 'Mes missions et mon véhicule',
      cards: [
        { label: 'Missions semaine', value: '2', sub: 'affectées', accent: C.navy },
        { label: 'Véhicule', value: 'SN-0234-DA', sub: 'affecté', accent: C.green },
        { label: 'Carburant', value: 'En attente', sub: 'validation', accent: C.orange },
        { label: 'Alerte maintenance', value: '500 km', sub: 'avant vidange', accent: C.red },
      ],
      tiles: [
        { label: 'Mes missions', desc: 'missions affectées · calendrier', href: '/odm', icon: <Activity size={18} />, accent: C.navy },
        { label: 'Mon véhicule', desc: 'véhicule affecté · documents', href: '/flotte', icon: <Fuel size={18} />, accent: C.purple },
        { label: 'Réservation de salle', desc: 'demandes de salle', href: '/reservation-salle', icon: <Calendar size={18} />, accent: C.orange },
      ],
    },
    SECRETAIRE: {
      titre: 'Espace Secrétariat — Administration Département',
      sous: 'Courriers, réunions, GED et liste des projets (lecture)',
      cards: [
        { label: 'Courriers', value: '12', sub: 'à traiter', accent: '#0891B2' },
        { label: 'Demandes de réservation', value: String(demandesReunion), sub: 'à traiter', accent: C.orange },
        { label: 'Réunions prévues', value: String(reunionsConfirmees), accent: C.green },
        { label: 'Parapheur', value: '5', sub: 'en attente de signature', accent: C.navy },
      ],
      tiles: [
        { label: 'Courriers du département', desc: 'entrants · sortants · notes', href: '/courriers', icon: <Bell size={18} />, accent: '#0891B2' },
        { label: 'Projets (lecture)', desc: 'liste · statuts · chefs de projet', href: '/projets', icon: <Folder size={18} />, accent: C.navy },
        { label: 'GED & Documents', desc: 'classement · archivage', href: '/ged', icon: <Folder size={18} />, accent: C.slate },
        { label: 'Réunions & Salles', desc: 'réservations · planning', href: '/reservation-salle', icon: <Calendar size={18} />, accent: C.orange },
        { label: 'Agenda & Contacts', desc: 'annuaire · plannings', href: '/agenda', icon: <Users size={18} />, accent: C.purple },
      ],
    },
    ASSISTANT: {
      titre: 'Espace Assistante de Direction',
      sous: 'Agenda, courriers, réunions et validations documentaires',
      cards: [
        { label: 'Courriers direction', value: '8', sub: 'à traiter', accent: '#0891B2' },
        { label: 'Parapheur', value: '14', sub: 'en attente de signature', accent: C.navy },
        { label: 'Demandes de réservation', value: String(demandesReunion), sub: 'à traiter', accent: C.orange },
        { label: 'Réunions confirmées', value: String(reunionsConfirmees), accent: C.green },
      ],
      tiles: [
        { label: 'Courriers', desc: 'entrants · sortants · affectation', href: '/courriers', icon: <Bell size={18} />, accent: '#0891B2' },
        { label: 'Agenda & Réunions', desc: 'réunions · comités · missions', href: '/reservation-salle', icon: <Calendar size={18} />, accent: C.orange },
        { label: 'GED Direction', desc: 'notes · rapports · PV', href: '/ged', icon: <Folder size={18} />, accent: C.navy },
        { label: 'Parapheur / Validations', desc: 'documents à signer · à valider', href: '/workflows', icon: <CheckCircle2 size={18} />, accent: C.green },
        { label: 'Reporting & Exports', desc: 'documents de synthèse', href: '/reporting', icon: <BarChart3 size={18} />, accent: C.slate },
      ],
    },
  };

  const cfg = CFG[role] ?? CFG.ASSISTANT;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ fontSize: 17, fontWeight: 800, color: '#0F172A', margin: 0 }}>{cfg.titre}</h2>
        <div style={{ fontSize: 12.5, color: C.slate, marginTop: 3 }}>{cfg.sous}</div>
      </div>

      {/* Indicateurs métier (PAS de KPI projet) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
        {cfg.cards.map((c, i) => (
          <div key={i} style={{ background: C.surface, borderRadius: 10, border: `1px solid ${C.border}`, borderLeft: `3px solid ${c.accent}`, padding: '12px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 19, fontWeight: 800, color: c.accent, lineHeight: 1.1 }}>{c.value}</div>
            {c.sub && <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 3 }}>{c.sub}</div>}
          </div>
        ))}
      </div>

      {/* Tuiles d'accès aux modules métier */}
      <div>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Mes modules</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 12 }}>
          {cfg.tiles.map((t, i) => (
            <button key={i} onClick={() => router.push(t.href)}
              style={{ textAlign: 'left', background: C.surface, borderRadius: 10, border: `1px solid ${C.border}`, padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'inherit', transition: 'box-shadow .15s, border-color .15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 14px rgba(15,23,42,0.10)'; (e.currentTarget as HTMLButtonElement).style.borderColor = t.accent; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'; (e.currentTarget as HTMLButtonElement).style.borderColor = C.border; }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: `${t.accent}15`, color: t.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{t.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A' }}>{t.label}</div>
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{t.desc}</div>
              </div>
              <ChevronRight size={16} style={{ color: '#CBD5E1', flexShrink: 0 }} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
