'use client';

import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import {
  Layers, ChevronRight, ChevronDown, FolderOpen, Activity,
  TrendingUp, AlertTriangle, CheckCircle2, Users, Calendar,
  Filter, Plus, Download, X, Save, Search, Trash2,
} from 'lucide-react';
import { useProjectStore, DOMAINE_CFG, type Domaine, type StatutProjet } from '@/lib/projectStore';
import { useProgrammeStore, type UserProgramme, type StatutProgramme } from '@/lib/programmeStore';

/* ─── Brand ─────────────────────────────── */
const NAVY   = '#1B4F8A';
const ORANGE = '#F47920';
const RED    = '#EF3340';
const GREEN  = '#16A34A';
const AMBER  = '#D97706';
const PURPLE = '#8B5CF6';

/* ─── Statut config ─────────────────────── */
const STATUT_PRG: Record<StatutProgramme, { label: string; color: string; bg: string }> = {
  actif:     { label: 'Actif',     color: GREEN,     bg: '#DCFCE7' },
  planifie:  { label: 'Planifié',  color: NAVY,      bg: '#EFF6FF' },
  cloture:   { label: 'Clôturé',  color: '#64748B', bg: '#F1F5F9' },
  suspendu:  { label: 'Suspendu', color: AMBER,     bg: '#FFF7ED' },
};

function fmtBudget(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(2) + ' Md';
  return n.toLocaleString('fr-FR') + ' M';
}

/* ─── Formulaire nouveau programme ─────── */
interface PrgForm {
  nom: string;
  code: string;
  domaine: Domaine | 'multi';
  chef: string;
  dateDebut: string;
  dateFin: string;
  statut: StatutProgramme;
  bailleur: string;
  description: string;
}
const EMPTY_FORM: PrgForm = {
  nom: '', code: '', domaine: 'multi', chef: '',
  dateDebut: new Date().toISOString().split('T')[0],
  dateFin: `${new Date().getFullYear()}-12-31`,
  statut: 'actif', bailleur: '', description: '',
};

/* ─────────────────────────────────────────────────
   COMPOSANT PRINCIPAL
───────────────────────────────────────────────── */
export default function Programmes() {
  const store         = useProjectStore();
  const prgStore      = useProgrammeStore();
  const [expandedPrg, setExpandedPrg] = useState<string | null>(null);

  /* Filtre domaine global */
  const filtreDomaine = store.globalDomaine;
  const setFiltreDomaine = store.setGlobalDomaine;

  /* ── Modal : Nouveau programme ─────────── */
  const [showNvModal, setShowNvModal] = useState(false);
  const [nvForm, setNvForm]           = useState<PrgForm>(EMPTY_FORM);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchProj, setSearchProj]   = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  /* ── Modal : Ajouter un projet existant à un programme ─ */
  const [addModal, setAddModal]       = useState<{ programmeId: string; domaine: Domaine | 'multi' } | null>(null);
  const [addSearch, setAddSearch]     = useState('');

  /* ── Modal : Créer un nouveau projet (quick add) ─ */
  const [quickModal, setQuickModal]   = useState<{ programmeId: string; domaine: Domaine } | null>(null);
  const [quickForm, setQuickForm]     = useState({ nom: '', code: '', chefProjet: '', budget: '', region: 'Dakar' });

  /* ══════════════════════════════════════════
     DONNÉES : user-created + auto-domain
  ═══════════════════════════════════════════ */

  /** IDs de projets déjà assignés à un programme utilisateur */
  const assignedIds = useMemo(() => {
    const ids = new Set<string>();
    prgStore.programmes.forEach(p => p.projetsIds.forEach(id => ids.add(id)));
    return ids;
  }, [prgStore.programmes]);

  /** Programmes auto-domaine (projets NON dans un programme user) */
  const autoPrograms = useMemo(() => {
    const p         = store.projets.filter(pr => !assignedIds.has(pr.id));
    const allDom    = ['production', 'transport', 'distribution', 'commercial', 'genie_civil'] as Domaine[];
    const present   = new Set(p.map(pr => pr.domaine));
    return allDom.filter(d => present.has(d)).map((d, i) => {
      const dProjets = p.filter(pr => pr.domaine === d);
      const totalB   = dProjets.reduce((s, x) => s + x.budget, 0);
      const totalD   = dProjets.reduce((s, x) => s + x.budgetDecaisse, 0);
      const avg      = dProjets.length > 0
        ? Math.round(dProjets.reduce((s, x) => s + x.avancement, 0) / dProjets.length)
        : [62, 45, 78, 31, 55][i] ?? 0;
      return {
        id: `auto-${d}`,
        code: `PRG-${d.toUpperCase().slice(0, 3)}-${new Date().getFullYear()}`,
        nom: `Programme ${DOMAINE_CFG[d].label}`,
        domaine: d as Domaine | 'multi',
        chef: ['CP Diallo', 'CP Ndiaye', 'CP Traoré', 'CP Sow'][i] ?? 'CP',
        budget: totalB || (i + 1) * 2500,
        decaisse: totalD || (i + 1) * 1200,
        avancement: avg,
        statut: 'actif' as StatutProgramme,
        projetsIds: dProjets.map(pr => pr.id),
        dateDebut: `${new Date().getFullYear()}-01-01`,
        dateFin:   `${new Date().getFullYear()}-12-31`,
        isAuto: true,
      };
    });
  }, [store.projets, assignedIds]);

  /** Programmes user enrichis avec KPIs calculés */
  const userPrograms = useMemo(() =>
    prgStore.programmes.map(prg => {
      const dProjets = store.projets.filter(pr => prg.projetsIds.includes(pr.id));
      return {
        ...prg,
        budget:     dProjets.reduce((s, x) => s + x.budget, 0),
        decaisse:   dProjets.reduce((s, x) => s + x.budgetDecaisse, 0),
        avancement: dProjets.length > 0
          ? Math.round(dProjets.reduce((s, x) => s + x.avancement, 0) / dProjets.length)
          : 0,
        isAuto: false,
      };
    }), [prgStore.programmes, store.projets]);

  /** Tous les programmes fusionnés (user d'abord, puis auto) */
  const allPrograms = [...userPrograms, ...autoPrograms];

  /** Filtre global domaine */
  const filtres = allPrograms.filter(p =>
    filtreDomaine === 'tous' ||
    p.domaine === filtreDomaine ||
    p.domaine === 'multi'
  );

  /* Bar chart — limité aux programmes du filtre actif */
  const chartData = filtres.map(p => ({
    name: p.domaine === 'multi' ? p.nom.slice(0, 18) : DOMAINE_CFG[p.domaine as Domaine]?.label ?? p.nom,
    budget:   +(p.budget / 1000).toFixed(1),
    decaisse: +(p.decaisse / 1000).toFixed(1),
    color:    p.domaine === 'multi' ? PURPLE : (DOMAINE_CFG[p.domaine as Domaine]?.color ?? NAVY),
  }));

  /* ══════════════════════════════════════════
     ACTIONS
  ═══════════════════════════════════════════ */

  const toggleSelectProjet = (id: string) =>
    setSelectedIds(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });

  const submitNouveauProgramme = () => {
    if (!nvForm.nom.trim()) return;
    prgStore.addProgramme({
      nom:        nvForm.nom.trim(),
      code:       nvForm.code.trim() || `PRG-${Date.now().toString(36).toUpperCase().slice(-5)}`,
      domaine:    nvForm.domaine,
      chef:       nvForm.chef.trim(),
      dateDebut:  nvForm.dateDebut,
      dateFin:    nvForm.dateFin,
      statut:     nvForm.statut,
      bailleur:   nvForm.bailleur.trim() || undefined,
      description:nvForm.description.trim() || undefined,
      projetsIds: Array.from(selectedIds),
    });
    /* Mettre à jour le champ programme sur chaque projet sélectionné */
    Array.from(selectedIds).forEach(id =>
      store.updateProjet(id, { programme: nvForm.code.trim() || nvForm.nom.trim() })
    );
    setShowNvModal(false);
    setNvForm(EMPTY_FORM);
    setSelectedIds(new Set());
    setSearchProj('');
  };

  const submitAddExisting = (projetId: string) => {
    if (!addModal) return;
    prgStore.addProjetToProgramme(addModal.programmeId, projetId);
    store.updateProjet(projetId, { programme: addModal.programmeId });
  };

  const submitQuickProjet = () => {
    if (!quickModal || !quickForm.nom.trim()) return;
    const created = store.createProjet({
      domaine:           quickModal.domaine,
      nom:               quickForm.nom.trim(),
      code:              quickForm.code.trim(),
      description:       '',
      chefProjet:        quickForm.chefProjet.trim(),
      localisation:      quickForm.region,
      region:            quickForm.region,
      avancement:        0,
      avancementPlanifie:0,
      budget:            parseFloat(quickForm.budget) || 0,
      budgetEngage:      0,
      budgetDecaisse:    0,
      dateDebut:         new Date().toISOString().split('T')[0],
      dateFinPrevue:     new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
      dateFinEstimee:    new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
      statut:            'planifie' as StatutProjet,
      priorite:          'Moyenne' as const,
      cpi: 1, spi: 1,
      bailleurs: [], equipe: [], jalons: [], phases: [],
      unite:      quickModal.domaine.toUpperCase().slice(0, 3),
      programme:  quickModal.programmeId,
    });
    prgStore.addProjetToProgramme(quickModal.programmeId, created.id);
    setQuickModal(null);
    setQuickForm({ nom: '', code: '', chefProjet: '', budget: '', region: 'Dakar' });
  };

  /* ══════════════════════════════════════════
     RENDER HELPERS
  ═══════════════════════════════════════════ */
  const projetsDisponibles = store.projets.filter(pr =>
    (searchProj === '' || pr.nom.toLowerCase().includes(searchProj.toLowerCase()) || pr.code.toLowerCase().includes(searchProj.toLowerCase())) &&
    (nvForm.domaine === 'multi' || pr.domaine === nvForm.domaine)
  );

  const projetsAddables = store.projets.filter(pr => {
    if (!addModal) return false;
    const prg = prgStore.programmes.find(p => p.id === addModal.programmeId);
    if (prg?.projetsIds.includes(pr.id)) return false;
    if (addSearch && !pr.nom.toLowerCase().includes(addSearch.toLowerCase()) && !pr.code.toLowerCase().includes(addSearch.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#F8FAFD' }}>

      {/* ─── Header ─────────────────────────────────────────────── */}
      <div style={{
        padding: '16px 24px 12px',
        background: '#fff', borderBottom: '1px solid #E2E8F0', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Layers size={22} style={{ color: NAVY }} />
              Programmes DPE
            </h1>
            <p style={{ fontSize: 12.5, color: '#64748B', margin: '3px 0 0' }}>
              Portefeuille › Programmes › Projets — Hiérarchie complète
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
            <button
              onClick={() => { setShowNvModal(true); setNvForm(EMPTY_FORM); setSelectedIds(new Set()); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 7, border: 'none',
                background: NAVY, color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <Plus size={13} /> Nouveau programme
            </button>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ─── KPI barre ────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {[
            { label: 'Programmes actifs',  value: filtres.filter(p => p.statut === 'actif').length, color: NAVY,   icon: <Layers size={16} style={{ color: NAVY }} /> },
            { label: 'Budget total',        value: fmtBudget(filtres.reduce((s, p) => s + p.budget, 0)) + ' FCFA', color: GREEN,  icon: <TrendingUp size={16} style={{ color: GREEN }} /> },
            { label: 'Projets rattachés',  value: filtres.reduce((s, p) => s + p.projetsIds.length, 0), color: PURPLE, icon: <FolderOpen size={16} style={{ color: PURPLE }} /> },
            { label: 'Avancement moyen',   value: `${Math.round(filtres.reduce((s, p) => s + (Number.isFinite(p.avancement) ? p.avancement : 0), 0) / (filtres.length || 1))}%`, color: ORANGE, icon: <Activity size={16} style={{ color: ORANGE }} /> },
          ].map(k => (
            <div key={k.label} style={{
              flex: '1 1 160px', background: '#fff', border: `1px solid #E2E8F0`,
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
        {filtres.length > 0 && (
          <div style={{
            background: '#fff', borderRadius: 10, border: '1px solid #E2E8F0',
            padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 12 }}>
              Répartition budget par programme (Md FCFA)
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chartData} barSize={28}>
                <CartesianGrid stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10.5, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number) => [v + ' Md FCFA']} />
                <Bar dataKey="budget"   name="Budget"   fill={NAVY}  radius={[4, 4, 0, 0]} opacity={0.8} />
                <Bar dataKey="decaisse" name="Décaissé" fill={ORANGE} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ─── Hiérarchie Programmes ─────────────────────────────── */}
        <div style={{
          background: '#fff', borderRadius: 10, border: '1px solid #E2E8F0',
          boxShadow: '0 1px 4px rgba(0,0,0,0.05)', overflow: 'hidden',
        }}>
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid #F1F5F9',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            fontSize: 13.5, fontWeight: 700, color: '#0F172A',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Layers size={14} style={{ color: NAVY }} />
              Hiérarchie Portefeuille DPE
              <span style={{ fontSize: 10.5, color: '#94A3B8', marginLeft: 4 }}>
                {filtres.length} programmes · {filtres.reduce((s, p) => s + p.projetsIds.length, 0)} projets
              </span>
            </div>
            {prgStore.programmes.length > 0 && (
              <span style={{ fontSize: 10.5, color: PURPLE, fontWeight: 600 }}>
                {prgStore.programmes.length} programme(s) personnalisé(s)
              </span>
            )}
          </div>

          {filtres.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
              Aucun programme dans ce domaine
            </div>
          )}

          {filtres.map((prg, pi) => {
            const isUserPrg = !prg.isAuto;
            const dcfg    = prg.domaine !== 'multi' ? DOMAINE_CFG[prg.domaine as Domaine] : null;
            const scfg    = STATUT_PRG[prg.statut];
            const open    = expandedPrg === prg.id;
            const projetsRataches = store.projets.filter(p => prg.projetsIds.includes(p.id));
            const engPct  = prg.budget > 0 ? Math.round((prg.decaisse / prg.budget) * 100) : 0;
            const prgColor = dcfg?.color ?? PURPLE;

            return (
              <div key={prg.id} style={{ borderBottom: pi < filtres.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                {/* Ligne programme */}
                <div
                  onClick={() => setExpandedPrg(open ? null : prg.id)}
                  style={{
                    padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
                    cursor: 'pointer', background: open ? '#F8FAFC' : '#fff',
                    transition: 'background 0.1s',
                    borderLeft: isUserPrg ? `3px solid ${PURPLE}` : 'none',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                  onMouseLeave={e => { if (!open) e.currentTarget.style.background = '#fff'; }}
                >
                  {open
                    ? <ChevronDown  size={14} style={{ color: '#94A3B8', flexShrink: 0 }} />
                    : <ChevronRight size={14} style={{ color: '#94A3B8', flexShrink: 0 }} />}

                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: `${prgColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16,
                  }}>
                    {dcfg ? dcfg.emoji : '📋'}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10.5, color: prgColor, fontWeight: 700, flexShrink: 0 }}>{prg.code}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{prg.nom}</span>
                      {isUserPrg && (
                        <span style={{ fontSize: 9.5, background: '#EDE9FE', color: PURPLE, padding: '1px 6px', borderRadius: 8, fontWeight: 700, flexShrink: 0 }}>
                          Personnalisé
                        </span>
                      )}
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
                  <div style={{ width: 140, flexShrink: 0, textAlign: 'right' }}>
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

                  {/* Supprimer (user seulement) */}
                  {isUserPrg && (
                    <button
                      onClick={e => { e.stopPropagation(); setConfirmDelete(prg.id); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CBD5E1', padding: 4, flexShrink: 0 }}
                      title="Supprimer ce programme"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
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
                        const trf = p.budgetEngage > 0 ? Math.round((p.budgetDecaisse / p.budgetEngage) * 100) : 0;
                        const trp = p.avancementPlanifie > 0 ? Math.round((p.avancement / p.avancementPlanifie) * 100) : 100;
                        const pcolor = dcfg?.color ?? PURPLE;
                        return (
                          <div key={p.id} style={{
                            padding: '9px 16px 9px 56px',
                            borderBottom: pi2 < projetsRataches.length - 1 ? '1px solid #F1F5F9' : 'none',
                            display: 'flex', alignItems: 'center', gap: 12,
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#F0F4FA')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: pcolor, flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12.5, fontWeight: 600, color: '#1E293B' }}>
                                <span style={{ fontSize: 10, color: pcolor, fontWeight: 700, marginRight: 6 }}>{p.code}</span>
                                {p.nom.length > 60 ? p.nom.slice(0, 60) + '…' : p.nom}
                              </div>
                              <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 2 }}>
                                Avancement {p.avancement}% · Budget {fmtBudget(p.budget)} FCFA · {p.region}
                              </div>
                            </div>
                            <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: trf >= 70 ? '#DCFCE7' : '#FEE2E2', color: trf >= 70 ? GREEN : RED }}>TRF {trf}%</span>
                            <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: trp >= 80 ? '#DCFCE7' : '#FFF7ED', color: trp >= 80 ? GREEN : AMBER }}>TRP {trp}%</span>
                            {isUserPrg && (
                              <button
                                onClick={() => prgStore.removeProjetFromProgramme(prg.id, p.id)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CBD5E1', padding: 2 }}
                                title="Retirer du programme"
                              >
                                <X size={11} />
                              </button>
                            )}
                            <ChevronRight size={12} style={{ color: '#CBD5E1', flexShrink: 0 }} />
                          </div>
                        );
                      })
                    )}
                    <div style={{ padding: '8px 16px 8px 56px', display: 'flex', gap: 8 }}>
                      {/* Ajouter un projet existant */}
                      <button
                        onClick={() => { setAddModal({ programmeId: prg.id, domaine: prg.domaine }); setAddSearch(''); }}
                        style={{
                          fontSize: 11.5, color: NAVY, background: '#EFF6FF',
                          border: '1px solid #BFDBFE', padding: '4px 10px', borderRadius: 6,
                          cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
                          display: 'flex', alignItems: 'center', gap: 4,
                        }}>
                        <Plus size={11} /> Rattacher projet existant
                      </button>
                      {/* Créer un nouveau projet (seulement sur programmes auto-domaine) */}
                      {prg.isAuto && prg.domaine !== 'multi' && (
                        <button
                          onClick={() => { setQuickModal({ programmeId: prg.id, domaine: prg.domaine as Domaine }); setQuickForm({ nom: '', code: '', chefProjet: '', budget: '', region: 'Dakar' }); }}
                          style={{
                            fontSize: 11.5, color: GREEN, background: '#DCFCE7',
                            border: '1px solid #BBF7D0', padding: '4px 10px', borderRadius: 6,
                            cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
                            display: 'flex', alignItems: 'center', gap: 4,
                          }}>
                          <Plus size={11} /> Nouveau projet
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          MODAL : Nouveau programme (multi-select projets existants)
      ══════════════════════════════════════════════════════════ */}
      {showNvModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setShowNvModal(false)}>
          <div style={{
            background: '#fff', borderRadius: 14, width: '100%', maxWidth: 700, maxHeight: '90vh',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 20px 60px rgba(0,0,0,0.25)', border: '1px solid #E2E8F0',
          }} onClick={e => e.stopPropagation()}>

            {/* Header modal */}
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #F1F5F9', flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: '#0F172A' }}>Nouveau programme</div>
                  <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                    Définissez le programme puis sélectionnez les projets à regrouper
                  </div>
                </div>
                <button onClick={() => setShowNvModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Body modal scrollable */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

              {/* ── Infos programme ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
                {[
                  { key: 'nom',    label: 'Nom du programme *', placeholder: 'Ex : Programme PADAES', fullWidth: true },
                  { key: 'code',   label: 'Code / Référence',    placeholder: 'Ex : PADAES-2026' },
                  { key: 'chef',   label: 'Chef de programme',   placeholder: 'Prénom NOM' },
                  { key: 'bailleur', label: 'Bailleur de fonds', placeholder: 'BEI, Banque Mondiale…' },
                  { key: 'dateDebut', label: 'Date début', type: 'date' },
                  { key: 'dateFin',   label: 'Date fin',   type: 'date' },
                ].map(f => (
                  <div key={f.key} style={{ gridColumn: f.fullWidth ? '1 / -1' : 'auto' }}>
                    <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>{f.label}</label>
                    <input
                      type={f.type ?? 'text'}
                      placeholder={f.placeholder}
                      value={(nvForm as unknown as Record<string, string>)[f.key]}
                      onChange={e => setNvForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 7, border: '1px solid #E2E8F0', fontSize: 12.5, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                ))}

                {/* Domaine */}
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Domaine</label>
                  <select
                    value={nvForm.domaine}
                    onChange={e => setNvForm(prev => ({ ...prev, domaine: e.target.value as Domaine | 'multi' }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 7, border: '1px solid #E2E8F0', fontSize: 12.5, fontFamily: 'inherit', background: '#fff' }}
                  >
                    <option value="multi">Multi-domaines</option>
                    {Object.entries(DOMAINE_CFG).map(([k, v]) => (
                      <option key={k} value={k}>{v.emoji} {v.label}</option>
                    ))}
                  </select>
                </div>

                {/* Statut */}
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Statut</label>
                  <select
                    value={nvForm.statut}
                    onChange={e => setNvForm(prev => ({ ...prev, statut: e.target.value as StatutProgramme }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 7, border: '1px solid #E2E8F0', fontSize: 12.5, fontFamily: 'inherit', background: '#fff' }}
                  >
                    {Object.entries(STATUT_PRG).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ── Sélection des projets ── */}
              <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
                    Projets à inclure
                    {selectedIds.size > 0 && (
                      <span style={{ marginLeft: 8, fontSize: 11.5, background: '#EDE9FE', color: PURPLE, padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>
                        {selectedIds.size} sélectionné(s)
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#94A3B8' }}>
                    {projetsDisponibles.length} projet(s) disponibles
                  </div>
                </div>

                {/* Barre de recherche */}
                <div style={{ position: 'relative', marginBottom: 12 }}>
                  <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                  <input
                    placeholder="Rechercher un projet…"
                    value={searchProj}
                    onChange={e => setSearchProj(e.target.value)}
                    style={{
                      width: '100%', padding: '8px 12px 8px 32px', borderRadius: 7,
                      border: '1px solid #E2E8F0', fontSize: 12.5, fontFamily: 'inherit',
                      outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* Sélection tout / rien */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <button onClick={() => setSelectedIds(new Set(projetsDisponibles.map(p => p.id)))}
                    style={{ fontSize: 11, padding: '3px 10px', borderRadius: 5, border: '1px solid #E2E8F0', background: '#F8FAFD', cursor: 'pointer', fontFamily: 'inherit', color: '#475569' }}>
                    Tout sélectionner
                  </button>
                  <button onClick={() => setSelectedIds(new Set())}
                    style={{ fontSize: 11, padding: '3px 10px', borderRadius: 5, border: '1px solid #E2E8F0', background: '#F8FAFD', cursor: 'pointer', fontFamily: 'inherit', color: '#475569' }}>
                    Tout désélectionner
                  </button>
                </div>

                {/* Liste des projets */}
                <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid #F1F5F9', borderRadius: 8 }}>
                  {projetsDisponibles.length === 0 ? (
                    <div style={{ padding: 20, textAlign: 'center', color: '#94A3B8', fontSize: 12 }}>Aucun projet trouvé</div>
                  ) : (
                    projetsDisponibles.map((p, i) => {
                      const checked = selectedIds.has(p.id);
                      const dcfg2 = DOMAINE_CFG[p.domaine];
                      return (
                        <div
                          key={p.id}
                          onClick={() => toggleSelectProjet(p.id)}
                          style={{
                            padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 12,
                            borderBottom: i < projetsDisponibles.length - 1 ? '1px solid #F8FAFD' : 'none',
                            background: checked ? '#F5F3FF' : '#fff',
                            cursor: 'pointer', transition: 'background 0.1s',
                          }}
                          onMouseEnter={e => { if (!checked) e.currentTarget.style.background = '#F8FAFD'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = checked ? '#F5F3FF' : '#fff'; }}
                        >
                          <input type="checkbox" checked={checked} onChange={() => toggleSelectProjet(p.id)} style={{ width: 15, height: 15, accentColor: PURPLE, cursor: 'pointer', flexShrink: 0 }} />
                          <span style={{ fontSize: 13, flexShrink: 0 }}>{dcfg2?.emoji ?? '📁'}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 600, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {p.code && <span style={{ fontSize: 10, color: dcfg2?.color ?? NAVY, fontWeight: 700, marginRight: 6 }}>{p.code}</span>}
                              {p.nom}
                            </div>
                            <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 1 }}>
                              {dcfg2?.label ?? p.domaine} · {p.region} · {fmtBudget(p.budget)} FCFA · {p.avancement}%
                            </div>
                          </div>
                          {assignedIds.has(p.id) && (
                            <span style={{ fontSize: 9.5, background: '#FFF7ED', color: AMBER, padding: '1px 6px', borderRadius: 6, fontWeight: 700, flexShrink: 0 }}>
                              Déjà assigné
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Footer modal */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid #F1F5F9', flexShrink: 0, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowNvModal(false)} style={{ padding: '9px 20px', borderRadius: 7, border: '1px solid #E2E8F0', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Annuler
              </button>
              <button
                onClick={submitNouveauProgramme}
                disabled={!nvForm.nom.trim()}
                style={{
                  padding: '9px 22px', borderRadius: 7, border: 'none',
                  background: nvForm.nom.trim() ? NAVY : '#94A3B8', color: '#fff',
                  fontSize: 13, fontWeight: 700, cursor: nvForm.nom.trim() ? 'pointer' : 'not-allowed',
                  fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 7,
                }}>
                <Save size={14} /> Créer le programme ({selectedIds.size} projet{selectedIds.size !== 1 ? 's' : ''})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          MODAL : Rattacher projet existant à un programme
      ══════════════════════════════════════════════════════════ */}
      {addModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setAddModal(null)}>
          <div style={{
            background: '#fff', borderRadius: 14, width: '100%', maxWidth: 520, maxHeight: '80vh',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 16px 48px rgba(0,0,0,0.22)', border: '1px solid #E2E8F0',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid #F1F5F9', flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>Rattacher un projet</div>
                <button onClick={() => setAddModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={18} /></button>
              </div>
              <div style={{ position: 'relative', marginTop: 12 }}>
                <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                <input
                  placeholder="Rechercher…"
                  value={addSearch}
                  onChange={e => setAddSearch(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px 7px 30px', borderRadius: 7, border: '1px solid #E2E8F0', fontSize: 12.5, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
              {projetsAddables.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: '#94A3B8', fontSize: 12 }}>Aucun projet disponible</div>
              ) : (
                projetsAddables.map(p => {
                  const dcfg2 = DOMAINE_CFG[p.domaine];
                  return (
                    <div
                      key={p.id}
                      onClick={() => { submitAddExisting(p.id); setAddModal(null); }}
                      style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', borderBottom: '1px solid #F8FAFD' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#F5F3FF')}
                      onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                    >
                      <span style={{ fontSize: 14 }}>{dcfg2?.emoji ?? '📁'}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.code && <span style={{ fontSize: 10, color: dcfg2?.color ?? NAVY, marginRight: 6, fontWeight: 700 }}>{p.code}</span>}
                          {p.nom}
                        </div>
                        <div style={{ fontSize: 10.5, color: '#94A3B8' }}>{dcfg2?.label} · {p.region} · {p.avancement}%</div>
                      </div>
                      <ChevronRight size={12} style={{ color: '#CBD5E1' }} />
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          MODAL : Nouveau projet (quick add dans programme auto)
      ══════════════════════════════════════════════════════════ */}
      {quickModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setQuickModal(null)}>
          <div style={{
            background: '#fff', borderRadius: 14, padding: '24px 28px', width: '100%', maxWidth: 480,
            boxShadow: '0 16px 48px rgba(0,0,0,0.22)', border: '1px solid #E2E8F0',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A' }}>Nouveau projet</div>
                <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>
                  Domaine {DOMAINE_CFG[quickModal.domaine].emoji} {DOMAINE_CFG[quickModal.domaine].label}
                </div>
              </div>
              <button onClick={() => setQuickModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={18} /></button>
            </div>
            {[
              { key: 'nom',        label: 'Libellé du projet *', placeholder: 'Ex : Construction poste HTA Keur Massar', required: true },
              { key: 'code',       label: 'Code BIT / Référence', placeholder: 'Ex : 23DM10014027' },
              { key: 'chefProjet', label: 'Chef de projet',        placeholder: 'Prénom NOM' },
              { key: 'budget',     label: 'Budget global (M FCFA)', placeholder: '0', type: 'number' },
              { key: 'region',     label: 'Région / Zone',          placeholder: 'Dakar' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>{f.label}</label>
                <input
                  type={f.type ?? 'text'}
                  placeholder={f.placeholder}
                  value={(quickForm as Record<string, string>)[f.key]}
                  onChange={e => setQuickForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 7, border: '1px solid #E2E8F0', fontSize: 12.5, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button onClick={() => setQuickModal(null)} style={{ padding: '8px 18px', borderRadius: 7, border: '1px solid #E2E8F0', background: '#fff', color: '#374151', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Annuler
              </button>
              <button
                onClick={submitQuickProjet}
                disabled={!quickForm.nom.trim()}
                style={{
                  padding: '8px 18px', borderRadius: 7, border: 'none',
                  background: quickForm.nom.trim() ? GREEN : '#94A3B8', color: '#fff',
                  fontSize: 12.5, fontWeight: 700, cursor: quickForm.nom.trim() ? 'pointer' : 'not-allowed',
                  fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
                }}>
                <Save size={13} /> Créer le projet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmation suppression programme ── */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setConfirmDelete(null)}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '24px 28px', maxWidth: 400, width: '90%', boxShadow: '0 16px 48px rgba(0,0,0,0.22)' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', marginBottom: 10 }}>Supprimer ce programme ?</div>
            <div style={{ fontSize: 12.5, color: '#64748B', marginBottom: 20 }}>
              Les projets rattachés ne seront pas supprimés — ils repasseront dans leur programme de domaine.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmDelete(null)} style={{ padding: '8px 18px', borderRadius: 7, border: '1px solid #E2E8F0', background: '#fff', color: '#374151', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Annuler
              </button>
              <button
                onClick={() => { prgStore.deleteProgramme(confirmDelete); setConfirmDelete(null); }}
                style={{ padding: '8px 18px', borderRadius: 7, border: 'none', background: RED, color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
