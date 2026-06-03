'use client';

import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
  ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend, Cell,
} from 'recharts';
import {
  Users, Wrench, AlertTriangle, Activity, Plus, Pencil, Trash2, X, Check, CheckCircle,
} from 'lucide-react';
import { downloadExcel } from '@/lib/exportUtils';
import { useProjectStore, type Ressource, type TypeRessource, DOMAINE_CFG } from '@/lib/projectStore';
import { PERSONNEL_DPE, EFFECTIF_TOTAL, effectifParDirection, effectifParCollege, effectifParSexe, ORG_DPE, ORG_DPE_RACINE, agentsUnite, responsableUnite, deptOf } from '@/lib/dpePersonnel';

// ─── Constants ────────────────────────────────────────────────────────────────

const DIRECTIONS = ['DER', 'DEP', 'DIT', 'DGC', 'CPBM-UE', 'CC26', 'CPAMACEL', 'CPADERAU'];
const TYPES: TypeRessource[] = ['Travail', 'Matériel', 'Coût'];
const NEXT_8_MONTHS: string[] = (() => {
  const out: string[] = [];
  const d = new Date(2026, 4); // May 2026
  for (let i = 0; i < 8; i++) {
    out.push(d.toLocaleString('fr-FR', { month: 'short', year: '2-digit' }));
    d.setMonth(d.getMonth() + 1);
  }
  return out;
})();

const SAMPLE_HABILITATIONS = [
  { habilitation: 'Consignation HTA', date: '2023-03-10', expiry: '2025-03-10' },
  { habilitation: 'Travaux sous tension BT', date: '2022-11-15', expiry: '2024-11-15' },
  { habilitation: 'Conduite de nacelle', date: '2024-01-20', expiry: '2026-01-20' },
  { habilitation: 'ATEX zone 1', date: '2023-06-05', expiry: '2026-06-05' },
  { habilitation: 'SST (sauveteur secouriste)', date: '2024-04-12', expiry: '2026-04-12' },
  { habilitation: 'Habilitation électrique B2V', date: '2022-08-01', expiry: '2024-08-01' },
  { habilitation: 'CACES R486', date: '2023-09-30', expiry: '2028-09-30' },
];

// ─── Style helpers ────────────────────────────────────────────────────────────

const NAVY = '#1B4F8A';
const RED = '#EF3340';
const ORANGE = '#F37021';
const GREEN = '#16A34A';
const WHITE = '#FFFFFF';

function chargeColor(v: number): { bg: string; text: string } {
  if (v > 100) return { bg: '#FEE2E2', text: '#991B1B' };
  if (v >= 80) return { bg: '#FEF3C7', text: '#92400E' };
  return { bg: '#DCFCE7', text: '#166534' };
}

function barColor(v: number): string {
  if (v > 100) return RED;
  if (v >= 80) return ORANGE;
  return GREEN;
}

function typeBadge(type: TypeRessource): React.CSSProperties {
  if (type === 'Travail') return { background: '#EFF6FF', color: NAVY, border: `1px solid ${NAVY}40` };
  if (type === 'Matériel') return { background: '#FFF7ED', color: '#9A3412', border: '1px solid #9A341240' };
  return { background: '#F5F3FF', color: '#6D28D9', border: '1px solid #6D28D940' };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div style={{
      background: WHITE, borderRadius: 10, padding: '14px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.10)',
      borderTop: `3px solid ${accent ?? NAVY}`, minWidth: 140, flex: 1,
    }}>
      <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: accent ?? NAVY, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ─── Modal form type ──────────────────────────────────────────────────────────

interface RessourceForm {
  prenom: string;
  nom: string;
  type: TypeRessource;
  direction: string;
  tauxHoraire: string;
  capaciteMax: string;
  email: string;
  telephone: string;
  unite: string;
}

const EMPTY_FORM: RessourceForm = {
  prenom: '', nom: '', type: 'Travail', direction: 'DER',
  tauxHoraire: '', capaciteMax: '100', email: '', telephone: '', unite: '',
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RH() {
  const store = useProjectStore();
  const [activeTab, setActiveTab] = useState(0);

  // ── Annuaire state ──
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RessourceForm>(EMPTY_FORM);
  const [inlineEdit, setInlineEdit] = useState<{ id: string; field: 'tauxHoraire' | 'capaciteMax'; val: string } | null>(null);

  // ── Affectation form state ──
  const [affProjetId, setAffProjetId] = useState('');
  const [affTacheId, setAffTacheId] = useState('');
  const [affRessId, setAffRessId] = useState('');
  const [affUnite, setAffUnite] = useState('100');
  const [affSuccess, setAffSuccess] = useState(false);

  // ── Radar selection ──
  const [radarSelected, setRadarSelected] = useState<string[]>([]);

  // ─── Computed: resource allocation map ───
  const allocationMap = useMemo(() => {
    // For each resource id: sum all assignation.unite across all projects/taches
    const map: Record<string, number> = {};
    store.projets.forEach(p => {
      p.taches.forEach(t => {
        t.assignations.forEach(a => {
          map[a.ressourceId] = (map[a.ressourceId] ?? 0) + a.unite;
        });
      });
    });
    return map;
  }, [store.projets]);

  // ─── Derived lists ───
  const travailRessources = store.ressources.filter(r => r.type === 'Travail');
  const totalHumain = travailRessources.length;
  const totalMateriel = store.ressources.filter(r => r.type === 'Matériel').length;
  const surchargees = travailRessources.filter(r => (allocationMap[r.id] ?? 0) > 100).length;
  const avgDispo = travailRessources.length > 0
    ? Math.round(
        travailRessources.reduce((s, r) => s + Math.max(0, r.capaciteMax - (allocationMap[r.id] ?? 0)), 0) /
        travailRessources.length
      )
    : 0;

  // ─── Tab labels ───
  const TABS = ['Annuaire', 'Charge & Affectation', 'Planification', 'Feuilles de temps', 'Effectif DPE'];

  // ── Effectif réel DPE (201 agents — fichier au 10/03/2026) ──
  const [effSearch, setEffSearch] = useState('');
  const [effDir, setEffDir] = useState('Toutes');
  const parDir = effectifParDirection;
  const parCollege = effectifParCollege;
  const parSexe = effectifParSexe;
  const personnelFiltre = useMemo(() => PERSONNEL_DPE.filter(a => {
    const okDir = effDir === 'Toutes' || a.direction === effDir;
    const q = effSearch.trim().toLowerCase();
    const okQ = !q || `${a.prenom} ${a.nom} ${a.poste} ${a.mle} ${a.fonction}`.toLowerCase().includes(q);
    return okDir && okQ;
  }), [effSearch, effDir]);
  const exportEffectifCSV = () => {
    downloadExcel('effectif_dpe', {
      sheetName: 'Effectif',
      title: 'Effectif — Direction Principale Équipement',
      subtitle: 'SENELEC · SIGEPP-DPE',
      headers: ['Matricule', 'Prénom', 'Nom', 'Sexe', 'Collège', 'Âge', 'Ancienneté', 'Direction', 'Fonction', 'Poste', 'Site'],
      rows: personnelFiltre.map(a => [a.mle, a.prenom, a.nom, a.sexe, a.college, a.age ?? '', a.anciennete ?? '', a.direction, a.fonction, a.poste, a.site]),
    });
  };

  // ─── Timesheet state ───
  type StatutTs = 'brouillon' | 'soumis' | 'valide_cp' | 'valide_rh' | 'rejete';
  interface LigneTs { projetId: string; tacheLabel: string; heures: number[] } // heures[0..6] = lun-dim
  interface Timesheet { id: string; ressourceId: string; semaine: string; lignes: LigneTs[]; statut: StatutTs; commentaireRH?: string }

  const SEMAINES = ['S20 (12-18 mai 2026)', 'S21 (19-25 mai 2026)', 'S22 (26 mai - 01 juin 2026)'];
  const [tsWeek, setTsWeek] = useState(0);
  const [tsRessId, setTsRessId] = useState(store.ressources.find(r => r.type === 'Travail')?.id ?? '');

  // Mock timesheet data (per resource × week)
  const TIMESHEETS: Timesheet[] = useMemo(() => {
    const r0 = store.ressources.find(r => r.type === 'Travail');
    const r1 = store.ressources.filter(r => r.type === 'Travail')[1];
    if (!r0) return [];
    const p0 = store.projets[0];
    const p1 = store.projets[1];
    return [
      {
        id: 'ts-s20-r0', ressourceId: r0.id, semaine: SEMAINES[0], statut: 'valide_rh',
        lignes: [
          { projetId: p0?.id ?? '', tacheLabel: 'Pose poteaux HTA', heures: [8, 8, 8, 8, 8, 4, 0] },
          { projetId: p1?.id ?? '', tacheLabel: 'Réunion coordination', heures: [0, 0, 0, 0, 0, 4, 0] },
        ],
      },
      {
        id: 'ts-s21-r0', ressourceId: r0.id, semaine: SEMAINES[1], statut: 'valide_cp',
        commentaireRH: 'En cours de validation financière',
        lignes: [
          { projetId: p0?.id ?? '', tacheLabel: 'Pose poteaux HTA', heures: [8, 8, 6, 8, 8, 0, 0] },
          { projetId: p0?.id ?? '', tacheLabel: 'Rapport semaine', heures: [0, 0, 2, 0, 0, 0, 0] },
        ],
      },
      {
        id: 'ts-s22-r0', ressourceId: r0.id, semaine: SEMAINES[2], statut: 'brouillon',
        lignes: [
          { projetId: p0?.id ?? '', tacheLabel: 'Pose poteaux HTA', heures: [8, 8, 0, 0, 0, 0, 0] },
        ],
      },
      ...(r1 ? [{
        id: 'ts-s21-r1', ressourceId: r1.id, semaine: SEMAINES[1], statut: 'soumis' as StatutTs,
        lignes: [
          { projetId: p1?.id ?? '', tacheLabel: 'Études techniques', heures: [7, 7, 8, 7, 8, 0, 0] },
        ],
      }] : []),
    ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.ressources, store.projets]);

  // Surcouche d'état pour les transitions de workflow (validation feuilles de temps)
  const [tsOverrides, setTsOverrides] = useState<Record<string, StatutTs>>({});
  const timesheets = TIMESHEETS.map(t => tsOverrides[t.id] ? { ...t, statut: tsOverrides[t.id] } : t);
  const setTsStatut = (id: string, statut: StatutTs) => setTsOverrides(prev => ({ ...prev, [id]: statut }));

  const currentTs = timesheets.find(t => t.ressourceId === tsRessId && t.semaine === SEMAINES[tsWeek]);

  const TS_STATUT_CFG: Record<StatutTs, { label: string; color: string }> = {
    brouillon:   { label: 'Brouillon',       color: '#94A3B8' },
    soumis:      { label: 'Soumis CP',        color: '#F37021' },
    valide_cp:   { label: 'Validé CP',        color: '#2563EB' },
    valide_rh:   { label: 'Validé RH',        color: '#16A34A' },
    rejete:      { label: 'Rejeté',           color: '#EF3340' },
  };
  const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  // ─── Modal helpers ───
  function openCreate() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setModalOpen(true);
  }

  function openEdit(r: Ressource) {
    setForm({
      prenom: r.prenom,
      nom: r.nom,
      type: r.type,
      direction: r.direction ?? 'DER',
      tauxHoraire: String(r.tauxHoraire),
      capaciteMax: String(r.capaciteMax),
      email: r.email ?? '',
      telephone: r.telephone ?? '',
      unite: r.unite ?? '',
    });
    setEditingId(r.id);
    setModalOpen(true);
  }

  function handleFormSubmit() {
    const payload: Omit<Ressource, 'id'> = {
      prenom: form.prenom.trim(),
      nom: form.nom.trim(),
      type: form.type,
      direction: form.direction,
      tauxHoraire: parseFloat(form.tauxHoraire) || 0,
      capaciteMax: parseInt(form.capaciteMax) || 100,
      email: form.email.trim() || undefined,
      telephone: form.telephone.trim() || undefined,
      unite: form.unite.trim() || undefined,
    };
    if (editingId) {
      store.updateRessource(editingId, payload);
    } else {
      store.createRessource(payload);
    }
    setModalOpen(false);
  }

  function commitInline() {
    if (!inlineEdit) return;
    const patch: Partial<Ressource> =
      inlineEdit.field === 'tauxHoraire'
        ? { tauxHoraire: parseFloat(inlineEdit.val) || 0 }
        : { capaciteMax: parseInt(inlineEdit.val) || 100 };
    store.updateRessource(inlineEdit.id, patch);
    setInlineEdit(null);
  }

  // ─── Bar chart data ───
  const barData = travailRessources.map(r => ({
    name: `${r.nom.slice(0, 8)}`,
    fullName: `${r.prenom} ${r.nom}`,
    charge: allocationMap[r.id] ?? 0,
    fill: barColor(allocationMap[r.id] ?? 0),
  }));

  // ─── Assignation form ───
  const affProjet = store.projets.find(p => p.id === affProjetId);
  const affTaches = affProjet ? affProjet.taches.filter(t => t.type !== 'Récapitulative') : [];

  function handleAssign() {
    if (!affProjetId || !affTacheId || !affRessId) return;
    store.assignRessource(affProjetId, affTacheId, affRessId, parseInt(affUnite) || 100);
    setAffSuccess(true);
    setTimeout(() => setAffSuccess(false), 2500);
    setAffTacheId('');
    setAffRessId('');
    setAffUnite('100');
  }

  // ─── Heatmap: monthly charge per resource ───
  // We map project tasks to months by checking if they overlap that month
  function monthlyCharge(r: Ressource, monthIdx: number): number {
    // monthIdx: 0=May2026, 1=Jun2026 ...
    const baseYear = 2026;
    const baseMonth = 4; // May = 4 (0-based)
    const targetMonth = (baseMonth + monthIdx) % 12;
    const targetYear = baseYear + Math.floor((baseMonth + monthIdx) / 12);
    const monthStart = new Date(targetYear, targetMonth, 1);
    const monthEnd = new Date(targetYear, targetMonth + 1, 0);

    let total = 0;
    store.projets.forEach(p => {
      p.taches.forEach(t => {
        t.assignations.forEach(a => {
          if (a.ressourceId !== r.id) return;
          const ts = new Date(t.dateDebut);
          const te = new Date(t.dateFin);
          if (ts <= monthEnd && te >= monthStart) {
            total += a.unite;
          }
        });
      });
    });
    return total;
  }

  // ─── Radar data ───
  function radarDataForResource(r: Ressource) {
    const charge = allocationMap[r.id] ?? 0;
    const disponibilite = Math.max(0, 100 - charge);
    const coutNorm = Math.min(100, (r.tauxHoraire / 20000) * 100);
    return {
      name: `${r.prenom} ${r.nom}`.slice(0, 16),
      Expérience: 70,
      Disponibilité: disponibilite,
      'Charge actuelle': Math.min(150, charge),
      'Coût/h': coutNorm,
      Capacité: r.capaciteMax,
    };
  }

  const radarColors = [NAVY, ORANGE, GREEN];

  // ─── Habilitation table: take first N travail resources ───
  const habilResources = travailRessources.slice(0, 7);

  // ─── Outer container ───
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', background: '#F4F6F9', padding: '20px 24px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: NAVY }}>Gestion des Ressources</h2>
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Pool de ressources · Charge & Affectation · Planification</div>
        </div>
        <button
          onClick={openCreate}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, background: NAVY, color: WHITE,
            border: 'none', borderRadius: 8, padding: '9px 16px', cursor: 'pointer', fontWeight: 700, fontSize: 13,
          }}
        >
          <Plus size={15} /> Nouvelle ressource
        </button>
      </div>

      {/* ── KPI Strip ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <KpiCard label="Ressources humaines" value={totalHumain} sub="type Travail" accent={NAVY} />
        <KpiCard label="Matériels" value={totalMateriel} sub="type Matériel" accent={ORANGE} />
        <KpiCard label="Surchargées (>100%)" value={surchargees} sub="action requise" accent={surchargees > 0 ? RED : GREEN} />
        <KpiCard label="Dispo. moyenne" value={`${avgDispo}%`} sub="capacité libre moy." accent={avgDispo < 20 ? RED : GREEN} />
      </div>

      {/* ── Tab Bar ── */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: `2px solid #E5E7EB` }}>
        {TABS.map((tab, i) => (
          <button
            key={i}
            onClick={() => setActiveTab(i)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '10px 20px',
              fontSize: 13, fontWeight: activeTab === i ? 700 : 500,
              color: activeTab === i ? NAVY : '#6B7280',
              borderBottom: activeTab === i ? `3px solid ${NAVY}` : '3px solid transparent',
              marginBottom: -2, transition: 'color 0.15s',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════
          TAB 0 : ANNUAIRE
      ════════════════════════════════════════════════════════════════ */}
      {activeTab === 0 && (
        <div style={{ background: WHITE, borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
              <thead>
                <tr style={{ background: NAVY }}>
                  {['Nom / Prénom', 'Type', 'Direction', 'Taux (FCFA/h)', 'Capacité max (%)', 'Email', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '11px 14px', textAlign: 'left', color: WHITE, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {store.ressources.map((r, idx) => {
                  const charge = allocationMap[r.id] ?? 0;
                  const overloaded = r.type === 'Travail' && charge > 100;
                  return (
                    <tr key={r.id} style={{ background: overloaded ? '#FEF2F2' : idx % 2 === 0 ? WHITE : '#F9FAFB', borderBottom: '1px solid #F3F4F6' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 700, fontSize: 13, color: overloaded ? RED : NAVY }}>
                        {r.prenom} {r.nom}
                        {overloaded && <span style={{ marginLeft: 6, fontSize: 10, color: RED, fontWeight: 700 }}>⚠ {charge}%</span>}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ ...typeBadge(r.type), padding: '2px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>{r.type}</span>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: '#374151' }}>{r.direction ?? '—'}</td>

                      {/* Inline editable: taux horaire */}
                      <td style={{ padding: '10px 14px' }}>
                        {inlineEdit?.id === r.id && inlineEdit.field === 'tauxHoraire' ? (
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <input
                              type="number"
                              value={inlineEdit.val}
                              onChange={e => setInlineEdit({ ...inlineEdit, val: e.target.value })}
                              onKeyDown={e => { if (e.key === 'Enter') commitInline(); if (e.key === 'Escape') setInlineEdit(null); }}
                              autoFocus
                              style={{ width: 80, fontSize: 12, padding: '2px 6px', border: `1px solid ${NAVY}`, borderRadius: 4 }}
                            />
                            <button onClick={commitInline} style={{ background: 'none', border: 'none', cursor: 'pointer', color: GREEN }}><Check size={13} /></button>
                            <button onClick={() => setInlineEdit(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: RED }}><X size={13} /></button>
                          </div>
                        ) : (
                          <span
                            onDoubleClick={() => setInlineEdit({ id: r.id, field: 'tauxHoraire', val: String(r.tauxHoraire) })}
                            title="Double-cliquer pour modifier"
                            style={{ fontSize: 12, cursor: 'pointer', color: '#374151', borderBottom: '1px dashed #D1D5DB' }}
                          >
                            {r.tauxHoraire.toLocaleString('fr-FR')}
                          </span>
                        )}
                      </td>

                      {/* Inline editable: capacité max */}
                      <td style={{ padding: '10px 14px' }}>
                        {inlineEdit?.id === r.id && inlineEdit.field === 'capaciteMax' ? (
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <input
                              type="number"
                              value={inlineEdit.val}
                              onChange={e => setInlineEdit({ ...inlineEdit, val: e.target.value })}
                              onKeyDown={e => { if (e.key === 'Enter') commitInline(); if (e.key === 'Escape') setInlineEdit(null); }}
                              autoFocus
                              style={{ width: 60, fontSize: 12, padding: '2px 6px', border: `1px solid ${NAVY}`, borderRadius: 4 }}
                            />
                            <button onClick={commitInline} style={{ background: 'none', border: 'none', cursor: 'pointer', color: GREEN }}><Check size={13} /></button>
                            <button onClick={() => setInlineEdit(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: RED }}><X size={13} /></button>
                          </div>
                        ) : (
                          <span
                            onDoubleClick={() => setInlineEdit({ id: r.id, field: 'capaciteMax', val: String(r.capaciteMax) })}
                            title="Double-cliquer pour modifier"
                            style={{ fontSize: 12, cursor: 'pointer', color: '#374151', borderBottom: '1px dashed #D1D5DB' }}
                          >
                            {r.capaciteMax}%
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '10px 14px', fontSize: 12, color: '#6B7280' }}>{r.email ?? '—'}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => openEdit(r)}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#EFF6FF', color: NAVY, border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
                          >
                            <Pencil size={12} /> Éditer
                          </button>
                          <button
                            onClick={() => store.deleteRessource(r.id)}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#FEF2F2', color: RED, border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
                          >
                            <Trash2 size={12} /> Suppr.
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {store.ressources.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9CA3AF', fontSize: 14 }}>
              Aucune ressource. Cliquez sur &quot;+ Nouvelle ressource&quot; pour commencer.
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          TAB 1 : CHARGE & AFFECTATION
      ════════════════════════════════════════════════════════════════ */}
      {activeTab === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Bar chart */}
          <div style={{ background: WHITE, borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: '16px 20px' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: NAVY, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity size={16} /> Charge des ressources humaines (%)
            </div>
            {barData.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#9CA3AF', padding: '30px 0' }}>Aucune ressource de type Travail.</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={barData} margin={{ top: 8, right: 20, left: 0, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#6B7280' }}
                    angle={-35}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis domain={[0, 150]} tick={{ fontSize: 11, fill: '#6B7280' }} unit="%" />
                  <Tooltip
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    content={({ active, payload }: any) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0];
                      return (
                        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 6, padding: '8px 12px', fontSize: 12 }}>
                          <div style={{ fontWeight: 700, color: NAVY }}>{d.payload?.fullName}</div>
                          <div style={{ color: barColor(d.value as number), fontWeight: 700 }}>{d.value}%</div>
                        </div>
                      );
                    }}
                  />
                  <ReferenceLine y={100} stroke={RED} strokeDasharray="5 3" label={{ value: '100% max', position: 'right', fontSize: 10, fill: RED }} />
                  <Bar dataKey="charge" radius={[4, 4, 0, 0]}>
                    {barData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
            <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, color: '#6B7280', flexWrap: 'wrap' }}>
              <span><span style={{ display: 'inline-block', width: 10, height: 10, background: GREEN, borderRadius: 2, marginRight: 4 }} />{'< 80%'} disponible</span>
              <span><span style={{ display: 'inline-block', width: 10, height: 10, background: ORANGE, borderRadius: 2, marginRight: 4 }} />80–100% chargé</span>
              <span><span style={{ display: 'inline-block', width: 10, height: 10, background: RED, borderRadius: 2, marginRight: 4 }} />{'> 100%'} surchargé</span>
            </div>
          </div>

          {/* Affectation table */}
          <div style={{ background: WHITE, borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #F3F4F6', fontWeight: 700, fontSize: 14, color: NAVY }}>
              Affectations par projet
            </div>
            {store.projets.map(p => {
              const tachesWithAsgn = p.taches.filter(t => t.assignations.length > 0);
              if (tachesWithAsgn.length === 0) return null;
              const cfg = DOMAINE_CFG[p.domaine];
              return (
                <div key={p.id}>
                  <div style={{ padding: '8px 20px', background: `${cfg.color}12`, borderLeft: `4px solid ${cfg.color}`, borderTop: '1px solid #F3F4F6' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color }}>{p.code}</span>
                    <span style={{ fontSize: 12, color: '#374151', marginLeft: 10 }}>{p.nom}</span>
                  </div>
                  {tachesWithAsgn.map(t =>
                    t.assignations.map(a => {
                      const r = store.ressources.find(res => res.id === a.ressourceId);
                      const { bg, text } = chargeColor(a.unite);
                      return (
                        <div key={a.id} style={{ display: 'flex', gap: 16, padding: '8px 20px 8px 32px', borderBottom: '1px solid #F9FAFB', alignItems: 'center', flexWrap: 'wrap' }}>
                          <div style={{ flex: 2, minWidth: 160, fontSize: 12, color: '#374151' }}>{t.nom}</div>
                          <div style={{ flex: 2, minWidth: 140, fontSize: 12, fontWeight: 600, color: NAVY }}>{r ? `${r.prenom} ${r.nom}` : a.ressourceId}</div>
                          <div>
                            <span style={{ background: bg, color: text, padding: '2px 9px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{a.unite}%</span>
                          </div>
                          <div style={{ fontSize: 11, color: '#9CA3AF', minWidth: 100 }}>
                            {t.dateDebut} → {t.dateFin}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })}
          </div>

          {/* Affecter ressource form */}
          <div style={{ background: WHITE, borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: '16px 20px' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: NAVY, marginBottom: 14 }}>Affecter une ressource</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 180 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280' }}>Projet</label>
                <select
                  value={affProjetId}
                  onChange={e => { setAffProjetId(e.target.value); setAffTacheId(''); }}
                  style={{ padding: '7px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12 }}
                >
                  <option value="">— Sélectionner —</option>
                  {store.projets.map(p => <option key={p.id} value={p.id}>{p.code}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 200 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280' }}>Tâche</label>
                <select
                  value={affTacheId}
                  onChange={e => setAffTacheId(e.target.value)}
                  disabled={!affProjetId}
                  style={{ padding: '7px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12 }}
                >
                  <option value="">— Sélectionner —</option>
                  {affTaches.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 180 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280' }}>Ressource (Travail)</label>
                <select
                  value={affRessId}
                  onChange={e => setAffRessId(e.target.value)}
                  style={{ padding: '7px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12 }}
                >
                  <option value="">— Sélectionner —</option>
                  {travailRessources.map(r => <option key={r.id} value={r.id}>{r.prenom} {r.nom}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 100 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280' }}>Allocation (%)</label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={affUnite}
                  onChange={e => setAffUnite(e.target.value)}
                  style={{ padding: '7px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12 }}
                />
              </div>
              <button
                onClick={handleAssign}
                disabled={!affProjetId || !affTacheId || !affRessId}
                style={{
                  background: (!affProjetId || !affTacheId || !affRessId) ? '#D1D5DB' : NAVY,
                  color: WHITE, border: 'none', borderRadius: 8, padding: '9px 18px',
                  cursor: (!affProjetId || !affTacheId || !affRessId) ? 'not-allowed' : 'pointer',
                  fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap',
                }}
              >
                Confirmer
              </button>
            </div>
            {affSuccess && (
              <div style={{ marginTop: 12, padding: '8px 14px', background: '#DCFCE7', color: '#166534', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
                Ressource affectée avec succès.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          TAB 2 : PLANIFICATION
      ════════════════════════════════════════════════════════════════ */}
      {activeTab === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Availability Heatmap */}
          <div style={{ background: WHITE, borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #F3F4F6', fontWeight: 700, fontSize: 14, color: NAVY }}>
              Heatmap de disponibilité — 8 prochains mois
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                <thead>
                  <tr style={{ background: NAVY }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left', color: WHITE, fontSize: 12, fontWeight: 600, minWidth: 160 }}>Ressource</th>
                    {NEXT_8_MONTHS.map(m => (
                      <th key={m} style={{ padding: '10px 10px', textAlign: 'center', color: WHITE, fontSize: 11, fontWeight: 600, minWidth: 80 }}>{m}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {travailRessources.map((r, idx) => (
                    <tr key={r.id} style={{ background: idx % 2 === 0 ? WHITE : '#F9FAFB', borderBottom: '1px solid #F3F4F6' }}>
                      <td style={{ padding: '9px 14px', fontSize: 12, fontWeight: 700, color: NAVY, whiteSpace: 'nowrap' }}>
                        {r.prenom} {r.nom}
                        <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 400 }}>{r.direction}</div>
                      </td>
                      {NEXT_8_MONTHS.map((_, mi) => {
                        const v = monthlyCharge(r, mi);
                        const { bg, text } = chargeColor(v);
                        return (
                          <td key={mi} style={{ padding: '6px 4px', textAlign: 'center' }}>
                            <div style={{ background: bg, color: text, borderRadius: 6, padding: '5px 4px', fontSize: 11, fontWeight: 700, margin: '0 auto', minWidth: 52 }}>
                              {v}%
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {travailRessources.length === 0 && (
              <div style={{ padding: '30px 20px', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Aucune ressource de type Travail.</div>
            )}
            <div style={{ padding: '10px 20px', borderTop: '1px solid #F3F4F6', display: 'flex', gap: 16, fontSize: 11, color: '#6B7280', flexWrap: 'wrap' }}>
              <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#DCFCE7', border: '1px solid #D1FAE5', borderRadius: 2, marginRight: 4 }} />{'< 80%'}</span>
              <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 2, marginRight: 4 }} />80–100%</span>
              <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 2, marginRight: 4 }} />{'> 100%'} surchargé</span>
            </div>
          </div>

          {/* Radar chart */}
          <div style={{ background: WHITE, borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: '16px 20px' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: NAVY, marginBottom: 14 }}>Comparaison des ressources (radar)</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              {travailRessources.map(r => {
                const sel = radarSelected.includes(r.id);
                return (
                  <button
                    key={r.id}
                    onClick={() => {
                      if (sel) {
                        setRadarSelected(prev => prev.filter(id => id !== r.id));
                      } else if (radarSelected.length < 3) {
                        setRadarSelected(prev => [...prev, r.id]);
                      }
                    }}
                    style={{
                      padding: '5px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      background: sel ? NAVY : '#F3F4F6', color: sel ? WHITE : '#374151',
                      border: sel ? `1px solid ${NAVY}` : '1px solid #E5E7EB',
                    }}
                  >
                    {r.prenom} {r.nom}
                  </button>
                );
              })}
              {radarSelected.length > 0 && (
                <button onClick={() => setRadarSelected([])} style={{ padding: '5px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', background: '#FEF2F2', color: RED, border: `1px solid ${RED}40`, fontWeight: 600 }}>
                  Tout désélectionner
                </button>
              )}
            </div>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 10 }}>Sélectionnez jusqu&apos;à 3 ressources.</div>
            {radarSelected.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#D1D5DB', padding: '40px 0', fontSize: 13 }}>Sélectionnez des ressources ci-dessus pour afficher le radar.</div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <RadarChart data={[
                  { axis: 'Expérience', ...Object.fromEntries(radarSelected.map(id => [id, 70])) },
                  { axis: 'Disponibilité', ...Object.fromEntries(radarSelected.map(id => [id, Math.max(0, 100 - (allocationMap[id] ?? 0))])) },
                  { axis: 'Charge actuelle', ...Object.fromEntries(radarSelected.map(id => [id, Math.min(150, allocationMap[id] ?? 0)])) },
                  { axis: 'Coût/h', ...Object.fromEntries(radarSelected.map(id => { const r = store.ressources.find(res => res.id === id); return [id, Math.min(100, ((r?.tauxHoraire ?? 0) / 20000) * 100)]; })) },
                  { axis: 'Capacité', ...Object.fromEntries(radarSelected.map(id => { const r = store.ressources.find(res => res.id === id); return [id, Math.min(100, r?.capaciteMax ?? 0)]; })) },
                ]}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9 }} />
                  {radarSelected.map((id, i) => {
                    const r = store.ressources.find(res => res.id === id);
                    return (
                      <Radar
                        key={id}
                        name={r ? `${r.prenom} ${r.nom}` : id}
                        dataKey={id}
                        stroke={radarColors[i]}
                        fill={radarColors[i]}
                        fillOpacity={0.15}
                      />
                    );
                  })}
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Habilitations table */}
          <div style={{ background: WHITE, borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #F3F4F6', fontWeight: 700, fontSize: 14, color: NAVY }}>
              Habilitations
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                <thead>
                  <tr style={{ background: NAVY }}>
                    {['Ressource', 'Habilitation', 'Date obtention', 'Date expiry', 'Statut'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: WHITE, fontSize: 12, fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {habilResources.map((r, i) => {
                    const hab = SAMPLE_HABILITATIONS[i % SAMPLE_HABILITATIONS.length];
                    const expiry = new Date(hab.expiry);
                    const now = new Date();
                    const expired = expiry < now;
                    const soonExpiry = !expired && (expiry.getTime() - now.getTime()) < 90 * 86400000;
                    return (
                      <tr key={r.id} style={{ background: i % 2 === 0 ? WHITE : '#F9FAFB', borderBottom: '1px solid #F3F4F6' }}>
                        <td style={{ padding: '9px 14px', fontSize: 12, fontWeight: 700, color: NAVY }}>{r.prenom} {r.nom}</td>
                        <td style={{ padding: '9px 14px', fontSize: 12, color: '#374151' }}>{hab.habilitation}</td>
                        <td style={{ padding: '9px 14px', fontSize: 12, color: '#6B7280' }}>{hab.date}</td>
                        <td style={{ padding: '9px 14px', fontSize: 12, color: expired ? RED : '#6B7280', fontWeight: expired ? 700 : 400 }}>{hab.expiry}</td>
                        <td style={{ padding: '9px 14px' }}>
                          <span style={{
                            padding: '2px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                            background: expired ? '#FEE2E2' : soonExpiry ? '#FEF3C7' : '#DCFCE7',
                            color: expired ? '#991B1B' : soonExpiry ? '#92400E' : '#166534',
                          }}>
                            {expired ? 'Expirée' : soonExpiry ? 'Expire bientôt' : 'Valide'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          TAB 3 : FEUILLES DE TEMPS (TIMESHEET)
      ════════════════════════════════════════════════════════════════ */}
      {activeTab === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
            {[
              { label: 'Brouillons', value: timesheets.filter(t => t.statut === 'brouillon').length, color: '#94A3B8' },
              { label: 'Soumis CP', value: timesheets.filter(t => t.statut === 'soumis').length, color: '#F37021' },
              { label: 'Validés CP', value: timesheets.filter(t => t.statut === 'valide_cp').length, color: '#2563EB' },
              { label: 'Validés RH', value: timesheets.filter(t => t.statut === 'valide_rh').length, color: '#16A34A' },
            ].map(k => (
              <div key={k.label} style={{ background: WHITE, borderRadius: 10, padding: '12px 16px', borderLeft: `4px solid ${k.color}`, boxShadow: '0 1px 4px rgba(0,0,0,0.10)' }}>
                <div style={{ fontSize: 10, color: '#6B7280', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{k.label}</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: k.color }}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 10, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Ressource</label>
              <select
                value={tsRessId}
                onChange={e => setTsRessId(e.target.value)}
                style={{ padding: '7px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12, minWidth: 180 }}>
                {store.ressources.filter(r => r.type === 'Travail').map(r => (
                  <option key={r.id} value={r.id}>{r.prenom} {r.nom}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 10, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Semaine</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {SEMAINES.map((s, i) => (
                  <button
                    key={s}
                    onClick={() => setTsWeek(i)}
                    style={{
                      padding: '7px 12px', borderRadius: 6, fontSize: 11, fontWeight: tsWeek === i ? 700 : 500,
                      background: tsWeek === i ? NAVY : WHITE, color: tsWeek === i ? WHITE : '#374151',
                      border: `1px solid ${tsWeek === i ? NAVY : '#D1D5DB'}`, cursor: 'pointer',
                    }}>
                    {s.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Timesheet grid */}
          <div style={{ background: WHITE, borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: NAVY }}>
                  {store.ressources.find(r => r.id === tsRessId) ? `${store.ressources.find(r => r.id === tsRessId)!.prenom} ${store.ressources.find(r => r.id === tsRessId)!.nom}` : '—'}
                </div>
                <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{SEMAINES[tsWeek]}</div>
              </div>
              {currentTs && (
                <div style={{
                  padding: '4px 12px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                  background: `${TS_STATUT_CFG[currentTs.statut].color}20`,
                  color: TS_STATUT_CFG[currentTs.statut].color,
                }}>
                  {TS_STATUT_CFG[currentTs.statut].label}
                </div>
              )}
            </div>

            {currentTs ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                  <thead>
                    <tr style={{ background: '#F9FAFB' }}>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#374151', borderBottom: '1px solid #E5E7EB', minWidth: 160 }}>Projet / Tâche</th>
                      {JOURS.map(j => (
                        <th key={j} style={{ padding: '10px 8px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#374151', borderBottom: '1px solid #E5E7EB', width: 56 }}>{j}</th>
                      ))}
                      <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: NAVY, borderBottom: '1px solid #E5E7EB' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentTs.lignes.map((ligne, li) => {
                      const proj = store.projets.find(p => p.id === ligne.projetId);
                      const total = ligne.heures.reduce((s, h) => s + h, 0);
                      return (
                        <tr key={li} style={{ borderBottom: '1px solid #F3F4F6' }}>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: NAVY }}>{ligne.tacheLabel}</div>
                            <div style={{ fontSize: 10, color: '#6B7280' }}>{proj?.code ?? '—'} · {proj?.nom?.substring(0, 28) ?? '—'}</div>
                          </td>
                          {ligne.heures.map((h, hi) => (
                            <td key={hi} style={{ padding: '10px 8px', textAlign: 'center' }}>
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                width: 32, height: 28, borderRadius: 6, fontSize: 12, fontWeight: 600,
                                background: h === 0 ? '#F3F4F6' : h >= 8 ? '#DBEAFE' : '#FEF3C7',
                                color: h === 0 ? '#9CA3AF' : h >= 8 ? NAVY : '#92400E',
                              }}>
                                {h > 0 ? h : '—'}
                              </span>
                            </td>
                          ))}
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: total >= 40 ? '#16A34A' : '#F37021' }}>
                            {total}h
                          </td>
                        </tr>
                      );
                    })}
                    {/* Total row */}
                    <tr style={{ background: '#F9FAFB', fontWeight: 700 }}>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: NAVY, fontWeight: 700 }}>TOTAL HEURES</td>
                      {JOURS.map((_, ji) => {
                        const col = currentTs.lignes.reduce((s, l) => s + l.heures[ji], 0);
                        return (
                          <td key={ji} style={{ padding: '10px 8px', textAlign: 'center' }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              width: 32, height: 28, borderRadius: 6, fontSize: 12, fontWeight: 700,
                              background: col === 0 ? '#F3F4F6' : col > 8 ? '#FEE2E2' : col >= 8 ? '#DCFCE7' : '#FEF3C7',
                              color: col === 0 ? '#9CA3AF' : col > 8 ? '#991B1B' : col >= 8 ? '#166534' : '#92400E',
                            }}>
                              {col > 0 ? col : '—'}
                            </span>
                          </td>
                        );
                      })}
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 14, fontWeight: 800, color: NAVY }}>
                        {currentTs.lignes.reduce((s, l) => s + l.heures.reduce((a, h) => a + h, 0), 0)}h
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Workflow buttons */}
                <div style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {currentTs.statut === 'brouillon' && (
                    <>
                      <button className="btn btn-primary btn-xs" style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => setTsStatut(currentTs.id, 'soumis')}>
                        <CheckCircle size={12} />Soumettre au CP
                      </button>
                    </>
                  )}
                  {currentTs.statut === 'soumis' && (
                    <>
                      <span style={{ fontSize: 10, color: '#6B7280', marginRight: 4 }}>Action CP :</span>
                      <button className="btn btn-primary btn-xs" style={{ background: '#16A34A', borderColor: '#16A34A', display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => setTsStatut(currentTs.id, 'valide_cp')}>
                        <CheckCircle size={12} />Valider CP
                      </button>
                      <button className="btn btn-ghost btn-xs" style={{ color: RED }} onClick={() => setTsStatut(currentTs.id, 'rejete')}>Rejeter</button>
                    </>
                  )}
                  {currentTs.statut === 'valide_cp' && (
                    <>
                      <span style={{ fontSize: 10, color: '#6B7280', marginRight: 4 }}>Action RH :</span>
                      <button className="btn btn-primary btn-xs" style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => setTsStatut(currentTs.id, 'valide_rh')}>
                        <CheckCircle size={12} />Valider RH
                      </button>
                      <button className="btn btn-ghost btn-xs" style={{ color: RED }} onClick={() => setTsStatut(currentTs.id, 'soumis')}>Retourner</button>
                    </>
                  )}
                  {currentTs.statut === 'valide_rh' && (
                    <span style={{ fontSize: 11, color: '#16A34A', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <CheckCircle size={14} color="#16A34A" />Feuille de temps validée — Intégrée en paie
                    </span>
                  )}
                  {currentTs.statut === 'rejete' && (
                    <>
                      <span style={{ fontSize: 11, color: '#EF3340', fontWeight: 600, marginRight: 4 }}>Feuille rejetée — à corriger</span>
                      <button className="btn btn-ghost btn-xs" onClick={() => setTsStatut(currentTs.id, 'brouillon')}>Reprendre en brouillon</button>
                    </>
                  )}
                  {currentTs.commentaireRH && (
                    <div style={{ marginLeft: 'auto', fontSize: 10, color: '#6B7280', fontStyle: 'italic' }}>💬 {currentTs.commentaireRH}</div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ padding: '40px 0', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                Aucune feuille de temps pour cette semaine.<br />
                <button className="btn btn-primary btn-xs" style={{ marginTop: 12 }}>Créer une feuille de temps</button>
              </div>
            )}
          </div>

          {/* All timesheets table */}
          <div style={{ background: WHITE, borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid #F3F4F6', fontWeight: 700, fontSize: 13, color: NAVY }}>
              Toutes les feuilles de temps — {TIMESHEETS.length} enregistrements
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F9FAFB' }}>
                  <th style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#374151', borderBottom: '1px solid #E5E7EB' }}>Ressource</th>
                  <th style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#374151', borderBottom: '1px solid #E5E7EB' }}>Semaine</th>
                  <th style={{ padding: '9px 14px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#374151', borderBottom: '1px solid #E5E7EB' }}>Total heures</th>
                  <th style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#374151', borderBottom: '1px solid #E5E7EB' }}>Statut</th>
                  <th style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#374151', borderBottom: '1px solid #E5E7EB' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {TIMESHEETS.map(ts => {
                  const res = store.ressources.find(r => r.id === ts.ressourceId);
                  const total = ts.lignes.reduce((s, l) => s + l.heures.reduce((a, h) => a + h, 0), 0);
                  const cfg = TS_STATUT_CFG[ts.statut];
                  return (
                    <tr key={ts.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 600, fontSize: 12 }}>{res ? `${res.prenom} ${res.nom}` : '—'}</td>
                      <td style={{ padding: '10px 14px', fontSize: 11, color: '#6B7280' }}>{ts.semaine}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, fontSize: 13, color: NAVY }}>{total}h</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 10, fontWeight: 700, background: `${cfg.color}20`, color: cfg.color }}>
                          {cfg.label}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <button
                          className="btn btn-ghost btn-xs"
                          onClick={() => { setTsRessId(ts.ressourceId); setTsWeek(SEMAINES.indexOf(ts.semaine)); }}>
                          Ouvrir
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          TAB 4 : Effectif DPE — données réelles (201 agents)
      ════════════════════════════════════════════════════════════════ */}
      {activeTab === 4 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* KPI effectif */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { label: 'Effectif total DPE', value: EFFECTIF_TOTAL, sub: 'au 10/03/2026', color: NAVY },
              { label: 'Cadres', value: parCollege['Cadre'] ?? 0, sub: `${parCollege['Maitrise'] ?? 0} maîtrise · ${parCollege['Exécutif'] ?? parCollege['Executif'] ?? 0} exécutif`, color: '#7C3AED' },
              { label: 'Hommes / Femmes', value: `${parSexe['Hommes'] ?? 0} / ${parSexe['Femmes'] ?? 0}`, sub: `${Math.round(((parSexe['Femmes'] ?? 0) / EFFECTIF_TOTAL) * 100)}% de femmes`, color: ORANGE },
              { label: 'Directions / Unités', value: Object.keys(parDir).length, sub: 'EM, DER, DGC, DEP, DIT…', color: GREEN },
            ].map(k => (
              <div key={k.label} style={{ background: '#fff', borderRadius: 10, border: '1px solid #E5E7EB', borderTop: `3px solid ${k.color}`, padding: '14px 16px' }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{k.label}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: k.color, marginTop: 4 }}>{k.value}</div>
                <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{k.sub}</div>
              </div>
            ))}
          </div>

          {/* Organigramme officiel DPE (ND 005/2023) */}
          <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E5E7EB', padding: '16px 18px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>Organigramme DPE</div>
            <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 14 }}>Conforme à la Note de Direction N°005/2023 — organisation officielle</div>

            {/* Racine DPE */}
            <div style={{ border: `2px solid ${NAVY}`, borderRadius: 10, padding: '10px 14px', background: '#EFF6FF', marginBottom: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: NAVY }}>{ORG_DPE_RACINE.label}</div>
              <div style={{ fontSize: 11.5, color: '#475569', marginTop: 2 }}>Directeur Principal : <strong>{ORG_DPE_RACINE.responsable}</strong></div>
              <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 2 }}>{ORG_DPE_RACINE.appuis.join(' · ')}</div>
            </div>

            {/* Unités */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 12 }}>
              {ORG_DPE.map(u => {
                const agents = agentsUnite(u.code);
                const resp = responsableUnite(u.code);
                const typeColor = u.type === 'Direction' ? NAVY : u.type === 'Coordination' ? '#7C3AED' : '#0F766E';
                return (
                  <div key={u.code} style={{ border: '1px solid #E5E7EB', borderTop: `3px solid ${typeColor}`, borderRadius: 9, padding: '11px 13px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div>
                        <span style={{ fontSize: 9, fontWeight: 700, color: typeColor, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{u.type}</span>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0F172A', lineHeight: 1.25 }}>{u.code} — {u.label}</div>
                      </div>
                      <span style={{ flexShrink: 0, fontSize: 13, fontWeight: 800, color: typeColor, background: `${typeColor}12`, borderRadius: 7, padding: '3px 9px' }}>{agents.length}</span>
                    </div>
                    {resp && (
                      <div style={{ fontSize: 11, color: '#475569' }}>
                        👤 <strong>{resp.prenom} {resp.nom}</strong> — {resp.fonction}
                      </div>
                    )}
                    {u.bailleur && <div style={{ fontSize: 10, color: '#94A3B8', fontStyle: 'italic' }}>💰 {u.bailleur}</div>}
                    {u.departements.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 2, paddingTop: 7, borderTop: '1px solid #F1F5F9' }}>
                        {u.departements.map(d => {
                          const n = agents.filter(a => deptOf(a.direction) === d.code).length;
                          return (
                            <div key={d.code} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, fontSize: 11 }}>
                              <span style={{ color: '#334155' }}><span style={{ fontWeight: 700, color: typeColor }}>{d.code}</span> · {d.label}</span>
                              <span style={{ flexShrink: 0, fontWeight: 700, color: '#64748B' }}>{n}</span>
                            </div>
                          );
                        })}
                        {u.expertSE && <div style={{ fontSize: 10, color: '#94A3B8' }}>+ Expert Suivi-Évaluation</div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Répartition par direction — tableau synthétique (sans graphe) */}
          <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E5E7EB', padding: '14px 16px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 10 }}>Effectif par direction / unité</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {Object.entries(parDir).sort((a, b) => b[1] - a[1]).map(([dir, n]) => (
                <div key={dir} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 8, background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: NAVY }}>{dir}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#0F172A' }}>{n}</span>
                  <span style={{ fontSize: 10, color: '#94A3B8' }}>{Math.round((n / EFFECTIF_TOTAL) * 100)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Roster filtrable */}
          <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', flex: 1 }}>Annuaire du personnel ({personnelFiltre.length})</div>
              <select value={effDir} onChange={e => setEffDir(e.target.value)} style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid #E2E8F0', fontSize: 12, fontFamily: 'inherit' }}>
                <option value="Toutes">Toutes directions</option>
                {Object.keys(parDir).map(d => <option key={d} value={d}>{d} ({parDir[d]})</option>)}
              </select>
              <input value={effSearch} onChange={e => setEffSearch(e.target.value)} placeholder="Rechercher nom, poste, matricule…" style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid #E2E8F0', fontSize: 12, width: 240, fontFamily: 'inherit' }} />
              <button onClick={exportEffectifCSV} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid #E2E8F0', background: '#fff', color: '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Exporter CSV</button>
            </div>
            <div style={{ maxHeight: 440, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ position: 'sticky', top: 0, background: '#F8FAFC' }}>
                  <tr style={{ textAlign: 'left', color: '#94A3B8', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <th style={{ padding: '8px 12px' }}>Matricule</th><th style={{ padding: '8px 12px' }}>Agent</th><th style={{ padding: '8px 12px' }}>Direction</th><th style={{ padding: '8px 12px' }}>Poste occupé</th><th style={{ padding: '8px 12px' }}>Collège</th><th style={{ padding: '8px 12px' }}>Site</th>
                  </tr>
                </thead>
                <tbody>
                  {personnelFiltre.map((a, i) => (
                    <tr key={a.mle + i} style={{ borderTop: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '7px 12px', fontFamily: 'monospace', color: '#64748B', fontSize: 11 }}>{a.mle}</td>
                      <td style={{ padding: '7px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 26, height: 26, borderRadius: '50%', background: a.sexe === 'F' ? '#FCE7F3' : '#EFF6FF', color: a.sexe === 'F' ? '#DB2777' : NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, flexShrink: 0 }}>
                            {(a.prenom[0] ?? '') + (a.nom[0] ?? '')}
                          </div>
                          <span style={{ fontWeight: 600, color: '#1E293B' }}>{a.prenom} {a.nom}</span>
                        </div>
                      </td>
                      <td style={{ padding: '7px 12px' }}><span style={{ fontSize: 10.5, fontWeight: 700, color: NAVY, background: '#EFF6FF', padding: '2px 7px', borderRadius: 5 }}>{a.direction}</span></td>
                      <td style={{ padding: '7px 12px', color: '#475569' }}>{a.poste}</td>
                      <td style={{ padding: '7px 12px', color: '#64748B' }}>{a.college}</td>
                      <td style={{ padding: '7px 12px', color: '#64748B' }}>{a.site}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          MODAL : Create / Edit Resource
      ════════════════════════════════════════════════════════════════ */}
      {modalOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setModalOpen(false); }}
        >
          <div style={{ background: WHITE, borderRadius: 12, boxShadow: '0 8px 40px rgba(0,0,0,0.20)', width: 500, maxWidth: '94vw', overflow: 'hidden' }}>
            {/* Modal header */}
            <div style={{ padding: '14px 18px', background: NAVY, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>
                  {editingId ? 'Modifier la ressource' : 'Nouvelle ressource'}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: WHITE }}>
                  {editingId ? `${form.prenom} ${form.nom}` : 'Créer une ressource'}
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: WHITE, borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 16 }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal body */}
            <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280' }}>Prénom *</label>
                  <input value={form.prenom} onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))} placeholder="Prénom" style={{ padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13 }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280' }}>Nom *</label>
                  <input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} placeholder="Nom de famille" style={{ padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13 }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280' }}>Type *</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as TypeRessource }))} style={{ padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13 }}>
                    {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280' }}>Direction</label>
                  <select value={form.direction} onChange={e => setForm(f => ({ ...f, direction: e.target.value }))} style={{ padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13 }}>
                    {DIRECTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280' }}>Taux horaire (FCFA/h)</label>
                  <input type="number" value={form.tauxHoraire} onChange={e => setForm(f => ({ ...f, tauxHoraire: e.target.value }))} placeholder="ex: 12500" style={{ padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13 }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280' }}>Capacité max (%)</label>
                  <input type="number" value={form.capaciteMax} onChange={e => setForm(f => ({ ...f, capaciteMax: e.target.value }))} placeholder="100" min={1} max={999} style={{ padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13 }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280' }}>Email</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="prenom.nom@senelec.sn" style={{ padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13 }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280' }}>Téléphone</label>
                  <input type="tel" value={form.telephone} onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))} placeholder="+221 77 000 00 00" style={{ padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13 }} />
                </div>
              </div>

              {form.type === 'Matériel' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280' }}>Unité (pour matériel)</label>
                  <input value={form.unite} onChange={e => setForm(f => ({ ...f, unite: e.target.value }))} placeholder="ex: km, unité, m³" style={{ padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13 }} />
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid #F3F4F6', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setModalOpen(false)}
                style={{ padding: '9px 18px', borderRadius: 7, border: '1px solid #D1D5DB', background: WHITE, cursor: 'pointer', fontWeight: 600, fontSize: 13, color: '#374151' }}
              >
                Annuler
              </button>
              <button
                onClick={handleFormSubmit}
                disabled={!form.nom.trim() || !form.prenom.trim()}
                style={{
                  padding: '9px 20px', borderRadius: 7, border: 'none',
                  background: (!form.nom.trim() || !form.prenom.trim()) ? '#D1D5DB' : NAVY,
                  color: WHITE, cursor: (!form.nom.trim() || !form.prenom.trim()) ? 'not-allowed' : 'pointer',
                  fontWeight: 700, fontSize: 13,
                }}
              >
                {editingId ? 'Enregistrer' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
