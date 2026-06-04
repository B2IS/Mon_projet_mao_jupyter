'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, LineChart, Line, RadarChart, PolarGrid, PolarAngleAxis,
  Radar, Legend, ReferenceLine,
} from 'recharts';
import {
  useProjectStore, useScopeDomaines, DOMAINE_CFG, STATUT_CFG,
  type Projet, type Domaine, type StatutProjet,
} from '@/lib/projectStore';
import { useCanPerform } from '@/lib/hooks/useUserScope';
import MatriceExport from './MatriceExport';
import dynamic from 'next/dynamic';

const ProjetsCarteLeaflet = dynamic(() => import('@/components/ui/ProjetsCarteLeaflet'), {
  ssr: false,
  loading: () => (
    <div style={{ height: 310, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: 13 }}>
      Chargement de la carte…
    </div>
  ),
});

// ─────────────────────────────── HELPERS ──────────────────────────────────────

function indColor(v: number): string {
  if (v < 0.85) return '#EF3340';
  if (v < 0.95) return '#F47920';
  return '#16A34A';
}

function avColor(v: number): string {
  if (v >= 70) return '#16A34A';
  if (v >= 40) return '#F47920';
  return '#EF3340';
}

function fmtBudget(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(1)} GMFCFA`;
  return `${v.toFixed(0)} MFCFA`;
}

const DOMAINES: Domaine[] = ['production', 'transport', 'distribution', 'commercial', 'genie_civil'];

// ───────────────────────── SHARED: PROJECT DRAWER ─────────────────────────────

function ProjetDrawer({ projet, onClose }: { projet: Projet; onClose: () => void }) {
  const cfg = DOMAINE_CFG[projet.domaine];
  const scfg = STATUT_CFG[projet.statut];

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 299, background: 'rgba(0,0,0,0.35)' }}
        onClick={onClose}
      />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 300, width: 400,
        background: '#fff', boxShadow: '-4px 0 28px rgba(27,79,138,0.2)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ background: '#1B4F8A', padding: '16px 18px', borderBottom: `3px solid ${cfg.color}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginBottom: 2 }}>{projet.code}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', lineHeight: 1.3, marginRight: 12 }}>{projet.nom}</div>
            </div>
            <button
              onClick={onClose}
              style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 6, padding: '5px 9px', cursor: 'pointer', color: '#fff', flexShrink: 0, fontSize: 16, lineHeight: 1 }}
            >×</button>
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: `${scfg.color}22`, color: scfg.color }}>
              {scfg.label}
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: `${cfg.color}22`, color: cfg.color }}>
              {cfg.emoji} {cfg.label}
            </span>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* KPI mini-grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { label: 'CPI', value: projet.cpi.toFixed(2), color: indColor(projet.cpi) },
              { label: 'SPI', value: projet.spi.toFixed(2), color: indColor(projet.spi) },
              { label: 'Avancement', value: `${projet.avancement}%`, color: avColor(projet.avancement) },
              { label: 'Plan prévu', value: `${projet.avancementPlanifie}%`, color: '#64748B' },
            ].map(k => (
              <div key={k.label} style={{ padding: '10px 12px', background: '#F8FAFC', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: k.color }}>{k.value}</div>
                <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* Budget */}
          <div style={{ background: '#F8FAFC', borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
              Budget
            </div>
            {[
              { label: 'Budget total', value: fmtBudget(projet.budget) },
              { label: 'Décaissé', value: fmtBudget(projet.budgetDecaisse), color: '#16A34A' },
              { label: 'Engagé', value: fmtBudget(projet.budgetEngage), color: '#F47920' },
              { label: 'Restant', value: fmtBudget(Math.max(0, projet.budget - projet.budgetEngage)), color: '#64748B' },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 6, marginBottom: 6, borderBottom: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: 12, color: '#94A3B8' }}>{r.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: r.color ?? '#374151' }}>{r.value}</span>
              </div>
            ))}
            <div style={{ marginTop: 6 }}>
              <div style={{ height: 8, background: '#E2E8F0', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, (projet.budgetDecaisse / projet.budget) * 100)}%`, background: '#16A34A', borderRadius: 4 }} />
              </div>
              <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 3, textAlign: 'right' }}>
                Taux décaissement: {Math.round((projet.budgetDecaisse / projet.budget) * 100)}%
              </div>
            </div>
          </div>

          {/* Info */}
          <div style={{ background: '#F8FAFC', borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
              Informations
            </div>
            {[
              { label: 'Chef de projet', value: projet.chefProjet },
              { label: 'Région', value: projet.region },
              { label: 'Début', value: projet.dateDebut },
              { label: 'Fin prévue', value: projet.dateFinPrevue },
              { label: 'Fin estimée', value: projet.dateFinEstimee },
              { label: 'Priorité', value: projet.priorite },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 6, marginBottom: 6, borderBottom: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: 12, color: '#94A3B8' }}>{r.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>{r.value}</span>
              </div>
            ))}
          </div>

          {/* Avancement */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#1B4F8A', marginBottom: 6 }}>Avancement physique</div>
            <div style={{ height: 8, background: '#E2E8F0', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
              <div style={{ height: '100%', width: `${projet.avancementPlanifie}%`, background: '#CBD5E1', position: 'absolute', borderRadius: 4 }} />
              <div style={{ height: '100%', width: `${projet.avancement}%`, background: avColor(projet.avancement), borderRadius: 4, position: 'absolute' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <span style={{ fontSize: 10, color: '#94A3B8' }}>Prévu: {projet.avancementPlanifie}%</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: avColor(projet.avancement) }}>Réel: {projet.avancement}%</span>
            </div>
          </div>

          {/* Jalons */}
          {projet.jalons.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#1B4F8A', marginBottom: 8 }}>Jalons</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {projet.jalons.map((j, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#F8FAFC', borderRadius: 7 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: j.atteint ? '#16A34A' : '#E2E8F0', flexShrink: 0, border: `2px solid ${j.atteint ? '#16A34A' : '#CBD5E1'}` }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: j.atteint ? '#374151' : '#64748B', textDecoration: j.atteint ? 'none' : undefined }}>{j.label}</div>
                      <div style={{ fontSize: 10, color: '#94A3B8' }}>{j.date}</div>
                    </div>
                    {j.atteint && <span style={{ fontSize: 9, fontWeight: 700, color: '#16A34A', background: '#16A34A18', padding: '2px 5px', borderRadius: 4 }}>Atteint</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bailleurs */}
          {projet.bailleurs.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#1B4F8A', marginBottom: 8 }}>Bailleurs de fonds</div>
              {projet.bailleurs.map((b, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: '#F8FAFC', borderRadius: 7, marginBottom: 5 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>{b.nom}</span>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#1B4F8A' }}>{fmtBudget(b.montant)}</div>
                    <div style={{ fontSize: 9, color: '#94A3B8' }}>{b.pourcentage}%</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────── VUE STRATÉGIQUE ──────────────────────────────

interface BubblePoint {
  x: number;
  y: number;
  z: number;
  code: string;
  nom: string;
  domaine: Domaine;
  cpi: number;
  spi: number;
  id: string;
}

function StrategiqueBubbleTooltip({ active, payload }: { active?: boolean; payload?: { payload: BubblePoint }[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  const cfg = DOMAINE_CFG[d.domaine];
  return (
    <div style={{ background: '#fff', borderRadius: 10, padding: '12px 14px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', border: '1px solid #E2E8F0', fontSize: 12 }}>
      <div style={{ fontWeight: 800, color: '#1B4F8A', marginBottom: 4 }}>{d.code}</div>
      <div style={{ color: '#374151', marginBottom: 8, maxWidth: 220, lineHeight: 1.3 }}>{d.nom}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
        <span style={{ color: '#94A3B8' }}>Domaine</span><span style={{ fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
        <span style={{ color: '#94A3B8' }}>Budget</span><span style={{ fontWeight: 700 }}>{fmtBudget(d.y)}</span>
        <span style={{ color: '#94A3B8' }}>Avancement</span><span style={{ fontWeight: 700, color: avColor(d.x) }}>{d.x}%</span>
        <span style={{ color: '#94A3B8' }}>CPI</span><span style={{ fontWeight: 700, color: indColor(d.cpi) }}>{d.cpi.toFixed(2)}</span>
        <span style={{ color: '#94A3B8' }}>SPI</span><span style={{ fontWeight: 700, color: indColor(d.spi) }}>{d.spi.toFixed(2)}</span>
      </div>
    </div>
  );
}

function VueStrategique({ projets, onSelectProjet }: { projets: Projet[]; onSelectProjet: (p: Projet) => void }) {
  // KPI computations
  const kpis = useMemo(() => {
    if (projets.length === 0) return { budgetTotal: 0, tauxDecaissement: 0, avancementMoyen: 0, cpiMoyen: 0, spiMoyen: 0 };
    const budgetTotal = projets.reduce((s, p) => s + p.budget, 0);
    const tauxDecaissement = projets.reduce((s, p) => s + (p.budgetDecaisse / p.budget) * p.budget, 0) / budgetTotal * 100;
    const avancementMoyen = projets.reduce((s, p) => s + p.avancement * p.budget, 0) / budgetTotal;
    const cpiMoyen = projets.reduce((s, p) => s + p.cpi, 0) / projets.length;
    const spiMoyen = projets.reduce((s, p) => s + p.spi, 0) / projets.length;
    return { budgetTotal, tauxDecaissement, avancementMoyen, cpiMoyen, spiMoyen };
  }, [projets]);

  // Bubble data per domain
  const bubbleByDomain = useMemo(() => {
    return DOMAINES.map(d => ({
      domaine: d,
      color: DOMAINE_CFG[d].color,
      data: projets
        .filter(p => p.domaine === d)
        .map<BubblePoint>(p => ({
          x: p.avancement,
          y: p.budget,
          z: p.priorite === 'Haute' ? 1200 : p.priorite === 'Moyenne' ? 800 : 500,
          code: p.code,
          nom: p.nom,
          domaine: p.domaine,
          cpi: p.cpi,
          spi: p.spi,
          id: p.id,
        })),
    }));
  }, [projets]);

  // Alignement par domaine
  const alignementData = useMemo(() => {
    return DOMAINES.map(d => {
      const group = projets.filter(p => p.domaine === d);
      const avg = group.length ? Math.round(group.reduce((s, p) => s + p.avancement, 0) / group.length) : 0;
      return { name: DOMAINE_CFG[d].label, avancement: avg, color: DOMAINE_CFG[d].color };
    });
  }, [projets]);

  // Budget pipeline per domain (décaissé / engagé / restant)
  const budgetPipelineData = useMemo(() => {
    return DOMAINES.map(d => {
      const group = projets.filter(p => p.domaine === d);
      const decaisse = group.reduce((s, p) => s + p.budgetDecaisse, 0);
      const engage = group.reduce((s, p) => s + Math.max(0, p.budgetEngage - p.budgetDecaisse), 0);
      const restant = group.reduce((s, p) => s + Math.max(0, p.budget - p.budgetEngage), 0);
      return { name: DOMAINE_CFG[d].label, decaisse, engage, restant };
    });
  }, [projets]);

  // Correlation matrix: domains x domains — count shared equipe membres
  const correlationMatrix = useMemo(() => {
    return DOMAINES.map(dRow => ({
      domaine: dRow,
      cols: DOMAINES.map(dCol => {
        if (dRow === dCol) return -1;
        const aProj = projets.filter(p => p.domaine === dRow);
        const bProj = projets.filter(p => p.domaine === dCol);
        const aTeam = new Set(aProj.flatMap(p => p.equipe));
        const bTeam = new Set(bProj.flatMap(p => p.equipe));
        let shared = 0;
        aTeam.forEach(id => { if (bTeam.has(id)) shared++; });
        return shared;
      }),
    }));
  }, [projets]);

  // Critical projects
  const critiques = useMemo(() => projets.filter(p => p.statut === 'en_retard' || p.cpi < 0.9 || p.spi < 0.85), [projets]);

  // Jalons prochain 60j
  const today = new Date('2026-05-25');
  const in60 = new Date(today);
  in60.setDate(in60.getDate() + 60);
  const jalons60 = useMemo(() => {
    const list: { projetCode: string; projetNom: string; label: string; date: string }[] = [];
    projets.forEach(p => {
      p.jalons.forEach(j => {
        const d = new Date(j.date);
        if (!j.atteint && d >= today && d <= in60) {
          list.push({ projetCode: p.code, projetNom: p.nom, label: j.label, date: j.date });
        }
      });
    });
    return list.sort((a, b) => a.date.localeCompare(b.date));
  }, [projets]);

  // Auto insights
  const insights = useMemo(() => {
    const ins: string[] = [];
    if (kpis.cpiMoyen < 0.95) ins.push(`CPI moyen de ${kpis.cpiMoyen.toFixed(2)} — coûts sous pression, révision des marchés nécessaire.`);
    else ins.push(`CPI moyen de ${kpis.cpiMoyen.toFixed(2)} — performance budgétaire satisfaisante.`);
    if (kpis.spiMoyen < 0.9) ins.push(`SPI moyen de ${kpis.spiMoyen.toFixed(2)} — retards systémiques, renforcer la supervision des chantiers.`);
    else ins.push(`SPI moyen de ${kpis.spiMoyen.toFixed(2)} — calendrier globalement respecté.`);
    if (critiques.length > 0) ins.push(`${critiques.length} projet(s) critique(s) nécessitent une intervention prioritaire : ${critiques.map(p => p.code).join(', ')}.`);
    else ins.push('Aucun projet en situation critique — maintenir la vigilance sur les projets en alerte.');
    return ins;
  }, [kpis, critiques]);

  const kpiCards = [
    { label: 'Budget total portefeuille', value: fmtBudget(kpis.budgetTotal), color: '#1B4F8A', bg: '#1B4F8A18', sub: `${projets.length} projets` },
    { label: 'Taux de décaissement moyen', value: `${kpis.tauxDecaissement.toFixed(1)}%`, color: '#16A34A', bg: '#16A34A18', sub: 'Pondéré par budget' },
    { label: 'Avancement pondéré', value: `${kpis.avancementMoyen.toFixed(1)}%`, color: '#F47920', bg: '#F4792018', sub: 'Pondéré par budget' },
    { label: 'CPI moyen portefeuille', value: kpis.cpiMoyen.toFixed(2), color: indColor(kpis.cpiMoyen), bg: `${indColor(kpis.cpiMoyen)}18`, sub: '≥ 1.0 = dans les coûts' },
    { label: 'SPI moyen portefeuille', value: kpis.spiMoyen.toFixed(2), color: indColor(kpis.spiMoyen), bg: `${indColor(kpis.spiMoyen)}18`, sub: '≥ 1.0 = dans les délais' },
  ];

  const maxBudget = Math.max(...projets.map(p => p.budget), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Row 1 — KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {kpiCards.map(k => (
          <div key={k.label} style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: '16px 18px' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginTop: 4, lineHeight: 1.3 }}>{k.label}</div>
            <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 3 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Row 1b — Geographic map */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1B4F8A', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            🗺️ Localisation géographique des projets DPE
          </div>
          <ProjetsCarteLeaflet
            projets={projets.map(p => ({
              id: p.id, nom: p.nom, code: p.code, region: p.region,
              domaine: p.domaine, statut: p.statut,
              avancement: p.avancement, budget: p.budget,
              // Coordonnées propres au projet (import / migration) → placement EXACT sur la carte.
              lat: p.lat, lng: p.lng, localisation: p.localisation,
            }))}
            height={310}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
            {Object.entries(DOMAINE_CFG).map(([key, cfg]) => {
              const count = projets.filter(p => p.domaine === key).length;
              if (count === 0) return null;
              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: cfg.color, display: 'inline-block' }} />
                  <span style={{ color: '#475569' }}>{cfg.emoji} {cfg.label.split('/')[0].trim()} <strong style={{ color: cfg.color }}>({count})</strong></span>
                </div>
              );
            })}
          </div>
        </div>
        {/* Regional distribution table */}
        <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#1B4F8A', marginBottom: 12 }}>Distribution régionale des projets</div>
          <div style={{ overflowY: 'auto', maxHeight: 310 }}>
            {(() => {
              const byRegion = projets.reduce<Record<string, typeof projets>>((acc, p) => {
                const r = p.region || 'Non défini';
                if (!acc[r]) acc[r] = [];
                acc[r].push(p);
                return acc;
              }, {});
              return Object.entries(byRegion)
                .sort((a, b) => b[1].length - a[1].length)
                .map(([region, rProjets]) => {
                  const budget = rProjets.reduce((s, p) => s + p.budget, 0);
                  const avgAv = Math.round(rProjets.reduce((s, p) => s + p.avancement, 0) / rProjets.length);
                  const hasRetard = rProjets.some(p => p.statut === 'en_retard');
                  return (
                    <div key={region} style={{ padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {hasRetard && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#EF3340', display: 'inline-block', flexShrink: 0 }} />}
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#1E293B' }}>{region}</span>
                          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: '#EFF6FF', color: '#1B4F8A', fontWeight: 700 }}>{rProjets.length}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
                          <span style={{ color: '#64748B' }}>{(budget / 1000).toFixed(1)} Mrd FCFA</span>
                          <span style={{ fontWeight: 700, color: avgAv >= 70 ? '#16A34A' : avgAv >= 40 ? '#F47920' : '#EF3340' }}>{avgAv}%</span>
                        </div>
                      </div>
                      <div style={{ height: 4, background: '#F1F5F9', borderRadius: 2 }}>
                        <div style={{ height: '100%', width: `${avgAv}%`, background: avgAv >= 70 ? '#16A34A' : avgAv >= 40 ? '#F47920' : '#EF3340', borderRadius: 2, transition: 'width .3s' }} />
                      </div>
                    </div>
                  );
                });
            })()}
          </div>
        </div>
      </div>

      {/* Row 2 — Bubble chart */}
      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: 20 }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: '#1B4F8A', marginBottom: 4 }}>Carte stratégique du portefeuille</div>
        <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 14, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span>X = avancement · Y = budget · taille = priorité</span>
          <div style={{ display: 'flex', gap: 12 }}>
            {DOMAINES.map(d => (
              <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: DOMAINE_CFG[d].color }} />
                <span style={{ fontSize: 10, color: '#64748B' }}>{DOMAINE_CFG[d].label}</span>
              </div>
            ))}
          </div>
        </div>
        {projets.length === 0 ? (
          <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: 13 }}>
            Aucun projet à afficher
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart margin={{ top: 20, right: 30, left: 10, bottom: 30 }}>
              <XAxis
                type="number" dataKey="x" name="Avancement" unit="%" domain={[0, 100]}
                tick={{ fontSize: 10 }}
                label={{ value: 'Avancement (%)', position: 'insideBottom', offset: -15, fontSize: 10, fill: '#94A3B8' }}
              />
              <YAxis
                type="number" dataKey="y" name="Budget" domain={[0, maxBudget * 1.2]}
                tick={{ fontSize: 10 }}
                label={{ value: 'Budget (MFCFA)', angle: -90, position: 'insideLeft', offset: 10, fontSize: 10, fill: '#94A3B8' }}
              />
              <ZAxis type="number" dataKey="z" range={[200, 1200]} />
              <Tooltip content={<StrategiqueBubbleTooltip />} />
              <ReferenceLine x={50} stroke="#E2E8F0" strokeDasharray="5 3" />
              {bubbleByDomain.map(bd => (
                <Scatter
                  key={bd.domaine}
                  name={DOMAINE_CFG[bd.domaine].label}
                  data={bd.data}
                  fill={bd.color}
                  fillOpacity={0.75}
                  onClick={(d: BubblePoint) => {
                    const found = projets.find(p => p.id === d.id);
                    if (found) onSelectProjet(found);
                  }}
                  cursor="pointer"
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Row 3 — Two charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Alignement by domain */}
        <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#1B4F8A', marginBottom: 14 }}>Alignement stratégique par domaine</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={alignementData} layout="vertical" margin={{ top: 4, right: 20, left: 60, bottom: 0 }}>
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={60} />
              <Tooltip formatter={(v: number) => [`${v}%`, 'Avancement moyen']} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              <Bar dataKey="avancement" name="Avancement moyen" radius={[0, 4, 4, 0]}>
                {alignementData.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pipeline budgétaire */}
        <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#1B4F8A', marginBottom: 14 }}>Pipeline budgétaire par domaine</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={budgetPipelineData} margin={{ top: 4, right: 10, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number, name: string) => [fmtBudget(v), name === 'decaisse' ? 'Décaissé' : name === 'engage' ? 'Engagé' : 'Restant']} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 10 }} formatter={(v) => v === 'decaisse' ? 'Décaissé' : v === 'engage' ? 'Engagé' : 'Restant'} />
              <Bar dataKey="decaisse" stackId="a" fill="#16A34A" />
              <Bar dataKey="engage" stackId="a" fill="#F47920" />
              <Bar dataKey="restant" stackId="a" fill="#CBD5E1" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 4 — Correlation matrix */}
      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#1B4F8A', marginBottom: 4 }}>Interdépendances & Risques Portfolio</div>
        <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 14 }}>Nombre de ressources humaines partagées entre domaines</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ padding: '8px 12px', color: '#94A3B8', fontWeight: 700, textAlign: 'left', borderBottom: '2px solid #F1F5F9', minWidth: 120 }}></th>
                {DOMAINES.map(d => (
                  <th key={d} style={{ padding: '8px 16px', color: DOMAINE_CFG[d].color, fontWeight: 700, textAlign: 'center', borderBottom: '2px solid #F1F5F9', whiteSpace: 'nowrap', fontSize: 11 }}>
                    {DOMAINE_CFG[d].emoji} {DOMAINE_CFG[d].label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {correlationMatrix.map((row, ri) => (
                <tr key={row.domaine}>
                  <td style={{ padding: '8px 12px', fontWeight: 700, color: DOMAINE_CFG[row.domaine].color, borderBottom: '1px solid #F8FAFC', whiteSpace: 'nowrap', fontSize: 11 }}>
                    {DOMAINE_CFG[row.domaine].emoji} {DOMAINE_CFG[row.domaine].label}
                  </td>
                  {row.cols.map((val, ci) => {
                    if (val === -1) {
                      return (
                        <td key={ci} style={{ padding: '8px 16px', textAlign: 'center', background: '#F8FAFC', borderBottom: '1px solid #F8FAFC' }}>
                          <span style={{ color: '#CBD5E1', fontSize: 16 }}>—</span>
                        </td>
                      );
                    }
                    const intensity = val === 0 ? 0 : Math.min(0.8, val * 0.2 + 0.2);
                    return (
                      <td key={ci} style={{ padding: '8px 16px', textAlign: 'center', borderBottom: '1px solid #F8FAFC', background: val > 0 ? `rgba(27,79,138,${intensity})` : '#FAFAFA' }}>
                        {val > 0 ? (
                          <span style={{ fontWeight: 800, fontSize: 14, color: intensity > 0.4 ? '#fff' : '#1B4F8A' }}>{val}</span>
                        ) : (
                          <span style={{ color: '#E2E8F0', fontSize: 12 }}>0</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row 5 — Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Projets critiques */}
        <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#EF3340', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF3340' }} />
            Projets critiques
          </div>
          {critiques.length === 0 ? (
            <div style={{ color: '#94A3B8', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>Aucun projet critique</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {critiques.map(p => (
                <div
                  key={p.id}
                  onClick={() => onSelectProjet(p)}
                  style={{ padding: '8px 10px', background: '#FFF1F2', borderRadius: 8, borderLeft: '3px solid #EF3340', cursor: 'pointer' }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#EF3340' }}>{p.code}</div>
                  <div style={{ fontSize: 10, color: '#374151', marginTop: 2 }}>{p.nom.slice(0, 45)}{p.nom.length > 45 ? '…' : ''}</div>
                  <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 4, display: 'flex', gap: 8 }}>
                    <span>CPI: <strong style={{ color: indColor(p.cpi) }}>{p.cpi.toFixed(2)}</strong></span>
                    <span>SPI: <strong style={{ color: indColor(p.spi) }}>{p.spi.toFixed(2)}</strong></span>
                    <span>Av: <strong style={{ color: avColor(p.avancement) }}>{p.avancement}%</strong></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Jalons 60j */}
        <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#F47920', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#F47920' }} />
            Jalons prochain 60j
          </div>
          {jalons60.length === 0 ? (
            <div style={{ color: '#94A3B8', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>Aucun jalon dans les 60 prochains jours</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {jalons60.map((j, i) => (
                <div key={i} style={{ padding: '8px 10px', background: '#FFF7ED', borderRadius: 8, borderLeft: '3px solid #F47920' }}>
                  <div style={{ fontSize: 10, color: '#F47920', fontWeight: 700 }}>{j.date}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginTop: 2 }}>{j.label}</div>
                  <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 2 }}>{j.projetCode} — {j.projetNom.slice(0, 30)}{j.projetNom.length > 30 ? '…' : ''}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recommandations */}
        <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#1B4F8A', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#1B4F8A' }} />
            Recommandations
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {insights.map((ins, i) => (
              <div key={i} style={{ padding: '8px 10px', background: '#EFF6FF', borderRadius: 8, borderLeft: '3px solid #1B4F8A' }}>
                <div style={{ fontSize: 11, color: '#1E3A5F', lineHeight: 1.5 }}>
                  <strong style={{ color: '#1B4F8A' }}>{i + 1}.</strong> {ins}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────── VUE OPÉRATIONNELLE ───────────────────────────

function ResourceTooltipOp({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div style={{ background: '#fff', padding: '8px 12px', borderRadius: 8, boxShadow: '0 2px 12px rgba(0,0,0,0.12)', border: '1px solid #E2E8F0', fontSize: 11 }}>
      {payload.map((p, i) => (
        <div key={i}><strong>{p.name}:</strong> {p.value.toFixed(0)}%</div>
      ))}
    </div>
  );
}

function VueOperationnelle({ projets, onSelectProjet }: { projets: Projet[]; onSelectProjet: (p: Projet) => void }) {
  const store = useProjectStore();
  const scopeDomaines = useScopeDomaines();
  const [filterDomaine, setFilterDomaine] = useState<Domaine | 'tous'>('tous');
  const [filterStatut, setFilterStatut] = useState<StatutProjet | 'tous'>('tous');
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    return projets.filter(p => {
      if (filterDomaine !== 'tous' && p.domaine !== filterDomaine) return false;
      if (filterStatut !== 'tous' && p.statut !== filterStatut) return false;
      if (search && !p.nom.toLowerCase().includes(search.toLowerCase()) && !p.code.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [projets, filterDomaine, filterStatut, search]);

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // Resource load chart
  const resourceLoad = useMemo(() => {
    return store.ressources
      .filter(r => r.type === 'Travail')
      .map(r => {
        let totalAlloc = 0;
        projets.forEach(p => {
          if (p.statut === 'en_cours' || p.statut === 'planifie') {
            p.taches.forEach(t => {
              t.assignations.forEach(a => {
                if (a.ressourceId === r.id) totalAlloc += a.unite;
              });
            });
          }
        });
        return {
          name: `${r.prenom} ${r.nom}`.trim(),
          allocation: Math.round(totalAlloc),
        };
      })
      .filter(r => r.allocation > 0 || true)
      .slice(0, 12);
  }, [store.ressources, projets]);

  // Tasks due in 14 days
  const today = new Date('2026-05-25');
  const in14 = new Date(today);
  in14.setDate(in14.getDate() + 14);
  const tasksDue = useMemo(() => {
    const list: { projet: Projet; tache: (typeof projets)[0]['taches'][0]; responsable: string }[] = [];
    filtered.forEach(p => {
      p.taches.forEach(t => {
        const fin = new Date(t.dateFin);
        if (fin >= today && fin <= in14 && t.statutTache !== 'termine') {
          const r = t.assignations[0]
            ? store.ressources.find(r => r.id === t.assignations[0].ressourceId)
            : null;
          list.push({ projet: p, tache: t, responsable: r ? `${r.prenom} ${r.nom}` : '—' });
        }
      });
    });
    return list.sort((a, b) => a.tache.dateFin.localeCompare(b.tache.dateFin)).slice(0, 20);
  }, [filtered, store.ressources]);

  // In-progress tasks for quick update
  const inProgress = useMemo(() => {
    const list: { projet: Projet; tache: (typeof projets)[0]['taches'][0] }[] = [];
    filtered.forEach(p => {
      p.taches.forEach(t => {
        if (t.statutTache === 'en_cours') list.push({ projet: p, tache: t });
      });
    });
    return list.slice(0, 15);
  }, [filtered]);

  const STATUTS_PROJ: StatutProjet[] = ['en_cours', 'planifie', 'termine', 'en_retard', 'suspendu', 'archive'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Row 1 — Filters */}
      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: '14px 18px', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#374151', marginRight: 4 }}>Filtres:</div>

        {/* Domain chips */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            onClick={() => setFilterDomaine('tous')}
            style={{ padding: '4px 10px', borderRadius: 20, border: `1.5px solid ${filterDomaine === 'tous' ? '#1B4F8A' : '#E2E8F0'}`, background: filterDomaine === 'tous' ? '#1B4F8A' : '#fff', color: filterDomaine === 'tous' ? '#fff' : '#374151', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          >Tous</button>
          {scopeDomaines.map(d => (
            <button
              key={d}
              onClick={() => setFilterDomaine(d)}
              style={{ padding: '4px 10px', borderRadius: 20, border: `1.5px solid ${filterDomaine === d ? DOMAINE_CFG[d].color : '#E2E8F0'}`, background: filterDomaine === d ? DOMAINE_CFG[d].color : '#fff', color: filterDomaine === d ? '#fff' : '#374151', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
            >{DOMAINE_CFG[d].emoji} {DOMAINE_CFG[d].label}</button>
          ))}
        </div>

        {/* Statut select */}
        <select
          value={filterStatut}
          onChange={e => setFilterStatut(e.target.value as StatutProjet | 'tous')}
          style={{ padding: '5px 10px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 12, fontFamily: 'inherit', background: '#F8FAFC', color: '#374151', cursor: 'pointer' }}
        >
          <option value="tous">Tous statuts</option>
          {STATUTS_PROJ.map(s => <option key={s} value={s}>{STATUT_CFG[s].label}</option>)}
        </select>

        {/* Search */}
        <input
          type="text"
          placeholder="Rechercher projet..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: '6px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 12, fontFamily: 'inherit', background: '#F8FAFC', minWidth: 180, color: '#374151', outline: 'none' }}
        />

        <div style={{ fontSize: 11, color: '#94A3B8', marginLeft: 'auto' }}>
          {filtered.length} projet(s) affiché(s)
        </div>
      </div>

      {/* Row 2 — Project list with tasks */}
      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#1B4F8A', marginBottom: 14 }}>Suivi par projet — tâches détaillées</div>
        {filtered.length === 0 ? (
          <div style={{ color: '#94A3B8', fontSize: 13, textAlign: 'center', padding: '30px 0' }}>Aucun projet correspondant aux filtres</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map(p => {
              const cfg = DOMAINE_CFG[p.domaine];
              const scfg = STATUT_CFG[p.statut];
              const isCollapsed = collapsed[p.id] ?? false;
              return (
                <div key={p.id} style={{ border: '1px solid #F1F5F9', borderRadius: 10, overflow: 'hidden', borderLeft: `4px solid ${cfg.color}` }}>
                  {/* Project header */}
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#FAFBFC', cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => toggleCollapse(p.id)}
                  >
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: cfg.color }}>{p.code}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 }}>{p.nom}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: `${scfg.color}18`, color: scfg.color }}>{scfg.label}</span>
                      <span style={{ fontSize: 10, color: '#94A3B8' }}>{p.chefProjet}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 120 }}>
                        <div style={{ flex: 1, height: 6, background: '#E2E8F0', borderRadius: 3, overflow: 'hidden', minWidth: 80 }}>
                          <div style={{ height: '100%', width: `${p.avancement}%`, background: avColor(p.avancement), borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 800, color: avColor(p.avancement), minWidth: 32 }}>{p.avancement}%</span>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); onSelectProjet(p); }}
                        style={{ padding: '3px 9px', borderRadius: 6, border: '1px solid #E2E8F0', background: '#fff', fontSize: 11, cursor: 'pointer', color: '#1B4F8A', fontFamily: 'inherit', fontWeight: 600 }}
                      >Détail</button>
                      <span style={{ fontSize: 16, color: '#94A3B8', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>▾</span>
                    </div>
                  </div>

                  {/* Tasks table */}
                  {!isCollapsed && (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                        <thead>
                          <tr style={{ background: '#F8FAFC' }}>
                            {['Tâche', 'Type', 'Durée', 'Statut', 'Priorité', 'Avancement'].map(h => (
                              <th key={h} style={{ padding: '6px 10px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#94A3B8', textAlign: 'left', borderBottom: '1px solid #F1F5F9', whiteSpace: 'nowrap' }}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {p.taches.map(t => {
                            const sStatut: Record<string, { label: string; color: string }> = {
                              a_faire: { label: 'À faire', color: '#94A3B8' },
                              en_cours: { label: 'En cours', color: '#F47920' },
                              bloque: { label: 'Bloqué', color: '#EF3340' },
                              termine: { label: 'Terminé', color: '#16A34A' },
                            };
                            const ts = sStatut[t.statutTache] ?? { label: t.statutTache, color: '#94A3B8' };
                            return (
                              <tr key={t.id} style={{ borderBottom: '1px solid #F8FAFC' }}
                                onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                              >
                                <td style={{ padding: '6px 10px' }}>
                                  <div style={{ fontSize: 11, fontWeight: t.niveau === 1 ? 700 : 500, color: t.niveau === 1 ? '#1B4F8A' : '#374151', paddingLeft: (t.niveau - 1) * 12 }}>
                                    {t.nom}
                                  </div>
                                </td>
                                <td style={{ padding: '6px 10px' }}>
                                  <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 4, background: t.type === 'Récapitulative' ? '#EFF6FF' : t.type === 'Jalon' ? '#FFF7ED' : '#F8FAFC', color: t.type === 'Récapitulative' ? '#1B4F8A' : t.type === 'Jalon' ? '#F47920' : '#64748B' }}>
                                    {t.type}
                                  </span>
                                </td>
                                <td style={{ padding: '6px 10px', fontSize: 11, color: '#64748B', whiteSpace: 'nowrap' }}>{t.duree}j</td>
                                <td style={{ padding: '6px 10px' }}>
                                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 12, background: `${ts.color}18`, color: ts.color }}>
                                    {ts.label}
                                  </span>
                                </td>
                                <td style={{ padding: '6px 10px' }}>
                                  <span style={{ fontSize: 10, color: t.priorite === 'Haute' ? '#EF3340' : t.priorite === 'Moyenne' ? '#F47920' : '#16A34A', fontWeight: 700 }}>
                                    {t.priorite}
                                  </span>
                                </td>
                                <td style={{ padding: '6px 10px', minWidth: 120 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <input
                                      type="range"
                                      min={0} max={100} value={t.avancement}
                                      onChange={e => store.updateAvancement(p.id, t.id, Number(e.target.value))}
                                      onClick={e => e.stopPropagation()}
                                      style={{ flex: 1, accentColor: avColor(t.avancement), cursor: 'pointer' }}
                                    />
                                    <span style={{ fontSize: 10, fontWeight: 700, color: avColor(t.avancement), minWidth: 30 }}>{t.avancement}%</span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Row 3 — Resource load chart */}
      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#1B4F8A', marginBottom: 4 }}>Charge des ressources — projets actifs</div>
        <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 14 }}>Ligne rouge = surcharge (100% capacité)</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={resourceLoad} margin={{ top: 4, right: 20, left: 0, bottom: 60 }}>
            <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-35} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize: 10 }} unit="%" domain={[0, Math.max(120, ...resourceLoad.map(r => r.allocation + 10))]} />
            <Tooltip content={<ResourceTooltipOp />} />
            <ReferenceLine y={100} stroke="#EF3340" strokeDasharray="5 3" strokeWidth={2} label={{ value: 'Limite 100%', position: 'right', fontSize: 9, fill: '#EF3340' }} />
            <Bar dataKey="allocation" name="Allocation (%)" radius={[3, 3, 0, 0]}>
              {resourceLoad.map((r, i) => (
                <Cell key={i} fill={r.allocation > 100 ? '#EF3340' : r.allocation > 80 ? '#F47920' : '#1B4F8A'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Row 4 — Daily activities */}
      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#1B4F8A', marginBottom: 4 }}>Activités échéant dans 14 jours</div>
        <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 14 }}>Tâches dont la date de fin est dans les 14 prochains jours</div>
        {tasksDue.length === 0 ? (
          <div style={{ color: '#94A3B8', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Aucune tâche échéant dans les 14 prochains jours</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead>
                <tr>
                  {['Projet', 'Tâche', 'Responsable', 'Échéance', 'Avancement', 'Statut'].map(h => (
                    <th key={h} style={{ padding: '7px 10px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#94A3B8', textAlign: 'left', borderBottom: '1px solid #F1F5F9', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tasksDue.map(({ projet: p, tache: t, responsable }, i) => {
                  const daysLeft = Math.ceil((new Date(t.dateFin).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                  const urgency = daysLeft <= 3 ? '#EF3340' : daysLeft <= 7 ? '#F47920' : '#16A34A';
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #F8FAFC' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '7px 10px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: DOMAINE_CFG[p.domaine].color }}>{p.code}</div>
                      </td>
                      <td style={{ padding: '7px 10px', fontSize: 11, color: '#374151', maxWidth: 200 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.nom}</div>
                      </td>
                      <td style={{ padding: '7px 10px', fontSize: 11, color: '#64748B', whiteSpace: 'nowrap' }}>{responsable}</td>
                      <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: urgency }}>{t.dateFin}</span>
                        <span style={{ fontSize: 9, color: '#94A3B8', marginLeft: 4 }}>({daysLeft}j)</span>
                      </td>
                      <td style={{ padding: '7px 10px', minWidth: 100 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <div style={{ width: 60, height: 5, background: '#E2E8F0', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${t.avancement}%`, background: avColor(t.avancement), borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 700, color: avColor(t.avancement) }}>{t.avancement}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '7px 10px' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 12, background: `${urgency}18`, color: urgency }}>
                          {t.statutTache === 'en_cours' ? 'En cours' : t.statutTache === 'a_faire' ? 'À faire' : t.statutTache === 'bloque' ? 'Bloqué' : 'Terminé'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Row 5 — Quick progress update */}
      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#1B4F8A', marginBottom: 4 }}>Mise à jour rapide — tâches en cours</div>
        <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 14 }}>Glissez le curseur pour mettre à jour l&apos;avancement directement</div>
        {inProgress.length === 0 ? (
          <div style={{ color: '#94A3B8', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Aucune tâche en cours</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 10 }}>
            {inProgress.map(({ projet: p, tache: t }) => (
              <div key={`${p.id}-${t.id}`} style={{ padding: '12px 14px', background: '#F8FAFC', borderRadius: 10, borderLeft: `3px solid ${DOMAINE_CFG[p.domaine].color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: DOMAINE_CFG[p.domaine].color }}>{p.code}</span>
                    <span style={{ fontSize: 10, color: '#94A3B8', marginLeft: 6 }}>/ {t.duree}j</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 800, color: avColor(t.avancement) }}>{t.avancement}%</span>
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.nom}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="range"
                    min={0} max={100} step={5} value={t.avancement}
                    onChange={e => store.updateAvancement(p.id, t.id, Number(e.target.value))}
                    style={{ flex: 1, accentColor: avColor(t.avancement), cursor: 'pointer' }}
                  />
                  <div style={{ height: 6, width: 60, background: '#E2E8F0', borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
                    <div style={{ height: '100%', width: `${t.avancement}%`, background: avColor(t.avancement), borderRadius: 3 }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Regions of Senegal ─────────────────────────────────────────────────── */
const REGIONS_SN = ['Dakar', 'Thiès', 'Diourbel', 'Saint-Louis', 'Louga', 'Fatick', 'Kaolack', 'Tambacounda', 'Kédougou', 'Kolda', 'Ziguinchor', 'Sédhiou', 'Matam', 'Kaffrine'];
const BAILLEURS_DPE = ['AFD', 'BEI', 'IDA-BM', 'BAD', 'BID', 'JICA', 'KFW', 'BOAD', 'Fonds propres'];
const STATUTS_PROJ_ALL: StatutProjet[] = ['en_cours', 'planifie', 'termine', 'en_retard', 'suspendu', 'archive'];

// ──────────────────────────── COMPOSANT PRINCIPAL ─────────────────────────────

export default function Portefeuille() {
  const store = useProjectStore();
  const canGlobal = useCanPerform('VOIR_TOUT_PORTEFEUILLE');
  const [vue, setVue] = useState<'programme' | 'strategique' | 'operationnelle'>('programme');
  const [drawerProjet, setDrawerProjet] = useState<Projet | null>(null);
  const [expandedProg, setExpandedProg] = useState<string[]>(['production', 'transport', 'distribution', 'commercial', 'genie_civil']);

  /* ── Multi-dimensional Director filters ── */
  const [showFilters, setShowFilters]           = useState(false);
  const [filterSearch, setFilterSearch]         = useState('');
  const [filterDomaine, setFilterDomaine]       = useState<Domaine | 'tous'>('tous');
  const [filterRegion, setFilterRegion]         = useState<string>('tous');
  const [filterStatut, setFilterStatut]         = useState<StatutProjet | 'tous'>('tous');
  const [filterBailleur, setFilterBailleur]     = useState<string>('tous');
  const [filterPriorite, setFilterPriorite]     = useState<string>('tous');
  const [filterCpiMin, setFilterCpiMin]         = useState<number>(0);
  const [filterSpiMin, setFilterSpiMin]         = useState<number>(0);
  const [filterAvMax, setFilterAvMax]           = useState<number>(100);
  const [filterAlert, setFilterAlert]           = useState<boolean>(false);

  const activeFilterCount = [
    filterSearch, filterDomaine !== 'tous', filterRegion !== 'tous',
    filterStatut !== 'tous', filterBailleur !== 'tous', filterPriorite !== 'tous',
    filterCpiMin > 0, filterSpiMin > 0, filterAvMax < 100, filterAlert,
  ].filter(Boolean).length;

  function resetFilters() {
    setFilterSearch(''); setFilterDomaine('tous'); setFilterRegion('tous');
    setFilterStatut('tous'); setFilterBailleur('tous'); setFilterPriorite('tous');
    setFilterCpiMin(0); setFilterSpiMin(0); setFilterAvMax(100); setFilterAlert(false);
  }

  const allProjets = store.projets;

  const projets = useMemo(() => {
    return allProjets.filter(p => {
      if (filterSearch && !p.nom.toLowerCase().includes(filterSearch.toLowerCase()) && !p.code.toLowerCase().includes(filterSearch.toLowerCase())) return false;
      if (filterDomaine !== 'tous' && p.domaine !== filterDomaine) return false;
      if (filterRegion !== 'tous' && p.region !== filterRegion) return false;
      if (filterStatut !== 'tous' && p.statut !== filterStatut) return false;
      if (filterBailleur !== 'tous' && !p.bailleurs.some(b => b.nom.includes(filterBailleur))) return false;
      if (filterPriorite !== 'tous' && p.priorite !== filterPriorite) return false;
      if (p.cpi < filterCpiMin) return false;
      if (p.spi < filterSpiMin) return false;
      if (p.avancement > filterAvMax) return false;
      if (filterAlert && p.cpi >= 0.9 && p.spi >= 0.85 && p.statut !== 'en_retard') return false;
      return true;
    });
  }, [allProjets, filterSearch, filterDomaine, filterRegion, filterStatut, filterBailleur, filterPriorite, filterCpiMin, filterSpiMin, filterAvMax, filterAlert]);

  // Programme-level grouping (Portefeuille > Programme > Projet hierarchy per CDC)
  const programmes = useMemo(() => {
    const domains: Domaine[] = ['production', 'transport', 'distribution', 'commercial', 'genie_civil'];
    return domains.map(d => {
      const dp = allProjets.filter(p => p.domaine === d);
      const cfg = DOMAINE_CFG[d];
      const totalBudget = dp.reduce((s, p) => s + p.budget, 0);
      const totalDecaisse = dp.reduce((s, p) => s + p.budgetDecaisse, 0);
      const avgCpi = dp.length > 0 ? (dp.reduce((s, p) => s + p.cpi, 0) / dp.length) : 1;
      const avgSpi = dp.length > 0 ? (dp.reduce((s, p) => s + p.spi, 0) / dp.length) : 1;
      const avgProg = dp.length > 0 ? Math.round(dp.reduce((s, p) => s + p.avancement, 0) / dp.length) : 0;
      const alertes = dp.filter(p => p.statut === 'en_retard' || p.cpi < 0.9).length;
      return { domaine: d, cfg, projets: dp, totalBudget, totalDecaisse, avgCpi, avgSpi, avgProg, alertes };
    });
  }, [projets]);

  function toggleProg(d: string) {
    setExpandedProg(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', background: '#F4F6F9', padding: '20px 24px' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1B4F8A', margin: 0, lineHeight: 1.2 }}>
              {/* « Portefeuille » réservé aux profils Direction/Département/Programme ;
                  un chef de projet voit « Mes Projets ». */}
              {canGlobal ? 'Portefeuille DPE' : 'Mes Projets'} — {vue === 'programme' ? 'Programmes' : vue === 'strategique' ? 'Vue Stratégique' : 'Vue Opérationnelle'}
            </h1>
            <p style={{ fontSize: 12, color: '#94A3B8', margin: '4px 0 0', lineHeight: 1 }}>
              {!canGlobal ? 'Mes projets — détail, planning et suivi' : vue === 'programme' ? 'Hiérarchie Portefeuille → Programme → Projet → Lot' : vue === 'strategique' ? 'Vision exécutive consolidée' : 'Suivi opérationnel quotidien'}
            </p>
          </div>

          {/* Toggle */}
          <div style={{ display: 'flex', background: '#E8EDF4', borderRadius: 10, padding: 3, gap: 3 }}>
            {([
              { k: 'programme',     label: '🏛️ Programmes' },
              { k: 'strategique',   label: '📊 Stratégique' },
              { k: 'operationnelle',label: '⚙️ Opérationnel' },
            ] as { k: typeof vue; label: string }[]).map(({ k, label }) => (
              <button key={k} onClick={() => setVue(k)} style={{
                padding: '8px 14px', borderRadius: 8, border: 'none', fontFamily: 'inherit',
                fontWeight: 700, fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
                background: vue === k ? '#1B4F8A' : 'transparent',
                color: vue === k ? '#fff' : '#6B7280',
              }}>{label}</button>
            ))}
          </div>
        </div>

        {/* Sub-strip */}
        <div style={{ marginTop: 10, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          {[
            { label: `${projets.length} / ${allProjets.length} projets`, color: '#1B4F8A' },
            { label: `${projets.filter(p => p.statut === 'en_cours').length} en cours`, color: '#F47920' },
            { label: `${projets.filter(p => p.statut === 'en_retard').length} en retard`, color: '#EF3340' },
            { label: `${projets.filter(p => p.cpi < 0.9 || p.spi < 0.85).length} critiques`, color: '#EF3340' },
          ].map((s, i) => (
            <span key={i} style={{ fontSize: 12, fontWeight: 700, color: s.color, background: `${s.color}12`, padding: '3px 10px', borderRadius: 20 }}>{s.label}</span>
          ))}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <MatriceExport
              projets={allProjets}
              canGlobal={canGlobal}
              buttonLabel={canGlobal ? 'Matrice globale' : 'Exporter mes projets'}
            />
            {activeFilterCount > 0 && (
              <button onClick={resetFilters} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7, border: '1px solid #EF3340', background: '#FEF2F2', color: '#EF3340', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                ✕ Réinitialiser ({activeFilterCount})
              </button>
            )}
            <button
              onClick={() => setShowFilters(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: `1px solid ${showFilters ? '#1B4F8A' : '#E2E8F0'}`, background: showFilters ? '#EFF6FF' : '#fff', color: showFilters ? '#1B4F8A' : '#475569', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              ⚡ Filtres directeur {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
            </button>
          </div>
        </div>
      </div>

      {/* ── Multi-dimensional filter panel (Director) ── */}
      {showFilters && (
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '18px 20px', marginBottom: 16, boxShadow: '0 4px 16px rgba(27,79,138,0.1)', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#1B4F8A' }}>⚡ Filtrage multi-dimensionnel — Vue Directeur</div>
            <div style={{ flex: 1, height: 1, background: '#E2E8F0', marginLeft: 8 }} />
            <span style={{ fontSize: 11, color: '#94A3B8' }}>{projets.length} / {allProjets.length} projets sélectionnés</span>
          </div>

          {/* Row 1: search + domaine + region + statut */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Recherche</label>
              <input
                value={filterSearch}
                onChange={e => setFilterSearch(e.target.value)}
                placeholder="Code ou nom du projet…"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #E2E8F0', fontSize: 12.5, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Domaine</label>
              <select value={filterDomaine} onChange={e => setFilterDomaine(e.target.value as Domaine | 'tous')} style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #E2E8F0', fontSize: 12.5, fontFamily: 'inherit', background: '#fff', outline: 'none', cursor: 'pointer' }}>
                <option value="tous">Tous les domaines</option>
                {DOMAINES.map(d => <option key={d} value={d}>{DOMAINE_CFG[d].emoji} {DOMAINE_CFG[d].label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Région</label>
              <select value={filterRegion} onChange={e => setFilterRegion(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #E2E8F0', fontSize: 12.5, fontFamily: 'inherit', background: '#fff', outline: 'none', cursor: 'pointer' }}>
                <option value="tous">Toutes les régions</option>
                {REGIONS_SN.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Statut projet</label>
              <select value={filterStatut} onChange={e => setFilterStatut(e.target.value as StatutProjet | 'tous')} style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #E2E8F0', fontSize: 12.5, fontFamily: 'inherit', background: '#fff', outline: 'none', cursor: 'pointer' }}>
                <option value="tous">Tous statuts</option>
                {STATUTS_PROJ_ALL.map(s => <option key={s} value={s}>{s === 'en_cours' ? '🟢 En cours' : s === 'planifie' ? '🔵 Planifié' : s === 'termine' ? '✅ Terminé' : s === 'en_retard' ? '🔴 En retard' : s === 'suspendu' ? '⏸ Suspendu' : '📦 Archivé'}</option>)}
              </select>
            </div>
          </div>

          {/* Row 2: bailleur + priorité + CPI/SPI + alerte */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Bailleur de fonds</label>
              <select value={filterBailleur} onChange={e => setFilterBailleur(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #E2E8F0', fontSize: 12.5, fontFamily: 'inherit', background: '#fff', outline: 'none', cursor: 'pointer' }}>
                <option value="tous">Tous les bailleurs</option>
                {BAILLEURS_DPE.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Priorité</label>
              <select value={filterPriorite} onChange={e => setFilterPriorite(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #E2E8F0', fontSize: 12.5, fontFamily: 'inherit', background: '#fff', outline: 'none', cursor: 'pointer' }}>
                <option value="tous">Toutes priorités</option>
                <option value="Haute">🔴 Haute</option>
                <option value="Moyenne">🟡 Moyenne</option>
                <option value="Faible">🟢 Faible</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                CPI min : <span style={{ color: filterCpiMin > 0 ? '#EF3340' : '#94A3B8', fontWeight: 800 }}>{filterCpiMin.toFixed(2)}</span>
                <span style={{ marginLeft: 8, fontWeight: 400, fontSize: 10 }}>(afficher si CPI ≥ seuil)</span>
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="range" min={0} max={1.2} step={0.05} value={filterCpiMin}
                  onChange={e => setFilterCpiMin(parseFloat(e.target.value))}
                  style={{ flex: 1, accentColor: '#1B4F8A' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#1B4F8A', minWidth: 30 }}>{filterCpiMin.toFixed(2)}</span>
              </div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginTop: 8, marginBottom: 4 }}>
                SPI min : <span style={{ color: filterSpiMin > 0 ? '#EF3340' : '#94A3B8', fontWeight: 800 }}>{filterSpiMin.toFixed(2)}</span>
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="range" min={0} max={1.2} step={0.05} value={filterSpiMin}
                  onChange={e => setFilterSpiMin(parseFloat(e.target.value))}
                  style={{ flex: 1, accentColor: '#1B4F8A' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#1B4F8A', minWidth: 30 }}>{filterSpiMin.toFixed(2)}</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                Avancement max : {filterAvMax}%
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="range" min={0} max={100} step={5} value={filterAvMax}
                  onChange={e => setFilterAvMax(parseInt(e.target.value))}
                  style={{ flex: 1, accentColor: '#F47920' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#F47920', minWidth: 30 }}>{filterAvMax}%</span>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 8 }}>
                <input type="checkbox" checked={filterAlert} onChange={e => setFilterAlert(e.target.checked)} style={{ accentColor: '#EF3340', width: 14, height: 14 }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#EF3340' }}>Projets critiques seulement</span>
              </label>
            </div>
          </div>

          {/* Active filters pills */}
          {activeFilterCount > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 4, borderTop: '1px solid #F1F5F9' }}>
              {filterSearch && <span style={{ fontSize: 11, fontWeight: 700, background: '#EFF6FF', color: '#1B4F8A', padding: '3px 9px', borderRadius: 12 }}>Recherche: &quot;{filterSearch}&quot;</span>}
              {filterDomaine !== 'tous' && <span style={{ fontSize: 11, fontWeight: 700, background: `${DOMAINE_CFG[filterDomaine].color}18`, color: DOMAINE_CFG[filterDomaine].color, padding: '3px 9px', borderRadius: 12 }}>{DOMAINE_CFG[filterDomaine].label}</span>}
              {filterRegion !== 'tous' && <span style={{ fontSize: 11, fontWeight: 700, background: '#F5F3FF', color: '#7C3AED', padding: '3px 9px', borderRadius: 12 }}>📍 {filterRegion}</span>}
              {filterStatut !== 'tous' && <span style={{ fontSize: 11, fontWeight: 700, background: '#FFF7ED', color: '#D97706', padding: '3px 9px', borderRadius: 12 }}>Statut: {filterStatut}</span>}
              {filterBailleur !== 'tous' && <span style={{ fontSize: 11, fontWeight: 700, background: '#F0FDF4', color: '#16A34A', padding: '3px 9px', borderRadius: 12 }}>🏦 {filterBailleur}</span>}
              {filterPriorite !== 'tous' && <span style={{ fontSize: 11, fontWeight: 700, background: '#FEE2E2', color: '#EF3340', padding: '3px 9px', borderRadius: 12 }}>Priorité: {filterPriorite}</span>}
              {filterCpiMin > 0 && <span style={{ fontSize: 11, fontWeight: 700, background: '#EFF6FF', color: '#1B4F8A', padding: '3px 9px', borderRadius: 12 }}>CPI ≥ {filterCpiMin.toFixed(2)}</span>}
              {filterSpiMin > 0 && <span style={{ fontSize: 11, fontWeight: 700, background: '#EFF6FF', color: '#1B4F8A', padding: '3px 9px', borderRadius: 12 }}>SPI ≥ {filterSpiMin.toFixed(2)}</span>}
              {filterAvMax < 100 && <span style={{ fontSize: 11, fontWeight: 700, background: '#FFF7ED', color: '#F47920', padding: '3px 9px', borderRadius: 12 }}>Av ≤ {filterAvMax}%</span>}
              {filterAlert && <span style={{ fontSize: 11, fontWeight: 700, background: '#FEE2E2', color: '#EF3340', padding: '3px 9px', borderRadius: 12 }}>⚠ Critiques seulement</span>}
            </div>
          )}
        </div>
      )}

      {/* ── Vue Programme (new) ── */}
      {vue === 'programme' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {programmes.filter(prog => prog.projets.length > 0).map(prog => {
            const isExpanded = expandedProg.includes(prog.domaine);
            return (
              <div key={prog.domaine} style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.05)' }}>
                {/* Programme header */}
                <div
                  onClick={() => toggleProg(prog.domaine)}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', cursor: 'pointer', background: `${prog.cfg.color}08`, borderBottom: isExpanded ? '1px solid #F1F5F9' : 'none' }}
                >
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: prog.cfg.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                    {prog.cfg.emoji}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: prog.cfg.color }}>Programme {prog.cfg.label}</div>
                    <div style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>{prog.projets.length} projet{prog.projets.length > 1 ? 's' : ''} · {prog.cfg.desc}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                    {[
                      { label: 'Budget', val: `${prog.totalBudget.toFixed(0)} M`, color: '#1B4F8A' },
                      { label: 'Décaissé', val: `${prog.totalDecaisse.toFixed(0)} M`, color: '#F47920' },
                      { label: 'Avancement', val: `${prog.avgProg}%`, color: prog.avgProg >= 60 ? '#16A34A' : '#D97706' },
                      { label: 'CPI', val: prog.avgCpi.toFixed(2), color: prog.avgCpi >= 0.95 ? '#16A34A' : '#EF3340' },
                      { label: 'SPI', val: prog.avgSpi.toFixed(2), color: prog.avgSpi >= 0.90 ? '#16A34A' : '#D97706' },
                    ].map(k => (
                      <div key={k.label} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 9, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.5px' }}>{k.label}</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: k.color }}>{k.val}</div>
                      </div>
                    ))}
                    {prog.alertes > 0 && (
                      <div style={{ background: '#FFF1F2', border: '1px solid #FECACA', borderRadius: 6, padding: '4px 8px', fontSize: 11, color: '#EF3340', fontWeight: 700 }}>
                        ⚠ {prog.alertes} alerte{prog.alertes > 1 ? 's' : ''}
                      </div>
                    )}
                    <div style={{ fontSize: 18, color: prog.cfg.color, transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}>›</div>
                  </div>
                </div>
                {/* Projects inside programme */}
                {isExpanded && (
                  <div style={{ padding: '10px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {prog.projets.map(p => {
                      const scfg = STATUT_CFG[p.statut];
                      return (
                        <div key={p.id}
                          onClick={() => setDrawerProjet(p)}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, border: '1px solid #F1F5F9', background: '#FAFAFA', cursor: 'pointer', transition: 'background .15s' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#F0F4FF')}
                          onMouseLeave={e => (e.currentTarget.style.background = '#FAFAFA')}
                        >
                          <div style={{ width: 4, height: 32, borderRadius: 2, background: prog.cfg.color, flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nom}</div>
                            <div style={{ fontSize: 10, color: '#64748B' }}>{p.code} · {p.region} · {p.chefProjet}</div>
                          </div>
                          <div style={{ height: 20, width: 100, background: '#E5E7EB', borderRadius: 4, overflow: 'hidden', flexShrink: 0 }}>
                            <div style={{ width: `${p.avancement}%`, height: '100%', background: prog.cfg.color, opacity: 0.8 }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: prog.cfg.color, width: 36, textAlign: 'right', flexShrink: 0 }}>{p.avancement}%</span>
                          <span style={{ fontSize: 10, fontWeight: 700, color: scfg.color, padding: '2px 7px', borderRadius: 4, background: `${scfg.color}14`, flexShrink: 0 }}>{scfg.label}</span>
                          <div style={{ textAlign: 'center', flexShrink: 0, minWidth: 60 }}>
                            <span style={{ fontSize: 9, color: '#94A3B8', display: 'block' }}>CPI/SPI</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: p.cpi >= 0.95 ? '#16A34A' : '#EF3340' }}>{p.cpi.toFixed(2)}</span>
                            <span style={{ fontSize: 9, color: '#94A3B8' }}>/</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: p.spi >= 0.90 ? '#16A34A' : '#D97706' }}>{p.spi.toFixed(2)}</span>
                          </div>
                        </div>
                      );
                    })}
                    {prog.projets.length === 0 && (
                      <div style={{ padding: '16px', textAlign: 'center', color: '#CBD5E1', fontSize: 11 }}>Aucun projet dans ce programme</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Body ── */}
      {vue === 'strategique' && (
        <VueStrategique projets={projets} onSelectProjet={setDrawerProjet} />
      )}
      {vue === 'operationnelle' && (
        <VueOperationnelle projets={projets} onSelectProjet={setDrawerProjet} />
      )}

      {/* ── Drawer ── */}
      {drawerProjet && (
        <ProjetDrawer projet={drawerProjet} onClose={() => setDrawerProjet(null)} />
      )}
    </div>
  );
}
