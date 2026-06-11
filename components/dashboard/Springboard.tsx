'use client';

/**
 * Springboard — Tableau de bord Chef de Projet / PMO (SIGEPP-DPE)
 * Inspiré du Springboard Oracle SIGP PPM (Guide p.41) + contexte DPE SENELEC.
 * Sections : Mes Projets (RAG) · Ressources (heures hebdo) · Incidents
 */
import { useState, useMemo } from 'react';
import {
  AlertTriangle, CheckCircle2, Clock, Users, TrendingUp,
  Plus, X, Save, ChevronDown, ChevronRight,
  FileWarning, Zap, BarChart3, Calendar, Flag, Target,
  ArrowUpRight, ArrowDownRight, Minus, Activity,
} from 'lucide-react';
import {
  useProjectStore,
  calculerStatutGlobal,
  type Projet,
  type StatutGlobal,
  type Incident,
  type PointAction,
  type PrioriteIncident,
  type StatutIncident,
  type TypeIncident,
} from '@/lib/projectStore';
import { useAuth } from '@/lib/authStore';

const PURPLE = '#3D1A6B';
const ORANGE = '#F47920';
const NAVY   = '#1B4F8A';

// ── Helpers ──────────────────────────────────────────────────────────────────
function ragColor(s: StatutGlobal) {
  if (s === 'vert')   return { bg: '#DCFCE7', color: '#16A34A', border: '#BBF7D0', label: 'En bonne santé' };
  if (s === 'orange') return { bg: '#FEF3C7', color: '#92400E', border: '#FDE68A', label: 'À risque' };
  return                     { bg: '#FEE2E2', color: '#991B1B', border: '#FCA5A5', label: 'Critique' };
}

function fmtPct(n: number) { return `${n.toFixed(1)}%`; }
function fmtM(n: number)   { return `${n >= 1000 ? (n / 1000).toFixed(1) + 'G' : n.toFixed(0) + 'M'} FCFA`; }

type SpringTab = 'projets' | 'ressources' | 'incidents';

// ─────────────────────────────────────────────────────────────────────────────
// Incidents local state (per-session, stored in projectStore globally)
// ─────────────────────────────────────────────────────────────────────────────

interface IncidentForm {
  synthese: string;
  projetId: string;
  priorite: PrioriteIncident;
  type: TypeIncident;
  dateRequise: string;
  description: string;
}

const EMPTY_FORM: IncidentForm = {
  synthese: '', projetId: '', priorite: 'Moyenne', type: 'General', dateRequise: '', description: '',
};

// ─────────────────────────────────────────────────────────────────────────────
export default function Springboard() {
  const store    = useProjectStore();
  const { user } = useAuth();
  const [tab, setTab]       = useState<SpringTab>('projets');
  const [showIncForm, setShowIncForm] = useState(false);
  const [incForm, setIncForm]         = useState<IncidentForm>(EMPTY_FORM);
  const [expandedInc, setExpandedInc] = useState<string | null>(null);
  const [paForm, setPaForm]           = useState<{ incId: string; synthese: string; proprio: string; date: string } | null>(null);

  // Filter projects by visibility (store already handles RBAC)
  const projets = store.projets;

  // ── KPIs globaux ──────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total  = projets.length;
    const rouges = projets.filter(p => (p.statutGlobal ?? calculerStatutGlobal({ cpi: p.cpi, spi: p.spi, avancement: p.avancement, avancementPlanifie: p.avancementPlanifie })) === 'rouge').length;
    const oranges = projets.filter(p => (p.statutGlobal ?? calculerStatutGlobal({ cpi: p.cpi, spi: p.spi, avancement: p.avancement, avancementPlanifie: p.avancementPlanifie })) === 'orange').length;
    const verts  = total - rouges - oranges;
    const budgetTotal   = projets.reduce((s, p) => s + (p.budget ?? 0), 0);
    const decaisse      = projets.reduce((s, p) => s + (p.budgetDecaisse ?? 0), 0);
    const avMoyen       = projets.length ? projets.reduce((s, p) => s + p.avancement, 0) / projets.length : 0;
    const cpiMoyen      = projets.length ? projets.reduce((s, p) => s + p.cpi, 0) / projets.length : 1;
    const spiMoyen      = projets.length ? projets.reduce((s, p) => s + p.spi, 0) / projets.length : 1;

    // Prochains jalons
    const today = new Date();
    const prochains = projets
      .flatMap(p => p.jalons.filter(j => !j.atteint && new Date(j.date) >= today).map(j => ({ ...j, projetNom: p.nom, projetCode: p.code })))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 6);

    // Ordres de modification (comptage fictif depuis baselines)
    const omTotal = projets.reduce((s, p) => s + (p.baselines?.length ?? 0), 0);

    // Incidents
    const incidents = projets.flatMap(p => (p.incidents ?? []).map(i => ({ ...i, projetNom: p.nom })));

    // Affectations hebdo : compter les ressources assignées
    const affectations = store.ressources.slice(0, 6).map(r => {
      const assigned = projets.filter(p => p.equipe.includes(r.id)).length;
      return { id: r.id, nom: `${r.prenom} ${r.nom}`.trim(), projetsCount: assigned, heuresW: assigned * 8, heuresW1: Math.round(assigned * 7.5), heuresW2: Math.round(assigned * 8.2), heuresW3: Math.round(assigned * 6) };
    });

    return { total, rouges, oranges, verts, budgetTotal, decaisse, avMoyen, cpiMoyen, spiMoyen, prochains, omTotal, incidents, affectations };
  }, [projets, store.ressources]);

  // ── Incident helpers ──────────────────────────────────────────────────────
  function submitIncident() {
    if (!incForm.synthese.trim()) return;
    const pId = incForm.projetId || projets[0]?.id || '__global';
    store.addIncident(pId, {
      synthese: incForm.synthese,
      projetId: incForm.projetId || undefined,
      priorite: incForm.priorite,
      type: incForm.type,
      dateRequise: incForm.dateRequise || undefined,
      description: incForm.description,
      statut: 'Nouveau',
      pointsAction: [],
      proprietaireId: user?.id ?? 'u-current',
      proprietaireNom: user ? `${user.prenom} ${user.nom}` : 'Utilisateur',
      creePar: user ? `${user.prenom} ${user.nom}` : 'Utilisateur',
    });
    setIncForm(EMPTY_FORM);
    setShowIncForm(false);
  }

  // ─────────────────────────────────────────────────────────────────────────
  const inp: React.CSSProperties = { padding: '6px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' };

  // ──────────────────────────────────────────────────────────────────────────
  // RAG pill
  const RagPill = ({ s }: { s: StatutGlobal }) => {
    const c = ragColor(s);
    return <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: 12, fontSize: 10, fontWeight: 800, background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>{c.label}</span>;
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: 'inherit', background: '#F0F2F5', overflowY: 'auto' }}>

      {/* ── HEADER ── */}
      <div style={{ background: `linear-gradient(135deg, ${PURPLE} 0%, #1B4F8A 100%)`, padding: '16px 24px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: '#fff', fontWeight: 900, fontSize: 18, letterSpacing: '-0.5px' }}>Springboard — Tableau de Bord Chef de Projet</div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2 }}>
              Portefeuille DPE · {kpis.total} projets actifs · Mis à jour {new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '8px 14px', textAlign: 'center' }}>
              <div style={{ color: '#fff', fontWeight: 900, fontSize: 22 }}>{kpis.total}</div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 9, fontWeight: 700 }}>PROJETS</div>
            </div>
            <div style={{ background: 'rgba(220,252,231,0.2)', borderRadius: 10, padding: '8px 14px', textAlign: 'center' }}>
              <div style={{ color: '#4ADE80', fontWeight: 900, fontSize: 22 }}>{kpis.verts}</div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 9, fontWeight: 700 }}>EN BONNE SANTÉ</div>
            </div>
            <div style={{ background: 'rgba(254,243,199,0.2)', borderRadius: 10, padding: '8px 14px', textAlign: 'center' }}>
              <div style={{ color: '#FBBF24', fontWeight: 900, fontSize: 22 }}>{kpis.oranges}</div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 9, fontWeight: 700 }}>À RISQUE</div>
            </div>
            <div style={{ background: 'rgba(254,226,226,0.2)', borderRadius: 10, padding: '8px 14px', textAlign: 'center' }}>
              <div style={{ color: '#F87171', fontWeight: 900, fontSize: 22 }}>{kpis.rouges}</div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 9, fontWeight: 700 }}>CRITIQUE</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── SUMMARY ROW ── */}
      <div style={{ display: 'flex', gap: 12, padding: '14px 24px', flexShrink: 0, flexWrap: 'wrap' }}>
        {[
          { icon: <TrendingUp size={16} />, label: 'Avancement moyen', value: fmtPct(kpis.avMoyen), sub: `Planifié : ${fmtPct(projets.length ? projets.reduce((s,p)=>s+p.avancementPlanifie,0)/projets.length : 0)}`, color: NAVY, title: `Avancement physique moyen : ${fmtPct(kpis.avMoyen)}` },
          { icon: <BarChart3 size={16} />, label: 'Budget total', value: fmtM(kpis.budgetTotal), sub: `Décaissé : ${fmtM(kpis.decaisse)}`, color: '#0F766E', title: `Budget total : ${fmtM(kpis.budgetTotal)} — Décaissé : ${fmtM(kpis.decaisse)}` },
          { icon: <Activity size={16} />, label: 'CPI moyen', value: kpis.cpiMoyen.toFixed(2), sub: kpis.cpiMoyen >= 1 ? '✓ Dans les coûts' : '⚠ Dépassement coût', color: kpis.cpiMoyen >= 1 ? '#16A34A' : '#DC2626', title: `Cost Performance Index moyen : ${kpis.cpiMoyen.toFixed(2)} (cible ≥ 1,00)` },
          { icon: <Clock size={16} />, label: 'SPI moyen', value: kpis.spiMoyen.toFixed(2), sub: kpis.spiMoyen >= 1 ? '✓ Dans les délais' : '⚠ Retard planning', color: kpis.spiMoyen >= 1 ? '#16A34A' : '#DC2626', title: `Schedule Performance Index moyen : ${kpis.spiMoyen.toFixed(2)} (cible ≥ 1,00)` },
          { icon: <Calendar size={16} />, label: 'Prochains jalons', value: String(kpis.prochains.length), sub: kpis.prochains[0] ? `Prochain : ${new Date(kpis.prochains[0].date).toLocaleDateString('fr-FR')}` : 'Aucun', color: ORANGE, title: `${kpis.prochains.length} jalon(s) à venir` },
          { icon: <FileWarning size={16} />, label: 'Incidents ouverts', value: String(kpis.incidents.filter(i => i.statut !== 'Ferme' && i.statut !== 'Resolu').length), sub: `${kpis.incidents.filter(i => i.priorite === 'Urgente').length} urgents`, color: '#7C3AED', title: `Incidents non fermés : ${kpis.incidents.filter(i => i.statut !== 'Ferme' && i.statut !== 'Resolu').length} — dont ${kpis.incidents.filter(i => i.priorite === 'Urgente').length} urgent(s)` },
        ].map((kpi, i) => (
          <div key={i} title={kpi.title} style={{ background: '#fff', borderRadius: 10, padding: '12px 16px', flex: '1 1 140px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', minWidth: 130 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ color: kpi.color }}>{kpi.icon}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#64748B' }}>{kpi.label}</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: kpi.color }}>{kpi.value}</div>
            <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* ── TABS ── */}
      <div style={{ display: 'flex', gap: 0, padding: '0 24px', borderBottom: '2px solid #E2E8F0', flexShrink: 0 }}>
        {(['projets', 'ressources', 'incidents'] as SpringTab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '10px 20px', border: 'none', background: 'transparent', fontWeight: 700, fontSize: 12, cursor: 'pointer', color: tab === t ? PURPLE : '#64748B', borderBottom: tab === t ? `2px solid ${PURPLE}` : '2px solid transparent', marginBottom: -2, fontFamily: 'inherit' }}>
            {t === 'projets' ? '📊 Mes Projets' : t === 'ressources' ? '👥 Ressources' : '⚠️ Incidents'}
            {t === 'incidents' && kpis.incidents.filter(i => i.statut === 'Nouveau').length > 0 && (
              <span style={{ marginLeft: 6, background: '#EF4444', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 9, fontWeight: 800 }}>
                {kpis.incidents.filter(i => i.statut === 'Nouveau').length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB: MES PROJETS ── */}
      {tab === 'projets' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Prochains jalons */}
          {kpis.prochains.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 12, padding: '14px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ fontWeight: 800, fontSize: 12, color: NAVY, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Flag size={14} style={{ color: ORANGE }} /> Prochains jalons
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {kpis.prochains.map((j, i) => {
                  const jDate = new Date(j.date);
                  const daysLeft = Math.ceil((jDate.getTime() - Date.now()) / 86400000);
                  return (
                    <div key={i} style={{ background: daysLeft <= 7 ? '#FEF3C7' : '#F0F9FF', border: `1px solid ${daysLeft <= 7 ? '#FDE68A' : '#BAE6FD'}`, borderRadius: 8, padding: '8px 12px', minWidth: 180 }}>
                      <div style={{ fontWeight: 700, fontSize: 11, color: daysLeft <= 7 ? '#92400E' : '#0369A1', marginBottom: 2 }}>{j.label}</div>
                      <div style={{ fontSize: 10, color: '#64748B' }}>{j.projetCode} · {jDate.toLocaleDateString('fr-FR')}</div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: daysLeft <= 7 ? '#DC2626' : '#0369A1', marginTop: 2 }}>
                        {daysLeft <= 0 ? '⚠ Échu' : `Dans ${daysLeft} j`}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Projets liste avec budget circles */}
          <div style={{ display: 'grid', gap: 12 }}>
            {projets.length === 0 && (
            <div style={{ background: '#fff', borderRadius: 12, padding: 32, textAlign: 'center', color: '#94A3B8', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <Users size={32} style={{ margin: '0 auto 8px', color: '#E2E8F0', display: 'block' }} />
              <div style={{ fontSize: 13, fontWeight: 600, color: '#64748B' }}>Aucun projet disponible</div>
              <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 4 }}>Créez un premier projet dans « Mes Projets » ou vérifiez vos droits d'accès.</div>
            </div>
          )}
          {projets.map(p => {
              const rag = p.statutGlobal ?? calculerStatutGlobal({ cpi: p.cpi, spi: p.spi, avancement: p.avancement, avancementPlanifie: p.avancementPlanifie });
              const rc  = ragColor(rag);
              const tauxDec = p.budget > 0 ? (p.budgetDecaisse / p.budget) * 100 : 0;
              const tauxEngage = p.budget > 0 ? (p.budgetEngage / p.budget) * 100 : 0;
              return (
                <div key={p.id} style={{ background: '#fff', borderRadius: 12, padding: '14px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  {/* RAG indicator */}
                  <div style={{ width: 4, borderRadius: 4, alignSelf: 'stretch', background: rc.color, flexShrink: 0 }} />

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 800, fontSize: 13, color: NAVY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 }}>{p.nom}</span>
                      <span style={{ fontSize: 10, color: '#64748B', background: '#F1F5F9', padding: '1px 7px', borderRadius: 8, fontWeight: 600 }}>{p.code}</span>
                      <RagPill s={rag} />
                    </div>
                    <div style={{ fontSize: 11, color: '#64748B', marginBottom: 8 }}>
                      Chef : {p.chefProjet} · Délai : {new Date(p.dateDebut).toLocaleDateString('fr-FR')} → {new Date(p.dateFinPrevue).toLocaleDateString('fr-FR')}
                    </div>

                    {/* Progress bars: Cible vs Réel */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8', width: 40, textAlign: 'right' }}>CIBLE</span>
                        <div style={{ flex: 1, height: 6, background: '#E2E8F0', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ height: 6, width: `${p.avancementPlanifie}%`, background: '#CBD5E1', borderRadius: 4 }} />
                        </div>
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#64748B', width: 32 }}>{p.avancementPlanifie}%</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8', width: 40, textAlign: 'right' }}>RÉEL</span>
                        <div style={{ flex: 1, height: 6, background: '#E2E8F0', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ height: 6, width: `${p.avancement}%`, background: p.avancement >= p.avancementPlanifie ? '#16A34A' : ORANGE, borderRadius: 4, transition: 'width 0.5s' }} />
                        </div>
                        <span style={{ fontSize: 9, fontWeight: 700, color: NAVY, width: 32 }}>{p.avancement}%</span>
                      </div>
                    </div>

                    {/* KPI chips */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {[
                        { label: `CPI ${p.cpi.toFixed(2)}`, ok: p.cpi >= 1 },
                        { label: `SPI ${p.spi.toFixed(2)}`, ok: p.spi >= 1 },
                        { label: `Décaissé ${tauxDec.toFixed(0)}%`, ok: true },
                        { label: `Engagé ${tauxEngage.toFixed(0)}%`, ok: true },
                        { label: `${p.jalons.filter(j => j.atteint).length}/${p.jalons.length} jalons`, ok: true },
                      ].map((chip, ci) => (
                        <span key={ci} style={{ padding: '2px 8px', borderRadius: 8, fontSize: 9, fontWeight: 700, background: chip.ok ? '#F0FDF4' : '#FEE2E2', color: chip.ok ? '#16A34A' : '#DC2626', border: `1px solid ${chip.ok ? '#BBF7D0' : '#FCA5A5'}` }}>
                          {chip.label}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Budget donut (simplified) */}
                  <div style={{ flexShrink: 0, textAlign: 'center', minWidth: 100 }}>
                    <div style={{ position: 'relative', width: 72, height: 72, margin: '0 auto' }}>
                      <svg width={72} height={72} style={{ transform: 'rotate(-90deg)' }}>
                        <circle cx={36} cy={36} r={28} fill="none" stroke="#E2E8F0" strokeWidth={8} />
                        <circle cx={36} cy={36} r={28} fill="none" stroke={ORANGE} strokeWidth={8}
                          strokeDasharray={`${(tauxDec / 100) * 2 * Math.PI * 28} ${2 * Math.PI * 28}`} strokeLinecap="round" />
                        <circle cx={36} cy={36} r={20} fill="none" stroke="#BFDBFE" strokeWidth={5}
                          strokeDasharray={`${(tauxEngage / 100) * 2 * Math.PI * 20} ${2 * Math.PI * 20}`} strokeLinecap="round" />
                      </svg>
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: NAVY }}>
                        {tauxDec.toFixed(0)}%
                      </div>
                    </div>
                    <div style={{ fontSize: 9, color: '#64748B', marginTop: 4, fontWeight: 700 }}>
                      {fmtM(p.budgetDecaisse)}<br />/{fmtM(p.budget)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB: RESSOURCES ── */}
      {tab === 'ressources' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: NAVY }}>Ressources du projet — Heures hebdomadaires allouées</div>
              <div style={{ display: 'flex', gap: 8, fontSize: 10, color: '#64748B', alignItems: 'center' }}>
                <span style={{ display: 'inline-block', width: 10, height: 10, background: '#BFDBFE', borderRadius: 2 }} /> Semaine courante
                <span style={{ display: 'inline-block', width: 10, height: 10, background: '#FED7AA', borderRadius: 2, marginLeft: 4 }} /> Semaine suivante
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#F8FAFC' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#64748B', borderBottom: '1px solid #E2E8F0' }}>Ressource</th>
                    {(() => {
                      const weeks = [];
                      const now = new Date();
                      for (let w = 0; w < 5; w++) {
                        const start = new Date(now);
                        start.setDate(now.getDate() + w * 7);
                        const end = new Date(start);
                        end.setDate(start.getDate() + 6);
                        weeks.push(`${start.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} – ${end.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}`);
                      }
                      return weeks.map((w, i) => (
                        <th key={i} style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: '#64748B', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap', minWidth: 100 }}>
                          {w}
                        </th>
                      ));
                    })()}
                    <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: '#64748B', borderBottom: '1px solid #E2E8F0' }}>Projets</th>
                  </tr>
                </thead>
                <tbody>
                  {kpis.affectations.map((a, i) => {
                    const heures = [a.heuresW, a.heuresW1, a.heuresW2, a.heuresW3, Math.round(a.heuresW * 0.9)];
                    return (
                      <tr key={a.id} style={{ borderBottom: '1px solid #F1F5F9', background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 600, color: NAVY }}>{a.nom || a.id}</td>
                        {heures.map((h, hi) => {
                          const isOver = h > 45;
                          const bg = hi === 0 ? '#DBEAFE' : hi === 1 ? '#FEF3C7' : '#F3F4F6';
                          return (
                            <td key={hi} style={{ padding: '8px 10px', textAlign: 'center' }}>
                              <span style={{ background: isOver ? '#FEE2E2' : bg, color: isOver ? '#DC2626' : '#374151', fontWeight: isOver ? 800 : 600, padding: '3px 10px', borderRadius: 8, fontSize: 11 }}>
                                {h}h {isOver && '⚠'}
                              </span>
                            </td>
                          );
                        })}
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          <span style={{ background: '#F0FDF4', color: '#16A34A', padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700 }}>
                            {a.projetsCount} projet{a.projetsCount !== 1 ? 's' : ''}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {kpis.affectations.length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24, color: '#94A3B8', fontSize: 12 }}>Aucune ressource affectée</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: INCIDENTS ── */}
      {tab === 'incidents' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Create incident button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={() => setShowIncForm(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: PURPLE, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              <Plus size={14} /> {showIncForm ? 'Annuler' : 'Créer un incident'}
            </button>
          </div>

          {/* Incident form */}
          {showIncForm && (
            <div style={{ background: '#fff', borderRadius: 12, padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: NAVY, marginBottom: 14 }}>Créer un incident</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 3 }}>* Synthèse</label>
                  <input value={incForm.synthese} onChange={e => setIncForm(f => ({ ...f, synthese: e.target.value }))}
                    placeholder="Description courte de l'incident" style={inp} />
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 3 }}>Projet</label>
                  <select value={incForm.projetId} onChange={e => setIncForm(f => ({ ...f, projetId: e.target.value }))} style={inp}>
                    <option value="">— Général (tous projets) —</option>
                    {projets.map(p => <option key={p.id} value={p.id}>{p.code} — {p.nom}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 3 }}>Type</label>
                  <select value={incForm.type} onChange={e => setIncForm(f => ({ ...f, type: e.target.value as TypeIncident }))} style={inp}>
                    <option value="General">Général</option>
                    <option value="Technique">Technique</option>
                    <option value="Financier">Financier</option>
                    <option value="HSE">HSE</option>
                    <option value="Contractuel">Contractuel</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 3 }}>Priorité</label>
                  <select value={incForm.priorite} onChange={e => setIncForm(f => ({ ...f, priorite: e.target.value as PrioriteIncident }))} style={inp}>
                    <option value="Urgente">🔴 Urgente</option>
                    <option value="Haute">🟠 Haute</option>
                    <option value="Moyenne">🟡 Moyenne</option>
                    <option value="Faible">🟢 Faible</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 3 }}>Date requise</label>
                  <input type="date" value={incForm.dateRequise} onChange={e => setIncForm(f => ({ ...f, dateRequise: e.target.value }))} style={inp} />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 3 }}>Description</label>
                  <textarea value={incForm.description} onChange={e => setIncForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Détails sur l'incident, contexte, impact..."
                    style={{ ...inp, height: 72, resize: 'vertical' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowIncForm(false)} style={{ padding: '7px 16px', border: '1px solid #D1D5DB', background: '#fff', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}>Annuler</button>
                <button onClick={submitIncident} disabled={!incForm.synthese.trim()}
                  style={{ padding: '7px 16px', background: incForm.synthese.trim() ? PURPLE : '#CBD5E1', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: incForm.synthese.trim() ? 'pointer' : 'not-allowed', opacity: incForm.synthese.trim() ? 1 : 0.5 }}>
                  <Save size={12} style={{ display: 'inline', marginRight: 4 }} /> Enregistrer et fermer
                </button>
              </div>
            </div>
          )}

          {/* Incidents list */}
          {kpis.incidents.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: 12, padding: 32, textAlign: 'center', color: '#94A3B8', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <CheckCircle2 size={32} style={{ margin: '0 auto 8px', color: '#BBF7D0' }} />
              <p style={{ fontSize: 13 }}>Aucun incident enregistré.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {kpis.incidents.map(inc => {
                const PRIO_COLOR: Record<PrioriteIncident, string> = { Urgente: '#DC2626', Haute: '#EA580C', Moyenne: '#92400E', Faible: '#16A34A' };
                const STAT_CFG: Record<StatutIncident, { bg: string; color: string }> = {
                  Nouveau:   { bg: '#F3F4F6', color: '#374151' },
                  En_cours:  { bg: '#DBEAFE', color: '#1E40AF' },
                  Resolu:    { bg: '#DCFCE7', color: '#16A34A' },
                  Ferme:     { bg: '#F3F4F6', color: '#9CA3AF' },
                };
                const sc = STAT_CFG[inc.statut];
                const isOpen = expandedInc === inc.id;
                return (
                  <div key={inc.id} style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                      onClick={() => setExpandedInc(isOpen ? null : inc.id)}>
                      <div style={{ width: 4, borderRadius: 4, alignSelf: 'stretch', background: PRIO_COLOR[inc.priorite], flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: 13, color: NAVY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 }}>{inc.synthese}</span>
                          <span style={{ fontSize: 9, background: sc.bg, color: sc.color, padding: '2px 8px', borderRadius: 10, fontWeight: 800 }}>{inc.statut.replace('_', ' ')}</span>
                          <span style={{ fontSize: 9, color: PRIO_COLOR[inc.priorite], fontWeight: 700 }}>● {inc.priorite}</span>
                          {inc.projetNom && <span style={{ fontSize: 9, color: '#64748B' }}>{inc.projetNom}</span>}
                        </div>
                        <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>
                          {inc.creePar} · {new Date(inc.dateCreation).toLocaleDateString('fr-FR')}
                          {inc.dateRequise && ` · Requis : ${new Date(inc.dateRequise).toLocaleDateString('fr-FR')}`}
                          {inc.pointsAction.length > 0 && ` · ${inc.pointsAction.length} point(s) d'action`}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <select value={inc.statut}
                          onClick={e => e.stopPropagation()}
                          onChange={e => {
                            const proj = projets.find(p => p.incidents?.some(i => i.id === inc.id));
                            if (proj) store.updateIncident(proj.id, inc.id, { statut: e.target.value as StatutIncident });
                          }}
                          style={{ padding: '3px 8px', border: '1px solid #E2E8F0', borderRadius: 6, fontSize: 10, fontWeight: 700, background: sc.bg, color: sc.color, cursor: 'pointer' }}>
                          <option value="Nouveau">Nouveau</option>
                          <option value="En_cours">En cours</option>
                          <option value="Resolu">Résolu</option>
                          <option value="Ferme">Fermé</option>
                        </select>
                        <span aria-label={isOpen ? 'Réduire cet incident' : 'Développer cet incident'} style={{ display: 'flex' }}>
                          {isOpen ? <ChevronDown size={14} style={{ color: '#94A3B8' }} /> : <ChevronRight size={14} style={{ color: '#94A3B8' }} />}
                        </span>
                      </div>
                    </div>

                    {isOpen && (
                      <div style={{ padding: '0 16px 14px 30px', borderTop: '1px solid #F1F5F9' }}>
                        {inc.description && (
                          <p style={{ fontSize: 12, color: '#374151', margin: '10px 0 8px' }}>{inc.description}</p>
                        )}
                        {/* Points d'action */}
                        <div style={{ marginTop: 8 }}>
                          <div style={{ fontWeight: 700, fontSize: 11, color: '#374151', marginBottom: 6 }}>
                            Points d'action ({inc.pointsAction.length})
                          </div>
                          {inc.pointsAction.map(pa => (
                            <div key={pa.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid #F8FAFC' }}>
                              <CheckCircle2 size={12} style={{ color: pa.statut === 'Termine' ? '#16A34A' : '#94A3B8', flexShrink: 0 }} />
                              <span style={{ flex: 1, fontSize: 11, color: '#374151', textDecoration: pa.statut === 'Termine' ? 'line-through' : 'none' }}>{pa.synthese}</span>
                              <span style={{ fontSize: 10, color: '#64748B' }}>{pa.proprietaireNom}</span>
                            </div>
                          ))}
                          {/* Add point d'action */}
                          {paForm?.incId === inc.id ? (
                            <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
                              <input value={paForm.synthese} onChange={e => setPaForm(f => f && ({ ...f, synthese: e.target.value }))}
                                placeholder="Synthèse du point d'action"
                                style={{ flex: 1, padding: '5px 8px', border: '1px solid #CBD5E1', borderRadius: 6, fontSize: 11 }} />
                              <input value={paForm.proprio} onChange={e => setPaForm(f => f && ({ ...f, proprio: e.target.value }))}
                                placeholder="Propriétaire"
                                style={{ width: 120, padding: '5px 8px', border: '1px solid #CBD5E1', borderRadius: 6, fontSize: 11 }} />
                              <button aria-label="Enregistrer le point d'action" onClick={() => {
                                if (!paForm.synthese.trim()) return;
                                const proj = projets.find(p => p.incidents?.some(i => i.id === inc.id));
                                if (proj) store.addPointAction(proj.id, inc.id, { synthese: paForm.synthese, proprietaireId: 'u-current', proprietaireNom: paForm.proprio || 'Utilisateur', statut: 'Non_demarre', dateRequise: paForm.date });
                                setPaForm(null);
                              }}
                                style={{ padding: '5px 12px', background: NAVY, color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>+</button>
                              <button aria-label="Annuler l'ajout du point d'action" onClick={() => setPaForm(null)} style={{ padding: '5px 10px', border: '1px solid #D1D5DB', background: '#fff', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>×</button>
                            </div>
                          ) : (
                            <button onClick={() => setPaForm({ incId: inc.id, synthese: '', proprio: '', date: '' })}
                              style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', border: '1px solid #CBD5E1', background: '#F8FAFC', borderRadius: 6, fontSize: 10, cursor: 'pointer', color: '#64748B' }}>
                              <Plus size={10} /> Ajouter un point d'action
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
