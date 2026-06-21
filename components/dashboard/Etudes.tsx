'use client';
import { useState } from 'react';
import {
  FileText, Upload, Search, Filter, Plus, Eye, Download,
  CheckCircle2, Clock, AlertCircle, FileBox, Map, Layers,
  ChevronRight, Tag, Calendar, User, Building2,
} from 'lucide-react';

const C = {
  navy:   '#1B2A4A',
  orange: '#F47920',
  blue:   '#1E40AF',
  green:  '#059669',
  amber:  '#D97706',
  red:    '#DC2626',
  slate:  '#64748B',
  bg:     '#F8FAFC',
  card:   '#FFFFFF',
  border: '#E2E8F0',
};

type TypeEtude = 'APS' | 'APD' | 'DAO' | 'NOTE_TECH' | 'NOTE_CALC' | 'EIES' | 'FONCIER' | 'DOE';
type StatutEtude = 'EN_COURS' | 'VALIDEE' | 'EN_REVISION' | 'APPROUVEE' | 'ARCHIVEE';
type Domaine = 'PRODUCTION' | 'TRANSPORT' | 'DISTRIBUTION' | 'COMMERCIAL' | 'GENIE_CIVIL';

interface Etude {
  id: string;
  reference: string;
  titre: string;
  type: TypeEtude;
  statut: StatutEtude;
  domaine: Domaine;
  projet: string;
  localite: string;
  region: string;
  bureau: string;
  dateDepot: string;
  dateValidation?: string;
  version: string;
  hasSIG: boolean;
  hasPlan: boolean;
  tags: string[];
}

const ETUDES_DEMO: Etude[] = [];

const TYPE_LABELS: Record<TypeEtude, { label: string; color: string; bg: string }> = {
  APS:      { label: 'APS',       color: '#1D4ED8', bg: '#EFF6FF' },
  APD:      { label: 'APD',       color: '#7C3AED', bg: '#F5F3FF' },
  DAO:      { label: 'DAO',       color: '#0D9488', bg: '#F0FDFA' },
  NOTE_TECH:{ label: 'Note Tech', color: '#92400E', bg: '#FFF7ED' },
  NOTE_CALC:{ label: 'Note Calc', color: '#1E40AF', bg: '#EFF6FF' },
  EIES:     { label: 'EIES',      color: '#059669', bg: '#F0FDF4' },
  FONCIER:  { label: 'Foncier',   color: '#9333EA', bg: '#FAF5FF' },
  DOE:      { label: 'DOE',       color: '#DC2626', bg: '#FEF2F2' },
};

const STATUT_CONFIG: Record<StatutEtude, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  EN_COURS:   { label: 'En cours',    color: '#D97706', bg: '#FFF7ED', icon: Clock },
  VALIDEE:    { label: 'Validée',     color: '#059669', bg: '#F0FDF4', icon: CheckCircle2 },
  EN_REVISION:{ label: 'En révision', color: '#DC2626', bg: '#FEF2F2', icon: AlertCircle },
  APPROUVEE:  { label: 'Approuvée',   color: '#1D4ED8', bg: '#EFF6FF', icon: CheckCircle2 },
  ARCHIVEE:   { label: 'Archivée',    color: '#64748B', bg: '#F8FAFC', icon: FileBox },
};

const DOMAINE_LABELS: Record<Domaine, string> = {
  PRODUCTION:   'Production',
  TRANSPORT:    'Transport',
  DISTRIBUTION: 'Distribution',
  COMMERCIAL:   'Commercial',
  GENIE_CIVIL:  'Génie Civil',
};

const TABS: { id: TypeEtude | 'ALL'; label: string }[] = [
  { id: 'ALL',      label: 'Toutes les études' },
  { id: 'APS',      label: 'APS' },
  { id: 'APD',      label: 'APD' },
  { id: 'DAO',      label: 'DAO' },
  { id: 'DOE',      label: 'DOE' },
  { id: 'NOTE_CALC',label: 'Notes Calcul' },
  { id: 'EIES',     label: 'EIES / Foncier' },
];

export default function Etudes() {
  const [activeTab, setActiveTab] = useState<TypeEtude | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [selectedDomaine, setSelectedDomaine] = useState<Domaine | 'ALL'>('ALL');

  const filtered = ETUDES_DEMO.filter(e => {
    if (activeTab !== 'ALL' && e.type !== activeTab &&
        !(activeTab === 'EIES' && (e.type === 'EIES' || e.type === 'FONCIER'))) return false;
    if (selectedDomaine !== 'ALL' && e.domaine !== selectedDomaine) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!e.titre.toLowerCase().includes(q) && !e.reference.toLowerCase().includes(q) &&
          !e.localite.toLowerCase().includes(q) && !e.projet.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const kpis = [
    { label: 'Études actives', value: ETUDES_DEMO.filter(e => e.statut === 'EN_COURS' || e.statut === 'EN_REVISION').length, color: C.amber, icon: Clock },
    { label: 'Validées / Approuvées', value: ETUDES_DEMO.filter(e => e.statut === 'VALIDEE' || e.statut === 'APPROUVEE').length, color: C.green, icon: CheckCircle2 },
    { label: 'Avec données SIG', value: ETUDES_DEMO.filter(e => e.hasSIG).length, color: C.blue, icon: Map },
    { label: 'Total', value: ETUDES_DEMO.length, color: C.navy, icon: FileText },
  ];

  return (
    <div style={{ background: C.bg, minHeight: '100vh', padding: '24px 28px' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, color: C.slate, fontSize: 12 }}>
          <span>Projets</span>
          <ChevronRight size={12} />
          <span style={{ color: C.navy, fontWeight: 600 }}>Études & Conception</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: C.navy, margin: 0 }}>
              Gestion des Études
            </h1>
            <p style={{ fontSize: 13, color: C.slate, margin: '4px 0 0' }}>
              APS · APD · DAO · Notes techniques · EIES · DOE — chaque étude produit des géométries SIG exploitables
            </p>
          </div>
          <button style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px',
            background: C.orange, color: '#fff', border: 'none', borderRadius: 9,
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>
            <Plus size={15} /> Nouvelle étude
          </button>
        </div>
      </div>

      {/* Règle fondamentale */}
      <div style={{
        background: 'linear-gradient(135deg, #EFF6FF, #F0FDF4)',
        border: '1px solid #BFDBFE', borderRadius: 10, padding: '10px 16px',
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20,
      }}>
        <Map size={16} style={{ color: C.blue, flexShrink: 0 }} />
        <span style={{ fontSize: 12.5, color: '#1E40AF', fontWeight: 600 }}>
          Règle fondamentale : Toute étude doit produire des données géographiques, des géométries SIG et des plans géoréférencés. Un PDF seul n'est pas un livrable complet.
        </span>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        {kpis.map(k => {
          const Icon = k.icon;
          return (
            <div key={k.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: `${k.color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={18} style={{ color: k.color }} />
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value}</div>
                <div style={{ fontSize: 11, color: C.slate, fontWeight: 600, marginTop: 2 }}>{k.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: `1px solid ${C.border}`, paddingBottom: 0 }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TypeEtude | 'ALL')}
            style={{
              padding: '8px 14px',
              fontSize: 12.5, fontWeight: activeTab === tab.id ? 700 : 500,
              color: activeTab === tab.id ? C.orange : C.slate,
              background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: activeTab === tab.id ? `2px solid ${C.orange}` : '2px solid transparent',
              marginBottom: -1, whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <div style={{ flex: 1, position: 'relative', maxWidth: 360 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.slate }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par titre, référence, localité…"
            style={{ width: '100%', paddingLeft: 32, paddingRight: 12, paddingTop: 8, paddingBottom: 8, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12.5, color: C.navy, background: C.card, outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <select
          value={selectedDomaine}
          onChange={e => setSelectedDomaine(e.target.value as Domaine | 'ALL')}
          style={{ padding: '7px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12.5, color: C.navy, background: C.card, cursor: 'pointer', outline: 'none' }}
        >
          <option value="ALL">Tous les domaines</option>
          {(Object.keys(DOMAINE_LABELS) as Domaine[]).map(d => (
            <option key={d} value={d}>{DOMAINE_LABELS[d]}</option>
          ))}
        </select>
        <span style={{ fontSize: 12, color: C.slate, marginLeft: 4 }}>
          {filtered.length} étude{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Liste */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(etude => {
          const TypeBadge = TYPE_LABELS[etude.type];
          const statutConf = STATUT_CONFIG[etude.statut];
          const StatutIcon = statutConf.icon;
          return (
            <div
              key={etude.id}
              style={{
                background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
                padding: '16px 20px', cursor: 'pointer',
                transition: 'box-shadow 0.15s, border-color 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'; (e.currentTarget as HTMLDivElement).style.borderColor = '#CBD5E1'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; (e.currentTarget as HTMLDivElement).style.borderColor = C.border; }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                {/* Type badge */}
                <div style={{ paddingTop: 2, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: TypeBadge.color, background: TypeBadge.bg, padding: '3px 8px', borderRadius: 6 }}>
                    {TypeBadge.label}
                  </span>
                </div>

                {/* Main content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: C.slate, fontFamily: 'monospace' }}>{etude.reference}</span>
                    <span style={{ fontSize: 11, color: C.slate }}>•</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#7C3AED', background: '#F5F3FF', padding: '2px 7px', borderRadius: 5 }}>
                      {DOMAINE_LABELS[etude.domaine]}
                    </span>
                    <span style={{ fontSize: 11, color: C.slate }}>•</span>
                    <span style={{ fontSize: 11, color: C.slate }}>Version {etude.version}</span>
                  </div>

                  <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy, margin: '0 0 8px', lineHeight: 1.4 }}>
                    {etude.titre}
                  </h3>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: C.slate }}>
                      <Building2 size={12} />
                      <span>{etude.projet}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: C.slate }}>
                      <Map size={12} />
                      <span>{etude.localite}, {etude.region}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: C.slate }}>
                      <Calendar size={12} />
                      <span>Déposée {etude.dateDepot}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: C.slate }}>
                      <User size={12} />
                      <span>{etude.bureau}</span>
                    </div>
                  </div>

                  {/* Tags + SIG indicators */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                    {etude.hasSIG && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, color: '#059669', background: '#F0FDF4', padding: '3px 8px', borderRadius: 6, border: '1px solid #BBF7D0' }}>
                        <Map size={10} /> SIG
                      </span>
                    )}
                    {etude.hasPlan && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, color: '#1D4ED8', background: '#EFF6FF', padding: '3px 8px', borderRadius: 6, border: '1px solid #BFDBFE' }}>
                        <Layers size={10} /> Plans géoréférencés
                      </span>
                    )}
                    {!etude.hasSIG && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, color: '#DC2626', background: '#FEF2F2', padding: '3px 8px', borderRadius: 6, border: '1px solid #FECACA' }}>
                        <AlertCircle size={10} /> SIG manquant
                      </span>
                    )}
                    {etude.tags.map(tag => (
                      <span key={tag} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, color: C.slate, background: '#F8FAFC', padding: '3px 8px', borderRadius: 6, border: `1px solid ${C.border}` }}>
                        <Tag size={9} /> {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Right side: statut + actions */}
                <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: statutConf.color, background: statutConf.bg, padding: '5px 10px', borderRadius: 7 }}>
                    <StatutIcon size={12} /> {statutConf.label}
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button title="Consulter" style={{ background: '#F1F5F9', border: 'none', borderRadius: 7, padding: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                      <Eye size={14} style={{ color: C.slate }} />
                    </button>
                    <button title="Télécharger" style={{ background: '#F1F5F9', border: 'none', borderRadius: 7, padding: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                      <Download size={14} style={{ color: C.slate }} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Upload zone */}
      <div style={{
        marginTop: 20, border: `2px dashed ${C.border}`, borderRadius: 12, padding: '24px',
        textAlign: 'center', background: '#FAFBFC', cursor: 'pointer',
      }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = C.orange; (e.currentTarget as HTMLDivElement).style.background = '#FFF8F3'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = C.border; (e.currentTarget as HTMLDivElement).style.background = '#FAFBFC'; }}
      >
        <Upload size={28} style={{ color: C.slate, marginBottom: 10 }} />
        <div style={{ fontSize: 13.5, fontWeight: 700, color: C.navy, marginBottom: 4 }}>
          Déposer une nouvelle étude
        </div>
        <div style={{ fontSize: 12, color: C.slate }}>
          PDF, DWG, DXF, Shapefile, GeoJSON, GeoPackage, KMZ · Swarm IA génère automatiquement les métadonnées
        </div>
      </div>
    </div>
  );
}
