'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts';
import {
  LayoutDashboard, TrendingUp, AlertTriangle, Activity, DollarSign,
  FolderKanban, BarChart3, PieChart as PieIcon, TrendingDown,
  Users, Flag, Clock, Gauge, ChevronUp, ChevronDown, X, Plus,
  Settings, Eye, Save, RotateCcw, ArrowLeftRight, Table,
  CheckCircle, BookOpen, Pencil,
} from 'lucide-react';
import { useProjectStore, DOMAINE_CFG } from '@/lib/projectStore';

// ─── Types ──────────────────────────────────────────────────────────────────

type WidgetCategory = 'KPIs' | 'Graphiques' | 'Tableaux' | 'Cartes';
type ColSpan = 1 | 2;

interface WidgetDef {
  id: string;
  name: string;
  description: string;
  category: WidgetCategory;
  icon: React.ElementType;
  defaultColSpan: ColSpan;
}

interface PlacedWidget {
  widgetId: string;
  colSpan: ColSpan;
}

// ─── Widget catalog ─────────────────────────────────────────────────────────

const WIDGET_CATALOG: WidgetDef[] = [
  // KPIs
  { id: 'budget-total',    name: 'Budget total portefeuille', description: 'Somme des budgets de tous les projets actifs', category: 'KPIs', icon: DollarSign,    defaultColSpan: 1 },
  { id: 'avancement-moy',  name: 'Avancement moyen',          description: 'Avancement moyen pondéré du portefeuille',    category: 'KPIs', icon: Activity,       defaultColSpan: 1 },
  { id: 'projets-retard',  name: 'Projets en retard',         description: 'Nombre de projets avec statut en_retard',     category: 'KPIs', icon: AlertTriangle,  defaultColSpan: 1 },
  { id: 'cpi-portfolio',   name: 'CPI portefeuille',          description: 'Indice de performance des coûts moyen',       category: 'KPIs', icon: Gauge,          defaultColSpan: 1 },
  { id: 'decaissement-pct',name: 'Décaissement (%)',          description: 'Taux de décaissement moyen du portefeuille',  category: 'KPIs', icon: TrendingUp,     defaultColSpan: 1 },
  { id: 'projets-actifs',  name: 'Projets actifs',            description: 'Nombre de projets en cours d\'exécution',     category: 'KPIs', icon: FolderKanban,   defaultColSpan: 1 },
  // Charts
  { id: 'avancement-bar',  name: 'Avancement par projet',     description: 'Graphique barres horizontal d\'avancement',   category: 'Graphiques', icon: BarChart3,  defaultColSpan: 2 },
  { id: 'scourbe-evm',     name: 'S-Courbe EVM',              description: 'Courbe PV / EV / AC sur la durée du projet',  category: 'Graphiques', icon: TrendingUp, defaultColSpan: 2 },
  { id: 'budget-domaines', name: 'Répartition budget domaines', description: 'Donut chart des budgets par domaine',       category: 'Graphiques', icon: PieIcon,    defaultColSpan: 1 },
  { id: 'cpi-spi-bar',     name: 'CPI/SPI par projet',        description: 'Barres groupées CPI et SPI par projet',      category: 'Graphiques', icon: BarChart3,  defaultColSpan: 2 },
  { id: 'charge-ressources',name: 'Charge des ressources',    description: 'Taux d\'occupation par ressource clé',        category: 'Graphiques', icon: Users,      defaultColSpan: 1 },
  { id: 'tendances',       name: 'Tendances avancement',      description: 'Courbe de progression dans le temps',         category: 'Graphiques', icon: TrendingUp, defaultColSpan: 2 },
  // Tables
  { id: 'tableau-projets', name: 'Tableau projets',           description: 'Liste complète des projets avec statuts',     category: 'Tableaux', icon: Table,       defaultColSpan: 2 },
  { id: 'jalons-prochains',name: 'Jalons prochains',          description: 'Prochains jalons à atteindre',                category: 'Tableaux', icon: Flag,        defaultColSpan: 1 },
  { id: 'alertes-critiques',name: 'Alertes critiques',        description: 'Projets en retard ou CPI < 0.9',             category: 'Tableaux', icon: AlertTriangle, defaultColSpan: 2 },
  { id: 'taches-retard',   name: 'Tâches en retard',          description: 'Tâches dépassant leur date de fin prévue',    category: 'Tableaux', icon: Clock,       defaultColSpan: 1 },
  // Cards
  { id: 'resume-direction',name: 'Résumé direction',          description: 'Synthèse textuelle par direction',            category: 'Cartes', icon: BookOpen,     defaultColSpan: 1 },
  { id: 'statut-portfolio',name: 'Statut portefeuille',       description: 'Feux RAG — Rouge / Amber / Vert',            category: 'Cartes', icon: CheckCircle,  defaultColSpan: 1 },
];

const DEFAULT_LAYOUT: PlacedWidget[] = [
  { widgetId: 'projets-actifs',   colSpan: 1 },
  { widgetId: 'avancement-moy',   colSpan: 1 },
  { widgetId: 'budget-total',     colSpan: 1 },
  { widgetId: 'projets-retard',   colSpan: 1 },
  { widgetId: 'avancement-bar',   colSpan: 2 },
  { widgetId: 'budget-domaines',  colSpan: 1 },
  { widgetId: 'scourbe-evm',      colSpan: 1 },
  { widgetId: 'alertes-critiques',colSpan: 2 },
];

const LS_KEY = 'senelec-dpe-dashboard-layout';
const LS_TITLE_KEY = 'senelec-dpe-dashboard-title';

const COLORS = ['#1B4F8A', '#F47920', '#16A34A', '#8B5CF6', '#EF3340', '#F59E0B'];

// ─── KPI Widget Renderer ────────────────────────────────────────────────────

function KpiCard({ widgetId, projets }: { widgetId: string; projets: ReturnType<typeof useProjectStore>['projets'] }) {
  const actifs = projets.filter(p => p.statut === 'en_cours' || p.statut === 'en_retard');
  const retard = projets.filter(p => p.statut === 'en_retard');
  const totalBudget = projets.reduce((s, p) => s + p.budget, 0);
  const avgAv = projets.length > 0 ? projets.reduce((s, p) => s + p.avancement, 0) / projets.length : 0;
  const avgCpi = projets.length > 0 ? projets.reduce((s, p) => s + p.cpi, 0) / projets.length : 0;
  const avgDecaissement = projets.length > 0
    ? projets.reduce((s, p) => s + (p.budget > 0 ? (p.budgetDecaisse / p.budget) * 100 : 0), 0) / projets.length
    : 0;

  const configs: Record<string, { label: string; value: string; sub: string; color: string; trend: 'up' | 'down' | 'neutral'; icon: React.ElementType }> = {
    'budget-total': {
      label: 'Budget total portefeuille',
      value: `${(totalBudget / 1000).toFixed(1)} Mrd FCFA`,
      sub: `${projets.length} projets`,
      color: '#1B4F8A', trend: 'up', icon: DollarSign,
    },
    'avancement-moy': {
      label: 'Avancement moyen',
      value: `${avgAv.toFixed(1)}%`,
      sub: `Planifié: ${(projets.reduce((s,p) => s + p.avancementPlanifie, 0) / Math.max(projets.length, 1)).toFixed(1)}%`,
      color: '#F47920', trend: avgAv > 50 ? 'up' : 'neutral', icon: Activity,
    },
    'projets-retard': {
      label: 'Projets en retard',
      value: String(retard.length),
      sub: `sur ${projets.length} projets`,
      color: '#EF3340', trend: 'down', icon: AlertTriangle,
    },
    'cpi-portfolio': {
      label: 'CPI portefeuille',
      value: avgCpi.toFixed(2),
      sub: avgCpi >= 1 ? 'Dans le budget' : 'Dépassement prévu',
      color: avgCpi >= 1 ? '#16A34A' : '#EF3340', trend: avgCpi >= 1 ? 'up' : 'down', icon: Gauge,
    },
    'decaissement-pct': {
      label: 'Décaissement (%)',
      value: `${avgDecaissement.toFixed(1)}%`,
      sub: `${(projets.reduce((s,p) => s + p.budgetDecaisse, 0) / 1000).toFixed(1)} Mrd décaissé`,
      color: '#8B5CF6', trend: 'up', icon: TrendingUp,
    },
    'projets-actifs': {
      label: 'Projets actifs',
      value: String(actifs.length),
      sub: `${projets.filter(p => p.statut === 'planifie').length} planifiés`,
      color: '#16A34A', trend: 'up', icon: FolderKanban,
    },
  };

  const cfg = configs[widgetId];
  if (!cfg) return null;
  const Icon = cfg.icon;
  const TrendIcon = cfg.trend === 'up' ? ChevronUp : cfg.trend === 'down' ? TrendingDown : Activity;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', padding: '4px 0' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
          background: `${cfg.color}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={18} style={{ color: cfg.color }} />
        </div>
        <span style={{
          display: 'flex', alignItems: 'center', gap: 3,
          fontSize: 10, fontWeight: 700,
          color: cfg.trend === 'up' ? '#16A34A' : cfg.trend === 'down' ? '#EF3340' : '#94A3B8',
          background: cfg.trend === 'up' ? '#DCFCE7' : cfg.trend === 'down' ? '#FEE2E2' : '#F1F5F9',
          padding: '2px 6px', borderRadius: 99,
        }}>
          <TrendIcon size={10} />
          {cfg.trend === 'up' ? 'Bon' : cfg.trend === 'down' ? 'Alerte' : 'Stable'}
        </span>
      </div>
      <div>
        <div style={{ fontSize: 26, fontWeight: 800, color: '#1E293B', lineHeight: 1, marginBottom: 4 }}>
          {cfg.value}
        </div>
        <div style={{ fontSize: 11, color: '#64748B', fontWeight: 500 }}>{cfg.label}</div>
        <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>{cfg.sub}</div>
      </div>
    </div>
  );
}

// ─── Chart Widget Renderer ──────────────────────────────────────────────────

function ChartWidget({ widgetId, projets }: { widgetId: string; projets: ReturnType<typeof useProjectStore>['projets'] }) {
  if (widgetId === 'avancement-bar') {
    const data = projets.slice(0, 8).map(p => ({
      name: p.code.replace('PRJ-', '').replace(/-\d{4}-\d{3}/, ''),
      reel: p.avancement,
      planifie: p.avancementPlanifie,
    }));
    return (
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={70} />
          <Tooltip formatter={(v: number) => [`${v}%`]} />
          <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
          <Bar dataKey="reel" name="Réel" fill="#F47920" radius={[0, 3, 3, 0]} />
          <Bar dataKey="planifie" name="Planifié" fill="#CBD5E1" radius={[0, 3, 3, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (widgetId === 'scourbe-evm') {
    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct'];
    const budget = projets.reduce((s, p) => s + p.budget, 0);
    const data = months.map((m, i) => {
      const pct = (i + 1) / months.length;
      return {
        mois: m,
        PV: Math.round(budget * pct * 0.9),
        EV: Math.round(budget * pct * 0.82),
        AC: Math.round(budget * pct * 0.88),
      };
    });
    return (
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="mois" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 9 }} tickFormatter={v => `${(v/1000).toFixed(0)}G`} />
          <Tooltip formatter={(v: number) => [`${v.toLocaleString('fr-FR')} MFCFA`]} />
          <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
          <Line type="monotone" dataKey="PV" name="Valeur Planifiée" stroke="#1B4F8A" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="EV" name="Valeur Acquise" stroke="#16A34A" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="AC" name="Coût Réel" stroke="#EF3340" strokeWidth={2} dot={false} strokeDasharray="5 5" />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (widgetId === 'budget-domaines') {
    const byDomaine: Record<string, number> = {};
    projets.forEach(p => {
      byDomaine[p.domaine] = (byDomaine[p.domaine] ?? 0) + p.budget;
    });
    const data = Object.entries(byDomaine).map(([key, val]) => ({
      name: DOMAINE_CFG[key as keyof typeof DOMAINE_CFG]?.label ?? key,
      value: val,
    }));
    return (
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} innerRadius={40}
            label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
            labelLine={false}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip formatter={(v: number) => [`${v.toLocaleString('fr-FR')} MFCFA`]} />
          <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (widgetId === 'cpi-spi-bar') {
    const data = projets.slice(0, 6).map(p => ({
      name: p.code.split('-')[2] ?? p.code,
      CPI: p.cpi,
      SPI: p.spi,
    }));
    return (
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis domain={[0.5, 1.2]} tick={{ fontSize: 10 }} />
          <Tooltip />
          <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
          <Bar dataKey="CPI" name="CPI" fill="#1B4F8A" radius={[3, 3, 0, 0]} />
          <Bar dataKey="SPI" name="SPI" fill="#F47920" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (widgetId === 'charge-ressources') {
    const data = [
      { nom: 'Fall I.', charge: 95 },
      { nom: 'Diallo M.', charge: 80 },
      { nom: 'Sy F.', charge: 70 },
      { nom: 'Ndiaye O.', charge: 60 },
      { nom: 'Ba A.', charge: 85 },
    ];
    return (
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
          <YAxis type="category" dataKey="nom" tick={{ fontSize: 10 }} width={60} />
          <Tooltip formatter={(v: number) => [`${v}%`]} />
          <Bar dataKey="charge" name="Charge" fill="#8B5CF6" radius={[0, 3, 3, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.charge > 90 ? '#EF3340' : d.charge > 75 ? '#F47920' : '#16A34A'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (widgetId === 'tendances') {
    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû'];
    const data = months.map((m, i) => ({
      mois: m,
      avancement: Math.min(100, 10 + i * 8),
    }));
    return (
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
          <defs>
            <linearGradient id="colorAv" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#F47920" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#F47920" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="mois" tick={{ fontSize: 10 }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
          <Tooltip formatter={(v: number) => [`${v}%`]} />
          <Area type="monotone" dataKey="avancement" name="Avancement" stroke="#F47920" strokeWidth={2} fill="url(#colorAv)" />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  return <div style={{ color: '#94A3B8', fontSize: 12, textAlign: 'center', padding: '40px 0' }}>Graphique non disponible</div>;
}

// ─── Table Widget Renderer ──────────────────────────────────────────────────

function TableWidget({ widgetId, projets }: { widgetId: string; projets: ReturnType<typeof useProjectStore>['projets'] }) {
  const thStyle: React.CSSProperties = {
    padding: '6px 10px', fontSize: 9.5, fontWeight: 700, color: '#64748B',
    textTransform: 'uppercase', letterSpacing: '0.06em',
    background: '#F8FAFC', borderBottom: '1px solid #E5E7EB', textAlign: 'left',
  };
  const tdStyle: React.CSSProperties = {
    padding: '7px 10px', fontSize: 11, color: '#374151', borderBottom: '1px solid #F3F4F6',
  };

  if (widgetId === 'tableau-projets') {
    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Code</th>
              <th style={thStyle}>Projet</th>
              <th style={thStyle}>Avancement</th>
              <th style={thStyle}>Budget</th>
              <th style={thStyle}>CPI</th>
              <th style={thStyle}>Statut</th>
            </tr>
          </thead>
          <tbody>
            {projets.slice(0, 6).map(p => {
              const STATUT: Record<string, { label: string; color: string }> = {
                en_cours: { label: 'En cours', color: '#F47920' },
                en_retard: { label: 'En retard', color: '#EF3340' },
                planifie: { label: 'Planifié', color: '#1B4F8A' },
                termine: { label: 'Terminé', color: '#16A34A' },
                suspendu: { label: 'Suspendu', color: '#6B7280' },
                archive: { label: 'Archivé', color: '#374151' },
              };
              const sc = STATUT[p.statut] ?? { label: p.statut, color: '#6B7280' };
              return (
                <tr key={p.id}>
                  <td style={{ ...tdStyle, fontWeight: 600, fontSize: 10, color: '#1B4F8A' }}>{p.code.split('-').slice(0,3).join('-')}</td>
                  <td style={{ ...tdStyle, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nom}</td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ flex: 1, height: 5, background: '#E5E7EB', borderRadius: 99 }}>
                        <div style={{ width: `${p.avancement}%`, height: '100%', background: '#F47920', borderRadius: 99 }} />
                      </div>
                      <span style={{ fontSize: 10, color: '#64748B', flexShrink: 0 }}>{p.avancement}%</span>
                    </div>
                  </td>
                  <td style={tdStyle}>{p.budget.toLocaleString('fr-FR')} MFCFA</td>
                  <td style={{ ...tdStyle, color: p.cpi >= 1 ? '#16A34A' : '#EF3340', fontWeight: 700 }}>{p.cpi.toFixed(2)}</td>
                  <td style={tdStyle}>
                    <span style={{
                      fontSize: 9.5, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
                      background: `${sc.color}18`, color: sc.color,
                    }}>{sc.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  if (widgetId === 'jalons-prochains') {
    const today = new Date();
    const jalons = projets.flatMap(p => p.jalons.map(j => ({ ...j, projetNom: p.nom, projetCode: p.code }))).
      filter(j => !j.atteint && new Date(j.date) >= today).
      sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).
      slice(0, 6);
    return (
      <div>
        {jalons.length === 0 && <div style={{ padding: '20px', textAlign: 'center', color: '#94A3B8', fontSize: 11 }}>Aucun jalon prochain</div>}
        {jalons.map((j, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid #F3F4F6' }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Flag size={14} style={{ color: '#F47920' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.label}</div>
              <div style={{ fontSize: 9.5, color: '#94A3B8' }}>{j.projetCode.split('-').slice(0,3).join('-')}</div>
            </div>
            <div style={{ fontSize: 10, color: '#64748B', flexShrink: 0 }}>{new Date(j.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</div>
          </div>
        ))}
      </div>
    );
  }

  if (widgetId === 'alertes-critiques') {
    const alertes = projets.filter(p => p.statut === 'en_retard' || p.cpi < 0.9);
    return (
      <div style={{ overflowX: 'auto' }}>
        {alertes.length === 0 && <div style={{ padding: '20px', textAlign: 'center', color: '#16A34A', fontSize: 11 }}>Aucune alerte critique</div>}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Projet</th>
              <th style={thStyle}>Type alerte</th>
              <th style={thStyle}>CPI</th>
              <th style={thStyle}>Avancement</th>
              <th style={thStyle}>Chef projet</th>
            </tr>
          </thead>
          <tbody>
            {alertes.map(p => (
              <tr key={p.id}>
                <td style={{ ...tdStyle, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{p.nom}</td>
                <td style={tdStyle}>
                  {p.statut === 'en_retard' && (
                    <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: '#FEE2E2', color: '#DC2626' }}>
                      Retard planning
                    </span>
                  )}
                  {p.cpi < 0.9 && p.statut !== 'en_retard' && (
                    <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: '#FFF7ED', color: '#EA580C' }}>
                      Dépassement coût
                    </span>
                  )}
                  {p.statut === 'en_retard' && p.cpi < 0.9 && (
                    <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 6px', borderRadius: 99, marginLeft: 4, background: '#FEE2E2', color: '#991B1B' }}>
                      Double alerte
                    </span>
                  )}
                </td>
                <td style={{ ...tdStyle, color: p.cpi < 0.9 ? '#EF3340' : '#16A34A', fontWeight: 700 }}>{p.cpi.toFixed(2)}</td>
                <td style={tdStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ flex: 1, height: 5, background: '#E5E7EB', borderRadius: 99 }}>
                      <div style={{ width: `${p.avancement}%`, height: '100%', background: p.avancement < p.avancementPlanifie ? '#EF3340' : '#16A34A', borderRadius: 99 }} />
                    </div>
                    <span style={{ fontSize: 10, color: '#64748B', flexShrink: 0 }}>{p.avancement}%</span>
                  </div>
                </td>
                <td style={tdStyle}>{p.chefProjet}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (widgetId === 'taches-retard') {
    const today = new Date().toISOString().split('T')[0];
    const tachesRetard = projets.flatMap(p =>
      p.taches
        .filter(t => t.dateFin < today && t.statutTache !== 'termine')
        .slice(0, 2)
        .map(t => ({ ...t, projetNom: p.nom }))
    ).slice(0, 6);
    return (
      <div>
        {tachesRetard.length === 0 && <div style={{ padding: '20px', textAlign: 'center', color: '#16A34A', fontSize: 11 }}>Aucune tâche en retard</div>}
        {tachesRetard.map((t, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid #F3F4F6' }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Clock size={14} style={{ color: '#EF3340' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.nom}</div>
              <div style={{ fontSize: 9.5, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.projetNom}</div>
            </div>
            <div style={{ fontSize: 9.5, color: '#EF3340', flexShrink: 0 }}>Fin: {new Date(t.dateFin).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</div>
          </div>
        ))}
      </div>
    );
  }

  return null;
}

// ─── Card Widget Renderer ───────────────────────────────────────────────────

function CardWidget({ widgetId, projets }: { widgetId: string; projets: ReturnType<typeof useProjectStore>['projets'] }) {
  if (widgetId === 'resume-direction') {
    const byDomaine: Record<string, { count: number; budget: number; avancement: number }> = {};
    projets.forEach(p => {
      if (!byDomaine[p.domaine]) byDomaine[p.domaine] = { count: 0, budget: 0, avancement: 0 };
      byDomaine[p.domaine].count++;
      byDomaine[p.domaine].budget += p.budget;
      byDomaine[p.domaine].avancement += p.avancement;
    });
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Object.entries(byDomaine).map(([domaine, stats]) => {
          const cfg = DOMAINE_CFG[domaine as keyof typeof DOMAINE_CFG];
          if (!cfg) return null;
          return (
            <div key={domaine} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px', borderRadius: 8,
              background: `${cfg.color}08`, border: `1px solid ${cfg.color}20`,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: `${cfg.color}18`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, flexShrink: 0,
              }}>
                {cfg.emoji}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#1E293B' }}>{cfg.label}</div>
                <div style={{ fontSize: 10, color: '#64748B' }}>
                  {stats.count} projet{stats.count > 1 ? 's' : ''} — {stats.budget.toLocaleString('fr-FR')} MFCFA
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: cfg.color }}>
                  {(stats.avancement / stats.count).toFixed(0)}%
                </div>
                <div style={{ fontSize: 9, color: '#94A3B8' }}>Av. moy.</div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (widgetId === 'statut-portfolio') {
    const retard = projets.filter(p => p.statut === 'en_retard' || p.cpi < 0.9);
    const attentionNeeded = projets.filter(p => p.spi < 0.9 && p.statut !== 'en_retard');
    const onTrack = projets.filter(p => p.cpi >= 0.9 && p.spi >= 0.9 && p.statut !== 'en_retard');
    const ragItems = [
      { label: 'En bonne voie', count: onTrack.length, color: '#16A34A', bg: '#F0FDF4', emoji: '🟢' },
      { label: 'Attention requise', count: attentionNeeded.length, color: '#F59E0B', bg: '#FFFBEB', emoji: '🟡' },
      { label: 'Action immédiate', count: retard.length, color: '#EF3340', bg: '#FEF2F2', emoji: '🔴' },
    ];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 4 }}>
          Statut portefeuille RAG — {projets.length} projets total
        </div>
        {ragItems.map(item => (
          <div key={item.label} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', borderRadius: 8, background: item.bg,
            border: `1px solid ${item.color}25`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>{item.emoji}</span>
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: '#1E293B' }}>{item.label}</div>
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: item.color }}>{item.count}</div>
          </div>
        ))}
      </div>
    );
  }

  return null;
}

// ─── Full Widget Renderer (View Mode) ──────────────────────────────────────

function WidgetRenderer({ widgetId, projets }: { widgetId: string; projets: ReturnType<typeof useProjectStore>['projets'] }) {
  const def = WIDGET_CATALOG.find(w => w.id === widgetId);
  if (!def) return null;

  if (def.category === 'KPIs') return <KpiCard widgetId={widgetId} projets={projets} />;
  if (def.category === 'Graphiques') return <ChartWidget widgetId={widgetId} projets={projets} />;
  if (def.category === 'Tableaux') return <TableWidget widgetId={widgetId} projets={projets} />;
  if (def.category === 'Cartes') return <CardWidget widgetId={widgetId} projets={projets} />;
  return null;
}

// ─── Category colors ────────────────────────────────────────────────────────

const CAT_COLORS: Record<WidgetCategory, { bg: string; text: string; border: string }> = {
  KPIs:       { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  Graphiques: { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' },
  Tableaux:   { bg: '#FFF7ED', text: '#C2410C', border: '#FDBA74' },
  Cartes:     { bg: '#FAF5FF', text: '#7C3AED', border: '#DDD6FE' },
};

// ─── Main DashboardBuilder Component ────────────────────────────────────────

export default function DashboardBuilder() {
  const { projets } = useProjectStore();
  const [mode, setMode] = useState<'config' | 'view'>('config');
  const [layout, setLayout] = useState<PlacedWidget[]>(DEFAULT_LAYOUT);
  const [title, setTitle] = useState('Mon tableau de bord');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [activeCategory, setActiveCategory] = useState<WidgetCategory | 'Tous'>('Tous');

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) setLayout(JSON.parse(saved) as PlacedWidget[]);
      const savedTitle = localStorage.getItem(LS_TITLE_KEY);
      if (savedTitle) setTitle(savedTitle);
    } catch {
      // ignore
    }
  }, []);

  const saveLayout = useCallback(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(layout));
    localStorage.setItem(LS_TITLE_KEY, title);
  }, [layout, title]);

  const resetLayout = useCallback(() => {
    setLayout(DEFAULT_LAYOUT);
    setTitle('Mon tableau de bord');
    localStorage.removeItem(LS_KEY);
    localStorage.removeItem(LS_TITLE_KEY);
  }, []);

  const addWidget = useCallback((widgetId: string) => {
    const def = WIDGET_CATALOG.find(w => w.id === widgetId);
    if (!def) return;
    if (layout.some(p => p.widgetId === widgetId)) return; // already added
    setLayout(prev => [...prev, { widgetId, colSpan: def.defaultColSpan }]);
  }, [layout]);

  const removeWidget = useCallback((widgetId: string) => {
    setLayout(prev => prev.filter(p => p.widgetId !== widgetId));
  }, []);

  const moveWidget = useCallback((widgetId: string, dir: 'up' | 'down') => {
    setLayout(prev => {
      const idx = prev.findIndex(p => p.widgetId === widgetId);
      if (idx < 0) return prev;
      if (dir === 'up' && idx === 0) return prev;
      if (dir === 'down' && idx === prev.length - 1) return prev;
      const next = [...prev];
      const swap = dir === 'up' ? idx - 1 : idx + 1;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  }, []);

  const toggleColSpan = useCallback((widgetId: string) => {
    setLayout(prev => prev.map(p =>
      p.widgetId === widgetId ? { ...p, colSpan: p.colSpan === 1 ? 2 : 1 } : p
    ));
  }, []);

  const categories: (WidgetCategory | 'Tous')[] = ['Tous', 'KPIs', 'Graphiques', 'Tableaux', 'Cartes'];
  const filteredCatalog = activeCategory === 'Tous'
    ? WIDGET_CATALOG
    : WIDGET_CATALOG.filter(w => w.category === activeCategory);

  // Grouped by category for catalog
  const groupedCatalog: Record<string, WidgetDef[]> = {};
  filteredCatalog.forEach(w => {
    if (!groupedCatalog[w.category]) groupedCatalog[w.category] = [];
    groupedCatalog[w.category].push(w);
  });

  // ─── CONFIG MODE ────────────────────────────────────────────────────────────

  const ConfigView = (
    <div style={{ display: 'flex', flex: 1, gap: 0, overflow: 'hidden', minHeight: 0 }}>

      {/* Left panel — Catalog */}
      <div style={{
        width: 280, flexShrink: 0,
        background: '#FAFBFD',
        borderRight: '1px solid #E5E7EB',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Panel header */}
        <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #E5E7EB', flexShrink: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', marginBottom: 8 }}>
            Bibliothèque de widgets
          </div>
          {/* Category filters */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {categories.map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)} style={{
                fontSize: 10, fontWeight: 600,
                padding: '3px 8px', borderRadius: 99, cursor: 'pointer',
                background: activeCategory === cat ? '#1B4F8A' : '#fff',
                color: activeCategory === cat ? '#fff' : '#64748B',
                border: `1px solid ${activeCategory === cat ? '#1B4F8A' : '#D1D5DB'}`,
                transition: 'all 0.12s',
              }}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Catalog list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
          {Object.entries(groupedCatalog).map(([cat, widgets]) => (
            <div key={cat} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
                {cat}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {widgets.map(w => {
                  const WIcon = w.icon;
                  const isAdded = layout.some(p => p.widgetId === w.id);
                  const catStyle = CAT_COLORS[w.category];
                  return (
                    <div key={w.id} style={{
                      background: '#fff',
                      border: `1px solid ${isAdded ? '#BBF7D0' : '#E5E7EB'}`,
                      borderRadius: 8, padding: '8px 10px',
                      display: 'flex', alignItems: 'center', gap: 8,
                      opacity: isAdded ? 0.75 : 1,
                    }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: 7, flexShrink: 0,
                        background: catStyle.bg,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <WIcon size={14} style={{ color: catStyle.text }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#1E293B', lineHeight: 1.3 }}>{w.name}</div>
                        <div style={{ fontSize: 9.5, color: '#94A3B8', lineHeight: 1.3, marginTop: 1 }}>{w.description}</div>
                      </div>
                      <button onClick={() => addWidget(w.id)} disabled={isAdded} style={{
                        width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                        background: isAdded ? '#DCFCE7' : '#1B4F8A',
                        color: isAdded ? '#16A34A' : '#fff',
                        border: 'none', cursor: isAdded ? 'default' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, fontWeight: 700,
                      }}>
                        {isAdded ? <CheckCircle size={13} /> : <Plus size={13} />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — Canvas */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
        {/* Canvas toolbar */}
        <div style={{
          padding: '10px 20px', borderBottom: '1px solid #E5E7EB',
          display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
          background: '#fff',
        }}>
          {editingTitle ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                autoFocus
                value={titleDraft}
                onChange={e => setTitleDraft(e.target.value)}
                onBlur={() => { setTitle(titleDraft || title); setEditingTitle(false); }}
                onKeyDown={e => { if (e.key === 'Enter') { setTitle(titleDraft || title); setEditingTitle(false); } }}
                style={{
                  fontSize: 14, fontWeight: 700, color: '#1E293B',
                  border: '1px solid #1B4F8A', borderRadius: 6,
                  padding: '3px 8px', outline: 'none', fontFamily: 'inherit',
                }}
              />
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#1E293B' }}>{title}</span>
              <button onClick={() => { setTitleDraft(title); setEditingTitle(true); }} style={{
                background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 2,
              }}>
                <Pencil size={12} />
              </button>
            </div>
          )}
          <div style={{ fontSize: 11, color: '#94A3B8' }}>
            {layout.length} widget{layout.length > 1 ? 's' : ''} configuré{layout.length > 1 ? 's' : ''}
          </div>
          <div style={{ flex: 1 }} />
          <button onClick={saveLayout} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 11, fontWeight: 600,
            padding: '6px 12px', borderRadius: 7,
            background: '#1B4F8A', color: '#fff', border: 'none', cursor: 'pointer',
          }}>
            <Save size={12} /> Sauvegarder
          </button>
          <button onClick={resetLayout} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 11, fontWeight: 600,
            padding: '6px 10px', borderRadius: 7,
            background: '#fff', color: '#64748B',
            border: '1px solid #D1D5DB', cursor: 'pointer',
          }}>
            <RotateCcw size={12} /> Réinitialiser
          </button>
        </div>

        {/* Canvas area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', background: '#F8FAFC' }}>
          {layout.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              height: 300, color: '#94A3B8', textAlign: 'center', gap: 12,
            }}>
              <LayoutDashboard size={48} style={{ opacity: 0.3 }} />
              <div style={{ fontSize: 14, fontWeight: 600 }}>Votre tableau de bord est vide</div>
              <div style={{ fontSize: 12 }}>Ajoutez des widgets depuis la bibliothèque à gauche</div>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
            }}>
              {layout.map((placed, idx) => {
                const def = WIDGET_CATALOG.find(w => w.id === placed.widgetId);
                if (!def) return null;
                const WIcon = def.icon;
                const catStyle = CAT_COLORS[def.category];
                return (
                  <div
                    key={placed.widgetId}
                    style={{
                      gridColumn: `span ${placed.colSpan}`,
                      background: '#fff', borderRadius: 10,
                      border: '1px solid #E5E7EB',
                      padding: '10px 12px',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                    }}
                  >
                    {/* Widget card header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                        background: catStyle.bg,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <WIcon size={13} style={{ color: catStyle.text }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: '#1E293B' }}>{def.name}</div>
                        <div style={{ fontSize: 9.5, color: '#94A3B8' }}>{def.description}</div>
                      </div>
                      {/* Controls */}
                      <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                        <span style={{
                          fontSize: 8.5, fontWeight: 700,
                          padding: '1px 5px', borderRadius: 4,
                          background: catStyle.bg, color: catStyle.text, flexShrink: 0,
                        }}>{def.category}</span>
                        <button onClick={() => toggleColSpan(placed.widgetId)} title={placed.colSpan === 1 ? 'Élargir' : 'Réduire'} style={{
                          width: 22, height: 22, borderRadius: 5, border: '1px solid #E5E7EB',
                          background: '#F8FAFC', cursor: 'pointer', color: '#64748B',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <ArrowLeftRight size={10} />
                        </button>
                        <button onClick={() => moveWidget(placed.widgetId, 'up')} disabled={idx === 0} style={{
                          width: 22, height: 22, borderRadius: 5, border: '1px solid #E5E7EB',
                          background: '#F8FAFC', cursor: idx === 0 ? 'default' : 'pointer',
                          color: idx === 0 ? '#CBD5E1' : '#64748B',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <ChevronUp size={12} />
                        </button>
                        <button onClick={() => moveWidget(placed.widgetId, 'down')} disabled={idx === layout.length - 1} style={{
                          width: 22, height: 22, borderRadius: 5, border: '1px solid #E5E7EB',
                          background: '#F8FAFC', cursor: idx === layout.length - 1 ? 'default' : 'pointer',
                          color: idx === layout.length - 1 ? '#CBD5E1' : '#64748B',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <ChevronDown size={12} />
                        </button>
                        <button onClick={() => removeWidget(placed.widgetId)} style={{
                          width: 22, height: 22, borderRadius: 5, border: '1px solid #FECACA',
                          background: '#FEF2F2', cursor: 'pointer', color: '#EF3340',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <X size={10} />
                        </button>
                      </div>
                    </div>
                    {/* Preview area */}
                    <div style={{
                      height: 60, borderRadius: 6,
                      background: `${catStyle.bg}`,
                      border: `1px dashed ${catStyle.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      gap: 8, color: catStyle.text,
                    }}>
                      <WIcon size={14} />
                      <span style={{ fontSize: 11, fontWeight: 600 }}>
                        {placed.colSpan === 2 ? 'Pleine largeur' : '½ largeur'} — {def.category}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ─── VIEW MODE ──────────────────────────────────────────────────────────────

  const ViewDashboard = (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', background: '#F1F5F9' }}>
      {/* Dashboard title */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
        <LayoutDashboard size={20} style={{ color: '#1B4F8A' }} />
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#1E293B' }}>{title}</h1>
        <span style={{ fontSize: 10, color: '#94A3B8', marginLeft: 4 }}>
          {layout.length} widget{layout.length > 1 ? 's' : ''} · Données en temps réel
        </span>
      </div>

      {layout.length === 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: 300, color: '#94A3B8', textAlign: 'center', gap: 12,
          background: '#fff', borderRadius: 12, border: '1px dashed #D1D5DB',
        }}>
          <LayoutDashboard size={48} style={{ opacity: 0.3 }} />
          <div style={{ fontSize: 14, fontWeight: 600 }}>Aucun widget configuré</div>
          <div style={{ fontSize: 12 }}>Passez en mode Configuration pour ajouter des widgets</div>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
          alignItems: 'start',
        }}>
          {layout.map(placed => {
            const def = WIDGET_CATALOG.find(w => w.id === placed.widgetId);
            if (!def) return null;
            const WIcon = def.icon;
            const catStyle = CAT_COLORS[def.category];
            return (
              <div
                key={placed.widgetId}
                style={{
                  gridColumn: `span ${placed.colSpan}`,
                  background: '#fff', borderRadius: 12,
                  border: '1px solid #E5E7EB',
                  padding: '14px 16px',
                  boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
                }}
              >
                {/* Widget header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: catStyle.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <WIcon size={15} style={{ color: catStyle.text }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1E293B' }}>{def.name}</div>
                    <div style={{ fontSize: 9.5, color: '#94A3B8' }}>{def.description}</div>
                  </div>
                  <div style={{ flex: 1 }} />
                  <span style={{
                    fontSize: 8.5, fontWeight: 700,
                    padding: '2px 6px', borderRadius: 4,
                    background: catStyle.bg, color: catStyle.text,
                  }}>{def.category}</span>
                </div>
                {/* Widget content */}
                <WidgetRenderer widgetId={placed.widgetId} projets={projets} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ─── OUTER SHELL ────────────────────────────────────────────────────────────

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', minHeight: 0 }}>
      {/* Top toolbar */}
      <div style={{
        padding: '10px 20px',
        background: '#fff',
        borderBottom: '1px solid #E5E7EB',
        display: 'flex', alignItems: 'center', gap: 10,
        flexShrink: 0,
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      }}>
        <LayoutDashboard size={16} style={{ color: '#1B4F8A' }} />
        <span style={{ fontSize: 13.5, fontWeight: 700, color: '#1E293B' }}>Vue personnalisée</span>
        <span style={{ fontSize: 11, color: '#94A3B8' }}>Configurez et visualisez votre tableau de bord</span>

        <div style={{ flex: 1 }} />

        {/* Mode toggle */}
        <div style={{
          display: 'flex', background: '#F1F5F9', borderRadius: 8, padding: 3,
          border: '1px solid #E5E7EB', gap: 2,
        }}>
          <button onClick={() => setMode('config')} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 12px', borderRadius: 6, fontSize: 11.5, fontWeight: 600,
            background: mode === 'config' ? '#1B4F8A' : 'transparent',
            color: mode === 'config' ? '#fff' : '#64748B',
            border: 'none', cursor: 'pointer', transition: 'all 0.15s',
          }}>
            <Settings size={12} />
            Configurer
          </button>
          <button onClick={() => setMode('view')} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 12px', borderRadius: 6, fontSize: 11.5, fontWeight: 600,
            background: mode === 'view' ? '#1B4F8A' : 'transparent',
            color: mode === 'view' ? '#fff' : '#64748B',
            border: 'none', cursor: 'pointer', transition: 'all 0.15s',
          }}>
            <Eye size={12} />
            Voir le tableau de bord
          </button>
        </div>
      </div>

      {/* Content */}
      {mode === 'config' ? ConfigView : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
          {ViewDashboard}
        </div>
      )}
    </div>
  );
}
