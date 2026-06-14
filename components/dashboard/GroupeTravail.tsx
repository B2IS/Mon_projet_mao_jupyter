'use client';

import React, { useState } from 'react';
import {
  Users, CheckCircle2, Clock, Circle, ChevronRight,
  TrendingUp, Calendar, AlertCircle, User, Layers,
  BarChart3, Flag, BookOpen, Lightbulb, Database, Settings2,
} from 'lucide-react';

// ─── Design tokens ────────────────────────────────────────────────────────────
const NAVY   = '#1B4F8A';
const ORANGE = '#F47920';
const PURPLE = '#6B21A8';
const INK    = '#0F172A';
const MUT    = '#64748B';
const BORDER = '#E2E8F0';

// ─── Types ────────────────────────────────────────────────────────────────────
type Statut = 'realise' | 'en_cours' | 'prevu' | 'a_venir';

interface Livrable {
  titre: string;
  statut: Statut;
  avancement: number; // 0-100
  note?: string;
}

interface Etape {
  id: number;
  label: string;
  periode: string;
  version: string;
  couleur: string;
  bg: string;
  livrables: Livrable[];
}

interface Groupe {
  id: string;
  nom: string;
  theme: string;
  chef: string;
  pc: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  couleur: string;
  etapes: Etape[];
}

// ─── Statut config ────────────────────────────────────────────────────────────
const STATUT_CFG: Record<Statut, { label: string; c: string; bg: string; border: string; icon: React.ComponentType<{ size?: number; color?: string }> }> = {
  realise:  { label: 'Réalisé',  c: '#15803D', bg: '#DCFCE7', border: '#86EFAC', icon: CheckCircle2 },
  en_cours: { label: 'En cours', c: '#C2410C', bg: '#FED7AA', border: '#FB923C', icon: Clock        },
  prevu:    { label: 'Prévu',    c: '#92400E', bg: '#FEF3C7', border: '#FCD34D', icon: Calendar     },
  a_venir:  { label: 'À venir',  c: '#475569', bg: '#F1F5F9', border: '#CBD5E1', icon: Circle       },
};

// ─── Data ─────────────────────────────────────────────────────────────────────
const GROUPES: Groupe[] = [
  {
    id: 'G1',
    nom: 'PROCESSUS',
    theme: 'Cartographie & optimisation des processus DPE',
    chef: 'Margot R. LY',
    pc: 'Pape Alioune DIOP',
    icon: Settings2,
    couleur: '#1B4F8A',
    etapes: [
      {
        id: 1, label: 'Alignement & Diag', periode: 'Mar – Avr 2026', version: 'V1 Quick Wins',
        couleur: PURPLE, bg: '#F5F3FF',
        livrables: [
          { titre: 'Cartographie processus DPE (as-is)', statut: 'realise', avancement: 100, note: 'Validé comité DPE — 14 mars 2026' },
          { titre: 'Identification des quick wins', statut: 'realise', avancement: 100 },
          { titre: "Plan d’actions prioritaires", statut: 'realise', avancement: 100 },
        ],
      },
      {
        id: 2, label: 'Structuration & Digit.', periode: 'Avr – Juin 2026', version: 'V2 Projets Structurants',
        couleur: ORANGE, bg: '#FFF7ED',
        livrables: [
          { titre: 'Optimisation processus (to-be)', statut: 'en_cours', avancement: 65, note: 'Atelier du 28 mai 2026' },
          { titre: 'Digitalisation flux SIGEPP-DPE', statut: 'en_cours', avancement: 40 },
          { titre: 'Procédures et modes opératoires', statut: 'prevu', avancement: 0 },
        ],
      },
      {
        id: 3, label: 'Généralisation & Ancrage', periode: 'Juin – Déc 2026', version: 'V3 Appropriation',
        couleur: '#059669', bg: '#F0FDF4',
        livrables: [
          { titre: 'Généralisation SIGEPP à tous les services', statut: 'a_venir', avancement: 0 },
          { titre: 'Certification des nouveaux processus', statut: 'a_venir', avancement: 0 },
          { titre: 'Tableau de bord gouvernance processus', statut: 'a_venir', avancement: 0 },
        ],
      },
    ],
  },
  {
    id: 'G2',
    nom: 'OUTILS',
    theme: 'Déploiement et intégration des outils numériques',
    chef: 'Mame N. DIOUF',
    pc: 'Yandé NDIAYE',
    icon: Layers,
    couleur: '#7C3AED',
    etapes: [
      {
        id: 1, label: 'Alignement & Diag', periode: 'Mar – Avr 2026', version: 'V1 Quick Wins',
        couleur: PURPLE, bg: '#F5F3FF',
        livrables: [
          { titre: 'Audit outils & systèmes existants', statut: 'realise', avancement: 100 },
          { titre: 'Cartographie des besoins numériques', statut: 'realise', avancement: 100 },
          { titre: 'Sélection SIGEPP-DPE (cahier des charges)', statut: 'realise', avancement: 100, note: 'Validé DPE' },
        ],
      },
      {
        id: 2, label: 'Structuration & Digit.', periode: 'Avr – Juin 2026', version: 'V2 Projets Structurants',
        couleur: ORANGE, bg: '#FFF7ED',
        livrables: [
          { titre: 'Déploiement SIGEPP-DPE (modules cœur)', statut: 'en_cours', avancement: 75, note: 'Sprint 4/6 — juin 2026' },
          { titre: 'Formation administrateurs système', statut: 'en_cours', avancement: 50 },
          { titre: 'Interfaces ERP/Oracle/Sage (POC)', statut: 'prevu', avancement: 10 },
        ],
      },
      {
        id: 3, label: 'Généralisation & Ancrage', periode: 'Juin – Déc 2026', version: 'V3 Appropriation',
        couleur: '#059669', bg: '#F0FDF4',
        livrables: [
          { titre: 'Intégration ERP → SIGEPP complète', statut: 'a_venir', avancement: 0 },
          { titre: 'Migration données historiques validée', statut: 'a_venir', avancement: 0 },
          { titre: 'Certification ISO 27001 données DPE', statut: 'a_venir', avancement: 0 },
        ],
      },
    ],
  },
  {
    id: 'G3',
    nom: 'DONNÉES',
    theme: 'Gouvernance, qualité et migration des données DPE',
    chef: 'Mamadou CISSE',
    pc: 'Yandé NDIAYE',
    icon: Database,
    couleur: '#0891B2',
    etapes: [
      {
        id: 1, label: 'Alignement & Diag', periode: 'Mar – Avr 2026', version: 'V1 Quick Wins',
        couleur: PURPLE, bg: '#F5F3FF',
        livrables: [
          { titre: 'État des lieux données (inventaire)', statut: 'realise', avancement: 100 },
          { titre: 'Cartographie des flux de données DPE', statut: 'realise', avancement: 100 },
          { titre: 'Diagnostic qualité données existantes', statut: 'realise', avancement: 100, note: '3 784 anomalies détectées' },
        ],
      },
      {
        id: 2, label: 'Structuration & Digit.', periode: 'Avr – Juin 2026', version: 'V2 Projets Structurants',
        couleur: ORANGE, bg: '#FFF7ED',
        livrables: [
          { titre: 'Nettoyage et normalisation des données', statut: 'en_cours', avancement: 45, note: '1 702 enregistrements traités' },
          { titre: 'Politique de gouvernance des données', statut: 'prevu', avancement: 15 },
          { titre: 'Référentiel maître (MDM) DPE', statut: 'prevu', avancement: 0 },
        ],
      },
      {
        id: 3, label: 'Généralisation & Ancrage', periode: 'Juin – Déc 2026', version: 'V3 Appropriation',
        couleur: '#059669', bg: '#F0FDF4',
        livrables: [
          { titre: 'Migration complète vers SIGEPP', statut: 'a_venir', avancement: 0 },
          { titre: 'Tableau de bord qualité données', statut: 'a_venir', avancement: 0 },
          { titre: 'Rapport annuel gouvernance données', statut: 'a_venir', avancement: 0 },
        ],
      },
    ],
  },
  {
    id: 'G4',
    nom: 'ACCOMPAGNEMENT',
    theme: 'Conduite du changement & renforcement des capacités',
    chef: 'Babacar SOW',
    pc: 'Pape Alioune DIOP',
    icon: Lightbulb,
    couleur: '#D97706',
    etapes: [
      {
        id: 1, label: 'Alignement & Diag', periode: 'Mar – Avr 2026', version: 'V1 Quick Wins',
        couleur: PURPLE, bg: '#F5F3FF',
        livrables: [
          { titre: 'Analyse des parties prenantes (RACI)', statut: 'realise', avancement: 100 },
          { titre: 'Diagnostic des besoins en formation', statut: 'realise', avancement: 100 },
          { titre: 'Plan de communication transformation', statut: 'en_cours', avancement: 80, note: 'Validation direction attendue' },
        ],
      },
      {
        id: 2, label: 'Structuration & Digit.', periode: 'Avr – Juin 2026', version: 'V2 Projets Structurants',
        couleur: ORANGE, bg: '#FFF7ED',
        livrables: [
          { titre: 'Programme de formation SIGEPP (100+ agents)', statut: 'en_cours', avancement: 30, note: 'Vague 1 : 18 juin 2026' },
          { titre: 'Champions du changement désignés', statut: 'prevu', avancement: 0 },
          { titre: 'Ateliers de co-construction vision TO-BE', statut: 'prevu', avancement: 0 },
        ],
      },
      {
        id: 3, label: 'Généralisation & Ancrage', periode: 'Juin – Déc 2026', version: 'V3 Appropriation',
        couleur: '#059669', bg: '#F0FDF4',
        livrables: [
          { titre: 'Déploiement national formation SIGEPP', statut: 'a_venir', avancement: 0 },
          { titre: "Ancrage culturel & retour d'expérience", statut: 'a_venir', avancement: 0 },
          { titre: 'Évaluation impact transformation (T+6)', statut: 'a_venir', avancement: 0 },
        ],
      },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function globalAvancement(): number {
  let total = 0, count = 0;
  for (const g of GROUPES) for (const e of g.etapes) for (const l of e.livrables) { total += l.avancement; count++; }
  return Math.round(total / count);
}

function groupeAvancement(g: Groupe): number {
  let total = 0, count = 0;
  for (const e of g.etapes) for (const l of e.livrables) { total += l.avancement; count++; }
  return Math.round(total / count);
}

function etapeGlobalStatut(etapeId: number): Statut {
  const all: Statut[] = [];
  for (const g of GROUPES) {
    const e = g.etapes.find(et => et.id === etapeId);
    if (e) for (const l of e.livrables) all.push(l.statut);
  }
  if (all.every(s => s === 'realise')) return 'realise';
  if (all.some(s => s === 'en_cours' || s === 'realise')) return 'en_cours';
  if (all.some(s => s === 'prevu')) return 'prevu';
  return 'a_venir';
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatutPill({ statut }: { statut: Statut }) {
  const cfg = STATUT_CFG[statut];
  const Icon = cfg.icon;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 20, fontSize: 10.5, fontWeight: 700,
      color: cfg.c, background: cfg.bg, border: `1px solid ${cfg.border}`,
      letterSpacing: '0.03em', whiteSpace: 'nowrap',
    }}>
      <Icon size={10} color={cfg.c} />
      {cfg.label}
    </span>
  );
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ height: 4, borderRadius: 4, background: '#E2E8F0', overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.5s ease' }} />
    </div>
  );
}

function KpiCard({ label, value, sub, color, icon: Icon }: {
  label: string; value: string | number; sub?: string; color: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
}) {
  return (
    <div style={{
      background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14,
      padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 140,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ background: `${color}15`, borderRadius: 8, padding: 7, display: 'flex' }}>
          <Icon size={16} color={color} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: MUT, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: INK, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: MUT }}>{sub}</div>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function GroupeTravail() {
  const [selectedGroupe, setSelectedGroupe] = useState<string | null>(null);
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);
  const avancement = globalAvancement();

  const realisesCount = GROUPES.flatMap(g => g.etapes.flatMap(e => e.livrables)).filter(l => l.statut === 'realise').length;
  const enCoursCount  = GROUPES.flatMap(g => g.etapes.flatMap(e => e.livrables)).filter(l => l.statut === 'en_cours').length;
  const totalLivrables = GROUPES.flatMap(g => g.etapes.flatMap(e => e.livrables)).length;

  const filtered = selectedGroupe ? GROUPES.filter(g => g.id === selectedGroupe) : GROUPES;

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1400, margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{
        background: `linear-gradient(135deg, ${NAVY} 0%, #2563EB 60%, #7C3AED 100%)`,
        borderRadius: 18, padding: '28px 32px', marginBottom: 24, color: '#fff',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* decorative circles */}
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ position: 'absolute', bottom: -60, right: 120, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, position: 'relative' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: 8, display: 'flex' }}>
                <Users size={20} color="#fff" />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' }}>
                PROGRAMME TRANSFORMATION DPE
              </span>
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, lineHeight: 1.2, color: '#fff' }}>
              Groupes de Travail
            </h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.72)', marginTop: 6, marginBottom: 0 }}>
              Suivi de l'avancement des 4 groupes thématiques sur 3 étapes — Horizon 2026
            </p>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.12)', borderRadius: 14, padding: '14px 20px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 110,
          }}>
            <div style={{ fontSize: 36, fontWeight: 900, color: '#fff', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{avancement}%</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase' }}>Avancement global</div>
            <ProgressBar pct={avancement} color="rgba(255,255,255,0.9)" />
          </div>
        </div>

        {/* Phase timeline strip */}
        <div style={{ display: 'flex', gap: 8, marginTop: 20, position: 'relative' }}>
          {[
            { label: 'Étape 1', periode: 'Mar – Avr 2026', version: 'V1 Quick Wins', color: PURPLE, statut: etapeGlobalStatut(1) },
            { label: 'Étape 2', periode: 'Avr – Juin 2026', version: 'V2 Structurants', color: ORANGE, statut: etapeGlobalStatut(2) },
            { label: 'Étape 3', periode: 'Juin – Déc 2026', version: 'V3 Appropriation', color: '#059669', statut: etapeGlobalStatut(3) },
          ].map((ph, i) => (
            <div key={i} style={{
              flex: 1, background: 'rgba(255,255,255,0.12)', borderRadius: 10,
              padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: ph.color, flexShrink: 0, boxShadow: `0 0 0 3px ${ph.color}40` }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {ph.label}
                  <ChevronRight size={10} color="rgba(255,255,255,0.5)" />
                  <span style={{ fontWeight: 500, color: 'rgba(255,255,255,0.7)' }}>{ph.version}</span>
                </div>
                <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.55)', marginTop: 1 }}>{ph.periode}</div>
              </div>
              <div style={{ marginLeft: 'auto' }}>
                <StatutPill statut={ph.statut} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── KPI row ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <KpiCard label="Livrables réalisés"  value={`${realisesCount}/${totalLivrables}`} sub="Livrables complétés" color="#15803D" icon={CheckCircle2} />
        <KpiCard label="En cours"            value={enCoursCount}    sub="Livrables actifs"   color={ORANGE}          icon={Clock}        />
        <KpiCard label="Groupes de travail"  value={4}               sub="G1 · G2 · G3 · G4"  color={NAVY}            icon={Users}        />
        <KpiCard label="Jalons 2026"         value={3}               sub="Étapes planifiées"   color={PURPLE}          icon={Flag}         />
        <KpiCard label="Comité de pilotage"  value="PMO / DPE"       sub="PC: Pape A. DIOP & Yandé NDIAYE" color="#7C3AED" icon={BookOpen} />
      </div>

      {/* ── Groupe filter ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button
          onClick={() => setSelectedGroupe(null)}
          style={{
            padding: '7px 16px', borderRadius: 8, border: `1.5px solid ${selectedGroupe === null ? NAVY : BORDER}`,
            background: selectedGroupe === null ? NAVY : '#fff', color: selectedGroupe === null ? '#fff' : MUT,
            fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
          }}
        >
          Tous les groupes
        </button>
        {GROUPES.map(g => (
          <button
            key={g.id}
            onClick={() => setSelectedGroupe(selectedGroupe === g.id ? null : g.id)}
            style={{
              padding: '7px 16px', borderRadius: 8,
              border: `1.5px solid ${selectedGroupe === g.id ? g.couleur : BORDER}`,
              background: selectedGroupe === g.id ? g.couleur : '#fff',
              color: selectedGroupe === g.id ? '#fff' : INK,
              fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <span style={{
              width: 18, height: 18, borderRadius: '50%',
              background: selectedGroupe === g.id ? 'rgba(255,255,255,0.25)' : `${g.couleur}18`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, fontWeight: 900, color: selectedGroupe === g.id ? '#fff' : g.couleur,
            }}>
              {g.id}
            </span>
            {g.nom}
          </button>
        ))}
      </div>

      {/* ── Matrix ────────────────────────────────────────────────────────── */}
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 900 }}>
          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div /> {/* empty corner */}
            {GROUPES[0].etapes.map(e => (
              <div key={e.id} style={{
                background: `linear-gradient(135deg, ${e.couleur}15 0%, ${e.couleur}08 100%)`,
                border: `1.5px solid ${e.couleur}30`,
                borderRadius: 12, padding: '12px 16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: e.couleur, boxShadow: `0 0 0 3px ${e.couleur}25` }} />
                  <span style={{ fontSize: 13, fontWeight: 800, color: e.couleur }}>{e.label}</span>
                </div>
                <div style={{ fontSize: 11, color: MUT, marginTop: 3, marginLeft: 18 }}>{e.periode}</div>
                <div style={{
                  display: 'inline-block', marginTop: 6, marginLeft: 18,
                  padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                  background: `${e.couleur}18`, color: e.couleur, border: `1px solid ${e.couleur}30`,
                }}>
                  {e.version}
                </div>
              </div>
            ))}
          </div>

          {/* Rows */}
          {filtered.map(groupe => {
            const GIcon = groupe.icon;
            const gAv = groupeAvancement(groupe);
            return (
              <div key={groupe.id} style={{
                display: 'grid', gridTemplateColumns: '220px 1fr 1fr 1fr',
                gap: 8, marginBottom: 8,
              }}>
                {/* Row header */}
                <div style={{
                  background: '#fff', border: `1.5px solid ${groupe.couleur}35`,
                  borderLeft: `4px solid ${groupe.couleur}`,
                  borderRadius: 12, padding: '14px 16px',
                  display: 'flex', flexDirection: 'column', gap: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ background: `${groupe.couleur}15`, borderRadius: 8, padding: 6, display: 'flex', flexShrink: 0 }}>
                      <GIcon size={14} color={groupe.couleur} />
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: groupe.couleur, letterSpacing: '0.08em' }}>{groupe.id}</div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: INK, lineHeight: 1.2 }}>{groupe.nom}</div>
                    </div>
                  </div>

                  <div style={{ fontSize: 10.5, color: MUT, lineHeight: 1.4 }}>{groupe.theme}</div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <User size={10} color={groupe.couleur} />
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: INK }}>{groupe.chef}</span>
                    </div>
                    <div style={{ fontSize: 10, color: MUT, paddingLeft: 15 }}>PC: {groupe.pc}</div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 9.5, color: MUT, fontWeight: 600 }}>AVANCEMENT GLOBAL</span>
                      <span style={{ fontSize: 10, fontWeight: 800, color: groupe.couleur }}>{gAv}%</span>
                    </div>
                    <ProgressBar pct={gAv} color={groupe.couleur} />
                  </div>
                </div>

                {/* Étape cells */}
                {groupe.etapes.map(etape => {
                  const cellKey = `${groupe.id}-${etape.id}`;
                  const isHovered = hoveredCell === cellKey;
                  return (
                    <div
                      key={etape.id}
                      onMouseEnter={() => setHoveredCell(cellKey)}
                      onMouseLeave={() => setHoveredCell(null)}
                      style={{
                        background: isHovered ? etape.bg : '#fff',
                        border: `1.5px solid ${isHovered ? `${etape.couleur}40` : BORDER}`,
                        borderRadius: 12, padding: '12px 14px',
                        transition: 'all 0.18s ease',
                        cursor: 'default',
                      }}
                    >
                      {etape.livrables.map((livrable, li) => {
                        const cfg = STATUT_CFG[livrable.statut];
                        return (
                          <div key={li} style={{
                            marginBottom: li < etape.livrables.length - 1 ? 10 : 0,
                            paddingBottom: li < etape.livrables.length - 1 ? 10 : 0,
                            borderBottom: li < etape.livrables.length - 1 ? `1px dashed ${BORDER}` : 'none',
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6, marginBottom: 4 }}>
                              <span style={{ fontSize: 11, fontWeight: 600, color: INK, lineHeight: 1.35, flex: 1 }}>
                                {livrable.titre}
                              </span>
                              <StatutPill statut={livrable.statut} />
                            </div>

                            {livrable.avancement > 0 && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                <div style={{ flex: 1 }}>
                                  <ProgressBar pct={livrable.avancement} color={cfg.c} />
                                </div>
                                <span style={{ fontSize: 9.5, fontWeight: 700, color: cfg.c, fontVariantNumeric: 'tabular-nums' }}>
                                  {livrable.avancement}%
                                </span>
                              </div>
                            )}

                            {livrable.note && (
                              <div style={{
                                fontSize: 9.5, color: '#7C3AED', background: '#F5F3FF',
                                border: '1px solid #DDD6FE', borderRadius: 5,
                                padding: '3px 6px', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4,
                              }}>
                                <AlertCircle size={8} color="#7C3AED" />
                                {livrable.note}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Legend ───────────────────────────────────────────────────────── */}
      <div style={{
        marginTop: 24, background: '#fff', border: `1px solid ${BORDER}`,
        borderRadius: 12, padding: '12px 20px',
        display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: MUT, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Légende</span>
        {(Object.entries(STATUT_CFG) as [Statut, typeof STATUT_CFG[Statut]][]).map(([key, cfg]) => {
          const Icon = cfg.icon;
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                color: cfg.c, background: cfg.bg, border: `1px solid ${cfg.border}`,
              }}>
                <Icon size={10} color={cfg.c} />
                {cfg.label}
              </span>
            </div>
          );
        })}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: MUT }}>
          <TrendingUp size={12} color={MUT} />
          Mis à jour le 14 juin 2026 · SIGEPP-DPE
        </div>
      </div>
    </div>
  );
}
