'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import {
  X, Search, Download, FileText, FileSpreadsheet, Check,
  ChevronDown, ChevronUp, Eye, ArrowLeft, LayoutList,
} from 'lucide-react';
import { useProjectStore, DOMAINE_CFG, type Domaine, type Projet } from '@/lib/projectStore';
import { downloadExcel, printBranded } from '@/lib/exportUtils';
import { exportRapportWord, type SectionDocx, type MetaRapport } from '@/lib/exportWord';

/* ─── Style ─────────────────────────────────────────────────────────────── */
const NAVY   = '#3D1A6B';
const ORANGE = '#F47920';
const GREEN  = '#16A34A';
const AMBER  = '#D97706';
const RED    = '#EF3340';
const PURPLE = '#8B5CF6';
const TEAL   = '#0E7490';
const LIGHT  = '#F8F7FF';

/* ─── Types ─────────────────────────────────────────────────────────────── */
type Trimestre = 'T1' | 'T2' | 'T3' | 'T4' | 'annuel' | 'custom';
type Format    = 'excel' | 'word' | 'pdf';
type View      = 'config' | 'preview';

type SectionId =
  | 'synthese' | 'finances' | 'planning' | 'jalons'
  | 'risques'  | 'decisions' | 'indicateurs' | 'ressources'
  | 'fiches';

interface SectionConfig {
  id: SectionId;
  label: string;
  desc: string;
  color: string;
}

interface IndicGroup { label: string; items: { id: string; label: string }[] }

/* Champs texte libres du projet (via metadata ou champs optionnels) */
type ProjetExt = Projet & {
  problemes?: string;
  risques?: string;
  decisions?: string;
  commentaires?: string;
};

function extProjet(p: Projet): ProjetExt {
  const m = (p.metadata ?? {}) as Record<string, string>;
  return {
    ...p,
    problemes:    m.problemes    ?? (p as ProjetExt).problemes    ?? '',
    risques:      m.risques      ?? (p as ProjetExt).risques      ?? '',
    decisions:    m.decisions    ?? (p as ProjetExt).decisions    ?? '',
    commentaires: m.commentaires ?? (p as ProjetExt).commentaires ?? '',
  };
}

/* ─── Catalogue sections ────────────────────────────────────────────────── */
const SECTIONS_CATALOGUE: SectionConfig[] = [
  { id: 'synthese',     label: 'Synthèse exécutive',        desc: 'KPI consolidés, contexte, statuts',           color: NAVY   },
  { id: 'fiches',       label: 'Fiches projets',             desc: 'Tableaux synthétiques par projet',            color: TEAL   },
  { id: 'finances',     label: 'Budget & Finances',           desc: 'Budget, engagements, décaissements',          color: GREEN  },
  { id: 'planning',     label: 'Planning & Délais',            desc: 'Dates, écarts, projets en retard',            color: PURPLE },
  { id: 'jalons',       label: 'Jalons critiques',             desc: 'Jalons franchis, à venir, en retard',         color: AMBER  },
  { id: 'risques',      label: 'Risques & Projets critiques',  desc: 'CPI/SPI critiques, projets en alerte',        color: RED    },
  { id: 'decisions',    label: 'Décisions & Arbitrages',       desc: 'Points de décision soulevés',                 color: PURPLE },
  { id: 'indicateurs',  label: 'Indicateurs de perf.',         desc: 'Indicateurs KPI sélectionnés',                color: '#0EA5E9' },
  { id: 'ressources',   label: 'Ressources humaines',          desc: 'Chefs de projet, équipes par domaine',        color: '#14B8A6' },
];

const DEFAULT_SECTIONS: SectionId[] = ['synthese', 'fiches', 'finances', 'risques'];

const MODELES_RAPPORT: { label: string; sections: SectionId[] }[] = [
  { label: 'CSE standard',         sections: ['synthese', 'fiches', 'finances', 'risques'] },
  { label: 'Comité de Direction',   sections: ['synthese', 'finances', 'jalons', 'decisions'] },
  { label: 'Rapport complet',       sections: ['synthese', 'fiches', 'finances', 'planning', 'jalons', 'risques', 'decisions', 'indicateurs', 'ressources'] },
];

/* ─── Config indicateurs ───────────────────────────────────────────────── */
const INDIC_GROUPS: IndicGroup[] = [
  { label: 'Financier', items: [
    { id: 'budget_global',     label: 'Budget global (M FCFA)' },
    { id: 'budget_engage',     label: 'Engagé (M FCFA)' },
    { id: 'budget_decaisse',   label: 'Décaissé (M FCFA)' },
    { id: 'taux_engagement',   label: 'Taux d\'engagement' },
    { id: 'taux_decaissement', label: 'Taux de décaissement' },
  ]},
  { label: 'Performance', items: [
    { id: 'avancement_physique', label: 'Avancement physique' },
    { id: 'cpi',                 label: 'CPI (Indice coût)' },
    { id: 'spi',                 label: 'SPI (Indice délai)' },
    { id: 'statut_global',       label: 'Statut global (RAG)' },
  ]},
  { label: 'Planning', items: [
    { id: 'date_debut',      label: 'Date de démarrage' },
    { id: 'date_fin_prevue', label: 'Fin prévisionnelle' },
    { id: 'date_fin_maj',    label: 'Fin actualisée' },
  ]},
  { label: 'Identification', items: [
    { id: 'chef_projet', label: 'Chef de projet' },
    { id: 'domaine',     label: 'Domaine' },
    { id: 'programme',   label: 'Programme' },
  ]},
];

const DEFAULT_INDICS = new Set([
  'budget_global', 'budget_decaisse', 'taux_decaissement',
  'avancement_physique', 'statut_global', 'date_fin_prevue',
]);

const TRIMESTRES: { value: Trimestre; label: string; short: string }[] = [
  { value: 'T1',     label: 'T1 — Janv. à Mars',  short: 'T1' },
  { value: 'T2',     label: 'T2 — Avr. à Juin',   short: 'T2' },
  { value: 'T3',     label: 'T3 — Juil. à Sept.', short: 'T3' },
  { value: 'T4',     label: 'T4 — Oct. à Déc.',   short: 'T4' },
  { value: 'annuel', label: 'Annuel',               short: 'Ann.' },
  { value: 'custom', label: 'Personnalisé',          short: 'Perso.' },
];

/* ─── Helpers ──────────────────────────────────────────────────────────── */
function fmtN(v: number, dec = 0): string {
  return v.toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function fmtPct(v: number): string { return `${Math.round(v)}%`; }
function fmtDate(d?: string): string {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return d; }
}

function statutColor(s: string): string {
  if (s === 'termine') return GREEN;
  if (s === 'suspendu' || s === 'annule') return RED;
  if (s === 'en_retard') return AMBER;
  return NAVY;
}

/* ─── Builders sections Word ─────────────────────────────────────────────── */
function buildSectionsWord(
  id: SectionId,
  projets: Projet[],
  periodeLabel: string,
  indics: Set<string>,
): SectionDocx {
  const n = projets.length;
  switch (id) {
    case 'synthese': {
      const totBudget   = projets.reduce((s, p) => s + (p.budget ?? 0), 0);
      const totDecaisse = projets.reduce((s, p) => s + (p.budgetDecaisse ?? 0), 0);
      const avgAv       = n ? projets.reduce((s, p) => s + (p.avancement ?? 0), 0) / n : 0;
      const critiques   = projets.filter(p => (p.cpi ?? 1) < 0.9 || (p.spi ?? 1) < 0.85).length;
      return {
        titre: 'Synthèse exécutive',
        contenu: `Rapport de suivi consolidé — ${periodeLabel}\n${n} projet(s) analysé(s).\n\nBudget total : ${fmtN(totBudget)} M FCFA · Décaissé : ${fmtN(totDecaisse)} M FCFA (${totBudget ? fmtPct(totDecaisse / totBudget * 100) : '—'})\nAvancement physique moyen : ${fmtPct(avgAv)} · Projets critiques : ${critiques} / ${n}`,
        tableau: {
          headers: ['Indicateur', 'Valeur'],
          rows: [
            ['Nombre de projets', String(n)],
            ['Budget total (M FCFA)', fmtN(totBudget)],
            ['Décaissé cumulé (M FCFA)', fmtN(totDecaisse)],
            ['Taux de décaissement', totBudget ? fmtPct(totDecaisse / totBudget * 100) : '—'],
            ['Avancement physique moyen', fmtPct(avgAv)],
            ['Projets critiques (CPI/SPI)', String(critiques)],
          ],
        },
      };
    }
    case 'fiches': {
      const rows: string[][] = projets.map(p => {
        const pe = extProjet(p);
        const avFin = p.budget ? Math.round((p.budgetDecaisse ?? 0) / p.budget * 100) : 0;
        const jalonsStr = (p.jalons ?? []).slice(0, 3).map(j => `${j.label} (${fmtDate(j.date)}) ${j.atteint ? '✓' : '…'}`).join(' | ') || '—';
        return [
          p.code ?? '—',
          p.nom.slice(0, 55),
          p.domaine ?? '—',
          p.statut ?? '—',
          fmtPct(p.avancement ?? 0),
          fmtPct(avFin),
          (p.cpi ?? 1).toFixed(2),
          (p.spi ?? 1).toFixed(2),
          jalonsStr,
          pe.problemes || '—',
          pe.risques || '—',
          pe.decisions || '—',
          pe.commentaires || '—',
        ];
      });
      return {
        titre: 'Fiches synthétiques par projet',
        contenu: `${n} fiche(s) consolidée(s) — ${periodeLabel}`,
        tableau: {
          headers: ['Code', 'Projet', 'Domaine', 'Statut', 'Av. phys.', 'Av. fin.', 'CPI', 'SPI', 'Jalons', 'Problèmes', 'Risques', 'Décisions', 'Commentaires'],
          rows,
        },
      };
    }
    case 'finances':
      return {
        titre: 'Budget & Finances',
        contenu: `Tableau financier consolidé — ${n} projet(s) — ${periodeLabel}`,
        tableau: {
          headers: ['Code', 'Projet', 'Budget (M FCFA)', 'Engagé (M FCFA)', 'Décaissé (M FCFA)', 'Taux déc.'],
          rows: projets.map(p => [
            p.code ?? '—', p.nom.slice(0, 45),
            fmtN(p.budget ?? 0), fmtN(p.budgetEngage ?? 0), fmtN(p.budgetDecaisse ?? 0),
            p.budget ? fmtPct((p.budgetDecaisse ?? 0) / p.budget * 100) : '—',
          ]),
        },
      };
    case 'planning':
      return {
        titre: 'Planning & Délais',
        contenu: `Suivi des dates clés — ${n} projet(s) — ${periodeLabel}`,
        tableau: {
          headers: ['Code', 'Projet', 'Démarrage', 'ODS', 'Fin prév.', 'Fin actualisée', 'Av. phys.'],
          rows: projets.map(p => [
            p.code ?? '—', p.nom.slice(0, 40),
            fmtDate(p.dateDebut),
            fmtDate((p as Projet & { dateODS?: string }).dateODS),
            fmtDate(p.dateFinPrevue),
            fmtDate(p.dateFinEstimee),
            fmtPct(p.avancement ?? 0),
          ]),
        },
      };
    case 'jalons': {
      const rows: string[][] = [];
      projets.forEach(p => {
        (p.jalons ?? []).slice(0, 3).forEach(j => {
          rows.push([p.code ?? '—', j.label ?? '—', fmtDate(j.date), j.atteint ? 'Atteint' : 'En cours']);
        });
      });
      return {
        titre: 'Jalons critiques',
        contenu: rows.length === 0 ? 'Aucun jalon renseigné pour les projets sélectionnés.' : `${rows.length} jalons recensés.`,
        tableau: rows.length > 0 ? { headers: ['Projet', 'Jalon', 'Date prév.', 'Statut'], rows } : undefined,
      };
    }
    case 'risques': {
      const critiques = projets.filter(p => (p.cpi ?? 1) < 0.9 || (p.spi ?? 1) < 0.85 || p.statut === 'suspendu');
      return {
        titre: 'Risques & Projets critiques',
        contenu: critiques.length === 0
          ? 'Aucun projet en situation critique dans la sélection.'
          : `${critiques.length} projet(s) nécessitent une attention particulière.`,
        tableau: critiques.length > 0 ? {
          headers: ['Code', 'Projet', 'Statut', 'CPI', 'SPI', 'Av. phys.'],
          rows: critiques.map(p => [
            p.code ?? '—', p.nom.slice(0, 40), p.statut ?? '—',
            (p.cpi ?? 1).toFixed(2), (p.spi ?? 1).toFixed(2), fmtPct(p.avancement ?? 0),
          ]),
        } : undefined,
      };
    }
    case 'decisions':
      return {
        titre: 'Décisions & Arbitrages',
        contenu: `Points de décision identifiés — ${periodeLabel}\n\nCette section présente les sujets nécessitant une décision ou un arbitrage du Comité de Suivi et d'Évaluation (CSE).`,
      };
    case 'indicateurs': {
      const rows: string[][] = projets.map(p => {
        const r: string[] = [p.code ?? '—', p.nom.slice(0, 35)];
        if (indics.has('statut_global'))       r.push(p.statut ?? '—');
        if (indics.has('avancement_physique')) r.push(fmtPct(p.avancement ?? 0));
        if (indics.has('cpi'))                 r.push((p.cpi ?? 1).toFixed(2));
        if (indics.has('spi'))                 r.push((p.spi ?? 1).toFixed(2));
        return r;
      });
      const headers = ['Code', 'Projet'];
      if (indics.has('statut_global'))       headers.push('Statut');
      if (indics.has('avancement_physique')) headers.push('Av. phys.');
      if (indics.has('cpi'))                 headers.push('CPI');
      if (indics.has('spi'))                 headers.push('SPI');
      return { titre: 'Indicateurs de performance', contenu: `${n} projet(s) — ${periodeLabel}`, tableau: { headers, rows } };
    }
    case 'ressources':
      return {
        titre: 'Ressources humaines',
        contenu: `Chefs de projet et équipes — ${periodeLabel}`,
        tableau: {
          headers: ['Code', 'Projet', 'Chef de projet', 'Domaine'],
          rows: projets.map(p => [p.code ?? '—', p.nom.slice(0, 40), p.chefProjet ?? '—', p.domaine ?? '—']),
        },
      };
  }
}

/* ─── Composant Prévisualisation ─────────────────────────────────────────── */
function PreviewDocument({
  sections, projets, periodeLabel, indics,
}: {
  sections: SectionId[];
  projets: Projet[];
  periodeLabel: string;
  indics: Set<string>;
}) {
  const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div style={{ fontFamily: "'Segoe UI', Arial, sans-serif", color: '#1E293B', fontSize: 13 }}>
      {/* En-tête document */}
      <div style={{ background: NAVY, borderRadius: 10, padding: '16px 20px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>SENELEC · Direction Principale Équipement</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>Rapport CSE — {periodeLabel}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 3 }}>{projets.length} projet(s) · {sections.length} section(s) · Édité le {today}</div>
        </div>
        <div style={{ background: `${ORANGE}22`, border: `1px solid ${ORANGE}44`, borderRadius: 7, padding: '5px 12px', fontSize: 10.5, fontWeight: 700, color: ORANGE, letterSpacing: '0.04em' }}>
          CONFIDENTIEL
        </div>
      </div>

      {/* Sections */}
      {sections.map((sid, idx) => {
        const cfg = SECTIONS_CATALOGUE.find(s => s.id === sid)!;
        return (
          <div key={sid} style={{ marginBottom: 22 }}>
            {/* Header section */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ width: 22, height: 22, borderRadius: 6, background: cfg.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                {idx + 1}
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, color: cfg.color, letterSpacing: '-0.2px' }}>{cfg.label}</div>
              <div style={{ flex: 1, height: 1, background: `${cfg.color}20`, marginLeft: 4 }} />
            </div>

            {sid === 'fiches' ? (
              /* ── Cartes par projet ── */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {projets.map(p => {
                  const pe = extProjet(p);
                  const avFin = p.budget ? Math.round((p.budgetDecaisse ?? 0) / p.budget * 100) : 0;
                  const avPhys = Math.round(p.avancement ?? 0);
                  const cfg2 = DOMAINE_CFG[p.domaine as Domaine] ?? { color: '#64748B', label: p.domaine ?? '' };
                  const cpi = p.cpi ?? 1;
                  const spi = p.spi ?? 1;
                  const critiqueCPI = cpi < 0.9;
                  const critiqueSPI = spi < 0.85;

                  return (
                    <div key={p.id} style={{ border: '1.5px solid #E8ECF4', borderRadius: 10, overflow: 'hidden' }}>
                      {/* Card header */}
                      <div style={{ background: `${TEAL}08`, borderBottom: '1px solid #E8ECF4', padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 10.5, fontWeight: 800, color: TEAL, fontFamily: 'monospace' }}>{p.code}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#1E293B', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nom}</span>
                        <span style={{ fontSize: 9.5, fontWeight: 700, color: cfg2.color, background: `${cfg2.color}14`, padding: '2px 8px', borderRadius: 20, flexShrink: 0 }}>{cfg2.label}</span>
                        <span style={{ fontSize: 9.5, fontWeight: 600, color: statutColor(p.statut), background: `${statutColor(p.statut)}12`, padding: '2px 8px', borderRadius: 20, flexShrink: 0 }}>{p.statut}</span>
                      </div>

                      <div style={{ padding: '10px 14px' }}>
                        {/* Chef projet */}
                        <div style={{ fontSize: 10.5, color: '#94A3B8', marginBottom: 10 }}>
                          Chef de projet : <strong style={{ color: '#475569' }}>{p.chefProjet}</strong>
                          {p.dateDebut && <> · Démarrage : <strong style={{ color: '#475569' }}>{fmtDate(p.dateDebut)}</strong></>}
                          {p.dateFinPrevue && <> · Fin prév. : <strong style={{ color: '#475569' }}>{fmtDate(p.dateFinPrevue)}</strong></>}
                        </div>

                        {/* Progress bars */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                          {[
                            { label: 'Avancement physique', val: avPhys, color: NAVY },
                            { label: 'Avancement financier', val: avFin, color: GREEN },
                          ].map(bar => (
                            <div key={bar.label}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                <span style={{ fontSize: 10, color: '#64748B', fontWeight: 600 }}>{bar.label}</span>
                                <span style={{ fontSize: 11, fontWeight: 800, color: bar.color }}>{bar.val}%</span>
                              </div>
                              <div style={{ height: 6, borderRadius: 4, background: '#E8ECF4', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${Math.min(bar.val, 100)}%`, background: bar.color, borderRadius: 4 }} />
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* KPI row */}
                        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                          {[
                            { label: 'CPI', val: cpi.toFixed(2), warn: critiqueCPI },
                            { label: 'SPI', val: spi.toFixed(2), warn: critiqueSPI },
                            { label: 'Budget', val: `${fmtN(p.budget ?? 0)} M`, warn: false },
                            { label: 'Décaissé', val: `${fmtN(p.budgetDecaisse ?? 0)} M`, warn: false },
                          ].map(k => (
                            <div key={k.label} style={{ flex: 1, background: k.warn ? '#FEF2F2' : '#F8FAFC', border: `1px solid ${k.warn ? '#FECACA' : '#E8ECF4'}`, borderRadius: 7, padding: '5px 8px', textAlign: 'center' }}>
                              <div style={{ fontSize: 9, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{k.label}</div>
                              <div style={{ fontSize: 12, fontWeight: 800, color: k.warn ? RED : '#1E293B', marginTop: 2 }}>{k.val}</div>
                            </div>
                          ))}
                        </div>

                        {/* Jalons */}
                        {(p.jalons ?? []).length > 0 && (
                          <div style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: 9.5, fontWeight: 700, color: '#CBD5E1', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 5 }}>Jalons</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {(p.jalons ?? []).slice(0, 4).map((j, ji) => (
                                <div key={ji} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 20, background: j.atteint ? `${GREEN}10` : `${AMBER}10`, border: `1px solid ${j.atteint ? GREEN : AMBER}30`, fontSize: 10, color: j.atteint ? GREEN : AMBER, fontWeight: 600 }}>
                                  <span style={{ fontSize: 9 }}>{j.atteint ? '✓' : '○'}</span>
                                  <span>{j.label}</span>
                                  <span style={{ color: j.atteint ? `${GREEN}99` : `${AMBER}99`, fontSize: 9 }}>({fmtDate(j.date)})</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Champs texte */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                          {[
                            { label: 'Problèmes majeurs', val: pe.problemes, color: RED },
                            { label: 'Risques identifiés', val: pe.risques, color: AMBER },
                            { label: 'Décisions requises', val: pe.decisions, color: PURPLE },
                            { label: 'Commentaires', val: pe.commentaires, color: '#64748B' },
                          ].map(field => (
                            <div key={field.label} style={{ background: '#F8FAFC', border: '1px solid #E8ECF4', borderRadius: 7, padding: '7px 10px', borderLeft: `3px solid ${field.color}40` }}>
                              <div style={{ fontSize: 9, fontWeight: 700, color: field.color, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>{field.label}</div>
                              <div style={{ fontSize: 11, color: field.val ? '#334155' : '#CBD5E1', fontStyle: field.val ? 'normal' : 'italic', lineHeight: 1.5 }}>{field.val || 'Non renseigné'}</div>
                            </div>
                          ))}
                        </div>

                        {/* Incidents / motif suspension */}
                        {(p.motifSuspension || (p.incidents && p.incidents.length > 0)) && (
                          <div style={{ marginTop: 8, padding: '7px 10px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 7 }}>
                            <div style={{ fontSize: 9, fontWeight: 700, color: RED, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 3 }}>Alerte</div>
                            {p.motifSuspension && <div style={{ fontSize: 11, color: '#7F1D1D' }}>{p.motifSuspension}</div>}
                            {p.incidents && p.incidents.length > 0 && (
                              <div style={{ fontSize: 10.5, color: '#7F1D1D', marginTop: 2 }}>{p.incidents.length} incident(s) enregistré(s)</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* ── Sections standard (tableau) ── */
              <div style={{ background: '#F8FAFC', borderRadius: 8, border: '1px solid #E8ECF4', overflow: 'hidden' }}>
                {(() => {
                  const sec = buildSectionsWord(sid, projets, periodeLabel, indics);
                  return (
                    <>
                      {sec.contenu && (
                        <div style={{ padding: '9px 14px', fontSize: 11.5, color: '#475569', borderBottom: sec.tableau ? '1px solid #E8ECF4' : 'none', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                          {sec.contenu}
                        </div>
                      )}
                      {sec.tableau && (
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                            <thead>
                              <tr>
                                {sec.tableau.headers.map((h, i) => (
                                  <th key={i} style={{ padding: '7px 10px', background: `${cfg.color}10`, color: cfg.color, fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'left', borderBottom: `2px solid ${cfg.color}30`, whiteSpace: 'nowrap' }}>
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {sec.tableau.rows.map((row, ri) => (
                                <tr key={ri} style={{ background: ri % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                                  {row.map((cell, ci) => (
                                    <td key={ci} style={{ padding: '6px 10px', borderBottom: '1px solid #F1F5F9', fontSize: 11, color: '#334155', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {cell}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function PlanifierRapportCSE({ onClose }: { onClose: () => void }) {
  const store   = useProjectStore();
  const projets = store.projets ?? [];

  /* ─── State ─────────────────────────────────────────────────────────── */
  const [view,         setView]         = useState<View>('config');
  const [search,       setSearch]       = useState('');
  const [domFilter,    setDomFilter]    = useState<string>('tous');
  const [selected,     setSelected]     = useState<Set<string>>(new Set());
  const [annee,        setAnnee]        = useState(new Date().getFullYear());
  const [trimestre,    setTrimestre]    = useState<Trimestre>('T2');
  const [dateDebut,    setDateDebut]    = useState('');
  const [dateFin,      setDateFin]      = useState('');
  const [format,       setFormat]       = useState<Format>('excel');
  const [indics,       setIndics]       = useState<Set<string>>(new Set(DEFAULT_INDICS));
  const [showIndics,   setShowIndics]   = useState(false);
  const [sections,     setSections]     = useState<SectionId[]>([...DEFAULT_SECTIONS]);
  const [showSections, setShowSections] = useState(true);
  const [generating,   setGenerating]   = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (view === 'config') searchRef.current?.focus(); }, [view]);

  /* ─── Données dérivées ───────────────────────────────────────────────── */
  const domainesDispo = useMemo(() => {
    const s = new Set(projets.map(p => p.domaine).filter(Boolean)) as Set<Domaine>;
    return Array.from(s);
  }, [projets]);

  const listeFiltree = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projets.filter(p => {
      if (domFilter !== 'tous' && p.domaine !== domFilter) return false;
      if (!q) return true;
      return (
        p.nom?.toLowerCase().includes(q) ||
        p.code?.toLowerCase().includes(q) ||
        p.chefProjet?.toLowerCase().includes(q)
      );
    });
  }, [projets, domFilter, search]);

  const selectedProjets = useMemo(
    () => projets.filter(p => selected.has(p.id)),
    [projets, selected]
  );

  const periodeLabel = useMemo(() => {
    if (trimestre === 'custom') return dateDebut && dateFin ? `${dateDebut} → ${dateFin}` : 'Période personnalisée';
    if (trimestre === 'annuel') return `Annuel ${annee}`;
    return `${trimestre} ${annee}`;
  }, [trimestre, annee, dateDebut, dateFin]);

  const canGenerate = selected.size > 0 && sections.length > 0;

  /* ─── Handlers ───────────────────────────────────────────────────────── */
  const toggle      = (id: string) => setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const selectAll   = () => setSelected(prev => { const s = new Set(prev); listeFiltree.forEach(p => s.add(p.id)); return s; });
  const clearAll    = () => setSelected(new Set());
  const toggleIndic = (id: string) => setIndics(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const removeSection = (id: SectionId) => setSections(prev => prev.filter(s => s !== id));

  /* ─── Génération ─────────────────────────────────────────────────────── */
  async function generer() {
    if (selected.size === 0 || generating) return;
    setGenerating(true);
    const titre = `Rapport CSE — ${periodeLabel}`;
    const inclut = (id: string) => indics.has(id);

    try {
      if (format === 'word') {
        const wordSections: SectionDocx[] = sections.map(id =>
          buildSectionsWord(id, selectedProjets, periodeLabel, indics)
        );
        const meta: MetaRapport = {
          titre,
          soustitre: `${selectedProjets.length} projet(s) — SENELEC · Direction Principale Équipement`,
          auteur: 'SIGEP-DPE',
          date: new Date().toLocaleDateString('fr-FR'),
          confidentiel: true,
        };
        await exportRapportWord(wordSections, meta);

      } else if (format === 'excel') {
        const headers = ['Code', 'Projet', 'Domaine'];
        if (inclut('chef_projet'))         headers.push('Chef de projet');
        if (inclut('statut_global'))       headers.push('Statut');
        if (inclut('budget_global'))       headers.push('Budget (M FCFA)');
        if (inclut('budget_engage'))       headers.push('Engagé (M FCFA)');
        if (inclut('budget_decaisse'))     headers.push('Décaissé (M FCFA)');
        if (inclut('taux_engagement'))     headers.push('Tx Eng. %');
        if (inclut('taux_decaissement'))   headers.push('Tx Déc. %');
        if (inclut('avancement_physique')) headers.push('Av. physique %');
        if (inclut('cpi'))                 headers.push('CPI');
        if (inclut('spi'))                 headers.push('SPI');
        if (inclut('date_debut'))          headers.push('Démarrage');
        if (inclut('date_fin_prevue'))     headers.push('Fin prév.');
        if (inclut('date_fin_maj'))        headers.push('Fin actualisée');
        if (sections.includes('fiches'))  {
          headers.push('Problèmes', 'Risques', 'Décisions', 'Commentaires');
        }

        const rows = selectedProjets.map(p => {
          const pe = extProjet(p);
          const r: (string | number)[] = [p.code ?? '', p.nom, p.domaine ?? ''];
          if (inclut('chef_projet'))         r.push(p.chefProjet ?? '');
          if (inclut('statut_global'))       r.push(p.statut ?? '');
          if (inclut('budget_global'))       r.push(p.budget ?? 0);
          if (inclut('budget_engage'))       r.push(p.budgetEngage ?? 0);
          if (inclut('budget_decaisse'))     r.push(p.budgetDecaisse ?? 0);
          if (inclut('taux_engagement'))     r.push(p.budget ? Math.round((p.budgetEngage ?? 0) / p.budget * 100) : 0);
          if (inclut('taux_decaissement'))   r.push(p.budget ? Math.round((p.budgetDecaisse ?? 0) / p.budget * 100) : 0);
          if (inclut('avancement_physique')) r.push(p.avancement ?? 0);
          if (inclut('cpi'))                 r.push(+(p.cpi ?? 1).toFixed(2));
          if (inclut('spi'))                 r.push(+(p.spi ?? 1).toFixed(2));
          if (inclut('date_debut'))          r.push(p.dateDebut ?? '');
          if (inclut('date_fin_prevue'))     r.push(p.dateFinPrevue ?? '');
          if (inclut('date_fin_maj'))        r.push(p.dateFinEstimee ?? '');
          if (sections.includes('fiches')) {
            r.push(pe.problemes || '', pe.risques || '', pe.decisions || '', pe.commentaires || '');
          }
          return r;
        });

        downloadExcel(`Rapport_CSE_${periodeLabel.replace(/[\s→]/g, '_')}`, {
          sheetName: 'Rapport CSE',
          title: titre,
          subtitle: `SENELEC · DPE — ${selectedProjets.length} projet(s) consolidé(s)`,
          headers,
          rows,
        });

      } else {
        const pdfHdr = ['Code', 'Projet', 'Domaine'];
        if (inclut('statut_global'))       pdfHdr.push('Statut');
        if (inclut('budget_global'))       pdfHdr.push('Budget (M FCFA)');
        if (inclut('taux_decaissement'))   pdfHdr.push('Tx Déc.');
        if (inclut('avancement_physique')) pdfHdr.push('Av. phys.');
        if (inclut('date_fin_prevue'))     pdfHdr.push('Fin prév.');

        const rows = selectedProjets.map(p => {
          const r: string[] = [p.code ?? '', p.nom.slice(0, 45), p.domaine ?? ''];
          if (inclut('statut_global'))       r.push(p.statut ?? '—');
          if (inclut('budget_global'))       r.push(`${fmtN(p.budget ?? 0)} M`);
          if (inclut('taux_decaissement'))   r.push(p.budget ? fmtPct((p.budgetDecaisse ?? 0) / p.budget * 100) : '—');
          if (inclut('avancement_physique')) r.push(fmtPct(p.avancement ?? 0));
          if (inclut('date_fin_prevue'))     r.push(p.dateFinPrevue ?? '—');
          return r;
        });

        printBranded({
          title: titre,
          subtitle: `${selectedProjets.length} projets — ${periodeLabel}`,
          confidentiel: true,
          landscape: true,
          tables: [{ title: 'Tableau consolidé', headers: pdfHdr, rows, rightAlign: [4, 5, 6] }],
        });
      }

      onClose();
    } finally {
      setGenerating(false);
    }
  }

  /* ─── Render ─────────────────────────────────────────────────────────── */
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(15,10,30,0.6)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div style={{
        background: '#fff', borderRadius: 20,
        width: '100%', maxWidth: view === 'preview' ? 820 : 960,
        maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 40px 100px rgba(0,0,0,0.35)', overflow: 'hidden',
        transition: 'max-width 0.2s ease',
      }}>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div style={{ background: NAVY, padding: '16px 24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {view === 'preview' && (
              <button onClick={() => setView('config')}
                style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600 }}>
                <ArrowLeft size={13} /> Config.
              </button>
            )}
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>
                {view === 'preview' ? `Prévisualisation — ${periodeLabel}` : 'Rapport consolidé CSE'}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                {view === 'preview'
                  ? `${selectedProjets.length} projet(s) · ${sections.length} section(s) — vérifiez avant export`
                  : 'Comité de Suivi et d\'Évaluation · projets, période, structure et export'}
              </div>
            </div>
          </div>
          <button onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer', color: '#fff', display: 'flex' }}>
            <X size={17} />
          </button>
        </div>

        {/* ── Corps ──────────────────────────────────────────────────── */}
        {view === 'preview' ? (
          /* ════ MODE PRÉVISUALISATION ════════════════════════════════════ */
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
            <PreviewDocument
              sections={sections}
              projets={selectedProjets}
              periodeLabel={periodeLabel}
              indics={indics}
            />
          </div>
        ) : (
          /* ════ MODE CONFIG — 2 colonnes ════════════════════════════════ */
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

            {/* ════ COLONNE GAUCHE — Projets ══════════════════════════════ */}
            <div style={{ width: '52%', borderRight: '1px solid #E8ECF4', display: 'flex', flexDirection: 'column' }}>

              <div style={{ padding: '14px 20px 10px', borderBottom: '1px solid #E8ECF4', flexShrink: 0 }}>
                <Label>Projets à consolider</Label>

                <div style={{ position: 'relative', marginBottom: 10 }}>
                  <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
                  <input
                    ref={searchRef}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Nom, code, chef de projet…"
                    style={{ width: '100%', padding: '9px 12px 9px 34px', border: '1.5px solid #E2E8F0', borderRadius: 10, fontSize: 13, fontFamily: 'inherit', color: '#1E293B', outline: 'none', boxSizing: 'border-box' }}
                    onFocus={e => (e.currentTarget.style.borderColor = NAVY)}
                    onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')}
                  />
                </div>

                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {(['tous', ...domainesDispo] as string[]).map(d => {
                    const cfg = d !== 'tous' ? (DOMAINE_CFG[d as Domaine] ?? { label: d, color: '#64748B' }) : null;
                    const act = domFilter === d;
                    return (
                      <button key={d} onClick={() => setDomFilter(d)}
                        style={{ padding: '4px 11px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${act ? (cfg?.color ?? NAVY) : '#E2E8F0'}`, background: act ? (cfg?.color ?? NAVY) : '#fff', color: act ? '#fff' : '#64748B', transition: 'all 0.12s' }}>
                        {d === 'tous' ? 'Tous' : (cfg?.label ?? d)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ padding: '7px 20px', background: '#FAFBFD', borderBottom: '1px solid #E8ECF4', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                <span style={{ fontSize: 11.5, color: '#64748B' }}>
                  <strong style={{ color: NAVY }}>{listeFiltree.length}</strong> trouvé(s)
                  {selected.size > 0 && <> · <strong style={{ color: ORANGE }}>{selected.size} sél.</strong></>}
                </span>
                <div style={{ flex: 1 }} />
                <button onClick={selectAll} style={linkBtnStyle(NAVY)}>Tout sél.</button>
                {selected.size > 0 && <>
                  <span style={{ color: '#CBD5E1' }}>·</span>
                  <button onClick={clearAll} style={linkBtnStyle('#DC2626')}>Effacer</button>
                </>}
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
                {listeFiltree.length === 0 ? (
                  <div style={{ padding: 32, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>Aucun projet</div>
                ) : listeFiltree.map(p => {
                  const cfg = DOMAINE_CFG[p.domaine as Domaine] ?? { color: '#64748B', label: p.domaine ?? '' };
                  const sel = selected.has(p.id);
                  return (
                    <div key={p.id} onClick={() => toggle(p.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', cursor: 'pointer', background: sel ? `${NAVY}08` : 'transparent', borderLeft: `3px solid ${sel ? NAVY : 'transparent'}`, transition: 'all 0.1s' }}
                      onMouseEnter={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = '#F8FAFC'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = sel ? `${NAVY}08` : 'transparent'; }}
                    >
                      <div style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, border: `2px solid ${sel ? NAVY : '#CBD5E1'}`, background: sel ? NAVY : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.1s' }}>
                        {sel && <Check size={11} color="#fff" strokeWidth={3} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: sel ? 700 : 500, color: '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nom}</div>
                        <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{p.code} · {p.chefProjet}</div>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, flexShrink: 0, color: cfg.color, background: `${cfg.color}14`, padding: '2px 8px', borderRadius: 20 }}>{cfg.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ════ COLONNE DROITE — Config ═══════════════════════════════ */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>

              {/* Projets sélectionnés */}
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #E8ECF4', flexShrink: 0 }}>
                <Label>Sélection</Label>
                {selected.size === 0 ? (
                  <div style={{ fontSize: 12, color: '#CBD5E1', fontStyle: 'italic' }}>Aucun projet sélectionné</div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {selectedProjets.slice(0, 5).map(p => (
                      <div key={p.id} onClick={() => toggle(p.id)} title={p.nom}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 20, cursor: 'pointer', background: `${NAVY}10`, border: `1px solid ${NAVY}25`, fontSize: 11, fontWeight: 600, color: NAVY, maxWidth: 140, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.code ?? p.nom}</span>
                        <X size={9} style={{ flexShrink: 0 }} />
                      </div>
                    ))}
                    {selected.size > 5 && (
                      <div style={{ padding: '3px 9px', borderRadius: 20, background: '#F1F5F9', fontSize: 11, fontWeight: 600, color: '#64748B' }}>+{selected.size - 5} autres</div>
                    )}
                  </div>
                )}
              </div>

              {/* Période */}
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #E8ECF4', flexShrink: 0 }}>
                <Label>Période</Label>
                <div style={{ display: 'flex', gap: 7, alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 11.5, color: '#64748B', fontWeight: 600, minWidth: 38 }}>Année</span>
                  {[annee - 1, annee, annee + 1].map(a => (
                    <button key={a} onClick={() => setAnnee(a)}
                      style={{ padding: '4px 12px', borderRadius: 7, border: `1.5px solid ${annee === a ? NAVY : '#E2E8F0'}`, background: annee === a ? NAVY : '#fff', color: annee === a ? '#fff' : '#475569', fontSize: 12.5, fontWeight: annee === a ? 700 : 400, cursor: 'pointer' }}>
                      {a}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
                  {TRIMESTRES.map(t => (
                    <button key={t.value} onClick={() => setTrimestre(t.value)}
                      style={{ padding: '6px 4px', borderRadius: 7, border: `1.5px solid ${trimestre === t.value ? ORANGE : '#E2E8F0'}`, background: trimestre === t.value ? `${ORANGE}10` : '#fff', color: trimestre === t.value ? ORANGE : '#475569', fontSize: 11, fontWeight: trimestre === t.value ? 700 : 400, cursor: 'pointer', textAlign: 'center', lineHeight: 1.3 }}>
                      <div style={{ fontWeight: 700 }}>{t.short}</div>
                      <div style={{ fontSize: 9.5, color: trimestre === t.value ? `${ORANGE}CC` : '#94A3B8', marginTop: 1 }}>{t.label.split('—')[1]?.trim()}</div>
                    </button>
                  ))}
                </div>
                {trimestre === 'custom' && (
                  <div style={{ display: 'flex', gap: 7, marginTop: 9 }}>
                    {(['Du', 'Au'] as const).map((lbl, i) => (
                      <div key={lbl} style={{ flex: 1 }}>
                        <label style={{ fontSize: 11, color: '#64748B', fontWeight: 600, display: 'block', marginBottom: 3 }}>{lbl}</label>
                        <input type="date" value={i === 0 ? dateDebut : dateFin} onChange={e => i === 0 ? setDateDebut(e.target.value) : setDateFin(e.target.value)}
                          style={{ width: '100%', padding: '6px 8px', border: '1.5px solid #E2E8F0', borderRadius: 7, fontSize: 12, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Structure du rapport */}
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #E8ECF4', flexShrink: 0 }}>
                <button onClick={() => setShowSections(v => !v)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: showSections ? 10 : 0 }}>
                  <Label style={{ margin: 0 }}>Structure du rapport</Label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, background: `${NAVY}10`, color: NAVY, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>{sections.length} section(s)</span>
                    {showSections ? <ChevronUp size={13} color="#94A3B8" /> : <ChevronDown size={13} color="#94A3B8" />}
                  </div>
                </button>

                {showSections && (<>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
                    {MODELES_RAPPORT.map(m => (
                      <button key={m.label} onClick={() => setSections([...m.sections])}
                        style={{ padding: '3px 9px', borderRadius: 20, border: '1.5px solid #E2E8F0', background: '#fff', fontSize: 10.5, fontWeight: 600, color: '#64748B', cursor: 'pointer' }}>
                        {m.label}
                      </button>
                    ))}
                  </div>

                  {sections.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#CBD5E1', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 5 }}>Sections incluses — dans l&apos;ordre</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {sections.map((sid, idx) => {
                          const cfg = SECTIONS_CATALOGUE.find(s => s.id === sid)!;
                          return (
                            <div key={sid} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, background: '#F8FAFC', border: '1px solid #E8ECF4' }}>
                              <span style={{ fontSize: 10, color: '#CBD5E1', fontWeight: 700, minWidth: 16, textAlign: 'right' }}>{idx + 1}</span>
                              <div style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
                              <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: '#1E293B' }}>{cfg.label}</span>
                              <span style={{ fontSize: 10, color: '#94A3B8' }}>{cfg.desc}</span>
                              <button onClick={() => removeSection(sid)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CBD5E1', display: 'flex', padding: 2 }}
                                onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
                                onMouseLeave={e => (e.currentTarget.style.color = '#CBD5E1')}>
                                <X size={12} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div style={{ fontSize: 10, fontWeight: 700, color: '#CBD5E1', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Ajouter une section</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {SECTIONS_CATALOGUE.filter(s => !sections.includes(s.id)).map(s => (
                      <button key={s.id} onClick={() => setSections(prev => [...prev, s.id])}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, border: `1.5px solid ${s.color}30`, background: `${s.color}08`, fontSize: 11, fontWeight: 600, color: s.color, cursor: 'pointer' }}
                        onMouseEnter={e => (e.currentTarget.style.background = `${s.color}18`)}
                        onMouseLeave={e => (e.currentTarget.style.background = `${s.color}08`)}>
                        + {s.label}
                      </button>
                    ))}
                    {SECTIONS_CATALOGUE.every(s => sections.includes(s.id)) && (
                      <span style={{ fontSize: 11, color: '#CBD5E1', fontStyle: 'italic' }}>Toutes les sections sont ajoutées</span>
                    )}
                  </div>
                </>)}
              </div>

              {/* Indicateurs */}
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #E8ECF4', flexShrink: 0 }}>
                <button onClick={() => setShowIndics(v => !v)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: showIndics ? 10 : 0 }}>
                  <Label style={{ margin: 0 }}>Indicateurs à inclure</Label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, background: `${NAVY}10`, color: NAVY, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>{indics.size} sél.</span>
                    {showIndics ? <ChevronUp size={13} color="#94A3B8" /> : <ChevronDown size={13} color="#94A3B8" />}
                  </div>
                </button>
                {showIndics && (
                  <div>
                    {INDIC_GROUPS.map(g => (
                      <div key={g.label} style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 9.5, fontWeight: 700, color: '#CBD5E1', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 5 }}>{g.label}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {g.items.map(ind => {
                            const on = indics.has(ind.id);
                            return (
                              <button key={ind.id} onClick={() => toggleIndic(ind.id)}
                                style={{ padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: on ? 600 : 400, cursor: 'pointer', border: `1.5px solid ${on ? NAVY : '#E2E8F0'}`, background: on ? NAVY : '#fff', color: on ? '#fff' : '#64748B', transition: 'all 0.12s' }}>
                                {ind.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Format */}
              <div style={{ padding: '14px 20px', flexShrink: 0 }}>
                <Label>Format d&apos;export</Label>
                <div style={{ display: 'flex', gap: 7 }}>
                  {([
                    { value: 'excel', icon: <FileSpreadsheet size={18} />, label: 'Excel',  sub: 'Tableau analysable' },
                    { value: 'word',  icon: <FileText size={18} />,        label: 'Word',   sub: 'Rapport structuré .docx' },
                    { value: 'pdf',   icon: <LayoutList size={18} />,      label: 'PDF',    sub: 'Impression DPE' },
                  ] as { value: Format; icon: React.ReactNode; label: string; sub: string }[]).map(f => (
                    <button key={f.value} onClick={() => setFormat(f.value)}
                      style={{ flex: 1, padding: '10px 10px', borderRadius: 10, cursor: 'pointer', textAlign: 'left', border: `2px solid ${format === f.value ? NAVY : '#E2E8F0'}`, background: format === f.value ? LIGHT : '#fff', transition: 'all 0.12s' }}>
                      <div style={{ color: format === f.value ? NAVY : '#94A3B8', marginBottom: 5 }}>{f.icon}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: format === f.value ? NAVY : '#334155' }}>{f.label}</div>
                      <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>{f.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <div style={{ padding: '13px 24px', borderTop: '1px solid #E8ECF4', background: '#FAFBFD', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexShrink: 0 }}>
          <div style={{ fontSize: 12, color: '#64748B' }}>
            {!canGenerate ? (
              <span style={{ color: '#CBD5E1', fontStyle: 'italic' }}>
                {selected.size === 0 ? 'Sélectionnez au moins un projet' : 'Ajoutez au moins une section'}
              </span>
            ) : (
              <>
                <strong style={{ color: NAVY }}>{selected.size}</strong> projet(s) ·{' '}
                <span style={{ color: ORANGE, fontWeight: 600 }}>{periodeLabel}</span> ·{' '}
                {sections.length} section(s) · {format.toUpperCase()}
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose}
              style={{ padding: '8px 16px', borderRadius: 9, border: '1.5px solid #E2E8F0', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#475569' }}>
              Annuler
            </button>
            {view === 'config' && (
              <button onClick={() => setView('preview')} disabled={!canGenerate}
                style={{ padding: '8px 16px', borderRadius: 9, border: `1.5px solid ${canGenerate ? TEAL : '#E2E8F0'}`, background: canGenerate ? `${TEAL}0E` : '#fff', fontSize: 13, fontWeight: 600, cursor: canGenerate ? 'pointer' : 'not-allowed', color: canGenerate ? TEAL : '#CBD5E1', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s' }}>
                <Eye size={14} /> Prévisualiser
              </button>
            )}
            <button onClick={generer} disabled={!canGenerate || generating}
              style={{ padding: '8px 20px', borderRadius: 9, border: 'none', fontSize: 13, fontWeight: 700, cursor: canGenerate && !generating ? 'pointer' : 'not-allowed', background: canGenerate ? ORANGE : '#E2E8F0', color: canGenerate ? '#fff' : '#94A3B8', display: 'flex', alignItems: 'center', gap: 7, transition: 'all 0.15s', minWidth: 160, justifyContent: 'center' }}>
              {generating ? (
                <><span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Génération…</>
              ) : (
                <><Download size={14} /> {view === 'preview' ? `Exporter (${format.toUpperCase()})` : 'Générer le rapport'}</>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

/* ─── Composants locaux ──────────────────────────────────────────────────── */
function Label({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ fontSize: 10.5, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10, ...style }}>
      {children}
    </div>
  );
}

function linkBtnStyle(color: string): React.CSSProperties {
  return { background: 'none', border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 600, color, padding: 0 };
}
