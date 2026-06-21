'use client';

/**
 * GestionProjet.tsx — Espace Gestion de Projet (planning projet)
 * -----------------------------------------------------------------------------
 * Couvre le cycle complet, du marché à la clôture :
 *   1. Cycle de vie : phases pondérées (Passations → Clôture) + avancement pondéré.
 *   2. Tâches (WBS) : créer / éditer / supprimer, durées, dates, %, prédécesseurs.
 *   3. Ressources : créer et AFFECTER aux tâches (% d'allocation) + surcharge.
 *   4. Référence & Suivi : planning de référence (baseline), écarts, problèmes,
 *      replanification.
 * Réservé au chef de projet et aux ingénieurs de son périmètre (sinon lecture seule).
 */

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  useProjectStore, computeAvancementReel, type Projet, type TacheWBS, type PhaseProjet,
} from '@/lib/projectStore';
import { useAuth, isOperationalReadOnly } from '@/lib/authStore';
import { useSelectedProjectStore } from '@/lib/selectedProjectStore';
import toast from 'react-hot-toast';
import {
  Layers, ListChecks, Users, Flag, Plus, Trash2, Save, AlertTriangle,
  CalendarClock, RefreshCw, GanttChart, CheckCircle2, FileSpreadsheet, Network,
  ShieldAlert, ClipboardList, GitPullRequest, ChevronUp, ChevronLeft,
} from 'lucide-react';
import MatriceLivrables from '@/components/dashboard/MatriceLivrables';
import MatriceRACI from '@/components/dashboard/MatriceRACI';
import Risques from '@/components/dashboard/Risques';

type Onglet = 'cycle' | 'taches' | 'ressources' | 'suivi' | 'livrables' | 'raci' | 'risques' | 'exigences' | 'changements';

const NAVY = '#1B4F8A';

function addDaysISO(iso: string, n: number): string {
  const d = new Date(iso); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10);
}
function diffDays(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}
function fmtFCFA(n: number): string { return n.toLocaleString('fr-FR'); }

export default function GestionProjet() {
  const router = useRouter();
  const store = useProjectStore();
  const { user, isRole } = useAuth();
  const selectedCtx = useSelectedProjectStore();
  const [onglet, setOnglet] = useState<Onglet>('cycle');
  const [projetId, setProjetId] = useState<string>(() => {
    // Priorité : contexte global (sélection cross-module) → premier projet
    if (selectedCtx.selectedId && store.projets.some(p => p.id === selectedCtx.selectedId))
      return selectedCtx.selectedId;
    return store.projets[0]?.id ?? '';
  });

  // Synchronise le contexte global quand l'utilisateur change de projet
  useEffect(() => {
    const p = store.projets.find(x => x.id === projetId);
    if (p) selectedCtx.setSelected(p.id, p.code ?? '');
  }, [projetId]); // eslint-disable-line react-hooks/exhaustive-deps

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
    { key: 'livrables', label: 'Livrables', icon: FileSpreadsheet },
    { key: 'raci', label: 'Matrice RACI', icon: Network },
    { key: 'risques', label: 'Risques & QHSE', icon: ShieldAlert },
    { key: 'exigences', label: 'Exigences', icon: ClipboardList },
    { key: 'changements', label: 'Changements', icon: GitPullRequest },
  ];

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', background: '#F4F6F9' }}>
      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 7, border: '1px solid #E2E8F0', background: '#fff', color: '#64748B', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
          <ChevronLeft size={13} /> Retour
        </button>
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
      {onglet === 'livrables' && (
        <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', border: '1px solid #E2E8F0', minHeight: 420 }}>
          <MatriceLivrables />
        </div>
      )}
      {onglet === 'raci' && (
        <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', border: '1px solid #E2E8F0', minHeight: 420 }}>
          <MatriceRACI />
        </div>
      )}
      {onglet === 'risques' && (
        <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', border: '1px solid #E2E8F0', minHeight: 420 }}>
          <Risques />
        </div>
      )}
      {onglet === 'exigences' && <ExigencesPanel projetId={projetId} readOnly={readOnly} />}
      {onglet === 'changements' && <ChangementsPanel projetId={projetId} readOnly={readOnly} />}
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
          <button onClick={addTache} disabled={!nom.trim()} title={nom.trim() ? 'Ajouter la tâche' : 'Saisissez un nom de tâche'} style={{ ...btnPrimary, opacity: nom.trim() ? 1 : 0.5, cursor: nom.trim() ? 'pointer' : 'not-allowed' }}>
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
                    aria-label={`Supprimer la tâche ${t.nom}`}
                    title="Supprimer cette tâche"
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
  const { assignRessource, removeAssignation } = store;
  const [tabRess, setTabRess] = useState<'affectation' | 'analyse'>('affectation');
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

  // Analyse : charge par ressource + tâches affectées
  const analyseRess = useMemo(() => {
    const map: Record<string, { r: (typeof store.ressources)[0]; charge: number; tachesAff: typeof taches }> = {};
    taches.forEach(t => {
      t.assignations.forEach(a => {
        const r = store.ressources.find(x => x.id === a.ressourceId);
        if (!r) return;
        if (!map[r.id]) map[r.id] = { r, charge: 0, tachesAff: [] };
        map[r.id].charge += a.unite;
        map[r.id].tachesAff.push(t);
      });
    });
    return Object.values(map).sort((a, b) => b.charge - a.charge);
  }, [taches, store.ressources]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Sous-onglets */}
      <div style={{ display: 'flex', gap: 4, background: '#E8EDF4', borderRadius: 8, padding: 3, alignSelf: 'flex-start' }}>
        {([['affectation', 'Affectation'], ['analyse', 'Analyser les ressources']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTabRess(k)} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: tabRess === k ? NAVY : 'transparent', color: tabRess === k ? '#fff' : '#475569' }}>{l}</button>
        ))}
      </div>

      {tabRess === 'analyse' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* KPIs analyse */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
            {[
              { label: 'Ressources affectées', value: analyseRess.length, color: NAVY },
              { label: 'En surcharge (>100%)', value: analyseRess.filter(x => x.charge > 100).length, color: '#DC2626' },
              { label: 'Charge moy.', value: analyseRess.length ? `${Math.round(analyseRess.reduce((s,x)=>s+x.charge,0)/analyseRess.length)}%` : '—', color: '#F59E0B' },
              { label: 'Tâches non affectées', value: taches.filter(t => t.assignations.length === 0).length, color: '#7C3AED' },
            ].map(k => (
              <div key={k.label} style={{ background: '#fff', borderRadius: 10, border: '1px solid #E2E8F0', padding: '12px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
                <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* Tâches non affectées */}
          {taches.filter(t => t.assignations.length === 0).length > 0 && (
            <div style={{ background: '#FFFBEB', borderRadius: 10, border: '1px solid #FDE68A', padding: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: '#92400E', marginBottom: 6 }}>Tâches sans ressource affectée</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {taches.filter(t => t.assignations.length === 0).map((t, i) => (
                  <div key={t.id} style={{ fontSize: 12, color: '#78350F', display: 'flex', gap: 8 }}>
                    <span style={{ fontWeight: 600 }}>{i + 1}.</span> {t.nom}
                    <span style={{ color: '#A16207', fontSize: 11 }}>({t.dateDebut} → {t.dateFin})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Histogramme charge par ressource */}
          {analyseRess.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#94A3B8', fontSize: 13 }}>Aucune ressource affectée — utilisez l'onglet Affectation.</div>
          ) : (
            <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E2E8F0', padding: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: NAVY, marginBottom: 12 }}>Charge par ressource (% allocation cumulée)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {analyseRess.map(({ r, charge, tachesAff }) => {
                  const pct = Math.min(charge, 200);
                  const color = charge > 100 ? '#DC2626' : charge > 80 ? '#F59E0B' : '#16A34A';
                  return (
                    <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 56px', gap: 10, alignItems: 'center' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.prenom} {r.nom}</div>
                        <div style={{ fontSize: 10, color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.poste || r.direction} · {tachesAff.length} tâche(s)</div>
                      </div>
                      <div style={{ background: '#F1F5F9', borderRadius: 4, height: 12, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(pct / 200) * 100}%`, background: color, borderRadius: 4, transition: 'width 0.4s' }} />
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 800, color, textAlign: 'right' }}>{charge}%</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 11, color: '#64748B' }}>
                {[{ c: '#16A34A', l: '≤80% OK' }, { c: '#F59E0B', l: '80-100% Attention' }, { c: '#DC2626', l: '>100% Surcharge' }].map(x => (
                  <div key={x.l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: x.c }} />{x.l}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tabRess === 'affectation' && <>
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
            <button onClick={affecter} disabled={!ressId} title={ressId ? 'Affecter la ressource à la tâche' : 'Sélectionnez une ressource'} style={{ ...btnPrimary, opacity: ressId ? 1 : 0.5, cursor: ressId ? 'pointer' : 'not-allowed' }}><Plus size={14} /> Affecter</button>
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
      </>}
    </div>
  );
}

/* ─── 4. RÉFÉRENCE & SUIVI ───────────────────────────────────────────────── */
function SuiviPanel({ projet, taches, canEdit }: { projet: Projet; taches: TacheWBS[]; canEdit: boolean }) {
  const { saveBaseline, updateTache, updateProjet, ressources } = useProjectStore();

  // Avancement réel pondéré par durée (tâches).
  const totalDuree = taches.reduce((s, t) => s + t.duree, 0) || 1;
  const avancementReel = Math.round(taches.reduce((s, t) => s + t.duree * t.avancement, 0) / totalDuree);
  const avancementPhases = computeAvancementReel(projet.phases ?? []);
  // Écart significatif entre les deux sources d'avancement.
  const ecartAvancement = Math.abs(avancementPhases - avancementReel) > 20 && taches.length > 0;

  // Problèmes détectés — 3 catégories distinctes.
  const today = new Date().toISOString().slice(0, 10);
  const problemes = useMemo(() => {
    const list: { type: string; detail: string; sev: 'haut' | 'moyen' | 'info' }[] = [];
    taches.forEach((t, i) => {
      if (t.dateFin < today && t.avancement === 100) return; // terminé = pas de problème
      if (t.dateFin < today && t.avancement > 0 && t.avancement < 100)
        list.push({ type: 'En retard', detail: `Tâche ${i + 1} « ${t.nom} » — en cours depuis ${t.dateDebut}, échue le ${t.dateFin} (${t.avancement}%)`, sev: 'haut' });
      else if (t.dateFin < today && t.avancement === 0)
        list.push({ type: 'Non démarré', detail: `Tâche ${i + 1} « ${t.nom} » — planifiée jusqu'au ${t.dateFin}, non commencée`, sev: 'moyen' });
      if (t.reference && t.dateFinRef && diffDays(t.dateFinRef, t.dateFin) > 0)
        list.push({ type: 'Glissement', detail: `« ${t.nom} » : +${diffDays(t.dateFinRef, t.dateFin)}j vs référence`, sev: 'moyen' });
    });
    // Surcharge ressources — avec résolution du nom.
    const charge: Record<string, number> = {};
    taches.forEach(t => t.assignations.forEach(a => {
      charge[a.ressourceId] = (charge[a.ressourceId] ?? 0) + a.unite;
    }));
    Object.entries(charge).filter(([, v]) => v > 100).forEach(([rid, v]) => {
      const r = ressources.find(x => x.id === rid);
      const nom = r ? `${r.prenom} ${r.nom}`.trim() : rid;
      list.push({ type: 'Surcharge', detail: `${nom} — alloué à ${v}% (seuil : 100%)`, sev: 'moyen' });
    });
    return list;
  }, [taches, ressources]);

  const hasBaseline = projet.baselineSaved;

  // Replanification avec confirmation.
  const [shift, setShift] = useState(7);
  const [confirmReplan, setConfirmReplan] = useState(false);
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
    setConfirmReplan(false);
    toast.success(`Replanification : ${n} tâche(s) décalée(s) de +${shift} jour${shift > 1 ? 's' : ''}`);
  };

  // Catégories de sévérité pour l'affichage.
  const sevCfg = {
    haut:  { bg: '#FEF2F2', color: '#EF4444', border: '#FECACA' },
    moyen: { bg: '#FFFBEB', color: '#D97706', border: '#FDE68A' },
    info:  { bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE' },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 12 }}>
        <Kpi label="Avancement tâches (WBS)" value={`${avancementReel}%`} color={NAVY} />
        <Kpi label="Avancement phases (pondéré)" value={`${avancementPhases}%`} color="#7C3AED" />
        <Kpi label="Budget décaissé / total" value={`${fmtFCFA(projet.budgetDecaisse)} / ${fmtFCFA(projet.budget)} M`} color="#16A34A" />
        <Kpi label="Alertes actives" value={String(problemes.length)} color={problemes.length ? '#EF4444' : '#16A34A'} />
      </div>

      {/* Écart d'avancement — avertissement synchronisation */}
      {ecartAvancement && (
        <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <AlertTriangle size={15} color="#2563EB" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12, color: '#1D4ED8' }}>
            <strong>Écart d'avancement détecté</strong> — L'avancement des tâches WBS ({avancementReel}%) diffère de l'avancement pondéré des phases ({avancementPhases}%).
            Mettez à jour les pourcentages d'avancement des tâches pour aligner les deux sources.
          </div>
        </div>
      )}

      {/* Planning de référence (baseline) */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <CalendarClock size={18} color={NAVY} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: NAVY }}>Planning de référence (baseline)</div>
          <div style={{ fontSize: 12, color: '#64748B' }}>
            {hasBaseline
              ? `Référence figée le ${projet.baselineDate?.slice(0, 10)} — les écarts sont mesurés par rapport à cette base.`
              : 'Aucune référence enregistrée. Figez le planning initial pour mesurer les glissements.'}
          </div>
        </div>
        <button onClick={() => { if (canEdit) { saveBaseline(projet.id); toast.success('Planning de référence enregistré'); } }} disabled={!canEdit}
          style={{ ...btnPrimary, opacity: canEdit ? 1 : 0.5 }}>
          <Save size={14} /> {hasBaseline ? 'Mettre à jour' : 'Enregistrer la référence'}
        </button>
      </div>

      {/* Replanification avec confirmation */}
      {canEdit && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <RefreshCw size={18} color="#F59E0B" />
            <div style={{ flex: 1, minWidth: 180, fontSize: 12.5, color: '#475569', fontWeight: 600 }}>Replanification</div>
            <span style={{ fontSize: 12, color: '#64748B' }}>Décaler les tâches non terminées de</span>
            <input type="number" min={1} max={365} value={shift} onChange={e => setShift(Math.max(1, Number(e.target.value)))} style={{ ...inp, width: 72 }} />
            <span style={{ fontSize: 12, color: '#64748B' }}>jours</span>
            {!confirmReplan ? (
              <button onClick={() => setConfirmReplan(true)} style={{ ...btnPrimary, background: '#F59E0B' }}>
                <RefreshCw size={14} /> Replanifier
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#92400E', fontWeight: 600 }}>Décaler {taches.filter(t => t.avancement < 100).length} tâches de +{shift}j ?</span>
                <button onClick={replanifier} style={{ ...btnPrimary, background: '#EF4444', padding: '7px 12px', fontSize: 12 }}>Confirmer</button>
                <button onClick={() => setConfirmReplan(false)} style={{ ...btnPrimary, background: '#6B7280', padding: '7px 12px', fontSize: 12 }}>Annuler</button>
              </div>
            )}
          </div>
          {confirmReplan && (
            <div style={{ marginTop: 10, padding: '8px 12px', background: '#FEF3C7', borderRadius: 7, fontSize: 11, color: '#92400E' }}>
              ⚠ Cette action décalera les dates de début et de fin de toutes les tâches non terminées et la date de fin estimée du projet.
            </div>
          )}
        </div>
      )}

      {/* Problèmes & alertes */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: 14 }}>
        <div style={{ fontWeight: 800, fontSize: 13, color: NAVY, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle size={15} color={problemes.length ? '#EF4444' : '#16A34A'} />
          Problèmes & alertes
          {problemes.length > 0 && (
            <span style={{ fontSize: 11, fontWeight: 600, background: '#FEE2E2', color: '#DC2626', borderRadius: 10, padding: '1px 8px', marginLeft: 4 }}>
              {problemes.filter(p => p.sev === 'haut').length} critiques · {problemes.filter(p => p.sev === 'moyen').length} modérées
            </span>
          )}
        </div>
        {problemes.length === 0 ? (
          <div style={{ color: '#16A34A', fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle2 size={15} /> Aucun problème détecté — projet sous contrôle.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {problemes.map((p, i) => {
              const cfg = sevCfg[p.sev];
              return (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 12, padding: '7px 12px', borderRadius: 7, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                  <span style={{ fontWeight: 700, color: cfg.color, minWidth: 90, flexShrink: 0 }}>{p.type}</span>
                  <span style={{ color: '#475569', lineHeight: 1.4 }}>{p.detail}</span>
                </div>
              );
            })}
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
const th: React.CSSProperties = { padding: '8px 10px', fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '6px 10px', verticalAlign: 'top' };
const btnPrimary: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: NAVY, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' };

/* ─── EXIGENCES ───────────────────────────────────────────────────────────── */
type Exigence = { id: string; ref: string; description: string; source: string; priorite: 'Critique' | 'Haute' | 'Normale' | 'Faible'; statut: 'À valider' | 'Validée' | 'Rejetée' | 'En attente'; notes: string };
const PRIO_COLORS: Record<Exigence['priorite'], string> = { Critique: '#DC2626', Haute: '#D97706', Normale: '#2563EB', Faible: '#64748B' };
const STATUT_EXG_COLORS: Record<Exigence['statut'], string> = { 'À valider': '#D97706', Validée: '#16A34A', Rejetée: '#DC2626', 'En attente': '#6B7280' };
const SEED_EXG: Exigence[] = [
  { id: '1', ref: 'EXG-001', description: 'La solution doit être accessible depuis les navigateurs Chrome, Firefox et Edge dans leur version N-1 minimum.', source: 'Cahier des charges', priorite: 'Critique', statut: 'Validée', notes: '' },
  { id: '2', ref: 'EXG-002', description: 'Temps de réponse des pages dashboard < 3 secondes avec 50 utilisateurs simultanés.', source: 'CHEF_CELLULE', priorite: 'Haute', statut: 'À valider', notes: 'Benchmark prévu S3' },
  { id: '3', ref: 'EXG-003', description: 'Toutes les données échangées entre le client et le serveur doivent être chiffrées (TLS 1.2+).', source: 'DSI SENELEC', priorite: 'Critique', statut: 'Validée', notes: '' },
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ExigencesPanel({ projetId: _projetId, readOnly }: { projetId: string; readOnly: boolean }) {
  const [rows, setRows] = useState<Exigence[]>(SEED_EXG);
  const [form, setForm] = useState<Omit<Exigence, 'id'>>({ ref: '', description: '', source: '', priorite: 'Normale', statut: 'À valider', notes: '' });
  const [showForm, setShowForm] = useState(false);

  function add() {
    if (!form.ref || !form.description) return;
    setRows(r => [...r, { ...form, id: Date.now().toString() }]);
    setForm({ ref: '', description: '', source: '', priorite: 'Normale', statut: 'À valider', notes: '' });
    setShowForm(false);
    toast.success('Exigence ajoutée');
  }
  function del(id: string) { setRows(r => r.filter(x => x.id !== id)); }

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid #E2E8F0' }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
          <ClipboardList size={16} color={NAVY} /> Registre des Exigences
          <span style={{ background: '#EFF6FF', color: NAVY, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{rows.length}</span>
        </div>
        {!readOnly && (
          <button onClick={() => setShowForm(s => !s)} style={{ ...btnPrimary, padding: '7px 14px', fontSize: 12 }}>
            {showForm ? <ChevronUp size={14} /> : <Plus size={14} />} Nouvelle exigence
          </button>
        )}
      </div>

      {showForm && (
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC', display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
          <div><label style={lbl}>Référence</label><input style={inp} value={form.ref} onChange={e => setForm(f => ({ ...f, ref: e.target.value }))} placeholder="EXG-004" /></div>
          <div><label style={lbl}>Source</label><input style={inp} value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} placeholder="Cahier des charges, PMO…" /></div>
          <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Description</label><textarea style={{ ...inp, height: 64, resize: 'vertical' }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Décrire l'exigence fonctionnelle ou technique…" /></div>
          <div>
            <label style={lbl}>Priorité</label>
            <select style={inp} value={form.priorite} onChange={e => setForm(f => ({ ...f, priorite: e.target.value as Exigence['priorite'] }))}>
              {(['Critique', 'Haute', 'Normale', 'Faible'] as const).map(v => <option key={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Statut</label>
            <select style={inp} value={form.statut} onChange={e => setForm(f => ({ ...f, statut: e.target.value as Exigence['statut'] }))}>
              {(['À valider', 'Validée', 'Rejetée', 'En attente'] as const).map(v => <option key={v}>{v}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Notes</label><input style={inp} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
          <div style={{ gridColumn: '1/-1', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowForm(false)} style={{ padding: '8px 16px', border: '1.5px solid #CBD5E1', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>Annuler</button>
            <button onClick={add} style={btnPrimary}><Save size={13} /> Enregistrer</button>
          </div>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 72 }} />
            <col />
            <col style={{ width: 130 }} />
            <col style={{ width: 85 }} />
            <col style={{ width: 95 }} />
            <col style={{ width: 130 }} />
            <col style={{ width: 36 }} />
          </colgroup>
          <thead style={{ background: '#F8FAFC' }}>
            <tr>
              {['Réf.', 'Description', 'Source', 'Priorité', 'Statut', 'Notes', ''].map(h => (
                <th key={h} style={{ ...th, textAlign: 'left', color: '#475569', borderBottom: '1.5px solid #E2E8F0' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.id} style={{ background: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                <td style={{ ...td, fontWeight: 700, color: NAVY, whiteSpace: 'nowrap' }}>{row.ref}</td>
                <td style={{ ...td, color: '#0F172A', wordBreak: 'break-word', lineHeight: 1.45 }}>{row.description}</td>
                <td style={{ ...td, color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.source}</td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}><span style={{ background: PRIO_COLORS[row.priorite] + '1A', color: PRIO_COLORS[row.priorite], borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 700 }}>{row.priorite}</span></td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}><span style={{ background: STATUT_EXG_COLORS[row.statut] + '1A', color: STATUT_EXG_COLORS[row.statut], borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 700 }}>{row.statut}</span></td>
                <td style={{ ...td, color: '#64748B', wordBreak: 'break-word' }}>{row.notes}</td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>{!readOnly && <button onClick={() => del(row.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', padding: 4 }}><Trash2 size={13} /></button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div style={{ textAlign: 'center', padding: '32px', color: '#94A3B8', fontSize: 13 }}>Aucune exigence enregistrée.</div>}
      </div>
    </div>
  );
}

/* ─── CHANGEMENTS ─────────────────────────────────────────────────────────── */
type Changement = { id: string; ref: string; date: string; demandeur: string; description: string; impact: 'Faible' | 'Modéré' | 'Élevé' | 'Critique'; decision: 'Accepté' | 'Refusé' | 'En cours' | 'Différé'; statut: 'Ouvert' | 'Clôturé' };
const IMPACT_COLORS: Record<Changement['impact'], string> = { Faible: '#64748B', Modéré: '#D97706', Élevé: '#EA580C', Critique: '#DC2626' };
const DEC_COLORS: Record<Changement['decision'], string> = { Accepté: '#16A34A', Refusé: '#DC2626', 'En cours': '#2563EB', Différé: '#92400E' };
const SEED_CHG: Changement[] = [
  { id: '1', ref: 'CR-001', date: '2025-03-10', demandeur: 'Chef Projet', description: 'Extension du délai de la phase passation de 2 semaines suite aux délais de publication au JORS.', impact: 'Modéré', decision: 'Accepté', statut: 'Clôturé' },
  { id: '2', ref: 'CR-002', date: '2025-04-22', demandeur: 'Bailleur', description: 'Modification du scope : ajout de 3 sous-stations supplémentaires non prévues dans le contrat initial.', impact: 'Critique', decision: 'En cours', statut: 'Ouvert' },
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ChangementsPanel({ projetId: _projetId, readOnly }: { projetId: string; readOnly: boolean }) {
  const [rows, setRows] = useState<Changement[]>(SEED_CHG);
  const [form, setForm] = useState<Omit<Changement, 'id'>>({ ref: '', date: new Date().toISOString().slice(0, 10), demandeur: '', description: '', impact: 'Modéré', decision: 'En cours', statut: 'Ouvert' });
  const [showForm, setShowForm] = useState(false);

  function add() {
    if (!form.ref || !form.description) return;
    setRows(r => [...r, { ...form, id: Date.now().toString() }]);
    setForm({ ref: '', date: new Date().toISOString().slice(0, 10), demandeur: '', description: '', impact: 'Modéré', decision: 'En cours', statut: 'Ouvert' });
    setShowForm(false);
    toast.success('Demande de changement enregistrée');
  }
  function del(id: string) { setRows(r => r.filter(x => x.id !== id)); }

  const open = rows.filter(r => r.statut === 'Ouvert').length;

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid #E2E8F0' }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
          <GitPullRequest size={16} color={NAVY} /> Registre des Changements
          {open > 0 && <span style={{ background: '#FEF3C7', color: '#92400E', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{open} ouvert{open > 1 ? 's' : ''}</span>}
        </div>
        {!readOnly && (
          <button onClick={() => setShowForm(s => !s)} style={{ ...btnPrimary, padding: '7px 14px', fontSize: 12 }}>
            {showForm ? <ChevronUp size={14} /> : <Plus size={14} />} Nouvelle demande
          </button>
        )}
      </div>

      {showForm && (
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC', display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
          <div><label style={lbl}>Référence</label><input style={inp} value={form.ref} onChange={e => setForm(f => ({ ...f, ref: e.target.value }))} placeholder="CR-003" /></div>
          <div><label style={lbl}>Date</label><input type="date" style={inp} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
          <div><label style={lbl}>Demandeur</label><input style={inp} value={form.demandeur} onChange={e => setForm(f => ({ ...f, demandeur: e.target.value }))} /></div>
          <div>
            <label style={lbl}>Impact</label>
            <select style={inp} value={form.impact} onChange={e => setForm(f => ({ ...f, impact: e.target.value as Changement['impact'] }))}>
              {(['Faible', 'Modéré', 'Élevé', 'Critique'] as const).map(v => <option key={v}>{v}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Description</label><textarea style={{ ...inp, height: 64, resize: 'vertical' }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Décrire la demande de changement et son contexte…" /></div>
          <div>
            <label style={lbl}>Décision</label>
            <select style={inp} value={form.decision} onChange={e => setForm(f => ({ ...f, decision: e.target.value as Changement['decision'] }))}>
              {(['Accepté', 'Refusé', 'En cours', 'Différé'] as const).map(v => <option key={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Statut</label>
            <select style={inp} value={form.statut} onChange={e => setForm(f => ({ ...f, statut: e.target.value as Changement['statut'] }))}>
              {(['Ouvert', 'Clôturé'] as const).map(v => <option key={v}>{v}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: '1/-1', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowForm(false)} style={{ padding: '8px 16px', border: '1.5px solid #CBD5E1', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>Annuler</button>
            <button onClick={add} style={btnPrimary}><Save size={13} /> Enregistrer</button>
          </div>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 72 }} />
            <col style={{ width: 80 }} />
            <col style={{ width: 110 }} />
            <col />
            <col style={{ width: 80 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 80 }} />
            <col style={{ width: 36 }} />
          </colgroup>
          <thead style={{ background: '#F8FAFC' }}>
            <tr>
              {['Réf.', 'Date', 'Demandeur', 'Description', 'Impact', 'Décision', 'Statut', ''].map(h => (
                <th key={h} style={{ ...th, textAlign: 'left', color: '#475569', borderBottom: '1.5px solid #E2E8F0' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.id} style={{ background: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                <td style={{ ...td, fontWeight: 700, color: NAVY, whiteSpace: 'nowrap' }}>{row.ref}</td>
                <td style={{ ...td, whiteSpace: 'nowrap', color: '#475569' }}>{row.date}</td>
                <td style={{ ...td, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.demandeur}</td>
                <td style={{ ...td, color: '#0F172A', wordBreak: 'break-word', lineHeight: 1.45 }}>{row.description}</td>
                <td style={td}><span style={{ background: IMPACT_COLORS[row.impact] + '1A', color: IMPACT_COLORS[row.impact], borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 700 }}>{row.impact}</span></td>
                <td style={td}><span style={{ background: DEC_COLORS[row.decision] + '1A', color: DEC_COLORS[row.decision], borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 700 }}>{row.decision}</span></td>
                <td style={td}><span style={{ background: row.statut === 'Ouvert' ? '#EFF6FF' : '#F1F5F9', color: row.statut === 'Ouvert' ? '#2563EB' : '#475569', borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 700 }}>{row.statut}</span></td>
                <td style={td}>{!readOnly && <button onClick={() => del(row.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', padding: 4 }}><Trash2 size={13} /></button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div style={{ textAlign: 'center', padding: '32px', color: '#94A3B8', fontSize: 13 }}>Aucune demande de changement enregistrée.</div>}
      </div>
    </div>
  );
}
