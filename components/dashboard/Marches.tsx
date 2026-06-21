'use client';

import { useState, useMemo } from 'react';
import { X, ChevronUp, ChevronDown, Star, Plus, Pencil, Trash2, SlidersHorizontal, Search } from 'lucide-react';
import { useCriteriaStore } from '@/lib/criteriaStore';
import { useAuth } from '@/lib/authStore';
import { computeVisibilityScope, type UserOrgProfile } from '@/lib/accessEngine';
import { canonDirectionKey } from '@/lib/dpeOrgStructure';

// ── Types ────────────────────────────────────────────────────────────────────

type StatutMarche = 'en_cours' | 'termine' | 'resilie';
type TypeMarche   = 'Travaux' | 'Services' | 'Fournitures';

interface Avenant {
  id: string;
  numero: number;
  objet: string;
  montant: number;
  delaiJours: number;
  date: string;
}

interface Penalite {
  id: string;
  date: string;
  motif: string;
  montant: number;
}

interface Garantie {
  type: 'Caution de bonne exécution' | 'Retenue de garantie' | 'Avance de démarrage';
  montant: number;
  echeance: string;
  statut: 'valide' | 'a_renouveler' | 'expiree';
}

interface Marche {
  id: string;
  reference: string;
  objet: string;
  entreprise: string;
  montantHT: number;
  dateSignature: string;
  dateFin: string;
  avancement: number;
  statut: StatutMarche;
  direction: string;
  type: TypeMarche;
  bailleur: string;
  avenants: Avenant[];
  penalites: Penalite[];
  garanties: Garantie[];
  observations?: string;
}

interface ANOMarche {
  id: string;
  ref: string;
  projet: string;
  type: string;
  dateEnvoi: string;
  slaBailleur: number;
  joursEcoules: number;
  statut: 'en_attente' | 'recu' | 'expire';
}

interface Fournisseur {
  id: string;
  nom: string;
  note: number;
  nbMarches: number;
  tauxLivraison: number;
  contentieux: number;
}



// ── Données métier ────────────────────────────────────────────────────────────
// Les marchés, ANOs et fournisseurs sont saisis par les utilisateurs.
// Aucune donnée hardcodée — état initial vide.

const MARCHES_INIT: Marche[] = [];

const ANOS_MARCHES: ANOMarche[] = [];

const FOURNISSEURS: Fournisseur[] = [];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtM(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + ' Md';
  if (n >= 1e6) return (n / 1e6).toFixed(0) + ' M';
  return n.toLocaleString('fr-FR');
}

const STATUT_CFG: Record<StatutMarche, { label: string; pill: string }> = {
  en_cours: { label: 'En cours',  pill: 'pill-warn' },
  termine:  { label: 'Terminé',   pill: 'pill-ok'   },
  resilie:  { label: 'Résilié',   pill: 'pill-ko'   },
};

const DIRECTIONS_LIST = ['Tous', 'DEP', 'DER', 'DIT', 'DGC', 'CC26', 'CPBM-UE', 'CPADERAU', 'CPAMACEL'];
const STATUTS_LIST:    (StatutMarche | 'Tous')[] = ['Tous', 'en_cours', 'termine', 'resilie'];
const TYPES_LIST:      (TypeMarche  | 'Tous')[]  = ['Tous', 'Travaux', 'Services', 'Fournitures'];
const BAILLEURS_LIST = ['Tous', 'BM', 'AFD', 'BAD', 'MCA', 'KfW', 'BOAD', 'SENELEC'];

function Stars({ note }: { note: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 1 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={11} fill={i <= Math.round(note) ? '#F39200' : 'none'} color={i <= Math.round(note) ? '#F39200' : '#CBD5E1'} />
      ))}
      <span style={{ marginLeft: 4, fontSize: 10, color: 'var(--muted)', fontWeight: 600 }}>{note.toFixed(1)}</span>
    </span>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function MarchePanel({ marche, onClose }: { marche: Marche; onClose: () => void }) {
  const totalPenalites = marche.penalites.reduce((s, p) => s + p.montant, 0);
  const montantAvenants = marche.avenants.reduce((s, a) => s + a.montant, 0);
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(14,52,96,0.65)',
      display: 'flex', justifyContent: 'flex-end', alignItems: 'stretch',
    }}>
      <div style={{
        width: '100%', maxWidth: 680, background: 'var(--bg-card)',
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
        boxShadow: 'var(--shadow-lg)',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-2)', background: 'var(--navy)', color: '#fff', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.65)', letterSpacing: '0.08em', marginBottom: 4 }}>
                {marche.reference} · {marche.type} · {marche.direction}
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.3 }}>{marche.objet}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 4 }}>{marche.entreprise}</div>
            </div>
            <button onClick={onClose} aria-label="Fermer le détail du marché" style={{ padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', flexShrink: 0, marginLeft: 12 }}>
              <X size={16} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <span className={`pill ${STATUT_CFG[marche.statut].pill}`}>{STATUT_CFG[marche.statut].label}</span>
            <span className="pill pill-info">{marche.bailleur}</span>
          </div>
        </div>

        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* KPIs financiers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            {[
              { label: 'Montant HTVA',      value: fmtM(marche.montantHT),                 color: 'var(--navy)'  },
              { label: 'Montant avenants',  value: fmtM(montantAvenants),                   color: 'var(--amber)' },
              { label: 'Pénalités',         value: totalPenalites > 0 ? fmtM(totalPenalites) : '—', color: 'var(--red)' },
            ].map((k, i) => (
              <div key={i} style={{ padding: '10px 12px', background: 'var(--bg)', borderRadius: 8, textAlign: 'center', border: '1px solid var(--border-2)' }}>
                <div style={{ fontSize: 9, color: 'var(--muted)', marginBottom: 3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{k.label}</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: k.color }}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* Avancement */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>AVANCEMENT PHYSIQUE</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: marche.avancement >= 70 ? 'var(--green)' : 'var(--orange)' }}>{marche.avancement}%</span>
            </div>
            <div className="progress-bar" style={{ height: 8 }}>
              <div className="progress-fill" style={{
                width: `${marche.avancement}%`,
                background: marche.avancement >= 70 ? 'var(--green)' : 'var(--orange)',
              }} />
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, color: 'var(--muted)' }}>
              <span>Signé : <strong style={{ color: 'var(--text)' }}>{marche.dateSignature}</strong></span>
              <span>Fin prévue : <strong style={{ color: 'var(--text)' }}>{marche.dateFin}</strong></span>
            </div>
          </div>

          {/* Avenants */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Avenants ({marche.avenants.length})</span>
            </div>
            <div className="card-body">
              {marche.avenants.length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '12px 0' }}>Aucun avenant</p>
              ) : marche.avenants.map(av => (
                <div key={av.id} style={{ padding: '8px 10px', background: 'var(--bg)', borderRadius: 6, border: '1px solid var(--border-2)', marginBottom: 6 }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--navy)', marginBottom: 3 }}>Avenant n°{av.numero} — {av.date}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{av.objet}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3 }}>
                    {av.montant > 0 && <span style={{ marginRight: 10 }}>+ {fmtM(av.montant)} FCFA</span>}
                    {av.delaiJours > 0 && <span>+ {av.delaiJours} jours</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pénalités */}
          {marche.penalites.length > 0 && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">Pénalités appliquées</span>
                <span className="pill pill-ko">{fmtM(totalPenalites)} FCFA</span>
              </div>
              <div className="card-body">
                {marche.penalites.map(p => (
                  <div key={p.id} style={{ padding: '8px 10px', background: 'var(--red-light)', borderRadius: 6, border: '1px solid rgba(226,35,26,0.20)', marginBottom: 6 }}>
                    <div style={{ fontWeight: 700, fontSize: 11, color: 'var(--red)', marginBottom: 2 }}>{p.date} — {fmtM(p.montant)} FCFA</div>
                    <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{p.motif}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Garanties */}
          {marche.garanties.length > 0 && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">Garanties</span>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {marche.garanties.map((g, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', background: 'var(--bg)', borderRadius: 6, border: '1px solid var(--border-2)' }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--navy)' }}>{g.type}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted)' }}>Échéance : {g.echeance}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>{fmtM(g.montant)}</div>
                      <span className={`pill ${g.statut === 'valide' ? 'pill-ok' : g.statut === 'a_renouveler' ? 'pill-warn' : 'pill-ko'}`} style={{ marginTop: 3 }}>
                        {g.statut === 'valide' ? 'Valide' : g.statut === 'a_renouveler' ? 'À renouveler' : 'Expirée'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Observations */}
          {marche.observations && (
            <div className="banner banner-warn" style={{ fontSize: 12 }}>
              <strong>Observations :</strong> {marche.observations}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Marches() {
  const supplierCriteres = useCriteriaStore(s => s.supplier);
  const { isRole, user } = useAuth();
  // Périmètre MMH : un profil ne voit que les marchés de SA direction (pas DEP/DIT/DGC… pour un DER).
  const marcheScope = useMemo(() => {
    if (!user) return { all: false, dirs: new Set<string>() };
    const profile: UserOrgProfile = { role: user.role, direction: user.direction, departement: user.departement, cellule: user.cellule, poste: user.poste };
    const s = computeVisibilityScope(profile);
    if (s.all || s.directions.includes('*')) return { all: true, dirs: new Set<string>() };
    return { all: false, dirs: new Set(s.directions.map(d => canonDirectionKey(d))) };
  }, [user]);
  const [marches,      setMarches]      = useState<Marche[]>(MARCHES_INIT);
  const [filterStatut, setFilterStatut] = useState<StatutMarche | 'Tous'>('Tous');
  const [filterDir,    setFilterDir]    = useState('Tous');
  const [filterType,   setFilterType]   = useState<TypeMarche | 'Tous'>('Tous');
  const [filterBailleur, setFilterBailleur] = useState('Tous');
  const [search, setSearch] = useState('');
  const [sortCol,      setSortCol]      = useState<keyof Marche>('dateSignature');
  const [sortAsc,      setSortAsc]      = useState(false);
  const [selected,     setSelected]     = useState<Marche | null>(null);
  const [activeTab,    setActiveTab]    = useState<'marches' | 'anos' | 'fournisseurs'>('marches');
  const [editing,      setEditing]      = useState<Marche | null>(null); // marché en édition
  const [showForm,     setShowForm]     = useState(false);

  // ── CRUD marchés ──
  function saveMarche(m: Marche) {
    setMarches(prev => prev.some(x => x.id === m.id)
      ? prev.map(x => x.id === m.id ? m : x)
      : [...prev, m]);
    setShowForm(false); setEditing(null);
  }
  function deleteMarche(id: string) {
    if (!confirm('Supprimer définitivement ce marché ?')) return;
    setMarches(prev => prev.filter(m => m.id !== id));
  }
  function openCreate() { setEditing(null); setShowForm(true); }
  function openEdit(m: Marche) { setEditing(m); setShowForm(true); }

  const filtered = useMemo(() => {
    let rows = [...marches];
    // 0) Périmètre MMH par direction (sauf super-rôles / vision globale).
    if (!marcheScope.all) rows = rows.filter(m => marcheScope.dirs.has(canonDirectionKey(m.direction)));
    if (filterStatut   !== 'Tous') rows = rows.filter(m => m.statut    === filterStatut);
    if (filterDir      !== 'Tous') rows = rows.filter(m => m.direction === filterDir);
    if (filterType     !== 'Tous') rows = rows.filter(m => m.type      === filterType);
    if (filterBailleur !== 'Tous') rows = rows.filter(m => m.bailleur  === filterBailleur);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(m =>
        m.reference.toLowerCase().includes(q) ||
        m.objet.toLowerCase().includes(q) ||
        m.entreprise.toLowerCase().includes(q) ||
        m.direction.toLowerCase().includes(q) ||
        m.bailleur.toLowerCase().includes(q)
      );
    }
    rows.sort((a, b) => {
      const av = a[sortCol] as string | number;
      const bv = b[sortCol] as string | number;
      if (typeof av === 'number' && typeof bv === 'number') return sortAsc ? av - bv : bv - av;
      return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return rows;
  }, [marches, marcheScope, filterStatut, filterDir, filterType, filterBailleur, search, sortCol, sortAsc]);

  function toggleSort(col: keyof Marche) {
    if (sortCol === col) setSortAsc(v => !v);
    else { setSortCol(col); setSortAsc(false); }
  }

  function SortIcon({ col }: { col: keyof Marche }) {
    if (sortCol !== col) return null;
    return sortAsc ? <ChevronUp size={11} /> : <ChevronDown size={11} />;
  }

  // KPIs globaux
  const kpis = {
    total:     marches.length,
    actifs:    marches.filter(m => m.statut === 'en_cours').length,
    avenants:  marches.reduce((s, m) => s + m.avenants.length, 0),
    penalites: marches.filter(m => m.penalites.length > 0).length,
    garanties60j: marches.flatMap(m => m.garanties).filter(g => g.statut === 'a_renouveler').length,
    anos: ANOS_MARCHES.filter(a => a.statut === 'en_attente').length,
  };

  return (
    <div className="page-content">

      {/* ── KPIs ─────────────────────────────────────────────────────────── */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(5,1fr)' }}>
        <div className="kpi-card navy">
          <div className="kpi-label">Marchés actifs</div>
          <div className="kpi-value">{kpis.actifs}</div>
          <div className="kpi-sub">{kpis.total} marchés au total</div>
        </div>
        <div className="kpi-card amber">
          <div className="kpi-label">Avenants en cours</div>
          <div className="kpi-value amber">{kpis.avenants}</div>
          <div className="kpi-sub">tous marchés confondus</div>
        </div>
        <div className="kpi-card red">
          <div className="kpi-label">Pénalités appliquées</div>
          <div className="kpi-value red">{kpis.penalites}</div>
          <div className="kpi-sub">marchés concernés</div>
        </div>
        <div className="kpi-card" style={{ borderLeftColor: 'var(--purple)' }}>
          <div className="kpi-label">Garanties à renouveler</div>
          <div className="kpi-value" style={{ color: 'var(--purple)' }}>{kpis.garanties60j}</div>
          <div className="kpi-sub">cautions / retenues</div>
        </div>
        <div className="kpi-card" style={{ borderLeftColor: 'var(--blue)' }}>
          <div className="kpi-label">ANOs en attente</div>
          <div className="kpi-value blue">{kpis.anos}</div>
          <div className="kpi-sub">avis bailleurs</div>
        </div>
      </div>

      {/* ── Onglets ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="tabs">
          {(['marches', 'anos', 'fournisseurs'] as const).map(t => (
            <button key={t} className={`tab${activeTab === t ? ' active' : ''}`} onClick={() => setActiveTab(t)}>
              {t === 'marches' ? 'Liste marchés' : t === 'anos' ? 'ANOs' : 'Scoring fournisseurs'}
            </button>
          ))}
        </div>
      </div>

      {/* ── MARCHÉS ──────────────────────────────────────────────────────── */}
      {activeTab === 'marches' && (
        <>
          {/* Filtres */}
          <div className="filter-bar" style={{ gap: 8 }}>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher un marché…"
                className="form-input"
                style={{ paddingLeft: 28, width: 220, paddingRight: search ? 26 : 8 }}
              />
              {search && (
                <button onClick={() => setSearch('')} aria-label="Effacer la recherche" style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 0 }}>
                  <X size={12} />
                </button>
              )}
            </div>
            <select className="form-input" value={filterStatut} onChange={e => setFilterStatut(e.target.value as StatutMarche | 'Tous')}>
              {STATUTS_LIST.map(s => <option key={s} value={s}>{s === 'Tous' ? 'Tous statuts' : STATUT_CFG[s as StatutMarche]?.label ?? s}</option>)}
            </select>
            <select className="form-input" value={filterDir} onChange={e => setFilterDir(e.target.value)}>
              {DIRECTIONS_LIST.map(d => <option key={d} value={d}>{d === 'Tous' ? 'Toutes directions' : d}</option>)}
            </select>
            <select className="form-input" value={filterType} onChange={e => setFilterType(e.target.value as TypeMarche | 'Tous')}>
              {TYPES_LIST.map(t => <option key={t} value={t}>{t === 'Tous' ? 'Tous types' : t}</option>)}
            </select>
            <select className="form-input" value={filterBailleur} onChange={e => setFilterBailleur(e.target.value)}>
              {BAILLEURS_LIST.map(b => <option key={b} value={b}>{b === 'Tous' ? 'Tous bailleurs' : b}</option>)}
            </select>
            <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>{filtered.length} marchés</span>
            <button className="btn btn-primary btn-xs" style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={openCreate}>
              <Plus size={13} /> Nouveau marché
            </button>
          </div>

          <div className="card">
            <div style={{ overflowX: 'auto' }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th onClick={() => toggleSort('reference')} style={{ cursor: 'pointer' }}>Référence <SortIcon col="reference" /></th>
                    <th onClick={() => toggleSort('objet')} style={{ cursor: 'pointer' }}>Objet <SortIcon col="objet" /></th>
                    <th className="hide-mobile" onClick={() => toggleSort('entreprise')} style={{ cursor: 'pointer' }}>Entreprise <SortIcon col="entreprise" /></th>
                    <th onClick={() => toggleSort('montantHT')} style={{ cursor: 'pointer', textAlign: 'right' }}>Montant HTVA <SortIcon col="montantHT" /></th>
                    <th className="hide-mobile" onClick={() => toggleSort('dateSignature')} style={{ cursor: 'pointer' }}>Signature <SortIcon col="dateSignature" /></th>
                    <th className="hide-mobile" onClick={() => toggleSort('dateFin')} style={{ cursor: 'pointer' }}>Date fin <SortIcon col="dateFin" /></th>
                    <th style={{ textAlign: 'right' }}>Avancement</th>
                    <th>Statut</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(m => {
                    const cfg = STATUT_CFG[m.statut];
                    return (
                      <tr key={m.id}>
                        <td style={{ fontWeight: 700, color: 'var(--navy)', fontSize: 10, whiteSpace: 'nowrap' }}>{m.reference}</td>
                        <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}
                          title={m.objet}>{m.objet}</td>
                        <td className="hide-mobile" style={{ fontSize: 11 }}>{m.entreprise}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{fmtM(m.montantHT)}</td>
                        <td className="hide-mobile" style={{ whiteSpace: 'nowrap', fontSize: 11 }}>{m.dateSignature}</td>
                        <td className="hide-mobile" style={{ whiteSpace: 'nowrap', fontSize: 11 }}>{m.dateFin}</td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                            <div className="progress-bar" style={{ width: 50 }}>
                              <div className="progress-fill" style={{
                                width: `${m.avancement}%`,
                                background: m.avancement >= 70 ? 'var(--green)' : m.avancement >= 40 ? 'var(--orange)' : 'var(--red)',
                              }} />
                            </div>
                            <span style={{ fontWeight: 700, fontSize: 11, color: m.avancement >= 70 ? 'var(--green)' : 'var(--amber)' }}>
                              {m.avancement}%
                            </span>
                          </div>
                        </td>
                        <td><span className={`pill ${cfg.pill}`}>{cfg.label}</span></td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn btn-ghost btn-xs" onClick={() => setSelected(m)}>Détail</button>
                            <button className="btn btn-ghost btn-xs hide-mobile" title="Modifier" aria-label={`Modifier le marché ${m.reference}`} onClick={() => openEdit(m)}><Pencil size={12} /></button>
                            <button className="btn btn-ghost btn-xs" title="Supprimer" aria-label={`Supprimer le marché ${m.reference}`} style={{ color: 'var(--red)' }} onClick={() => deleteMarche(m.id)}><Trash2 size={12} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: 12 }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
                  <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Aucun marché correspondant aux filtres</div>
                  <div style={{ marginBottom: 12 }}>Ajustez les filtres ou créez un nouveau marché.</div>
                  <button className="btn btn-primary btn-xs" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }} onClick={openCreate}>
                    <Plus size={13} /> Nouveau marché
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── ANOs ─────────────────────────────────────────────────────────── */}
      {activeTab === 'anos' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Suivi ANOs — Avis Non-Objection bailleurs</span>
            <span className="pill pill-warn">{ANOS_MARCHES.filter(a => a.statut === 'en_attente').length} en cours</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Réf ANO</th>
                  <th>Projet</th>
                  <th>Type</th>
                  <th>Date envoi</th>
                  <th style={{ textAlign: 'right' }}>SLA bailleur</th>
                  <th style={{ textAlign: 'right' }}>Jours restants</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {ANOS_MARCHES.map(a => {
                  const restant = a.slaBailleur - a.joursEcoules;
                  const isExpire = a.statut === 'expire' || restant < 0;
                  const ageColor = a.statut === 'recu' ? 'var(--green)' : isExpire ? 'var(--red)' : restant <= 3 ? 'var(--red)' : restant <= 7 ? 'var(--amber)' : 'var(--green)';
                  return (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 700, color: 'var(--navy)', fontSize: 10 }}>{a.ref}</td>
                      <td style={{ fontSize: 11 }} className="hide-mobile">{a.projet}</td>
                      <td><span className="pill pill-info">{a.type}</span></td>
                      <td className="hide-mobile">{a.dateEnvoi}</td>
                      <td style={{ textAlign: 'right' }}>{a.slaBailleur} j</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: ageColor }}>
                        {a.statut === 'recu'
                          ? '—'
                          : isExpire
                            ? `Dépassé +${Math.abs(restant)}j`
                            : `J-${restant}`}
                      </td>
                      <td>
                        {a.statut === 'recu'      && <span className="pill pill-ok">Reçu</span>}
                        {a.statut === 'en_attente' && <span className="pill pill-warn">En attente</span>}
                        {a.statut === 'expire'     && <span className="pill pill-ko">Expiré</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── SCORING FOURNISSEURS ─────────────────────────────────────────── */}
      {activeTab === 'fournisseurs' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Scoring fournisseurs — Top 5 titulaires</span>
          </div>
          {/* Grille de notation paramétrée (gouvernance DPE/PMO/Admin via Administration › Critères & Scoring) */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border, #E2E8F0)', background: '#F8FAFC' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <SlidersHorizontal size={13} color="#F47920" />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy, #1B4F8A)' }}>Grille de notation pondérée</span>
              <span style={{ fontSize: 10, color: 'var(--muted)' }}>· paramétrable dans Administration › Critères &amp; Scoring</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {supplierCriteres.map(c => (
                <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, padding: '3px 8px', borderRadius: 6, background: '#fff', border: '1px solid #E2E8F0' }}>
                  {c.label}
                  <b style={{ color: '#F47920' }}>{c.poids}%</b>
                </span>
              ))}
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Entreprise</th>
                  <th>Note globale</th>
                  <th style={{ textAlign: 'right' }}>Nb marchés</th>
                  <th style={{ textAlign: 'right' }}>Taux livraison</th>
                  <th style={{ textAlign: 'right' }}>Contentieux</th>
                </tr>
              </thead>
              <tbody>
                {[...FOURNISSEURS].sort((a, b) => b.note - a.note).map((f, i) => (
                  <tr key={f.id}>
                    <td style={{ fontWeight: 700, color: 'var(--muted)', fontSize: 11 }}>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{f.nom}</td>
                    <td><Stars note={f.note} /></td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{f.nbMarches}</td>
                    <td style={{ textAlign: 'right' }}>
                      <span style={{ fontWeight: 700, color: f.tauxLivraison >= 90 ? 'var(--green)' : f.tauxLivraison >= 75 ? 'var(--amber)' : 'var(--red)' }}>
                        {f.tauxLivraison}%
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {f.contentieux > 0
                        ? <span className="pill pill-ko">{f.contentieux}</span>
                        : <span className="pill pill-ok">0</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected && <MarchePanel marche={selected} onClose={() => setSelected(null)} />}
      {showForm && <MarcheForm initial={editing} onSave={saveMarche} onClose={() => { setShowForm(false); setEditing(null); }} />}
    </div>
  );
}

// ── Formulaire création / édition d'un marché ──────────────────────────────────

function MarcheForm({ initial, onSave, onClose }: { initial: Marche | null; onSave: (m: Marche) => void; onClose: () => void }) {
  const [f, setF] = useState<Marche>(initial ?? {
    id: `m-${Date.now().toString(36)}`,
    reference: '', objet: '', entreprise: '', montantHT: 0,
    dateSignature: '', dateFin: '', avancement: 0,
    statut: 'en_cours', direction: 'DER', type: 'Travaux', bailleur: 'SENELEC',
    avenants: [], penalites: [], garanties: [], observations: '',
  });
  const set = <K extends keyof Marche>(k: K, v: Marche[K]) => setF(prev => ({ ...prev, [k]: v }));
  const valid = f.reference.trim() !== '' && f.objet.trim() !== '' && f.entreprise.trim() !== '';
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 220, background: 'rgba(14,52,96,0.65)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: 24, overflowY: 'auto' }}>
      <div style={{ width: '100%', maxWidth: 620, background: 'var(--bg-card)', borderRadius: 12, boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-2)', background: 'var(--navy)', color: '#fff', borderRadius: '12px 12px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 15, fontWeight: 800 }}>{initial ? 'Modifier le marché' : 'Nouveau marché'}</span>
          <button onClick={onClose} aria-label="Fermer le formulaire" style={{ padding: 6, borderRadius: 7, background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex' }}><X size={16} /></button>
        </div>
        <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={lbl}>Référence *</label>
            <input className="form-input" value={f.reference} onChange={e => set('reference', e.target.value)} placeholder="MRK-DER-2026-00X" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={lbl}>Objet *</label>
            <input className="form-input" value={f.objet} onChange={e => set('objet', e.target.value)} placeholder="Objet du marché" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={lbl}>Entreprise titulaire *</label>
            <input className="form-input" value={f.entreprise} onChange={e => set('entreprise', e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Montant HTVA (FCFA)</label>
            <input className="form-input" type="number" value={f.montantHT} onChange={e => set('montantHT', Number(e.target.value))} />
          </div>
          <div>
            <label style={lbl}>Avancement (%)</label>
            <input className="form-input" type="number" min={0} max={100} value={f.avancement} onChange={e => set('avancement', Math.max(0, Math.min(100, Number(e.target.value))))} />
          </div>
          <div>
            <label style={lbl}>Date signature</label>
            <input className="form-input" value={f.dateSignature} onChange={e => set('dateSignature', e.target.value)} placeholder="JJ/MM/AAAA" />
          </div>
          <div>
            <label style={lbl}>Date fin prévue</label>
            <input className="form-input" value={f.dateFin} onChange={e => set('dateFin', e.target.value)} placeholder="JJ/MM/AAAA" />
          </div>
          <div>
            <label style={lbl}>Direction</label>
            <select className="form-input" value={f.direction} onChange={e => set('direction', e.target.value)}>
              {DIRECTIONS_LIST.filter(d => d !== 'Tous').map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Type</label>
            <select className="form-input" value={f.type} onChange={e => set('type', e.target.value as TypeMarche)}>
              {TYPES_LIST.filter(t => t !== 'Tous').map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Bailleur</label>
            <select className="form-input" value={f.bailleur} onChange={e => set('bailleur', e.target.value)}>
              {BAILLEURS_LIST.filter(b => b !== 'Tous').map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Statut</label>
            <select className="form-input" value={f.statut} onChange={e => set('statut', e.target.value as StatutMarche)}>
              {(['en_cours', 'termine', 'resilie'] as StatutMarche[]).map(s => <option key={s} value={s}>{STATUT_CFG[s].label}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={lbl}>Observations</label>
            <textarea className="form-input" rows={2} value={f.observations ?? ''} onChange={e => set('observations', e.target.value)} />
          </div>
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-2)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary btn-sm" disabled={!valid} style={{ opacity: valid ? 1 : 0.5, cursor: valid ? 'pointer' : 'not-allowed' }} onClick={() => onSave(f)}>
            {initial ? 'Enregistrer' : 'Créer le marché'}
          </button>
        </div>
      </div>
    </div>
  );
}
