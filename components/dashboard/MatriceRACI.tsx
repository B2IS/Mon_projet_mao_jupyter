'use client';
/**
 * MatriceRACI — matrice responsabilités R/A/C/I
 * - Lignes = tâches WBS, Colonnes = membres équipe
 * - Édition inline par clic (cycle R→A→C→I→vide)
 * - Couleurs R=rouge, A=orange, C=bleu, I=gris
 * - Validation : chaque tâche doit avoir exactement 1 R
 * - Export Excel via xlsx
 */
import { useState, useMemo, useCallback } from 'react';
import { useProjectStore } from '@/lib/projectStore';
import { useAuth } from '@/lib/authStore';
import toast from 'react-hot-toast';
import {
  Download, AlertTriangle, CheckCircle2, Users, Plus, Trash2,
  Info, Filter,
} from 'lucide-react';

// ── Palette ──────────────────────────────────────────────────────────────────
const NAVY   = '#1B4F8A';
const SLATE  = '#64748B';

type RACIValue = 'R' | 'A' | 'C' | 'I';

const RACI_CFG: Record<RACIValue, { label: string; bg: string; color: string; description: string }> = {
  R: { label: 'R', bg: '#FEF2F2', color: '#DC2626', description: 'Responsable — réalise la tâche' },
  A: { label: 'A', bg: '#FFF7ED', color: '#EA580C', description: 'Approbateur — valide et signe' },
  C: { label: 'C', bg: '#EFF6FF', color: '#2563EB', description: 'Consulté — donne un avis' },
  I: { label: 'I', bg: '#F8FAFC', color: '#64748B', description: 'Informé — reçoit l\'information' },
};

const CYCLE: (RACIValue | '')[] = ['R', 'A', 'C', 'I', ''];

function nextValue(current: RACIValue | ''): RACIValue | '' {
  const idx = CYCLE.indexOf(current);
  return CYCLE[(idx + 1) % CYCLE.length];
}

// ── Export Excel ──────────────────────────────────────────────────────────────
async function exportRACIExcel(
  projectNom: string,
  tasks: { id: string; code: string; nom: string; raci: Record<string, RACIValue> }[],
  actors: string[],
  filename: string
) {
  const XLSX = await import('xlsx');
  const headers = ['Code', 'Tâche / Livrable', ...actors];
  const data = tasks.map(t => [t.code, t.nom, ...actors.map(a => t.raci[a] ?? '')]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
  ws['!cols'] = [{ wch: 10 }, { wch: 40 }, ...actors.map(() => ({ wch: 14 }))];

  const legendHeaders = ['Code', 'Signification'];
  const legendData = Object.entries(RACI_CFG).map(([k, v]) => [k, v.description]);
  const wsL = XLSX.utils.aoa_to_sheet([legendHeaders, ...legendData]);
  wsL['!cols'] = [{ wch: 6 }, { wch: 50 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Matrice RACI');
  XLSX.utils.book_append_sheet(wb, wsL, 'Légende');
  XLSX.writeFile(wb, filename);
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
export default function MatriceRACI() {
  const store = useProjectStore();
  const { user } = useAuth();
  const canEdit = user && ['ADMIN', 'CHEF_PROJ', 'PMO', 'CHEF_DEPT'].includes(user.role);

  // ── Sélection projet ───────────────────────────────────────────────────────
  const [selectedProjetId, setSelectedProjetId] = useState<string>(store.projets[0]?.id ?? '');
  const projet = useMemo(() => store.projets.find(p => p.id === selectedProjetId), [store.projets, selectedProjetId]);

  // ── Acteurs (colonnes) — initialisés depuis l'équipe du projet ─────────────
  const defaultActors = useMemo((): string[] => {
    if (!projet) return [];
    const names = new Set<string>();
    projet.taches.forEach(t => {
      t.assigneA && names.add(t.assigneA);
      (t.livrables ?? []).forEach(l => { l.proprietaireNom && names.add(l.proprietaireNom); });
    });
    (projet.equipe ?? []).forEach((m: { nom?: string; prenom?: string; nomComplet?: string }) => {
      const full = m.nomComplet ?? `${m.prenom ?? ''} ${m.nom ?? ''}`.trim();
      if (full) names.add(full);
    });
    return Array.from(names).filter(Boolean).slice(0, 20);
  }, [projet]);

  const [actors, setActors] = useState<string[]>([]);
  const [newActorName, setNewActorName] = useState('');
  const [showAddActor, setShowAddActor] = useState(false);
  const [showLegend, setShowLegend] = useState(false);

  // Synchronise acteurs quand on change de projet
  const effectiveActors = actors.length > 0 ? actors : defaultActors;

  // ── RACI local state (patch par-dessus ce qui est dans le store) ──────────
  const [raciPatch, setRaciPatch] = useState<Record<string, Record<string, RACIValue | ''>>>({});

  // Fusionne store + patch
  const getRaci = useCallback((tacheId: string, actor: string): RACIValue | '' => {
    if (raciPatch[tacheId]?.[actor] !== undefined) return raciPatch[tacheId][actor];
    const t = projet?.taches.find(t => t.id === tacheId);
    return (t?.raci?.[actor] ?? '') as RACIValue | '';
  }, [raciPatch, projet]);

  // Cycle on click
  const toggleCell = useCallback((tacheId: string, actor: string) => {
    if (!canEdit) return;
    const current = getRaci(tacheId, actor);
    const next = nextValue(current);
    setRaciPatch(prev => ({
      ...prev,
      [tacheId]: { ...(prev[tacheId] ?? {}), [actor]: next },
    }));
  }, [canEdit, getRaci]);

  // Sauvegarde dans le store
  const saveRaci = useCallback(() => {
    if (!projet) return;
    let count = 0;
    for (const [tacheId, actorMap] of Object.entries(raciPatch)) {
      const tache = projet.taches.find(t => t.id === tacheId);
      if (!tache) continue;
      const merged = { ...(tache.raci ?? {}) };
      for (const [actor, val] of Object.entries(actorMap)) {
        if (val === '') delete merged[actor];
        else merged[actor] = val as RACIValue;
      }
      store.updateTache(projet.id, tacheId, { raci: merged });
      count++;
    }
    setRaciPatch({});
    toast.success(`Matrice RACI sauvegardée (${count} tâche${count !== 1 ? 's' : ''} modifiée${count !== 1 ? 's' : ''})`);
  }, [projet, raciPatch, store]);

  // ── Validation ─────────────────────────────────────────────────────────────
  const validation = useMemo(() => {
    if (!projet) return { ok: true, issues: [] as string[] };
    const issues: string[] = [];
    projet.taches.forEach(t => {
      const rActor = effectiveActors.filter(a => getRaci(t.id, a) === 'R');
      if (rActor.length === 0) issues.push(`« ${t.nom.slice(0, 35)} » : aucun Responsable (R)`);
      if (rActor.length > 1)  issues.push(`« ${t.nom.slice(0, 35)} » : ${rActor.length} Responsables — doit être 1`);
    });
    return { ok: issues.length === 0, issues };
  }, [projet, effectiveActors, getRaci]);

  const hasUnsaved = Object.keys(raciPatch).length > 0;

  // ── Ajouter acteur ─────────────────────────────────────────────────────────
  const addActor = () => {
    const name = newActorName.trim();
    if (!name || effectiveActors.includes(name)) return;
    setActors([...effectiveActors, name]);
    setNewActorName('');
    setShowAddActor(false);
  };

  const removeActor = (name: string) => {
    setActors(effectiveActors.filter(a => a !== name));
    // Nettoyage du patch
    setRaciPatch(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(tid => { delete next[tid]?.[name]; });
      return next;
    });
  };

  // ── Export ─────────────────────────────────────────────────────────────────
  const handleExport = async () => {
    if (!projet) return;
    const tasks = projet.taches.map(t => ({
      id: t.id,
      code: t.code ?? t.id,
      nom: t.nom,
      raci: Object.fromEntries(
        effectiveActors.map(a => [a, getRaci(t.id, a) as RACIValue]).filter(([, v]) => v)
      ) as Record<string, RACIValue>,
    }));
    await exportRACIExcel(projet.nom, tasks, effectiveActors, `raci-${projet.code ?? projet.id}-${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  if (!projet) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: SLATE }}>
        <Users size={40} style={{ margin: '0 auto 12px', display: 'block', color: '#CBD5E1' }} />
        <div style={{ fontWeight: 600 }}>Aucun projet sélectionné</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Barre d'outils ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: '#fff', borderBottom: '1px solid #E2E8F0', flexWrap: 'wrap' }}>
        <Users size={18} color={NAVY} />
        <span style={{ fontWeight: 800, fontSize: 14, color: '#0F172A' }}>Matrice RACI</span>

        {/* Sélecteur projet */}
        <select value={selectedProjetId} onChange={e => { setSelectedProjetId(e.target.value); setRaciPatch({}); setActors([]); }}
          style={{ padding: '4px 10px', border: '1px solid #E2E8F0', borderRadius: 6, fontSize: 12, minWidth: 200, fontFamily: 'inherit' }}>
          {store.projets.map(p => <option key={p.id} value={p.id}>{p.code} — {p.nom.slice(0, 30)}</option>)}
        </select>

        <span style={{ fontSize: 11, color: SLATE, background: '#F1F5F9', padding: '2px 8px', borderRadius: 20 }}>
          {projet.taches.length} tâche{projet.taches.length !== 1 ? 's' : ''} · {effectiveActors.length} acteur{effectiveActors.length !== 1 ? 's' : ''}
        </span>

        {/* Légende */}
        <button onClick={() => setShowLegend(l => !l)}
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', border: '1px solid #E2E8F0', borderRadius: 6, background: showLegend ? '#EFF6FF' : '#fff', color: showLegend ? NAVY : SLATE, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
          <Info size={12} /> Légende
        </button>

        {canEdit && (
          <button onClick={() => setShowAddActor(a => !a)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', border: 'none', borderRadius: 6, background: '#F0FDF4', color: '#065F46', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            <Plus size={12} /> Acteur
          </button>
        )}

        {hasUnsaved && canEdit && (
          <button onClick={saveRaci}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 14px', border: 'none', borderRadius: 6, background: NAVY, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Sauvegarder
          </button>
        )}

        <button onClick={handleExport}
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', border: '1px solid #10B981', borderRadius: 6, background: '#F0FDF4', color: '#065F46', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginLeft: 'auto' }}>
          <Download size={12} /> Export Excel
        </button>
      </div>

      {/* ── Légende ────────────────────────────────────────────────────────── */}
      {showLegend && (
        <div style={{ display: 'flex', gap: 16, padding: '8px 16px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', flexWrap: 'wrap' }}>
          {Object.entries(RACI_CFG).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 24, height: 24, borderRadius: 4, background: v.bg, color: v.color, fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${v.color}30` }}>{k}</span>
              <span style={{ fontSize: 12, color: '#475569' }}>{v.description}</span>
            </div>
          ))}
          {canEdit && (
            <span style={{ fontSize: 11, color: SLATE, fontStyle: 'italic', alignSelf: 'center' }}>· Cliquez une cellule pour cycler R→A→C→I→vide</span>
          )}
        </div>
      )}

      {/* ── Ajout acteur ───────────────────────────────────────────────────── */}
      {showAddActor && (
        <div style={{ display: 'flex', gap: 8, padding: '8px 16px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', alignItems: 'center' }}>
          <input value={newActorName} onChange={e => setNewActorName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addActor()}
            placeholder="Nom de l'acteur (ex : Chef Projet BT)"
            style={{ padding: '6px 10px', border: '1px solid #CBD5E1', borderRadius: 6, fontSize: 12, minWidth: 220, fontFamily: 'inherit' }} />
          <button onClick={addActor}
            style={{ padding: '6px 14px', border: 'none', borderRadius: 6, background: NAVY, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Ajouter
          </button>
          <button onClick={() => setShowAddActor(false)}
            style={{ padding: '6px 10px', border: '1px solid #E2E8F0', borderRadius: 6, background: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            Annuler
          </button>
        </div>
      )}

      {/* ── Alerte validation ───────────────────────────────────────────────── */}
      {!validation.ok && (
        <div style={{ padding: '8px 16px', background: '#FFFBEB', borderBottom: '1px solid #FCD34D', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <AlertTriangle size={14} color='#D97706' style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#92400E' }}>{validation.issues.length} problème{validation.issues.length !== 1 ? 's' : ''} détecté{validation.issues.length !== 1 ? 's' : ''}</div>
            <ul style={{ margin: '4px 0 0', padding: '0 0 0 16px', fontSize: 11, color: '#92400E' }}>
              {validation.issues.slice(0, 5).map((iss, i) => <li key={i}>{iss}</li>)}
              {validation.issues.length > 5 && <li>… et {validation.issues.length - 5} autres</li>}
            </ul>
          </div>
        </div>
      )}
      {validation.ok && projet.taches.length > 0 && (
        <div style={{ padding: '6px 16px', background: '#F0FDF4', borderBottom: '1px solid #BBF7D0', display: 'flex', gap: 6, alignItems: 'center' }}>
          <CheckCircle2 size={13} color='#059669' />
          <span style={{ fontSize: 12, color: '#065F46', fontWeight: 600 }}>Matrice valide — chaque tâche a exactement un Responsable</span>
        </div>
      )}

      {/* ── Grille ─────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto' }}>
        {projet.taches.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: SLATE }}>
            <Filter size={40} style={{ margin: '0 auto 12px', display: 'block', color: '#CBD5E1' }} />
            <div style={{ fontWeight: 600 }}>Aucune tâche dans ce projet</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Ajoutez des tâches depuis l'onglet WBS.</div>
          </div>
        ) : (
          <table style={{ borderCollapse: 'collapse', width: 'max-content', minWidth: '100%' }}>
            <thead>
              <tr style={{ background: NAVY, color: '#fff', position: 'sticky', top: 0, zIndex: 2 }}>
                {/* Colonnes fixes */}
                <th style={{ padding: '8px 10px', fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap', textAlign: 'left', borderRight: '2px solid rgba(255,255,255,0.2)', minWidth: 70 }}>Code</th>
                <th style={{ padding: '8px 12px', fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap', textAlign: 'left', borderRight: '2px solid rgba(255,255,255,0.3)', minWidth: 280 }}>Tâche / Livrable</th>
                {/* Colonnes acteurs */}
                {effectiveActors.map(actor => (
                  <th key={actor} style={{ padding: '6px 8px', fontWeight: 700, fontSize: 10, textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.15)', minWidth: 90, maxWidth: 120 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 100, display: 'block' }} title={actor}>
                        {actor.length > 12 ? actor.slice(0, 12) + '…' : actor}
                      </span>
                      {canEdit && (
                        <button onClick={() => removeActor(actor)} title={`Supprimer ${actor}`}
                          style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 3, padding: '1px 4px', cursor: 'pointer', color: 'rgba(255,255,255,0.8)', fontSize: 9 }}>
                          ✕
                        </button>
                      )}
                    </div>
                  </th>
                ))}
                {effectiveActors.length === 0 && (
                  <th style={{ padding: '8px 16px', fontWeight: 400, fontSize: 11, fontStyle: 'italic', color: 'rgba(255,255,255,0.6)' }}>
                    Ajoutez des acteurs →
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {projet.taches.map((tache, ri) => {
                const rCount = effectiveActors.filter(a => getRaci(tache.id, a) === 'R').length;
                const rowBg = ri % 2 === 0 ? '#fff' : '#F8FAFC';
                const rowHighlight = rCount === 0 ? '#FFF7ED' : rCount > 1 ? '#FEF2F2' : rowBg;

                return (
                  <tr key={tache.id} style={{ background: rowHighlight, borderBottom: '1px solid #E2E8F0' }}>
                    {/* Code */}
                    <td style={{ padding: '6px 10px', borderRight: '2px solid #E2E8F0', fontSize: 11, color: SLATE, fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {tache.code ?? tache.id.slice(-4)}
                    </td>
                    {/* Nom tâche */}
                    <td style={{ padding: '6px 12px', borderRight: '2px solid #E2E8F0', fontSize: 12, color: '#1E293B', fontWeight: 500, minWidth: 280 }}>
                      <div style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={tache.nom}>
                        {tache.nom}
                      </div>
                      {rCount === 0 && (
                        <span style={{ fontSize: 10, color: '#D97706', fontWeight: 700 }}>⚠ Aucun R</span>
                      )}
                      {rCount > 1 && (
                        <span style={{ fontSize: 10, color: '#DC2626', fontWeight: 700 }}>⚠ {rCount} R</span>
                      )}
                    </td>
                    {/* Cellules RACI */}
                    {effectiveActors.map(actor => {
                      const val = getRaci(tache.id, actor);
                      const cfg = val ? RACI_CFG[val] : null;
                      const isModified = raciPatch[tache.id]?.[actor] !== undefined;

                      return (
                        <td key={actor} onClick={() => toggleCell(tache.id, actor)}
                          style={{ textAlign: 'center', padding: '4px', borderRight: '1px solid #E2E8F0', cursor: canEdit ? 'pointer' : 'default' }}>
                          {cfg ? (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              width: 32, height: 28, borderRadius: 6, fontWeight: 900, fontSize: 13,
                              background: cfg.bg, color: cfg.color,
                              border: `2px solid ${cfg.color}40`,
                              outline: isModified ? `2px dashed ${cfg.color}` : 'none',
                              transition: 'all 0.15s',
                              boxShadow: isModified ? `0 0 0 2px ${cfg.color}20` : 'none',
                            }} title={cfg.description}>
                              {val}
                            </span>
                          ) : (
                            <span style={{ display: 'inline-block', width: 32, height: 28, borderRadius: 6,
                              background: canEdit ? '#F8FAFC' : 'transparent',
                              border: canEdit ? '1px dashed #CBD5E1' : 'none',
                              cursor: canEdit ? 'pointer' : 'default',
                            }} />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Légende compacte en bas ─────────────────────────────────────────── */}
      <div style={{ padding: '6px 16px', borderTop: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {Object.entries(RACI_CFG).map(([k, v]) => (
          <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#475569' }}>
            <span style={{ fontWeight: 800, color: v.color }}>{k}</span> = {v.description.split(' — ')[0]}
          </span>
        ))}
        {hasUnsaved && (
          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#D97706', fontWeight: 600 }}>
            ● Modifications non sauvegardées
          </span>
        )}
      </div>
    </div>
  );
}
