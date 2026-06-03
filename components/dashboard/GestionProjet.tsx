'use client';

/**
 * GestionProjet.tsx — Espace Gestion de Projet (type MS Project)
 * -----------------------------------------------------------------------------
 * Couvre le cycle complet, du marché à la clôture :
 *   1. Cycle de vie : phases pondérées (Passations → Clôture) + avancement pondéré.
 *   2. Tâches (WBS) : créer / éditer / supprimer, durées, dates, %, prédécesseurs.
 *   3. Ressources : créer et AFFECTER aux tâches (% d'allocation) + surcharge.
 *   4. Référence & Suivi : planning de référence (baseline), écarts, problèmes,
 *      replanification.
 * Réservé au chef de projet et aux ingénieurs de son périmètre (sinon lecture seule).
 */

import { useMemo, useState, useCallback } from 'react';
import {
  useProjectStore, computeAvancementReel, type Projet, type TacheWBS, type PhaseProjet,
} from '@/lib/projectStore';
import { useAuth, isOperationalReadOnly } from '@/lib/authStore';
import toast from 'react-hot-toast';
import {
  Layers, ListChecks, Users, Flag, Plus, Trash2, Save, AlertTriangle,
  CalendarClock, RefreshCw, GanttChart, CheckCircle2,
} from 'lucide-react';

type Onglet = 'cycle' | 'taches' | 'ressources' | 'suivi';

const NAVY = '#1B4F8A';

function addDaysISO(iso: string, n: number): string {
  const d = new Date(iso); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10);
}
function diffDays(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}
function fmtFCFA(n: number): string { return n.toLocaleString('fr-FR'); }

export default function GestionProjet() {
  const store = useProjectStore();
  const { user, isRole } = useAuth();
  const [onglet, setOnglet] = useState<Onglet>('cycle');
  const [projetId, setProjetId] = useState<string>(store.projets[0]?.id ?? '');

  const projet = store.projets.find(p => p.id === projetId) ?? store.projets[0];
  const taches = useMemo(
    () => (projet ? [...projet.taches].sort((a, b) => a.ordre - b.ordre) : []),
    [projet],
  );

  // Droit d'édition opérationnelle. RÈGLE : l'édition s'arrête au niveau DÉPARTEMENT &
  // CHEF DE CELLULE (niveau 2) + l'équipe projet. Les niveaux 0 (DPE/PMO Central) et 1
  // (directeurs d'unité) VOIENT le planning/la gestion en LECTURE SEULE.
  const myName = `${user?.prenom ?? ''} ${user?.nom ?? ''}`.trim().toLowerCase();
  const readOnly = isOperationalReadOnly(user);   // true = niveaux 0/1 → consultation
  const canEdit = !!projet && !readOnly && (
    isRole('ADMIN', 'CHEF_DEPT') ||               // dept & chef de cellule (rang département) = niveau 2
    projet.chefProjet.toLowerCase() === myName ||
    (isRole('CHEF_PROJ', 'INGENIEUR') && (projet.equipe || []).some(rid => {
      const r = store.ressources.find(x => x.id === rid);
      return r && `${r.prenom} ${r.nom}`.trim().toLowerCase() === myName;
    }))
  );

  if (!projet) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>Aucun projet accessible dans votre périmètre.</div>;
  }

  const ONGLETS: { key: Onglet; label: string; icon: React.ElementType }[] = [
    { key: 'cycle', label: 'Cycle de vie', icon: Layers },
    { key: 'taches', label: 'Tâches (WBS)', icon: ListChecks },
    { key: 'ressources', label: 'Ressources & affectation', icon: Users },
    { key: 'suivi', label: 'Référence & Suivi', icon: Flag },
  ];

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', background: '#F4F6F9' }}>
      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: '#EFF6FF', display: 'grid', placeItems: 'center' }}>
          <GanttChart size={22} color={NAVY} />
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: 0 }}>Gestion de Projet</h1>
          <p style={{ fontSize: 12.5, color: '#64748B', margin: '2px 0 0' }}>
            Du marché à la clôture — tâches, ressources, planning de référence, suivi & replanification
          </p>
        </div>
        <select value={projetId} onChange={e => setProjetId(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1.5px solid #CBD5E1', fontSize: 13, fontWeight: 600, minWidth: 280, background: '#fff' }}>
          {store.projets.map(p => <option key={p.id} value={p.id}>{p.code} — {p.nom.slice(0, 44)}</option>)}
        </select>
      </div>

      {!canEdit && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E', borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 12 }}>
          🔒 Lecture seule — l'édition opérationnelle (planning, tâches, ressources) est réservée au niveau
          département & chef de cellule et à l'équipe projet. Les niveaux direction / DPE consultent.
        </div>
      )}

      {/* Onglets */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', background: '#E8EDF4', borderRadius: 10, padding: 4, marginBottom: 16 }}>
        {ONGLETS.map(o => {
          const Icon = o.icon; const active = onglet === o.key;
          return (
            <button key={o.key} onClick={() => setOnglet(o.key)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 7, border: 'none',
              background: active ? NAVY : 'transparent', color: active ? '#fff' : '#475569',
              fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}><Icon size={14} /> {o.label}</button>
          );
        })}
      </div>

      {onglet === 'cycle' && <CyclePanel projet={projet} taches={taches} canEdit={canEdit} />}
      {onglet === 'taches' && <TachesPanel projet={projet} taches={taches} canEdit={canEdit} />}
      {onglet === 'ressources' && <RessourcesPanel projet={projet} taches={taches} canEdit={canEdit} />}
      {onglet === 'suivi' && <SuiviPanel projet={projet} taches={taches} canEdit={canEdit} />}
    </div>
  );
}

/* ─── 1. CYCLE DE VIE — phases pondérées ─────────────────────────────────── */
function CyclePanel({ projet, taches, canEdit }: { projet: Projet; taches: TacheWBS[]; canEdit: boolean }) {
  const { updatePhase } = useProjectStore();
  const phases: PhaseProjet[] = projet.phases ?? [];
  const avancementPondere = computeAvancementReel(phases);

  return (
    <div className="card" style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: NAVY }}>Cycle de vie du projet — phases pondérées</div>
        <div style={{ fontSize: 13, fontWeight: 800, color: avancementPondere >= 80 ? '#16A34A' : avancementPondere >= 40 ? '#F59E0B' : '#EF4444' }}>
          Avancement pondéré : {avancementPondere}%
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {phases.map(ph => (
          <div key={ph.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 150, fontSize: 13, fontWeight: 700, color: '#334155' }}>{ph.label}</div>
            <div style={{ width: 64, fontSize: 11, color: '#94A3B8' }}>poids {ph.poids}%</div>
            <div style={{ flex: 1, height: 18, background: '#F1F5F9', borderRadius: 9, position: 'relative', overflow: 'hidden' }}>
              <div style={{ width: `${ph.avancement}%`, height: '100%', background: ph.avancement >= 100 ? '#16A34A' : NAVY, transition: 'width .2s' }} />
            </div>
            <input type="number" min={0} max={100} value={ph.avancement} disabled={!canEdit}
              onChange={e => updatePhase(projet.id, ph.id, Math.max(0, Math.min(100, Number(e.target.value))))}
              style={{ width: 64, padding: '5px 8px', borderRadius: 6, border: '1.5px solid #CBD5E1', fontSize: 12, textAlign: 'center' }} />
            <span style={{ fontSize: 11, color: '#94A3B8', width: 14 }}>%</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 14, fontSize: 11.5, color: '#64748B' }}>
        💡 L'avancement global est la moyenne <b>pondérée</b> des phases. Les jalons et tâches détaillent l'exécution de chaque phase.
        Tâches rattachées : <b>{taches.length}</b>.
      </div>
    </div>
  );
}

/* ─── 2. TÂCHES (WBS) ────────────────────────────────────────────────────── */
function TachesPanel({ projet, taches, canEdit }: { projet: Projet; taches: TacheWBS[]; canEdit: boolean }) {
  const { createTache, updateTache, deleteTache } = useProjectStore();
  const [nom, setNom] = useState('');
  const [duree, setDuree] = useState(5);

  const addTache = () => {
    if (!nom.trim()) return;
    const debut = taches.length ? taches[taches.length - 1].dateFin : projet.dateDebut;
    createTache({
      projetId: projet.id, nom: nom.trim(), type: 'Normale', niveau: 2, ordre: taches.length + 1,
      duree, dateDebut: debut, dateFin: addDaysISO(debut, duree), avancement: 0,
      statutTache: 'a_faire', priorite: 'Moyenne', predecesseurs: [], assignations: [],
    });
    setNom(''); setDuree(5); toast.success('Tâche créée');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {canEdit && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: 14, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 2, minWidth: 220 }}>
            <label style={lbl}>Nom de la tâche</label>
            <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Ex : Études topographiques" style={inp} />
          </div>
          <div style={{ width: 110 }}>
            <label style={lbl}>Durée (j)</label>
            <input type="number" min={1} value={duree} onChange={e => setDuree(Math.max(1, Number(e.target.value)))} style={inp} />
          </div>
          <button onClick={addTache} disabled={!nom.trim()} style={{ ...btnPrimary, opacity: nom.trim() ? 1 : 0.5 }}>
            <Plus size={14} /> Ajouter
          </button>
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #E2E8F0', color: '#64748B', background: '#F8FAFC' }}>
              <th style={th}>#</th><th style={th}>Tâche</th><th style={th}>Durée (j)</th><th style={th}>Début</th><th style={th}>Fin</th>
              <th style={th}>Prédécesseur</th><th style={th}>Avanc. %</th>{canEdit && <th style={{ ...th, textAlign: 'center' }}>Suppr.</th>}
            </tr>
          </thead>
          <tbody>
            {taches.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#94A3B8' }}>Aucune tâche — créez la première ci-dessus.</td></tr>
            ) : taches.map((t, i) => (
              <tr key={t.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td style={td}>{i + 1}</td>
                <td style={td}><input value={t.nom} disabled={!canEdit} onChange={e => updateTache(projet.id, t.id, { nom: e.target.value })} style={{ ...cellInp, width: 220 }} /></td>
                <td style={td}><input type="number" min={1} value={t.duree} disabled={!canEdit}
                  onChange={e => { const d = Math.max(1, Number(e.target.value)); updateTache(projet.id, t.id, { duree: d, dateFin: addDaysISO(t.dateDebut, d) }); }}
                  style={{ ...cellInp, width: 56, textAlign: 'center' }} /></td>
                <td style={td}><input type="date" value={t.dateDebut} disabled={!canEdit}
                  onChange={e => updateTache(projet.id, t.id, { dateDebut: e.target.value, dateFin: addDaysISO(e.target.value, t.duree) })}
                  style={{ ...cellInp, width: 130 }} /></td>
                <td style={td}>{t.dateFin}</td>
                <td style={td}>
                  <select value={t.predecesseurs[0]?.tacheId ?? ''} disabled={!canEdit}
                    onChange={e => updateTache(projet.id, t.id, { predecesseurs: e.target.value ? [{ tacheId: e.target.value, type: 'FS', delai: 0 }] : [] })}
                    style={{ ...cellInp, width: 150 }}>
                    <option value="">—</option>
                    {taches.filter(x => x.id !== t.id).map((x, xi) => <option key={x.id} value={x.id}>{xi + 1}. {x.nom.slice(0, 22)}</option>)}
                  </select>
                </td>
                <td style={td}><input type="number" min={0} max={100} value={t.avancement} disabled={!canEdit}
                  onChange={e => updateTache(projet.id, t.id, { avancement: Math.max(0, Math.min(100, Number(e.target.value))) })}
                  style={{ ...cellInp, width: 56, textAlign: 'center' }} /></td>
                {canEdit && <td style={{ ...td, textAlign: 'center' }}>
                  <button onClick={() => { if (confirm(`Supprimer « ${t.nom} » ?`)) { deleteTache(projet.id, t.id); toast.success('Tâche supprimée'); } }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444' }}><Trash2 size={14} /></button>
                </td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── 3. RESSOURCES & AFFECTATION ────────────────────────────────────────── */
function RessourcesPanel({ projet, taches, canEdit }: { projet: Projet; taches: TacheWBS[]; canEdit: boolean }) {
  const store = useProjectStore();
  const { assignRessource, removeAssignation, createRessource } = store;
  const [tacheSel, setTacheSel] = useState<string>(taches[0]?.id ?? '');
  const [ressId, setRessId] = useState('');
  const [alloc, setAlloc] = useState(100);
  const [search, setSearch] = useState('');

  const tache = taches.find(t => t.id === tacheSel) ?? taches[0];

  // Vivier : ressources existantes (équipe + roster) recherchables
  const pool = useMemo(() => {
    const existing = store.ressources.filter(r => r.type === 'Travail');
    const q = search.toLowerCase();
    return existing.filter(r => !q || `${r.prenom} ${r.nom}`.toLowerCase().includes(q) || (r.poste || '').toLowerCase().includes(q)).slice(0, 60);
  }, [store.ressources, search]);

  // Surcharge : somme des allocations par ressource sur tâches en cours/à faire
  const chargeParRess = useMemo(() => {
    const m: Record<string, number> = {};
    taches.forEach(t => t.assignations.forEach(a => { m[a.ressourceId] = (m[a.ressourceId] ?? 0) + a.unite; }));
    return m;
  }, [taches]);

  const affecter = () => {
    if (!tache || !ressId) return;
    assignRessource(projet.id, tache.id, ressId, alloc);
    toast.success('Ressource affectée'); setRessId('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Affectation */}
      {canEdit && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: NAVY, marginBottom: 10 }}>Affecter une ressource à une tâche</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <label style={lbl}>Tâche</label>
              <select value={tacheSel} onChange={e => setTacheSel(e.target.value)} style={inp}>
                {taches.map((t, i) => <option key={t.id} value={t.id}>{i + 1}. {t.nom.slice(0, 32)}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 180 }}>
              <label style={lbl}>Ressource (recherche)</label>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 nom / poste…" style={{ ...inp, marginBottom: 4 }} />
              <select value={ressId} onChange={e => setRessId(e.target.value)} style={inp}>
                <option value="">— Choisir —</option>
                {pool.map(r => <option key={r.id} value={r.id}>{r.prenom} {r.nom} — {r.poste || r.direction}</option>)}
              </select>
            </div>
            <div style={{ width: 110 }}>
              <label style={lbl}>Allocation %</label>
              <input type="number" min={0} max={100} value={alloc} onChange={e => setAlloc(Math.max(0, Math.min(100, Number(e.target.value))))} style={inp} />
            </div>
            <button onClick={affecter} disabled={!ressId} style={{ ...btnPrimary, opacity: ressId ? 1 : 0.5 }}><Plus size={14} /> Affecter</button>
          </div>
        </div>
      )}

      {/* Tâche sélectionnée : affectations */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: 14 }}>
        <div style={{ fontWeight: 800, fontSize: 13, color: NAVY, marginBottom: 8 }}>
          Affectations — {tache ? tache.nom : '—'}
        </div>
        {!tache || tache.assignations.length === 0 ? (
          <div style={{ color: '#94A3B8', fontSize: 12.5, padding: 8 }}>Aucune ressource affectée à cette tâche.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead><tr style={{ textAlign: 'left', color: '#64748B', borderBottom: '1px solid #E2E8F0' }}>
              <th style={th}>Ressource</th><th style={th}>Allocation</th><th style={th}>Charge totale</th>{canEdit && <th style={{ ...th, textAlign: 'center' }}>Retirer</th>}
            </tr></thead>
            <tbody>
              {tache.assignations.map(a => {
                const r = store.ressources.find(x => x.id === a.ressourceId);
                const charge = chargeParRess[a.ressourceId] ?? 0;
                const surcharge = charge > 100;
                return (
                  <tr key={a.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={td}>{r ? `${r.prenom} ${r.nom}` : a.ressourceId}</td>
                    <td style={td}>{a.unite}%</td>
                    <td style={{ ...td, color: surcharge ? '#EF4444' : '#16A34A', fontWeight: 700 }}>
                      {charge}% {surcharge && <span title="Surchargé">⚠️ surcharge</span>}
                    </td>
                    {canEdit && <td style={{ ...td, textAlign: 'center' }}>
                      <button onClick={() => removeAssignation(projet.id, tache.id, a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444' }}><Trash2 size={13} /></button>
                    </td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ─── 4. RÉFÉRENCE & SUIVI ───────────────────────────────────────────────── */
function SuiviPanel({ projet, taches, canEdit }: { projet: Projet; taches: TacheWBS[]; canEdit: boolean }) {
  const { saveBaseline, updateTache, updateProjet } = useProjectStore();

  // Avancement planifié (par durée) vs réel (par %).
  const totalDuree = taches.reduce((s, t) => s + t.duree, 0) || 1;
  const avancementReel = Math.round(taches.reduce((s, t) => s + t.duree * t.avancement, 0) / totalDuree);

  // Problèmes détectés
  const today = new Date().toISOString().slice(0, 10);
  const problemes = useMemo(() => {
    const list: { type: string; detail: string; sev: 'haut' | 'moyen' }[] = [];
    taches.forEach((t, i) => {
      if (t.dateFin < today && t.avancement < 100) list.push({ type: 'Retard', detail: `Tâche ${i + 1} « ${t.nom} » échue le ${t.dateFin}, avancement ${t.avancement}%`, sev: 'haut' });
      if (t.reference && t.dateFinRef && diffDays(t.dateFinRef, t.dateFin) > 0)
        list.push({ type: 'Glissement', detail: `« ${t.nom} » : +${diffDays(t.dateFinRef, t.dateFin)}j vs référence`, sev: 'moyen' });
    });
    // surcharge ressources
    const charge: Record<string, number> = {};
    taches.forEach(t => t.assignations.forEach(a => { charge[a.ressourceId] = (charge[a.ressourceId] ?? 0) + a.unite; }));
    Object.entries(charge).filter(([, v]) => v > 100).forEach(([rid, v]) => list.push({ type: 'Surcharge', detail: `Ressource ${rid} allouée à ${v}%`, sev: 'moyen' }));
    return list;
  }, [taches]);

  const hasBaseline = projet.baselineSaved;

  // Replanification : décale les tâches non terminées de N jours.
  const [shift, setShift] = useState(7);
  const replanifier = () => {
    if (!canEdit) return;
    let n = 0;
    taches.forEach(t => {
      if (t.avancement < 100) {
        updateTache(projet.id, t.id, { dateDebut: addDaysISO(t.dateDebut, shift), dateFin: addDaysISO(t.dateFin, shift) });
        n++;
      }
    });
    updateProjet(projet.id, { dateFinEstimee: addDaysISO(projet.dateFinEstimee, shift) });
    toast.success(`Replanification : ${n} tâche(s) décalée(s) de ${shift}j`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* KPIs + baseline */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 12 }}>
        <Kpi label="Avancement réel (tâches)" value={`${avancementReel}%`} color={NAVY} />
        <Kpi label="Avancement pondéré (phases)" value={`${computeAvancementReel(projet.phases ?? [])}%`} color="#7C3AED" />
        <Kpi label="Budget / décaissé" value={`${fmtFCFA(projet.budgetDecaisse)} / ${fmtFCFA(projet.budget)} M`} color="#16A34A" />
        <Kpi label="Problèmes détectés" value={String(problemes.length)} color={problemes.length ? '#EF4444' : '#16A34A'} />
      </div>

      {/* Planning de référence */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <CalendarClock size={18} color={NAVY} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: NAVY }}>Planning de référence (baseline)</div>
          <div style={{ fontSize: 12, color: '#64748B' }}>
            {hasBaseline ? `Référence figée le ${projet.baselineDate?.slice(0, 10)} — les écarts sont mesurés par rapport à cette base.` : 'Aucune référence — enregistrez le planning initial pour mesurer les écarts.'}
          </div>
        </div>
        <button onClick={() => { if (canEdit) { saveBaseline(projet.id); toast.success('Planning de référence enregistré'); } }} disabled={!canEdit}
          style={{ ...btnPrimary, opacity: canEdit ? 1 : 0.5 }}><Save size={14} /> {hasBaseline ? 'Mettre à jour la référence' : 'Enregistrer la référence'}</button>
      </div>

      {/* Replanification */}
      {canEdit && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <RefreshCw size={18} color="#F59E0B" />
          <div style={{ flex: 1, minWidth: 180, fontSize: 12.5, color: '#475569' }}>Replanifier : décaler les tâches non terminées de</div>
          <input type="number" min={1} value={shift} onChange={e => setShift(Math.max(1, Number(e.target.value)))} style={{ ...inp, width: 80 }} />
          <span style={{ fontSize: 12, color: '#64748B' }}>jours</span>
          <button onClick={replanifier} style={{ ...btnPrimary, background: '#F59E0B' }}><RefreshCw size={14} /> Replanifier</button>
        </div>
      )}

      {/* Problèmes */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: 14 }}>
        <div style={{ fontWeight: 800, fontSize: 13, color: NAVY, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle size={15} color="#EF4444" /> Problèmes & alertes
        </div>
        {problemes.length === 0 ? (
          <div style={{ color: '#16A34A', fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6 }}><CheckCircle2 size={15} /> Aucun problème détecté — projet sous contrôle.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {problemes.map((p, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, padding: '6px 10px', borderRadius: 7, background: p.sev === 'haut' ? '#FEF2F2' : '#FFFBEB' }}>
                <span style={{ fontWeight: 800, color: p.sev === 'haut' ? '#EF4444' : '#D97706', minWidth: 80 }}>{p.type}</span>
                <span style={{ color: '#475569' }}>{p.detail}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: '12px 14px' }}>
      <div style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{label}</div>
    </div>
  );
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 4 };
const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #CBD5E1', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' };
const cellInp: React.CSSProperties = { padding: '4px 6px', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: 12, fontFamily: 'inherit' };
const th: React.CSSProperties = { padding: '8px 10px', fontWeight: 700, fontSize: 11 };
const td: React.CSSProperties = { padding: '6px 10px' };
const btnPrimary: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: NAVY, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' };
