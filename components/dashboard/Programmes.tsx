'use client';

import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import {
  Layers, ChevronRight, ChevronDown, FolderOpen, Activity,
  TrendingUp, AlertTriangle, CheckCircle2, Users, Calendar,
  Filter, Plus, Download,
} from 'lucide-react';
import { useProjectStore, DOMAINE_CFG, type Domaine } from '@/lib/projectStore';

/* ─── Brand ─────────────────────────────── */
const NAVY   = '#1B4F8A';
const ORANGE = '#F47920';
const RED    = '#EF3340';
const GREEN  = '#16A34A';
const AMBER  = '#D97706';
const PURPLE = '#8B5CF6';

/* ─── Données programmes de démo ─────────── */
interface Programme {
  id: string;
  code: string;
  label: string;
  domaine: Domaine;
  chef: string;
  budget: number;
  decaisse: number;
  avancement: number;
  statut: 'actif' | 'planifie' | 'cloture' | 'suspendu';
  projetsIds: string[];
  dateDebut: string;
  dateFin: string;
}

/* ─── Statut config ─────────────────────── */
const STATUT_PRG: Record<Programme['statut'], { label: string; color: string; bg: string }> = {
  actif:     { label: 'Actif',     color: GREEN,  bg: '#DCFCE7' },
  planifie:  { label: 'Planifié',  color: NAVY,   bg: '#EFF6FF' },
  cloture:   { label: 'Clôturé',  color: '#64748B', bg: '#F1F5F9' },
  suspendu:  { label: 'Suspendu', color: AMBER,   bg: '#FFF7ED' },
};

/* ─── Helper ─────────────────────────────── */
function fmtBudget(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(2) + ' Md';
  return n.toLocaleString('fr-FR') + ' M';
}

/* ═══════════════════════════════════════════════════
   COMPOSANT PRINCIPAL
═══════════════════════════════════════════════════ */
export default function Programmes() {
  const store = useProjectStore();
  const [expandedPrg, setExpandedPrg] = useState<string | null>('prg1');
  const [filtreDomaine, setFiltreDomaine] = useState<string>('tous');

  /* Grouper projets en programmes fictifs */
  const programmes: Programme[] = useMemo(() => {
    const p = store.projets;
    // SCOPE DOMAINE (MMH) : on ne montre QUE les programmes des domaines réellement
    // présents dans le périmètre de l'utilisateur (store.projets est déjà scopé).
    // Un agent DPD (distribution) ne voit donc PAS de programme transport/production/commercial.
    const allDom = ['production', 'transport', 'distribution', 'commercial', 'genie_civil'] as Domaine[];
    const present = new Set(p.map(pr => pr.domaine));
    const dom = allDom.filter(d => present.has(d));

    return dom.map((d, i) => {
      const projets = p.filter(pr => pr.domaine === d);
      const totalB  = projets.reduce((s, x) => s + x.budget, 0);
      const totalD  = projets.reduce((s, x) => s + x.budgetDecaisse, 0);
      const dcfg    = DOMAINE_CFG[d];
      return {
        id: `prg${i + 1}`,
        code: `PRG-${d.toUpperCase().slice(0, 3)}-2026`,
        label: `Programme ${dcfg.label}`,
        domaine: d,
        chef: ['CP Diallo', 'CP Ndiaye', 'CP Traoré', 'CP Sow'][i],
        budget: totalB || (i + 1) * 2500,
        decaisse: totalD || (i + 1) * 1200,
        avancement: projets.length > 0
          ? Math.round(projets.reduce((s, x) => s + x.avancement, 0) / projets.length)
          : ([62, 45, 78, 31, 55][i] ?? 0),  // garde-fou : jamais undefined → plus de NaN
        statut: i === 2 ? 'planifie' : 'actif',
        projetsIds: projets.map(pr => pr.id),
        dateDebut: '2026-01-01',
        dateFin:   '2026-12-31',
      };
    });
  }, [store.projets]);

  const filtres = programmes.filter(p => filtreDomaine === 'tous' || p.domaine === filtreDomaine);

  /* Bar chart data */
  const chartData = programmes.map(p => ({
    name: DOMAINE_CFG[p.domaine].label,
    budget: +(p.budget / 1000).toFixed(1),
    decaisse: +(p.decaisse / 1000).toFixed(1),
    color: DOMAINE_CFG[p.domaine].color,
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#F8FAFD' }}>

      {/* ─── Header ─────────────────────────────────────────────── */}
      <div style={{
        padding: '16px 24px 12px',
        background: '#fff', borderBottom: '1px solid #E2E8F0', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Layers size={22} style={{ color: NAVY }} />
              Programmes DPE
            </h1>
            <p style={{ fontSize: 12.5, color: '#64748B', margin: '3px 0 0' }}>
              Portefeuille › Programmes › Projets — Hiérarchie complète
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <select
              value={filtreDomaine}
              onChange={e => setFiltreDomaine(e.target.value)}
              style={{
                padding: '7px 10px', borderRadius: 7, border: '1px solid #E2E8F0',
                background: '#fff', fontSize: 12.5, color: '#475569', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <option value="tous">Tous les domaines</option>
              {Object.entries(DOMAINE_CFG).filter(([k]) => store.projets.some(p => p.domaine === k)).map(([k, v]) => (
                <option key={k} value={k}>{v.emoji} {v.label}</option>
              ))}
            </select>
            <button style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 7, border: 'none',
              background: NAVY, color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              <Plus size={13} /> Nouveau programme
            </button>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ─── KPI barre ────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 14 }}>
          {[
            { label: 'Programmes actifs', value: programmes.filter(p => p.statut === 'actif').length, color: NAVY, icon: <Layers size={16} style={{ color: NAVY }} /> },
            { label: 'Budget total', value: fmtBudget(programmes.reduce((s, p) => s + p.budget, 0)) + ' FCFA', color: GREEN, icon: <TrendingUp size={16} style={{ color: GREEN }} /> },
            { label: 'Projets rattachés', value: store.projets.length, color: PURPLE, icon: <FolderOpen size={16} style={{ color: PURPLE }} /> },
            { label: 'Avancement moyen', value: `${Math.round(programmes.reduce((s, p) => s + (Number.isFinite(p.avancement) ? p.avancement : 0), 0) / (programmes.length || 1))}%`, color: ORANGE, icon: <Activity size={16} style={{ color: ORANGE }} /> },
          ].map(k => (
            <div key={k.label} style={{
              flex: 1, background: '#fff', border: `1px solid #E2E8F0`,
              borderTop: `3px solid ${k.color}`, borderRadius: 10,
              padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
            }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: `${k.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {k.icon}
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#0F172A' }}>{k.value}</div>
                <div style={{ fontSize: 11.5, color: '#64748B' }}>{k.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ─── Bar chart ─────────────────────────────────────────── */}
        <div style={{
          background: '#fff', borderRadius: 10, border: '1px solid #E2E8F0',
          padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 12 }}>
            Répartition budget par domaine (Md FCFA)
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData} barSize={28}>
              <CartesianGrid stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => [v + ' Md FCFA']} />
              <Bar dataKey="budget"   name="Budget"   fill={NAVY}  radius={[4, 4, 0, 0]} opacity={0.8} />
              <Bar dataKey="decaisse" name="Décaissé" fill={ORANGE} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ─── Arbre Portefeuille › Programme › Projet ─────────── */}
        <div style={{
          background: '#fff', borderRadius: 10, border: '1px solid #E2E8F0',
          boxShadow: '0 1px 4px rgba(0,0,0,0.05)', overflow: 'hidden',
        }}>
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid #F1F5F9',
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 13.5, fontWeight: 700, color: '#0F172A',
          }}>
            <Layers size={14} style={{ color: NAVY }} />
            Hiérarchie Portefeuille DPE
            <span style={{ fontSize: 10.5, color: '#94A3B8', marginLeft: 4 }}>
              {filtres.length} programmes · {store.projets.length} projets
            </span>
          </div>

          {filtres.map((prg, pi) => {
            const dcfg  = DOMAINE_CFG[prg.domaine];
            const scfg  = STATUT_PRG[prg.statut];
            const open  = expandedPrg === prg.id;
            const projetsRataches = store.projets.filter(p => prg.projetsIds.includes(p.id));
            const engPct = prg.budget > 0 ? Math.round((prg.decaisse / prg.budget) * 100) : 0;

            return (
              <div key={prg.id} style={{ borderBottom: pi < filtres.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                {/* Ligne programme */}
                <div
                  onClick={() => setExpandedPrg(open ? null : prg.id)}
                  style={{
                    padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
                    cursor: 'pointer', background: open ? '#F8FAFC' : '#fff',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                  onMouseLeave={e => { if (!open) e.currentTarget.style.background = '#fff'; }}
                >
                  {open ? <ChevronDown size={14} style={{ color: '#94A3B8' }} /> : <ChevronRight size={14} style={{ color: '#94A3B8' }} />}

                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: `${dcfg.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16,
                  }}>
                    {dcfg.emoji}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 10.5, color: dcfg.color, fontWeight: 700 }}>{prg.code}</span>
                      {prg.label}
                    </div>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
                      Chef : {prg.chef} · {projetsRataches.length} projets · {prg.dateDebut} → {prg.dateFin}
                    </div>
                  </div>

                  {/* Avancement */}
                  <div style={{ width: 120, flexShrink: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, marginBottom: 4 }}>
                      <span style={{ color: '#64748B' }}>Avancement</span>
                      <strong style={{ color: prg.avancement >= 70 ? GREEN : AMBER }}>{prg.avancement}%</strong>
                    </div>
                    <div style={{ height: 6, background: '#F1F5F9', borderRadius: 3 }}>
                      <div style={{ width: `${prg.avancement}%`, height: '100%', background: prg.avancement >= 70 ? GREEN : AMBER, borderRadius: 3 }} />
                    </div>
                  </div>

                  {/* Budget */}
                  <div style={{ width: 120, flexShrink: 0, textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: '#64748B' }}>Budget engagé</div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1E293B' }}>
                      {engPct}% <span style={{ fontSize: 10.5, color: '#94A3B8', fontWeight: 400 }}>· {fmtBudget(prg.budget)} FCFA</span>
                    </div>
                  </div>

                  {/* Statut */}
                  <span style={{
                    fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 10,
                    background: scfg.bg, color: scfg.color, flexShrink: 0,
                  }}>
                    {scfg.label}
                  </span>
                </div>

                {/* Projets du programme (expanded) */}
                {open && (
                  <div style={{ background: '#FAFBFD', borderTop: '1px solid #F1F5F9' }}>
                    {projetsRataches.length === 0 ? (
                      <div style={{ padding: '14px 56px', fontSize: 12.5, color: '#94A3B8', fontStyle: 'italic' }}>
                        Aucun projet rattaché à ce programme
                      </div>
                    ) : (
                      projetsRataches.map((p, pi2) => {
                        const cpiOk = p.cpi >= 0.90;
                        const spiOk = p.spi >= 0.85;
                        return (
                          <div key={p.id} style={{
                            padding: '9px 16px 9px 56px',
                            borderBottom: pi2 < projetsRataches.length - 1 ? '1px solid #F1F5F9' : 'none',
                            display: 'flex', alignItems: 'center', gap: 12,
                            transition: 'background 0.1s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#F0F4FA')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: dcfg.color, flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12.5, fontWeight: 600, color: '#1E293B' }}>
                                <span style={{ fontSize: 10, color: dcfg.color, fontWeight: 700, marginRight: 6 }}>{p.code}</span>
                                {p.nom.length > 50 ? p.nom.slice(0, 50) + '…' : p.nom}
                              </div>
                              <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 2 }}>
                                Avancement {p.avancement}% · Budget {fmtBudget(p.budget)} FCFA
                              </div>
                            </div>
                            <span style={{
                              fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 6,
                              background: cpiOk ? '#DCFCE7' : '#FEE2E2', color: cpiOk ? GREEN : RED,
                            }}>CPI {p.cpi.toFixed(2)}</span>
                            <span style={{
                              fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 6,
                              background: spiOk ? '#DCFCE7' : '#FFF7ED', color: spiOk ? GREEN : AMBER,
                            }}>SPI {p.spi.toFixed(2)}</span>
                            <ChevronRight size={12} style={{ color: '#CBD5E1' }} />
                          </div>
                        );
                      })
                    )}
                    <div style={{ padding: '8px 16px 8px 56px' }}>
                      <button style={{
                        fontSize: 11.5, color: NAVY, background: '#EFF6FF',
                        border: '1px solid #BFDBFE', padding: '4px 10px', borderRadius: 6,
                        cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}>
                        <Plus size={11} /> Ajouter un projet
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
